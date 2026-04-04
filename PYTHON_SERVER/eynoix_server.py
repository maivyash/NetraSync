"""
EYNOIX Server  —  WebSocket + HTTP REST API
============================================
Wraps eye_tracker.py's exact calculations into a network server.
Zero changes to any math, thresholds, or detection logic.

CAMERA LAZY-OPEN BEHAVIOUR
───────────────────────────
The physical camera is NOT opened at startup.
It opens automatically the first time a WebSocket client connects (live preview)
or when POST /camera is called to switch cameras.
When the last WebSocket subscriber disconnects, the camera is released.
Single-frame endpoints (/capture, /analyze_image, POST /capture) work without
a persistent camera stream — /capture briefly opens the camera, grabs one frame,
then releases it again if no live clients are connected.

ENDPOINTS
─────────
WebSocket  ws://localhost:8765
  ← streams live frame data at camera FPS
  → accepts JSON commands (see handle_command)

HTTP REST  http://localhost:8766
  GET  /                 — health + endpoint list
  GET  /latest           — latest processed frame (JSON)
  GET  /cameras          — list available cameras
  GET  /gaze             — cardinal gaze direction of dominant eye
  GET  /reset            — reset all smoothing buffers
  POST /capture          — freeze + full analysis  {include_image: bool}
  POST /capture/image    — same + base64 JPEG always included
  POST /dominant         — {side: "left"|"right"}
  POST /camera           — {index, width, height}
  POST /cursor/enable    — {speed: float}  start cursor control
  POST /cursor/disable   — stop cursor control
  POST /analyze_image    — {image_base64: "..."}  analyse external image

RUN
───
  pip install websockets
  python eynoix_server.py
  python eynoix_server.py --camera 0 --dominant right --ws-port 8765 --http-port 8766
"""

import argparse, asyncio, base64, copy, json, math, os, sys
import threading, time
from collections import deque
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Optional, Tuple

import cv2, numpy as np, mediapipe as mp, ctypes

try:
    import pyautogui
    pyautogui.FAILSAFE = False
    _CURSOR_BACKEND = "pyautogui"
except ImportError:
    _CURSOR_BACKEND = "win32"

try:
    import websockets
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets"])
    import websockets

# ─────────────────────────────────────────────────────────────────────────────
# ALL CONSTANTS — VERBATIM from eye_tracker.py
# ─────────────────────────────────────────────────────────────────────────────

MODEL_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "face_landmarker.task")
MODEL_URL  = ("https://storage.googleapis.com/mediapipe-models/"
              "face_landmarker/face_landmarker/float16/latest/face_landmarker.task")

LEFT_IRIS_CENTER=473; LEFT_IRIS_POINTS=[473,474,475,476,477]
RIGHT_IRIS_CENTER=468; RIGHT_IRIS_POINTS=[468,469,470,471,472]
LEFT_EYE_INNER=362; LEFT_EYE_OUTER=263; LEFT_EYE_TOP=386; LEFT_EYE_BOTTOM=374
RIGHT_EYE_INNER=133; RIGHT_EYE_OUTER=33; RIGHT_EYE_TOP=159; RIGHT_EYE_BOTTOM=145

FACE_OVAL=[10,338,297,332,284,251,389,356,454,323,361,288,
           397,365,379,378,400,377,152,148,176,149,150,136,
           172,58,132,93,234,127,162,21,54,103,67,109]

NOSE_TIP=1; FOREHEAD=10; CHIN=152; LEFT_CHEEK=234; RIGHT_CHEEK=454

C_GREEN=(0,220,0); C_YELLOW=(0,220,255); C_RED=(0,0,255)
C_CYAN=(255,255,0); C_WHITE=(255,255,255); C_BLACK=(0,0,0)
C_DARK=(20,20,25); C_PANEL=(35,35,42)
C_IRIS_L=(255,200,0); C_IRIS_R=(0,200,255)
C_DOM=(0,255,180); C_T_ON=(0,255,255); C_CAPTURE=(180,255,180)

NOISE_FLOOR=0.025; MILD_RATIO_THR=0.06; MOD_RATIO_THR=0.12; SEV_RATIO_THR=0.20
MILD_THR=15.0; MOD_THR=40.0; SEV_THR=70.0; MAX_DEV=0.30


# ─────────────────────────────────────────────────────────────────────────────
# ALL FUNCTIONS — VERBATIM from eye_tracker.py
# ─────────────────────────────────────────────────────────────────────────────

def _ensure_model():
    if not os.path.exists(MODEL_FILE):
        import urllib.request
        print(f"[EYNOIX] Downloading model → {MODEL_FILE}")
        def _p(b,bs,tot):
            pct=min(b*bs/tot*100,100) if tot>0 else 0
            sys.stdout.write(f"\r  [{'#'*int(pct/2)}{'-'*(50-int(pct/2))}] {pct:.1f}%")
            sys.stdout.flush()
        urllib.request.urlretrieve(MODEL_URL, MODEL_FILE, reporthook=_p)
        print("\n[EYNOIX] Model ready.")


