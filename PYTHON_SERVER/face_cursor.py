"""
Face Cursor Server — WebSocket-controlled face-based mouse cursor
=================================================================
Tracks the user's nose position (+ optional head-pose blend) and
moves the OS mouse cursor with minimal jitter and latency.

One Euro Filter is used instead of a moving-median:
  • At low speed  → heavy smoothing (kills jitter)
  • At high speed → light smoothing (small latency)

WebSocket commands (port 8767):
  {"action": "start"}  — begin tracking
  {"action": "stop"}   — stop tracking & release camera
  {"action": "ping"}   — health-check → pong

RUN:
  python face_cursor.py
  python face_cursor.py --camera 0 --ws-port 8767
"""

import argparse, asyncio, json, math, os, sys, threading, time
from collections import deque
from typing import Optional

import cv2
import numpy as np
import mediapipe as mp

try:
    import pyautogui
    pyautogui.FAILSAFE = False
    pyautogui.PAUSE = 0          # remove built-in 0.1s delay
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyautogui"])
    import pyautogui
    pyautogui.FAILSAFE = False
    pyautogui.PAUSE = 0

try:
    import websockets
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets"])
    import websockets

# ─────────────────────────────────────────────────────────────────────────────
# Model
# ─────────────────────────────────────────────────────────────────────────────
MODEL_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "face_landmarker.task")
MODEL_URL  = ("https://storage.googleapis.com/mediapipe-models/"
              "face_landmarker/face_landmarker/float16/latest/face_landmarker.task")

def _ensure_model():
    if not os.path.exists(MODEL_FILE):
        import urllib.request
        print(f"[FACE-CURSOR] Downloading model → {MODEL_FILE}")
        def _prog(b, bs, tot):
            pct = min(b * bs / tot * 100, 100) if tot > 0 else 0
            sys.stdout.write(f"\r  [{'#'*int(pct/2)}{'-'*(50-int(pct/2))}] {pct:.1f}%")
            sys.stdout.flush()
        urllib.request.urlretrieve(MODEL_URL, MODEL_FILE, reporthook=_prog)
        print("\n[FACE-CURSOR] Model ready.")

# ─────────────────────────────────────────────────────────────────────────────
# Landmark indices
# ─────────────────────────────────────────────────────────────────────────────
NOSE_TIP    = 1
FOREHEAD    = 10
CHIN        = 152
LEFT_CHEEK  = 234
RIGHT_CHEEK = 454

# EAR (eye-open gating)
R_EYE_TOP, R_EYE_BOT, R_EYE_IN, R_EYE_OUT = 159, 145, 133, 33
L_EYE_TOP, L_EYE_BOT, L_EYE_IN, L_EYE_OUT = 386, 374, 362, 263

# ─────────────────────────────────────────────────────────────────────────────
# Tuning constants
# ─────────────────────────────────────────────────────────────────────────────
EAR_THRESHOLD    = 0.18   # below → eyes closed
BLINK_GRACE      = 3      # frames of grace before freezing cursor
DEAD_ZONE        = 0.012  # normalized screen fraction — kills micro-tremor
HEAD_POSE_WEIGHT = 0.30   # blend head-yaw/pitch into position signal
CALIB_FRAMES     = 45     # frames to collect before cursor activates

# One Euro Filter defaults (tweak beta to trade latency vs smoothness)
OEF_MIN_CUTOFF  = 1.0    # Hz — lower = more smoothing at rest
OEF_BETA        = 0.08   # speed coefficient — higher = less latency on fast moves
OEF_D_CUTOFF    = 1.0    # derivative cutoff

