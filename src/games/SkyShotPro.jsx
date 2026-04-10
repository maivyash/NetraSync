import React, { useRef, useEffect, useState, useCallback } from "react";
import "../styles/SkyShotPro.css";
import { submitScore } from "../utils/scoreApi";
import { recordDailyPracticeScore } from "../utils/weeklyProgress";
const playSound = (type) => {
  // Audio muted per user request
};

const LEVEL_CONFIGS = [
  { id: 1, targets: 3, planets: 0, asteroids: 0, rockets: 0, reqScore: 40,  goldArrows: 5,  description: "Beginner",       difficulty: "Easy",    timeLimit: 45, amplitude: 150, freq: 0.007, targetR: 75 },
  { id: 2, targets: 4, planets: 1, asteroids: 0, rockets: 0, reqScore: 60,  goldArrows: 7,  description: "Intermediate",   difficulty: "Medium",  timeLimit: 60, amplitude: 220, freq: 0.0085, targetR: 65 },
  { id: 3, targets: 5, planets: 2, asteroids: 0, rockets: 2, reqScore: 80,  goldArrows: 10, description: "Asteroid Field", difficulty: "Hard",    timeLimit: 90, amplitude: 340, freq: 0.010, targetR: 50 },
];

const ARROW_SPEED = 18;

