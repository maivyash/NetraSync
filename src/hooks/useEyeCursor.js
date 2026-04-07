/**
 * useEyeCursor – Controls face-based OS cursor via face_cursor.py server.
 *
 * Architecture:
 *   • face_cursor.py (port 8767) — moves the OS cursor using face tracking.
 *     The frontend sends "start"/"stop" commands. The cursor is controlled at
 *     the OS level, so normal mouse events fire in the game canvas naturally.
 *
 *   • eynoix_server.py (port 8765) — alignment / misalignment analysis.
 *     That connection is managed separately (not by this hook).
 *
 * When `active` is true:
 *   1. Connects to face_cursor.py WebSocket (port 8767)
 *   2. Sends { action: "start" } to begin face tracking + cursor control
 *   3. Monitors status updates (calibrating → tracking → paused)
 *   4. On deactivate, sends { action: "stop" } and disconnects
 *
 * Since face_cursor.py controls the OS cursor directly via pyautogui,
 * the games receive normal mousemove events — NO gazePosRef needed.
 */

import { useState, useEffect, useRef } from "react";

const FACE_CURSOR_WS = "ws://localhost:8767";

export default function useEyeCursor(active = false) {
  // Status: idle | connecting | calibrating | active | paused | error
  const [status, setStatus] = useState("idle");
  const wsRef = useRef(null);

  useEffect(() => {
    // ── DEACTIVATE: cleanup ──
    if (!active) {
      if (wsRef.current) {
        // Send stop command before closing
        try {
          if (wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ action: "stop" }));
          }
        } catch {
          // ignore
        }
        console.log("[useEyeCursor] Closing face_cursor WebSocket (deactivated)");
        wsRef.current.close();
        wsRef.current = null;
      }
      setStatus("idle");
      return;
    }

    // ── ACTIVATE: debounce connection for React Strict Mode ──
    let cancelled = false;
    let ws = null;

    console.log("[useEyeCursor] Scheduling face_cursor connection…");
    setStatus("connecting");

    const connectTimer = setTimeout(() => {
      if (cancelled) return;

      console.log("[useEyeCursor] Opening WebSocket to", FACE_CURSOR_WS);
      ws = new WebSocket(FACE_CURSOR_WS);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) { ws.close(); return; }
        console.log("[useEyeCursor] ✓ Connected to face_cursor server");
        // Send start command to begin face tracking
        ws.send(JSON.stringify({ action: "start" }));
        setStatus("connecting"); // will upgrade when we get status update
      };

      ws.onerror = () => {
        if (cancelled) return;
        console.error("[useEyeCursor] ✗ WebSocket error — is face_cursor.py running?");
        setStatus("error");
      };

      ws.onclose = () => {
        if (cancelled) return;
        console.log("[useEyeCursor] face_cursor WebSocket closed");
        setStatus("idle");
      };

      ws.onmessage = (evt) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(evt.data);

          // Handle status updates from face_cursor server
          if (data.type === "status") {
            switch (data.status) {
              case "calibrating":
                setStatus("connecting"); // show "connecting" during calibration
                break;
              case "tracking":
                setStatus("active");
                break;
              case "paused":
                setStatus("paused");
                break;
              case "stopped":
                setStatus("idle");
                break;
              default:
                break;
            }
          }
        } catch {
          // Malformed message — skip
        }
      };
    }, 150); // 150ms debounce for Strict Mode

    // ── CLEANUP ──
    return () => {
      cancelled = true;
      clearTimeout(connectTimer);
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: "stop" }));
          }
        } catch {
          // ignore
        }
        ws.close();
      }
      wsRef.current = null;
    };
  }, [active]);

  return { status };
}