# ─────────────────────────────────────────────────────────────────────────────
# One Euro Filter
# ─────────────────────────────────────────────────────────────────────────────
class OneEuroFilter:
    """
    Adaptive low-pass filter that reduces jitter without adding
    significant lag during fast movements. (Géry et al. 2012)
    """

    def __init__(self, min_cutoff=OEF_MIN_CUTOFF, beta=OEF_BETA, d_cutoff=OEF_D_CUTOFF):
        self.min_cutoff = min_cutoff
        self.beta       = beta
        self.d_cutoff   = d_cutoff
        self._x         = None
        self._dx        = 0.0
        self._t         = None

    def _alpha(self, cutoff, dt):
        tau = 1.0 / (2 * math.pi * cutoff)
        return 1.0 / (1.0 + tau / dt)

    def __call__(self, x, t=None):
        if t is None:
            t = time.monotonic()
        if self._t is None:
            self._x, self._dx, self._t = x, 0.0, t
            return x

        dt = max(t - self._t, 1e-6)
        self._t = t

        # Derivative
        dx_raw     = (x - self._x) / dt
        a_d        = self._alpha(self.d_cutoff, dt)
        self._dx   = a_d * dx_raw + (1 - a_d) * self._dx

        # Adaptive cutoff
        cutoff     = self.min_cutoff + self.beta * abs(self._dx)
        a          = self._alpha(cutoff, dt)
        self._x    = a * x + (1 - a) * self._x
        return self._x

    def reset(self):
        self._x, self._dx, self._t = None, 0.0, None


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _screen_size():
    try:
        import ctypes
        u = ctypes.windll.user32
        return u.GetSystemMetrics(0), u.GetSystemMetrics(1)
    except Exception:
        return pyautogui.size()


def _ear(lms, top, bot, inn, out, w, h):
    """Eye Aspect Ratio — simple blink detector."""
    p = lambda i: np.array([lms[i].x * w, lms[i].y * h])
    vert  = np.linalg.norm(p(top) - p(bot))
    horiz = np.linalg.norm(p(inn) - p(out)) + 1e-6
    return vert / horiz


def _head_pose(lms, w, h):
    """Return normalized yaw (0-1) and pitch (0-1) from face landmarks."""
    p = lambda i: np.array([lms[i].x * w, lms[i].y * h])
    nose, fore, chin = p(NOSE_TIP), p(FOREHEAD), p(CHIN)
    lc, rc = p(LEFT_CHEEK), p(RIGHT_CHEEK)

    face_w      = np.linalg.norm(lc - rc) + 1e-6
    yaw_deg     = ((nose[0] - (lc[0] + rc[0]) / 2) / face_w) * 90.0
    pitch_ratio = (np.linalg.norm(fore - nose) - np.linalg.norm(chin - nose)) / \
                  (np.linalg.norm(fore - nose) + np.linalg.norm(chin - nose) + 1e-6)
    pitch_deg   = pitch_ratio * 60.0

    yaw_n   = np.clip(yaw_deg   / 35.0, -1.0, 1.0) * 0.5 + 0.5
    pitch_n = np.clip(pitch_deg / 25.0, -1.0, 1.0) * 0.5 + 0.5
    return float(yaw_n), float(pitch_n)


