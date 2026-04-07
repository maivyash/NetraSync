"""
Face Cursor Server — WebSocket-controlled face-based mouse cursor
==================================================================
Uses MediaPipe FaceLandmarker (same model as eynoix_server.py) to track
the user's face/iris and move the OS mouse cursor via pyautogui.

The frontend sends JSON commands over WebSocket (port 8767):
  {"action": "start"}   — begin face tracking & cursor control
  {"action": "stop"}    — stop tracking & release camera
  {"action": "ping"}    — health check

This server is SEPARATE from eynoix_server.py:
  • eynoix_server.py  → alignment / misalignment analysis  (port 8765)
  • face_cursor.py    → OS cursor control for games         (port 8767)

RUN:
  python face_cursor.py
  python face_cursor.py --camera 0 --ws-port 8767
"""

import argparse, asyncio, json, os, sys, threading, time, math
from collections import deque
from typing import Optional

import cv2
import numpy as np
import mediapipe as mp

try:
    import pyautogui
    pyautogui.FAILSAFE = False
except ImportError:
    print("[FACE-CURSOR] pyautogui not found, installing…")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyautogui"])
    import pyautogui
    pyautogui.FAILSAFE = False

try:
    import websockets
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets"])
    import websockets

# ─────────────────────────────────────────────────────────────────────────────
# Model path (same model as eynoix_server)
# ─────────────────────────────────────────────────────────────────────────────
MODEL_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "face_landmarker.task")
MODEL_URL  = ("https://storage.googleapis.com/mediapipe-models/"
              "face_landmarker/face_landmarker/float16/latest/face_landmarker.task")

def _ensure_model():
    if not os.path.exists(MODEL_FILE):
        import urllib.request
        print(f"[FACE-CURSOR] Downloading model → {MODEL_FILE}")
        def _p(b, bs, tot):
            pct = min(b * bs / tot * 100, 100) if tot > 0 else 0
            sys.stdout.write(f"\r  [{'#'*int(pct/2)}{'-'*(50-int(pct/2))}] {pct:.1f}%")
            sys.stdout.flush()
        urllib.request.urlretrieve(MODEL_URL, MODEL_FILE, reporthook=_p)
        print("\n[FACE-CURSOR] Model ready.")

# ─────────────────────────────────────────────────────────────────────────────
# Landmark constants
# ─────────────────────────────────────────────────────────────────────────────
NOSE_TIP = 1
FOREHEAD = 10
CHIN = 152
LEFT_CHEEK = 234
RIGHT_CHEEK = 454

# Right eye (user's right = camera left due to mirror)
RIGHT_EYE_TOP = 159
RIGHT_EYE_BOTTOM = 145
# Left eye
LEFT_EYE_TOP = 386
LEFT_EYE_BOTTOM = 374

# Iris indices  
RIGHT_IRIS_CENTER = 468
LEFT_IRIS_CENTER = 473

# ─────────────────────────────────────────────────────────────────────────────
# Tracking constants
# ─────────────────────────────────────────────────────────────────────────────
EAR_OPEN_THRESHOLD = 0.18
BLINK_GRACE_FRAMES = 3
SMOOTH_WINDOW = 10
DEAD_ZONE = 0.008
HEAD_POSE_WEIGHT = 0.35


def _screen_size():
    try:
        import ctypes
        u = ctypes.windll.user32
        return u.GetSystemMetrics(0), u.GetSystemMetrics(1)
    except Exception:
        return pyautogui.size()