def _move_cursor(x, y):
    if _CURSOR_BACKEND == "pyautogui":
        pyautogui.moveTo(x, y, _pause=False)
    else:
        ctypes.windll.user32.SetCursorPos(int(x), int(y))


def _screen_size():
    try:
        u = ctypes.windll.user32
        return u.GetSystemMetrics(0), u.GetSystemMetrics(1)
    except Exception:
        return 1920, 1080


def estimate_head_pose(landmarks, w, h):
    """VERBATIM from eye_tracker.py"""
    nose = np.array([landmarks[NOSE_TIP].x*w,    landmarks[NOSE_TIP].y*h])
    fore = np.array([landmarks[FOREHEAD].x*w,    landmarks[FOREHEAD].y*h])
    chin = np.array([landmarks[CHIN].x*w,        landmarks[CHIN].y*h])
    lc   = np.array([landmarks[LEFT_CHEEK].x*w,  landmarks[LEFT_CHEEK].y*h])
    rc   = np.array([landmarks[RIGHT_CHEEK].x*w, landmarks[RIGHT_CHEEK].y*h])
    face_width    = np.linalg.norm(lc - rc) + 1e-6
    face_center_x = (lc[0] + rc[0]) / 2.0
    nose_offset   = (nose[0] - face_center_x) / face_width
    yaw_deg       = nose_offset * 90.0
    fore_dist     = np.linalg.norm(fore - nose)
    chin_dist     = np.linalg.norm(chin - nose)
    pitch_ratio   = (fore_dist - chin_dist) / (fore_dist + chin_dist + 1e-6)
    pitch_deg     = pitch_ratio * 60.0
    roll_deg      = math.degrees(math.atan2(rc[1]-lc[1], rc[0]-lc[0]))
    return yaw_deg, pitch_deg, roll_deg


@dataclass
class EyeGaze:
    """VERBATIM from eye_tracker.py — all update() math preserved exactly."""
    name:str; iris_points:list; iris_center_idx:int
    inner_idx:int; outer_idx:int; top_idx:int; bottom_idx:int; color:tuple
    iris_center:Optional[Tuple[int,int]]=None; iris_radius:int=0
    h_ratio:float=0.5; v_ratio:float=0.5
    gaze_vector:np.ndarray=field(default_factory=lambda:np.zeros(2))
    eye_bbox:Optional[Tuple]=None; ear:float=0.0
    pupil_diameter_rel:float=0.0; h_angle_deg:float=0.0; v_angle_deg:float=0.0
    _raw_h:float=0.5; _raw_v:float=0.5

    def update(self, landmarks, w, h):
        """VERBATIM — fixed-reference vertical method from eye_tracker.py"""
        ic = landmarks[self.iris_center_idx]
        self.iris_center = (int(ic.x*w), int(ic.y*h))
        pts = np.array([[landmarks[i].x*w, landmarks[i].y*h]
                        for i in self.iris_points], dtype=np.float32)
        center = np.mean(pts, axis=0)
        self.iris_radius = max(1, int(np.mean(np.linalg.norm(pts-center, axis=1))))
        inner=landmarks[self.inner_idx]; outer=landmarks[self.outer_idx]
        top=landmarks[self.top_idx];    bot=landmarks[self.bottom_idx]
        ip=np.array([inner.x*w,inner.y*h]); op=np.array([outer.x*w,outer.y*h])
        tp=np.array([top.x*w,  top.y*h]);   bp=np.array([bot.x*w,  bot.y*h])
        eye_axis=ip-op; ew=np.linalg.norm(eye_axis)+1e-6; eye_axis_unit=eye_axis/ew
        iris_vec=center-op
        h_proj=np.dot(iris_vec, eye_axis_unit)/ew
        self._raw_h=float(np.clip(h_proj,0.0,1.0)); self.h_ratio=self._raw_h
        perp=np.array([-eye_axis_unit[1], eye_axis_unit[0]])
        if perp[1]<0: perp=-perp
        eye_mid=(ip+op)/2.0
        v_offset=np.dot(center-eye_mid, perp)
        V_GAIN=2.5
        v_normalized=(v_offset/ew)*V_GAIN
        self._raw_v=float(np.clip(0.5+v_normalized,0.0,1.0)); self.v_ratio=self._raw_v
        self.gaze_vector=np.array([self.h_ratio-0.5, self.v_ratio-0.5])
        self.ear=float(np.linalg.norm(tp-bp)/ew)
        ex=[int(outer.x*w),int(inner.x*w)]; ey=[int(top.y*h),int(bot.y*h)]; pad=12
        self.eye_bbox=(min(ex)-pad,min(ey)-pad,max(ex)+pad,max(ey)+pad)
        self.pupil_diameter_rel=(self.iris_radius*2)/ew
        self.h_angle_deg=math.degrees(math.atan2(self.gaze_vector[0],1))
        self.v_angle_deg=math.degrees(math.atan2(self.gaze_vector[1],1))

    def to_dict(self):
        return {
            "name":               self.name,
            "iris_center":        list(self.iris_center) if self.iris_center else None,
            "iris_radius_px":     self.iris_radius,
            "h_ratio":            round(self.h_ratio, 5),
            "v_ratio":            round(self.v_ratio, 5),
            "gaze_vector":        [round(float(x),5) for x in self.gaze_vector],
            "h_angle_deg":        round(self.h_angle_deg, 3),
            "v_angle_deg":        round(self.v_angle_deg, 3),
            "ear":                round(self.ear, 5),
            "pupil_diameter_rel": round(self.pupil_diameter_rel, 5),
            "eye_bbox":           list(self.eye_bbox) if self.eye_bbox else None,
        }