export default function SkyShotPro({ onClose, onRunningChange } = {}) {
  const canvasRef = useRef(null);
  const stateRef  = useRef({
    targets: [], arrows: [], particles: [], planets: [], asteroids: [], rockets: [],
    bowPull: 0, isShooting: false,
    shotsFired: 0, hitsLanded: 0, comboCount: 0, lastHitTime: 0, currScore: 0,
    animId: null, clickHandler: null, W: 0, H: 0, ended: false,
  });

  const [score,       setScore]       = useState(0);
  const [combo,       setCombo]       = useState(0);
  const [level,       setLevel]       = useState(1);
  const [gameState,   setGameState]   = useState("start");
  const [accuracy,    setAccuracy]    = useState(0);
  const [timeLeft,    setTimeLeft]    = useState(LEVEL_CONFIGS[0].timeLimit);
  const [targetsLeft, setTargetsLeft] = useState(0);
  const [shotsFired,  setShotsFired]  = useState(0);
  const [hitsLanded,  setHitsLanded]  = useState(0);

  /* ── drawing helpers ── */
  function drawBackground(ctx, W, H) {
    // Deep Space Nebula Gradient (Full Screen)
    const sky = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W);
    sky.addColorStop(0, "#080c1f");
    sky.addColorStop(0.5, "#040510");
    sky.addColorStop(1, "#010105");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Subtle Glowing Nebula Patches
    ctx.globalCompositeOperation = "screen";
    const neb1 = ctx.createRadialGradient(W * 0.2, H * 0.3, 0, W * 0.2, H * 0.3, W * 0.4);
    neb1.addColorStop(0, "rgba(80, 20, 120, 0.15)");
    neb1.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = neb1; ctx.fillRect(0, 0, W, H);

    const neb2 = ctx.createRadialGradient(W * 0.8, H * 0.7, 0, W * 0.8, H * 0.7, W * 0.5);
    neb2.addColorStop(0, "rgba(20, 110, 160, 0.15)");
    neb2.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = neb2; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";

    // Dense Multilayer Parallax Starfield
    ctx.fillStyle = "rgba(200, 230, 255, 0.85)";
    for (let i = 0; i < 180; i++) {
      const isForeground = i % 4 === 0;
      const speed = isForeground ? 0.03 : 0.005;
      
      const sx = (i * 1234.5 + Date.now() * speed) % W;
      const sy = (i * 876.5 + 41) % H;
      const sr = isForeground ? 1.5 : 0.6;
      
      const flicker = Math.sin(Date.now() * 0.001 + i) * 0.4 + 0.6;
      ctx.globalAlpha = flicker;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    }

    // Dynamic occasional shooting stars
    const t = Date.now() * 0.0005;
    const shootX = (t * 1500) % (W * 3) - W;
    const shootY = (t * 700) % (H * 3) - H;
    if (shootX > 0 && shootX < W && shootY > 0 && shootY < H) {
       ctx.globalAlpha = 0.9;
       ctx.strokeStyle = "rgba(200, 255, 255, 0.8)";
       ctx.lineWidth = 1.5;
       ctx.beginPath();
       ctx.moveTo(shootX, shootY);
       ctx.lineTo(shootX - 60, shootY - 25);
       ctx.stroke();
    }
    
    ctx.globalAlpha = 1;
  }

  function drawBow(ctx, bx, by, pull) {
    const topLimb = { x: bx + 28, y: by - 85 };
    const botLimb = { x: bx + 28, y: by + 85 };
    const pullBack = pull * 35; // increased pullback animation depth

    // High-tech Compound Bow limbs
    ctx.lineWidth = 12; ctx.strokeStyle = "#1a2533"; // dark metallic
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(0,200,255,0.6)"; ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(topLimb.x, topLimb.y);
    // Compound rigid shape
    ctx.lineTo(bx + 40, topLimb.y + 40);
    ctx.lineTo(bx + 55, by);
    ctx.lineTo(bx + 40, botLimb.y - 40);
    ctx.lineTo(botLimb.x, botLimb.y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner glowing accents on limbs
    ctx.lineWidth = 2; ctx.strokeStyle = "#00f5ff";
    ctx.beginPath();
    ctx.moveTo(topLimb.x + 5, topLimb.y + 10);
    ctx.lineTo(bx + 43, topLimb.y + 42);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(botLimb.x + 5, botLimb.y - 10);
    ctx.lineTo(bx + 43, botLimb.y - 42);
    ctx.stroke();

    // Central Grip (Cyber Chassis)
    const grd = ctx.createLinearGradient(bx - 14, 0, bx + 14, 0);
    grd.addColorStop(0, "#0d1b2a"); grd.addColorStop(0.5, "#1b263b"); grd.addColorStop(1, "#0d1b2a");
    ctx.fillStyle = grd;
    ctx.fillRect(bx - 13, by - 36, 26, 72);
    
    // LEDs on grip
    ctx.fillStyle = "#ff0055";
    ctx.fillRect(bx - 4, by - 20, 8, 4);
    ctx.fillStyle = "#00ff88";
    ctx.fillRect(bx - 4, by + 16, 8, 4);

    // String glowing
    ctx.lineWidth = 2.5; 
    ctx.strokeStyle = pull > 0.1 ? "rgba(0,255,136,0.9)" : "rgba(230,225,210,0.7)";
    ctx.shadowColor = pull > 0.1 ? "rgba(0,255,136,0.6)" : "transparent";
    ctx.shadowBlur = pull > 0.1 ? 8 : 0;
    ctx.beginPath();
    ctx.moveTo(topLimb.x, topLimb.y);
    ctx.lineTo(bx + 5 - pullBack, by);
    ctx.lineTo(botLimb.x, botLimb.y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (pull > 0.05) {
      const arrowTip  = { x: bx + 28 + pullBack * 0.6, y: by };
      const arrowTail = { x: bx + 5 - pullBack, y: by };
      drawArrowStatic(ctx, arrowTail.x, arrowTail.y, arrowTip.x, arrowTip.y);
    }
  }

  function drawArrowStatic(ctx, sx, sy, ex, ey) {
    const angle = Math.atan2(ey - sy, ex - sx);
    const len   = Math.hypot(ex - sx, ey - sy);
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(angle);
    ctx.fillStyle = "#c8904a"; ctx.fillRect(0, -2, len, 4);
    ctx.fillStyle = "#00f5ff"; // neon arrow tip
    ctx.shadowColor = "#00f5ff"; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.moveTo(len, -5); ctx.lineTo(len + 16, 0); ctx.lineTo(len, 5); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#e03030";
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(-14, -10); ctx.lineTo(-8, -2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(-14, 10); ctx.lineTo(-8, 2); ctx.fill();
    ctx.restore();
  }

  function drawFlyingArrow(ctx, arrow) {
    const { x, y, vx, vy } = arrow;
    const angle = Math.atan2(vy, vx);
    const len   = 55;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    // Draw motion blur trail
    ctx.fillStyle = "rgba(0, 245, 255, 0.25)";
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-len - 40, -1); ctx.lineTo(-len - 40, 1); ctx.fill();

    ctx.shadowColor = "rgba(0,250,255,0.7)"; ctx.shadowBlur = 12;
    ctx.fillStyle = "#fff"; ctx.fillRect(-len, -1.5, len, 3);
    ctx.fillStyle = "#00f5ff";
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(18, 0); ctx.lineTo(0, 6); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ff4081"; // high tech tail
    ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(-len - 14, -10); ctx.lineTo(-len + 8, 0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(-len - 14, 10); ctx.lineTo(-len + 8, 0); ctx.fill();
    ctx.restore();
  }

  function drawTarget(ctx, t) {
    if (t.hit && t.hitTimer >= 20) return;
    const alpha = t.hit ? Math.max(0, 1 - t.hitTimer / 20) : 1;
    const scale = t.hit ? Math.max(0, 1 + t.hitTimer / 10) : 1; // burst expansion effect
    const glow  = Math.sin(Date.now() * 0.005 + t.phase) * 0.35 + 0.65;

    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(t.x, t.y); ctx.scale(scale, scale);

    if (!t.hit) {
      const glowGrd = ctx.createRadialGradient(0, 0, t.r * 0.8, 0, 0, t.r * 1.8);
      glowGrd.addColorStop(0, `rgba(0,245,255,${glow * 0.45})`);
      glowGrd.addColorStop(1, "rgba(0,245,255,0)");
      ctx.fillStyle = glowGrd;
      ctx.beginPath(); ctx.arc(0, 0, t.r * 1.8, 0, Math.PI * 2); ctx.fill();
    }

    const startRing = t.outerDamaged ? 2 : 0;
    const rings = ["#ffffff", "#222222", "#00d0ff", "#ff2a55", "#ffd700"];
    const glows = ["none", "none", "rgba(0,200,255,0.6)", "rgba(255,40,85,0.6)", "rgba(255,215,0,0.8)"];
    for (let i = startRing; i < 5; i++) {
      ctx.shadowBlur = i >= 2 ? 12 : 0; ctx.shadowColor = glows[i];
      ctx.fillStyle = rings[i];
      ctx.beginPath(); ctx.arc(0, 0, t.r * (1 - i * 0.18), 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;

    // High tech crosshairs inside target
    ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(-t.r * 1.2, 0); ctx.lineTo(t.r * 1.2, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -t.r * 1.2); ctx.lineTo(0, t.r * 1.2); ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath(); ctx.arc(0, 0, t.r * 0.08, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawPlanet(ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    
    // Saturn Rings (Back)
    ctx.save();
    ctx.rotate(p.ringAngle !== undefined ? p.ringAngle : -0.2);
    ctx.beginPath();
    ctx.ellipse(0, 0, p.r * 2.2, p.r * 0.6, 0, Math.PI, 0);
    ctx.strokeStyle = `hsla(${p.hue}, 50%, 70%, 0.4)`;
    ctx.lineWidth = p.r * 0.3;
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // planet rings/craters (surface texture)
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath(); ctx.arc(-p.r*0.3, -p.r*0.3, p.r*0.2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(p.r*0.4, p.r*0.2, p.r*0.15, 0, Math.PI*2); ctx.fill();

    // Saturn Rings (Front)
    ctx.save();
    ctx.rotate(p.ringAngle !== undefined ? p.ringAngle : -0.2);
    ctx.beginPath();
    ctx.ellipse(0, 0, p.r * 2.2, p.r * 0.6, 0, 0, Math.PI);
    ctx.strokeStyle = `hsla(${p.hue}, 60%, 75%, 0.8)`;
    ctx.lineWidth = p.r * 0.3;
    ctx.stroke();
    // Inner fine ring
    ctx.beginPath();
    ctx.ellipse(0, 0, p.r * 1.6, p.r * 0.4, 0, 0, Math.PI);
    ctx.strokeStyle = `hsla(${p.hue}, 80%, 90%, 0.6)`;
    ctx.lineWidth = p.r * 0.08;
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  function drawAsteroid(ctx, a) {
     ctx.save();
     ctx.translate(a.x, a.y);
     ctx.rotate(a.rot);
     ctx.beginPath();
     for(let i=0; i<a.points.length; i++) {
        const pt = a.points[i];
        const px = pt.x * a.r, py = pt.y * a.r;
        if (i===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
     }
     ctx.closePath();
     ctx.fillStyle = "#3b4252"; ctx.fill();
     ctx.strokeStyle = "#4c566a"; ctx.lineWidth = 3; ctx.stroke();
     ctx.fillStyle = "rgba(0,0,0,0.25)";
     ctx.beginPath(); ctx.arc(a.r*0.2, -a.r*0.2, a.r*0.15, 0, Math.PI*2); ctx.fill();
     ctx.restore();
  }

  function drawRocket(ctx, r) {
     ctx.save();
     ctx.translate(r.x, r.y);
     ctx.fillStyle = Math.random() > 0.5 ? "#ffa500" : "#ff4500";
     ctx.shadowColor = "#ff4500"; ctx.shadowBlur = 10;
     ctx.beginPath(); ctx.moveTo(-6, 12); ctx.lineTo(6, 12); ctx.lineTo(0, 25 + Math.random()*15); ctx.fill();
     ctx.shadowBlur = 0;
     ctx.fillStyle = "#fff";
     ctx.beginPath(); ctx.moveTo(-3, 12); ctx.lineTo(3, 12); ctx.lineTo(0, 18 + Math.random()*8); ctx.fill();
     ctx.fillStyle = "#eceff4";
     ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(10, 5); ctx.lineTo(10, 12); ctx.lineTo(-10, 12); ctx.lineTo(-10, 5); ctx.fill();
     ctx.fillStyle = "#88c0d0";
     ctx.beginPath(); ctx.arc(0, -2, 4, 0, Math.PI*2); ctx.fill();
     ctx.fillStyle = "#bf616a";
     ctx.beginPath(); ctx.moveTo(10, 5); ctx.lineTo(16, 15); ctx.lineTo(10, 12); ctx.fill();
     ctx.beginPath(); ctx.moveTo(-10, 5); ctx.lineTo(-16, 15); ctx.lineTo(-10, 12); ctx.fill();
     ctx.restore();
  }

  function spawnParticles(s, x, y, missColor) {
    const isHit = !missColor;
    const count = isHit ? 60 : 30; // more particles on hit
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
      const spd   = isHit ? (3 + Math.random() * 8) : (2 + Math.random() * 5);
      s.particles.push({
        x, y,
        vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 1.5,
        life: 1, decay: 0.025 + Math.random() * 0.02,
        r: 3 + Math.random() * 4,
        color: missColor || ["#ffd700","#ff8800","#ff4444","#ffffff"][Math.floor(Math.random()*4)],
      });
    }
  }

  function updateParticles(s) {
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= p.decay;
      if (p.life <= 0) s.particles.splice(i, 1);
    }
  }

  function drawParticles(ctx, s) {
    s.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  /* ── Main game loop ── */
  useEffect(() => {
    if (gameState !== "play") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const s   = stateRef.current;
    const cfg = LEVEL_CONFIGS[level - 1];

    s.W = canvas.width  = canvas.offsetWidth  || window.innerWidth;
    s.H = canvas.height = canvas.offsetHeight || window.innerHeight;

    s.targets = []; s.arrows = []; s.particles = [];
    s.planets = []; s.asteroids = []; s.rockets = [];
    s.shotsFired = 0; s.hitsLanded = 0; s.comboCount = 0;
    s.bowPull = 0; s.isShooting = false; s.ended = false;

    const cols   = Math.ceil(Math.sqrt(cfg.targets));
    const rows   = Math.ceil(cfg.targets / cols);
    const xStart = s.W * 0.55, xEnd = s.W * 0.94;
    const yStart = s.H * 0.15, yEnd = s.H * 0.85;

    for (let i = 0; i < cfg.targets; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const gx  = cols > 1 ? xStart + (col / (cols - 1)) * (xEnd - xStart) : (xStart + xEnd) / 2;
      
      const maxAmp = (s.H / 2) - cfg.targetR - 15;
      s.targets.push({ 
        x: gx, 
        baseY: s.H / 2, 
        y: s.H / 2, 
        r: cfg.targetR, 
        phase: Math.random() * Math.PI * 2, 
        amplitude: maxAmp, 
        hit: false, hitTimer: 0, outerDamaged: false 
      });
    }

    if (cfg.planets) {
      for (let i = 0; i < cfg.planets; i++) {
         const pR = 40 + Math.random() * 30;
         const maxAmp = (s.H / 2) - pR - 15;
         const hue = Math.floor(Math.random() * 360);

         s.planets.push({
           x: s.W * 0.35 + Math.random() * (s.W * 0.15),
           baseY: s.H / 2,
           y: s.H / 2, r: pR,
           phase: Math.random() * Math.PI * 2,
           amplitude: maxAmp,
           freq: 0.005 + Math.random() * 0.015,
           hue: hue,
           color: `hsl(${hue}, 60%, 40%)`
         });
      }
    }
    
    if (cfg.asteroids) {
      for (let i = 0; i < cfg.asteroids; i++) {
        const numPoints = 6 + Math.floor(Math.random() * 4);
        s.asteroids.push({
           x: s.W * 0.4 + Math.random() * (s.W * 0.4),
           y: Math.random() * s.H,
           vx: (Math.random() - 0.5) * 1.5,
           vy: (Math.random() - 0.5) * 2.5,
           r: 20 + Math.random() * 25,
           rot: Math.random() * Math.PI * 2,
           rotSpd: (Math.random() - 0.5) * 0.05,
           points: Array.from({length: numPoints}, (_, j) => {
              const a = (Math.PI * 2 * j) / numPoints;
              const dist = 0.6 + Math.random() * 0.4;
              return { x: Math.cos(a) * dist, y: Math.sin(a) * dist };
           })
        });
      }
    }

    if (cfg.rockets) {
      for (let i = 0; i < cfg.rockets; i++) {
        s.rockets.push({
          x: s.W * 0.6 + Math.random() * (s.W * 0.3),
          y: s.H + Math.random() * 500,
          vy: -3 - Math.random() * 3,
          r: 25,
          respawnY: s.H + 200 + Math.random() * 500
        });
      }
    }
    setTargetsLeft(cfg.targets);

    const bowX = s.W * 0.12, bowY = s.H * 0.5;

    function loop() {
      s.animId = requestAnimationFrame(loop);

      s.targets.forEach(t => {
        if (!t.hit) { t.phase += cfg.freq; t.y = t.baseY + Math.sin(t.phase) * t.amplitude; }
        else { t.hitTimer++; }
      });
      s.planets.forEach(p => {
         p.phase += p.freq; p.y = p.baseY + Math.sin(p.phase) * p.amplitude;
      });
      s.asteroids.forEach(a => {
         a.x += a.vx; a.y += a.vy; a.rot += a.rotSpd;
         if (a.x < 0) a.x = s.W; if (a.x > s.W) a.x = 0;
         if (a.y < 0) a.y = s.H; if (a.y > s.H) a.y = 0;
      });
      s.rockets.forEach(rk => {
         rk.y += rk.vy;
         if (rk.y < -50) rk.y = rk.respawnY;
      });

      for (let i = s.arrows.length - 1; i >= 0; i--) {
        const ar = s.arrows[i];
        ar.x += ar.vx; ar.y += ar.vy;

        let hitTarget = null;
        let hitObstacle = null;

        for (let j = 0; j < s.planets.length; j++) {
           const p = s.planets[j];
           if (Math.hypot(ar.x - p.x, ar.y - p.y) < p.r) {
             hitObstacle = p; break;
           }
        }
        if (!hitObstacle) {
           for (let j = 0; j < s.asteroids.length; j++) {
              if (Math.hypot(ar.x - s.asteroids[j].x, ar.y - s.asteroids[j].y) < s.asteroids[j].r * 1.2) {
                 hitObstacle = s.asteroids[j]; break;
              }
           }
        }
        if (!hitObstacle) {
           for (let j = 0; j < s.rockets.length; j++) {
              if (Math.hypot(ar.x - s.rockets[j].x, ar.y - s.rockets[j].y) < s.rockets[j].r) {
                 hitObstacle = s.rockets[j]; break;
              }
           }
        }

        if (!hitObstacle) {
          for (let j = 0; j < s.targets.length; j++) {
             const tgt = s.targets[j];
             if (!tgt.hit && Math.hypot(ar.x - tgt.x, ar.y - tgt.y) < tgt.r * 1.5) {
               hitTarget = tgt; break;
             }
          }
        }

        if (hitObstacle && !ar.exploded) {
           ar.exploded = true; spawnParticles(s, ar.x, ar.y, "#888888"); s.arrows.splice(i, 1);
        } else if (hitTarget && !ar.exploded) {
          ar.exploded = true; s.arrows.splice(i, 1);
          
          playSound("hit");
          spawnParticles(s, ar.x, ar.y);
          hitTarget.hit = true; s.hitsLanded++;
          const now = Date.now();
          if (now - s.lastHitTime < 3000) s.comboCount++; else s.comboCount = 1;
          s.lastHitTime = now;
          const points = s.shotsFired <= cfg.goldArrows ? 30 : 15;
          s.currScore += points; setScore(s.currScore); setCombo(s.comboCount);
          setHitsLanded(s.hitsLanded); setTargetsLeft(p => Math.max(0, p - 1));
          
          setAccuracy(s.shotsFired > 0 ? Math.round((s.hitsLanded / s.shotsFired) * 100) : 0);
        } else if (ar.x > s.W + 50 || ar.x < -50 || ar.y < -50 || ar.y > s.H + 50) {
          s.arrows.splice(i, 1);
        }
      }

      updateParticles(s);

      ctx.clearRect(0, 0, s.W, s.H);
      drawBackground(ctx, s.W, s.H);

      s.planets.forEach(p => drawPlanet(ctx, p));
      s.asteroids.forEach(a => drawAsteroid(ctx, a));
      s.rockets.forEach(rk => drawRocket(ctx, rk));

      s.targets.forEach(t => drawTarget(ctx, t));
      s.arrows.forEach(ar => drawFlyingArrow(ctx, ar));
      ctx.save(); drawBow(ctx, bowX, bowY, s.bowPull); ctx.restore();
      if (!s.isShooting && s.bowPull > 0) s.bowPull = Math.max(0, s.bowPull - 0.08);
      drawParticles(ctx, s);

      if (s.targets.every(t => t.hit) && s.targets.length > 0 && !s.ended) {
        s.ended = true; cancelAnimationFrame(s.animId);
        if (s.currScore >= cfg.reqScore) {
           setTimeout(() => setGameState(level === LEVEL_CONFIGS.length ? "win_all" : "level_complete"), 600);
        } else {
           setTimeout(() => setGameState("level_failed"), 600);
        }
      }
    }

    loop();

    const clickHandler = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = s.W / rect.width, scaleY = s.H / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top)  * scaleY;

      s.shotsFired++; setShotsFired(s.shotsFired);
      s.isShooting = true; s.bowPull = 1;
      setTimeout(() => { s.isShooting = false; }, 80);

      // Always shoot straight towards the clicked coordinate
      playSound("shoot");
      const dx = cx - (bowX + 28), dy = cy - bowY;
      const dist = Math.hypot(dx, dy);
      if (dist > 0) {
        s.arrows.push({ 
          x: bowX + 28, 
          y: bowY, 
          vx: (dx/dist)*ARROW_SPEED, 
          vy: (dy/dist)*ARROW_SPEED, 
          exploded: false 
        });
      }

      setAccuracy(s.shotsFired > 0 ? Math.round((s.hitsLanded / s.shotsFired) * 100) : 0);
    };

    canvas.addEventListener("click", clickHandler);
    s.clickHandler = clickHandler;
    return () => { cancelAnimationFrame(s.animId); canvas.removeEventListener("click", clickHandler); };
  }, [gameState, level]);

  /* ── Timer ── */
  useEffect(() => {
    if (gameState !== "play") return;
    const cfg = LEVEL_CONFIGS[level - 1];
    setTimeLeft(cfg.timeLimit);
    let remaining = cfg.timeLimit;
    const iv = setInterval(() => {
      remaining--;
      setTimeLeft(remaining);
      if (remaining <= 0) { clearInterval(iv); cancelAnimationFrame(stateRef.current.animId); setGameState("session_complete"); }
    }, 1000);
    return () => clearInterval(iv);
  }, [gameState, level]);

  /* ── Actions ── */
  const handleNextLevel = useCallback(() => {
    setCombo(0); setScore(0); setShotsFired(0); setHitsLanded(0); setAccuracy(0);
    setLevel(l => l + 1);
    setGameState("idle");
    setTimeout(() => setGameState("play"), 50);
  }, []);

  const handleRestart = useCallback(() => {
    setCombo(0); setScore(0); setShotsFired(0); setHitsLanded(0); setAccuracy(0);
    setLevel(1); setGameState("idle");
    setTimeout(() => setGameState("play"), 50);
  }, []);

  const handleRetryLevel = useCallback(() => {
    setCombo(0); setScore(0); setShotsFired(0); setHitsLanded(0); setAccuracy(0);
    setGameState("idle");
    setTimeout(() => setGameState("play"), 50);
  }, []);

  const startGame = () => {
    setCombo(0); setScore(0); setShotsFired(0); setHitsLanded(0); setAccuracy(0);
    setLevel(1);
    if (onRunningChange) onRunningChange(true);
    setGameState("play");
  };

  /* ── Render ── */
  return (
    <div className="ssp-root">
      <canvas ref={canvasRef} className="ssp-canvas" style={{ display: gameState === "play" ? "block" : "none" }} />

      {/* HUD */}
      {gameState === "play" && (
        <div className="ssp-hud">
          <div className="ssp-hud-cell">
            <span className="ssp-hud-lbl">SCORE</span>
            <span className="ssp-hud-val gold">{score.toLocaleString()}</span>
          </div>
          <div className="ssp-hud-cell">
            <span className="ssp-hud-lbl">LEVEL</span>
            <span className="ssp-hud-val cyan">{level}/{LEVEL_CONFIGS.length}</span>
            <span className="ssp-hud-sub">{LEVEL_CONFIGS[level-1]?.description}</span>
          </div>
          <div className={`ssp-hud-cell ${combo > 1 ? "combo-hot" : ""}`}>
            <span className="ssp-hud-lbl">COMBO</span>
            <span className="ssp-hud-val yellow">{combo}×</span>
          </div>
          <div className="ssp-hud-cell">
            <span className="ssp-hud-lbl">TARGETS</span>
            <span className="ssp-hud-val green">{targetsLeft}</span>
          </div>
          <div className="ssp-hud-cell">
            <span className="ssp-hud-lbl">ACCURACY</span>
            <span className="ssp-hud-val cyan">{accuracy}%</span>
          </div>
          <div className={`ssp-hud-cell ${timeLeft <= 10 ? "time-danger" : ""}`}>
            <span className="ssp-hud-lbl">TIME</span>
            <span className="ssp-hud-val">{timeLeft}s</span>
          </div>
        </div>
      )}

      {/* Start */}
      {gameState === "start" && (
        <div className="ssp-overlay ssp-fade-in">
          <div className="ssp-card ssp-slide-up">
            <h1 className="ssp-title ssp-pulse">🏹 SKY SHOT PRO</h1>
            <p className="ssp-subtitle">Precision Archery · Eye–Hand Coordination</p>
            <div className="ssp-instructions">
              <div className="ssp-instr-row">🎯 <span>Hit the targets cleanly to destroy them for <b>30pts</b>!</span></div>
              <div className="ssp-instr-row">🪐 <span>Avoid shooting the <b>Planetary Obstacles</b> mid-air!</span></div>
              <div className="ssp-instr-row">⭐ <span>Meet the required <b>Target Score</b> to win the level!</span></div>
            </div>
            <button className="ssp-btn" onClick={startGame}>START CHALLENGE</button>
          </div>
        </div>
      )}

      {/* Level Complete */}
      {gameState === "level_complete" && (
        <div className="ssp-overlay ssp-overlay--success ssp-fade-in">
          <div className="ssp-card ssp-slide-up">
            <h1 className="ssp-title green ssp-bounce">🎉 LEVEL {level} COMPLETE!</h1>
            <div className="ssp-stats-grid">
              <div className="ssp-stat-item"><span className="ssp-stat-lbl">Score</span><span className="ssp-stat-val gold">{score.toLocaleString()}</span></div>
              <div className="ssp-stat-item"><span className="ssp-stat-lbl">Accuracy</span><span className="ssp-stat-val cyan">{accuracy}%</span></div>
              <div className="ssp-stat-item"><span className="ssp-stat-lbl">Best Combo</span><span className="ssp-stat-val yellow">{combo}×</span></div>
              <div className="ssp-stat-item"><span className="ssp-stat-lbl">Shots / Hits</span><span className="ssp-stat-val">{hitsLanded}/{shotsFired}</span></div>
            </div>
            {level < LEVEL_CONFIGS.length && (
              <button className="ssp-btn ssp-btn--green" onClick={handleNextLevel}>NEXT LEVEL →</button>
            )}
          </div>
        </div>
      )}

      {/* Level Failed (Math Required Score Not Met) */}
      {gameState === "level_failed" && (
        <div className="ssp-overlay ssp-overlay--danger ssp-fade-in">
          <div className="ssp-card ssp-slide-up" style={{borderColor: "#ff2a55", boxShadow: "0 0 30px rgba(255, 42, 85, 0.4)"}}>
            <h1 className="ssp-title ssp-wobble" style={{color: "#ff2a55"}}>❌ LEVEL FAILED</h1>
            <p className="ssp-subtitle">You didn't reach the required target score!</p>
            <div className="ssp-stats-grid">
              <div className="ssp-stat-item">
                 <span className="ssp-stat-lbl">Final Score</span>
                 <span className="ssp-stat-val gold">{score.toLocaleString()}</span>
              </div>
              <div className="ssp-stat-item">
                 <span className="ssp-stat-lbl">Required Score</span>
                 <span className="ssp-stat-val cyan">{LEVEL_CONFIGS[level-1]?.reqScore.toLocaleString()}</span>
              </div>
            </div>
            <button className="ssp-btn" style={{background: "linear-gradient(90deg, #a00, #ff2a55)"}} onClick={handleRetryLevel}>RETRY LEVEL {level}</button>
          </div>
        </div>
      )}

      {/* Victory */}
    {gameState === "win_all" && (() => {
        let isGold = false; let trophy = "🥉 BRONZE"; let tColor = "#cd7f32";
        if (score >= 300) { trophy = "🥇 GOLD TROPHY"; tColor = "#ffd700"; isGold = true; }
        else if (score >= 210) { trophy = "🥈 SILVER TROPHY"; tColor = "#c0c0c0"; }
        
        return (
        <div className="ssp-overlay ssp-overlay--gold ssp-fade-in">
          <div className="ssp-card ssp-slide-up">
            <h1 className="ssp-title ssp-wobble" style={{color: tColor}}>{trophy} ARCHER</h1>
            <p className="ssp-subtitle">You have successfully completed the game!</p>
            {isGold && <p style={{color: "#ffd700", fontWeight: "bold", fontStyle: "italic", marginBottom: "15px", animation: "ssp-pulse 2s infinite"}}>🎁 Special Gift: Ultimate Bow Mastery Unlocked!</p>}
            <div className="ssp-stats-grid">
              <div className="ssp-stat-item"><span className="ssp-stat-lbl">Total Score</span><span className="ssp-stat-val gold">{score.toLocaleString()}</span></div>
              <div className="ssp-stat-item"><span className="ssp-stat-lbl">Final Accuracy</span><span className="ssp-stat-val cyan">{accuracy}%</span></div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 8 }}>
              <button className="ssp-btn ssp-btn--gold" onClick={() => { submitScore({ gameName:"sky-shot-pro", rawScore: score }); if(onClose) onClose(); }}>SAVE &amp; EXIT</button>
              <button className="ssp-btn ssp-btn--ghost" onClick={handleRestart}>PLAY AGAIN</button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Time's Up */}
      {gameState === "session_complete" && (
        <div className="ssp-overlay ssp-overlay--red ssp-fade-in">
          <div className="ssp-card ssp-slide-up">
            <h1 className="ssp-title red">⏱️ TIME'S UP!</h1>
            <p className="ssp-subtitle">Level {level} — {LEVEL_CONFIGS[level-1]?.description}</p>
            <div className="ssp-stats-grid">
              <div className="ssp-stat-item"><span className="ssp-stat-lbl">Score</span><span className="ssp-stat-val gold">{score.toLocaleString()}</span></div>
              <div className="ssp-stat-item"><span className="ssp-stat-lbl">Accuracy</span><span className="ssp-stat-val cyan">{accuracy}%</span></div>
              <div className="ssp-stat-item"><span className="ssp-stat-lbl">Hits / Shots</span><span className="ssp-stat-val">{hitsLanded}/{shotsFired}</span></div>
              <div className="ssp-stat-item"><span className="ssp-stat-lbl">Best Combo</span><span className="ssp-stat-val yellow">{combo}×</span></div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 8 }}>
              <button className="ssp-btn" onClick={handleRestart}>TRY AGAIN</button>
              <button className="ssp-btn ssp-btn--ghost" onClick={() => { submitScore({ gameName:"sky-shot-pro", rawScore: score }); if(onClose) onClose(); }}>SAVE &amp; EXIT</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}