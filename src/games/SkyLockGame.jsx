import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import jetImg from "../assets/jetplane.png";
import "../styles/SkyLockGame.css";

// ── Constants ──────────────────────────────────────────────────────────────
const LEVELS = [
  {
    id: 1, label: "Training Mode", color: "#00ff88",
    speed: 0.04, obstacleCount: 6, birdCount: 0, droneCount: 0,
    gapSize: 9, fogDensity: 0.003, desc: "Gentle speed. Navigate winding neon city.",
  },
  {
    id: 2, label: "Urban Flight", color: "#00c8ff",
    speed: 0.06, obstacleCount: 10, birdCount: 0, droneCount: 2,
    gapSize: 7, fogDensity: 0.005, desc: "Tight city turns with drones.",
  },
  {
    id: 3, label: "Dynamic Hazards", color: "#ff9500",
    speed: 0.08, obstacleCount: 14, birdCount: 2, droneCount: 4,
    gapSize: 6, fogDensity: 0.008, desc: "Faster turns, moving hurdles.",
  },
  {
    id: 4, label: "Precision Mode", color: "#ff2d55",
    speed: 0.11, obstacleCount: 18, birdCount: 4, droneCount: 8,
    gapSize: 4.5, fogDensity: 0.012, desc: "Narrow urban canyons.",
  },
];

const PASSENGER_MAX = 100;
const TRACK_LENGTH = 800;
const COLLISION_DAMAGE = 34; // 3 hits = crash

// ── Helper: build procedural sky gradient texture ──────────────────────────
// ── Helper: build procedural sky gradient texture ──────────────────────────
function mkSkyTex() {
  const c = Object.assign(document.createElement("canvas"), { width: 4, height: 512 });
  const x = c.getContext("2d"), g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#010105"); g.addColorStop(0.3, "#040212");
  g.addColorStop(0.6, "#150220"); g.addColorStop(0.85, "#300840");
  g.addColorStop(1, "#f50080");
  x.fillStyle = g; x.fillRect(0, 0, 4, 512);
  return new THREE.CanvasTexture(c);
}

// ── Helper: build 3D jet body ──────────────────────────────────────────────
function buildJet() {
  const g = new THREE.Group();
  
  // Use jetplane.png asset
  const texLoader = new THREE.TextureLoader();
  const tex = texLoader.load(jetImg);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  // Aspect ratio roughly 3:1
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.5), mat);
  mesh.position.set(0, 0, 0);
  g.add(mesh);

  // Add subtle engine glows behind the sprite
  [-0.9, 0.9].forEach(s => {
    const ex = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), new THREE.MeshBasicMaterial({ color: 0x00f5ff }));
    ex.position.set(s, -0.4, -0.1); 
    g.add(ex);
  });

  return g;
}

// ── Helper: build obstacle (skyscraper-like pillar with gap) ───────────────
function buildObstaclePair(gapY, gapSize, x, z, isUrban, color) {
  const g = new THREE.Group();
  // Bright Danger Red for obstacles to be completely evident!
  const mat = new THREE.MeshPhongMaterial({ color: 0xff1133, emissive: 0x440011, shininess: 90 });

  const totalH = 60;
  const halfGap = gapSize / 2;

  // Top pillar
  const topH = totalH / 2 - gapY - halfGap;
  if (topH > 0) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.5, topH, 2.5), mat);
    top.position.set(0, gapY + halfGap + topH / 2, 0);
    g.add(top);
    // Warning light on top
    const warnL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color }));
    warnL.position.set(0, gapY + halfGap + topH + 0.3, 0); g.add(warnL);
  }

  // Bottom pillar
  const botH = totalH / 2 + gapY - halfGap;
  if (botH > 0) {
    const bot = new THREE.Mesh(new THREE.BoxGeometry(2.5, botH, 2.5), mat);
    bot.position.set(0, gapY - halfGap - botH / 2, 0);
    g.add(bot);
  }

  // Neon edge glow strips
  [-1, 1].forEach(s => {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.07, gapSize * 0.35, 0.07), new THREE.MeshBasicMaterial({ color }));
    strip.position.set(s * 1.28, gapY, 1.28); g.add(strip);
    const strip2 = strip.clone();
    strip2.position.set(s * 1.28, gapY, -1.28); g.add(strip2);
  });

  g.position.set(x, 0, z);
  return g;
}