class RatioSmoother:
    """VERBATIM from eye_tracker.py"""
    def __init__(self, window=8):
        self.left_h=deque(maxlen=window); self.left_v=deque(maxlen=window)
        self.right_h=deque(maxlen=window); self.right_v=deque(maxlen=window)

    def push(self, le:EyeGaze, re:EyeGaze):
        self.left_h.append(le._raw_h); self.left_v.append(le._raw_v)
        self.right_h.append(re._raw_h); self.right_v.append(re._raw_v)

    def get_smoothed(self):
        if not self.left_h: return 0.5,0.5,0.5,0.5
        return (float(np.median(self.left_h)), float(np.median(self.left_v)),
                float(np.median(self.right_h)), float(np.median(self.right_v)))

    def apply_smoothed(self, le:EyeGaze, re:EyeGaze):
        lh,lv,rh,rv=self.get_smoothed()
        le.h_ratio=lh; le.v_ratio=lv
        le.gaze_vector=np.array([lh-0.5,lv-0.5])
        le.h_angle_deg=math.degrees(math.atan2(lh-0.5,1))
        le.v_angle_deg=math.degrees(math.atan2(lv-0.5,1))
        re.h_ratio=rh; re.v_ratio=rv
        re.gaze_vector=np.array([rh-0.5,rv-0.5])
        re.h_angle_deg=math.degrees(math.atan2(rh-0.5,1))
        re.v_angle_deg=math.degrees(math.atan2(rv-0.5,1))

    def reset(self):
        self.left_h.clear(); self.left_v.clear()
        self.right_h.clear(); self.right_v.clear()


@dataclass
class MisalignResult:
    """VERBATIM from eye_tracker.py"""
    percentage:float=0.0; direction:str="Aligned"
    color:tuple=field(default_factory=lambda:(0,220,0))
    h_diff_deg:float=0.0; v_diff_deg:float=0.0; total_deg:float=0.0
    h_ratio_diff:float=0.0; v_ratio_diff:float=0.0
    strabismus:str="None"; severity:str="OK"

    def to_dict(self):
        return {
            "percentage":   round(self.percentage,3),
            "direction":    self.direction,
            "h_diff_deg":   round(self.h_diff_deg,3),
            "v_diff_deg":   round(self.v_diff_deg,3),
            "total_deg":    round(self.total_deg,3),
            "h_ratio_diff": round(self.h_ratio_diff,5),
            "v_ratio_diff": round(self.v_ratio_diff,5),
            "strabismus":   self.strabismus,
            "severity":     self.severity,
        }


def calc_misalignment(dominant:EyeGaze, non_dom:EyeGaze, head_yaw:float=0.0)->MisalignResult:
    """VERBATIM from eye_tracker.py — head-pose-compensated misalignment."""
    h_diff=non_dom.h_ratio-dominant.h_ratio
    v_diff=non_dom.v_ratio-dominant.v_ratio
    convergence_compensation=head_yaw*0.002
    h_diff_compensated=h_diff-convergence_compensation
    abs_h=abs(h_diff_compensated); abs_v=abs(v_diff)
    if abs_h<NOISE_FLOOR: abs_h=0.0; h_diff_compensated=0.0
    if abs_v<NOISE_FLOOR: abs_v=0.0; v_diff=0.0
    total_diff=math.sqrt(abs_h**2+abs_v**2)
    pct=min(100.0,(total_diff/MAX_DEV)*100.0)
    h_deg=abs_h*30.0; v_deg=abs_v*30.0
    total_deg=math.sqrt(h_deg**2+v_deg**2)
    parts=[]
    if abs_h>NOISE_FLOOR:
        parts.append("inward drift (eso)" if h_diff_compensated>0 else "outward drift (exo)")
    if abs_v>NOISE_FLOOR:
        parts.append("upward drift (hyper)" if v_diff<0 else "downward drift (hypo)")
    direction=" + ".join(parts) if parts else "Aligned"
    if total_diff<NOISE_FLOOR: strab,sev="None","OK"
    elif abs_h>abs_v:
        strab="Esotropia (inward turn)" if h_diff_compensated>0 else "Exotropia (outward turn)"
        sev="MILD" if total_diff<MILD_RATIO_THR else("MODERATE" if total_diff<MOD_RATIO_THR else "SEVERE")
    else:
        strab="Hypertropia (upward)" if v_diff<0 else "Hypotropia (downward)"
        sev="MILD" if total_diff<MILD_RATIO_THR else("MODERATE" if total_diff<MOD_RATIO_THR else "SEVERE")
    color=C_GREEN if pct<MILD_THR else(C_YELLOW if pct<MOD_THR else C_RED)
    return MisalignResult(percentage=pct,direction=direction,color=color,
        h_diff_deg=h_deg,v_diff_deg=v_deg,total_deg=total_deg,
        h_ratio_diff=h_diff_compensated,v_ratio_diff=v_diff,strabismus=strab,severity=sev)