# ─────────────────────────────────────────────────────────────────────────────
# Engine
# ─────────────────────────────────────────────────────────────────────────────
class FaceCursorEngine:
    """
    Face-tracking engine that drives the OS cursor.
    Start/stop are thread-safe and callable from any thread.
    """

    def __init__(self, cam_idx=0, width=640, height=480):
        _ensure_model()
        self.cam_idx   = cam_idx
        self.cam_w     = width
        self.cam_h     = height
        self.scr_w, self.scr_h = _screen_size()

        # MediaPipe — IMAGE mode: simplest, no timestamp bookkeeping needed
        FLM     = mp.tasks.vision.FaceLandmarker
        FLMOpts = mp.tasks.vision.FaceLandmarkerOptions
        opts = FLMOpts(
            base_options=mp.tasks.BaseOptions(model_asset_path=MODEL_FILE),
            running_mode=mp.tasks.vision.RunningMode.IMAGE,
            num_faces=1,
            min_face_detection_confidence=0.6,
            min_face_presence_confidence=0.6,
            min_tracking_confidence=0.5,
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=False,
        )
        self.landmarker = FLM.create_from_options(opts)

        self.cap      = None
        self._running = False
        self._thread  = None
        self._lock    = threading.Lock()

        # One Euro Filters — one per axis
        self._oef_h = OneEuroFilter()
        self._oef_v = OneEuroFilter()

        # Auto-calibration (find the resting head center)
        self._calib_h: deque = deque(maxlen=CALIB_FRAMES)
        self._calib_v: deque = deque(maxlen=CALIB_FRAMES)
        self._center_h = 0.5
        self._center_v = 0.5
        self._calibrated = False

        # Cursor state
        self._last_sx = -1      # last screen X
        self._last_sy = -1      # last screen Y
        self._blink_streak = 0

        # WebSocket broadcast
        self._status      = "stopped"
        self._subscribers: set = set()
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    # ── Camera ──────────────────────────────────────────────────────────────

    def _open_camera(self):
        print(f"  [CAM] Opening camera #{self.cam_idx}…")
        cap = cv2.VideoCapture(self.cam_idx, cv2.CAP_DSHOW)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH,  self.cam_w)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.cam_h)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        cap.set(cv2.CAP_PROP_FPS, 30)
        time.sleep(0.3)
        self.cap = cap
        print(f"  [CAM] Camera #{self.cam_idx} ready.")

    def _close_camera(self):
        if self.cap:
            self.cap.release()
            self.cap = None
            print(f"  [CAM] Camera #{self.cam_idx} released.")

    # ── Control ──────────────────────────────────────────────────────────────

    def start(self):
        with self._lock:
            if self._running:
                return {"ok": True, "status": "already_tracking"}
            self._running = True

        self._reset()
        self._open_camera()
        self._thread = threading.Thread(target=self._loop_fn, daemon=True)
        self._thread.start()
        self._set_status("calibrating")
        return {"ok": True, "status": "started"}

    def stop(self):
        with self._lock:
            self._running = False
        if self._thread:
            self._thread.join(timeout=2)
            self._thread = None
        self._close_camera()
        self._set_status("stopped")
        return {"ok": True, "status": "stopped"}

    def _reset(self):
        self._oef_h.reset()
        self._oef_v.reset()
        self._calib_h.clear()
        self._calib_v.clear()
        self._calibrated = False
        self._last_sx = self._last_sy = -1
        self._blink_streak = 0

    def cleanup(self):
        self.stop()
        self.landmarker.close()

    # ── Status broadcast ─────────────────────────────────────────────────────

    def subscribe(self, q, loop):
        with self._lock:
            self._subscribers.add(q)
            self._loop = loop

    def unsubscribe(self, q):
        with self._lock:
            self._subscribers.discard(q)

    def _set_status(self, status):
        self._status = status
        self._broadcast({"type": "status", "status": status, "ts": time.time()})

    def _broadcast(self, payload):
        with self._lock:
            subs, loop = list(self._subscribers), self._loop
        if loop and loop.is_running():
            for q in subs:
                try:
                    loop.call_soon_threadsafe(q.put_nowait, payload)
                except Exception:
                    pass

    # ── Main loop ────────────────────────────────────────────────────────────

    def _loop_fn(self):
        """Background thread: grab frame → detect → filter → move cursor."""
        RANGE_H = 0.18   # expected nose travel ±range from center
        RANGE_V = 0.14

        while True:
            with self._lock:
                if not self._running:
                    break

            # ── Grab latest frame (discard buffered) ──
            self.cap.grab()
            ok, frame = self.cap.retrieve()
            if not ok or frame is None:
                time.sleep(0.005)
                continue

            frame = cv2.flip(frame, 1)
            h, w  = frame.shape[:2]

            # ── MediaPipe inference ──
            rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            try:
                result = self.landmarker.detect(mp_img)
            except Exception:
                continue

            if not result.face_landmarks:
                if self._calibrated and self._status != "paused":
                    self._set_status("paused")
                continue

            lms = result.face_landmarks[0]

            # ── EAR blink gate ──
            left_ear  = _ear(lms, L_EYE_TOP, L_EYE_BOT, L_EYE_IN, L_EYE_OUT, w, h)
            right_ear = _ear(lms, R_EYE_TOP, R_EYE_BOT, R_EYE_IN, R_EYE_OUT, w, h)
            eyes_open = (left_ear + right_ear) / 2.0 > EAR_THRESHOLD

            if not eyes_open:
                self._blink_streak += 1
                if self._blink_streak > BLINK_GRACE:
                    continue          # cursor frozen; skip move
            else:
                self._blink_streak = 0

            # ── Raw signal: nose position + head pose blend ──
            nose  = lms[NOSE_TIP]
            raw_h = float(nose.x)
            raw_v = float(nose.y)

            yaw_n, pitch_n = _head_pose(lms, w, h)
            pw      = HEAD_POSE_WEIGHT
            signal_h = raw_h * (1 - pw) + yaw_n   * pw
            signal_v = raw_v * (1 - pw) + pitch_n * pw

            # ── Auto-calibration: collect center at rest ──
            if not self._calibrated:
                self._calib_h.append(signal_h)
                self._calib_v.append(signal_v)
                if len(self._calib_h) >= CALIB_FRAMES:
                    self._center_h = float(np.median(self._calib_h))
                    self._center_v = float(np.median(self._calib_v))
                    self._calibrated = True
                    self._set_status("tracking")
                    print(f"  [CALIBRATED] center h={self._center_h:.3f} v={self._center_v:.3f}")
                continue

            # ── Map relative offset to 0-1 screen space ──
            norm_h = np.clip(0.5 + (signal_h - self._center_h) / (2 * RANGE_H), 0.0, 1.0)
            norm_v = np.clip(0.5 + (signal_v - self._center_v) / (2 * RANGE_V), 0.0, 1.0)

            # ── One Euro Filter (removes jitter, preserves speed) ──
            t      = time.monotonic()
            filt_h = self._oef_h(norm_h, t)
            filt_v = self._oef_v(norm_v, t)

            # ── Dead-zone: suppress sub-pixel tremor ──
            scr_h = float(filt_h) * self.scr_w
            scr_v = float(filt_v) * self.scr_h

            if self._last_sx >= 0:
                if abs(scr_h - self._last_sx) < DEAD_ZONE * self.scr_w and \
                   abs(scr_v - self._last_sy) < DEAD_ZONE * self.scr_h:
                    continue          # within dead-zone → don't move

            target_x = int(np.clip(scr_h, 10, self.scr_w - 10))
            target_y = int(np.clip(scr_v, 10, self.scr_h - 10))

            self._last_sx = target_x
            self._last_sy = target_y

            pyautogui.moveTo(target_x, target_y, _pause=False)

            if self._status != "tracking":
                self._set_status("tracking")


