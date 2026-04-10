"""
EYNOIX Server  —  HTTP REST API (analyze_image only)
=====================================================
Single endpoint: POST /analyze_image
Accepts a base64-encoded image and returns eye-tracking analysis data.
No camera, no WebSocket, no live streaming.

ENDPOINT
────────
HTTP REST  http://localhost:8766

  POST /analyze_image
    Request body (JSON):
      {
        "image_base64": "<base64-encoded JPEG/PNG>",
        "dominant":     "left" | "right"   (optional, default: "right")
      }
    Response (JSON):
      Full eye analysis including misalignment, gaze, head pose, etc.

RUN
───
  pip install mediapipe opencv-python numpy
  python eynoix_server.py
  python eynoix_server.py --dominant right --http-port 8766
"""

import argparse, base64, json, math, os, sys
import threading, time
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Optional, Tuple

import cv2, numpy as np, mediapipe as mp

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

NOSE_TIP=1; FOREHEAD=10; CHIN=152; LEFT_CHEEK=234; RIGHT_CHEEK=454

C_GREEN=(0,220,0); C_YELLOW=(0,220,255); C_RED=(0,0,255)
C_IRIS_L=(255,200,0); C_IRIS_R=(0,200,255)

NOISE_FLOOR=0.025; MILD_RATIO_THR=0.06; MOD_RATIO_THR=0.12; SEV_RATIO_THR=0.20
MILD_THR=15.0; MOD_THR=40.0; SEV_THR=70.0; MAX_DEV=0.30


# ─────────────────────────────────────────────────────────────────────────────
# ALL FUNCTIONS — VERBATIM from eye_tracker.py
# ─────────────────────────────────────────────────────────────────────────────

def _ensure_model():
    if not os.path.exists(MODEL_FILE):
        import urllib.request
        print(f"[EYNOIX] Downloading model -> {MODEL_FILE}")
        def _p(b, bs, tot):
            pct = min(b * bs / tot * 100, 100) if tot > 0 else 0
            sys.stdout.write(f"\r  [{'#'*int(pct/2)}{'-'*(50-int(pct/2))}] {pct:.1f}%")
            sys.stdout.flush()
        urllib.request.urlretrieve(MODEL_URL, MODEL_FILE, reporthook=_p)
        print("\n[EYNOIX] Model ready.")


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
    name: str; iris_points: list; iris_center_idx: int
    inner_idx: int; outer_idx: int; top_idx: int; bottom_idx: int; color: tuple
    iris_center: Optional[Tuple[int, int]] = None; iris_radius: int = 0
    h_ratio: float = 0.5; v_ratio: float = 0.5
    gaze_vector: np.ndarray = field(default_factory=lambda: np.zeros(2))
    eye_bbox: Optional[Tuple] = None; ear: float = 0.0
    pupil_diameter_rel: float = 0.0; h_angle_deg: float = 0.0; v_angle_deg: float = 0.0
    _raw_h: float = 0.5; _raw_v: float = 0.5

    def update(self, landmarks, w, h):
        """VERBATIM — fixed-reference vertical method from eye_tracker.py"""
        ic = landmarks[self.iris_center_idx]
        self.iris_center = (int(ic.x*w), int(ic.y*h))
        pts = np.array([[landmarks[i].x*w, landmarks[i].y*h]
                        for i in self.iris_points], dtype=np.float32)
        center = np.mean(pts, axis=0)
        self.iris_radius = max(1, int(np.mean(np.linalg.norm(pts - center, axis=1))))
        inner = landmarks[self.inner_idx]; outer = landmarks[self.outer_idx]
        top   = landmarks[self.top_idx];   bot   = landmarks[self.bottom_idx]
        ip = np.array([inner.x*w, inner.y*h]); op = np.array([outer.x*w, outer.y*h])
        tp = np.array([top.x*w,   top.y*h]);   bp = np.array([bot.x*w,   bot.y*h])
        eye_axis = ip - op; ew = np.linalg.norm(eye_axis) + 1e-6; eye_axis_unit = eye_axis / ew
        iris_vec = center - op
        h_proj   = np.dot(iris_vec, eye_axis_unit) / ew
        self._raw_h = float(np.clip(h_proj, 0.0, 1.0)); self.h_ratio = self._raw_h
        perp = np.array([-eye_axis_unit[1], eye_axis_unit[0]])
        if perp[1] < 0: perp = -perp
        eye_mid  = (ip + op) / 2.0
        v_offset = np.dot(center - eye_mid, perp)
        V_GAIN   = 2.5
        v_normalized = (v_offset / ew) * V_GAIN
        self._raw_v = float(np.clip(0.5 + v_normalized, 0.0, 1.0)); self.v_ratio = self._raw_v
        self.gaze_vector = np.array([self.h_ratio - 0.5, self.v_ratio - 0.5])
        self.ear = float(np.linalg.norm(tp - bp) / ew)
        ex = [int(outer.x*w), int(inner.x*w)]; ey = [int(top.y*h), int(bot.y*h)]; pad = 12
        self.eye_bbox = (min(ex)-pad, min(ey)-pad, max(ex)+pad, max(ey)+pad)
        self.pupil_diameter_rel = (self.iris_radius * 2) / ew
        self.h_angle_deg = math.degrees(math.atan2(self.gaze_vector[0], 1))
        self.v_angle_deg = math.degrees(math.atan2(self.gaze_vector[1], 1))

    def to_dict(self):
        return {
            "name":               self.name,
            "iris_center":        list(self.iris_center) if self.iris_center else None,
            "iris_radius_px":     self.iris_radius,
            "h_ratio":            round(self.h_ratio, 5),
            "v_ratio":            round(self.v_ratio, 5),
            "gaze_vector":        [round(float(x), 5) for x in self.gaze_vector],
            "h_angle_deg":        round(self.h_angle_deg, 3),
            "v_angle_deg":        round(self.v_angle_deg, 3),
            "ear":                round(self.ear, 5),
            "pupil_diameter_rel": round(self.pupil_diameter_rel, 5),
            "eye_bbox":           list(self.eye_bbox) if self.eye_bbox else None,
        }


