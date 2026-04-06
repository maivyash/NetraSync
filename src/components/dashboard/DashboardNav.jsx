/**
 * DashboardNav — Sticky top navigation bar.
 */
export default function DashboardNav() {
  return (
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
  );
}
