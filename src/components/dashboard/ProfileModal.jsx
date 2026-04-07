/**
 * ProfileModal — User profile popup with progress chart, streak, and action buttons.
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  CloseOutlined,
  UserOutlined,
  LineChartOutlined,
  PlayCircleOutlined,
  LogoutOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { getCurrentWeekProgress } from "../../utils/weeklyProgress";

export default function ProfileModal({ isOpen, onClose, userName }) {
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const scrollRef = useRef(null);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setHasReachedEnd(false);

      requestAnimationFrame(() => {
        const node = scrollRef.current;
        if (!node) return;
        const canScroll = node.scrollHeight - node.clientHeight > 8;
        setHasReachedEnd(!canScroll);
      });
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  const handleLogout = () => {
    // Clear auth data + redirect
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    navigate("/");
  };

  const handleContinuePlaying = () => {
    onClose();
  };

  if (!isOpen) return null;

  const userId = window.localStorage.getItem("userId");
  const weekProgress = getCurrentWeekProgress(userId);
  const playedPoints = weekProgress.filter((item) => typeof item.value === "number");
  const completedDays = weekProgress.filter((day) => day.hasData).length;
  const currentStreak = (() => {
    let streak = 0;
    for (let i = weekProgress.length - 1; i >= 0; i--) {
      const day = weekProgress[i];
      if (day.isFuture) continue;
      if (!day.hasData) break;
      streak += 1;
    }
    return streak;
  })();

  const minValue = 0; // Always start from 0
  const maxScale = 100; // Always scale to 100
  const svgWidth = 320;
  const svgHeight = 200;
  const padding = { top: 20, bottom: 40, left: 45, right: 20 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;
  const pointSpacing = graphWidth / (weekProgress.length - 1);

  // Calculate SVG points for smooth line chart
  const points = weekProgress.map((item, index) => {
    const x = padding.left + index * pointSpacing;
    const value = typeof item.value === "number" ? item.value : null;
    if (value === null) {
      return { x, y: null, value: null };
    }
    const normalized = (value - minValue) / (maxScale - minValue);
    const y = padding.top + graphHeight - normalized * graphHeight;
    return { x, y, value };
  });
  const chartPoints = points.filter((point) => typeof point.value === "number");

  // Create smooth curve path (using quadratic bezier)
  let pathData = "";
  if (chartPoints.length > 0) {
    pathData = `M ${chartPoints[0].x} ${chartPoints[0].y}`;
  }
  for (let i = 1; i < chartPoints.length; i++) {
    const prev = chartPoints[i - 1];
    const curr = chartPoints[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;
    pathData += ` Q ${prev.x} ${prev.y}, ${midX} ${midY}`;
  }
  if (chartPoints.length > 1) {
    const lastPoint = chartPoints[chartPoints.length - 1];
    pathData += ` T ${lastPoint.x} ${lastPoint.y}`;
  }

  const handleScroll = (event) => {
    const node = event.currentTarget;
    const isAtBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 8;
    setHasReachedEnd(isAtBottom);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          zIndex: 200,
          backdropFilter: "blur(4px)",
        }}
      />

      {/* Modal - Compact and responsive */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 201,
          width: "calc(100% - 32px)",
          maxWidth: 400,
          maxHeight: "90vh",
          background: "linear-gradient(135deg, rgba(5,8,16,0.98), rgba(15,20,35,0.98))",
          border: "1px solid rgba(0,245,255,0.3)",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 20px 60px rgba(0,245,255,0.2)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "transparent",
            border: "none",
            color: "#00f5ff",
            fontSize: 22,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
          }}
        >
          <CloseOutlined style={{ fontSize: 18 }} />
        </button>

        {/* Scrollable Content */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            overflowY: "auto",
            overflowX: "hidden",
            flex: 1,
            paddingRight: 8,
            scrollBehavior: "smooth",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {/* Profile Header */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#00f5ff,#a855f7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                margin: "0 auto 10px",
                boxShadow: "0 0 20px rgba(0,245,255,0.4)",
              }}
            >
              <UserOutlined style={{ color: "#ffffff", fontSize: 24 }} />
            </div>
            <h2
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "1.2rem",
                color: "#fff",
                marginBottom: 3,
              }}
            >
              {userName || "Patient"}
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
              Level 7 • Commander
            </p>
          </div>

          {/* Progress Section */}
          <div style={{ marginBottom: 18 }}>
            <h3
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "0.85rem",
                letterSpacing: 0.5,
                color: "#00f5ff",
                marginBottom: 12,
                textTransform: "uppercase",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <LineChartOutlined />
                Weekly Progress
              </span>
            </h3>

            {/* Line Chart - Compact */}
            <div
              style={{
                background: "rgba(0,245,255,0.05)",
                border: "1px solid rgba(0,245,255,0.15)",
                borderRadius: 8,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <svg
                width="100%"
                height="auto"
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                preserveAspectRatio="xMidYMid meet"
                style={{ display: "block", margin: "0 auto", minHeight: 220 }}
              >
                {/* Grid lines for Y-axis (0, 25, 50, 75, 100) */}
                {[0, 25, 50, 75, 100].map((val) => {
                  const y = padding.top + graphHeight - (val / maxScale) * graphHeight;
                  return (
                    <g key={`grid-${val}`}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={svgWidth - padding.right}
                        y2={y}
                        stroke="rgba(0,245,255,0.1)"
                        strokeWidth="1"
                        strokeDasharray="3,3"
                      />
                      {/* Y-axis labels */}
                      <text
                        x={padding.left - 8}
                        y={y + 4}
                        fontSize="11"
                        fill="rgba(0,245,255,0.5)"
                        textAnchor="end"
                        fontFamily="var(--font-heading)"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* X-axis */}
                <line
                  x1={padding.left}
                  y1={padding.top + graphHeight}
                  x2={svgWidth - padding.right}
                  y2={padding.top + graphHeight}
                  stroke="rgba(0,245,255,0.4)"
                  strokeWidth="2"
                />

                {/* Y-axis */}
                <line
                  x1={padding.left}
                  y1={padding.top}
                  x2={padding.left}
                  y2={padding.top + graphHeight}
                  stroke="rgba(0,245,255,0.4)"
                  strokeWidth="2"
                />

                {/* Smooth line path */}
                {chartPoints.length > 1 && (
                  <path
                    d={pathData}
                    fill="none"
                    stroke="#00f5ff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="drop-shadow(0 0 3px rgba(0,245,255,0.6))"
                  />
                )}

                {/* Data points */}
                {chartPoints.map((p, i) => (
                  <circle
                    key={`point-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r="3.5"
                    fill="#00f5ff"
                    stroke="#00f5ff"
                    strokeWidth="0.5"
                    filter="drop-shadow(0 0 4px rgba(0,245,255,0.8))"
                  />
                ))}

                {/* Day labels (X-axis) */}
                {weekProgress.map((day, i) => {
                  const x = padding.left + i * pointSpacing;
                  return (
                    <text
                      key={`day-${i}`}
                      x={x}
                      y={svgHeight - 8}
                      fontSize="11"
                      fill="rgba(0,245,255,0.6)"
                      textAnchor="middle"
                      fontFamily="var(--font-heading)"
                    >
                      {day.dayLabel}
                    </text>
                  );
                })}
              </svg>

              {playedPoints.length === 0 && (
                <p
                  style={{
                    marginTop: 8,
                    marginBottom: 0,
                    textAlign: "center",
                    color: "var(--text-secondary)",
                    fontSize: "0.78rem",
                  }}
                >
                  No practice logged yet this week.
                </p>
              )}
            </div>

          </div>

          {/* Weekly Streak */}
          <div
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 14,
              padding: "16px 14px 14px",
              marginBottom: 18,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 84,
                height: 84,
                margin: "0 auto 10px",
                borderRadius: "50%",
                background: "linear-gradient(180deg, #ffb11a, #ff8a00)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 12px 30px rgba(255,138,0,0.35)",
                position: "relative",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 800,
                  fontSize: "2rem",
                  color: "#fff",
                  lineHeight: 1,
                }}
              >
                {currentStreak}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                gap: 8,
                marginBottom: 12,
              }}
            >
              {weekProgress.map((day, index) => {
                const isFilled = day.hasData;
                return (
                  <div key={`streak-day-${index}`} style={{ textAlign: "center" }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        margin: "0 auto 4px",
                        borderRadius: "50%",
                        border: isFilled
                          ? "1px solid rgba(255,166,0,0.95)"
                          : "1.5px solid rgba(255,166,0,0.65)",
                        background: isFilled
                          ? "linear-gradient(180deg, #ffb11a, #ff8a00)"
                          : "transparent",
                        color: isFilled ? "#fff" : "rgba(255,166,0,0.8)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "var(--font-heading)",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        opacity: day.isFuture ? 0.55 : 1,
                      }}
                    >
                      {day.dayLabel.charAt(0)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "1.45rem",
                color: "#fff",
                fontWeight: 700,
                marginBottom: 2,
              }}
            >
              {currentStreak} Day Streak!
            </div>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.78rem",
                marginTop: 0,
                marginBottom: 0,
                lineHeight: 1.45,
              }}
            >
              Play every day to keep your streak alive.
              <br />
              This week: {completedDays}/7 days completed
            </p>
          </div>

          {!hasReachedEnd && (
            <p
              style={{
                marginTop: 12,
                marginBottom: 4,
                textAlign: "center",
                color: "var(--text-secondary)",
                fontSize: "0.75rem",
              }}
            >
              Scroll to the end to unlock actions.
            </p>
          )}

          {/* Action Buttons - End of content, not sticky */}
          <div
            style={{
              display: "flex",
              gap: 10,
              flexDirection: "column",
              marginTop: 16,
              marginBottom: 2,
              opacity: hasReachedEnd ? 1 : 0,
              pointerEvents: hasReachedEnd ? "auto" : "none",
              transition: "opacity 0.2s ease",
            }}
          >
          <button
            onClick={handleContinuePlaying}
            style={{
              padding: "11px 16px",
              borderRadius: 8,
              border: "1px solid #00f5ff",
              background: "rgba(0,245,255,0.1)",
              color: "#00f5ff",
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              letterSpacing: 0.5,
              cursor: "pointer",
              fontSize: "0.85rem",
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "rgba(0,245,255,0.2)";
              e.target.style.boxShadow = "0 0 12px rgba(0,245,255,0.4)";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "rgba(0,245,255,0.1)";
              e.target.style.boxShadow = "none";
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <PlayCircleOutlined />
              Continue Playing
            </span>
          </button>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            style={{
              padding: "11px 16px",
              borderRadius: 8,
              border: "1px solid rgba(255,107,53,0.5)",
              background: "rgba(255,107,53,0.1)",
              color: "#ff6b35",
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              letterSpacing: 0.5,
              cursor: "pointer",
              fontSize: "0.85rem",
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "rgba(255,107,53,0.2)";
              e.target.style.boxShadow = "0 0 12px rgba(255,107,53,0.3)";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "rgba(255,107,53,0.1)";
              e.target.style.boxShadow = "none";
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <LogoutOutlined />
              Logout
            </span>
          </button>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <>
          <div
            onClick={() => setShowLogoutConfirm(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              zIndex: 300,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 301,
              background: "linear-gradient(135deg, rgba(5,8,16,0.98), rgba(15,20,35,0.98))",
              border: "1px solid rgba(255,107,53,0.3)",
              borderRadius: 12,
              padding: 24,
              textAlign: "center",
              maxWidth: 300,
              width: "calc(100% - 32px)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 10, color: "#ff6b35" }}>
              <ExclamationCircleOutlined />
            </div>
            <h3
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "1.05rem",
                color: "#fff",
                marginBottom: 6,
              }}
            >
              Do you really want to logout?
            </h3>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.85rem",
                marginBottom: 18,
              }}
            >
              You can always log back in later.
            </p>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  flex: 1,
                  padding: "9px 12px",
                  borderRadius: 6,
                  border: "1px solid rgba(0,245,255,0.3)",
                  background: "rgba(0,245,255,0.05)",
                  color: "#00f5ff",
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "rgba(0,245,255,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "rgba(0,245,255,0.05)";
                }}
              >
                No, Keep Going
              </button>
              <button
                onClick={handleLogout}
                style={{
                  flex: 1,
                  padding: "9px 12px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,107,53,0.5)",
                  background: "rgba(255,107,53,0.15)",
                  color: "#ff6b35",
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "rgba(255,107,53,0.25)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "rgba(255,107,53,0.15)";
                }}
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
