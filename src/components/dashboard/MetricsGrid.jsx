/**
 * MetricsGrid — Four key therapy metric cards.
 */
import { metrics } from "../../data/dashboardData";

export default function MetricsGrid() {
  return (
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
  );
}
