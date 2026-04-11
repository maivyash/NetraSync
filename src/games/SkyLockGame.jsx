import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import jetImg from "../assets/jetplane.png";
import { NeuroFlightAudio } from "./NeuroFlightAudio";
import "../styles/SkyLockGame.css";

// ── Level definitions (3 levels) ─────────────────────────────────────────────
const LEVELS = [
  {
    id: 1, label: "Training Mode",   color: "#00ff88", theme: "cyberpunk",
    speed: 0.040, obstacleCount: 6,  birdCount: 0, droneCount: 0,
    gapSize: 10,  fogDensity: 0.0012,
    desc: "Gentle glide through a neon city canyon.",
    skyTop: "#1a1040", skyMid: "#3d2870", skyHorizon: "#f5c060",
    fogColor: 0x2a1a44, ambient: [0xc8b0e8, 3.8], sunColor: 0xffe8b0,
  },
  {
    id: 2, label: "Sunny Cruise",    color: "#ffe500", theme: "sunny",
    speed: 0.090, obstacleCount: 10, birdCount: 3, droneCount: 0,
    gapSize: 8,   fogDensity: 0.0006,
    desc: "Bright blue-sky cruise — watch for birds!",
    skyTop: "#1a6ecc", skyMid: "#4db0ff", skyHorizon: "#c8eeff",
    fogColor: 0x88ccff, ambient: [0xfff8e8, 5.0], sunColor: 0xfff5aa,
  },
  {
    id: 3, label: "Tropical Surge",  color: "#ff7b00", theme: "sunny",
    speed: 0.140, obstacleCount: 16, birdCount: 5, droneCount: 3,
    gapSize: 6.5, fogDensity: 0.0008,
    desc: "Warm tropics at top speed — sharp turns ahead!",
    skyTop: "#0e4a99", skyMid: "#2d8ce8", skyHorizon: "#ffeaa0",
    fogColor: 0x66aadd, ambient: [0xffeecc, 5.5], sunColor: 0xffdd88,
  },
];

const PASSENGER_MAX    = 100;
const TRACK_LENGTH     = 900;
const COLLISION_DAMAGE = 34;
const WARMUP_DURATION  = 2.0;

// ── Route waypoints for minimap ────────────────────────────────────────────
const ROUTE_WAYPOINTS = [
  { prog: 0.00, nx: 0.50 }, { prog: 0.15, nx: 0.65 },
  { prog: 0.30, nx: 0.40 }, { prog: 0.45, nx: 0.70 },
  { prog: 0.60, nx: 0.35 }, { prog: 0.75, nx: 0.60 },
  { prog: 0.90, nx: 0.45 }, { prog: 1.00, nx: 0.50 },
];

function routeNx(prog) {
  for (let i = 1; i < ROUTE_WAYPOINTS.length; i++) {
    const a = ROUTE_WAYPOINTS[i - 1], b = ROUTE_WAYPOINTS[i];
    if (prog <= b.prog) {
      const t = (prog - a.prog) / (b.prog - a.prog);
      return a.nx + (b.nx - a.nx) * t;
    }
  }
  return 0.5;
}

function trackCurveX(z) {
  return Math.sin(z * 0.008) * 18 + Math.sin(z * 0.015) * 8;
}

// ── Sky texture (per-level colors) ────────────────────────────────────────
function mkSkyTex(level) {
  const c = Object.assign(document.createElement("canvas"), { width: 4, height: 512 });
  const x = c.getContext("2d"), g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0,    level.skyTop);
  g.addColorStop(0.45, level.skyMid);
  g.addColorStop(0.82, level.skyHorizon);
  g.addColorStop(1,    level.theme === "sunny" ? "#ffffff" : "#ffd040");
  x.fillStyle = g; x.fillRect(0, 0, 4, 512);
  return new THREE.CanvasTexture(c);
}

// ── Jet sprite ────────────────────────────────────────────────────────────
function buildJet() {
  const g = new THREE.Group();
  const tex = new THREE.TextureLoader().load(jetImg);
  tex.minFilter = THREE.LinearFilter;
  const mat  = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.5), mat);
  g.add(mesh);
  [-1, 1].forEach(s => {
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.25, 10),
      new THREE.MeshBasicMaterial({ color: 0x00f5ff })
    );
    glow.position.set(s * 0.9, -0.4, -0.15);
    g.add(glow);
  });
  return g;
}

// ── Obstacle pillars ──────────────────────────────────────────────────────
function buildObstaclePair(gapY, gapSize, x, z, levelColor) {
  const g      = new THREE.Group();
  const pilMat = new THREE.MeshPhongMaterial({ color: 0xcc0022, emissive: 0x330008, shininess: 100 });
  const totalH = 70, halfG = gapSize / 2;
  const topH = totalH / 2 - gapY - halfG;
  if (topH > 0) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(3, topH, 3), pilMat);
    top.position.y = gapY + halfG + topH / 2;
    g.add(top);
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(levelColor).getHex() }));
    w.position.y = gapY + halfG + topH + 0.4;
    g.add(w);
  }
  const botH = totalH / 2 + gapY - halfG;
  if (botH > 0) {
    const bot = new THREE.Mesh(new THREE.BoxGeometry(3, botH, 3), pilMat);
    bot.position.y = gapY - halfG - botH / 2;
    g.add(bot);
  }
  const nCol = new THREE.Color(levelColor).getHex();
  [-1, 1].forEach(s => [1.52, -1.52].forEach(sz => {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, gapSize * 0.4, 0.08),
      new THREE.MeshBasicMaterial({ color: nCol })
    );
    strip.position.set(s * 1.52, gapY, sz);
    g.add(strip);
  }));
  g.position.set(x, 0, z);
  return g;
}

