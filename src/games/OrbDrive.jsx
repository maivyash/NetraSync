import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import "../styles/orbdrive.css";
import carImg from "../assets/car.png";
import {
  startEngine,
  updateEngine,
  stopEngine,
  startWind,
  updateWind,
  stopWind,
  playNitroBoost,
  playCountdownBeep,
  playFinish,
  playWarning,
  playTireScreech,
  checkGearShift,
  resetGears,
  stopAll,
} from "./orbDriveAudio";
import { recordDailyPracticeScore } from "../utils/weeklyProgress";
import { submitScore } from "../utils/scoreApi";

const BASE_SPEED = 200;
const MAX_SPEED = 220;
const ALIGNMENT_THRESHOLD = 25;
const MFCT_THRESHOLD = 45;

const CAR_START_BOTTOM_PCT = 6;
const CAR_TRAVEL_PCT = 78;

const MODES = {
  beginner: {
    key: "beginner",
    label: "Beginner",
    desc: "Slower tunnel • Larger orb • Hold 2–3s",
    holdSeconds: 2.5,
    orbBaseSize: 88,
    orbMinSize: 88,
    tunnelBaseMul: 0.65,
    tunnelAccelPerSec: 0,
    depthWarp: 0,
    shiftEverySec: 0,
    trackLength: 1000,
    turns: [],
  },
  intermediate: {
    key: "intermediate",
    label: "Intermediate",
    desc: "Faster tunnel • Orb shrinks • Depth movement • Hold 4–5s",
    holdSeconds: 4.5,
    orbBaseSize: 80,
    orbMinSize: 60,
    tunnelBaseMul: 1.0,
    tunnelAccelPerSec: 0.02,
    depthWarp: 1,
    shiftEverySec: 0,
    trackLength: 1500,
    turns: [{ at: 0.33, dir: 1 }, { at: 0.66, dir: -1 }],
  },
  advanced: {
    key: "advanced",
    label: "Advanced",
    desc: "Rapid acceleration • Small orb • Sudden shifts • Hold 6–8s",
    holdSeconds: 7.0,
    orbBaseSize: 60,
    orbMinSize: 50,
    tunnelBaseMul: 1.15,
    tunnelAccelPerSec: 0.06,
    depthWarp: 1,
    shiftEverySec: 2.2,
    trackLength: 2000,
    turns: [{ at: 0.25, dir: -1 }, { at: 0.5, dir: 1 }, { at: 0.75, dir: -1 }],
  },
};

const formatRaceTime = (seconds) => {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  const mm = String(m).padStart(2, "0");
  const ss = s.toFixed(2).padStart(5, "0");
  return `${mm}:${ss}`;
};