class CursorTracker:
    """VERBATIM from eye_tracker.py — delta/velocity cursor."""
    def __init__(self,sw,sh,smooth=5,speed=20.0):
        self.sw=sw; self.sh=sh; self.speed=speed
        self.buf_gx=deque(maxlen=smooth); self.buf_gy=deque(maxlen=smooth)

    def move(self,eye:EyeGaze):
        if eye.iris_center is None: return
        self.buf_gx.append(float(eye.gaze_vector[0]))
        self.buf_gy.append(float(eye.gaze_vector[1]))
        sgx=float(np.mean(self.buf_gx)); sgy=float(np.mean(self.buf_gy))
        DEAD=0.04
        if abs(sgx)<DEAD: sgx=0.0
        if abs(sgy)<DEAD: sgy=0.0
        if sgx==0.0 and sgy==0.0: return
        try:
            import ctypes.wintypes
            pt=ctypes.wintypes.POINT()
            ctypes.windll.user32.GetCursorPos(ctypes.byref(pt))
            cx,cy=pt.x,pt.y
        except Exception:
            cx,cy=self.sw//2,self.sh//2
        dx=sgx*self.speed*(self.sw/640); dy=sgy*self.speed*(self.sh/480)
        nx=int(np.clip(cx+dx,0,self.sw-1)); ny=int(np.clip(cy+dy,0,self.sh-1))
        _move_cursor(nx,ny)

    def reset(self): self.buf_gx.clear(); self.buf_gy.clear()


class CameraCapture:
    """VERBATIM from eye_tracker.py"""
    def __init__(self,src=0,width=640,height=480):
        self.cap=cv2.VideoCapture(src,cv2.CAP_DSHOW)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH,width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT,height)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE,1)
        self.cap.set(cv2.CAP_PROP_FPS,60)
        self.lock=threading.Lock(); self.frame=None; self.running=True
        self._t=threading.Thread(target=self._loop,daemon=True); self._t.start()

    def _loop(self):
        while self.running:
            ret,f=self.cap.read()
            if ret:
                with self.lock: self.frame=f

    def read(self):
        with self.lock: return self.frame.copy() if self.frame is not None else None

    def release(self):
        self.running=False; self._t.join(timeout=1); self.cap.release()


def detect_cameras(max_n=8):
    found=[]
    for i in range(max_n):
        cap=cv2.VideoCapture(i,cv2.CAP_DSHOW)
        if cap.isOpened():
            ret,_=cap.read()
            if ret:
                w=int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                h=int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                found.append({"index":i,"label":f"Camera {i}","width":w,"height":h})
            cap.release()
    return found


# ─────────────────────────────────────────────────────────────────────────────
# ENGINE — same pipeline as main() in eye_tracker.py, but headless
# ─────────────────────────────────────────────────────────────────────────────

