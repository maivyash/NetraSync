/**
 * EyeCursorOverlay — Animated crosshair cursor that follows gaze position.
 * Rendered instead of the native OS cursor during eye-tracked gameplay.
 *
 * Props:
 *   gazePos – { x: number, y: number } in viewport pixels
 */
export default function EyeCursorOverlay({ gazePos }) {
  const shared = {
    position: "fixed",
    pointerEvents: "none",
    zIndex: 9999,
    transition: "left 0.06s linear, top 0.06s linear",
  };

  return (
    <>
      {/* Outer glow ring */}
      <div style={{
        ...shared,
        left: gazePos.x,
        top: gazePos.y,
        width: 48,
        height: 48,
        borderRadius: "50%",
        border: "2px solid rgba(0,245,255,0.5)",
        transform: "translate(-50%, -50%)",
        boxShadow: "0 0 20px rgba(0,245,255,0.3), inset 0 0 10px rgba(0,245,255,0.1)",
        animation: "eyeCursorPulse 1.5s ease-in-out infinite",
      }} />

      {/* Inner dot */}
      <div style={{
        ...shared,
        left: gazePos.x,
        top: gazePos.y,
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: "radial-gradient(circle, #00f5ff 0%, #a855f7 100%)",
        transform: "translate(-50%, -50%)",
        zIndex: 10000,
        boxShadow: "0 0 12px rgba(0,245,255,0.8), 0 0 24px rgba(168,85,247,0.4)",
      }} />

      {/* Crosshair — top */}
      <div style={{
        ...shared, left: gazePos.x, top: gazePos.y - 20,
        width: 2, height: 12,
        background: "rgba(0,245,255,0.6)", transform: "translateX(-50%)",
      }} />
      {/* Crosshair — bottom */}
      <div style={{
        ...shared, left: gazePos.x, top: gazePos.y + 20,
        width: 2, height: 12,
        background: "rgba(0,245,255,0.6)", transform: "translateX(-50%)",
      }} />
      {/* Crosshair — left */}
      <div style={{
        ...shared, left: gazePos.x - 20, top: gazePos.y,
        width: 12, height: 2,
        background: "rgba(0,245,255,0.6)", transform: "translateY(-50%)",
      }} />
      {/* Crosshair — right */}
      <div style={{
        ...shared, left: gazePos.x + 20, top: gazePos.y,
        width: 12, height: 2,
        background: "rgba(0,245,255,0.6)", transform: "translateY(-50%)",
      }} />

      <style>{`
        @keyframes eyeCursorPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.7; }
        }
      `}</style>
    </>
  );
}
