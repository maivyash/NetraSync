/**
 * ProfileModal — User profile popup with score worm graph, game-wise breakdown,
 * total points summary, weekly streak, and action buttons.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { message } from "antd";
import {
  CloseOutlined,
  UserOutlined,
  LineChartOutlined,
  PlayCircleOutlined,
  LogoutOutlined,
  ExclamationCircleOutlined,
  TrophyOutlined,
  CameraOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { logout } from "../../utils/auth";
import { getCurrentWeekProgress } from "../../utils/weeklyProgress";
import { getDatewiseScores, getScoreSummary, getAlignmentScores, submitAlignmentScore } from "../../utils/scoreApi";

// ── Color palette ────────────────────────────────────────────
const COLORS = {
  cyan: "#00f5ff",
  purple: "#a855f7",
  green: "#00ff88",
  orange: "#ffb11a",
  red: "#ef4444",
  gold: "#ffcc00",
};

const GAME_COLORS = {
  "orb-drive": COLORS.cyan,
  "fusion-hoops": COLORS.purple,
};

const GAME_LABELS = {
  "orb-drive": "OrbDrive",
  "fusion-hoops": "FusionHoops",
};

// ── Helpers ──────────────────────────────────────────────────
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function formatDateFull(dateStr) {
  const d = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export default function ProfileModal({ isOpen, onClose, userName }) {
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const scrollRef = useRef(null);

  // ── Scoring state ──────────────────────────────────────────
  const [scoreSummary, setScoreSummary] = useState(null);
  const [datewiseData, setDatewiseData] = useState(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("worm"); // "worm" | "games"
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // ── Alignment state ──────────────────────────────────────────
  const [alignmentData, setAlignmentData] = useState([]);
  const [alignmentLoading, setAlignmentLoading] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [currentScanStatus, setCurrentScanStatus] = useState(null);
  const [photoMode, setPhotoMode] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const classifyScore = useCallback((pct) => {
    if (pct < 15) return { label: "Excellent — Well Aligned", color: "#00ff88" };
    if (pct < 40) return { label: "Mild Misalignment", color: "#00f5ff" };
    if (pct < 70) return { label: "Moderate Misalignment", color: "#f59e0b" };
    return { label: "Severe Misalignment", color: "#ff6b35" };
  }, []);

  const processCapturedImage = useCallback(
    async (dataUrl) => {
      try {
        setScoring(true);
        setCapturedPhoto(dataUrl);

        const response = await fetch(dataUrl);
        const blob = await response.blob();

        const formData = new FormData();
        formData.append("photo", blob, "eye_capture.jpg");
        formData.append("dominant", "right"); // Default

        const scanRes = await fetch("/api/scanImage", {
          method: "POST",
          body: formData,
        });

        const rawResponse = await scanRes.text();
        let data = {};
        if (rawResponse) {
          try {
            data = JSON.parse(rawResponse);
          } catch {
            throw new Error("AI scan failed");
          }
        }

        if (!scanRes.ok || !data.success) {
          throw new Error(data.error || "AI scan failed");
        }

        if (!data.faceDetected) {
          throw new Error("No face detected. Please try again.");
        }

        const pct = data.alignment ?? 0;
        const status = classifyScore(pct);
        setCurrentScanStatus({
          ...status,
          alignment: pct,
          severity: data.severity,
          direction: data.direction,
          strabismus: data.strabismus,
        });

        await submitAlignmentScore({
          alignment: pct,
          severity: data.severity,
          direction: data.direction,
          strabismus: data.strabismus,
        });

        getAlignmentScores().then(res => {
          if (res.success) setAlignmentData(res.data);
        });
        message.success("Alignment score saved successfully!");

      } catch (error) {
        setCapturedPhoto(null);
        setCurrentScanStatus(null);
        message.error(error.message || "Failed to process photo");
      } finally {
        setScoring(false);
      }
    },
    [classifyScore]
  );

  const startCamera = useCallback(async () => {
    try {
      setCalibrating(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 520 } },
      });
      setCameraStream(stream);
      setPhotoMode("camera");
      setCameraReady(false);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCameraReady(true);
        }
      }, 100);
    } catch {
      message.error("Unable to access camera");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setCameraReady(false);
    setPhotoMode(null);
  }, [cameraStream]);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 520;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    stopCamera();
    await processCapturedImage(dataUrl);
  }, [processCapturedImage, stopCamera]);

  const closeCalibration = useCallback(() => {
    stopCamera();
    setCalibrating(false);
    setCapturedPhoto(null);
    setCurrentScanStatus(null);
  }, [stopCamera]);

  useEffect(() => {
    return () => {
      if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
    };
  }, [cameraStream]);

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

      // Fetch scoring data from DB
      setScoreLoading(true);
      setAlignmentLoading(true);
      Promise.all([getScoreSummary(), getDatewiseScores(30), getAlignmentScores()])
        .then(([summaryResp, datewiseResp, alignResp]) => {
          if (summaryResp.success) setScoreSummary(summaryResp);
          if (datewiseResp.success) setDatewiseData(datewiseResp);
          if (alignResp.success) setAlignmentData(alignResp.data);
        })
        .catch((err) => console.warn("Score fetch error:", err))
        .finally(() => { setScoreLoading(false); setAlignmentLoading(false); });
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleContinuePlaying = () => {
    onClose();
  };

  if (!isOpen) return null;

  const userId = window.localStorage.getItem("userId");
  const weekProgress = getCurrentWeekProgress(userId);
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

  // ── Worm graph data ────────────────────────────────────────
  const dailyTotals = datewiseData?.dailyTotals || [];
  const perGamePerDay = datewiseData?.perGamePerDay || [];

  // Build game-specific series from perGamePerDay
  const gameNames = [...new Set(perGamePerDay.map((r) => r.gameName))];
  const gameSeries = {};
  gameNames.forEach((gn) => {
    gameSeries[gn] = perGamePerDay
      .filter((r) => r.gameName === gn)
      .map((r) => ({ date: r.date, points: r.totalPoints, sessions: r.sessions }));
  });

  // ── SVG Worm Graph ─────────────────────────────────────────
  const svgWidth = 340;
  const svgHeight = 180;
  const pad = { top: 20, bottom: 36, left: 42, right: 16 };
  const gW = svgWidth - pad.left - pad.right;
  const gH = svgHeight - pad.top - pad.bottom;

  const maxPts = Math.max(10, ...dailyTotals.map((d) => d.totalPoints));

  // Build SVG points for daily totals (the main worm line)
  const wormPoints = dailyTotals.map((d, i) => {
    const x = pad.left + (dailyTotals.length > 1 ? (i / (dailyTotals.length - 1)) * gW : gW / 2);
    const y = pad.top + gH - (d.totalPoints / maxPts) * gH;
    return { x, y, ...d };
  });

  // Smooth path helper
  function smoothPath(points) {
    if (points.length === 0) return "";
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const mx = (prev.x + curr.x) / 2;
      const my = (prev.y + curr.y) / 2;
      d += ` Q ${prev.x} ${prev.y}, ${mx} ${my}`;
    }
    if (points.length > 1) {
      const last = points[points.length - 1];
      d += ` T ${last.x} ${last.y}`;
    }
    return d;
  }

  // Build per-game worm lines
  const gameWormLines = {};
  gameNames.forEach((gn) => {
    const series = gameSeries[gn];
    const pts = series.map((s, i) => {
      const x = pad.left + (series.length > 1 ? (i / (series.length - 1)) * gW : gW / 2);
      const y = pad.top + gH - (s.points / maxPts) * gH;
      return { x, y, ...s };
    });
    gameWormLines[gn] = pts;
  });

  // Y-axis grid
  const ySteps = [0, 0.25, 0.5, 0.75, 1.0];

  // ── Score summary stats ────────────────────────────────────
  const total = scoreSummary?.total || {};
  const perGame = scoreSummary?.perGame || [];

  const handleScroll = (event) => {
    const node = event.currentTarget;
    const isAtBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 8;
    setHasReachedEnd(isAtBottom);
  };

  // ── Glassmorphism card style ───────────────────────────────
  const glassCard = {
    background: "rgba(0,245,255,0.04)",
    border: "1px solid rgba(0,245,255,0.12)",
    borderRadius: 10,
    padding: "14px 12px",
    marginBottom: 14,
  };

  const statBox = {
    textAlign: "center",
    padding: "10px 6px",
    background: "rgba(255,255,255,0.03)",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.06)",
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

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 201,
          width: "calc(100% - 32px)",
          maxWidth: 420,
          maxHeight: "92vh",
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
          <div style={{ textAlign: "center", marginBottom: 16 }}>
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
                margin: "0 auto 8px",
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
            <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginBottom: 0 }}>
              {total.totalGames ? `${total.totalGames} games played` : "Welcome to NetraSync"}
            </p>
          </div>

          {/* ═══════════════════════════════════════════════════
              AI ALIGNMENT PANEL
             ═══════════════════════════════════════════════════ */}
          <div style={glassCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <EyeOutlined style={{ color: COLORS.cyan, fontSize: 18 }} />
                <span style={{ fontFamily: "var(--font-heading)", fontSize: "0.8rem", color: COLORS.cyan, letterSpacing: 0.5, textTransform: "uppercase" }}>
                  AI Alignment Score
                </span>
              </div>
              <button
                onClick={calibrating ? closeCalibration : startCamera}
                style={{
                  background: calibrating ? "rgba(239,68,68,0.1)" : "rgba(0,245,255,0.1)",
                  border: `1px solid ${calibrating ? "rgba(239,68,68,0.3)" : "rgba(0,245,255,0.3)"}`,
                  color: calibrating ? "#1eff00ff" : "#00f5ff",
                  padding: "4px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: "0.7rem",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {calibrating ? "Done" : "Calibrate"}
              </button>
            </div>

            {calibrating ? (
              <div style={{ marginBottom: 10 }}>
                {!capturedPhoto ? (
                  <>
                    <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid rgba(0,245,255,0.3)", position: "relative", marginBottom: 10 }}>
                      <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", height: 180, objectFit: "cover", display: "block", background: "#000" }} />
                      <div style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: 4, fontSize: "0.65rem", color: cameraReady ? COLORS.green : COLORS.orange }}>
                        {cameraReady ? "Ready to Capture" : "Starting Camera..."}
                      </div>
                    </div>
                    <button
                      onClick={capturePhoto}
                      style={{
                        width: "100%", padding: "8px", background: "linear-gradient(90deg, #00f5ff, #00ff88)",
                        border: "none", borderRadius: 6, color: "#000", fontWeight: "bold", cursor: "pointer",
                      }}
                    >
                      <CameraOutlined style={{ marginRight: 6 }} /> Capture Image
                    </button>
                  </>
                ) : (
                  <>
                    <img src={capturedPhoto} alt="Captured" style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: 8, marginBottom: 10, border: "1px solid rgba(0,245,255,0.3)" }} />
                    {scoring ? (
                      <div style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--text-secondary)" }}>Analyzing alignment...</div>
                    ) : currentScanStatus ? (
                      <div style={{ background: "rgba(0,0,0,0.3)", padding: 10, borderRadius: 8, border: `1px solid ${currentScanStatus.color}44` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Alignment:</span>
                          <span style={{ fontWeight: "bold", color: currentScanStatus.color }}>{currentScanStatus.alignment.toFixed(1)}%</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Status:</span>
                          <span style={{ fontSize: "0.75rem", color: currentScanStatus.color }}>{currentScanStatus.label}</span>
                        </div>
                        <button onClick={() => { setCapturedPhoto(null); setCurrentScanStatus(null); startCamera(); }} style={{ width: "100%", marginTop: 10, padding: 6, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: 6, cursor: "pointer" }}>
                          Retake
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
                <canvas ref={canvasRef} style={{ display: "none" }} />
              </div>
            ) : (
              <div>
                {alignmentLoading ? (
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textAlign: "center" }}>Loading...</div>
                ) : alignmentData.length > 0 ? (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div>
                      <div style={{ fontSize: "1.8rem", fontFamily: "var(--font-heading)", fontWeight: 900, color: COLORS.cyan, lineHeight: 1 }}>
                        {Math.round(alignmentData[0].alignment)}%
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: 4 }}>
                        Latest record: {formatDate(alignmentData[0].captured_at)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.75rem", color: classifyScore(alignmentData[0].alignment).color }}>
                        {classifyScore(alignmentData[0].alignment).label}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textAlign: "center", padding: "10px 0" }}>
                    No calibration records. Click Calibrate to scan.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════
              TOTAL SCORE BANNER
             ═══════════════════════════════════════════════════ */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(0,255,136,0.12), rgba(0,245,255,0.08))",
              border: "1px solid rgba(0,255,136,0.25)",
              borderRadius: 12,
              padding: "16px 14px",
              marginBottom: 14,
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 }}>
              <TrophyOutlined style={{ color: COLORS.gold, fontSize: 22 }} />
              <span style={{ fontFamily: "var(--font-heading)", fontSize: "0.75rem", color: COLORS.gold, letterSpacing: 1, textTransform: "uppercase" }}>
                Total Score
              </span>
            </div>
            <div
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "2.2rem",
                fontWeight: 900,
                color: COLORS.green,
                lineHeight: 1,
                textShadow: "0 0 20px rgba(0,255,136,0.5)",
              }}
            >
              {scoreLoading ? "..." : (total.totalPoints || 0).toLocaleString()}
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: 4 }}>
              points earned across all games
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════
              QUICK STATS ROW
             ═══════════════════════════════════════════════════ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            <div style={statBox}>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.3rem", fontWeight: 800, color: COLORS.cyan }}>
                {total.totalGames || 0}
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)", marginTop: 2 }}>Games</div>
            </div>
            <div style={statBox}>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.3rem", fontWeight: 800, color: COLORS.purple }}>
                {total.bestPoints || 0}
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)", marginTop: 2 }}>Best Score</div>
            </div>
            <div style={statBox}>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.3rem", fontWeight: 800, color: COLORS.orange }}>
                {total.avgPoints || 0}
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)", marginTop: 2 }}>Avg Score</div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════
              TAB SWITCHER: Worm Graph | Game Breakdown
             ═══════════════════════════════════════════════════ */}
          <div style={{ display: "flex", gap: 0, marginBottom: 12, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(0,245,255,0.2)" }}>
            {[
              { key: "worm", label: <><LineChartOutlined /> Score Trend</> },
              { key: "calibration", label: <><EyeOutlined /> Alignment Trend</> },
              { key: "games", label: <><PlayCircleOutlined /> Per Game</> },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-heading)",
                  fontSize: "0.72rem",
                  letterSpacing: 0.5,
                  transition: "all 0.2s",
                  background: activeTab === tab.key ? "rgba(0,245,255,0.15)" : "transparent",
                  color: activeTab === tab.key ? COLORS.cyan : "var(--text-secondary)",
                  borderBottom: activeTab === tab.key ? `2px solid ${COLORS.cyan}` : "2px solid transparent",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ═══════════════════════════════════════════════════
              WORM GRAPH (Score Trend Over Time)
             ═══════════════════════════════════════════════════ */}
          {activeTab === "worm" && (
            <div style={glassCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <LineChartOutlined style={{ color: COLORS.cyan, fontSize: 14 }} />
                <span style={{ fontFamily: "var(--font-heading)", fontSize: "0.75rem", color: COLORS.cyan, letterSpacing: 0.5 }}>
                  DAILY SCORE TREND (LAST 30 DAYS)
                </span>
              </div>

              {scoreLoading ? (
                <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: 20, fontSize: "0.85rem" }}>
                  Loading scores...
                </div>
              ) : dailyTotals.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: 20, fontSize: "0.82rem" }}>
                  No scores recorded yet. Play a game to see your progress!
                </div>
              ) : (
                <>
                  {/* SVG Worm Graph */}
                  <svg
                    width="100%"
                    height="auto"
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    preserveAspectRatio="xMidYMid meet"
                    style={{ display: "block", minHeight: 180 }}
                  >
                    {/* Gradient fill under the worm line */}
                    <defs>
                      <linearGradient id="wormFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.green} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={COLORS.green} stopOpacity="0.02" />
                      </linearGradient>
                      <linearGradient id="orbFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.cyan} stopOpacity="0.2" />
                        <stop offset="100%" stopColor={COLORS.cyan} stopOpacity="0.01" />
                      </linearGradient>
                      <linearGradient id="hoopsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.purple} stopOpacity="0.2" />
                        <stop offset="100%" stopColor={COLORS.purple} stopOpacity="0.01" />
                      </linearGradient>
                    </defs>

                    {/* Y-axis grid lines */}
                    {ySteps.map((pct) => {
                      const val = Math.round(maxPts * pct);
                      const y = pad.top + gH - pct * gH;
                      return (
                        <g key={`yg-${pct}`}>
                          <line
                            x1={pad.left} y1={y}
                            x2={svgWidth - pad.right} y2={y}
                            stroke="rgba(0,245,255,0.08)"
                            strokeWidth="1"
                            strokeDasharray="3,3"
                          />
                          <text
                            x={pad.left - 6} y={y + 3}
                            fontSize="9" fill="rgba(0,245,255,0.4)"
                            textAnchor="end"
                            fontFamily="var(--font-heading)"
                          >
                            {val}
                          </text>
                        </g>
                      );
                    })}

                    {/* Axes */}
                    <line
                      x1={pad.left} y1={pad.top + gH}
                      x2={svgWidth - pad.right} y2={pad.top + gH}
                      stroke="rgba(0,245,255,0.3)" strokeWidth="1.5"
                    />
                    <line
                      x1={pad.left} y1={pad.top}
                      x2={pad.left} y2={pad.top + gH}
                      stroke="rgba(0,245,255,0.3)" strokeWidth="1.5"
                    />

                    {/* Per-game worm lines (behind total) */}
                    {gameNames.map((gn) => {
                      const pts = gameWormLines[gn];
                      if (pts.length < 2) return null;
                      const color = GAME_COLORS[gn] || COLORS.cyan;
                      return (
                        <path
                          key={`game-line-${gn}`}
                          d={smoothPath(pts)}
                          fill="none"
                          stroke={color}
                          strokeWidth="1.5"
                          strokeDasharray="4,3"
                          strokeLinecap="round"
                          opacity="0.5"
                        />
                      );
                    })}

                    {/* Total worm line — filled area */}
                    {wormPoints.length > 1 && (
                      <>
                        <path
                          d={
                            smoothPath(wormPoints) +
                            ` L ${wormPoints[wormPoints.length - 1].x} ${pad.top + gH}` +
                            ` L ${wormPoints[0].x} ${pad.top + gH} Z`
                          }
                          fill="url(#wormFill)"
                        />
                        <path
                          d={smoothPath(wormPoints)}
                          fill="none"
                          stroke={COLORS.green}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          filter="drop-shadow(0 0 4px rgba(0,255,136,0.6))"
                        />
                      </>
                    )}

                    {/* Data points */}
                    {wormPoints.map((p, i) => (
                      <g key={`wp-${i}`}>
                        <circle
                          cx={p.x} cy={p.y} r={hoveredPoint === i ? 5 : 3.5}
                          fill={COLORS.green}
                          stroke="#fff"
                          strokeWidth="0.8"
                          style={{ cursor: "pointer", transition: "r 0.2s" }}
                          filter="drop-shadow(0 0 3px rgba(0,255,136,0.7))"
                          onMouseEnter={() => setHoveredPoint(i)}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                        {/* Tooltip on hover */}
                        {hoveredPoint === i && (
                          <>
                            <rect
                              x={p.x - 32} y={p.y - 30}
                              width={64} height={20}
                              rx={4}
                              fill="rgba(0,0,0,0.85)"
                              stroke={COLORS.green}
                              strokeWidth="0.5"
                            />
                            <text
                              x={p.x} y={p.y - 17}
                              fontSize="9"
                              fill={COLORS.green}
                              textAnchor="middle"
                              fontFamily="var(--font-heading)"
                              fontWeight="700"
                            >
                              {p.totalPoints} pts
                            </text>
                          </>
                        )}
                      </g>
                    ))}

                    {/* X-axis date labels */}
                    {wormPoints.map((p, i) => {
                      // Show max 8 labels to avoid overlap
                      const showLabel = dailyTotals.length <= 8 || i % Math.ceil(dailyTotals.length / 7) === 0 || i === dailyTotals.length - 1;
                      if (!showLabel) return null;
                      return (
                        <text
                          key={`xl-${i}`}
                          x={p.x}
                          y={svgHeight - 6}
                          fontSize="8"
                          fill="rgba(0,245,255,0.5)"
                          textAnchor="middle"
                          fontFamily="var(--font-heading)"
                        >
                          {formatDate(p.date)}
                        </text>
                      );
                    })}
                  </svg>

                  {/* Legend */}
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 14, height: 3, background: COLORS.green, borderRadius: 2 }} />
                      <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>Total</span>
                    </div>
                    {gameNames.map((gn) => (
                      <div key={gn} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 14, height: 2, background: GAME_COLORS[gn] || COLORS.cyan, borderRadius: 2, borderTop: "1px dashed " + (GAME_COLORS[gn] || COLORS.cyan) }} />
                        <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>{GAME_LABELS[gn] || gn}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════
              PER-GAME BREAKDOWN TAB
             ═══════════════════════════════════════════════════ */}
          {activeTab === "games" && (
            <div style={glassCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <TrophyOutlined style={{ color: COLORS.gold, fontSize: 14 }} />
                <span style={{ fontFamily: "var(--font-heading)", fontSize: "0.75rem", color: COLORS.gold, letterSpacing: 0.5 }}>
                  GAME-WISE SCORES
                </span>
              </div>

              {scoreLoading ? (
                <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: 20, fontSize: "0.85rem" }}>
                  Loading...
                </div>
              ) : perGame.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: 20, fontSize: "0.82rem" }}>
                  No game data yet. Complete a game to see stats!
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {perGame.map((g, i) => {
                    const color = GAME_COLORS[g.gameName] || COLORS.cyan;
                    return (
                      <div
                        key={i}
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          border: `1px solid ${color}22`,
                          borderRadius: 8,
                          padding: "10px 12px",
                          borderLeft: `3px solid ${color}`,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontFamily: "var(--font-heading)", fontSize: "0.8rem", color, fontWeight: 700 }}>
                            {GAME_LABELS[g.gameName] || g.gameName}
                          </span>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                            <span style={{ color: { beginner: '#00ff88', intermediate: '#ffcc00', advanced: '#ff4444' }[g.difficulty] || '#888' }}>●</span> {g.difficulty}
                          </span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                          {[
                            { label: "Played", val: g.gamesPlayed },
                            { label: "Total", val: g.totalPoints },
                            { label: "Best", val: g.bestPoints, highlight: true },
                            { label: "Best Time", val: `${g.bestTime}s` },
                          ].map((s) => (
                            <div key={s.label} style={{ textAlign: "center" }}>
                              <div style={{
                                fontFamily: "var(--font-heading)",
                                fontSize: s.highlight ? "0.85rem" : "0.78rem",
                                fontWeight: 700,
                                color: s.highlight ? COLORS.gold : "#fff",
                              }}>
                                {s.val}
                              </div>
                              <div style={{ fontSize: "0.58rem", color: "var(--text-secondary)", marginTop: 1 }}>
                                {s.label}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════
              CALIBRATION WORM GRAPH (Alignment Trend Over Time)
             ═══════════════════════════════════════════════════ */}
          {activeTab === "calibration" && (
            <div style={glassCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <EyeOutlined style={{ color: COLORS.cyan, fontSize: 14 }} />
                <span style={{ fontFamily: "var(--font-heading)", fontSize: "0.75rem", color: COLORS.cyan, letterSpacing: 0.5 }}>
                  EYE ALIGNMENT TREND
                </span>
              </div>

              {alignmentLoading ? (
                <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: 20, fontSize: "0.85rem" }}>
                  Loading calibration history...
                </div>
              ) : alignmentData.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: 20, fontSize: "0.82rem" }}>
                  No calibration history available.
                </div>
              ) : (
                (() => {
                  const calibrationPoints = [...alignmentData].reverse().map((d, i) => {
                    const x = pad.left + (alignmentData.length > 1 ? (i / (alignmentData.length - 1)) * gW : gW / 2);
                    const y = pad.top + gH - (d.alignment / 100) * gH;
                    return { x, y, ...d };
                  });

                  return (
                    <svg
                      width="100%"
                      height="auto"
                      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                      preserveAspectRatio="xMidYMid meet"
                      style={{ display: "block", minHeight: 180 }}
                    >
                      <defs>
                        <linearGradient id="calibFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={COLORS.cyan} stopOpacity="0.3" />
                          <stop offset="100%" stopColor={COLORS.cyan} stopOpacity="0.02" />
                        </linearGradient>
                      </defs>

                      {ySteps.map((pct) => {
                        const val = Math.round(100 * pct);
                        const y = pad.top + gH - pct * gH;
                        return (
                          <g key={`yg-calib-${pct}`}>
                            <line
                              x1={pad.left} y1={y}
                              x2={svgWidth - pad.right} y2={y}
                              stroke="rgba(0,245,255,0.08)"
                              strokeWidth="1"
                              strokeDasharray="3,3"
                            />
                            <text
                              x={pad.left - 6} y={y + 3}
                              fontSize="9" fill="rgba(0,245,255,0.4)"
                              textAnchor="end"
                              fontFamily="var(--font-heading)"
                            >
                              {val}%
                            </text>
                          </g>
                        );
                      })}

                      <line x1={pad.left} y1={pad.top + gH} x2={svgWidth - pad.right} y2={pad.top + gH} stroke="rgba(0,245,255,0.3)" strokeWidth="1.5" />
                      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + gH} stroke="rgba(0,245,255,0.3)" strokeWidth="1.5" />

                      {calibrationPoints.length > 1 && (
                        <>
                          <path
                            d={
                              smoothPath(calibrationPoints) +
                              ` L ${calibrationPoints[calibrationPoints.length - 1].x} ${pad.top + gH}` +
                              ` L ${calibrationPoints[0].x} ${pad.top + gH} Z`
                            }
                            fill="url(#calibFill)"
                          />
                          <path
                            d={smoothPath(calibrationPoints)}
                            fill="none"
                            stroke={COLORS.cyan}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            filter="drop-shadow(0 0 4px rgba(0,245,255,0.6))"
                          />
                        </>
                      )}

                      {calibrationPoints.map((p, i) => (
                        <g key={`cp-${i}`}>
                          <circle
                            cx={p.x} cy={p.y} r={hoveredPoint === `calib-${i}` ? 5 : 3.5}
                            fill={COLORS.cyan}
                            stroke="#fff"
                            strokeWidth="0.8"
                            style={{ cursor: "pointer", transition: "r 0.2s" }}
                            filter="drop-shadow(0 0 3px rgba(0,245,255,0.7))"
                            onMouseEnter={() => setHoveredPoint(`calib-${i}`)}
                            onMouseLeave={() => setHoveredPoint(null)}
                          />
                          {hoveredPoint === `calib-${i}` && (
                            <>
                              <rect
                                x={Math.max(pad.left, p.x - 32)} y={p.y - 30}
                                width={64} height={20}
                                rx={4}
                                fill="rgba(0,0,0,0.85)"
                                stroke={COLORS.cyan}
                                strokeWidth="0.5"
                              />
                              <text
                                x={Math.max(pad.left + 32, p.x)} y={p.y - 17}
                                fontSize="9"
                                fill={COLORS.cyan}
                                textAnchor="middle"
                                fontFamily="var(--font-heading)"
                                fontWeight="700"
                              >
                                {p.alignment.toFixed(1)}%
                              </text>
                            </>
                          )}
                        </g>
                      ))}

                      {calibrationPoints.map((p, i) => {
                        const showLabel = calibrationPoints.length <= 8 || i % Math.ceil(calibrationPoints.length / 7) === 0 || i === calibrationPoints.length - 1;
                        if (!showLabel) return null;
                        return (
                          <text
                            key={`xl-calib-${i}`}
                            x={p.x}
                            y={svgHeight - 6}
                            fontSize="8"
                            fill="rgba(0,245,255,0.5)"
                            textAnchor="middle"
                            fontFamily="var(--font-heading)"
                          >
                            {formatDate(p.captured_at)}
                          </text>
                        );
                      })}
                    </svg>
                  );
                })()
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════
              WEEKLY STREAK (existing feature, kept)
             ═══════════════════════════════════════════════════ */}
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
                width: 70,
                height: 70,
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
                  fontSize: "1.8rem",
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
                fontSize: "1.3rem",
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

          {/* Action Buttons */}
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
