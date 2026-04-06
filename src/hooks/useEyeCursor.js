/**
 * useEyeCursor – Single source of truth for EYONIX eye-tracking in games.
 *
 * When `active` is true:
 *   1. Opens a WebSocket to the EYONIX server (triggers the camera to open)
 *   2. Waits for the camera to warm up
 *   3. Receives real-time face/gaze frames
 *   4. Maps the dominant eye's h_ratio/v_ratio to viewport pixel coordinates
 *   5. Exposes smoothed gazePos (state) and gazePosRef (ref, for game loops)
 *
 * When `active` becomes false:
 *   - WebSocket is closed (camera releases automatically on server)
 *   - All state resets
 *
 * This hook does NOT call POST /cursor/enable — we don't want the server
 * moving the OS cursor.  All mapping is done client-side.
 */

import { useState, useEffect, useRef, useCallback } from "react";

const EYONIX_WS = "ws://localhost:8765";

export default function useEyeCursor(active = false) {
  const [gazePos, setGazePos] = useState({ x: 0, y: 0 });
  const [status, setStatus] = useState("idle"); // idle | connecting | active | error
  const wsRef = useRef(null);
  const gazePosRef = useRef({ x: 0, y: 0 });
  const frameCountRef = useRef(0);

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
        console.log("[useEyeCursor] Closing WebSocket (game ended)");
        wsRef.current.close();
        wsRef.current = null;
      }
      setStatus("idle");
      setGazePos({ x: 0, y: 0 });
      gazePosRef.current = { x: 0, y: 0 };
      smoothBuf.current = { x: [], y: [] };
      frameCountRef.current = 0;
      return;
    }

    // ── ACTIVATE: open WebSocket ──
    console.log("[useEyeCursor] Activating — connecting to EYONIX…");
    setStatus("connecting");

    let cancelled = false;
    const ws = new WebSocket(EYONIX_WS);
    wsRef.current = ws;

    ws.onopen = () => {
      if (cancelled) { ws.close(); return; }
      console.log("[useEyeCursor] ✓ WebSocket connected, camera opening…");
      // Wait a beat for camera to warm up, then mark active
      setTimeout(() => {
        if (!cancelled && ws.readyState === WebSocket.OPEN) {
          setStatus("active");
          console.log("[useEyeCursor] ✓ Active — receiving gaze data");
        }
      }, 600);
    };

    ws.onerror = (evt) => {
      if (cancelled) return;
      console.error("[useEyeCursor] ✗ WebSocket error — is eynoix_server.py running?", evt);
      setStatus("error");
    };

    ws.onclose = (evt) => {
      if (cancelled) return;
      console.log("[useEyeCursor] WebSocket closed (code:", evt.code, ")");
      setStatus("idle");
    };

    ws.onmessage = (evt) => {
      if (cancelled) return;
      try {
        const data = JSON.parse(evt.data);

        // Only process live camera frames where a face was detected
        if (data.type !== "frame" || !data.face_detected) return;

        const dom = data.dominant_eye;
        if (!dom || dom.h_ratio == null || dom.v_ratio == null) return;

        frameCountRef.current++;

        // h_ratio: 0 = left, 1 = right  (already mirrored by server's cv2.flip)
        // v_ratio: 0 = top,  1 = bottom
        const hRatio = dom.h_ratio;
        const vRatio = dom.v_ratio;

        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Expand the usable gaze range.
        // Typical iris ratio stays in ~0.30–0.70 horizontal, ~0.35–0.65 vertical.
        // Map that sub-range to the full viewport.
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

    // ── CLEANUP (when active becomes false or component unmounts) ──
    return () => {
      cancelled = true;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
      console.log("[useEyeCursor] Cleanup done");
    };
  }, [active, smoothPush]);

  return { gazePos, gazePosRef, status, frameCount: frameCountRef.current };
}