export default function OrbDrive({ onClose, onExit, onRunningChange } = {}) {
  const navigate = useNavigate();

  const exitToMenu = () => {
    stopAll();
    if (onClose) {
      onClose();
    } else if (onExit) {
      onExit();
    } else {
      navigate("/dashboard", { replace: true });
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => stopAll();
  }, []);

  const areaRef = useRef(null);
  const orbPanelRef = useRef(null);
  const playerCarRef = useRef(null);
  const finishLineRef = useRef(null);
  const animationRef = useRef(null);
  const lastTimeRef = useRef(null);
  const mouseRef = useRef({ x: 50, y: 50 });
  const angleRef = useRef(0);
  const lowAlignRef = useRef(0);
  const lowMfctRef = useRef(0);
  const speedRef = useRef(0);
  const stabilityRef = useRef(0);
  const progressRef = useRef(0);
  const endedRef = useRef(false);
  const timeRef = useRef(0);
  const raceStatsRef = useRef({ sumAlign: 0, sumFs: 0, count: 0, maxSpeed: 0 });
  const prevCarFrontYRef = useRef(null);
  const jitterRef = useRef({ lastX: 50, lastY: 50, ema: 0 });
  const shiftRef = useRef({ nextAt: 0, offX: 0, offY: 0 });

  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | mode | ready | countdown | running | result | resetting
  const [modeKey, setModeKey] = useState("beginner");
  const [countdown, setCountdown] = useState(null);
  const [orbPos, setOrbPos] = useState({ x: 50, y: 50 });
  const [alignment, setAlignment] = useState(0);
  const [stability, setStability] = useState(0);
  const [focusStrength, setFocusStrength] = useState(0);
  const [carSpeed, setCarSpeed] = useState(0);
  const [progress, setProgress] = useState(0);
  const [time, setTime] = useState(0);
  const [warning, setWarning] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [raceResult, setRaceResult] = useState(null);
  const [resetting, setResetting] = useState(false);

  const speedPct = Math.max(0, Math.min(1, carSpeed / MAX_SPEED));
  const carBottomPct = CAR_START_BOTTOM_PCT + progress * CAR_TRAVEL_PCT;
  // Keep the PNG car crisp: avoid heavy down-scaling as progress increases.
  const carScale = Math.max(0.85, 1 - progress * 0.15);

  const mode = MODES[modeKey] ?? MODES.beginner;
  const holdPct = Math.max(0, Math.min(1, stability / mode.holdSeconds));
  const canDrive = holdPct >= 1;

  const orbSize = (() => {
    if (modeKey === "intermediate") {
      const shrink = Math.min(1, time / 24);
      return mode.orbBaseSize - (mode.orbBaseSize - mode.orbMinSize) * shrink;
    }
    return mode.orbBaseSize;
  })();

  const handleMouseMove = (e) => {
    if (!orbPanelRef.current) return;
    const rect = orbPanelRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    mouseRef.current = {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  };

  const startGame = () => {
    setRunning(true);
    setPhase("running");
    if (onRunningChange) onRunningChange(true);
    setProgress(0);
    setTime(0);
    setAlignment(0);
    setStability(0);
    setFocusStrength(0);
    setCarSpeed(0);
    setWarning(false);
    setIsFocused(false);
    setResultOpen(false);
    setRaceResult(null);
    setResetting(false);

    angleRef.current = 0;
    lowAlignRef.current = 0;
    lowMfctRef.current = 0;
    speedRef.current = 0;
    stabilityRef.current = 0;
    lastTimeRef.current = null;
    progressRef.current = 0;
    endedRef.current = false;
    timeRef.current = 0;
    raceStatsRef.current = { sumAlign: 0, sumFs: 0, count: 0, maxSpeed: 0 };
    prevCarFrontYRef.current = null;
    jitterRef.current = { lastX: mouseRef.current.x, lastY: mouseRef.current.y, ema: 0 };
    shiftRef.current = { nextAt: 0, offX: 0, offY: 0 };

    // Start engine + wind audio
    resetGears();
    startEngine();
    startWind();
  };

  const resetRace = () => {
    cancelAnimationFrame(animationRef.current);
    playTireScreech();
    stopEngine();
    stopWind();
    setRunning(false);
    setPhase("resetting"); // dedicated phase — no overlap
    if (onRunningChange) onRunningChange(false);
    setCountdown(null);
    setResetting(true);
    setResultOpen(false);
    setRaceResult(null);
    setProgress(0);
    setTime(0);
    setAlignment(0);
    setStability(0);
    setFocusStrength(0);
    setCarSpeed(0);
    setWarning(false);
    setIsFocused(false);

    angleRef.current = 0;
    lowAlignRef.current = 0;
    lowMfctRef.current = 0;
    speedRef.current = 0;
    stabilityRef.current = 0;
    lastTimeRef.current = null;
    progressRef.current = 0;
    endedRef.current = false;
    timeRef.current = 0;
    raceStatsRef.current = { sumAlign: 0, sumFs: 0, count: 0, maxSpeed: 0 };
    prevCarFrontYRef.current = null;
  };

  const resetForReplay = () => {
    cancelAnimationFrame(animationRef.current);
    stopAll();
    setRunning(false);
    setCountdown(null);
    setResetting(false);

    setProgress(0);
    setTime(0);
    setAlignment(0);
    setStability(0);
    setFocusStrength(0);
    setCarSpeed(0);
    setWarning(false);
    setIsFocused(false);

    angleRef.current = 0;
    lowAlignRef.current = 0;
    lowMfctRef.current = 0;
    speedRef.current = 0;
    stabilityRef.current = 0;
    lastTimeRef.current = null;
    progressRef.current = 0;
    endedRef.current = false;
    timeRef.current = 0;
    raceStatsRef.current = { sumAlign: 0, sumFs: 0, count: 0, maxSpeed: 0 };
    prevCarFrontYRef.current = null;
    jitterRef.current = { lastX: mouseRef.current.x, lastY: mouseRef.current.y, ema: 0 };
    shiftRef.current = { nextAt: 0, offX: 0, offY: 0 };
  };

  const triggerWin = () => {
    if (endedRef.current) return;
    endedRef.current = true;

    playFinish();
    // Gradually stop engine/wind (playFinish handles engine wind-down)
    setTimeout(() => { stopEngine(); stopWind(); }, 2000);

    setRunning(false);
    setPhase("result");
    if (onRunningChange) onRunningChange(false);

    const count = Math.max(1, raceStatsRef.current.count);
    const avgAlign = raceStatsRef.current.sumAlign / count;
    const avgFs = raceStatsRef.current.sumFs / count;
    const bonusPct = Math.max(0, Math.min(20, Math.round(avgFs * 20)));
    const maxSpd = Math.round(raceStatsRef.current.maxSpeed);
    const raceTimeSec = timeRef.current;

    const practiceScore = Math.round(
      Math.max(
        0,
        Math.min(100, avgAlign * 0.65 + bonusPct * 1.2 + (maxSpd / MAX_SPEED) * 35)
      )
    );

    const bestKey = `orbdrive_best_${modeKey}`;
    const prevBest = Number.parseFloat(window.localStorage.getItem(bestKey));
    const bestTimeSec =
      Number.isFinite(prevBest) && prevBest > 0
        ? Math.min(prevBest, raceTimeSec)
        : raceTimeSec;
    window.localStorage.setItem(bestKey, String(bestTimeSec));

    recordDailyPracticeScore({
      userId: window.localStorage.getItem("userId"),
      gameId: "orb-drive",
      score: practiceScore,
    });

    // ── Submit score to SQL backend ──
    submitScore({
      gameName: "orb-drive",
      difficulty: modeKey,
      timeTaken: raceTimeSec,
      rawScore: practiceScore,
      avgAlignment: avgAlign,
      maxSpeed: maxSpd,
      focusBonus: bonusPct,
    }).then((resp) => {
      if (resp.success) {
        console.log(`✅ Score saved: ${resp.points} pts (×${resp.difficultyMultiplier} ${resp.difficulty})`);
        setRaceResult((prev) => prev ? { ...prev, serverPoints: resp.points } : prev);
      } else {
        console.warn("Score save failed:", resp.error);
      }
    }).catch((err) => console.warn("Score submit error:", err));

    setRaceResult({
      raceTimeSec,
      avgAlignment: avgAlign,
      maxSpeed: maxSpd,
      focusBonusPct: bonusPct,
      trackMeters: mode.trackLength,
      difficulty: mode.label,
      bestTimeSec,
      serverPoints: null, // will be updated async
    });
    setResultOpen(true);

    try {
      confetti({
        particleCount: 140,
        spread: 90,
        startVelocity: 55,
        scalar: 1.05,
        origin: { x: 0.5, y: 0.35 },
      });
      confetti({
        particleCount: 90,
        spread: 130,
        startVelocity: 45,
        scalar: 0.95,
        origin: { x: 0.25, y: 0.45 },
      });
      confetti({
        particleCount: 90,
        spread: 130,
        startVelocity: 45,
        scalar: 0.95,
        origin: { x: 0.75, y: 0.45 },
      });
    } catch {
      // ignore confetti errors (e.g. SSR / unavailable canvas)
    }
  };

  const beginFlow = () => {
    if (resultOpen) return;
    setResetting(false);
    setPhase("mode");
  };

  const selectMode = (key) => {
    setModeKey(key);
    setPhase("ready");
  };

  // Auto-transition from "resetting" → "idle" so the Start button reappears
  useEffect(() => {
    if (phase !== "resetting") return;
    const t = window.setTimeout(() => {
      setResetting(false);
      setPhase("idle");
    }, 2000);
    return () => window.clearTimeout(t);
  }, [phase]);

  const startCountdown = () => {
    setPhase("countdown");
    setCountdown(3);
  };

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown == null) return;

    if (countdown <= 0) {
      playCountdownBeep(0); // GO beep
      setCountdown(null);
      startGame();
      return;
    }

    playCountdownBeep(countdown);
    const t = window.setTimeout(() => setCountdown((c) => (c == null ? null : c - 1)), 900);
    return () => window.clearTimeout(t);
  }, [phase, countdown]);

  useEffect(() => {
    if (!running) return;

    const loop = (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      timeRef.current += dt;
      setTime(timeRef.current);

      // face_cursor.py drives the OS cursor directly via pyautogui,
      // so handleMouseMove fires naturally — no manual gaze mapping needed.

      // Reaction variability (gaze jitter) approximation from pointer jitter.
      const dxm = mouseRef.current.x - jitterRef.current.lastX;
      const dym = mouseRef.current.y - jitterRef.current.lastY;
      jitterRef.current.lastX = mouseRef.current.x;
      jitterRef.current.lastY = mouseRef.current.y;
      const jitterInstant = Math.min(1, Math.sqrt(dxm * dxm + dym * dym) / 12);
      jitterRef.current.ema = jitterRef.current.ema + (jitterInstant - jitterRef.current.ema) * 0.22;

      angleRef.current += dt;
      // Sudden directional shifts (Advanced): move the orbit center.
      if (mode.shiftEverySec > 0) {
        const now = timestamp / 1000;
        if (shiftRef.current.nextAt === 0) {
          shiftRef.current.nextAt = now + mode.shiftEverySec;
        }
        if (now >= shiftRef.current.nextAt) {
          shiftRef.current.nextAt = now + mode.shiftEverySec;
          shiftRef.current.offX = -10 + Math.random() * 20;
          shiftRef.current.offY = -8 + Math.random() * 16;
        }
      } else {
        shiftRef.current.offX = 0;
        shiftRef.current.offY = 0;
      }

      const orbX = 50 + (42 * Math.sin(angleRef.current)) + shiftRef.current.offX;
      const orbY = 50 + (35 * Math.cos(angleRef.current * 1.5)) + shiftRef.current.offY;
      setOrbPos({ x: orbX, y: orbY });

      const dx = mouseRef.current.x - orbX;
      const dy = mouseRef.current.y - orbY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const align = Math.max(0, Math.min(100, (1 - distance / 20) * 100));
      setAlignment(align);

      const focusedNow = align >= ALIGNMENT_THRESHOLD;
      setIsFocused(focusedNow);

      let newStability;
      if (focusedNow) {
        newStability = stabilityRef.current + dt;
      } else {
        newStability = Math.max(0, stabilityRef.current - dt);
      }
      stabilityRef.current = newStability;
      setStability(newStability);

      // Focus Strength (FS) = (Alignment% × StabilityWeight) / ReactionVariability
      const stabilityWeight = Math.min(newStability / mode.holdSeconds, 1);
      const reactionVariability = 1 + jitterRef.current.ema * 1.6;
      const fsRaw = ((align / 100) * stabilityWeight) / reactionVariability;
      const fs = Math.max(0, Math.min(1, fsRaw));
      setFocusStrength(fs);

      raceStatsRef.current.sumAlign += align;
      raceStatsRef.current.sumFs += fs;
      raceStatsRef.current.count += 1;

      // MFCT threshold: below 45% continuously for 3s -> speed penalty + warning.
      // The game should NEVER auto-reset/close — only the player can reset.
      if (align < MFCT_THRESHOLD) {
        lowMfctRef.current += dt;
      } else {
        lowMfctRef.current = 0;
      }

      const low3 = lowMfctRef.current >= 3;
      if (low3 && lowMfctRef.current - dt < 3) playWarning(); // only on first crossing
      setWarning(low3);

      const mappedSpeed = Math.min(MAX_SPEED, BASE_SPEED + fs * 160);
      const forcedSlow = low3 ? 40 : null;

      // Focus-hold requirement: must maintain focus for mode.holdSeconds to fully drive.
      let targetSpeed = 0;
      if (focusedNow) {
        if (stabilityWeight < 1) {
          targetSpeed = BASE_SPEED * Math.max(0.15, stabilityWeight);
        } else {
          targetSpeed = mappedSpeed;
        }
      }

      if (forcedSlow != null) {
        targetSpeed = Math.min(targetSpeed || forcedSlow, forcedSlow);
      }

      speedRef.current += (targetSpeed - speedRef.current) * 0.08;
      setCarSpeed(speedRef.current);

      raceStatsRef.current.maxSpeed = Math.max(
        raceStatsRef.current.maxSpeed,
        speedRef.current
      );

      // Audio: update engine pitch + wind volume + gear shifts
      const currentSpeedPct = Math.max(0, Math.min(1, speedRef.current / 220));
      updateEngine(currentSpeedPct);
      updateWind(currentSpeedPct);
      checkGearShift(currentSpeedPct);

      // Nitro boost sound when full focus achieved
      if (stabilityWeight >= 1 && focusedNow) {
        playNitroBoost();
      }

      // Advance race progress whenever the user is focused.
      // Speed is already scaled by the hold requirement, so gating progress on `canDrive`
      // makes the tunnel appear to move while the car never reaches the finish.
      if (focusedNow && speedRef.current > 1) {
        const nextProgress = Math.min(
          1,
          progressRef.current + ((speedRef.current / 3.6) * dt) / mode.trackLength
        );
        progressRef.current = nextProgress;
        setProgress(nextProgress);

        // Check for DOM-based finish line collision
        const carEl = playerCarRef.current;
        const finishEl = finishLineRef.current;
        if (carEl && finishEl && nextProgress > 0.1) {
          try {
            const carRect = carEl.getBoundingClientRect();
            const finishRect = finishEl.getBoundingClientRect();

            // Car makes exact contact with finish line when its top edge is a bit inside the finish line
            if (carRect.top <= finishRect.bottom - 15 || nextProgress >= 1.0) {
              cancelAnimationFrame(animationRef.current);
              progressRef.current = 1;
              setProgress(1);
              triggerWin();
              return;
            }
          } catch (e) {
            // Ignore errors
          }
        }
      }

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [running]);

  // Compute Turn State
  let turnState = 0;
  if (mode && mode.turns && mode.turns.length > 0) {
    mode.turns.forEach(t => {
      const diff = progress - t.at;
      if (Math.abs(diff) < 0.10) {
        const curve = Math.sin(((diff + 0.10) / 0.20) * Math.PI);
        turnState += curve * t.dir;
      }
    });
  }

  return (
    <div className="orbdrive-wrapper">
      <button
        className="orbdrive-close-btn"
        onClick={exitToMenu}
        title="Exit game"
        type="button"
      >
        ✕
      </button>

      <h3 className="orbdrive-title">🚗 OrbDrive – Focus to Win</h3>
      <div className="orbdrive-sub">YOUR EYES CONTROL THE SPEED</div>

      {resultOpen && raceResult && (
        <div className="orbdrive-resultOverlay" role="dialog" aria-modal="true">
          <div className="orbdrive-resultCard">
            <div className="orbdrive-resultTop">RACE COMPLETE</div>
            <div className="orbdrive-resultTime">{formatRaceTime(raceResult.raceTimeSec)}</div>

            <div className="orbdrive-resultStats" role="list">
              <div className="orbdrive-resultStat">
                <div className="orbdrive-resultLabel">AVG ALIGNMENT</div>
                <div className="orbdrive-resultValue">{raceResult.avgAlignment.toFixed(1)}%</div>
              </div>
              <div className="orbdrive-resultStat">
                <div className="orbdrive-resultLabel">MAX SPEED</div>
                <div className="orbdrive-resultValue">{raceResult.maxSpeed} km/h</div>
              </div>
              <div className="orbdrive-resultStat">
                <div className="orbdrive-resultLabel">FOCUS BONUS</div>
                <div className="orbdrive-resultValue">+{raceResult.focusBonusPct}%</div>
              </div>
              <div className="orbdrive-resultStat">
                <div className="orbdrive-resultLabel">TRACK</div>
                <div className="orbdrive-resultValue">{raceResult.trackMeters}m</div>
              </div>
              <div className="orbdrive-resultStat">
                <div className="orbdrive-resultLabel">DIFFICULTY</div>
                <div className="orbdrive-resultValue">{raceResult.difficulty}</div>
              </div>
              <div className="orbdrive-resultStat">
                <div className="orbdrive-resultLabel">BEST TIME</div>
                <div className="orbdrive-resultValue" style={{ color: '#ffcc00' }}>{formatRaceTime(raceResult.bestTimeSec)}</div>
              </div>
              <div className="orbdrive-resultStat">
                <div className="orbdrive-resultLabel">POINTS EARNED</div>
                <div className="orbdrive-resultValue" style={{ color: '#00ff88', fontSize: '1.3em' }}>
                  {raceResult.serverPoints != null ? `🏆 ${raceResult.serverPoints}` : '⏳'}
                </div>
              </div>
            </div>

            <div className="orbdrive-resultActions">
              <button
                type="button"
                className="orbdrive-resultBtn orbdrive-resultBtn--primary"
                onClick={() => {
                  setResultOpen(false);
                  setRaceResult(null);
                  resetForReplay();
                  setPhase("ready");
                }}
              >
                RACE AGAIN
              </button>
              <button
                type="button"
                className="orbdrive-resultBtn orbdrive-resultBtn--ghost"
                onClick={() => {
                  setResultOpen(false);
                  setRaceResult(null);
                  resetForReplay();
                  setPhase("idle");
                  exitToMenu();
                }}
              >
                MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {!running && phase === "idle" && !resetting && (
        <button className="orbdrive-start-btn" onClick={beginFlow}>
          ▶ Start Race
        </button>
      )}

      {!running && phase === "resetting" && (
        <div className="orbdrive-resetMsg">Race reset — try again!</div>
      )}

      {phase === "mode" && (
        <div className="orbdrive-modeOverlay" role="dialog" aria-modal="true">
          <div className="orbdrive-modeModal">
            <div className="orbdrive-modeTitle">Choose a Mode</div>
            <div className="orbdrive-modeGrid" role="list">
              {Object.values(MODES).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={
                    "orbdrive-modeCard" + (modeKey === m.key ? " is-selected" : "")
                  }
                  onClick={() => selectMode(m.key)}
                >
                  <div className="orbdrive-modeName">{m.label}</div>
                  <div className="orbdrive-modeDesc">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {phase === "ready" && (
        <div className="orbdrive-readyOverlay" role="dialog" aria-modal="true">
          <div className="orbdrive-readyModal">
            <div className="orbdrive-readyTitle">Let’s begin the race!</div>
            <div className="orbdrive-readySub">Are you ready?</div>
            <button className="orbdrive-readyBtn" onClick={startCountdown}>
              Yes, Start
            </button>
          </div>
        </div>
      )}

      {phase === "countdown" && (
        <div className="orbdrive-countOverlay" role="dialog" aria-modal="true">
          <div className="orbdrive-countInner">
            <div className="orbdrive-flags" aria-hidden="true">
              <span className="orbdrive-flag left">🏁</span>
              <span className="orbdrive-flag right">🏁</span>
            </div>
            <div className="orbdrive-countNum">{countdown}</div>
          </div>
        </div>
      )}

      {running && (
        <>
          {/* ── Racing HUD Top Bar ── */}
          <div className="od-hud-bar">
            <div className="od-hud-cell">
              <span className="od-hud-lbl">LAP TIME</span>
              <span className="od-hud-num">{formatRaceTime(time)}</span>
            </div>
            <div className="od-hud-cell od-hud-cell--speed">
              <span className={"od-hud-big" + (carSpeed >= 160 ? " od-hot" : "")}>
                {Math.round(carSpeed)}
              </span>
              <span className="od-hud-unit">KM/H</span>
            </div>
            <div className="od-hud-cell">
              <span className="od-hud-lbl">ALIGNMENT</span>
              <span className="od-hud-num">{Math.round(alignment)}%</span>
            </div>
            <div className="od-hud-cell">
              <span className="od-hud-lbl">FOCUS</span>
              <span className="od-hud-num">{(focusStrength * 100).toFixed(0)}%</span>
            </div>
            <div className="od-hud-cell od-hud-cell--lock">
              <span className="od-hud-lbl">FOCUS LOCK</span>
              <div className="od-hud-lockWrap">
                <div className="od-gauge-track">
                  <div
                    className={"od-gauge-fill" + (canDrive ? " od-gauge-fill--full" : "")}
                    style={{ width: `${holdPct * 100}%` }}
                  />
                </div>
                <span className="od-hud-lockNum">{Math.round(holdPct * 100)}%</span>
              </div>
            </div>
          </div>

          <div
            ref={areaRef}
            onMouseMove={handleMouseMove}
            className="orbdrive-container"
          >
            {/* ── LEFT: Orb Tracking Panel ── */}
            <div ref={orbPanelRef} className="orb-panel">
              <div className="od-grid-overlay" aria-hidden="true" />
              <div className="od-panel-label">TRACK THE ORB</div>

              <div
                className={
                  "orbdrive-focusPoint" + (isFocused ? " is-active" : "")
                }
                style={{
                  left: `${orbPos.x}%`,
                  top: `${orbPos.y}%`,
                }}
              />

              <div
                className="orb"
                style={{
                  left: `${orbPos.x}%`,
                  top: `${orbPos.y}%`,
                  opacity: isFocused ? 1 : 0.9,
                  width: `${orbSize}px`,
                  height: `${orbSize}px`,
                }}
              />

              {/* Outer focus ring */}
              <div
                className={"od-focus-ring" + (isFocused ? " od-focus-ring--active" : "")}
                style={{
                  left: `${orbPos.x}%`,
                  top: `${orbPos.y}%`,
                }}
                aria-hidden="true"
              />
            </div>

            {/* ── RIGHT: Track Panel ── */}
            <div
              className={"track-panel" + (carSpeed > 170 ? " od-warp" : "") + (focusStrength > 0.8 ? " od-nitro-speed" : "")}
              style={{ "--spd": speedPct }}
            >
              {/* Neon guardrails */}
              <div className="od-rail od-rail--l" aria-hidden="true" />
              <div className="od-rail od-rail--r" aria-hidden="true" />

              {/* Cheering Crowd */}
              <div className="track-crowd track-crowd--l" aria-hidden="true" />
              <div className="track-crowd track-crowd--r" aria-hidden="true" />

              <div className="finish finish--fixed">
                <div className="finish-label">🏁 FINISH</div>
                <div className="finish-line" ref={finishLineRef} />
              </div>

              <div
                className="start-line"
                style={{
                  transform: `translateY(${progress * 800}px)`,
                  opacity: Math.max(0, 1 - progress * 4)
                }}
              >
                <div className="start-label">START</div>
              </div>

              <div
                className="track-road"
                aria-hidden="true"
                style={{
                  transformOrigin: 'bottom center',
                  transform: `skewX(${turnState * -12}deg)`
                }}
              >
                {/* Edge lane glow */}
                <div className="od-lane-edge od-lane-edge--l" aria-hidden="true" />
                <div className="od-lane-edge od-lane-edge--r" aria-hidden="true" />

                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="track-line"
                    style={{
                      bottom: `${(i * 10 +
                        time *
                        carSpeed *
                        0.09 *
                        (mode.tunnelBaseMul + time * mode.tunnelAccelPerSec)) %
                        120
                        }%`,
                      "--p": i / 12,
                      "--xoff": `${mode.depthWarp
                        ? Math.sin(time * 1.15 + i * 0.85) *
                        (4 + speedPct * 10) *
                        (modeKey === "advanced" ? 1.3 : 1)
                        : 0
                        }px`,
                    }}
                  />
                ))}
              </div>

              {/* Outside Car */}
              <div
                className="car car--player"
                ref={playerCarRef}
                style={{
                  bottom: `${carBottomPct}%`,
                  "--speed": carSpeed,
                  "--carScale": carScale,
                  transform: `translateX(-50%) rotate(${turnState * 10}deg) translateX(${turnState * -20}px)`
                }}
                aria-label="Car"
              >
                <img src={carImg} alt="Player Car" className="orbdrive-car-img" />
                {carSpeed > 80 && focusStrength <= 0.8 && (
                  <div className="od-exhaust-flame" aria-hidden="true" />
                )}
                {focusStrength > 0.8 && (
                  <div className="od-nitro-flame" aria-hidden="true" />
                )}
                <div className="od-car-shadow" aria-hidden="true" />
              </div>

              <div
                className="progress-bar"
                style={{ width: `${progress * 100}%` }}
              />

              {/* Speedometer */}
              <div className="track-hud">
                <div className="speedo-box">
                  <div className="speedo">
                    <div className="speedo-ring" style={{ "--spd": speedPct }} />
                    <div className="speedo-center">
                      <div className="speedo-value">{Math.round(carSpeed)}</div>
                      <div className="speedo-unit">KM/H</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {!canDrive && (
            <div className="orbdrive-holdHint">
              Hold focus for {mode.holdSeconds.toFixed(1)}s to unlock full speed
            </div>
          )}

          {warning && (
            <div className="orbdrive-warning">
              ⚠ CONVERGENCE LOST — REGAIN FOCUS!
            </div>
          )}
        </>
      )}
    </div>
  );
}