/**
 * EyeTrackingBadge — Status indicator shown during face-tracked gameplay.
 * Reads status from FaceCursorContext.
 *
 * Props:
 *   status (optional) — override if passed directly; otherwise reads from context
 */
import { useFaceCursorContext } from "../../context/FaceCursorContext";

export default function EyeTrackingBadge({ status: statusProp }) {
  let contextStatus = "idle";
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const ctx = useFaceCursorContext();
    contextStatus = ctx.status;
  } catch {
    // If used outside provider, statusProp must be passed
  }

  const status = statusProp ?? contextStatus;

  const config = {
    idle:        { text: "👁 FACE CURSOR OFF",   color: "#64748b", bg: "rgba(100,116,139,0.15)", pulse: false },
    connecting:  { text: "⏳ INITIALIZING…",     color: "#a855f7", bg: "rgba(168,85,247,0.15)",  pulse: true  },
    calibrating: { text: "🎯 CALIBRATING…",      color: "#f59e0b", bg: "rgba(245,158,11,0.15)",  pulse: true  },
    active:      { text: "👁 FACE CONTROL ON",   color: "#00ff88", bg: "rgba(0,255,136,0.12)",   pulse: true  },
    paused:      { text: "⏸ FACE LOST",          color: "#f59e0b", bg: "rgba(245,158,11,0.15)",  pulse: true  },
    error:       { text: "⚠ CAMERA ERROR",       color: "#ef4444", bg: "rgba(239,68,68,0.15)",   pulse: false },
  };
  const c = config[status] || config.idle;

  return (
    <div style={{
      position: "fixed",
      top: 14,
      right: 14,
      zIndex: 2100,
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 14px",
      borderRadius: 20,
      background: c.bg,
      border: `1px solid ${c.color}44`,
      backdropFilter: "blur(8px)",
      pointerEvents: "none",
      animation: c.pulse ? "eyeBadgePulse 2s ease-in-out infinite" : "none",
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: c.color,
        boxShadow: `0 0 6px ${c.color}80`,
      }} />
      <span style={{
        fontFamily: "var(--font-heading, 'Inter', sans-serif)",
        fontSize: "0.65rem",
        letterSpacing: 1.2,
        color: c.color,
        fontWeight: 700,
      }}>{c.text}</span>

      <style>{`
        @keyframes eyeBadgePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