@dataclass
class MisalignResult:
    """VERBATIM from eye_tracker.py"""
    percentage: float = 0.0; direction: str = "Aligned"
    color: tuple = field(default_factory=lambda: (0, 220, 0))
    h_diff_deg: float = 0.0; v_diff_deg: float = 0.0; total_deg: float = 0.0
    h_ratio_diff: float = 0.0; v_ratio_diff: float = 0.0
    strabismus: str = "None"; severity: str = "OK"

    def to_dict(self):
        return {
            "percentage":   round(self.percentage, 3),
            "direction":    self.direction,
            "h_diff_deg":   round(self.h_diff_deg, 3),
            "v_diff_deg":   round(self.v_diff_deg, 3),
            "total_deg":    round(self.total_deg, 3),
            "h_ratio_diff": round(self.h_ratio_diff, 5),
            "v_ratio_diff": round(self.v_ratio_diff, 5),
            "strabismus":   self.strabismus,
            "severity":     self.severity,
        }


def calc_misalignment(dominant: EyeGaze, non_dom: EyeGaze, head_yaw: float = 0.0) -> MisalignResult:
    """VERBATIM from eye_tracker.py — head-pose-compensated misalignment."""
    h_diff = non_dom.h_ratio - dominant.h_ratio
    v_diff = non_dom.v_ratio - dominant.v_ratio
    convergence_compensation = head_yaw * 0.002
    h_diff_compensated = h_diff - convergence_compensation
    abs_h = abs(h_diff_compensated); abs_v = abs(v_diff)
    if abs_h < NOISE_FLOOR: abs_h = 0.0; h_diff_compensated = 0.0
    if abs_v < NOISE_FLOOR: abs_v = 0.0; v_diff = 0.0
    total_diff = math.sqrt(abs_h**2 + abs_v**2)
    pct = min(100.0, (total_diff / MAX_DEV) * 100.0)
    h_deg = abs_h * 30.0; v_deg = abs_v * 30.0
    total_deg = math.sqrt(h_deg**2 + v_deg**2)
    parts = []
    if abs_h > NOISE_FLOOR:
        parts.append("inward drift (eso)" if h_diff_compensated > 0 else "outward drift (exo)")
    if abs_v > NOISE_FLOOR:
        parts.append("upward drift (hyper)" if v_diff < 0 else "downward drift (hypo)")
    direction = " + ".join(parts) if parts else "Aligned"
    if total_diff < NOISE_FLOOR: strab, sev = "None", "OK"
    elif abs_h > abs_v:
        strab = "Esotropia (inward turn)" if h_diff_compensated > 0 else "Exotropia (outward turn)"
        sev = "MILD" if total_diff < MILD_RATIO_THR else ("MODERATE" if total_diff < MOD_RATIO_THR else "SEVERE")
    else:
        strab = "Hypertropia (upward)" if v_diff < 0 else "Hypotropia (downward)"
        sev = "MILD" if total_diff < MILD_RATIO_THR else ("MODERATE" if total_diff < MOD_RATIO_THR else "SEVERE")
    color = C_GREEN if pct < MILD_THR else (C_YELLOW if pct < MOD_THR else C_RED)
    return MisalignResult(
        percentage=pct, direction=direction, color=color,
        h_diff_deg=h_deg, v_diff_deg=v_deg, total_deg=total_deg,
        h_ratio_diff=h_diff_compensated, v_ratio_diff=v_diff,
        strabismus=strab, severity=sev)