class EynoixEngine:
    def __init__(self, cam_idx=0, dominant_side="right", width=640, height=480):
        _ensure_model()
        self.cam_idx     = cam_idx
        self.cam_width   = width
        self.cam_height  = height
        self.dominant_side = dominant_side

        self._lock       = threading.Lock()
        self.running     = False        # live-loop running flag
        self.latest      = {}
        self.fps_buf     = deque(maxlen=30)
        self._prev_t     = time.perf_counter()
        self._subscribers = set()

        # Camera state — None until first live subscriber connects
        self.cam: Optional[CameraCapture] = None
        self._cam_lock   = threading.Lock()   # guards open/close of self.cam
        self._live_count = 0                  # number of active WS subscribers

        self.ratio_smoother = RatioSmoother(window=8)
        self.pct_buf     = deque(maxlen=12)
        sw, sh           = _screen_size()
        self.cursor_track = CursorTracker(sw, sh, smooth=5, speed=20.0)
        self.cursor_on   = False

        BaseOpts = mp.tasks.BaseOptions
        FLM      = mp.tasks.vision.FaceLandmarker
        FLMOpts  = mp.tasks.vision.FaceLandmarkerOptions
        RunMode  = mp.tasks.vision.RunningMode
        opts = FLMOpts(
            base_options=BaseOpts(model_asset_path=MODEL_FILE),
            running_mode=RunMode.IMAGE, num_faces=1,
            min_face_detection_confidence=0.5,
            min_face_presence_confidence=0.5,
            min_tracking_confidence=0.5,
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=False)
        self.landmarker = FLM.create_from_options(opts)

        self.left_eye  = EyeGaze("Left",  LEFT_IRIS_POINTS,  LEFT_IRIS_CENTER,
                                 LEFT_EYE_INNER,  LEFT_EYE_OUTER,  LEFT_EYE_TOP,  LEFT_EYE_BOTTOM,  C_IRIS_L)
        self.right_eye = EyeGaze("Right", RIGHT_IRIS_POINTS, RIGHT_IRIS_CENTER,
                                 RIGHT_EYE_INNER, RIGHT_EYE_OUTER, RIGHT_EYE_TOP, RIGHT_EYE_BOTTOM, C_IRIS_R)
        self._set_dom(dominant_side)

        self._thread = threading.Thread(target=self._loop, daemon=True)

    # ── Camera lifecycle helpers ───────────────────────────────────────────────

    def _open_camera(self):
        """Open the camera if it isn't already open. Thread-safe."""
        with self._cam_lock:
            if self.cam is None:
                print(f"  [CAM] Opening camera #{self.cam_idx} for live preview …")
                self.cam = CameraCapture(
                    src=self.cam_idx, width=self.cam_width, height=self.cam_height)
                time.sleep(0.4)   # let the capture thread warm up
                print(f"  [CAM] Camera #{self.cam_idx} ready.")

    def _close_camera(self):
        """Release the camera. Thread-safe."""
        with self._cam_lock:
            if self.cam is not None:
                print(f"  [CAM] Releasing camera #{self.cam_idx} (no live viewers).")
                self.cam.release()
                self.cam = None

    def _grab_one_frame(self):
        """
        Grab a single frame for /capture without requiring the live loop.
        Opens the camera briefly if not already open; leaves it open if live
        subscribers are connected, closes it again if none are.
        """
        with self._cam_lock:
            transient = self.cam is None    # we opened it just for this call
            if transient:
                cap = cv2.VideoCapture(self.cam_idx, cv2.CAP_DSHOW)
                cap.set(cv2.CAP_PROP_FRAME_WIDTH,  self.cam_width)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.cam_height)
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                # discard a couple of buffered frames so we get a fresh one
                for _ in range(3):
                    cap.read()
                ret, frame = cap.read()
                cap.release()
                return cv2.flip(frame, 1) if ret else None
            else:
                frame = self.cam.read()
                return cv2.flip(frame, 1) if frame is not None else None

    # ── Dominant / dom helpers ─────────────────────────────────────────────────

    def _set_dom(self, side):
        self.dominant_side = side
        if side == "left":
            self.dominant, self.non_dom = self.left_eye, self.right_eye
        else:
            self.dominant, self.non_dom = self.right_eye, self.left_eye

    # ── Engine start/stop ─────────────────────────────────────────────────────

    def start(self):
        """Start the background processing thread (camera stays closed until needed)."""
        self.running = True
        self._thread.start()

    def stop(self):
        self.running = False
        self._close_camera()
        self.landmarker.close()

    # ── Pipeline (unchanged math) ─────────────────────────────────────────────

    def _run_pipeline(self, frame):
        h, w = frame.shape[:2]
        rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = self.landmarker.detect(mp_img)

        now = time.perf_counter()
        self.fps_buf.append(1.0 / max(now - self._prev_t, 1e-6))
        self._prev_t = now
        fps = float(np.mean(self.fps_buf))

        if not result.face_landmarks:
            return {"type": "frame", "face_detected": False,
                    "fps": round(fps, 1), "timestamp": time.time()}

        lms = result.face_landmarks[0]
        self.left_eye.update(lms, w, h)
        self.right_eye.update(lms, w, h)
        self.ratio_smoother.push(self.left_eye, self.right_eye)
        self.ratio_smoother.apply_smoothed(self.left_eye, self.right_eye)
        head_yaw, head_pitch, head_roll = estimate_head_pose(lms, w, h)
        m = calc_misalignment(self.dominant, self.non_dom, head_yaw)
        self.pct_buf.append(m.percentage)
        m.percentage = float(np.mean(self.pct_buf))
        if   m.percentage < MILD_THR: m.color = C_GREEN
        elif m.percentage < MOD_THR:  m.color = C_YELLOW
        else:                          m.color = C_RED
        if self.cursor_on:
            self.cursor_track.move(self.dominant)
        ipd = tilt = None
        if self.left_eye.iris_center and self.right_eye.iris_center:
            dx = self.right_eye.iris_center[0] - self.left_eye.iris_center[0]
            dy = self.right_eye.iris_center[1] - self.left_eye.iris_center[1]
            ipd  = round(math.sqrt(dx*dx + dy*dy), 2)
            tilt = round(math.degrees(math.atan2(dy, dx)), 2)
        return {
            "type": "frame", "face_detected": True, "fps": round(fps, 1),
            "timestamp": time.time(), "dominant_side": self.dominant_side,
            "left_eye": self.left_eye.to_dict(), "right_eye": self.right_eye.to_dict(),
            "dominant_eye": self.dominant.to_dict(), "non_dominant_eye": self.non_dom.to_dict(),
            "misalignment": m.to_dict(),
            "head_pose": {"yaw_deg": round(head_yaw, 2),
                          "pitch_deg": round(head_pitch, 2),
                          "roll_deg": round(head_roll, 2)},
            "interpupillary_distance_px": ipd, "head_tilt_deg": tilt,
            "cursor_active": self.cursor_on,
        }

    def _loop(self):
        """
        Live processing loop.
        Sleeps cheaply when no subscribers (camera is also closed at that point).
        """
        while self.running:
            with self._lock:
                has_subs = bool(self._subscribers)
            if not has_subs:
                time.sleep(0.05)
                continue

            # Camera must be open if we have subscribers
            self._open_camera()

            frame = self.cam.read() if self.cam else None
            if frame is None:
                time.sleep(0.005)
                continue

            frame = cv2.flip(frame, 1)
            try:
                payload = self._run_pipeline(frame)
            except Exception as e:
                payload = {"type": "error", "message": str(e), "timestamp": time.time()}

            with self._lock:
                self.latest = payload

            for q in list(self._subscribers):
                try:
                    q.put_nowait(payload)
                except Exception:
                    pass

    # ── Subscriber management (controls camera lifecycle) ─────────────────────

    def subscribe(self, q):
        with self._lock:
            self._subscribers.add(q)
            self._live_count = len(self._subscribers)
        # Camera will be opened lazily by _loop on next iteration

    def unsubscribe(self, q):
        with self._lock:
            self._subscribers.discard(q)
            self._live_count = len(self._subscribers)
            no_subs = self._live_count == 0

        if no_subs:
            # Release camera in a background thread so we don't block the WS handler
            threading.Thread(target=self._close_camera, daemon=True).start()

    # ── Public API ─────────────────────────────────────────────────────────────

    def get_latest(self):
        with self._lock:
            return dict(self.latest)

    def capture(self, include_image=False):
        """Same code path as pressing C in eye_tracker.py.
        Uses _grab_one_frame() so camera opens transiently if needed."""
        frame = self._grab_one_frame()
        if frame is None:
            return {"error": "No frame available"}

        h, w = frame.shape[:2]
        cap_le  = copy.deepcopy(self.left_eye)
        cap_re  = copy.deepcopy(self.right_eye)
        cap_dom = cap_le if self.dominant_side == "left" else cap_re
        cap_nd  = cap_re if self.dominant_side == "left" else cap_le

        rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = self.landmarker.detect(mp_img)
        if not result.face_landmarks:
            return {"type": "capture", "face_detected": False, "timestamp": time.time()}

        lms = result.face_landmarks[0]
        cap_le.update(lms, w, h)
        cap_re.update(lms, w, h)
        head_yaw, head_pitch, head_roll = estimate_head_pose(lms, w, h)
        m = calc_misalignment(cap_dom, cap_nd, head_yaw)
        ipd = tilt = None
        if cap_le.iris_center and cap_re.iris_center:
            dx = cap_re.iris_center[0] - cap_le.iris_center[0]
            dy = cap_re.iris_center[1] - cap_le.iris_center[1]
            ipd  = round(math.sqrt(dx*dx + dy*dy), 2)
            tilt = round(math.degrees(math.atan2(dy, dx)), 2)
        payload = {
            "type": "capture", "face_detected": True, "timestamp": time.time(),
            "dominant_side": self.dominant_side, "frame_size": {"width": w, "height": h},
            "left_eye": cap_le.to_dict(), "right_eye": cap_re.to_dict(),
            "dominant_eye": cap_dom.to_dict(), "non_dominant_eye": cap_nd.to_dict(),
            "misalignment": m.to_dict(),
            "head_pose": {"yaw_deg": round(head_yaw, 2),
                          "pitch_deg": round(head_pitch, 2),
                          "roll_deg": round(head_roll, 2)},
            "interpupillary_distance_px": ipd, "head_tilt_deg": tilt,
        }
        if include_image:
            _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 88])
            payload["image_base64"] = base64.b64encode(buf).decode()
        return payload

    def analyze_image(self, image_bytes: bytes):
        """
        Analyse an image received from an external server (e.g. Node.js).
        image_bytes: raw JPEG/PNG bytes (already decoded from base64).
        No camera access required — works purely on the supplied bytes.
        """
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame  = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return {"error": "Could not decode image"}
        frame = cv2.flip(frame, 1)
        h, w  = frame.shape[:2]
        cap_le  = EyeGaze("Left",  LEFT_IRIS_POINTS,  LEFT_IRIS_CENTER,
                          LEFT_EYE_INNER,  LEFT_EYE_OUTER,  LEFT_EYE_TOP,  LEFT_EYE_BOTTOM,  C_IRIS_L)
        cap_re  = EyeGaze("Right", RIGHT_IRIS_POINTS, RIGHT_IRIS_CENTER,
                          RIGHT_EYE_INNER, RIGHT_EYE_OUTER, RIGHT_EYE_TOP, RIGHT_EYE_BOTTOM, C_IRIS_R)
        cap_dom = cap_le if self.dominant_side == "left" else cap_re
        cap_nd  = cap_re if self.dominant_side == "left" else cap_le
        rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = self.landmarker.detect(mp_img)
        if not result.face_landmarks:
            return {"type": "analyze_image", "face_detected": False, "timestamp": time.time()}
        lms = result.face_landmarks[0]
        cap_le.update(lms, w, h)
        cap_re.update(lms, w, h)
        head_yaw, head_pitch, head_roll = estimate_head_pose(lms, w, h)
        m = calc_misalignment(cap_dom, cap_nd, head_yaw)
        ipd = tilt = None
        if cap_le.iris_center and cap_re.iris_center:
            dx = cap_re.iris_center[0] - cap_le.iris_center[0]
            dy = cap_re.iris_center[1] - cap_le.iris_center[1]
            ipd  = round(math.sqrt(dx*dx + dy*dy), 2)
            tilt = round(math.degrees(math.atan2(dy, dx)), 2)
        return {
            "type": "analyze_image", "face_detected": True, "timestamp": time.time(),
            "dominant_side": self.dominant_side, "frame_size": {"width": w, "height": h},
            "left_eye": cap_le.to_dict(), "right_eye": cap_re.to_dict(),
            "dominant_eye": cap_dom.to_dict(), "non_dominant_eye": cap_nd.to_dict(),
            "misalignment": m.to_dict(),
            "head_pose": {"yaw_deg": round(head_yaw, 2),
                          "pitch_deg": round(head_pitch, 2),
                          "roll_deg": round(head_roll, 2)},
            "interpupillary_distance_px": ipd, "head_tilt_deg": tilt,
        }

    def get_cameras(self):
        return detect_cameras()

    def set_dominant(self, side):
        if side not in ("left", "right"):
            return {"error": "side must be left or right"}
        self._set_dom(side)
        self.pct_buf.clear()
        self.ratio_smoother.reset()
        return {"ok": True, "dominant_side": side}

    def set_camera(self, idx, width=640, height=480):
        # Release old camera first (if live), update config, reopen if live
        with self._cam_lock:
            if self.cam is not None:
                self.cam.release()
                self.cam = None
        self.cam_idx    = idx
        self.cam_width  = width
        self.cam_height = height
        # If live subscribers exist, reopen immediately; otherwise stays closed
        with self._lock:
            has_subs = bool(self._subscribers)
        if has_subs:
            self._open_camera()
        return {"ok": True, "camera": idx}

    def reset_smoothing(self):
        self.pct_buf.clear()
        self.ratio_smoother.reset()
        self.cursor_track.reset()
        return {"ok": True}

    def enable_cursor(self, speed=20.0):
        self.cursor_track.speed = speed
        self.cursor_on = True
        return {"ok": True, "cursor_active": True, "speed": speed}

    def disable_cursor(self):
        self.cursor_on = False
        self.cursor_track.reset()
        return {"ok": True, "cursor_active": False}

    def get_gaze_direction(self):
        with self._lock:
            d = dict(self.latest)
        if not d.get("face_detected"):
            return {"direction": "unknown", "face_detected": False}
        dom  = d.get("dominant_eye", {})
        hdeg = dom.get("h_angle_deg", 0)
        vdeg = dom.get("v_angle_deg", 0)
        if   abs(hdeg) < 5 and abs(vdeg) < 5: cardinal = "center"
        elif abs(hdeg) >= abs(vdeg):           cardinal = "right" if hdeg > 0 else "left"
        else:                                  cardinal = "down"  if vdeg > 0 else "up"
        return {
            "direction":    cardinal,
            "h_ratio":      dom.get("h_ratio"),
            "v_ratio":      dom.get("v_ratio"),
            "h_angle_deg":  round(hdeg, 2),
            "v_angle_deg":  round(vdeg, 2),
            "face_detected": True,
        }


