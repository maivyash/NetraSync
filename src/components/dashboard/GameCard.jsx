/**
 * GameCard — A single therapy game card.
 *
 * Props:
 *   game       – game data object from dashboardData
 *   isActive   – whether this card is the "expanded" one
 *   isHovered  – whether the mouse is on this card
 *   onToggle   – called when card body is clicked (toggles active)
 *   onHover    – called onMouseEnter
 *   onLeave    – called onMouseLeave
 *   onPlay     – called when the PLAY button is clicked
 */
export default function GameCard({ game: g, isActive, isHovered, onToggle, onHover, onLeave, onPlay }) {
  return (
    <div
      className="glass-card"
      onClick={onToggle}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        padding: 22, cursor: "pointer",
        borderColor: isActive ? g.color + "80" : undefined,
        background: isActive ? `${g.color}08` : undefined,
        borderTop: `2px solid ${g.color}30`,
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: `${g.color}15`, border: `1px solid ${g.color}30`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
          boxShadow: isHovered ? `0 0 16px ${g.color}40` : "none",
          transition: "box-shadow 0.3s",
        }}>{g.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: "var(--font-heading)", color: g.color,
            fontSize: "0.85rem", letterSpacing: 0.5
          }}>{g.title}</div>
          <div style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>{g.type}</div>
        </div>
        <div style={{
          padding: "3px 8px", borderRadius: 4,
          background: g.difficulty === "Easy"
            ? "rgba(0,255,136,0.1)" : g.difficulty === "Medium"
              ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)",
          color: g.difficulty === "Easy" ? "#00ff88"
            : g.difficulty === "Medium" ? "#f59e0b" : "#ef4444",
          fontSize: "0.6rem", fontFamily: "var(--font-heading)", letterSpacing: 1,
        }}>{g.difficulty}</div>
      </div>

      {/* Description */}
      <p style={{
        fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.6,
        marginBottom: 14
      }}>{g.desc}</p>

      {/* Progress bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          marginBottom: 6, fontSize: "0.7rem"
        }}>
          <span style={{ color: "var(--text-muted)" }}>Progress</span>
          <span style={{ color: g.color, fontFamily: "var(--font-heading)" }}>{g.progress}%</span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
          <div style={{
            height: "100%", width: `${g.progress}%`, borderRadius: 2,
            background: `linear-gradient(90deg, ${g.color}, ${g.color}88)`,
            boxShadow: `0 0 8px ${g.color}50`,
          }} />
        </div>
      </div>

      {/* Footer: XP + Play */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>
          ⭐ {g.xp.toLocaleString()} XP
        </span>
        <button
          style={{
            padding: "7px 18px", borderRadius: 6, cursor: "pointer",
            background: isActive ? g.color : `${g.color}18`,
            border: `1px solid ${g.color}50`,
            color: isActive ? "#000" : g.color,
            fontFamily: "var(--font-heading)", fontSize: "0.7rem", letterSpacing: 1,
            fontWeight: 700, transition: "all 0.3s",
          }}
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
        >
          ▶ PLAY
        </button>
      </div>
    </div>
  );
}
