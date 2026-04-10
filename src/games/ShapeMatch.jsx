import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { BlockOutlined, TrophyFilled, HourglassOutlined } from "@ant-design/icons";
import confetti from "canvas-confetti";
import "../styles/shapematch.css";
import {
  playCountdownBeep,
  playFinish,
  playNitroBoost, // reuse for success
  stopAll,
} from "./orbDriveAudio";
import { recordDailyPracticeScore } from "../utils/weeklyProgress";
import { submitScore } from "../utils/scoreApi";

const SHAPES = ["circle", "square", "triangle", "pentagon", "star"];

const MODES = {
  beginner: {
    key: "beginner",
    label: "Beginner",
    desc: "Large shapes • 3 matches • High tolerance",
    numMatches: 3,
    shapeSize: 180,
    toleranceMs: 0, // not timed based tolerance
    toleranceRadius: 100,
  },
  intermediate: {
    key: "intermediate",
    label: "Intermediate",
    desc: "Medium shapes • 5 matches • Normal tolerance",
    numMatches: 5,
    shapeSize: 130,
    toleranceRadius: 70,
  },
  advanced: {
    key: "advanced",
    label: "Advanced",
    desc: "Small shapes • 8 matches • Strict tolerance",
    numMatches: 8,
    shapeSize: 90,
    toleranceRadius: 40,
  },
};

const formatTime = (seconds) => {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  const mm = String(m).padStart(2, "0");
  const ss = s.toFixed(1).padStart(4, "0");
  return `${mm}:${ss}`;
};

const getShapeSVG = (type, size) => {
  const s = size;
  const half = s / 2;
  switch (type) {
    case "square":
      return <rect x="5" y="5" width={s - 10} height={s - 10} rx="8" />;
    case "circle":
      return <circle cx={half} cy={half} r={half - 6} />;
    case "triangle":
      return <polygon points={`${half},5 ${s - 5},${s - 5} 5,${s - 5}`} strokeLinejoin="round" />;
    case "pentagon": {
      const p1 = `${half},5`;
      const p2 = `${s - 5},${s * 0.4}`;
      const p3 = `${s * 0.8},${s - 5}`;
      const p4 = `${s * 0.2},${s - 5}`;
      const p5 = `5,${s * 0.4}`;
      return <polygon points={`${p1} ${p2} ${p3} ${p4} ${p5}`} strokeLinejoin="round" />;
    }
    case "star": {
      // standard 5-point star
      const inner = s * 0.25;
      const outer = s * 0.45;
      let pts = "";
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? outer : inner;
        pts += `${half + r * Math.cos(angle)},${half + r * Math.sin(angle)} `;
      }
      return <polygon points={pts.trim()} strokeLinejoin="round" />;
    }
    default:
      return <circle cx={half} cy={half} r={half - 6} />;
  }
};

