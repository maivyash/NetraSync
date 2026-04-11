/**
 * EyeCursorOverlay — Animated crosshair that follows gaze position.
 *
 * Reads from FaceCursorContext — no props needed.
 * Completely independent of touch / mouse events (pointer-events: none).
 * Only visible when the face cursor is active.
 *
 * The One Euro Filter in useFaceCursor already smooths the movement, so
 * CSS transitions are intentionally removed to avoid double-smoothing lag.
 */

import { useState, useEffect, useRef } from "react";
import { useFaceCursorContext } from "../../context/FaceCursorContext";

export default function EyeCursorOverlay() {
  const { status, gazePosRef } = useFaceCursorContext();
  const [pos, setPos]          = useState({ x: -200, y: -200 });
  const rafRef                 = useRef(null);
  const visible                = status === "active" || status === "calibrating";

  // Poll gazePosRef in a RAF loop — no re-renders from the hook itself
  useEffect(() => {
    if (!visible) {
      setPos({ x: -200, y: -200 });
      return;
    }

    const tick = () => {
      const gp = gazePosRef.current;
      setPos((prev) => {
        // Only update state when position actually changes (avoid needless renders)
        if (prev.x === gp.x && prev.y === gp.y) return prev;
        return { x: gp.x, y: gp.y };
      });
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [visible, gazePosRef]);

  if (!visible) return null;

  const shared = {
    position: "fixed",
    pointerEvents: "none",
    zIndex: 9999,
    touchAction: "none",
    // NO transition — OEF already provides smoothing; CSS transition adds lag
  };

  const isCalibrating = status === "calibrating";
  const ringColor     = isCalibrating ? "rgba(245,158,11,0.7)" : "rgba(0,245,255,0.6)";
  const dotColor      = isCalibrating
    ? "radial-gradient(circle, #f59e0b 0%, #ef4444 100%)"
    : "radial-gradient(circle, #00f5ff 0%, #a855f7 100%)";
  const glowColor     = isCalibrating
    ? "rgba(245,158,11,0.8)"
    : "rgba(0,245,255,0.8)";

  return (
    <>
      {/* Outer glow ring */}
      <div style={{
        ...shared,
        left: pos.x,
        top: pos.y,
        width: 48,
        height: 48,
        borderRadius: "50%",
        border: `2px solid ${ringColor}`,
        transform: "translate(-50%, -50%)",
        boxShadow: `0 0 20px ${ringColor}50, inset 0 0 10px ${ringColor}20`,
        animation: "eyeCursorPulse 1.5s ease-in-out infinite",
        willChange: "left, top",
      }} />

      {/* Inner dot */}
      <div style={{
        ...shared,
        left: pos.x,
        top: pos.y,
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: dotColor,
        transform: "translate(-50%, -50%)",
        zIndex: 10000,
        boxShadow: `0 0 12px ${glowColor}, 0 0 24px rgba(168,85,247,0.4)`,
        willChange: "left, top",
      }} />

      {/* Crosshair lines */}
      {[
        { left: pos.x, top: pos.y - 22, width: 2, height: 12, transform: "translateX(-50%)" },
        { left: pos.x, top: pos.y + 10, width: 2, height: 12, transform: "translateX(-50%)" },
        { left: pos.x - 22, top: pos.y, width: 12, height: 2, transform: "translateY(-50%)" },
        { left: pos.x + 10, top: pos.y, width: 12, height: 2, transform: "translateY(-50%)" },
      ].map((s, i) => (
        <div key={i} style={{
          ...shared,
          ...s,
          background: ringColor,
          willChange: "left, top",
        }} />
      ))}

      {/* Calibrating label */}
      {isCalibrating && (
        <div style={{
          ...shared,
          left: pos.x,
          top: pos.y + 36,
          transform: "translateX(-50%)",
          fontSize: "0.58rem",
          fontWeight: 700,
          letterSpacing: 1.5,
          color: "#f59e0b",
          whiteSpace: "nowrap",
          textShadow: "0 0 8px rgba(245,158,11,0.8)",
        }}>
          CALIBRATING…
        </div>
      )}

      <style>{`
        @keyframes eyeCursorPulse {
          0%, 100% { transform: translate(-50%,-50%) scale(1); opacity: 1; }
          50%       { transform: translate(-50%,-50%) scale(1.18); opacity: 0.7; }
        }
      `}</style>
    </>
  );
}