# ─────────────────────────────────────────────────────────────────────────────
# WEBSOCKET
# ─────────────────────────────────────────────────────────────────────────────

_engine: EynoixEngine = None


def _dispatch(cmd: dict) -> dict:
    action = cmd.get("action", "")
    _id    = cmd.get("_id")
    if   action == "capture":
        r = _engine.capture(include_image=cmd.get("include_image", False))
    elif action == "analyze_image":
        try:   img = base64.b64decode(cmd.get("image_base64", ""))
        except: img = b""
        r = _engine.analyze_image(img)
    elif action == "get_latest":    r = _engine.get_latest()
    elif action == "get_cameras":   r = {"type": "cameras", "cameras": _engine.get_cameras()}
    elif action == "set_dominant":  r = _engine.set_dominant(cmd.get("side", "right"))
    elif action == "set_camera":
        r = _engine.set_camera(cmd.get("index", 0), cmd.get("width", 640), cmd.get("height", 480))
    elif action == "reset_smoothing": r = _engine.reset_smoothing()
    elif action == "enable_cursor": r = _engine.enable_cursor(cmd.get("speed", 20.0))
    elif action == "disable_cursor": r = _engine.disable_cursor()
    elif action == "gaze_direction": r = _engine.get_gaze_direction()
    elif action == "ping":          r = {"type": "pong", "timestamp": time.time()}
    else:                           r = {"error": f"Unknown action: {action}"}
    if _id is not None:
        r["_id"] = _id
    return r