// ── Helper: build moving bird/drone ───────────────────────────────────────
function buildBird() {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color: 0x333333, shininess: 20 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mat);
  g.add(body);
  [-1, 1].forEach(s => {
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.3), new THREE.MeshBasicMaterial({ color: 0x444444, side: THREE.DoubleSide }));
    wing.position.set(s * 0.42, 0.05, 0); wing.rotation.y = s * 0.3; g.add(wing);
  });
  return g;
}

function buildDrone() {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color: 0xff5722, shininess: 80 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.6), mat);
  g.add(body);
  // Four arm propellers
  [[0.45, 0.45], [-0.45, 0.45], [0.45, -0.45], [-0.45, -0.45]].forEach(([px, pz]) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 0.07), new THREE.MeshPhongMaterial({ color: 0x333 }));
    arm.position.set(px * 0.5, 0.1, pz * 0.5); arm.rotation.y = Math.atan2(pz, px); g.add(arm);
    const prop = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 6), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.7 }));
    prop.position.set(px, 0.18, pz); g.add(prop);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
    led.position.set(px, 0.2, pz); g.add(led);
  });
  return g;
}

// ── Helper: build cloud ────────────────────────────────────────────────────
function buildCloud() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  [[0,0,0,1.4], [1.2,0.4,0,1.0], [-1.0,0.3,0,0.9], [0.5,-0.3,0.5,0.8]].forEach(([cx,cy,cz,cr]) => {
    const c = new THREE.Mesh(new THREE.SphereGeometry(cr, 8, 6), mat);
    c.position.set(cx, cy, cz); g.add(c);
  });
  return g;
}

