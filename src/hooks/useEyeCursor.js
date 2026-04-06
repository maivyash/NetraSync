/**
 * useEyeCursor – Receives real-time gaze data from the EYONIX WebSocket
 * and converts it to screen coordinates inside a container element.
 *
 * When active, the physical mouse is hidden and all pointer input comes
 * from the pupil tracker.  The hook returns a `gazePos` object
 * ({ x, y } in pixels relative to the viewport) and a ref callback
 * for the container element.
 *
 * Usage:
 *   const { gazePos, containerRef, status } = useEyeCursor(isActive);
 *   <div ref={containerRef} style={{ cursor: 'none' }}>
 *     <CustomCursor x={gazePos.x} y={gazePos.y} />
 *   </div>
 */

import { useState, useEffect, useRef, useCallback } from "react";

const EYONIX_WS = "ws://localhost:8765";

export default function useEyeCursor(active = false) {
  const [gazePos, setGazePos] = useState({ x: 0, y: 0 });
  const [status, setStatus] = useState("idle"); // idle | connecting | active | error
  const wsRef = useRef(null);
  const containerRef = useRef(null);
  const gazePosRef = useRef({ x: 0, y: 0 });

  // Smoothing buffer for gaze position
  const smoothBuf = useRef({ x: [], y: [], maxLen: 5 });

  const smoothPush = useCallback((x, y) => {
    const buf = smoothBuf.current;
    buf.x.push(x);
    buf.y.push(y);
    if (buf.x.length > buf.maxLen) buf.x.shift();
    if (buf.y.length > buf.maxLen) buf.y.shift();
    const sx = buf.x.reduce((a, b) => a + b, 0) / buf.x.length;
    const sy = buf.y.reduce((a, b) => a + b, 0) / buf.y.length;
    return { x: sx, y: sy };
  }, []);

  useEffect(() => {
    if (!active) {
      // Cleanup if deactivated
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setStatus("idle");
      smoothBuf.current = { x: [], y: [], maxLen: 5 };
      return;
    }

    setStatus("connecting");

    const ws = new WebSocket(EYONIX_WS);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[useEyeCursor] WebSocket connected");
      setStatus("active");
    };

    ws.onerror = () => {
      console.error("[useEyeCursor] WebSocket error");
      setStatus("error");
    };

    ws.onclose = () => {
      console.log("[useEyeCursor] WebSocket closed");
      if (wsRef.current === ws) setStatus("idle");
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type !== "frame" || !data.face_detected) return;

        const dom = data.dominant_eye;
        if (!dom) return;

        // h_ratio: 0 (left) → 1 (right)  — from the camera POV (mirrored)
        // v_ratio: 0 (top) → 1 (bottom)
        const hRatio = dom.h_ratio;
        const vRatio = dom.v_ratio;

        // Map gaze ratios to the full screen viewport
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Expand the usable gaze range (center-weighted mapping)
        // Most gaze stays within 0.3–0.7, so we expand that to cover the full screen
        const H_MIN = 0.30, H_MAX = 0.70;
        const V_MIN = 0.35, V_MAX = 0.65;

        const normalizedH = Math.max(0, Math.min(1, (hRatio - H_MIN) / (H_MAX - H_MIN)));
        const normalizedV = Math.max(0, Math.min(1, (vRatio - V_MIN) / (V_MAX - V_MIN)));

        const rawX = normalizedH * vw;
        const rawY = normalizedV * vh;

        const smoothed = smoothPush(rawX, rawY);

        gazePosRef.current = smoothed;
        setGazePos({ x: smoothed.x, y: smoothed.y });
      } catch {
        // ignore parse errors
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [active, smoothPush]);

  return { gazePos, gazePosRef, containerRef, status };
}
