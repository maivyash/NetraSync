import { useState } from "react";
import { Progress } from "antd";
import OrbDrive from "../games/OrbDrive";
import FusionHoops from "../games/FusionHoops";
import useEyeCursor from "../hooks/useEyeCursor";

const games = [
  {
    id: "orb-drive", icon: "🌀", title: "Orb Drive",
    type: "Convergence Training", progress: 72, xp: 1240,
    color: "#00f5ff", difficulty: "Medium",
    desc: "Track the converging orb patterns to strengthen binocular fusion.",
  },
  {
    id: "focus-shift", icon: "🎯", title: "Focus Shift",
    type: "Focus Control", progress: 48, xp: 860,
    color: "#a855f7", difficulty: "Hard",
    desc: "Rapid near-to-far focus transitions that build accommodative flexibility.",
  },
  {
    id: "fusion-hoops", icon: "🏀", title: "Fusion Hoops",
    type: "Eye-Convergence Sports", progress: 45, xp: 1520,
    color: "#a855f7", difficulty: "Medium",
    desc: "Eye convergence basketball training using focus stability to make precision shots.",
  },
  {
    id: "depth-arena", icon: "🎲", title: "Depth Arena",
    type: "Stereopsis Training", progress: 34, xp: 420,
    color: "#ff6b35", difficulty: "Hard",
    desc: "3D depth perception challenges that rebuild stereoscopic vision quickly.",
  },
  {
    id: "contrast-wars", icon: "⚡", title: "Contrast Wars",
    type: "Contrast Sensitivity", progress: 61, xp: 970,
    color: "#f59e0b", difficulty: "Medium",
    desc: "Low-contrast stimuli battles that sharpen visual sensitivity thresholds.",
  },
  {
    id: "perimeter-run", icon: "🏃", title: "Perimeter Run",
    type: "Visual Field", progress: 18, xp: 200,
    color: "#ec4899", difficulty: "Easy",
    desc: "Peripheral awareness drills that expand visual field detection range.",
  },
];

const metrics = [
  { label: "Visual Acuity", value: 78, unit: "%", color: "#00f5ff", icon: "👁" },
  { label: "Convergence", value: 64, unit: "%", color: "#a855f7", icon: "🔄" },
  { label: "Contrast Sensitivity", value: 85, unit: "%", color: "#00ff88", icon: "⚡" },
  { label: "Field Coverage", value: 52, unit: "%", color: "#ff6b35", icon: "🗺️" },
];

