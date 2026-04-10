import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/FusionHoops.css";
import {
  startCrowdAmbience,
  stopCrowdAmbience,
  playWhistle,
  playCloseShot,
  playMiss,
  playLevelUp,
  playBuzzer,
  playBallBounce,
} from "./FusionHoopsAudio";
import { recordDailyPracticeScore } from "../utils/weeklyProgress";

/* ---- court / level config ---- */
const COURTS = [
  { name: "OPEN COURT", rimMove: 0, holdReq: 2.0, zone: 8, defenders: 2 },
  { name: "STREET BALL", rimMove: 1, holdReq: 1.6, zone: 7, defenders: 3 },
  { name: "PRO ARENA", rimMove: 2, holdReq: 1.2, zone: 6, defenders: 4 },
];

/* Base positions for up to 4 defenders (% based on court floor) */
const DEF_BASE = [
  { x: 72, y: 30, num: "5", speed: 0.6, rx: 10, ry: 6 },
  { x: 45, y: 22, num: "10", speed: 0.45, rx: 12, ry: 5 },
  { x: 28, y: 34, num: "14", speed: 0.55, rx: 8, ry: 8 },
  { x: 58, y: 40, num: "21", speed: 0.7, rx: 14, ry: 4 },
];

const GAME_TIME = 90;

/* ---- crowd rows ---- */
const CROWD_ROWS = [
  Array.from({ length: 28 }, (_, i) => ({ id: `r0-${i}`, left: 2 + i * 3.5, top: 12 + Math.random() * 8, color: ["#ef4444", "#3b82f6", "#22c55e", "#facc15", "#a855f7", "#f97316", "#ec4899", "#14b8a6", "#ffffff", "#64748b"][i % 10], size: 5 + Math.random() * 3, delay: Math.random() * 3 })),
  Array.from({ length: 32 }, (_, i) => ({ id: `r1-${i}`, left: 1 + i * 3.1, top: 28 + Math.random() * 8, color: ["#ef4444", "#3b82f6", "#22c55e", "#facc15", "#a855f7", "#f97316", "#ec4899", "#14b8a6", "#ffffff", "#64748b"][(i + 3) % 10], size: 5 + Math.random() * 3, delay: Math.random() * 3 })),
  Array.from({ length: 36 }, (_, i) => ({ id: `r2-${i}`, left: 0 + i * 2.8, top: 44 + Math.random() * 8, color: ["#ef4444", "#3b82f6", "#22c55e", "#facc15", "#a855f7", "#f97316", "#ec4899", "#14b8a6", "#ffffff", "#64748b"][(i + 5) % 10], size: 5 + Math.random() * 4, delay: Math.random() * 3 })),
];
const CROWD = CROWD_ROWS.flat();