// ── Building (ALIGNED ROWS PER LEVEL) ────────────────────────────────────
// Pattern: 2 parallel rows either side of track, evenly spaced
function buildCity(scene, level) {
  // Themed building colors
  const isSunny = level.theme === "sunny";
  const bodyColors   = isSunny
    ? [0xd4c0a0, 0xbcaa88, 0xe0cca8, 0xc8b880, 0xe8d8b0] // sand/ivory tones
    : [0x1a1230, 0x221540, 0x180e28, 0x1e1835, 0x241020]; // dark cyberpunk
  const windowColors = isSunny
    ? [0xffffff, 0xffeeaa, 0xffe080, 0xddffff, 0xffddaa] // bright windows
    : [0x00f5ff, 0xff00aa, 0xaaff00, 0xffcc00, 0x00ffcc]; // neon windows

  const ROW_SPACING = TRACK_LENGTH / 20; // 20 buildings per row
  const SIDE_DIST   = 22;                // distance from track center

  for (let pass = 0; pass < 2; pass++) {
    const side = pass === 0 ? 1 : -1;
    for (let i = 0; i < 20; i++) {
      const z    = -(i * ROW_SPACING + ROW_SPACING * 0.5);
      const cx   = trackCurveX(z);
      const h    = 28 + (i % 5) * 14;   // height pattern repeats every 5
      const w    = 10 + (i % 3) * 6;
      const d    = 10 + (i % 4) * 5;
      const bc   = bodyColors[i % bodyColors.length];
      const wc   = windowColors[i % windowColors.length];
      const bld  = buildBuilding(h, w, d, bc, wc, isSunny);
      bld.position.set(cx + side * (SIDE_DIST + (i % 3) * 8), -22 + h / 2, z);
      scene.add(bld);

      // Second staggered row further out
      const h2   = 16 + (i % 4) * 10;
      const bld2 = buildBuilding(h2, w * 0.7, d * 0.7, bc, wc, isSunny);
      bld2.position.set(cx + side * (SIDE_DIST + 38 + (i % 3) * 10), -22 + h2 / 2, z + ROW_SPACING * 0.5);
      scene.add(bld2);
    }
  }
}

function buildBuilding(h, w, d, baseColor, windowColor, isSunny) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshPhongMaterial({
      color: baseColor,
      specular: isSunny ? 0xffffff : 0x112244,
      shininess: isSunny ? 80 : 40,
    })
  );
  g.add(body);
  const rows = Math.floor(h / 4);
  for (let r = 0; r < rows; r++) {
    if (r % 2 === 0) continue; // uniform window pattern (every other row)
    const wm = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.80, 1.4),
      new THREE.MeshBasicMaterial({ color: windowColor })
    );
    wm.position.set(0, -h / 2 + r * 4 + 2, d / 2 + 0.01);
    g.add(wm);
  }
  // Antenna only for cyberpunk
  if (!isSunny && Math.random() > 0.5) {
    const ant = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xff2255 })
    );
    ant.position.y = h / 2 + 3;
    g.add(ant);
  }
  return g;
}

// ── Bird ──────────────────────────────────────────────────────────────────
function buildBird() {
  const g   = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color: 0x555533 });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat));
  [-1, 1].forEach(s => {
    const wing = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x443322, side: THREE.DoubleSide })
    );
    wing.position.set(s * 0.5, 0.05, 0);
    wing.rotation.y = s * 0.3;
    g.add(wing);
  });
  return g;
}

// ── Drone ─────────────────────────────────────────────────────────────────
function buildDrone() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.15, 0.6),
    new THREE.MeshPhongMaterial({ color: 0xff5500, shininess: 80 })
  ));
  [[0.45,0.45],[-0.45,0.45],[0.45,-0.45],[-0.45,-0.45]].forEach(([px,pz]) => {
    const prop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.02, 6),
      new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.65 })
    );
    prop.position.set(px, 0.18, pz);
    g.add(prop);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
    led.position.set(px, 0.22, pz);
    g.add(led);
  });
  return g;
}