const weekData = [40, 55, 48, 70, 65, 82, 78];
const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Dashboard() {
  const [activeGame, setActiveGame] = useState(null);
  const [hoveredGame, setHoveredGame] = useState(null);
  const [playingGameId, setPlayingGameId] = useState(null);

  // ── Eye-tracking (single source of truth) ──────────────────────
  // Hook auto-connects WebSocket when a game is playing, auto-disconnects when not.
  // The WebSocket subscription triggers the EYONIX server to open the camera.
  const isGamePlaying = playingGameId === "orb-drive" || playingGameId === "fusion-hoops";
  const { gazePos, gazePosRef, status: gazeStatus } = useEyeCursor(isGamePlaying);

  // ── Game launch / close ────────────────────────────────────────
  const handlePlayGame = (gameId) => {
    if (gameId === "orb-drive" || gameId === "fusion-hoops") {
      setPlayingGameId(gameId);
      // The useEyeCursor hook will automatically open the WebSocket + camera
    } else {
      alert(`${gameId} game coming soon!`);
    }
  };

  const handleCloseGame = () => {
    setPlayingGameId(null);
    // The useEyeCursor hook will automatically close WebSocket + release camera
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-dark)", position: "relative" }}>
      {/* Grid bg */}
      <div className="grid-bg" style={{ position: "fixed", inset: 0, opacity: 0.3 }} />

      {/* ── TOP NAV ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 40px",
        background: "rgba(5,8,16,0.9)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,245,255,0.1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "linear-gradient(135deg,#00f5ff,#a855f7)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
          }}>👁</div>
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontSize: "1rem", color: "#fff" }}>
            NETRA<span style={{
              background: "var(--grad-accent)", WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent"
            }}>SYNC</span>
          </span>
          <div style={{
            marginLeft: 12, padding: "3px 10px", borderRadius: 20,
            background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.3)",
            color: "#00ff88", fontSize: "0.65rem", fontFamily: "var(--font-heading)", letterSpacing: 1,
          }}>ACTIVE</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontFamily: "var(--font-heading)", color: "#00f5ff", fontSize: "0.8rem",
              letterSpacing: 1
            }}>LEVEL 7</div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>4,790 / 6,000 XP</div>
          </div>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "linear-gradient(135deg,#00f5ff30,#a855f730)",
            border: "2px solid rgba(0,245,255,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            boxShadow: "0 0 12px rgba(0,245,255,0.3)",
          }}>🧑‍⚕️</div>
        </div>
      </nav>

      <div style={{ position: "relative", zIndex: 1, padding: "32px 40px", maxWidth: 1300, margin: "0 auto" }}>

        {/* ── HEADER ROW ── */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          marginBottom: 32, flexWrap: "wrap", gap: 16
        }}>
          <div>
            <h1 style={{
              fontFamily: "var(--font-heading)", fontSize: "clamp(1.4rem,3vw,2rem)",
              marginBottom: 6
            }}>
              Welcome back, <span style={{
                background: "var(--grad-accent)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
              }}>Commander</span>
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              Day 14 of your therapy protocol · 7-day streak 🔥
            </p>
          </div>
          <div style={{
            padding: "14px 24px", borderRadius: 12,
            background: "linear-gradient(135deg, rgba(0,245,255,0.08), rgba(168,85,247,0.08))",
            border: "1px solid rgba(0,245,255,0.2)",
            textAlign: "center",
          }}>
            <div style={{
              fontFamily: "var(--font-heading)", fontSize: "2rem", color: "#00f5ff",
              fontWeight: 900, filter: "drop-shadow(0 0 8px rgba(0,245,255,0.5))"
            }}>65%</div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: 2 }}>
              Overall Progress
            </div>
          </div>
        </div>

        {/* ── METRICS GRID ── */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: 16, marginBottom: 32
        }}>
          {metrics.map((m) => (
            <div key={m.label} className="glass-card" style={{ padding: "20px 24px" }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 14
              }}>
                <span style={{ fontSize: 24 }}>{m.icon}</span>
                <span style={{
                  fontFamily: "var(--font-heading)", fontSize: "1.4rem",
                  color: m.color, fontWeight: 900,
                  filter: `drop-shadow(0 0 6px ${m.color}80)`
                }}>
                  {m.value}{m.unit}
                </span>
              </div>
              <div style={{
                marginBottom: 8, color: "var(--text-secondary)", fontSize: "0.78rem",
                textTransform: "uppercase", letterSpacing: 1, fontFamily: "var(--font-heading)"
              }}>
                {m.label}
              </div>
              <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
                <div style={{
                  height: "100%", borderRadius: 2, width: `${m.value}%`,
                  background: `linear-gradient(90deg, ${m.color}, ${m.color}88)`,
                  boxShadow: `0 0 8px ${m.color}60`,
                  transition: "width 1s ease",
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* ── MAIN CONTENT AREA ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, marginBottom: 32 }}>

          {/* Games grid */}
          <div>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 20
            }}>
              <h2 style={{
                fontFamily: "var(--font-heading)", fontSize: "1rem", letterSpacing: 1,
                color: "var(--text-primary)"
              }}>🎮 Therapy Games</h2>
              <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>6 available</span>
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
              gap: 16
            }}>
              {games.map((g) => (
                <div key={g.id}
                  className="glass-card"
                  onClick={() => setActiveGame(g.id === activeGame ? null : g.id)}
                  onMouseEnter={() => setHoveredGame(g.id)}
                  onMouseLeave={() => setHoveredGame(null)}
                  style={{
                    padding: 22, cursor: "pointer",
                    borderColor: activeGame === g.id ? g.color + "80" : undefined,
                    background: activeGame === g.id ? `${g.color}08` : undefined,
                    borderTop: `2px solid ${g.color}30`,
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: `${g.color}15`, border: `1px solid ${g.color}30`,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
                      boxShadow: hoveredGame === g.id ? `0 0 16px ${g.color}40` : "none",
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

                  <p style={{
                    fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.6,
                    marginBottom: 14
                  }}>{g.desc}</p>

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

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>
                      ⭐ {g.xp.toLocaleString()} XP
                    </span>
                    <button style={{
                      padding: "7px 18px", borderRadius: 6, cursor: "pointer",
                      background: activeGame === g.id ? g.color : `${g.color}18`,
                      border: `1px solid ${g.color}50`,
                      color: activeGame === g.id ? "#000" : g.color,
                      fontFamily: "var(--font-heading)", fontSize: "0.7rem", letterSpacing: 1,
                      fontWeight: 700, transition: "all 0.3s",
                    }}
                    onClick={(e) => { e.stopPropagation(); handlePlayGame(g.id); }}
                    >
                      {activeGame === g.id ? "⏸ PAUSE" : "▶ PLAY"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Weekly chart */}
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{
                fontFamily: "var(--font-heading)", fontSize: "0.8rem", letterSpacing: 1,
                color: "var(--text-primary)", marginBottom: 20, textTransform: "uppercase"
              }}>
                📈 Weekly Score
              </h3>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
                {weekData.map((val, i) => (
                  <div key={i} style={{
                    flex: 1, display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 4
                  }}>
                    <div style={{
                      width: "100%", height: `${val}%`, borderRadius: "4px 4px 0 0",
                      background: i === 6
                        ? "linear-gradient(180deg,#00f5ff,#a855f7)"
                        : "rgba(0,245,255,0.2)",
                      border: i === 6 ? "none" : "1px solid rgba(0,245,255,0.1)",
                      boxShadow: i === 6 ? "0 0 12px rgba(0,245,255,0.4)" : "none",
                      transition: "all 0.3s",
                    }} />
                    <span style={{ color: "var(--text-muted)", fontSize: "0.6rem" }}>{weekDays[i]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Streak */}
            <div className="glass-card animate-pulse" style={{ padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔥</div>
              <div style={{
                fontFamily: "var(--font-heading)", fontSize: "2.5rem", fontWeight: 900,
                color: "#ff6b35", filter: "drop-shadow(0 0 12px rgba(255,107,53,0.6))"
              }}>7</div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: 4 }}>Day Streak</div>
              <div style={{
                marginTop: 16, padding: "8px 16px", borderRadius: 20,
                background: "rgba(255,107,53,0.1)", border: "1px solid rgba(255,107,53,0.3)",
                color: "#ff6b35", fontSize: "0.7rem", fontFamily: "var(--font-heading)", letterSpacing: 1
              }}>
                KEEP IT GOING!
              </div>
            </div>

            {/* Next session */}
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{
                fontFamily: "var(--font-heading)", fontSize: "0.75rem", letterSpacing: 1,
                color: "var(--text-muted)", marginBottom: 16, textTransform: "uppercase"
              }}>
                Recommended Next
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                }}>🎯</div>
                <div>
                  <div style={{ fontFamily: "var(--font-heading)", color: "#a855f7", fontSize: "0.85rem" }}>
                    Focus Shift
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>15 min session</div>
                </div>
              </div>
              <button className="btn-neon" style={{ width: "100%", padding: "11px", fontSize: "0.75rem" }}>
                <span>Start Session →</span>
              </button>
            </div>

          </div>
        </div>

        {/* ── OVERALL PROGRESS ── */}
        <div className="glass-card" style={{ padding: 28 }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 20, flexWrap: "wrap", gap: 12
          }}>
            <h3 style={{
              fontFamily: "var(--font-heading)", color: "#00f5ff", fontSize: "0.9rem",
              letterSpacing: 1
            }}>🧬 CLINICAL PROGRESS OVERVIEW</h3>
            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Last updated: Today</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 20 }}>
            {[
              { label: "Overall Vision Improvement", pct: 65, color: "#00f5ff" },
              { label: "Sessions Completed", pct: 78, color: "#a855f7" },
              { label: "Therapy Compliance", pct: 92, color: "#00ff88" },
              { label: "Doctor Rating", pct: 88, color: "#f59e0b" },
            ].map((item) => (
              <div key={item.label}>
                <div style={{
                  display: "flex", justifyContent: "space-between", marginBottom: 8,
                  fontSize: "0.78rem"
                }}>
                  <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                  <span style={{
                    color: item.color, fontFamily: "var(--font-heading)",
                    fontWeight: 700
                  }}>{item.pct}%</span>
                </div>
                <Progress
                  percent={item.pct} showInfo={false} size="small"
                  strokeColor={{ from: item.color, to: item.color + "88" }}
                  trailColor="rgba(255,255,255,0.05)"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Game Modal — Orb Drive */}
        {playingGameId === "orb-drive" && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5, 8, 16, 0.95)",
            backdropFilter: "blur(10px)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "none",
          }}>
            {/* Eye Tracking Status Badge */}
            <EyeTrackingBadge status={gazeStatus} />
            {/* Custom eye-tracking cursor */}
            {gazeStatus === "active" && <EyeCursorOverlay gazePos={gazePos} />}
            <div style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              cursor: "none",
            }}>
              <OrbDrive onClose={handleCloseGame} gazePosRef={gazePosRef} />
            </div>
          </div>
        )}

        {/* Game Modal — Fusion Hoops */}
        {playingGameId === "fusion-hoops" && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5, 8, 16, 0.95)",
            backdropFilter: "blur(10px)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "none",
          }}>
            {/* Eye Tracking Status Badge */}
            <EyeTrackingBadge status={gazeStatus} />
            {/* Custom eye-tracking cursor */}
            {gazeStatus === "active" && <EyeCursorOverlay gazePos={gazePos} />}
            <div style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              cursor: "none",
            }}>
              <FusionHoops onClose={handleCloseGame} gazePosRef={gazePosRef} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Eye Tracking Status Badge (shown in game overlays) ──────────