# ─────────────────────────────────────────────────────────────────────────────
# IMAGE PREPROCESSING — enhance detection in low-quality / poor lighting
# ─────────────────────────────────────────────────────────────────────────────

def _preprocess_variants(frame):
    """
    Generate multiple preprocessed versions of the input frame to
    maximize the chance of successful face landmark detection.
    Returns a list of (label, bgr_frame) tuples — the engine will
    try each one in order until landmarks are found.
    """
    variants = []

    # 0. Original (always first)
    variants.append(("original", frame.copy()))

    h, w = frame.shape[:2]

    # 1. CLAHE on LAB L-channel — equalizes lighting without colour distortion
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l_ch, a_ch, b_ch = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    l_eq = clahe.apply(l_ch)
    lab_eq = cv2.merge([l_eq, a_ch, b_ch])
    variants.append(("clahe", cv2.cvtColor(lab_eq, cv2.COLOR_LAB2BGR)))

    # 2. Brightness-boosted (+40) — helps dark / underexposed selfies
    bright = cv2.convertScaleAbs(frame, alpha=1.15, beta=40)
    variants.append(("bright", bright))

    # 3. Histogram-equalised greyscale converted back to BGR
    grey = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    eq = cv2.equalizeHist(grey)
    variants.append(("histeq", cv2.cvtColor(eq, cv2.COLOR_GRAY2BGR)))

    # 4. Gamma correction (brighten shadows, gamma < 1)
    gamma = 0.7
    inv_gamma = 1.0 / gamma
    table = np.array([(i / 255.0) ** inv_gamma * 255
                      for i in np.arange(256)]).astype("uint8")
    variants.append(("gamma", cv2.LUT(frame, table)))

    # 5. Sharpened — helps with blurry webcam captures
    kernel = np.array([[0, -1, 0],
                       [-1, 5, -1],
                       [0, -1, 0]], dtype=np.float32)
    sharpened = cv2.filter2D(frame, -1, kernel)
    variants.append(("sharp", sharpened))

    # 6. Upscaled (if image is small, e.g. < 480px wide)
    if w < 480:
        scale = 720 / w
        up = cv2.resize(frame, (int(w * scale), int(h * scale)),
                        interpolation=cv2.INTER_CUBIC)
        variants.append(("upscaled", up))

    return variants


