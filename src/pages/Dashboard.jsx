/**
 * Dashboard — Main patient dashboard page.
 * Composes sub-components; no game logic, no eye-tracking code.
 */
import DashboardNav from "../components/dashboard/DashboardNav";
import MetricsGrid from "../components/dashboard/MetricsGrid";
import GamesGrid from "../components/dashboard/GamesGrid";
import Sidebar from "../components/dashboard/Sidebar";
import ClinicalProgress from "../components/dashboard/ClinicalProgress";

export default function Dashboard() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-dark)", position: "relative" }}>
      {/* Grid bg */}
      <div className="grid-bg" style={{ position: "fixed", inset: 0, opacity: 0.3 }} />

      <DashboardNav />

      <div style={{ position: "relative", zIndex: 1, padding: "32px 40px", maxWidth: 1300, margin: "0 auto" }}>

        {/* Header row */}
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

        <MetricsGrid />

        {/* Main content area */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, marginBottom: 32 }}>
          <GamesGrid />
          <Sidebar />
        </div>

        <ClinicalProgress />
      </div>
    </div>
  );
}