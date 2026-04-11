/**
 * Dashboard — Main patient dashboard page.
 * Shows: welcome header, today's stats (best score + total points), games grid.
 */
import { useState, useEffect } from "react";
import DashboardNav from "../components/dashboard/DashboardNav";
import GamesGrid from "../components/dashboard/GamesGrid";
import ProfileModal from "../components/dashboard/ProfileModal";

// ── Minimal stat card ──────────────────────────────────────────────────────────
function TodayStat({ label, value, accent, icon, loading }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 180,
        background: "rgba(13,17,23,0.75)",
        border: `1px solid ${accent}33`,
        borderRadius: 14,
        padding: "18px 22px",
        backdropFilter: "blur(16px)",
        boxShadow: `0 4px 24px ${accent}14`,
        display: "flex",
        alignItems: "center",
        gap: 16,
        transition: "all 0.3s",
      }}
    >
      {/* Icon pill */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: `${accent}18`,
          border: `1.5px solid ${accent}44`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "0.6rem",
            color: "var(--text-muted)",
            letterSpacing: 1.5,
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: "1.6rem",
            fontWeight: 900,
            color: loading ? "var(--text-muted)" : accent,
            lineHeight: 1,
            textShadow: loading ? "none" : `0 0 12px ${accent}55`,
            letterSpacing: 1,
            transition: "color 0.4s",
          }}
        >
          {loading ? "—" : value}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [userName, setUserName] = useState("Patient");

  // Today's stats
  const [todayBest,   setTodayBest]   = useState(null);
  const [todayTotal,  setTodayTotal]  = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    const savedName = localStorage.getItem("userName") || "Patient";
    setUserName(savedName);
  }, []);

  // Fetch today's stats on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { setStatsLoading(false); return; }

    let cancelled = false;
    (async () => {
      try {
        const res  = await fetch("/api/scores/me/today", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        if (!cancelled && data.success) {
          setTodayBest(data.todayBestScore);
          setTodayTotal(data.todayTotalPoints);
        }
      } catch {
        // silently ignore — stats just show "—"
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-dark)", position: "relative" }}>
      {/* Grid bg */}
      <div className="grid-bg" style={{ position: "fixed", inset: 0, opacity: 0.3 }} />

      <DashboardNav onProfileClick={() => setProfileOpen(true)} />

      <div style={{ position: "relative", zIndex: 1, padding: "32px 40px", maxWidth: 1300, margin: "0 auto" }}>

        {/* Header row */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          marginBottom: 28, flexWrap: "wrap", gap: 16
        }}>
          <div>
            <h1 style={{
              fontFamily: "var(--font-heading)", fontSize: "clamp(1.4rem,3vw,2rem)",
              marginBottom: 6
            }}>
              Welcome back, <span style={{
                background: "var(--grad-accent)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
              }}>{userName}</span>
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              Our Mission is Your Vision
            </p>
          </div>
        </div>

        {/* ── Today's Stats row ── */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 32,
        }}>
          <TodayStat
            label="Today's Best Score"
            value={todayBest !== null ? todayBest.toLocaleString() : "0"}
            accent="var(--neon-cyan)"
            icon="🏆"
            loading={statsLoading}
          />
          <TodayStat
            label="Today's Generated Points"
            value={todayTotal !== null ? todayTotal.toLocaleString() : "0"}
            accent="var(--neon-green)"
            icon="⚡"
            loading={statsLoading}
          />
        </div>

        {/* Main content — games grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24, marginBottom: 32 }}>
          <GamesGrid />
        </div>

      </div>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        userName={userName}
      />
    </div>
  );
}