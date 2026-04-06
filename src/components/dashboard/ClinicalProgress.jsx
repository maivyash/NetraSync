/**
 * ClinicalProgress — Overall clinical progress section with Ant Design Progress bars.
 */
import { Progress } from "antd";
import { clinicalItems } from "../../data/dashboardData";

export default function ClinicalProgress() {
  return (
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

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 20
      }}>
        {clinicalItems.map((item) => (
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
  );
}
