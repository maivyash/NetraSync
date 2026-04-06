/**
 * useEyeCursor – Single source of truth for EYONIX eye-tracking in games.
 *
 * When `active` is true:
 *   1. Opens a WebSocket to the EYONIX server (triggers the camera to open)
 *   2. Receives real-time face/gaze frames
 *   3. Maps the dominant eye's h_ratio/v_ratio to viewport pixel coordinates
 *   4. Exposes smoothed gazePos (state) and gazePosRef (ref, for game loops)
 *
 * Handles React Strict Mode gracefully (debounced connection).
 */

import { useState, useEffect, useRef, useCallback } from "react";

const EYONIX_WS = "ws://localhost:8765";

export default function useEyeCursor(active = false) {




  const [gazePos, setGazePos] = useState({ x: 0, y: 0 });
  const [status, setStatus] = useState("idle"); // idle | connecting | active | error
  const wsRef = useRef(null);
  const gazePosRef = useRef({ x: 0, y: 0 });

  // Smoothing – moving average over N frames
  const SMOOTH_WINDOW = 6;
  const smoothBuf = useRef({ x: [], y: [] });

  const smoothPush = useCallback((rawX, rawY) => {
    const buf = smoothBuf.current;
    buf.x.push(rawX);
    buf.y.push(rawY);
    if (buf.x.length > SMOOTH_WINDOW) buf.x.shift();
    if (buf.y.length > SMOOTH_WINDOW) buf.y.shift();
    const sx = buf.x.reduce((a, b) => a + b, 0) / buf.x.length;
    const sy = buf.y.reduce((a, b) => a + b, 0) / buf.y.length;
    return { x: sx, y: sy };
  }, []);

  useEffect(() => {
    // ── DEACTIVATE: cleanup ──
    if (!active) {
      if (wsRef.current) {
        console.log("[useEyeCursor] Closing WebSocket (deactivated)");
        wsRef.current.close();
        wsRef.current = null;
      }
      setStatus("idle");
      setGazePos({ x: 0, y: 0 });
      gazePosRef.current = { x: 0, y: 0 };
      smoothBuf.current = { x: [], y: [] };
      return;
    }

    // ── ACTIVATE: debounce connection to survive React Strict Mode ──
    // In dev, React 18 fires effects twice (mount → unmount → mount).
    // A small delay ensures only the final mount actually connects.
    let cancelled = false;
    let ws = null;

    console.log("[useEyeCursor] Scheduling WebSocket connection…");
    setStatus("connecting");

    const connectTimer = setTimeout(() => {
      if (cancelled) return;

      console.log("[useEyeCursor] Opening WebSocket to", EYONIX_WS);
      ws = new WebSocket(EYONIX_WS);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) { ws.close(); return; }
        console.log("[useEyeCursor] ✓ WebSocket connected — camera is now active");
        setStatus("active");
      };

      ws.onerror = () => {
        if (cancelled) return;
        console.error("[useEyeCursor] ✗ WebSocket error — is eynoix_server.py running?");
        setStatus("error");
      };

      ws.onclose = () => {
        if (cancelled) return;
        console.log("[useEyeCursor] WebSocket closed");
        setStatus("idle");
      };

      ws.onmessage = (evt) => {
        if (cancelled) return;
        try {
          console.log(evt.data);

          const data = JSON.parse(evt.data);

          // Only process live camera frames where a face was detected
          if (data.type !== "frame" || !data.face_detected) return;

          const dom = data.dominant_eye;
          if (!dom || dom.h_ratio == null || dom.v_ratio == null) return;

          const hRatio = dom.h_ratio;
          const vRatio = dom.v_ratio;

          const vw = window.innerWidth;
          const vh = window.innerHeight;

          // Expand the usable gaze range.
          const H_MIN = 0.28, H_MAX = 0.72;
          const V_MIN = 0.32, V_MAX = 0.68;

          const normalizedH = Math.max(0, Math.min(1, (hRatio - H_MIN) / (H_MAX - H_MIN)));
          const normalizedV = Math.max(0, Math.min(1, (vRatio - V_MIN) / (V_MAX - V_MIN)));

          const rawX = normalizedH * vw;
          const rawY = normalizedV * vh;

          const smoothed = smoothPush(rawX, rawY);

          gazePosRef.current = smoothed;
          setGazePos({ x: smoothed.x, y: smoothed.y });
        } catch {
          // Malformed frame — skip silently
        }
      };
    }, 150); // 150ms debounce — Strict Mode cleanup fires within ~50ms

    // ── CLEANUP ──
    return () => {
      cancelled = true;
      clearTimeout(connectTimer);
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [active, smoothPush]);

  return { gazePos, gazePosRef, status };
}