// ── Helper: build mountain ─────────────────────────────────────────────────
function buildMountain(h, col) {
  const geo = new THREE.ConeGeometry(h * 0.55, h, 6 + Math.floor(Math.random() * 4));
  const m = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color: col, shininess: 5 }));
  // Snow cap
  const cap = new THREE.Mesh(new THREE.ConeGeometry(h * 0.18, h * 0.2, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  cap.position.y = h * 0.44; m.add(cap);
  return m;
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════
export default function SkyLockGame({ onClose, gazePosRef }) {
  const mountRef = useRef(null);
  const rafRef = useRef(null);
  const keysRef = useRef({});
  const mouseRef = useRef({ x: 0, y: 0 });
  const propsRef = useRef({});

  const [phase, setPhase] = useState("menu"); // menu | play | paused | result
  const [levelIdx, setLevelIdx] = useState(0);
  const [passengerHP, setPassengerHP] = useState(PASSENGER_MAX);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [altitude, setAltitude] = useState(1000);
  const [alignScore, setAlignScore] = useState(100);
  const [collisions, setCollisions] = useState(0);
  const [missionResult, setMissionResult] = useState(null); // { win, score, align, time }
  const [flashRed, setFlashRed] = useState(false);
  const [lockWarning, setLockWarning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  propsRef.current = { levelIdx, passengerHP, progress };

  // ── KEYBOARD INPUT ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => { keysRef.current[e.code] = e.type === "keydown"; };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey); };
  }, []);

  // ── MOUSE ──────────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e) => {
    const el = mountRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    mouseRef.current = {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
    };
  }, []);

  // ── THREE.JS GAME LOOP ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "play") return;
    const mount = mountRef.current;
    if (!mount) return;

    const level = LEVELS[levelIdx];
    let hp = PASSENGER_MAX;
    let prog = 0;
    let elapsedSec = 0;
    let totalAlignSum = 0, alignFrames = 0;
    let collisionCount = 0;
    let jetVelX = 0, jetVelY = 0;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = false; // Disabled for major performance boost
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    mount.appendChild(renderer.domElement);

    // ── Scene ──
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x1a052b, level.fogDensity);
    scene.background = new THREE.Color(0x1a052b);

    // Sky sphere
    const skyGeo = new THREE.SphereGeometry(600, 16, 12);
    skyGeo.scale(-1, 1, 1);
    scene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ map: mkSkyTex(), side: THREE.BackSide })));

    // ── Camera ──
    const camera = new THREE.PerspectiveCamera(68, mount.clientWidth / mount.clientHeight, 0.1, 600);

    // ── Lighting ──
    scene.add(new THREE.AmbientLight(0xb0c8e8, 1.8));
    const sun = new THREE.DirectionalLight(0xfff5e0, 2.5);
    sun.position.set(60, 120, -80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { near: 1, far: 400, left: -80, right: 80, top: 80, bottom: -80 });
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x448853, 0.8));

    // ── Player Jet ──
    const jet = buildJet();
    jet.position.set(0, 0, 0);
    scene.add(jet);

    // Engine exhaust light (follows jet)
    const exhaustLight = new THREE.PointLight(0x00f5ff, 3.5, 12);
    scene.add(exhaustLight);

    // ── Ground ── (visible below)
    const groundG = new THREE.PlaneGeometry(800, TRACK_LENGTH + 200);
    const groundTex = new THREE.GridHelper(800, 80, 0x00f5ff, 0x111122);
    groundTex.position.set(0, -18, -(TRACK_LENGTH / 2));
    scene.add(groundTex);

    // Cyberpunk City (Optimized count for performance)
    for (let i = 0; i < 50; i++) {
      const h = 25 + Math.random() * 80;
      const w = 12 + Math.random() * 25;
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, w), 
        new THREE.MeshPhongMaterial({ color: 0x080812, specular: 0xff00aa, shininess: 80 })
      );
      
      const z = -(Math.random() * TRACK_LENGTH);
      const curveX = Math.sin(z * 0.01) * 20; // track winding
      const side = Math.random() > 0.5 ? 1 : -1;
      
      b.position.set(curveX + side * (18 + Math.random() * 80), -18 + h / 2, z);
      
      // glowing windows
      if (Math.random() > 0.3) {
        const glowColor = Math.random() > 0.5 ? 0x00f5ff : 0xff00aa;
        const glow = new THREE.Mesh(new THREE.BoxGeometry(0.8, h*0.9, 0.8), new THREE.MeshBasicMaterial({ color: glowColor }));
        glow.position.set(side * (w/2), 0, 0); b.add(glow);
      }
      scene.add(b);
    }

    // ── Neon Arches / Holograms ──
    const arches = [];
    for (let i = 0; i < 15; i++) {
      const z = -(Math.random() * TRACK_LENGTH);
      const curveX = Math.sin(z * 0.01) * 20;

      const archGeo = new THREE.TorusGeometry(12 + Math.random() * 6, 0.3, 6, 24, Math.PI);
      const archMat = new THREE.MeshBasicMaterial({ 
        color: Math.random() > 0.5 ? 0x00f5ff : (Math.random() > 0.5 ? 0xff00aa : 0xccff00), 
        transparent: true, opacity: 0.7 
      });
      const arch = new THREE.Mesh(archGeo, archMat);
      arch.position.set(curveX, -5, z);
      arch.rotation.z = (Math.random() - 0.5) * 0.4;
      scene.add(arch);
      arches.push(arch);
    }

    // ── Obstacles (pillar hurdles) ──
    const obstacles = [];
    const margin = 30;
    for (let i = 0; i < level.obstacleCount; i++) {
      const z = -(margin + (i / level.obstacleCount) * (TRACK_LENGTH - margin * 2));
      const curveX = Math.sin(z * 0.01) * 20;
      const x = curveX + (Math.random() - 0.5) * 8;
      const gapY = (Math.random() - 0.5) * 6; // center of gap offset
      const col = new THREE.Color(level.color).getHex();
      const pair = buildObstaclePair(gapY, level.gapSize, x, z, true, col);
      scene.add(pair);
      obstacles.push({ mesh: pair, gapY, gapSize: level.gapSize, x, z });
    }

    // ── Moving birds ──
    const birds = [];
    for (let i = 0; i < level.birdCount; i++) {
      const bird = buildBird();
      const bz = -(30 + Math.random() * (TRACK_LENGTH - 60));
      bird.position.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 8, bz);
      bird.userData = { baseX: bird.position.x, baseY: bird.position.y, phase: Math.random() * Math.PI * 2, speed: 0.6 + Math.random() * 1.2 };
      scene.add(bird);
      birds.push(bird);
    }

    // ── Moving drones ──
    const drones = [];
    for (let i = 0; i < level.droneCount; i++) {
      const drone = buildDrone();
      const dz = -(40 + Math.random() * (TRACK_LENGTH - 80));
      drone.position.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 7, dz);
      drone.userData = { baseX: drone.position.x, baseY: drone.position.y, phase: Math.random() * Math.PI * 2, speed: 1.0 + Math.random() * 2.0, dir: Math.random() > 0.5 ? 1 : -1 };
      scene.add(drone);
      drones.push(drone);
    }

    // ── Finish marker ──
    const finishGeo = new THREE.TorusGeometry(6, 0.4, 10, 24);
    const finishMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    const finishRing = new THREE.Mesh(finishGeo, finishMat);
    finishRing.position.set(0, 0, -(TRACK_LENGTH - 10));
    scene.add(finishRing);
    // Glow
    const finGlow = new THREE.PointLight(0xffd700, 6, 30);
    finGlow.position.copy(finishRing.position);
    scene.add(finGlow);

    // Finish sign sprite
    const fc = Object.assign(document.createElement("canvas"), { width: 512, height: 128 });
    const fx = fc.getContext("2d");
    fx.fillStyle = "#ffd700"; fx.font = "bold 80px monospace"; fx.textAlign = "center"; fx.textBaseline = "middle";
    fx.shadowColor = "#fff"; fx.shadowBlur = 20; fx.fillText("✈️ DESTINATION", 256, 64);
    const finSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(fc), transparent: true }));
    finSprite.scale.set(20, 5, 1); finSprite.position.set(0, 8, -(TRACK_LENGTH - 10));
    scene.add(finSprite);

    // ── Engine particles (exhaust trail) ──
    const PC = 60;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(PC * 3);
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0x00c8ff, size: 0.28, transparent: true, opacity: 0.8 });
    scene.add(new THREE.Points(pGeo, pMat));
    const pSt = Array.from({ length: PC }, () => ({ x: 0, y: 0, z: 0, life: 0 }));

    // ── Resize ──
    const ro = new ResizeObserver(() => {
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    // ── Collision detection ──
    const jetBox = new THREE.Box3();
    const obsBox = new THREE.Box3();
    const jetSphere = new THREE.Sphere();
    let lastCollisionTime = 0;
    let ended = false;

    let prevT = performance.now();
    let pulseCycle = 0;

    // ── ANIMATE LOOP ──
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min((now - prevT) / 1000, 0.05); prevT = now;
      elapsedSec += dt; pulseCycle += dt;

      if (ended) return;

      const keys = keysRef.current;
      const mouse = mouseRef.current;

      // ── Jet control: WASD + mouse (full cursor control) ──
      let inputX = 0, inputY = 0;
      if (keys["ArrowLeft"] || keys["KeyA"]) inputX -= 1;
      if (keys["ArrowRight"] || keys["KeyD"]) inputX += 1;
      if (keys["ArrowUp"] || keys["KeyW"]) inputY += 1;
      if (keys["ArrowDown"] || keys["KeyS"]) inputY -= 1;

      // Mouse steering completely controls it now
      inputX += mouse.x * 1.5;
      inputY += mouse.y * 1.5;

      // Make jet follow the winding curve of the neon city
      const currentCurveX = Math.sin(jet.position.z * 0.01) * 20;

      // Face cursor override (highest priority, direct position mapping)
      if (gazePosRef && gazePosRef.current && gazePosRef.current.x > 0) {
        const el = mountRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          const gx = ((gazePosRef.current.x - rect.left) / rect.width) * 2 - 1; // -1 to 1
          const gy = -((gazePosRef.current.y - rect.top) / rect.height) * 2 + 1; // -1 to 1
          
          const targetX = currentCurveX + gx * 14.0;
          const targetY = gy * 10.0 + 2; // slight base elevation

          // Compute fake velocity for banking animation
          jetVelX = (targetX - jet.position.x) * 3.0;
          jetVelY = (targetY - jet.position.y) * 3.0;
          
          // Firm drag towards gaze position
          jet.position.x += (targetX - jet.position.x) * 0.2;
          jet.position.y += (targetY - jet.position.y) * 0.2;
        }
      } else {
        // Smooth velocity (Mouse/Keyboard fallback)
        const targetVX = Math.max(-1, Math.min(1, inputX)) * 5.0;
        const targetVY = Math.max(-1, Math.min(1, inputY)) * 4.0;
        jetVelX += (targetVX - jetVelX) * 0.12;
        jetVelY += (targetVY - jetVelY) * 0.12;
        
        jet.position.x = currentCurveX + jetVelX * 2.5;
        jet.position.y = Math.max(-10, Math.min(14, jet.position.y + jetVelY * dt));
      }

      // ── Forward flight physics! (EVEN GENTLER SPEED) ──
      const fwSpeed = 12 + level.speed * 60;
      jet.position.z -= fwSpeed * dt;
      prog = Math.min(1, Math.abs(jet.position.z) / TRACK_LENGTH);

      // Jet banking (sprite tilt)
      jet.rotation.z = Math.PI / 8 * -jetVelX;
      jet.rotation.x = Math.PI / 16 * jetVelY;
      jet.rotation.y = -jetVelX * 0.03;

      // Update exhaust light
      exhaustLight.position.set(jet.position.x, jet.position.y, jet.position.z + 2.5);

      // ── Alignment score ──
      const centerDist = Math.abs(jetVelX) / 5;
      const frameAlign = Math.max(0, 1 - centerDist);
      totalAlignSum += frameAlign; alignFrames++;

      // ── Camera follows jet gently ──
      const camTargetX = currentCurveX + jetVelX * 0.5;
      camera.position.set(camTargetX, jet.position.y * 0.4 + 3.0, jet.position.z + 10);
      camera.lookAt(camTargetX, jet.position.y * 0.1, jet.position.z - 30);

      // ── Animate Arches ──
      arches.forEach((arch, i) => {
        arch.material.opacity = 0.4 + Math.sin(pulseCycle * 5 + i * 0.5) * 0.3;
      });

      // ── Birds / drones move ──
      // Need to adjust their relative Z so they stay in front of the moving jet if far
      birds.forEach(b => {
        b.userData.phase += dt * b.userData.speed;
        b.position.x = b.userData.baseX + Math.sin(b.userData.phase) * 5;
        b.position.y = b.userData.baseY + Math.cos(b.userData.phase * 1.3) * 2.5;
        b.rotation.y = Math.cos(b.userData.phase) * 0.5;
      });
      drones.forEach(d => {
        d.userData.phase += dt * d.userData.speed * 0.5;
        d.position.x = d.userData.baseX + Math.sin(d.userData.phase) * 6 * d.userData.dir;
        d.position.y = d.userData.baseY + Math.sin(d.userData.phase * 1.7) * 3;
      });

      // ── Engine exhaust particles ──
      for (let i = 0; i < 3; i++) {
        const d = pSt.findIndex(p => p.life <= 0);
        if (d >= 0) {
          const p = pSt[d];
          [p.x, p.y, p.z] = [jet.position.x + (Math.random() - 0.5) * 0.3, jet.position.y + (Math.random() - 0.5) * 0.2, jet.position.z + 2.1];
          p.life = 0.3 + Math.random() * 0.3;
        }
      }
      for (let i = 0; i < PC; i++) {
        const p = pSt[i];
        if (p.life > 0) { p.life -= dt; p.z += 0.2; }
        pPos[i * 3] = p.life > 0 ? p.x : 9999;
        pPos[i * 3 + 1] = p.life > 0 ? p.y : 9999;
        pPos[i * 3 + 2] = p.life > 0 ? p.z : 9999;
      }
      pGeo.attributes.position.needsUpdate = true;

      // ── Finish ring pulse ──
      finGlow.intensity = 5 + 3 * Math.sin(pulseCycle * 4);
      finishRing.rotation.z += dt * 0.5;

      // ── Collision detection ──
      jetSphere.center.copy(jet.position); jetSphere.radius = 1.3;
      if (now - lastCollisionTime > 1200) {
        // Obstacles
        obstacles.forEach(obs => {
          if (Math.abs(obs.z - jet.position.z) > 4) return;
          // Check if jet is safely inside the gap
          const safeX = Math.abs(jet.position.x - obs.x) < obs.gapSize * 0.45;
          const safeY = Math.abs(jet.position.y - obs.gapY) < obs.gapSize * 0.4;
          if (!safeX || !safeY) {
            // Hit pillar!
            lastCollisionTime = now;
            hp = Math.max(0, hp - COLLISION_DAMAGE);
            collisionCount++;
            setPassengerHP(hp);
            setCollisions(collisionCount);
            setFlashRed(true);
            setTimeout(() => setFlashRed(false), 1000);
          }
        });

        // Birds
        birds.forEach(b => {
          if (Math.abs(b.position.z - jet.position.z) < 2 && new THREE.Sphere(b.position, 1.1).intersectsSphere(jetSphere)) {
            lastCollisionTime = now;
            hp = Math.max(0, hp - COLLISION_DAMAGE * 0.6);
            collisionCount++;
            setPassengerHP(hp);
            setCollisions(collisionCount);
            setFlashRed(true);
            setTimeout(() => setFlashRed(false), 1000);
          }
        });

        // Drones
        drones.forEach(d => {
          if (Math.abs(d.position.z - jet.position.z) < 2 && new THREE.Sphere(d.position, 1.3).intersectsSphere(jetSphere)) {
            lastCollisionTime = now;
            hp = Math.max(0, hp - COLLISION_DAMAGE);
            collisionCount++;
            setPassengerHP(hp);
            setCollisions(collisionCount);
            setFlashRed(true);
            setTimeout(() => setFlashRed(false), 1000);
          }
        });
      }

      // ── Update React state (throttled) ──
      if (Math.floor(elapsedSec * 4) !== Math.floor((elapsedSec - dt) * 4)) {
        setProgress(prog);
        setSpeed(Math.round(280 + level.speed * 2000 + (Math.abs(jetVelX) + Math.abs(jetVelY)) * 20));
        setAltitude(Math.round(1000 + jet.position.y * 18));
        setAlignScore(Math.round(frameAlign * 100));
        setElapsed(Math.round(elapsedSec));
        setLockWarning(Math.abs(jet.position.x) > 10 || Math.abs(jet.position.y) > 12);
      }

      // ── Mission end ──
      if (hp <= 0 && !ended) {
        ended = true;
        const finalAlign = alignFrames > 0 ? Math.round((totalAlignSum / alignFrames) * 100) : 0;
        const score = Math.round(prog * 100 * 10 - collisionCount * 80 + finalAlign * 3);
        setMissionResult({ win: false, score: Math.max(0, score), align: finalAlign, time: Math.round(elapsedSec), collisions: collisionCount });
        setPhase("result");
      }
      if (prog >= 1.0 && !ended) {
        ended = true;
        const finalAlign = alignFrames > 0 ? Math.round((totalAlignSum / alignFrames) * 100) : 0;
        const score = Math.round(1000 - collisionCount * 80 + finalAlign * 5 - elapsedSec * 0.5);
        setMissionResult({ win: true, score: Math.max(100, score), align: finalAlign, time: Math.round(elapsedSec), collisions: collisionCount });
        setPhase("level_passed");

        setTimeout(() => {
          if (levelIdx < LEVELS.length - 1) {
            setLevelIdx(levelIdx + 1);
            setPassengerHP(PASSENGER_MAX);
            setProgress(0);
            setCollisions(0);
            setElapsed(0);
            setPhase("play");
          } else {
            setPhase("result");
          }
        }, 3500);
      }

      renderer.render(scene, camera);
    };
    animate();

    // ── Cleanup ──
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) [].concat(o.material).forEach(m => m.dispose());
      });
    };
  }, [phase, levelIdx]);

  // ── Passanger HP colour ──
  const hpColor = passengerHP > 60 ? "#00ff88" : passengerHP > 30 ? "#ff9500" : "#ff2d55";

  return (
    <div className="nf-root" onMouseMove={handleMouseMove}>
      {/* 3D mount */}
      <div ref={mountRef} className="nf-three-mount" />

      {/* ── Red flash on collision ── */}
      {flashRed && (
        <div className="nf-flash-red" style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          animation: 'none', opacity: 0.9, backgroundColor: 'rgba(255, 0, 0, 0.5)', zIndex: 100
        }}>
           <h1 style={{ color: 'white', fontSize: '3rem', fontWeight: 'bold', textShadow: '0 0 20px #ff0000' }}>
             ⚠️ PASSENGERS IN TROUBLE ⚠️
           </h1>
        </div>
      )}
      {lockWarning && phase === "play" && <div className="nf-warning-border" />}

      {/* ── HUD ── */}
      {phase === "play" && (
        <>
          {/* Top bar */}
          <div className="nf-hud-top">
            <div className="nf-hud-cell" style={{ minWidth: 140 }}>
              <span className="nf-lbl">ROUTE</span>
              <span style={{ color: '#00f5ff', fontSize: '0.85rem', fontWeight: 'bold', letterSpacing: 1 }}>Source ➔ Dest</span>
            </div>
            <div className="nf-hud-cell">
              <span className="nf-lbl">LEVEL</span>
              <span className="nf-val" style={{ color: LEVELS[levelIdx].color }}>{LEVELS[levelIdx].label}</span>
            </div>
            <div className="nf-hud-cell">
              <span className="nf-lbl">SPEED</span>
              <span className="nf-val">{speed}<span className="nf-unit">km/h</span></span>
            </div>
            <div className="nf-hud-cell nf-progress-cell">
              <span className="nf-lbl">MISSION PROGRESS</span>
              <div className="nf-prog-bar">
                <div className="nf-prog-fill" style={{ width: `${progress * 100}%`, background: LEVELS[levelIdx].color }} />
              </div>
              <span style={{ color: LEVELS[levelIdx].color, fontSize: "0.8rem", fontFamily: "monospace" }}>{Math.round(progress * 100)}%</span>
            </div>
            <div className="nf-hud-cell">
              <span className="nf-lbl">ALTITUDE</span>
              <span className="nf-val">{altitude}<span className="nf-unit">m</span></span>
            </div>
            <div className="nf-hud-cell">
              <span className="nf-lbl">TIME</span>
              <span className="nf-val">{String(Math.floor(elapsed / 60)).padStart(2,"0")}:{String(elapsed % 60).padStart(2,"0")}</span>
            </div>
          </div>

          {/* Bottom-left: Passenger status */}
          <div className="nf-passenger-panel">
            <div className="nf-pass-title">👨‍✈️ PASSENGER SAFETY</div>
            <div className="nf-pass-bar-wrap">
              <div className="nf-pass-bar" style={{ width: `${passengerHP}%`, background: hpColor }} />
            </div>
            <div style={{ color: hpColor, fontSize: "0.75rem", fontFamily: "monospace", marginTop: 2 }}>
              {passengerHP > 60 ? "✅ Calm" : passengerHP > 30 ? "⚠️ Stressed" : "🚨 DANGER"}
            </div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.65rem", marginTop: 4 }}>
              Collisions: <span style={{ color: "#ff9500" }}>{collisions}</span>
            </div>
          </div>

          {/* Bottom-right: Radar */}
          <div className="nf-radar-panel">
            <div className="nf-radar-circle">
              <div className="nf-radar-sweep" />
              <div className="nf-radar-label">RADAR</div>
            </div>
            <div style={{ color: "#00ff88", fontSize: "0.6rem", textAlign: "center", marginTop: 4, letterSpacing: 1 }}>
              ALIGN: <span style={{ color: alignScore > 70 ? "#00ff88" : "#ff9500" }}>{alignScore}%</span>
            </div>
          </div>

          {/* Alignment warning */}
          {lockWarning && (
            <div className="nf-align-warn">⚠️ REALIGN FLIGHT PATH</div>
          )}

          {/* Control hint */}
          <div className="nf-control-hint">WASD / Arrow Keys + Mouse to steer</div>
        </>
      )}

      {/* ── MENU ── */}
      {phase === "menu" && (
        <div className="nf-overlay nf-fade">
          <div className="nf-card nf-slide">
            <div className="nf-logo">✈️</div>
            <h1 className="nf-title">NEUROFLIGHT</h1>
            <p className="nf-subtitle">Vision Pilot — Therapeutic Aviation</p>

            <div className="nf-level-grid">
              {LEVELS.map((l, i) => (
                <button
                  key={l.id}
                  className={`nf-level-btn ${levelIdx === i ? "is-active" : ""}`}
                  style={{ "--lc": l.color }}
                  onClick={() => setLevelIdx(i)}
                >
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
              <b>WASD / Arrow Keys</b> to steer · <b>Mouse</b> for fine control
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 8 }}>
              <button className="nf-btn" onClick={() => { setPassengerHP(PASSENGER_MAX); setProgress(0); setCollisions(0); setElapsed(0); setPhase("play"); }}>
                🚀 START MISSION
              </button>
              {onClose && <button className="nf-btn nf-btn--ghost" onClick={onClose}>✕ EXIT</button>}
            </div>
          </div>
        </div>
      )}

      {/* ── LEVEL PASSED ── */}
      {phase === "level_passed" && (
        <div className="nf-overlay nf-fade" style={{ backgroundColor: 'transparent' }}>
          <div className="nf-card nf-slide" style={{ border: '2px solid #00ff88', backgroundColor: 'rgba(5, 20, 10, 0.93)'}}>
            <h1 className="nf-title" style={{ color: '#00ff88', fontSize: '3rem' }}>LEVEL PASSED!</h1>
            <p className="nf-subtitle" style={{ fontSize: '1.2rem', marginTop: 10, color: '#b3ffcc' }}>
              Auto-landing successful... Moving to next area...
            </p>
          </div>
        </div>
      )}

      {/* ── RESULT ── */}
      {phase === "result" && missionResult && (
        <div className="nf-overlay nf-fade">
          <div className="nf-card nf-slide">
            {missionResult.win ? (
              <>
                <div style={{ fontSize: "3.2rem", marginBottom: 8 }}>🏆</div>
                <h1 className="nf-title" style={{ color: "#ffd700" }}>MISSION COMPLETE</h1>
                <p className="nf-subtitle">Passengers delivered safely!</p>
              </>
            ) : (
              <>
                <div style={{ fontSize: "3.2rem", marginBottom: 8 }}>💥</div>
                <h1 className="nf-title" style={{ color: "#ff2d55" }}>MISSION FAILED</h1>
                <p className="nf-subtitle">Passenger stress exceeded critical level.</p>
              </>
            )}

            <div className="nf-result-grid">
              <div className="nf-result-stat">
                <span className="nf-lbl">THERAPY SCORE</span>
                <span className="nf-result-val" style={{ color: "#ffd700" }}>{missionResult.score.toLocaleString()}</span>
              </div>
              <div className="nf-result-stat">
                <span className="nf-lbl">AVG ALIGNMENT</span>
                <span className="nf-result-val" style={{ color: "#00ff88" }}>{missionResult.align}%</span>
              </div>
              <div className="nf-result-stat">
                <span className="nf-lbl">FLIGHT TIME</span>
                <span className="nf-result-val" style={{ color: "#00c8ff" }}>{Math.floor(missionResult.time / 60)}:{String(missionResult.time % 60).padStart(2, "0")}</span>
              </div>
              <div className="nf-result-stat">
                <span className="nf-lbl">COLLISIONS</span>
                <span className="nf-result-val" style={{ color: missionResult.collisions === 0 ? "#00ff88" : "#ff9500" }}>{missionResult.collisions}</span>
              </div>
            </div>

            <div className="nf-therapy-report">
              <div className="nf-report-title">🧠 Therapy Report</div>
              <div>Eye Alignment: <b style={{ color: missionResult.align > 70 ? "#00ff88" : "#ff9500" }}>{missionResult.align > 85 ? "Excellent" : missionResult.align > 60 ? "Good" : "Needs Work"}</b></div>
              <div>Depth Control: <b style={{ color: missionResult.collisions === 0 ? "#00ff88" : missionResult.collisions < 3 ? "#ff9500" : "#ff2d55" }}>{missionResult.collisions === 0 ? "Perfect" : missionResult.collisions < 3 ? "Moderate" : "Poor"}</b></div>
              <div>Flight Stability: <b style={{ color: "#00c8ff" }}>{missionResult.win ? "Stable" : "Unstable"}</b></div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 12 }}>
              <button className="nf-btn" onClick={() => { setPassengerHP(PASSENGER_MAX); setProgress(0); setCollisions(0); setElapsed(0); setPhase("play"); }}>
                🔄 RETRY MISSION
              </button>
              <button className="nf-btn nf-btn--ghost" onClick={() => setPhase("menu")}>
                📋 MENU
              </button>
              {onClose && <button className="nf-btn nf-btn--ghost" onClick={onClose}>✕ EXIT</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}