# ─────────────────────────────────────────────────────────────────────────────
# WebSocket server
# ─────────────────────────────────────────────────────────────────────────────
_engine: Optional[FaceCursorEngine] = None


async def _ws_handler(websocket):
    q    = asyncio.Queue(maxsize=8)
    loop = asyncio.get_event_loop()
    _engine.subscribe(q, loop)
    print(f"  [WS] + {websocket.remote_address}")

    # Send current status on connect
    await websocket.send(json.dumps({"type": "status", "status": _engine._status, "ts": time.time()}))

    async def _sender():
        while True:
            msg = await q.get()
            try:
                await websocket.send(json.dumps(msg))
            except Exception:
                break

    async def _receiver():
        async for raw in websocket:
            try:
                cmd    = json.loads(raw)
                action = cmd.get("action", "")
                if action == "start":
                    result = _engine.start()
                elif action == "stop":
                    result = _engine.stop()
                elif action == "ping":
                    result = {"type": "pong", "status": _engine._status, "ts": time.time()}
                else:
                    result = {"error": f"unknown action: {action}"}
                await websocket.send(json.dumps(result))
            except Exception as e:
                await websocket.send(json.dumps({"error": str(e)}))

    try:
        await asyncio.gather(_sender(), _receiver())
    except Exception:
        pass
    finally:
        _engine.unsubscribe(q)
        print(f"  [WS] - {websocket.remote_address}")


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description="Face Cursor WebSocket Server")
    ap.add_argument("--ws-port", type=int, default=8767)
    ap.add_argument("--camera",  type=int, default=0)
    ap.add_argument("--width",   type=int, default=640)
    ap.add_argument("--height",  type=int, default=480)
    args = ap.parse_args()

    global _engine
    print("=" * 56)
    print("  FACE CURSOR SERVER")
    print(f"  WebSocket → ws://localhost:{args.ws_port}")
    print(f"  Camera    → #{args.camera}")
    print("  Camera opens when 'start' is received.")
    print("  Ctrl+C to quit")
    print("=" * 56)

    _engine = FaceCursorEngine(cam_idx=args.camera, width=args.width, height=args.height)

    async def _serve():
        async with websockets.serve(_ws_handler, "0.0.0.0", args.ws_port):
            print(f"\n  Listening on :{args.ws_port}  (waiting for 'start')…\n")
            await asyncio.Future()

    try:
        asyncio.run(_serve())
    except KeyboardInterrupt:
        print("\n  Shutting down…")
        _engine.cleanup()


if __name__ == "__main__":
    main()