async def _ws_handler(websocket):
    q = asyncio.Queue(maxsize=8)
    _engine.subscribe(q)
    print(f"  [WS] + {websocket.remote_address}  (camera will open if not already)")
    loop = asyncio.get_event_loop()

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
                cmd  = json.loads(raw)
                resp = await loop.run_in_executor(None, _dispatch, cmd)
                await websocket.send(json.dumps(resp))
            except Exception as e:
                await websocket.send(json.dumps({"error": str(e)}))

    try:
        await asyncio.gather(_send(), _recv())
    except Exception:
        pass
    finally:
        _engine.unsubscribe(q)
        print(f"  [WS] - {websocket.remote_address}  (camera released if no viewers remain)")


# ─────────────────────────────────────────────────────────────────────────────
# HTTP REST
# ─────────────────────────────────────────────────────────────────────────────

def _cors(h):
    h.send_header("Access-Control-Allow-Origin", "*")
    h.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
    h.send_header("Access-Control-Allow-Headers", "Content-Type,Authorization")

def _json(h, data, status=200):
    body = json.dumps(data, indent=2).encode()
    h.send_response(status)
    h.send_header("Content-Type", "application/json")
    h.send_header("Content-Length", str(len(body)))
    _cors(h); h.end_headers(); h.wfile.write(body)