def estimate_head_pose(landmarks, w, h):
    """Compute yaw and pitch from face landmarks."""
    nose = np.array([landmarks[NOSE_TIP].x * w, landmarks[NOSE_TIP].y * h])
    fore = np.array([landmarks[FOREHEAD].x * w, landmarks[FOREHEAD].y * h])
    chin = np.array([landmarks[CHIN].x * w, landmarks[CHIN].y * h])
    lc   = np.array([landmarks[LEFT_CHEEK].x * w, landmarks[LEFT_CHEEK].y * h])
    rc   = np.array([landmarks[RIGHT_CHEEK].x * w, landmarks[RIGHT_CHEEK].y * h])
    face_width    = np.linalg.norm(lc - rc) + 1e-6
    face_center_x = (lc[0] + rc[0]) / 2.0
    nose_offset   = (nose[0] - face_center_x) / face_width
    yaw_deg       = nose_offset * 90.0
    fore_dist     = np.linalg.norm(fore - nose)
    chin_dist     = np.linalg.norm(chin - nose)
    pitch_ratio   = (fore_dist - chin_dist) / (fore_dist + chin_dist + 1e-6)
    pitch_deg     = pitch_ratio * 60.0
    return yaw_deg, pitch_deg


class FaceCursorEngine:
    """
    Face-based cursor engine.
    Uses nose position + head yaw/pitch to drive the OS cursor.
    EAR gating ensures cursor only moves when eyes are open.
    """

    def __init__(self, cam_idx=0, width=640, height=480):
        _ensure_model()
        self.cam_idx = cam_idx
        self.cam_width = width
        self.cam_height = height
        self.screen_w, self.screen_h = _screen_size()

        # MediaPipe FaceLandmarker
        BaseOpts = mp.tasks.BaseOptions
        FLM      = mp.tasks.vision.FaceLandmarker
        FLMOpts  = mp.tasks.vision.FaceLandmarkerOptions
        RunMode  = mp.tasks.vision.RunningMode
        opts = FLMOpts(
            base_options=BaseOpts(model_asset_path=MODEL_FILE),
            running_mode=RunMode.IMAGE,
            num_faces=1,
            min_face_detection_confidence=0.5,
            min_face_presence_confidence=0.5,
            min_tracking_confidence=0.5,
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=False,
        )
        self.landmarker = FLM.create_from_options(opts)

        # Camera state
        self.cap = None
        self._tracking = False
        self._thread = None
        self._lock = threading.Lock()

        # Smoothing buffers
        self._buf_h = deque(maxlen=SMOOTH_WINDOW)
        self._buf_v = deque(maxlen=SMOOTH_WINDOW)

        # Calibration
        self._calib_buf_h = deque(maxlen=60)
        self._calib_buf_v = deque(maxlen=60)
        self._center_h = 0.5
        self._center_v = 0.5
        self._calibrated = False

        # Blink gating
        self._closed_streak = 0
        self._last_h = 0.5
        self._last_v = 0.5
        self._active = False

        # Status broadcast
        self._status = "stopped"  # stopped | calibrating | tracking | paused
        self._subscribers = set()
        self._event_loop = None

    def _open_camera(self):
        if self.cap is not None:
            return
        print(f"  [CAM] Opening camera #{self.cam_idx}…")
        self.cap = cv2.VideoCapture(self.cam_idx, cv2.CAP_DSHOW)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.cam_width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.cam_height)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self.cap.set(cv2.CAP_PROP_FPS, 60)
        time.sleep(0.3)
        print(f"  [CAM] Camera #{self.cam_idx} ready.")

    def _close_camera(self):
        if self.cap is not None:
            print(f"  [CAM] Releasing camera #{self.cam_idx}.")
            self.cap.release()
            self.cap = None

    def _reset_state(self):
        self._buf_h.clear()
        self._buf_v.clear()
        self._calib_buf_h.clear()
        self._calib_buf_v.clear()
        self._calibrated = False
        self._closed_streak = 0
        self._last_h = 0.5
        self._last_v = 0.5
        self._active = False

    def start(self):
        """Start face tracking and cursor control."""
        with self._lock:
            if self._tracking:
                return {"ok": True, "status": "already_tracking"}
            self._tracking = True
            self._reset_state()
        self._open_camera()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        self._set_status("calibrating")
        return {"ok": True, "status": "started"}

    def stop(self):
        """Stop face tracking and release camera."""
        with self._lock:
            self._tracking = False
        if self._thread:
            self._thread.join(timeout=2)
            self._thread = None
        self._close_camera()
        self._set_status("stopped")
        return {"ok": True, "status": "stopped"}

    def _set_status(self, status):
        self._status = status
        payload = {"type": "status", "status": status, "timestamp": time.time()}
        self._broadcast(payload)

    def _broadcast(self, payload):
        with self._lock:
            subs = list(self._subscribers)
            loop = self._event_loop
        if loop and loop.is_running():
            for q in subs:
                try:
                    loop.call_soon_threadsafe(q.put_nowait, payload)
                except Exception:
                    pass

    def subscribe(self, q, loop):
        with self._lock:
            self._subscribers.add(q)
            self._event_loop = loop

    def unsubscribe(self, q):
        with self._lock:
            self._subscribers.discard(q)

    def _compute_ear(self, landmarks, top_idx, bottom_idx, inner_idx, outer_idx, w, h):
        """Compute Eye Aspect Ratio."""
        top = np.array([landmarks[top_idx].x * w, landmarks[top_idx].y * h])
        bot = np.array([landmarks[bottom_idx].x * w, landmarks[bottom_idx].y * h])
        inn = np.array([landmarks[inner_idx].x * w, landmarks[inner_idx].y * h])
        out = np.array([landmarks[outer_idx].x * w, landmarks[outer_idx].y * h])
        vert = np.linalg.norm(top - bot)
        horiz = np.linalg.norm(inn - out) + 1e-6
        return vert / horiz

    def _loop(self):
        """Main tracking loop — runs on a background thread."""
        while True:
            with self._lock:
                if not self._tracking:
                    break
            if self.cap is None:
                time.sleep(0.01)
                continue

            ret, frame = self.cap.read()
            if not ret or frame is None:
                time.sleep(0.005)
                continue

            frame = cv2.flip(frame, 1)
            h, w = frame.shape[:2]

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

            try:
                result = self.landmarker.detect(mp_img)
            except Exception:
                continue

            if not result.face_landmarks:
                # No face → pause cursor
                if self._status != "paused" and self._calibrated:
                    self._set_status("paused")
                continue

            lms = result.face_landmarks[0]

            # ── Eye-open gating ──
            left_ear = self._compute_ear(lms, 386, 374, 362, 263, w, h)
            right_ear = self._compute_ear(lms, 159, 145, 133, 33, w, h)
            avg_ear = (left_ear + right_ear) / 2.0
            eyes_open = avg_ear > EAR_OPEN_THRESHOLD

            if not eyes_open:
                self._closed_streak += 1
            else:
                self._closed_streak = 0

            if self._closed_streak > BLINK_GRACE_FRAMES:
                # Eyes closed → freeze cursor
                continue

            # ── Face position: nose tip normalized ──
            nose = lms[NOSE_TIP]
            raw_h = float(nose.x)
            raw_v = float(nose.y)

            # ── Head pose ──
            head_yaw, head_pitch = estimate_head_pose(lms, w, h)
            yaw_norm = np.clip(head_yaw / 35.0, -1.0, 1.0) * 0.5 + 0.5
            pitch_norm = np.clip(head_pitch / 25.0, -1.0, 1.0) * 0.5 + 0.5

            # Blend face position + head pose
            pw = HEAD_POSE_WEIGHT
            blended_h = raw_h * (1 - pw) + yaw_norm * pw
            blended_v = raw_v * (1 - pw) + pitch_norm * pw

            # ── Auto-calibration ──
            if not self._calibrated:
                self._calib_buf_h.append(blended_h)
                self._calib_buf_v.append(blended_v)
                if len(self._calib_buf_h) >= 40:
                    self._center_h = float(np.median(self._calib_buf_h))
                    self._center_v = float(np.median(self._calib_buf_v))
                    self._calibrated = True
                    self._set_status("tracking")
                    print(f"  [FACE-CURSOR] Calibrated center: h={self._center_h:.3f} v={self._center_v:.3f}")
                continue

            # ── Map relative to calibrated center → 0-1 ──
            RANGE_H = 0.18
            RANGE_V = 0.14
            norm_h = 0.5 + (blended_h - self._center_h) / (2 * RANGE_H)
            norm_v = 0.5 + (blended_v - self._center_v) / (2 * RANGE_V)
            norm_h = float(np.clip(norm_h, 0.0, 1.0))
            norm_v = float(np.clip(norm_v, 0.0, 1.0))

            # ── Dead-zone ──
            if self._active:
                if abs(norm_h - self._last_h) < DEAD_ZONE:
                    norm_h = self._last_h
                if abs(norm_v - self._last_v) < DEAD_ZONE:
                    norm_v = self._last_v

            # ── Smooth with moving-median ──
            self._buf_h.append(norm_h)
            self._buf_v.append(norm_v)
            smooth_h = float(np.median(self._buf_h))
            smooth_v = float(np.median(self._buf_v))

            self._last_h = smooth_h
            self._last_v = smooth_v
            self._active = True

            # ── Move OS cursor ──
            margin = 10
            target_x = int(np.clip(smooth_h * self.screen_w, margin, self.screen_w - margin))
            target_y = int(np.clip(smooth_v * self.screen_h, margin, self.screen_h - margin))
            pyautogui.moveTo(target_x, target_y, _pause=False)

            if self._status != "tracking":
                self._set_status("tracking")

    def cleanup(self):
        self.stop()
        self.landmarker.close()


