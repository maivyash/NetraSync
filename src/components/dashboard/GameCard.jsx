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
import { StarFilled, DribbbleOutlined, CarFilled, BlockOutlined, AimOutlined, AppstoreOutlined, DashboardOutlined } from "@ant-design/icons";

const GAME_ICONS = {
  "orb-drive": <CarFilled />,
  "focus-shift": <AimOutlined />,
  "fusion-hoops": <DribbbleOutlined />,
  "depth-arena": <AppstoreOutlined />,
  "shape-match": <BlockOutlined />,
  "perimeter-run": <DashboardOutlined />
};

export default function GameCard({
  game: g,
  earnedPoints = 0,
  isActive,
  isHovered,
  onToggle,
  onHover,
  onLeave,
  onInstructions,
  onPlay,
}) {
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
        }}>{GAME_ICONS[g.id] || g.icon}</div>
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

      {/* Total Points */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 8,
          background: `linear-gradient(90deg, ${g.color}15, transparent)`,
          borderLeft: `2px solid ${g.color}`,
        }}>
          <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: 0.8 }}>
            Total Points Earned:
          </span>
          <span style={{ color: g.color, fontFamily: "var(--font-heading)", fontSize: "0.9rem", fontWeight: 700 }}>
            {earnedPoints.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Footer: XP + Play */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>
          <StarFilled style={{color: '#facc15'}} /> {g.xp.toLocaleString()} XP
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={{
              padding: "7px 12px",
              borderRadius: 6,
              cursor: "pointer",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-heading)",
              fontSize: "0.64rem",
              letterSpacing: 0.8,
              fontWeight: 700,
              transition: "all 0.3s",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onInstructions();
            }}
          >
            Instructions
          </button>

          <button
            style={{
              padding: "7px 18px", borderRadius: 6, cursor: "pointer",
              background: isActive ? g.color : `${g.color}18`,
              border: `1px solid ${g.color}50`,
              color: isActive ? "#000" : g.color,
              fontFamily: "var(--font-heading)", fontSize: "0.7rem", letterSpacing: 1,
              fontWeight: 700, transition: "all 0.3s",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
          >
            PLAY
          </button>
        </div>
      </div>
    </div>
  );
}