class RESTHandler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def do_OPTIONS(self):
        self.send_response(204); _cors(self); self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        routes = {
            "/": lambda: {
                "service": "EYNOIX", "version": "1.0",
                "camera_policy": "lazy — opens on first WS subscriber, closes when last disconnects",
                "ws":  "ws://localhost:8765",
                "GET":  ["/latest", "/cameras", "/gaze", "/reset", "/health"],
                "POST": ["/capture", "/capture/image", "/dominant", "/camera",
                         "/cursor/enable", "/cursor/disable", "/analyze_image"],
            },
            "/health":  lambda: {"status": "ok", "timestamp": time.time(),
                                 "camera_open": _engine.cam is not None,
                                 "live_viewers": _engine._live_count},
            "/latest":  lambda: _engine.get_latest(),
            "/cameras": lambda: {"cameras": _engine.get_cameras()},
            "/gaze":    lambda: _engine.get_gaze_direction(),
            "/reset":   lambda: _engine.reset_smoothing(),
        }
        fn = routes.get(path)
        if fn: _json(self, fn())
        else:  _json(self, {"error": "Not found"}, 404)

    def do_POST(self):
        path   = self.path.split("?")[0]
        length = int(self.headers.get("Content-Length", 0))
        body   = json.loads(self.rfile.read(length)) if length else {}

        if path == "/capture":
            _json(self, _engine.capture(include_image=body.get("include_image", False)))
        elif path == "/capture/image":
            _json(self, _engine.capture(include_image=True))
        elif path == "/dominant":
            _json(self, _engine.set_dominant(body.get("side", "right")))
        elif path == "/camera":
            _json(self, _engine.set_camera(
                body.get("index", 0), body.get("width", 640), body.get("height", 480)))
        elif path == "/cursor/enable":
            _json(self, _engine.enable_cursor(body.get("speed", 20.0)))
        elif path == "/cursor/disable":
            _json(self, _engine.disable_cursor())
        elif path == "/analyze_image":
            if "dominant" in body:
                _engine.set_dominant(body["dominant"])
            raw = body.get("image_base64", "")
            try:
                img_bytes = base64.b64decode(raw)
            except Exception:
                _json(self, {"error": "Invalid base64"}, 400)
                return
            _json(self, _engine.analyze_image(img_bytes))
        else:
            _json(self, {"error": "Not found"}, 404)


def _run_http(port):
    srv = HTTPServer(("0.0.0.0", port), RESTHandler)
    srv.serve_forever()


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="EYNOIX WebSocket + HTTP Server")
    ap.add_argument("--ws-port",   type=int, default=8765)
    ap.add_argument("--http-port", type=int, default=8766)
    ap.add_argument("--camera",    type=int, default=0)
    ap.add_argument("--dominant",  default="right", choices=["left", "right"])
    ap.add_argument("--width",     type=int, default=640)
    ap.add_argument("--height",    type=int, default=480)
    args = ap.parse_args()

    global _engine
    print("=" * 56)
    print("  EYNOIX Server")
    print(f"  WebSocket  →  ws://localhost:{args.ws_port}")
    print(f"  HTTP REST  →  http://localhost:{args.http_port}")
    print(f"  Camera #{args.camera}  |  Dominant: {args.dominant.upper()}")
    print("  Camera opens ONLY when a live WS client connects.")
    print("  Ctrl+C to stop")
    print("=" * 56)

    _engine = EynoixEngine(
        cam_idx=args.camera, dominant_side=args.dominant,
        width=args.width, height=args.height)
    _engine.start()   # starts background thread; camera stays closed

    ht = threading.Thread(target=_run_http, args=(args.http_port,), daemon=True)
    ht.start()
    print(f"\n  HTTP  ready on :{args.http_port}")

    async def _ws():
        async with websockets.serve(_ws_handler, "0.0.0.0", args.ws_port):
            print(f"  WS    ready on :{args.ws_port}")
            print(f"  Camera is CLOSED — connect a WS client to open it.\n")
            await asyncio.Future()

    try:
        asyncio.run(_ws())
    except KeyboardInterrupt:
        print("\n  Shutting down …")
        _engine.stop()

if __name__ == "__main__":
    main()