# ─────────────────────────────────────────────────────────────────────────────
# WEBSOCKET SERVER
# ─────────────────────────────────────────────────────────────────────────────
_engine: Optional[FaceCursorEngine] = None


async def _ws_handler(websocket):
    q = asyncio.Queue(maxsize=8)
    loop = asyncio.get_event_loop()
    _engine.subscribe(q, loop)
    print(f"  [WS] + Client connected: {websocket.remote_address}")

    # Send current status immediately
    await websocket.send(json.dumps({
        "type": "status",
        "status": _engine._status,
        "timestamp": time.time(),
    }))

    async def _send():
        while True:
            payload = await q.get()
            try:
                await websocket.send(json.dumps(payload))
            except Exception:
                break

    async def _recv():
        async for raw in websocket:
            try:
                cmd = json.loads(raw)
                action = cmd.get("action", "")

                if action == "start":
                    result = _engine.start()
                elif action == "stop":
                    result = _engine.stop()
                elif action == "ping":
                    result = {"type": "pong", "status": _engine._status, "timestamp": time.time()}
                else:
                    result = {"error": f"Unknown action: {action}"}

                await websocket.send(json.dumps(result))
            except Exception as e:
                await websocket.send(json.dumps({"error": str(e)}))

    try:
        await asyncio.gather(_send(), _recv())
    except Exception:
        pass
    finally:
        _engine.unsubscribe(q)
        print(f"  [WS] - Client disconnected: {websocket.remote_address}")


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
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
    print("  FACE CURSOR Server")
    print(f"  WebSocket  →  ws://localhost:{args.ws_port}")
    print(f"  Camera #{args.camera}")
    print("  Camera opens ONLY when 'start' command is received.")
    print("  Ctrl+C to stop")
    print("=" * 56)

    _engine = FaceCursorEngine(
        cam_idx=args.camera,
        width=args.width,
        height=args.height,
    )

    async def _ws():
        async with websockets.serve(_ws_handler, "0.0.0.0", args.ws_port):
            print(f"\n  WS ready on :{args.ws_port}")
            print(f"  Waiting for client to send 'start' command…\n")
            await asyncio.Future()

    try:
        asyncio.run(_ws())
    except KeyboardInterrupt:
        print("\n  Shutting down…")
        _engine.cleanup()

if __name__ == "__main__":
    main()