def _validate_eyes_visible(lms, w, h):
    """
    Validate that both eyes are actually visible and meaningful
    in the detected face landmarks. Returns True only when both
    eyes have sufficient opening (EAR) and reasonable iris positions.
    """
    # Check that key eye landmarks are within the frame
    for idx in [LEFT_EYE_INNER, LEFT_EYE_OUTER, LEFT_EYE_TOP, LEFT_EYE_BOTTOM,
                RIGHT_EYE_INNER, RIGHT_EYE_OUTER, RIGHT_EYE_TOP, RIGHT_EYE_BOTTOM,
                LEFT_IRIS_CENTER, RIGHT_IRIS_CENTER]:
        lm = lms[idx]
        px, py = lm.x * w, lm.y * h
        # Landmark must be within the frame (with slim margin)
        if px < -10 or px > w + 10 or py < -10 or py > h + 10:
            return False

    # Verify that both eyes have some opening (not fully closed / occluded)
    def _ear(inner_idx, outer_idx, top_idx, bottom_idx):
        inner = np.array([lms[inner_idx].x * w, lms[inner_idx].y * h])
        outer = np.array([lms[outer_idx].x * w, lms[outer_idx].y * h])
        top   = np.array([lms[top_idx].x * w,   lms[top_idx].y * h])
        bot   = np.array([lms[bottom_idx].x * w, lms[bottom_idx].y * h])
        ew = np.linalg.norm(inner - outer) + 1e-6
        eh = np.linalg.norm(top - bot)
        return eh / ew

    left_ear  = _ear(LEFT_EYE_INNER, LEFT_EYE_OUTER, LEFT_EYE_TOP, LEFT_EYE_BOTTOM)
    right_ear = _ear(RIGHT_EYE_INNER, RIGHT_EYE_OUTER, RIGHT_EYE_TOP, RIGHT_EYE_BOTTOM)

    # Both eyes must have at least minimal opening (EAR > 0.12)
    MIN_EAR = 0.12
    if left_ear < MIN_EAR or right_ear < MIN_EAR:
        return False

    # Verify that eye width is at least 1.5% of frame width (not too tiny)
    left_ew = abs(lms[LEFT_EYE_INNER].x - lms[LEFT_EYE_OUTER].x) * w
    right_ew = abs(lms[RIGHT_EYE_INNER].x - lms[RIGHT_EYE_OUTER].x) * w
    MIN_EYE_WIDTH = w * 0.015
    if left_ew < MIN_EYE_WIDTH or right_ew < MIN_EYE_WIDTH:
        return False

    return True


# ─────────────────────────────────────────────────────────────────────────────
# ENGINE
# ─────────────────────────────────────────────────────────────────────────────

