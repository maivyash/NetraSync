/**
 * EyeTrackingBadge — Connection status indicator shown during eye-tracked gameplay.
 *
 * Props:
 *   status – "idle" | "connecting" | "active" | "error"
 */
export default function EyeTrackingBadge({ status }) {
  const config = {
    idle:       { text: "EYE CURSOR OFF",      color: "#64748b", bg: "rgba(100,116,139,0.15)", pulse: false },
    connecting: { text: "CALIBRATING…",        color: "#f59e0b", bg: "rgba(245,158,11,0.15)",  pulse: true  },
    active:     { text: "👁 FACE CONTROL ON",   color: "#00ff88", bg: "rgba(0,255,136,0.12)",   pulse: true  },
    paused:     { text: "⏸ FACE LOST",          color: "#f59e0b", bg: "rgba(245,158,11,0.15)",  pulse: true  },
    error:      { text: "⚠ CONNECTION ERROR",   color: "#ef4444", bg: "rgba(239,68,68,0.15)",   pulse: false },
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
        fontFamily: "var(--font-heading)",
        fontSize: "0.65rem",
        letterSpacing: 1.2,
        color: c.color,
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
