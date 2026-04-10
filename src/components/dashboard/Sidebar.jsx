/**
 * Sidebar — Weekly chart, streak counter, and next session recommendation.
 */
import { weekData, weekDays } from "../../data/dashboardData";
import { LineChartOutlined, FireFilled, AimOutlined } from "@ant-design/icons";

export default function Sidebar() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Weekly chart */}
      <div className="glass-card" style={{ padding: 24 }}>
        <h3 style={{
          fontFamily: "var(--font-heading)", fontSize: "0.8rem", letterSpacing: 1,
          color: "var(--text-primary)", marginBottom: 20, textTransform: "uppercase"
          <LineChartOutlined /> Weekly Score
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
        <div style={{ fontSize: 36, marginBottom: 8, color: '#ff4d4f' }}><FireFilled /></div>
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
          }}><AimOutlined /></div>
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
  );
}
