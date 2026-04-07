/**
 * Dashboard — Main patient dashboard page.
 * Composes sub-components; no game logic, no eye-tracking code.
 */
import { useState, useEffect } from "react";
import DashboardNav from "../components/dashboard/DashboardNav";
import GamesGrid from "../components/dashboard/GamesGrid";
import ClinicalProgress from "../components/dashboard/ClinicalProgress";
import ProfileModal from "../components/dashboard/ProfileModal";

export default function Dashboard() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [userName, setUserName] = useState("Patient");

  useEffect(() => {
    // Get user name from localStorage or session state
    const savedName = localStorage.getItem("userName") || "Patient";
    setUserName(savedName);
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
              }}>{userName}</span>
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              Day 14 of your therapy protocol · 7-day streak 🔥
            </p>
          </div>
        </div>

        {/* Main content area */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24, marginBottom: 32 }}>
          <GamesGrid />
        </div>

        <ClinicalProgress />
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