class EynoixEngine:
    def __init__(self, dominant_side="right"):
        _ensure_model()
        self.dominant_side = dominant_side
        self._lock = threading.Lock()

        # Create TWO landmarkers: one with normal confidence, one with low confidence
        BaseOpts = mp.tasks.BaseOptions
        FLM      = mp.tasks.vision.FaceLandmarker
        FLMOpts  = mp.tasks.vision.FaceLandmarkerOptions
        RunMode  = mp.tasks.vision.RunningMode

        # Primary — balanced thresholds
        opts_primary = FLMOpts(
            base_options=BaseOpts(model_asset_path=MODEL_FILE),
            running_mode=RunMode.IMAGE, num_faces=1,
            min_face_detection_confidence=0.3,
            min_face_presence_confidence=0.3,
            min_tracking_confidence=0.3,
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=False)
        self.landmarker_primary = FLM.create_from_options(opts_primary)

        # Fallback — very aggressive (low) thresholds for difficult images
        opts_fallback = FLMOpts(
            base_options=BaseOpts(model_asset_path=MODEL_FILE),
            running_mode=RunMode.IMAGE, num_faces=1,
            min_face_detection_confidence=0.15,
            min_face_presence_confidence=0.15,
            min_tracking_confidence=0.15,
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=False)
        self.landmarker_fallback = FLM.create_from_options(opts_fallback)

        self._set_dom(dominant_side)

    def _set_dom(self, side):
        self.dominant_side = side

    def _make_eyes(self):
        cap_le = EyeGaze("Left",  LEFT_IRIS_POINTS,  LEFT_IRIS_CENTER,
                         LEFT_EYE_INNER,  LEFT_EYE_OUTER,  LEFT_EYE_TOP,  LEFT_EYE_BOTTOM,  C_IRIS_L)
        cap_re = EyeGaze("Right", RIGHT_IRIS_POINTS, RIGHT_IRIS_CENTER,
                         RIGHT_EYE_INNER, RIGHT_EYE_OUTER, RIGHT_EYE_TOP, RIGHT_EYE_BOTTOM, C_IRIS_R)
        cap_dom = cap_le if self.dominant_side == "left" else cap_re
        cap_nd  = cap_re if self.dominant_side == "left" else cap_le
        return cap_le, cap_re, cap_dom, cap_nd

    def set_dominant(self, side):
        if side not in ("left", "right"):
            return {"error": "side must be left or right"}
        with self._lock:
            self._set_dom(side)
        return {"ok": True, "dominant_side": side}

    def _detect_with_landmarker(self, landmarker, rgb_frame):
        """Run detection with a given landmarker, returning result or None."""
        try:
            mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            result = landmarker.detect(mp_img)
            if result.face_landmarks and len(result.face_landmarks) > 0:
                return result
        except Exception as e:
            print(f"  [WARN] Detection error: {e}")
        return None

    def _try_detect(self, frame):
        """
        Multi-pass detection pipeline:
        1. Try primary landmarker on all preprocessed variants
        2. Try fallback landmarker on all preprocessed variants
        3. Try both with the un-flipped original image
        Returns (result, frame_used_h, frame_used_w, was_flipped) or None
        """
        variants = _preprocess_variants(frame)

        # Pass 1: Primary landmarker on all variants
        for label, var_frame in variants:
            h_v, w_v = var_frame.shape[:2]
            rgb = cv2.cvtColor(var_frame, cv2.COLOR_BGR2RGB)
            result = self._detect_with_landmarker(self.landmarker_primary, rgb)
            if result:
                lms = result.face_landmarks[0]
                if _validate_eyes_visible(lms, w_v, h_v):
                    print(f"  [OK] Face detected via PRIMARY on '{label}' variant ({w_v}x{h_v})")
                    return result, h_v, w_v, True

        # Pass 2: Fallback (low-confidence) landmarker on all variants
        for label, var_frame in variants:
            h_v, w_v = var_frame.shape[:2]
            rgb = cv2.cvtColor(var_frame, cv2.COLOR_BGR2RGB)
            result = self._detect_with_landmarker(self.landmarker_fallback, rgb)
            if result:
                lms = result.face_landmarks[0]
                if _validate_eyes_visible(lms, w_v, h_v):
                    print(f"  [OK] Face detected via FALLBACK on '{label}' variant ({w_v}x{h_v})")
                    return result, h_v, w_v, True

        # Pass 3: Try un-flipped original (in case the flip caused issues)
        unflipped = cv2.flip(frame, 1)  # undo the flip
        unflip_variants = _preprocess_variants(unflipped)
        for label, var_frame in unflip_variants:
            h_v, w_v = var_frame.shape[:2]
            rgb = cv2.cvtColor(var_frame, cv2.COLOR_BGR2RGB)
            result = self._detect_with_landmarker(self.landmarker_primary, rgb)
            if result:
                lms = result.face_landmarks[0]
                if _validate_eyes_visible(lms, w_v, h_v):
                    print(f"  [OK] Face detected via PRIMARY UNFLIPPED on '{label}' ({w_v}x{h_v})")
                    return result, h_v, w_v, False

        # Pass 4: Fallback on un-flipped variants
        for label, var_frame in unflip_variants:
            h_v, w_v = var_frame.shape[:2]
            rgb = cv2.cvtColor(var_frame, cv2.COLOR_BGR2RGB)
            result = self._detect_with_landmarker(self.landmarker_fallback, rgb)
            if result:
                lms = result.face_landmarks[0]
                if _validate_eyes_visible(lms, w_v, h_v):
                    print(f"  [OK] Face detected via FALLBACK UNFLIPPED on '{label}' ({w_v}x{h_v})")
                    return result, h_v, w_v, False

        # Detection without eye validation (last resort — still return face_detected)
        for label, var_frame in variants:
            h_v, w_v = var_frame.shape[:2]
            rgb = cv2.cvtColor(var_frame, cv2.COLOR_BGR2RGB)
            result = self._detect_with_landmarker(self.landmarker_fallback, rgb)
            if result:
                print(f"  [WARN] Face found on '{label}' but eyes may not be fully visible")
                return result, h_v, w_v, True

        return None

    def analyze_image(self, image_bytes: bytes):
        """
        Analyse an image received from an external server.
        image_bytes: raw JPEG/PNG bytes (already decoded from base64).

        Uses multi-pass detection with image preprocessing to maximize
        accuracy. Takes longer but delivers much more reliable results.
        """
        t0 = time.time()
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame  = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return {"error": "Could not decode image"}
        frame = cv2.flip(frame, 1)

        with self._lock:
            cap_le, cap_re, cap_dom, cap_nd = self._make_eyes()
            dominant_side = self.dominant_side

        # Multi-pass detection
        detection = self._try_detect(frame)

        if detection is None:
            elapsed = time.time() - t0
            print(f"  [FAIL] No face detected after {elapsed:.2f}s multi-pass")
            return {"type": "analyze_image", "face_detected": False, "timestamp": time.time()}

        result, h, w, was_flipped = detection
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

        elapsed = time.time() - t0
        print(f"  [DONE] Analysis complete in {elapsed:.2f}s — alignment={m.percentage:.1f}%")

        return {
            "type":         "analyze_image",
            "face_detected": True,
            "timestamp":    time.time(),
            "dominant_side": dominant_side,
            "frame_size":   {"width": w, "height": h},
            "left_eye":     cap_le.to_dict(),
            "right_eye":    cap_re.to_dict(),
            "dominant_eye": cap_dom.to_dict(),
            "non_dominant_eye": cap_nd.to_dict(),
            "misalignment": m.to_dict(),
            "head_pose": {
                "yaw_deg":   round(head_yaw, 2),
                "pitch_deg": round(head_pitch, 2),
                "roll_deg":  round(head_roll, 2),
            },
            "interpupillary_distance_px": ipd,
            "head_tilt_deg": tilt,
            "analysis_time_s": round(elapsed, 3),
        }

    def stop(self):
        self.landmarker_primary.close()
        self.landmarker_fallback.close()