// ══════════════════════════════════════════════════════════════════════════
// ROUTE MINIMAP
// ══════════════════════════════════════════════════════════════════════════
function RouteMinimap({ progress }) {
  const W = 90, H = 140;
  const pts = ROUTE_WAYPOINTS.map(wp => ({ x: wp.nx * W, y: (1 - wp.prog) * H }));
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const dotX = routeNx(progress) * W;
  const dotY = (1 - progress) * H;
  return (
    <div style={{
      position: "absolute", top: 60, right: 12, zIndex: 60,
      background: "rgba(5,8,20,0.75)", border: "1px solid rgba(0,245,255,0.25)",
      borderRadius: 10, padding: "8px 10px",
      backdropFilter: "blur(8px)",
    }}>
      <div style={{ color: "#00f5ff", fontSize: "0.5rem", letterSpacing: 2, fontFamily: "monospace", marginBottom: 4, textAlign: "center" }}>
        ROUTE MAP
      </div>
      <svg width={W} height={H}>
        <rect width={W} height={H} rx={4} fill="rgba(0,10,30,0.7)" />
        {[0.25,0.5,0.75].map(f => <line key={f} x1={0} y1={H*f} x2={W} y2={H*f} stroke="rgba(0,200,255,0.08)" strokeWidth="0.5" />)}
        <path d={pathD} fill="none" stroke="rgba(0,200,255,0.2)" strokeWidth="1.5" strokeLinejoin="round" />
        <path d={pathD} fill="none" stroke="#00f5ff" strokeWidth="1.5" strokeLinejoin="round"
          strokeDasharray={`${progress * 200} 200`} opacity="0.85" />
        <circle cx={pts[0].x} cy={pts[0].y} r={3} fill="#00ff88" />
        <text x={pts[0].x+4} y={pts[0].y+1} fill="#00ff88" fontSize="6" fontFamily="monospace">SRC</text>
        <circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r={4} fill="#ffd700" opacity="0.9" />
        <text x={pts[pts.length-1].x+5} y={pts[pts.length-1].y+1} fill="#ffd700" fontSize="6" fontFamily="monospace">DEST</text>
        {pts.slice(1,-1).map((p,i) => <circle key={i} cx={p.x} cy={p.y} r={1.5} fill="rgba(0,245,255,0.4)" />)}
        <circle cx={dotX} cy={dotY} r={3.5} fill="#00f5ff" stroke="#fff" strokeWidth="0.8" />
        <polygon points={`${dotX},${dotY-6} ${dotX-3},${dotY+1} ${dotX+3},${dotY+1}`} fill="#00f5ff" opacity="0.9" />
      </svg>
      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.55rem", textAlign: "center", marginTop: 3 }}>
        {(progress * 100).toFixed(0)}% complete
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// ALIGNMENT CROSSHAIR
// ══════════════════════════════════════════════════════════════════════════
function AlignCrosshair({ alignScore }) {
  const col = alignScore > 72 ? "#00ff88" : alignScore > 45 ? "#ff9500" : "#ff2d55";
  return (
    <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none", zIndex: 40 }}>
      <svg width={80} height={80} style={{ opacity: 0.5 }}>
        <circle cx={40} cy={40} r={36} fill="none" stroke={col} strokeWidth="1" strokeDasharray="6 4" />
        <line x1={40} y1={4}  x2={40} y2={20} stroke={col} strokeWidth="1.2" />
        <line x1={40} y1={60} x2={40} y2={76} stroke={col} strokeWidth="1.2" />
        <line x1={4}  y1={40} x2={20} y2={40} stroke={col} strokeWidth="1.2" />
        <line x1={60} y1={40} x2={76} y2={40} stroke={col} strokeWidth="1.2" />
        <circle cx={40} cy={40} r={2.5} fill={col} />
      </svg>
      <div style={{ textAlign: "center", color: col, fontFamily: "monospace", fontSize: "0.6rem", letterSpacing: 1, marginTop: -6, textShadow: `0 0 8px ${col}` }}>
        ALIGN {alignScore}%
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// LEVEL PASSED CELEBRATION — with 3−2−1→GO countdown
// ══════════════════════════════════════════════════════════════════════════
function LevelPassedScreen({ levelIdx }) {
  const nextLevel = LEVELS[levelIdx + 1];
  const [phase_,  setPhase_]  = useState("celebrate"); // celebrate | countdown | go
  const [count,   setCount]   = useState(3);

  useEffect(() => {
    // After 1.8s of celebration, start counting down
    const t1 = setTimeout(() => setPhase_("countdown"), 1800);
    return () => clearTimeout(t1);
  }, []);

  useEffect(() => {
    if (phase_ !== "countdown") return;
    if (count <= 0) {
      setPhase_("go");
      return;
    }
    const t = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase_, count]);

  return (
    <div className="nf-overlay nf-fade" style={{ background: "rgba(0,0,0,0.55)" }}>
      {/* Confetti */}
      <div className="nf-confetti">
        {Array.from({ length: 36 }).map((_, i) => (
          <div key={i} className="nf-confetti-piece" style={{
            left: `${(i / 36) * 100}%`,
            animationDelay: `${(i % 6) * 0.1}s`,
            background: ["#ffd700","#00ff88","#00f5ff","#ff2d55","#ff9500","#a855f7"][i % 6],
          }} />
        ))}
      </div>

      <div className="nf-card nf-slide nf-level-passed-card">
        {/* Badge */}
        <div className="nf-level-passed-badge">✓</div>

        {/* Celebration phase */}
        {phase_ === "celebrate" && (
          <>
            <h1 className="nf-title" style={{ color: "#00ff88", fontSize: "clamp(1.6rem,4vw,2.6rem)" }}>
              LEVEL {levelIdx + 1} COMPLETE!
            </h1>
            <p className="nf-subtitle" style={{ color: "#b3ffcc", fontSize: "1rem" }}>
              Destination reached — excellent flying!
            </p>
            {nextLevel && (
              <div className="nf-next-level-badge">
                <span className="nf-lbl">UNLOCKED</span>
                <span style={{ color: nextLevel.color, fontWeight: 800, fontSize: "1.1rem" }}>
                  LEVEL {nextLevel.id} — {nextLevel.label}
                </span>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>{nextLevel.desc}</span>
              </div>
            )}
          </>
        )}

        {/* Countdown phase */}
        {phase_ === "countdown" && (
          <>
            <h2 style={{ color: "#ffffff", fontSize: "1rem", fontFamily: "monospace",
              letterSpacing: 3, marginBottom: 12, textTransform: "uppercase",
              color: nextLevel?.color || "#fff" }}>
              LEVEL {(nextLevel?.id) || "?"} — {nextLevel?.label || ""} STARTING
            </h2>
            <div className="nf-countdown-ring">
              <span className="nf-countdown-num">{count}</span>
            </div>
            <p style={{ color: "rgba(255,255,255,0.5)", fontFamily: "monospace",
              fontSize: "0.75rem", letterSpacing: 2, marginTop: 16 }}>
              GET READY TO FLY
            </p>
          </>
        )}

        {/* GO! phase */}
        {phase_ === "go" && (
          <div className="nf-go-text">GO!</div>
        )}

        {/* Pulsing bars */}
        <div className="nf-passed-bars" style={{ marginTop: 20 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="nf-passed-bar" style={{
              animationDelay: `${i * 0.08}s`,
              background: LEVELS[levelIdx].color,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// GAME COMPLETE — BEST PILOT POPUP
// ══════════════════════════════════════════════════════════════════════════
function BestPilotPopup({ score, align, time, collisions, onRetry, onMenu, onExit }) {
  return (
    <div className="nf-overlay nf-fade" style={{ background: "rgba(0,0,0,0.7)", zIndex: 200 }}>
      {/* Confetti burst */}
      <div className="nf-confetti">
        {Array.from({ length: 50 }).map((_, i) => (
          <div key={i} className="nf-confetti-piece" style={{
            left: `${Math.random() * 100}%`,
            width: `${6 + Math.random() * 8}px`,
            height: `${6 + Math.random() * 8}px`,
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
            background: ["#ffd700","#00ff88","#00f5ff","#ff2d55","#ff9500","#a855f7","#ffffff"][i % 7],
          }} />
        ))}
      </div>

      <div className="nf-card nf-slide nf-best-pilot-card">
        {/* Trophy */}
        <div className="nf-trophy-ring">
          <div className="nf-trophy-icon">🏆</div>
        </div>

        <div className="nf-best-pilot-crown">★ WORLD'S BEST PILOT ★</div>
        <h1 className="nf-title" style={{ fontSize: "clamp(1.4rem,4vw,2.4rem)", marginBottom: 4 }}>
          MISSION ACCOMPLISHED
        </h1>
        <p className="nf-subtitle" style={{ color: "#ffd700", fontSize: "1rem", marginBottom: 20 }}>
          All 4 levels cleared! You are the ace of the skies!
        </p>

        {/* Stats */}
        <div className="nf-result-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { label: "FINAL SCORE",    val: score.toLocaleString(), col: "#ffd700" },
            { label: "AVG ALIGNMENT",  val: `${align}%`,            col: "#00ff88" },
            { label: "TOTAL TIME",     val: `${Math.floor(time/60)}m ${time%60}s`, col: "#00c8ff" },
            { label: "COLLISIONS",     val: collisions,              col: collisions === 0 ? "#00ff88" : "#ff9500" },
          ].map(s => (
            <div key={s.label} className="nf-result-stat">
              <span className="nf-lbl">{s.label}</span>
              <span className="nf-result-val" style={{ color: s.col }}>{s.val}</span>
            </div>
          ))}
        </div>

        {/* Certificate */}
        <div className="nf-pilot-cert">
          <div className="nf-cert-inner">
            <div style={{ fontSize: "1.5rem" }}>🎖️</div>
            <div className="nf-cert-title">NEUROFLIGHT CHAMPION</div>
            <div className="nf-cert-sub">
              This certifies exceptional eye coordination, precision navigation,<br />
              and outstanding therapeutic flight performance.
            </div>
            {collisions === 0 && (
              <div className="nf-cert-badge">🌟 PERFECT FLIGHT — ZERO COLLISIONS 🌟</div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 16 }}>
          <button className="nf-btn" onClick={onRetry}>🔄 PLAY AGAIN</button>
          <button className="nf-btn nf-btn--ghost" onClick={onMenu}>📋 MENU</button>
          {onExit && <button className="nf-btn nf-btn--ghost" onClick={onExit}>✕ EXIT</button>}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════
export default function SkyLockGame({ onClose, gazePosRef }) {
  const mountRef = useRef(null);
  const rafRef   = useRef(null);
  const keysRef  = useRef({});
  const mouseRef = useRef({ x: 0, y: 0 });
  const audioRef = useRef(null);

  const [phase,          setPhase]          = useState("menu");
  const [levelIdx,       setLevelIdx]       = useState(0);
  const [passengerHP,    setPassengerHP]    = useState(PASSENGER_MAX);
  const [progress,       setProgress]       = useState(0);
  const [speed,          setSpeed]          = useState(0);
  const [altitude,       setAltitude]       = useState(1000);
  const [alignScore,     setAlignScore]     = useState(100);
  const [collisions,     setCollisions]     = useState(0);
  const [missionResult,  setMissionResult]  = useState(null);
  const [flashRed,       setFlashRed]       = useState(false);
  const [lockWarning,    setLockWarning]    = useState(false);
  const [elapsed,        setElapsed]        = useState(0);
  const [warmupSec,      setWarmupSec]      = useState(2);
  // Accumulate stats across all levels for the final victory popup
  const [totalCollisions,setTotalCollisions]= useState(0);
  const [totalTime,      setTotalTime]      = useState(0);
  const [totalScore,     setTotalScore]     = useState(0);
  const [totalAlign,     setTotalAlign]     = useState(0);
  const [alignCount,     setAlignCount]     = useState(0);

  // ── Audio lifecycle ────────────────────────────────────────────────────
  useEffect(() => {
    audioRef.current = new NeuroFlightAudio();
    return () => audioRef.current?.destroy();
  }, []);

  // ── Keyboard ──────────────────────────────────────────────────────────
  useEffect(() => {
    const on = e => { keysRef.current[e.code] = e.type === "keydown"; };
    window.addEventListener("keydown", on); window.addEventListener("keyup", on);
    return () => { window.removeEventListener("keydown", on); window.removeEventListener("keyup", on); };
  }, []);

  // ── Mouse ─────────────────────────────────────────────────────────────
  const handleMouseMove = useCallback(e => {
    const el = mountRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    mouseRef.current = { x: ((e.clientX-r.left)/r.width)*2-1, y: -((e.clientY-r.top)/r.height)*2+1 };
  }, []);

  // ── Helper: start mission ─────────────────────────────────────────────
  const startMission = useCallback((idx = 0) => {
    setLevelIdx(idx); setPassengerHP(PASSENGER_MAX); setProgress(0);
    setCollisions(0); setElapsed(0); setWarmupSec(2);
    setMissionResult(null);
    audioRef.current?.startEngine();
    setPhase("play");
  }, []);

  // ── THREE.JS GAME LOOP ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "play") return;
    const mount = mountRef.current; if (!mount) return;

    const level  = LEVELS[levelIdx];
    let hp             = PASSENGER_MAX;
    let prog           = 0;
    let elapsed_       = 0;
    let totalAlignSum  = 0, alignFrames = 0;
    let collisionCount = 0;
    let jetVelX = 0, jetVelY = 0;
    let ended   = false;
    let warmupRemaining = WARMUP_DURATION;

    // ── Renderer ──────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
renderer.shadowMap.enabled  = false;
    renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = level.theme === "sunny" ? 1.6 : 1.2;
    mount.appendChild(renderer.domElement);

    // ── Scene ─────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(level.fogColor, level.fogDensity);
    scene.background = new THREE.Color(level.fogColor);

    // Sky sphere
    const skyGeo = new THREE.SphereGeometry(700, 16, 10);
    skyGeo.scale(-1, 1, 1);
    scene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ map: mkSkyTex(level), side: THREE.BackSide })));

    // ── Camera ──
    const camera = new THREE.PerspectiveCamera(62, mount.clientWidth / mount.clientHeight, 0.1, 700);

    // ── Sunny clouds ──────────────────────────────────────────────────
    if (level.theme === "sunny") {
      const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
      for (let i = 0; i < 22; i++) {
        const cg = new THREE.Group();
        [[0,0,0,6],[5,2,0,4],[-4,1,2,3.5],[7,-1,-2,3],[3,3,1,3]].forEach(([cx,cy,cz,cr]) => {
          const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(cr, 7, 5),
            cloudMat.clone()
          );
          sphere.position.set(cx, cy, cz);
          cg.add(sphere);
        });
        cg.position.set(
          (Math.random()-0.5)*300,
          30 + Math.random()*60,
          -(Math.random()*TRACK_LENGTH)
        );
        scene.add(cg);
      }
    }

    // ── Lighting ──────────────────────────────────────────────────────
    const [ambColor, ambInt] = level.ambient;
    scene.add(new THREE.AmbientLight(ambColor, ambInt));
    const sun = new THREE.DirectionalLight(level.sunColor, level.theme === "sunny" ? 4.5 : 3.0);
    sun.position.set(80, 150, -60);
    sun.castShadow = false;
    scene.add(sun);
    const hemi = level.theme === "sunny"
      ? new THREE.HemisphereLight(0x87ceeb, 0xffd080, 3.0)
      : new THREE.HemisphereLight(0x8899dd, 0xc07040, 2.2);
    scene.add(hemi);
    const rim = new THREE.DirectionalLight(level.theme === "sunny" ? 0xffffff : 0x00f5ff, 1.0);
    rim.position.set(-40, 20, 30);
    scene.add(rim);

    // ── Player Jet ────────────────────────────────────────────────────
    const jet = buildJet();
    jet.position.set(0, 0, 0);
    scene.add(jet);
    const exhaustLight = new THREE.PointLight(0x00f5ff, 3, 12);
    scene.add(exhaustLight);

    // ── Ground ────────────────────────────────────────────────────────
    const gridColor = level.theme === "sunny" ? 0x88cc44 : 0x6644cc;
    const gridColor2= level.theme === "sunny" ? 0x44aa22 : 0x331a66;
    const grid = new THREE.GridHelper(1200, 100, gridColor, gridColor2);
    grid.position.set(0, -22, -(TRACK_LENGTH / 2));
    grid.material.opacity = 0.55; grid.material.transparent = true;
    scene.add(grid);

    // ── Aligned City ──────────────────────────────────────────────────
    buildCity(scene, level);

    // ── Turn arches ───────────────────────────────────────────────────
    [0.15, 0.30, 0.45, 0.60, 0.75, 0.90].forEach(p => {
      const z = -p * TRACK_LENGTH;
      const col = level.theme === "sunny" ? 0xffdd00 : 0x00f5ff;
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(11, 0.35, 8, 30, Math.PI),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55 })
      );
      arch.position.set(trackCurveX(z), 0, z);
      scene.add(arch);
    });

    // ── Stars (only cyberpunk) ────────────────────────────────────────
    if (level.theme !== "sunny") {
      const sg = new THREE.BufferGeometry();
      const sp = new Float32Array(1200);
      for (let i = 0; i < 1200; i += 3) {
        sp[i] = (Math.random()-0.5)*1200; sp[i+1] = 40+Math.random()*300; sp[i+2] = (Math.random()-0.5)*1000;
      }
      sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
      scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, sizeAttenuation: true })));
    }




    // ── Obstacles ─────────────────────────────────────────────────────
    const obstacles = [];
    const margin    = 30;
    for (let i = 0; i < level.obstacleCount; i++) {
      const z    = -(margin + (i / level.obstacleCount) * (TRACK_LENGTH - margin * 2));
      const cx   = trackCurveX(z);
      const x    = cx + (Math.random()-0.5) * 5;
      const gapY = (Math.random()-0.5) * 5;
      const pair = buildObstaclePair(gapY, level.gapSize, x, z, level.color);
      scene.add(pair);
      obstacles.push({ mesh: pair, gapY, gapSize: level.gapSize, x, z });
    }

    // ── Birds ─────────────────────────────────────────────────────────
    const birds = [];
    for (let i = 0; i < level.birdCount; i++) {
      const b  = buildBird();
      const bz = -(30 + Math.random() * (TRACK_LENGTH - 60));
      const bx = trackCurveX(bz) + (Math.random()-0.5)*20;
      b.position.set(bx, (Math.random()-0.5)*8, bz);
      b.userData = { baseX: bx, baseY: b.position.y, phase: Math.random()*Math.PI*2, speed: 0.6+Math.random() };
      scene.add(b); birds.push(b);
    }

    // ── Drones ────────────────────────────────────────────────────────
    const drones = [];
    for (let i = 0; i < level.droneCount; i++) {
      const d  = buildDrone();
      const dz = -(40 + Math.random() * (TRACK_LENGTH - 80));
      const dx = trackCurveX(dz) + (Math.random()-0.5)*16;
      d.position.set(dx, (Math.random()-0.5)*6, dz);
      d.userData = { baseX: dx, baseY: d.position.y, phase: Math.random()*Math.PI*2, speed: 1.2+Math.random()*2, dir: Math.random()>0.5?1:-1 };
      scene.add(d); drones.push(d);
    }

    // ── Destination beacon ────────────────────────────────────────────
    const destZ = -(TRACK_LENGTH - 8);
    const destX = trackCurveX(destZ);
    const destRing = new THREE.Mesh(
      new THREE.TorusGeometry(8, 0.6, 14, 40),
      new THREE.MeshBasicMaterial({ color: 0xffd700 })
    );
    destRing.position.set(destX, 0, destZ); scene.add(destRing);
    const destOuter = new THREE.Mesh(
      new THREE.TorusGeometry(12, 0.25, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.4 })
    );
    destOuter.position.set(destX, 0, destZ); scene.add(destOuter);
    [[-8,0],[8,0],[0,-8],[0,8]].forEach(([ox,oz]) => {
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 70, 6),
        new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.3 })
      );
      beam.position.set(destX+ox, 12, destZ+oz); scene.add(beam);
    });
    const destLight = new THREE.PointLight(0xffd700, 14, 70);
    destLight.position.set(destX, 2, destZ); scene.add(destLight);
    const lc = Object.assign(document.createElement("canvas"), { width: 512, height: 96 });
    const lx = lc.getContext("2d");
    lx.fillStyle="#ffd700"; lx.font="bold 64px monospace"; lx.textAlign="center"; lx.textBaseline="middle";
    lx.shadowColor="#fff"; lx.shadowBlur=28; lx.fillText("✈ DESTINATION", 256, 48);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(lc), transparent: true }));
    label.scale.set(24, 5, 1); label.position.set(destX, 14, destZ); scene.add(label);

    // ── Exhaust particles ─────────────────────────────────────────────
    const PC = 48;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(PC * 3);
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat  = new THREE.PointsMaterial({ color: 0x00c8ff, size: 0.22, transparent: true, opacity: 0.75 });
    scene.add(new THREE.Points(pGeo, pMat));
    const pSt = Array.from({ length: PC }, () => ({ x:0, y:0, z:0, life:0 }));

    // ── Resize ────────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    let camX = 0, camY = 3;
    let prevT = performance.now(), pulseCycle = 0, lastColTime = 0, hudTick = 0;
    let gazeTargetX = 0, gazeTargetY = 0;

    // ── ANIMATE ───────────────────────────────────────────────────────
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      const dt  = Math.min((now - prevT) / 1000, 0.05);
      prevT = now;
      if (ended) return;
      pulseCycle += dt;

      // ── WARMUP ──────────────────────────────────────────────────────
      if (warmupRemaining > 0) {
        warmupRemaining -= dt;
        jet.position.x += (0 - jet.position.x) * 0.22;
        jet.position.y += (0 - jet.position.y) * 0.22;
        jet.rotation.set(0, 0, 0);
        jetVelX = 0; jetVelY = 0; gazeTargetX = 0; gazeTargetY = 0;
        camX += (0 - camX) * 0.18; camY += (3 - camY) * 0.18;
        camera.position.set(camX, camY, jet.position.z + 11);
        camera.lookAt(0, 0, jet.position.z - 30);
        exhaustLight.position.set(0, 0, jet.position.z + 3);
        hudTick += dt;
        if (hudTick >= 0.1) { hudTick = 0; setWarmupSec(Math.ceil(Math.max(0, warmupRemaining))); }
        renderer.render(scene, camera);
        return;
      }
      if (warmupRemaining <= 0 && warmupRemaining > -dt) {
        setWarmupSec(0);
        gazeTargetX = jet.position.x; gazeTargetY = jet.position.y;
      }

      // ── FLIGHT ──────────────────────────────────────────────────────
      elapsed_ += dt;
      const keys  = keysRef.current;
      const mouse = mouseRef.current;
      let inputX = 0, inputY = 0;
      if (keys["ArrowLeft"]  || keys["KeyA"]) inputX -= 1;
      if (keys["ArrowRight"] || keys["KeyD"]) inputX += 1;
      if (keys["ArrowUp"]    || keys["KeyW"]) inputY += 1;
      if (keys["ArrowDown"]  || keys["KeyS"]) inputY -= 1;

      const curveX = trackCurveX(jet.position.z);

      if (gazePosRef?.current?.x > 0) {
        const el = mountRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          const gx = ((gazePosRef.current.x - rect.left) / rect.width)  * 2 - 1;
          const gy = -((gazePosRef.current.y - rect.top)  / rect.height) * 2 + 1;
          gazeTargetX += (curveX + gx * 13 - gazeTargetX) * 0.15;
          gazeTargetY += (gy * 9 + 2        - gazeTargetY) * 0.15;
          jet.position.x += (gazeTargetX - jet.position.x) * 0.12;
          jet.position.y += (gazeTargetY - jet.position.y) * 0.12;
          jetVelX = (gazeTargetX - jet.position.x) * 8;
          jetVelY = (gazeTargetY - jet.position.y) * 8;
        }
      } else {
        const tVX = Math.max(-1, Math.min(1, inputX + mouse.x * 1.3)) * 5;
        const tVY = Math.max(-1, Math.min(1, inputY + mouse.y * 1.3)) * 4;
        jetVelX += (tVX - jetVelX) * 0.10;
        jetVelY += (tVY - jetVelY) * 0.10;
        jet.position.x += (curveX + jetVelX * 2.5 - jet.position.x) * 0.10;
        jet.position.y  = Math.max(-12, Math.min(15, jet.position.y + jetVelY * dt * 55));
      }

      const fwdSpeed = 10 + level.speed * 55;
      jet.position.z -= fwdSpeed * dt;
      prog = Math.min(1, Math.abs(jet.position.z) / TRACK_LENGTH);

      jet.rotation.z = Math.PI / 10 * -Math.sign(jetVelX) * Math.min(Math.abs(jetVelX), 5) / 5;
      jet.rotation.x = Math.PI / 20 * Math.sign(jetVelY)  * Math.min(Math.abs(jetVelY), 4) / 4;
      jet.rotation.y = -jetVelX * 0.025;
      exhaustLight.position.set(jet.position.x, jet.position.y, jet.position.z + 3);

      // Alignment
      const offX = Math.abs(jet.position.x - curveX) / 12;
      const offY = Math.abs(jet.position.y) / 10;
      const fa   = Math.max(0, 1 - Math.sqrt(offX*offX + offY*offY) * 0.7);
      totalAlignSum += fa; alignFrames++;

      // Audio throttle
      audioRef.current?.setThrottle(0.4 + Math.abs(jetVelX)/10 + Math.abs(jetVelY)/10);

      // Camera
      camX += (curveX + jetVelX * 0.35 - camX) * 0.06;
      camY += (jet.position.y * 0.35 + 3 - camY) * 0.06;
      camera.position.set(camX, camY, jet.position.z + 11);
      camera.lookAt(camX * 0.6, camY * 0.1, jet.position.z - 35);

      // Birds / drones
      birds.forEach(b => {
        b.userData.phase += dt * b.userData.speed;
        b.position.x = b.userData.baseX + Math.sin(b.userData.phase) * 5;
        b.position.y = b.userData.baseY + Math.cos(b.userData.phase * 1.3) * 2.5;
      });
      drones.forEach(d => {
        d.userData.phase += dt * d.userData.speed * 0.5;
        d.position.x = d.userData.baseX + Math.sin(d.userData.phase) * 5 * d.userData.dir;
        d.position.y = d.userData.baseY + Math.sin(d.userData.phase * 1.7) * 2.5;
      });

      // Destination pulse
      destRing.rotation.z  += dt * 0.6;
      destOuter.rotation.z -= dt * 0.3;
      destOuter.material.opacity = 0.3 + 0.3 * Math.abs(Math.sin(pulseCycle * 2.5));
      destLight.intensity = 10 + 6 * Math.sin(pulseCycle * 3.5);

      // Particles
      for (let i = 0; i < 3; i++) {
        const idx = pSt.findIndex(p => p.life <= 0);
        if (idx >= 0) {
          const p = pSt[idx];
          p.x = jet.position.x + (Math.random()-0.5)*0.25;
          p.y = jet.position.y + (Math.random()-0.5)*0.18;
          p.z = jet.position.z + 3.0;
          p.life = 0.25 + Math.random() * 0.25;
        }
      }
      for (let i = 0; i < PC; i++) {
        const p = pSt[i];
        if (p.life > 0) { p.life -= dt; p.z += 0.18; }
        pPos[i*3]   = p.life > 0 ? p.x : 9999;
        pPos[i*3+1] = p.life > 0 ? p.y : 9999;
        pPos[i*3+2] = p.life > 0 ? p.z : 9999;
      }
      pGeo.attributes.position.needsUpdate = true;

      // Collision detection
      const jetSphere = new THREE.Sphere(jet.position, 1.5);
      if (now - lastColTime > 1200) {
        const hit = () => {
          lastColTime = now;
          hp = Math.max(0, hp - COLLISION_DAMAGE);
          collisionCount++;
          setPassengerHP(hp);
          setCollisions(collisionCount);
          setFlashRed(true);
          audioRef.current?.playCollision();
          setTimeout(() => setFlashRed(false), 900);
        };
        obstacles.forEach(obs => {
          if (Math.abs(obs.z - jet.position.z) > 5) return;
          if (!( Math.abs(jet.position.x - obs.x) < obs.gapSize * 0.45 &&
                 Math.abs(jet.position.y - obs.gapY) < obs.gapSize * 0.42 )) hit();
        });
        birds.forEach(b => { if (new THREE.Sphere(b.position, 1.0).intersectsSphere(jetSphere)) hit(); });
        drones.forEach(d => { if (new THREE.Sphere(d.position, 1.3).intersectsSphere(jetSphere)) hit(); });
      }

      // Throttled HUD update
      hudTick += dt;
      if (hudTick >= 0.1) {
        hudTick = 0;
        setProgress(prog);
        setSpeed(Math.round(240 + level.speed * 1800 + (Math.abs(jetVelX)+Math.abs(jetVelY))*18));
        setAltitude(Math.round(980 + jet.position.y * 18));
        setAlignScore(Math.round(fa * 100));
        setElapsed(Math.round(elapsed_));
        setLockWarning(Math.abs(jet.position.x - curveX) > 12 || Math.abs(jet.position.y) > 14);
      }

      // Mission end — fail
      if (hp <= 0 && !ended) {
        ended = true;
        const finalAlign = alignFrames > 0 ? Math.round((totalAlignSum/alignFrames)*100) : 0;
        const sc = Math.max(0, Math.round(prog*100*10 - collisionCount*80 + finalAlign*3));
        setMissionResult({ win:false, score:sc, align:finalAlign, time:Math.round(elapsed_), collisions:collisionCount });
        setPhase("result");
        audioRef.current?.stopEngine();
        return;
      }

      // Mission end — level complete
      if (prog >= 1.0 && !ended) {
        ended = true;
        const finalAlign = alignFrames > 0 ? Math.round((totalAlignSum/alignFrames)*100) : 0;
        const sc = Math.max(100, Math.round(1000 - collisionCount*80 + finalAlign*5 - elapsed_*0.5));

        // Accumulate totals
        setTotalScore(prev => prev + sc);
        setTotalCollisions(prev => prev + collisionCount);
        setTotalTime(prev => prev + Math.round(elapsed_));
        setTotalAlign(prev => prev + finalAlign);
        setAlignCount(prev => prev + 1);

        setMissionResult({ win:true, score:sc, align:finalAlign, time:Math.round(elapsed_), collisions:collisionCount });
        audioRef.current?.playLevelUp();

        if (levelIdx < LEVELS.length - 1) {
          // Show level-passed screen, then start next level
          // All setStates in ONE setTimeout callback = React 18 batches into a single render
          setPhase("level_passed");
          const nextIdx = levelIdx + 1;
          setTimeout(() => {
            setLevelIdx(nextIdx);
            setPassengerHP(PASSENGER_MAX);
            setProgress(0); setCollisions(0); setElapsed(0); setWarmupSec(2);
            setMissionResult(null);
            setPhase("play");  // same callback → batched with setLevelIdx ↑
          }, 5200);
        } else {
          // GAME COMPLETE
          audioRef.current?.playVictory();
          setTimeout(() => { audioRef.current?.stopEngine(); }, 500);
          setPhase("game_complete");
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      ended = true;
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) [].concat(o.material).forEach(m => m.dispose());
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, levelIdx]);

  // ── Derived UI ─────────────────────────────────────────────────────────
  const hpColor = passengerHP > 60 ? "#00ff88" : passengerHP > 30 ? "#ff9500" : "#ff2d55";
  const level   = LEVELS[levelIdx];

  return (
    <div className="nf-root" onMouseMove={handleMouseMove}>
      <div ref={mountRef} className="nf-three-mount" />

      {/* Collision flash */}
      {flashRed && (
        <div className="nf-flash-red">
          <div className="nf-flash-text">⚠️ COLLISION — PASSENGERS AT RISK</div>
        </div>
      )}
      {lockWarning && phase === "play" && <div className="nf-warning-border" />}

      {/* ── HUD ── */}
      {phase === "play" && (
        <>
          {/* Warmup banner */}
          {warmupSec > 0 && (
            <div className="nf-warmup-banner">
              <div className="nf-warmup-icon">✈</div>
              <div>
                <div className="nf-warmup-title">CENTERING FLIGHT PATH</div>
                <div className="nf-warmup-sub">Aligning to center in {warmupSec}s — hold still…</div>
              </div>
              <div className="nf-warmup-count">{warmupSec}</div>
            </div>
          )}

          {/* Top bar */}
          <div className="nf-hud-top">
            <div className="nf-hud-cell" style={{ minWidth: 150 }}>
              <span className="nf-lbl">ROUTE</span>
              <span style={{ color: "#00f5ff", fontSize: "0.8rem", fontWeight: "bold", letterSpacing: 1 }}>
                SRC ──✈──▶ DEST
              </span>
            </div>
            <div className="nf-hud-cell">
              <span className="nf-lbl">LEVEL</span>
              <span className="nf-val" style={{ color: level.color }}>{level.label}</span>
            </div>
            <div className="nf-hud-cell">
              <span className="nf-lbl">SPEED</span>
              <span className="nf-val">{speed}<span className="nf-unit">km/h</span></span>
            </div>
            <div className="nf-hud-cell nf-progress-cell">
              <span className="nf-lbl">MISSION PROGRESS</span>
              <div className="nf-prog-bar">
                <div className="nf-prog-fill" style={{ width: `${progress * 100}%`, background: level.color }} />
                <div className="nf-prog-plane" style={{ left: `calc(${progress * 100}% - 7px)` }}>✈</div>
              </div>
              <span style={{ color: level.color, fontSize: "0.75rem", fontFamily: "monospace" }}>
                {Math.round(progress * 100)}%
              </span>
            </div>
            <div className="nf-hud-cell">
              <span className="nf-lbl">ALTITUDE</span>
              <span className="nf-val">{altitude}<span className="nf-unit">m</span></span>
            </div>
            <div className="nf-hud-cell">
              <span className="nf-lbl">TIME</span>
              <span className="nf-val">
                {String(Math.floor(elapsed/60)).padStart(2,"0")}:{String(elapsed%60).padStart(2,"0")}
              </span>
            </div>
          </div>

          <RouteMinimap progress={progress} />
          <AlignCrosshair alignScore={alignScore} />

          <div className="nf-passenger-panel">
            <div className="nf-pass-title">👨‍✈️ PASSENGER SAFETY</div>
            <div className="nf-pass-bar-wrap">
              <div className="nf-pass-bar" style={{ width: `${passengerHP}%`, background: hpColor }} />
            </div>
            <div style={{ color: hpColor, fontSize: "0.72rem", fontFamily: "monospace", marginTop: 3 }}>
              {passengerHP > 60 ? "✅ Calm & Comfortable" : passengerHP > 30 ? "⚠️ Stressed" : "🚨 CRITICAL"}
            </div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.6rem", marginTop: 4 }}>
              Collisions: <span style={{ color: "#ff9500" }}>{collisions}</span>
            </div>
          </div>

          {lockWarning && <div className="nf-align-warn">⚠ REALIGN — RETURN TO FLIGHT PATH</div>}
          <div className="nf-control-hint">WASD / Arrows + Mouse · Face Cursor enabled</div>
        </>
      )}

      {/* ── MENU ── */}
      {phase === "menu" && (
        <div className="nf-overlay nf-fade">
          <div className="nf-card nf-slide">
            <div className="nf-logo">✈️</div>
            <h1 className="nf-title">NEUROFLIGHT</h1>
            <p className="nf-subtitle">Vision Pilot — Therapeutic Aviation Simulator</p>
            <div className="nf-level-grid">
              {LEVELS.map((l, i) => (
                <button key={l.id} className={`nf-level-btn ${levelIdx===i?"is-active":""}`}
                  style={{ "--lc": l.color }} onClick={() => setLevelIdx(i)}>
                  <span className="nf-level-num">LEVEL {l.id}</span>
                  <span className="nf-level-name">{l.label}</span>
                  <span className="nf-level-desc">{l.desc}</span>
                </button>
              ))}
            </div>
            <div className="nf-therapy-tags">
              <span>👁 Eye Alignment</span><span>🔵 Binocular Fusion</span>
              <span>📐 Depth Perception</span><span>⚡ Oculomotor Training</span>
            </div>
            <div className="nf-controls-hint">
              <b>WASD / Arrows</b> to steer · <b>Mouse</b> fine control · <b>Face Cursor</b> if active
            </div>
            <div style={{ display:"flex", gap:12, justifyContent:"center", marginTop:8 }}>
              <button className="nf-btn" onClick={() => startMission(levelIdx)}>🚀 START MISSION</button>
              {onClose && <button className="nf-btn nf-btn--ghost" onClick={onClose}>✕ EXIT</button>}
            </div>
          </div>
        </div>
      )}

      {/* ── LEVEL PASSED ── */}
      {phase === "level_passed" && <LevelPassedScreen levelIdx={levelIdx} />}

      {/* ── GAME COMPLETE ── */}
      {phase === "game_complete" && (
        <BestPilotPopup
          score={totalScore}
          align={alignCount > 0 ? Math.round(totalAlign / alignCount) : 0}
          time={totalTime}
          collisions={totalCollisions}
          onRetry={() => {
            setTotalScore(0); setTotalCollisions(0); setTotalTime(0);
            setTotalAlign(0); setAlignCount(0);
            startMission(0);
          }}
          onMenu={() => setPhase("menu")}
          onExit={onClose}
        />
      )}

      {/* ── RESULT (fail) ── */}
      {phase === "result" && missionResult && !missionResult.win && (
        <div className="nf-overlay nf-fade">
          <div className="nf-card nf-slide">
            <div style={{ fontSize:"3.4rem", marginBottom:8 }}>💥</div>
            <h1 className="nf-title" style={{ color:"#ff2d55" }}>MISSION FAILED</h1>
            <p className="nf-subtitle">Passenger stress exceeded critical threshold.</p>
            <div className="nf-result-grid">
              {[
                { label:"SCORE",      val:missionResult.score.toLocaleString(), col:"#ffd700" },
                { label:"ALIGNMENT",  val:`${missionResult.align}%`,           col:"#00ff88" },
                { label:"TIME",       val:`${Math.floor(missionResult.time/60)}:${String(missionResult.time%60).padStart(2,"0")}`, col:"#00c8ff" },
                { label:"COLLISIONS", val:missionResult.collisions,             col:"#ff9500" },
              ].map(s => (
                <div key={s.label} className="nf-result-stat">
                  <span className="nf-lbl">{s.label}</span>
                  <span className="nf-result-val" style={{ color:s.col }}>{s.val}</span>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:12, justifyContent:"center", marginTop:12 }}>
              <button className="nf-btn" onClick={() => startMission(levelIdx)}>🔄 RETRY</button>
              <button className="nf-btn nf-btn--ghost" onClick={() => { audioRef.current?.stopEngine(); setPhase("menu"); }}>📋 MENU</button>
              {onClose && <button className="nf-btn nf-btn--ghost" onClick={onClose}>✕ EXIT</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}