export default function FusionHoops({ onClose, onRunningChange } = {}) {
  const navigate = useNavigate();
  const [courtIdx, setCourtIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [made, setMade] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [stability, setStability] = useState(0);
  const [holdTime, setHoldTime] = useState(0);
  const [rimPos, setRimPos] = useState({ x: 50, y: 38 });
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [endPhase, setEndPhase] = useState("results"); // "celebrate" | "results"
  const [message, setMessage] = useState("AIM AT THE RIM!");
  const [showSplash, setShowSplash] = useState(false);
  const [splashText, setSplashText] = useState("");
  const [fusionPct, setFusionPct] = useState(0);
  const [levelUp, setLevelUp] = useState(null); // { from: string, to: string }

  /* ball throwing state */
  const [ballFlying, setBallFlying] = useState(false);
  const [ballResult, setBallResult] = useState(""); // "swish" | "close" | "miss"
  const [shooter, setShooter] = useState(0); // which player shoots (0,1,2)

  const mouseInZone = useRef(false);
  const sessionLoggedRef = useRef(false);
  const holdRef = useRef(0);
  const moveRef = useRef(0);
  const defTimer = useRef(0);
  const court = COURTS[courtIdx];

  /* ---- defender positions (animated) ---- */
  const [defPositions, setDefPositions] = useState(() =>
    DEF_BASE.map((d) => ({ x: d.x, y: d.y }))
  );

  const rimLabel = rimPos.x < 40 ? "LEFT" : rimPos.x > 60 ? "RIGHT" : "CENTER";

  const startGame = () => {
    setGameStarted(true);
    if (onRunningChange) onRunningChange(true);
    setScore(0);
    setTimeLeft(GAME_TIME);
    setMade(0);
    setAttempts(0);
    setStability(0);
    setHoldTime(0);
    setGameOver(false);
    setEndPhase("results");
    setFusionPct(0);
    setLevelUp(null);
    setBallFlying(false);
    setBallResult("");
    setShooter(0);
    sessionLoggedRef.current = false;
    holdRef.current = 0;
    moveRef.current = 0;
    setRimPos({ x: 50, y: 38 });
    setMessage("AIM AT THE RIM!");
    startCrowdAmbience();
  };

  const exitToMenu = useCallback(() => {
    stopCrowdAmbience();
    if (onRunningChange) onRunningChange(false);
    if (onClose) onClose();
    else navigate("/dashboard", { replace: true });
  }, [onClose, navigate, onRunningChange]);

  /* ---- stop ambience on unmount ---- */
  useEffect(() => {
    return () => stopCrowdAmbience();
  }, []);

  /* ---- end-of-game popup phase ---- */
  useEffect(() => {
    if (!gameOver) return;

    if (!sessionLoggedRef.current) {
      const accuracy = attempts > 0 ? (made / attempts) * 100 : 0;
      const scoreNormalized = Math.min(100, score / 8);
      const practiceScore = Math.round(accuracy * 0.65 + scoreNormalized * 0.35);

      recordDailyPracticeScore({
        userId: window.localStorage.getItem("userId"),
        gameId: "fusion-hoops",
        score: practiceScore,
      });

      sessionLoggedRef.current = true;
    }

    if (onRunningChange) onRunningChange(false);
    playBuzzer();
    setEndPhase("celebrate");
    const t = setTimeout(() => setEndPhase("results"), 1200);
    return () => clearTimeout(t);
  }, [attempts, gameOver, made, onRunningChange, score]);

  /* ---- timer ---- */
  useEffect(() => {
    if (!gameStarted || gameOver) return;
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { setGameOver(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [gameStarted, gameOver]);

  /* ---- rim movement ---- */
  useEffect(() => {
    if (!gameStarted || court.rimMove === 0) return;
    const iv = setInterval(() => {
      moveRef.current += 0.04 * court.rimMove;
      setRimPos({
        x: 50 + Math.sin(moveRef.current) * 14,
        y: 38 + Math.cos(moveRef.current * 0.5) * 4,
      });
    }, 30);
    return () => clearInterval(iv);
  }, [gameStarted, courtIdx]);

  /* ---- defender movement loop ---- */
  useEffect(() => {
    if (!gameStarted || gameOver) return;
    const count = court.defenders;
    const speedMul = 1 + courtIdx * 0.35; // faster each level
    const iv = setInterval(() => {
      defTimer.current += 0.04;
      const t = defTimer.current;
      setDefPositions(
        DEF_BASE.slice(0, count).map((d, i) => {
          const phase = i * 1.7; // offset each defender
          return {
            x: d.x + Math.sin(t * d.speed * speedMul + phase) * d.rx,
            y: d.y + Math.cos(t * d.speed * speedMul * 0.8 + phase + 0.5) * d.ry,
          };
        })
      );
    }, 30);
    return () => clearInterval(iv);
  }, [gameStarted, gameOver, courtIdx, court.defenders]);

  /* ---- fusion loop ---- */
  useEffect(() => {
    if (!gameStarted || gameOver) return;
    const loop = setInterval(() => {
      if (mouseInZone.current) {
        holdRef.current += 0.05;
        setStability((s) => Math.min(100, s + 2.5));
      } else {
        holdRef.current = Math.max(0, holdRef.current - 0.03);
        setStability((s) => Math.max(0, s - 3));
      }
      setHoldTime(holdRef.current);
      setFusionPct(Math.min(100, (holdRef.current / court.holdReq) * 100));
    }, 50);
    return () => clearInterval(loop);
  }, [gameStarted, gameOver, courtIdx]);

  /* ---- mouse tracking (only when NOT using pupil control) ---- */
  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const dx = x - rimPos.x;
    const dy = y - (rimPos.y - 5);
    const dist = Math.sqrt(dx * dx + dy * dy);
    mouseInZone.current = dist < court.zone;
  }, [rimPos, court.zone]);

  // face_cursor.py drives the OS cursor directly via pyautogui,
  // so handleMouseMove fires naturally — no manual gaze mapping needed.

  /* ---- shoot ---- */
  const shoot = () => {
    if (!gameStarted || gameOver || ballFlying || levelUp) return;

    setAttempts((a) => a + 1);
    setShooter((s) => (s + 1) % 3);

    let result;
    if (holdTime >= court.holdReq) {
      result = "swish";
      const pts = Math.round((stability / 100) * 120);
      setScore((s) => s + pts);
      setMade((m) => m + 1);
      setSplashText(`SWISH! +${pts}`);
      setMessage("PERFECT SHOT!");
    } else if (holdTime >= court.holdReq * 0.5) {
      result = "close";
      const pts = Math.round((stability / 100) * 40);
      setScore((s) => s + pts);
      setSplashText(`CLOSE! +${pts}`);
      setMessage("ALMOST — HOLD LONGER");
    } else {
      result = "miss";
      setSplashText("MISS!");
      setMessage("MISSED — FOCUS ON RIM");
    }

    // Play ball release sound
    playBallBounce();

    // Play result sound after ball reaches rim (~500ms)
    setTimeout(() => {
      if (result === "swish") playWhistle();
      else if (result === "close") playCloseShot();
      else playMiss();
    }, 450);

    setBallResult(result);
    setBallFlying(true);
    setShowSplash(false);

    // Reset focus completely after every shot so player refocuses fresh
    holdRef.current = 0;
    mouseInZone.current = false;
    setHoldTime(0);
    setStability(0);
    setFusionPct(0);

    // Show splash after ball reaches rim
    setTimeout(() => {
      setShowSplash(true);
    }, 500);

    // Reset ball
    setTimeout(() => {
      setBallFlying(false);
      setBallResult("");
      setShowSplash(false);
      setMessage("AIM AT THE RIM!");
    }, 1400);

    // auto-level-up
    if (score > 250 * (courtIdx + 1) && courtIdx < COURTS.length - 1) {
      const fromName = COURTS[courtIdx].name;
      const toName = COURTS[courtIdx + 1].name;
      setLevelUp({ from: fromName, to: toName });
      playLevelUp();
      setTimeout(() => {
        setCourtIdx((c) => c + 1);
        setTimeout(() => setLevelUp(null), 2200);
      }, 800);
    }
  };

  const nextCourt = () => setCourtIdx((c) => (c + 1) % COURTS.length);

  /* player positions for ball origin */
  const PLAYER_POS = [
    { x: 22, y: 70 },  // p1
    { x: 40, y: 85 },  // p2
    { x: 65, y: 85 },  // p3
  ];

  /* ============ START SCREEN ============ */
  if (!gameStarted) {
    return (
      <div className="fh-start-screen">
        <div className="fh-start-glow one" />
        <div className="fh-start-glow two" />
        <div className="fh-start-content">
          <div className="fh-start-icon">🏀</div>
          <h1 className="fh-start-title">FUSION HOOPS</h1>
          <p className="fh-start-sub">Focus your eyes on the rim. Build fusion. Shoot!</p>
          <button className="fh-start-btn" onClick={startGame}>▶ START GAME</button>
          <button className="fh-back-btn" onClick={exitToMenu}>← BACK</button>
        </div>
      </div>
    );
  }

  /* ============ GAME OVER ============ */
  if (gameOver) {
    const pct = attempts > 0 ? Math.round((made / attempts) * 100) : 0;
    return (
      <div className="fh-end-screen" onClick={() => endPhase === "celebrate" && setEndPhase("results")}>
        {endPhase === "celebrate" ? (
          <div className="fh-end-pop" role="dialog" aria-label="Game finished">
            <div className="fh-end-pop-icon" aria-hidden="true">🏀</div>
            <div className="fh-end-pop-title">BUZZER!</div>
            <div className="fh-end-pop-sub">Final stats coming up…</div>
            <button className="fh-end-pop-skip" onClick={(e) => { e.stopPropagation(); setEndPhase("results"); }}>SHOW RESULTS</button>
          </div>
        ) : (
          <div className="fh-end-card" role="dialog" aria-label="Game over results">
            <div className="fh-end-icon">🏀</div>
            <h1 className="fh-end-title">GAME OVER</h1>
            <div className="fh-end-stats">
              <div className="fh-end-stat"><span className="fh-end-label">SCORE</span><span className="fh-end-val">{score}</span></div>
              <div className="fh-end-stat"><span className="fh-end-label">MADE</span><span className="fh-end-val">{made}/{attempts}</span></div>
              <div className="fh-end-stat"><span className="fh-end-label">ACCURACY</span><span className="fh-end-val">{pct}%</span></div>
              <div className="fh-end-stat"><span className="fh-end-label">COURT</span><span className="fh-end-val">{court.name}</span></div>
            </div>
            <div className="fh-end-btns">
              <button className="fh-start-btn" onClick={startGame}>🔁 PLAY AGAIN</button>
              <button className="fh-back-btn" onClick={exitToMenu}>← BACK</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ============ MAIN GAME ============ */
  return (
    <div className="fh-wrapper" onMouseMove={handleMouseMove} onClick={shoot}
    >

      {/* ---- TOP HUD ---- */}
      <div className="fh-hud">
        <div className="fh-hud-left">
          <span className="fh-hud-logo">🏀</span>
          <span className="fh-hud-name">FUSION HOOPS</span>
          <span className="fh-hud-court" onClick={(e) => { e.stopPropagation(); nextCourt(); }}>{court.name}</span>
        </div>
        <div className="fh-hud-center">
          <div className="fh-hud-stat"><div className="fh-hud-stat-label">SCORE</div><div className="fh-hud-stat-val">{score}</div></div>
          <div className="fh-hud-stat"><div className="fh-hud-stat-label">TIME</div><div className="fh-hud-stat-val">{timeLeft}s</div></div>
          <div className="fh-hud-stat"><div className="fh-hud-stat-label">MADE</div><div className="fh-hud-stat-val">{made}/{attempts}</div></div>
        </div>
        <div className="fh-hud-right">
          <button className="fh-menu-btn" onClick={(e) => { e.stopPropagation(); exitToMenu(); }}>← MENU</button>
        </div>
      </div>

      {/* ---- FUSION PROGRESS BAR ---- */}
      <div className="fh-fusion-topbar">
        <div className="fh-fusion-topfill" style={{ width: `${fusionPct}%` }} />
      </div>

      {/* ---- RIM LABEL ---- */}
      <div className="fh-rim-label">RIM: {rimLabel}</div>

      {/* ---- COURT AREA ---- */}
      <div className="fh-court">

        {/* Arena Lights */}
        <div className="fh-arena-light al1" />
        <div className="fh-arena-light al2" />

        {/* Stadium Seating */}
        <div className="fh-stadium">
          <div className="fh-stadium-tier tier-upper" />
          <div className="fh-stadium-tier tier-lower" />
          <div className="fh-crowd">
            {CROWD.map((d) => (
              <div key={d.id} className="fh-crowd-dot" style={{
                left: `${d.left}%`, top: `${d.top}%`,
                background: d.color,
                width: d.size, height: d.size,
                animationDelay: `${d.delay}s`,
              }} />
            ))}
          </div>
          {/* Scoreboard */}
          <div className="fh-scoreboard">
            <span className="fh-sb-text">HOME {score}</span>
            <span className="fh-sb-divider">|</span>
            <span className="fh-sb-text">Q{courtIdx + 1} {timeLeft}s</span>
          </div>
        </div>

        {/* Backboard + Rim + Net */}
        <div className="fh-backboard-group" style={{ left: `${rimPos.x}%`, top: "20%" }}>
          <div className="fh-backboard">
            <div className="fh-backboard-inner">
              <div className="fh-backboard-square" />
            </div>
            <div className="fh-fusion-text">{Math.round(fusionPct)}% FUSION</div>
          </div>
          <div className="fh-pole" />
          <div className="fh-rim">
            <div className="fh-rim-ring" />
            {/* Proper chain-style net */}
            <div className="fh-net-container">
              <svg className="fh-net-svg" viewBox="0 0 60 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Outer strings */}
                <path d="M2 0 C4 12, 8 24, 14 40" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" />
                <path d="M10 0 C11 10, 14 22, 18 40" stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
                <path d="M20 0 C20 12, 22 24, 24 42" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
                <path d="M30 0 C30 14, 30 28, 30 46" stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
                <path d="M40 0 C40 12, 38 24, 36 42" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
                <path d="M50 0 C49 10, 46 22, 42 40" stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
                <path d="M58 0 C56 12, 52 24, 46 40" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" />
                {/* Cross strings */}
                <path d="M4 8 Q15 12, 30 10 Q45 8, 56 10" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
                <path d="M8 18 Q18 22, 30 20 Q42 18, 52 20" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
                <path d="M12 28 Q20 32, 30 30 Q40 28, 48 30" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
                <path d="M16 38 Q22 42, 30 40 Q38 38, 44 40" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
              </svg>
            </div>
          </div>
        </div>

        {/* Court Floor - Official Hardwood */}
        <div className="fh-floor">
          {/* Hardwood planks */}
          <div className="fh-hardwood" />

          {/* Official court lines */}
          <div className="fh-floor-lines">
            <div className="fh-sideline fh-sideline--left" />
            <div className="fh-sideline fh-sideline--right" />
            <div className="fh-baseline" />
            <div className="fh-baseline fh-baseline--bottom" />
            <div className="fh-three-point" />
            <div className="fh-free-throw-circle" />
            <div className="fh-key" />
            <div className="fh-key-block kb1" />
            <div className="fh-key-block kb2" />
            <div className="fh-key-block kb3" />
            <div className="fh-key-block kb4" />
            <div className="fh-center-circle" />
            <div className="fh-restricted-arc" />
          </div>

          {/* Player 1 - Shooter */}
          <div className={`fh-player p1 ${ballFlying && shooter === 0 ? "fh-player--shooting" : ""}`}>
            <div className="fh-player-arm-left" />
            <div className="fh-player-arm-right" />
            <div className="fh-player-body" />
            <div className="fh-player-num">23</div>
            <div className="fh-player-shorts" />
            <div className="fh-player-legs" />
            {!ballFlying && shooter === 0 && <div className="fh-ball-held" />}
          </div>

          {/* Player 2 */}
          <div className={`fh-player p2 ${ballFlying && shooter === 1 ? "fh-player--shooting" : ""}`}>
            <div className="fh-player-arm-left" />
            <div className="fh-player-arm-right" />
            <div className="fh-player-body" />
            <div className="fh-player-num">7</div>
            <div className="fh-player-shorts" />
            <div className="fh-player-legs" />
            {!ballFlying && shooter === 1 && <div className="fh-ball-held" />}
          </div>

          {/* Player 3 */}
          <div className={`fh-player p3 ${ballFlying && shooter === 2 ? "fh-player--shooting" : ""}`}>
            <div className="fh-player-arm-left" />
            <div className="fh-player-arm-right" />
            <div className="fh-player-body" />
            <div className="fh-player-num">11</div>
            <div className="fh-player-shorts" />
            <div className="fh-player-legs" />
            {!ballFlying && shooter === 2 && <div className="fh-ball-held" />}
          </div>

          {/* Opponent players — dynamic per level */}
          {DEF_BASE.slice(0, court.defenders).map((def, i) => (
            <div
              key={`def-${i}`}
              className="fh-player fh-opponent fh-defender-moving"
              style={{
                bottom: `${defPositions[i]?.y ?? def.y}%`,
                left: `${defPositions[i]?.x ?? def.x}%`,
                transform: "translateX(-50%)",
              }}
            >
              <div className="fh-player-arm-left" />
              <div className="fh-player-arm-right" />
              <div className="fh-player-body" />
              <div className="fh-player-num">{def.num}</div>
              <div className="fh-player-shorts" />
              <div className="fh-player-legs" />
            </div>
          ))}
        </div>

        {/* Flying ball */}
        {ballFlying && (
          <div
            className={`fh-flying-ball fh-flying-ball--${ballResult}`}
            style={{
              "--startX": `${PLAYER_POS[shooter].x}%`,
              "--startY": `${PLAYER_POS[shooter].y}%`,
              "--endX": `${rimPos.x}%`,
              "--endY": `${rimPos.y + 8}%`,
            }}
          />
        )}

        {/* Splash text */}
        {showSplash && <div className="fh-splash">{splashText}</div>}

        {/* Sidebars */}
        <div className="fh-sidebar fh-sidebar--left">
          <div className="fh-sidebar-label">FUSION</div>
          <div className="fh-sidebar-track">
            <div className="fh-sidebar-fill fh-sidebar-fill--fusion" style={{ height: `${fusionPct}%` }} />
          </div>
        </div>
        <div className="fh-sidebar fh-sidebar--right">
          <div className="fh-sidebar-label">HOLD</div>
          <div className="fh-sidebar-track">
            <div className="fh-sidebar-fill fh-sidebar-fill--hold" style={{ height: `${(holdTime / court.holdReq) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="fh-bottom">
        <div className="fh-court-dots">
          {COURTS.map((_, i) => (
            <div key={i} className={`fh-court-dot ${i === courtIdx ? 'active' : ''}`} />
          ))}
          <div className="fh-court-name">{court.name}</div>
        </div>
        <div className="fh-message" style={{ color: showSplash ? "#00ff88" : "#00f5ff" }}>
          {message}
        </div>
      </div>

      {/* Level up popup */}
      {levelUp && (
        <div style={{
          position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 50, pointerEvents: "none"
        }}>
          <div style={{
            background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
            border: "2px solid #a855f7", borderRadius: 12, padding: "28px 40px",
            textAlign: "center", animation: "fhPopIn 0.3s ease-out"
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⬆️</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#a855f7", marginBottom: 4 }}>
              LEVEL UP!
            </div>
            <div style={{ color: "#00f5ff", fontSize: 14, marginBottom: 12 }}>
              {levelUp.from} → {levelUp.to}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}