function EyeTrackingBadge({ status }) {
  const config = {
    idle:       { text: "EYE CURSOR OFF",      color: "#64748b", bg: "rgba(100,116,139,0.15)", pulse: false },
    connecting: { text: "CONNECTING…",         color: "#f59e0b", bg: "rgba(245,158,11,0.15)",  pulse: true  },
    active:     { text: "👁 PUPIL CONTROL ON",  color: "#00ff88", bg: "rgba(0,255,136,0.12)",   pulse: true  },
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

      {/* Inline keyframe for pulse animation */}
      <style>{`
        @keyframes eyeBadgePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

// ── Animated Eye Cursor Overlay (replaces native cursor in-game) ──
function EyeCursorOverlay({ gazePos }) {
  return (
    <>
      {/* Outer glow ring */}
      <div style={{
        position: "fixed",
        left: gazePos.x,
        top: gazePos.y,
        width: 48,
        height: 48,
        borderRadius: "50%",
        border: "2px solid rgba(0,245,255,0.5)",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 9999,
        boxShadow: "0 0 20px rgba(0,245,255,0.3), inset 0 0 10px rgba(0,245,255,0.1)",
        animation: "eyeCursorPulse 1.5s ease-in-out infinite",
        transition: "left 0.06s linear, top 0.06s linear",
      }} />
      {/* Inner dot */}
      <div style={{
        position: "fixed",
        left: gazePos.x,
        top: gazePos.y,
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: "radial-gradient(circle, #00f5ff 0%, #a855f7 100%)",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 10000,
        boxShadow: "0 0 12px rgba(0,245,255,0.8), 0 0 24px rgba(168,85,247,0.4)",
        transition: "left 0.06s linear, top 0.06s linear",
      }} />
      {/* Crosshair lines */}
      <div style={{
        position: "fixed",
        left: gazePos.x,
        top: gazePos.y - 20,
        width: 2,
        height: 12,
        background: "rgba(0,245,255,0.6)",
        transform: "translateX(-50%)",
        pointerEvents: "none",
        zIndex: 9999,
        transition: "left 0.06s linear, top 0.06s linear",
      }} />
      <div style={{
        position: "fixed",
        left: gazePos.x,
        top: gazePos.y + 20,
        width: 2,
        height: 12,
        background: "rgba(0,245,255,0.6)",
        transform: "translateX(-50%)",
        pointerEvents: "none",
        zIndex: 9999,
        transition: "left 0.06s linear, top 0.06s linear",
      }} />
      <div style={{
        position: "fixed",
        left: gazePos.x - 20,
        top: gazePos.y,
        width: 12,
        height: 2,
        background: "rgba(0,245,255,0.6)",
        transform: "translateY(-50%)",
        pointerEvents: "none",
        zIndex: 9999,
        transition: "left 0.06s linear, top 0.06s linear",
      }} />
      <div style={{
        position: "fixed",
        left: gazePos.x + 20,
        top: gazePos.y,
        width: 12,
        height: 2,
        background: "rgba(0,245,255,0.6)",
        transform: "translateY(-50%)",
        pointerEvents: "none",
        zIndex: 9999,
        transition: "left 0.06s linear, top 0.06s linear",
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