export default function ShapeMatch({ onClose, onExit, onRunningChange } = {}) {
  const navigate = useNavigate();

  const exitToMenu = () => {
    stopAll();
    if (onClose) onClose();
    else if (onExit) onExit();
    else navigate("/dashboard", { replace: true });
  };

  useEffect(() => {
    return () => stopAll();
  }, []);

  const [phase, setPhase] = useState("idle");
  const [modeKey, setModeKey] = useState("beginner");
  const [running, setRunning] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [time, setTime] = useState(0);

  const [matchSequence, setMatchSequence] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const [resultOpen, setResultOpen] = useState(false);
  const [raceResult, setRaceResult] = useState(null);

  const dragAreaRef = useRef(null);
  const targetAreaRef = useRef(null);
  const animationRef = useRef(null);
  const timeRef = useRef(0);
  const lastTimeRef = useRef(null);
  
  const mode = MODES[modeKey] || MODES.beginner;
  const currentShape = matchSequence[currentIndex];

  const handleGlobalMouseMove = useCallback((e) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    if (isDragging) {
      setDragPos({ x: e.clientX, y: e.clientY });
    }
  }, [isDragging]);

  useEffect(() => {
    if (running) {
      window.addEventListener("mousemove", handleGlobalMouseMove);
      return () => window.removeEventListener("mousemove", handleGlobalMouseMove);
    }
  }, [running, handleGlobalMouseMove]);

  const generateSequence = (num) => {
    const seq = [];
    for (let i = 0; i < num; i++) {
        // purely random for now, avoid 2 exact same in a row if possible
        let choice = SHAPES[Math.floor(Math.random() * SHAPES.length)];
        while (seq.length > 0 && choice === seq[seq.length - 1] && SHAPES.length > 1) {
            choice = SHAPES[Math.floor(Math.random() * SHAPES.length)];
        }
        seq.push(choice);
    }
    return seq;
  };

  const startGame = () => {
    setRunning(true);
    setPhase("running");
    if (onRunningChange) onRunningChange(true);
    setTime(0);
    timeRef.current = 0;
    lastTimeRef.current = performance.now();
    setMatchSequence(generateSequence(mode.numMatches));
    setCurrentIndex(0);
    setIsDragging(false);
    setResultOpen(false);
    setRaceResult(null);

    const loop = (timestamp) => {
      const dt = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;
      timeRef.current += dt;
      setTime(timeRef.current);
      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
  };

  const checkMatch = () => {
    if (!targetAreaRef.current) return false;
    const targetRect = targetAreaRef.current.getBoundingClientRect();
    const targetCenter = {
      x: targetRect.left + targetRect.width / 2,
      y: targetRect.top + targetRect.height / 2,
    };

    const dist = Math.sqrt(
      Math.pow(dragPos.x - targetCenter.x, 2) + Math.pow(dragPos.y - targetCenter.y, 2)
    );

    return dist <= mode.toleranceRadius;
  };

  const triggerWin = () => {
    cancelAnimationFrame(animationRef.current);
    setRunning(false);
    if (onRunningChange) onRunningChange(false);
    setPhase("result");
    playFinish();

    const finalTime = timeRef.current;
    
    // Score based on time (ideal time ~ 3s per match)
    const idealTime = mode.numMatches * 3;
    const timeBonus = Math.max(0, idealTime - finalTime) * 10;
    const baseScore = mode.numMatches * 20;
    const diffMultipliers = { beginner: 1, intermediate: 1.5, advanced: 2.5 };
    
    const practiceScore = Math.floor((baseScore + timeBonus) * diffMultipliers[modeKey]);

    const bestKey = `shm_best_${modeKey}`;
    const prevBest = Number.parseFloat(window.localStorage.getItem(bestKey));
    const bestTimeSec = Number.isFinite(prevBest) && prevBest > 0
        ? Math.min(prevBest, finalTime) : finalTime;
    window.localStorage.setItem(bestKey, String(bestTimeSec));

    recordDailyPracticeScore({
      userId: window.localStorage.getItem("userId"),
      gameId: "shape-match",
      score: practiceScore,
    });

    submitScore({
      gameName: "shape-match",
      difficulty: modeKey,
      timeTaken: finalTime,
      rawScore: practiceScore,
    }).then((resp) => {
      if (resp.success) {
        setRaceResult((prev) => prev ? { ...prev, serverPoints: resp.points } : prev);
      }
    }).catch(() => {});

    setRaceResult({
      time: finalTime,
      score: practiceScore,
      best: bestTimeSec,
      difficulty: mode.label,
      serverPoints: null,
    });
    setResultOpen(true);

    try {
      confetti({ particleCount: 140, spread: 90, origin: { y: 0.6 } });
    } catch {}
  };

  // Hybrid Drag Drop (Double click style or pure drag)
  const handleGrabToggle = (e) => {
    if (!running) return;
    if (!isDragging) {
      // Pick up
      setIsDragging(true);
      setDragPos({ x: e.clientX, y: e.clientY });
    } else {
      // Drop
      finishDrop();
    }
  };

  const handleGlobalDrop = () => {
    if (isDragging) finishDrop();
  };

  const finishDrop = () => {
    setIsDragging(false);
    if (checkMatch()) {
      playNitroBoost(); // pleasant matched sound
      if (currentIndex + 1 >= mode.numMatches) {
        triggerWin();
      } else {
        setCurrentIndex(c => c + 1);
        try { confetti({ particleCount: 30, spread: 60, origin: { x: 0.75, y: 0.5 } }); } catch {}
      }
    }
  };

  useEffect(() => {
    // If user releases mouse anywhere while standard dragging
    const onUp = () => { if (isDragging) finishDrop(); };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [isDragging, currentIndex]);

  const beginFlow = () => setPhase("mode");
  const selectMode = (key) => { setModeKey(key); setPhase("ready"); };
  const startCountdown = () => {
    setPhase("countdown");
    setCountdown(3);
  };

  useEffect(() => {
    if (phase !== "countdown" || countdown == null) return;
    if (countdown <= 0) {
      playCountdownBeep(0);
      setCountdown(null);
      startGame();
      return;
    }
    playCountdownBeep(countdown);
    const t = window.setTimeout(() => setCountdown(c => c - 1), 900);
    return () => window.clearTimeout(t);
  }, [phase, countdown]);

  return (
    <div className="shapematch-wrapper">
      <button className="orbdrive-close-btn" onClick={exitToMenu} type="button">✕</button>
      
      <h3 className="shapematch-title"><BlockOutlined /> Shape Match</h3>
      <div className="shapematch-sub">DRAG AND DROP TO TARGETS</div>

      {!running && phase === "idle" && (
        <button className="orbdrive-start-btn" onClick={beginFlow}>▶ Start Training</button>
      )}

      {phase === "mode" && (
        <div className="shapematch-modal-overlay">
          <div className="sm-resultCard" style={{ padding: '20px' }}>
            <h2 style={{color: 'var(--neon-cyan)', marginBottom: '15px'}}>Select Difficulty</h2>
            <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
              {Object.values(MODES).map((m) => (
                <button
                  key={m.key}
                  className={"sm-modeCard"}
                  onClick={() => selectMode(m.key)}
                >
                  <div style={{fontWeight: 'bold', fontSize: '1.2em'}}>{m.label}</div>
                  <div style={{fontSize: '0.8em', color: 'gray'}}>{m.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {phase === "ready" && (
        <div className="shapematch-modal-overlay">
          <div className="sm-resultCard">
            <h2 style={{color: '#fff', marginBottom: '15px'}}>Grab and Match!</h2>
            <button className="orbdrive-start-btn" style={{position:'static', transform:'none', marginTop:'15px'}} onClick={startCountdown}>
              Yes, Start
            </button>
          </div>
        </div>
      )}

      {phase === "countdown" && (
        <div className="shapematch-modal-overlay">
          <div style={{fontSize: '8rem', color: '#00ff88', fontWeight: '900', textShadow: '0 0 30px #00ff88'}}>
            {countdown}
          </div>
        </div>
      )}

      {running && (
        <>
          <div className="sm-hud-bar">
            <div className="sm-hud-cell">
              <span className="sm-hud-lbl">TIME</span>
              <span className="sm-hud-num">{formatTime(time)}</span>
            </div>
            <div className="sm-hud-cell">
              <span className="sm-hud-lbl">SHAPES</span>
              <span className="sm-hud-num">{currentIndex} / {mode.numMatches}</span>
            </div>
          </div>

          <div className="shapematch-play-area">
            {/* Source Area */}
            <div className="shapematch-zone" ref={dragAreaRef}>
              <div className="shapematch-zone-label">SOURCE</div>
              {/* Only show source object if not dragging currently, or keep it translucent if dragging?
                  Better: keep it absolute at cursor if dragging, else in exact center. */}
              <div 
                className={`sm-shape ${isDragging ? 'is-dragging' : ''}`}
                onMouseDown={handleGrabToggle}
                style={{
                  '--size': `${mode.shapeSize}px`,
                  left: isDragging ? `${dragPos.x}px` : '50%',
                  top: isDragging ? `${dragPos.y}px` : '50%',
                  position: isDragging ? 'fixed' : 'absolute',
                }}
              >
                <svg width={mode.shapeSize} height={mode.shapeSize} viewBox={`0 0 ${mode.shapeSize} ${mode.shapeSize}`}>
                  <defs>
                    <linearGradient id="shapeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="rgba(0, 245, 255, 0.8)" />
                      <stop offset="100%" stopColor="rgba(168, 85, 247, 0.8)" />
                    </linearGradient>
                  </defs>
                  {currentShape && getShapeSVG(currentShape, mode.shapeSize)}
                </svg>
              </div>
            </div>

            {/* Target Area */}
            <div className="shapematch-zone">
              <div className="shapematch-zone-label">TARGET AREA</div>
              <div 
                ref={targetAreaRef}
                className="sm-target"
                style={{ '--size': `${mode.shapeSize}px` }}
              >
                <svg width={mode.shapeSize} height={mode.shapeSize} viewBox={`0 0 ${mode.shapeSize} ${mode.shapeSize}`}>
                  {currentShape && getShapeSVG(currentShape, mode.shapeSize)}
                </svg>
              </div>
            </div>
          </div>
        </>
      )}

      {resultOpen && raceResult && (
        <div className="shapematch-modal-overlay">
          <div className="sm-resultCard">
            <h2 style={{color: '#00ff88', marginBottom: '20px'}}>SESSION COMPLETE!</h2>
            
            <div style={{display:'flex', flexDirection:'column', gap:'10px', marginBottom: '20px', textAlign: 'left'}}>
              <div style={{display:'flex', justifyContent: 'space-between', color: '#fff'}}>
                <span>TIME:</span> <span style={{fontWeight:'bold'}}>{formatTime(raceResult.time)}</span>
              </div>
              <div style={{display:'flex', justifyContent: 'space-between', color: '#fff'}}>
                <span>RAW SCORE:</span> <span style={{fontWeight:'bold'}}>{raceResult.score}</span>
              </div>
              <div style={{display:'flex', justifyContent: 'space-between', color: '#fff'}}>
                <span>DIFFICULTY:</span> <span style={{fontWeight:'bold'}}>{raceResult.difficulty}</span>
              </div>
              <div style={{display:'flex', justifyContent: 'space-between', color: '#ffcc00'}}>
                <span>BEST TIME:</span> <span style={{fontWeight:'bold'}}>{formatTime(raceResult.best)}</span>
              </div>
              <div style={{display:'flex', justifyContent: 'space-between', color: '#a855f7', fontSize:'1.2rem', marginTop:'10px', paddingTop:'10px', borderTop:'1px solid rgba(255,255,255,0.1)'}}>
                <span>POINTS EARNED:</span> 
                <span style={{fontWeight:'bold'}}>
                  {raceResult.serverPoints != null ? <><TrophyFilled /> {raceResult.serverPoints}</> : <HourglassOutlined spin />}
                </span>
              </div>
            </div>

            <div style={{display: 'flex', gap: '10px', justifyContent:'center'}}>
              <button 
                className="orbdrive-start-btn" 
                style={{position:'static', transform:'none', padding:'10px 20px', fontSize:'1rem'}}
                onClick={() => {
                  setResultOpen(false);
                  setPhase("ready");
                }}>PLAY AGAIN</button>
              <button 
                className="orbdrive-start-btn" 
                style={{position:'static', transform:'none', padding:'10px 20px', fontSize:'1rem', background:'transparent', border:'2px solid gray'}}
                onClick={exitToMenu}>DASHBOARD</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