# ─────────────────────────────────────────────────────────────────────────────
# HTTP REST
# ─────────────────────────────────────────────────────────────────────────────

_engine: EynoixEngine = None


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
        if path == "/":
            _json(self, {
                "service": "EYNOIX",
                "version": "2.0",
                "POST": ["/analyze_image"],
            })
        elif path == "/health":
            _json(self, {"status": "ok", "timestamp": time.time()})
        else:
            _json(self, {"error": "Not found"}, 404)

    def do_POST(self):
        path   = self.path.split("?")[0]
        length = int(self.headers.get("Content-Length", 0))
        body   = json.loads(self.rfile.read(length)) if length else {}

        if path == "/analyze_image":
            if "dominant" in body:
                print(f"  [DOM] Setting dominant eye to: {body['dominant']}")
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
    ap = argparse.ArgumentParser(description="EYNOIX analyze_image HTTP Server")
    ap.add_argument("--http-port", type=int, default=8766)
    ap.add_argument("--dominant",  default="right", choices=["left", "right"])
    args = ap.parse_args()

    global _engine
    print("=" * 56)
    print("  EYNOIX Server v2.0 (Multi-Pass Accuracy)")
    print(f"  HTTP REST  ->  http://localhost:{args.http_port}")
    print(f"  Dominant: {args.dominant.upper()}")
    print("  POST /analyze_image  { image_base64, dominant? }")
    print("  Features: CLAHE, gamma, sharpening, multi-scale")
    print("  Ctrl+C to stop")
    print("=" * 56)

    _engine = EynoixEngine(dominant_side=args.dominant)

    print(f"\n  HTTP  ready on :{args.http_port}\n")
    try:
        _run_http(args.http_port)
    except KeyboardInterrupt:
        print("\n  Shutting down …")
        _engine.stop()


if __name__ == "__main__":
    main()