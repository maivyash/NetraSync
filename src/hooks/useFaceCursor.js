/**
 * useFaceCursor — Pure JS port of face_cursor.py using @mediapipe/tasks-vision (WASM).
 *
 * Runs entirely in the browser — no Python server, no WebSocket.
 * Works on Desktop (Chrome/Edge) and Mobile (front camera via facingMode: "user").
 *
 * Algorithms ported 1:1 from face_cursor.py:
 *   • One Euro Filter      — adaptive low-pass (kills jitter, preserves speed)
 *   • EAR blink gate       — Eye Aspect Ratio, same landmark indices & threshold
 *   • Head pose blend      — yaw/pitch offset blended at 30% weight
 *   • Auto-calibration     — 45-frame median of resting head center
 *   • Dead-zone            — 1.2% viewport, suppresses sub-pixel tremor
 *
 * Usage:
 *   const { status, gazePosRef, videoRef } = useFaceCursor(active);
 *
 *   status      — "idle"|"connecting"|"calibrating"|"active"|"paused"|"error"
 *   gazePosRef  — React ref with { x, y } in viewport pixels (no re-renders)
 *   videoRef    — <video> element ref (attach to a hidden <video> in JSX)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// ─────────────────────────────────────────────────────────────────────────────
// Landmark indices (identical to face_cursor.py)
// ─────────────────────────────────────────────────────────────────────────────
const NOSE_TIP    = 1;
const FOREHEAD    = 10;
const CHIN        = 152;
const LEFT_CHEEK  = 234;
const RIGHT_CHEEK = 454;

const R_EYE_TOP = 159; const R_EYE_BOT = 145;
const R_EYE_IN  = 133; const R_EYE_OUT = 33;
const L_EYE_TOP = 386; const L_EYE_BOT = 374;
const L_EYE_IN  = 362; const L_EYE_OUT = 263;

// ─────────────────────────────────────────────────────────────────────────────
// Tuning constants (match face_cursor.py exactly)
// ─────────────────────────────────────────────────────────────────────────────
const EAR_THRESHOLD    = 0.18;
const BLINK_GRACE      = 3;
const DEAD_ZONE        = 0.012;
const HEAD_POSE_WEIGHT = 0.30;
const CALIB_FRAMES     = 45;
const RANGE_H          = 0.18;
const RANGE_V          = 0.14;

// One Euro Filter defaults
const OEF_MIN_CUTOFF = 1.0;
const OEF_BETA       = 0.08;
const OEF_D_CUTOFF   = 1.0;

// ─────────────────────────────────────────────────────────────────────────────
// One Euro Filter (1:1 JS port from face_cursor.py)
// ─────────────────────────────────────────────────────────────────────────────
class OneEuroFilter {
  constructor(minCutoff = OEF_MIN_CUTOFF, beta = OEF_BETA, dCutoff = OEF_D_CUTOFF) {
    this.minCutoff = minCutoff;
    this.beta      = beta;
    this.dCutoff   = dCutoff;
    this._x        = null;
    this._dx       = 0;
    this._t        = null;
  }

  _alpha(cutoff, dt) {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }

  filter(x, t) {
    if (this._t === null) {
      this._x = x; this._dx = 0; this._t = t;
      return x;
    }
    const dt = Math.max(t - this._t, 1e-6);
    this._t = t;

    const dxRaw   = (x - this._x) / dt;
    const aD      = this._alpha(this.dCutoff, dt);
    this._dx      = aD * dxRaw + (1 - aD) * this._dx;

    const cutoff  = this.minCutoff + this.beta * Math.abs(this._dx);
    const a       = this._alpha(cutoff, dt);
    this._x       = a * x + (1 - a) * this._x;
    return this._x;
  }

  reset() { this._x = null; this._dx = 0; this._t = null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// EAR — Eye Aspect Ratio (same as Python _ear())
// ─────────────────────────────────────────────────────────────────────────────
function ear(lms, top, bot, inn, out) {
  // MediaPipe JS landmarks are normalized 0-1, no need to scale
  const p = (i) => ({ x: lms[i].x, y: lms[i].y });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const vert  = dist(p(top), p(bot));
  const horiz = dist(p(inn), p(out)) + 1e-6;
  return vert / horiz;
}

// ─────────────────────────────────────────────────────────────────────────────
// Head pose (same as Python _head_pose(), normalized coords)
// ─────────────────────────────────────────────────────────────────────────────
function headPose(lms) {
  const p     = (i) => ({ x: lms[i].x, y: lms[i].y });
  const dist  = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const nose  = p(NOSE_TIP);
  const fore  = p(FOREHEAD);
  const chin  = p(CHIN);
  const lc    = p(LEFT_CHEEK);
  const rc    = p(RIGHT_CHEEK);

  const faceW      = dist(lc, rc) + 1e-6;
  const yawDeg     = ((nose.x - (lc.x + rc.x) / 2) / faceW) * 90.0;

  const foreNose   = dist(fore, nose);
  const chinNose   = dist(chin, nose);
  const pitchRatio = (foreNose - chinNose) / (foreNose + chinNose + 1e-6);
  const pitchDeg   = pitchRatio * 60.0;

  const yawN   = Math.min(1, Math.max(-1, yawDeg   / 35.0)) * 0.5 + 0.5;
  const pitchN = Math.min(1, Math.max(-1, pitchDeg / 25.0)) * 0.5 + 0.5;
  return { yawN, pitchN };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export default function useFaceCursor(active = false) {
  const [status, setStatus]     = useState("idle"); // idle|connecting|calibrating|active|paused|error
  const gazePosRef              = useRef({ x: -200, y: -200 }); // off-screen when idle
  const videoRef                = useRef(null);

  // Internal state kept in refs to avoid re-renders inside the rAF loop
  const landmarkerRef           = useRef(null);
  const streamRef               = useRef(null);
  const rafIdRef                = useRef(null);
  const activeRef               = useRef(false);

  const oefH                    = useRef(new OneEuroFilter());
  const oefV                    = useRef(new OneEuroFilter());

  const calibH                  = useRef([]);
  const calibV                  = useRef([]);
  const centerH                 = useRef(0.5);
  const centerV                 = useRef(0.5);
  const calibrated              = useRef(false);

  const lastSX                  = useRef(-1);
  const lastSY                  = useRef(-1);
  const blinkStreak             = useRef(0);

  // ── Reset all algorithm state ──────────────────────────────────────────────
  const reset = useCallback(() => {
    oefH.current.reset();
    oefV.current.reset();
    calibH.current = [];
    calibV.current = [];
    centerH.current = 0.5;
    centerV.current = 0.5;
    calibrated.current = false;
    lastSX.current = -1;
    lastSY.current = -1;
    blinkStreak.current = 0;
    gazePosRef.current = { x: -200, y: -200 };
  }, []);

  // ── Cleanup camera + landmarker ────────────────────────────────────────────
  const cleanup = useCallback(() => {
    activeRef.current = false;
    if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) { videoRef.current.srcObject = null; }
    // Note: DO NOT close landmarker — it's reused
    reset();
  }, [reset]);

  // ── Core frame processing loop ─────────────────────────────────────────────
  const processFrame = useCallback(() => {
    if (!activeRef.current) return;

    const video = videoRef.current;
    const lm    = landmarkerRef.current;

    if (!video || !lm || video.readyState < 2) {
      rafIdRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Run inference synchronously on the current video frame
    let result;
    try {
      result = lm.detectForVideo(video, performance.now());
    } catch {
      rafIdRef.current = requestAnimationFrame(processFrame);
      return;
    }

    if (!result?.faceLandmarks?.length) {
      if (calibrated.current) setStatus("paused");
      rafIdRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const lms = result.faceLandmarks[0];

    // ── EAR blink gate ──────────────────────────────────────────────────────
    const leftEAR  = ear(lms, L_EYE_TOP, L_EYE_BOT, L_EYE_IN, L_EYE_OUT);
    const rightEAR = ear(lms, R_EYE_TOP, R_EYE_BOT, R_EYE_IN, R_EYE_OUT);
    const eyesOpen = (leftEAR + rightEAR) / 2 > EAR_THRESHOLD;

    if (!eyesOpen) {
      blinkStreak.current++;
      if (blinkStreak.current > BLINK_GRACE) {
        rafIdRef.current = requestAnimationFrame(processFrame);
        return; // frozen during blink
      }
    } else {
      blinkStreak.current = 0;
    }

    // ── Raw signal: nose + head pose blend ──────────────────────────────────
    // Mirror correction: Python did cv2.flip(frame, 1) before inference which
    // inverted x so left/right were natural. JS receives raw unflipped camera
    // frames — front/selfie camera is naturally mirrored, so we invert x here.
    const nose   = lms[NOSE_TIP];
    const rawH   = 1 - nose.x;            // ← mirror-correct horizontal axis
    const rawV   = nose.y;
    const { yawN: yawNRaw, pitchN } = headPose(lms);
    const yawN   = 1 - yawNRaw;           // ← mirror-correct head yaw as well
    const pw     = HEAD_POSE_WEIGHT;
    const sigH   = rawH * (1 - pw) + yawN   * pw;
    const sigV   = rawV * (1 - pw) + pitchN * pw;

    // ── Auto-calibration ────────────────────────────────────────────────────
    if (!calibrated.current) {
      calibH.current.push(sigH);
      calibV.current.push(sigV);
      if (calibH.current.length >= CALIB_FRAMES) {
        const sorted = (arr) => [...arr].sort((a, b) => a - b);
        centerH.current = sorted(calibH.current)[Math.floor(CALIB_FRAMES / 2)];
        centerV.current = sorted(calibV.current)[Math.floor(CALIB_FRAMES / 2)];
        calibrated.current = true;
        setStatus("active");
        console.log(`[FaceCursor] Calibrated: H=${centerH.current.toFixed(3)} V=${centerV.current.toFixed(3)}`);
      }
      rafIdRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // ── Map offset → 0-1 normalized screen ─────────────────────────────────
    const normH = Math.min(1, Math.max(0, 0.5 + (sigH - centerH.current) / (2 * RANGE_H)));
    const normV = Math.min(1, Math.max(0, 0.5 + (sigV - centerV.current) / (2 * RANGE_V)));

    // ── One Euro Filter ─────────────────────────────────────────────────────
    const t     = performance.now() / 1000;
    const filtH = oefH.current.filter(normH, t);
    const filtV = oefV.current.filter(normV, t);

    // ── Convert to viewport pixels ──────────────────────────────────────────
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scrX = filtH * vw;
    const scrY = filtV * vh;

    // ── Dead-zone ───────────────────────────────────────────────────────────
    if (lastSX.current >= 0) {
      if (Math.abs(scrX - lastSX.current) < DEAD_ZONE * vw &&
          Math.abs(scrY - lastSY.current) < DEAD_ZONE * vh) {
        rafIdRef.current = requestAnimationFrame(processFrame);
        return;
      }
    }

    lastSX.current = scrX;
    lastSY.current = scrY;

    // ── Update gaze position (clamped to safe margin) ────────────────────────
    gazePosRef.current = {
      x: Math.min(Math.max(scrX, 10), vw - 10),
      y: Math.min(Math.max(scrY, 10), vh - 10),
    };

    if (status !== "active") setStatus("active");

    rafIdRef.current = requestAnimationFrame(processFrame);
  }, [status]);

  // ── Start tracking ─────────────────────────────────────────────────────────
  const startTracking = useCallback(async () => {
    try {
      setStatus("connecting");

      // Initialize MediaPipe FaceLandmarker (lazy — only once)
      if (!landmarkerRef.current) {
        console.log("[FaceCursor] Loading MediaPipe WASM…");
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        landmarkerRef.current = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.6,
          minFacePresenceConfidence: 0.6,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });
        console.log("[FaceCursor] MediaPipe ready.");
      }

      // Open camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",   // front camera on mobile
          width:  { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      activeRef.current = true;
      reset();
      setStatus("calibrating");
      rafIdRef.current = requestAnimationFrame(processFrame);
      console.log("[FaceCursor] Tracking started — calibrating…");
    } catch (err) {
      console.error("[FaceCursor] Start failed:", err);
      setStatus("error");
      cleanup();
    }
  }, [processFrame, reset, cleanup]);

  // ── Effect: activate / deactivate ──────────────────────────────────────────
  useEffect(() => {
    if (active) {
      startTracking();
    } else {
      cleanup();
      setStatus("idle");
    }
    return () => {
      // Cleanup on unmount or when active flips to false
      cleanup();
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return { status, gazePosRef, videoRef };
}
