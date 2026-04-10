import { useEffect, useRef } from "react";
import * as THREE from "three";
import nissanImg from "../assets/nissancar.png";

const ROAD_W = 12, TRACK_LEN = 400, CAM_H = 3.8, CAM_B = 8, FOV = 68;

// Turn definitions per mode (progress %, direction, label)
const MODE_TURNS = {
  beginner: [],
  intermediate: [
    { at: 0.30, dir: 1,  dur: 0.15 },   // right turn at 30%
    { at: 0.65, dir: -1, dur: 0.15 },   // left turn at 65%
  ],
  advanced: [
    { at: 0.22, dir: -1, dur: 0.13 },   // left
    { at: 0.50, dir: 1,  dur: 0.13 },   // right
    { at: 0.76, dir: -1, dur: 0.13 },   // left
  ],
};

/* ── Road Texture ─────────────────────────────────────────── */
function mkRoadTex() {
  const c = Object.assign(document.createElement("canvas"), { width: 512, height: 512 });
  const x = c.getContext("2d");
  x.fillStyle = "#1a1a2a"; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8000; i++) {
    const v = 25 + Math.random() * 20 | 0;
    x.fillStyle = `rgba(${v},${v},${v + 5},0.18)`;
    x.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  x.shadowBlur = 8; x.shadowColor = "#00f5ff";
  x.fillStyle = "#00f5ff"; x.fillRect(0, 0, 10, 512); x.fillRect(502, 0, 10, 512);
  x.shadowBlur = 0;
  x.shadowBlur = 12; x.shadowColor = "#ffe033";
  x.fillStyle = "#ffe033";
  for (let y = 0; y < 512; y += 72) { x.fillRect(249, y, 14, 44); }
  x.shadowBlur = 0;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 10); return t;
}

/* ── Night Sky ────────────────────────────────────────────── */
function mkSkyTex() {
  const c = Object.assign(document.createElement("canvas"), { width: 4, height: 512 });
  const x = c.getContext("2d"), g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#000008"); g.addColorStop(0.18, "#020018");
  g.addColorStop(0.38, "#0a0030"); g.addColorStop(0.55, "#150045");
  g.addColorStop(0.72, "#2a0060"); g.addColorStop(0.85, "#400020");
  g.addColorStop(1, "#220010");
  x.fillStyle = g; x.fillRect(0, 0, 4, 512);
  return new THREE.CanvasTexture(c);
}

/* ── Wet road reflection ──────────────────────────────────── */
function mkReflectTex() {
  const c = Object.assign(document.createElement("canvas"), { width: 256, height: 256 });
  const x = c.getContext("2d");
  x.fillStyle = "#000"; x.fillRect(0, 0, 256, 256);
  const g = x.createLinearGradient(128, 0, 128, 256);
  g.addColorStop(0, "rgba(0,180,255,0.06)"); g.addColorStop(0.5, "rgba(100,0,200,0.04)"); g.addColorStop(1, "rgba(0,180,255,0.02)");
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 20; i++) {
    x.fillStyle = `rgba(0,245,255,${0.02 + Math.random() * 0.04})`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 6); return t;
}

/* ── City Building ─────────────────────────────────────────── */
function mkBuilding(w, h, d, col) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color: col, shininess: 40 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  body.position.y = h / 2; g.add(body);
  const winC = Object.assign(document.createElement("canvas"), { width: 64, height: 128 });
  const wx = winC.getContext("2d");
  wx.fillStyle = "#000"; wx.fillRect(0, 0, 64, 128);
  for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) {
    if (Math.random() > 0.35) {
      wx.fillStyle = Math.random() > 0.5 ? "#ffee88" : Math.random() > 0.5 ? "#88ffee" : "#cc88ff";
      wx.fillRect(col * 16 + 3, row * 16 + 3, 10, 10);
    }
  }
  const winPlane = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.85, h * 0.9),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(winC), transparent: true, opacity: 0.85 }));
  winPlane.position.set(0, h / 2, d / 2 + 0.01); g.add(winPlane);
  return g;
}

/* ── Street / Road Light Pole ────────────────────────────── */
function mkRoadLamp() {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshPhongMaterial({ color: 0x445566, shininess: 60 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7.5, 7), poleMat);
  pole.position.y = 3.75; g.add(pole);
  // Horizontal arm over road
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 3.0, 6), poleMat);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(1.5, 7.5, 0); g.add(arm);
  // Lamp head
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff0a0 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.22, 0.55), headMat);
  head.position.set(3.0, 7.4, 0); g.add(head);
  // Glow disc beneath lamp
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffee44, transparent: true, opacity: 0.55, depthWrite: false });
  const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.6, 10), glowMat);
  glowDisc.rotation.x = Math.PI / 2;
  glowDisc.position.set(3.0, 7.2, 0); g.add(glowDisc);
  return g;
}

/* ── Neon Billboard ─────────────────────────────────────── */
function mkBillboard(text, col) {
  const c = Object.assign(document.createElement("canvas"), { width: 512, height: 128 });
  const x = c.getContext("2d");
  x.fillStyle = "#050510"; x.fillRect(0, 0, 512, 128);
  x.shadowBlur = 30; x.shadowColor = col;
  x.fillStyle = col; x.font = "bold 72px monospace";
  x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(text, 256, 64); x.shadowBlur = 0;
  x.strokeStyle = col; x.lineWidth = 4;
  x.shadowBlur = 15; x.shadowColor = col;
  x.strokeRect(6, 6, 500, 116);
  const g = new THREE.Group();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(8, 2),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
  board.position.y = 12; g.add(board);
  return g;
}

/* ── Stars ───────────────────────────────────────────────── */
function mkStars(scene) {
  const count = 1000;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 400 + Math.random() * 80;
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = Math.abs(r * Math.cos(phi));
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geo,
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, sizeAttenuation: true, transparent: true, opacity: 0.85 })));
}

/* ── Fancy Finish Line ───────────────────────────────────── */
function mkFinishLine(scene, finishZ) {
  // Chequered road mat
  const fc = Object.assign(document.createElement("canvas"), { width: 512, height: 64 });
  const fx = fc.getContext("2d");
  for (let col = 0; col < 16; col++) for (let row = 0; row < 2; row++) {
    fx.fillStyle = (col + row) % 2 === 0 ? "#ffffff" : "#000000";
    fx.fillRect(col * 32, row * 32, 32, 32);
  }
  const flagMesh = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W + 1, 2.0),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(fc) }));
  flagMesh.rotation.x = -Math.PI / 2; flagMesh.position.set(0, 0.07, finishZ); scene.add(flagMesh);

  // Glowing arch (golden)
  const archMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 2.0 });
  const arch = new THREE.Mesh(new THREE.TorusGeometry(ROAD_W / 2 + 1.2, 0.45, 10, 24, Math.PI), archMat);
  arch.rotation.z = Math.PI; arch.position.set(0, ROAD_W / 2 + 1.2, finishZ); scene.add(arch);

  // Arch pole lights
  [-1, 1].forEach(s => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, ROAD_W / 2 + 2.5, 10),
      new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 1.2 }));
    pole.position.set(s * (ROAD_W / 2 + 1.2), ROAD_W / 4 + 1.2, finishZ); scene.add(pole);

    // Neon vertical strips on poles
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, ROAD_W / 2, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
    strip.position.set(s * (ROAD_W / 2 + 1.2), ROAD_W / 4 + 1.2, finishZ); scene.add(strip);
  });

  // Bright spot lights at finish
  const flLight = new THREE.PointLight(0xffcc00, 8, 60);
  flLight.position.set(0, ROAD_W / 2 + 1.5, finishZ); scene.add(flLight);
  const flLight2 = new THREE.PointLight(0x00ff88, 5, 50);
  flLight2.position.set(0, 2, finishZ); scene.add(flLight2);

  // "FINISH!" sprite with glow
  const lc = Object.assign(document.createElement("canvas"), { width: 1024, height: 196 });
  const lx = lc.getContext("2d");
  lx.clearRect(0, 0, 1024, 196);
  // Background glow
  const bg = lx.createLinearGradient(0, 0, 1024, 0);
  bg.addColorStop(0, "rgba(0,255,136,0)"); bg.addColorStop(0.5, "rgba(0,255,136,0.18)"); bg.addColorStop(1, "rgba(0,255,136,0)");
  lx.fillStyle = bg; lx.fillRect(0, 0, 1024, 196);
  lx.shadowBlur = 50; lx.shadowColor = "#00ff88";
  lx.fillStyle = "#00ff88"; lx.font = "bold 130px 'Arial Black', monospace";
  lx.textAlign = "center"; lx.textBaseline = "middle";
  lx.fillText("🏁 FINISH!", 512, 98);
  lx.shadowBlur = 20; lx.shadowColor = "#fff";
  lx.fillStyle = "rgba(255,255,255,0.8)"; lx.font = "bold 28px monospace";
  lx.fillText("• RACE ENDS HERE •", 512, 168);
  const finSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(lc), transparent: true }));
  finSprite.scale.set(22, 4.5, 1); finSprite.position.set(0, 13, finishZ); scene.add(finSprite);

  // Neon scan line beams at finish
  [-ROAD_W / 2 - 0.5, ROAD_W / 2 + 0.5].forEach(bx => {
    for (let i = 0; i < 5; i++) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, ROAD_W / 2 + 2, 5),
        new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.6 }));
      beam.position.set(bx * (i % 2 === 0 ? 1 : 0.9), i * 2.5 + 1.5, finishZ);
      scene.add(beam);
    }
  });

  return flLight; // return for pulsing animation
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function Track3D({
  speed, speedPct, progress, isFocused, focusStrength,
  turnState, modeKey, running, playerCarRef, finishLineRef,
}) {
  const mountRef = useRef(null);
  const rafRef = useRef(null);
  const propsRef = useRef({});
  const progressLabelRef = useRef(null);
  const carDivRef = useRef(null);
  const nitroDivRef = useRef(null);
  const shakeRef = useRef(0);

  propsRef.current = { speed, speedPct, progress, isFocused, focusStrength, turnState, modeKey, running };

  useEffect(() => {
    if (progressLabelRef.current)
      progressLabelRef.current.textContent = `${Math.round(progress * 100)}%`;
  }, [progress]);

  // Shake + nitro effect at near-max speed (DOM side)
  useEffect(() => {
    if (!carDivRef.current || !nitroDivRef.current) return;
    const isNitro = speedPct > 0.88;
    if (isNitro) {
      const shake = () => {
        if (!carDivRef.current) return;
        const sx = (Math.random() - 0.5) * 10;
        const sy = (Math.random() - 0.5) * 6;
        carDivRef.current.style.transform = `translateX(calc(-50% + ${sx}px)) translateY(${sy}px)`;
        shakeRef.current = requestAnimationFrame(shake);
      };
      shakeRef.current = requestAnimationFrame(shake);
      nitroDivRef.current.style.opacity = "1";
      nitroDivRef.current.style.transform = "scaleX(1) scaleY(1)";
    } else {
      cancelAnimationFrame(shakeRef.current);
      if (carDivRef.current) carDivRef.current.style.transform = "translateX(-50%)";
      if (nitroDivRef.current) {
        nitroDivRef.current.style.opacity = "0";
        nitroDivRef.current.style.transform = "scaleX(0.6) scaleY(0.4)";
      }
    }
    return () => cancelAnimationFrame(shakeRef.current);
  }, [speedPct > 0.88]);

  useEffect(() => {
    const mount = mountRef.current; if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.setClearColor(0x000008);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05000f, 0.0055);
    const camera = new THREE.PerspectiveCamera(FOV, mount.clientWidth / mount.clientHeight, 0.1, 900);

    /* Lighting */
    scene.add(new THREE.AmbientLight(0x220033, 2.5));
    const moonLight = new THREE.DirectionalLight(0x8899ff, 1.8);
    moonLight.position.set(20, 60, -100); moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(2048, 2048);
    Object.assign(moonLight.shadow.camera, { near: 0.5, far: 500, left: -100, right: 100, top: 100, bottom: -100 });
    scene.add(moonLight);
    const pLight = new THREE.PointLight(0xcc44ff, 3.5, 80);
    pLight.position.set(-15, 12, -20); scene.add(pLight);
    const cLight = new THREE.PointLight(0x00f5ff, 3.0, 80);
    cLight.position.set(15, 12, -20); scene.add(cLight);
    const stripL = new THREE.PointLight(0x00f5ff, 1.2, 40);
    stripL.position.set(-ROAD_W / 2, 0.3, -50); scene.add(stripL);
    const stripR = new THREE.PointLight(0x00f5ff, 1.2, 40);
    stripR.position.set(ROAD_W / 2, 0.3, -50); scene.add(stripR);

    // Nitro boost light (follows car)
    const nitroLight = new THREE.PointLight(0x00ccff, 0, 20);
    nitroLight.position.set(0, 1, 0); scene.add(nitroLight);

    mkStars(scene);

    /* Sky */
    const skyGeo = new THREE.SphereGeometry(550, 24, 16);
    skyGeo.scale(-1, 1, 1);
    scene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ map: mkSkyTex(), side: THREE.BackSide })));

    /* Moon */
    const moonGrp = new THREE.Group();
    moonGrp.position.set(-80, 90, -350);
    [[12, 0xe8e8ff, 0.12], [9, 0xdde0ff, 0.3], [7, 0xffffff, 0.85]].forEach(([r, col, op]) => {
      moonGrp.add(new THREE.Mesh(new THREE.CircleGeometry(r, 32),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false })));
    });
    scene.add(moonGrp);

    /* Horizon city glow */
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(600, 60),
      new THREE.MeshBasicMaterial({ color: 0x4400cc, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.set(0, 0.2, -350); scene.add(glow);

    /* Road */
    const rTex = mkRoadTex();
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, TRACK_LEN + 40),
      new THREE.MeshPhongMaterial({ map: rTex, shininess: 80, specular: 0x224466 }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, -(TRACK_LEN / 2) + 10);
    road.receiveShadow = true; scene.add(road);

    /* Wet reflection */
    const refTex = mkReflectTex();
    const refMesh = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, TRACK_LEN + 40),
      new THREE.MeshBasicMaterial({ map: refTex, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    refMesh.rotation.x = -Math.PI / 2;
    refMesh.position.set(0, 0.03, -(TRACK_LEN / 2) + 10);
    scene.add(refMesh);

    /* Road shoulders */
    [-1, 1].forEach(s => {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(4, TRACK_LEN + 40),
        new THREE.MeshPhongMaterial({ color: 0x222233, shininess: 10 }));
      sh.rotation.x = -Math.PI / 2;
      sh.position.set(s * (ROAD_W / 2 + 2), 0, -(TRACK_LEN / 2) + 10); scene.add(sh);
    });

    /* Neon road edge strips */
    [-1, 1].forEach(s => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, TRACK_LEN + 30),
        new THREE.MeshBasicMaterial({ color: 0x00f5ff }));
      strip.position.set(s * (ROAD_W / 2), 0.04, -(TRACK_LEN / 2) + 10); scene.add(strip);
      const gp = new THREE.Mesh(new THREE.PlaneGeometry(1.5, TRACK_LEN + 30),
        new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
      gp.rotation.x = -Math.PI / 2;
      gp.position.set(s * (ROAD_W / 2), 0.02, -(TRACK_LEN / 2) + 10); scene.add(gp);
    });

    /* Guardrails */
    [-1, 1].forEach(s => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, TRACK_LEN + 30),
        new THREE.MeshPhongMaterial({ color: 0x445566, shininess: 120, specular: 0x00aaff }));
      rail.position.set(s * (ROAD_W / 2 + 0.15), 0.6, -(TRACK_LEN / 2) + 10); scene.add(rail);
      for (let p = 0; p < TRACK_LEN; p += 10) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12),
          new THREE.MeshPhongMaterial({ color: 0x334455 }));
        post.position.set(s * (ROAD_W / 2 + 0.15), 0.6, -p); scene.add(post);
      }
    });

    /* Ground */
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, TRACK_LEN + 100),
      new THREE.MeshPhongMaterial({ color: 0x0a0a14, shininess: 5 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.01, -(TRACK_LEN / 2) + 10); scene.add(ground);

    /* ── Road Light Poles (on both sides of road) ── */
    const lampZ_positions = [];
    for (let z = -15; z > -(TRACK_LEN - 20); z -= 28) lampZ_positions.push(z);

    lampZ_positions.forEach(pz => {
      [-1, 1].forEach(s => {
        const lamp = mkRoadLamp();
        // Mirror the arm direction inward (over the road)
        if (s > 0) lamp.rotation.y = Math.PI; // flip so arm extends left (over road)
        lamp.position.set(s * (ROAD_W / 2 + 1.1), 0, pz);
        scene.add(lamp);

        // Point light at lamp head position
        const lp = new THREE.PointLight(0xffe080, 2.5, 30);
        // Arm head is 3 units out from pole, pole is at road_edge+1.1
        // After flip: positive s side flips, arm goes inward
        lp.position.set(s * (ROAD_W / 2 + 1.1 - 3.0 * s), 7.4, pz);
        scene.add(lp);
      });
    });

    /* Buildings */
    const buildingData = [
      { z: -30, s: -1, w: 8, h: 28, d: 10, col: 0x0a0a18 }, { z: -30, s: 1, w: 10, h: 22, d: 8, col: 0x0d0d20 },
      { z: -70, s: -1, w: 12, h: 38, d: 10, col: 0x080818 }, { z: -70, s: 1, w: 9, h: 30, d: 12, col: 0x0c0c1c },
      { z: -115, s: -1, w: 10, h: 45, d: 10, col: 0x0a0a18 }, { z: -115, s: 1, w: 14, h: 35, d: 10, col: 0x08081a },
      { z: -165, s: -1, w: 11, h: 55, d: 10, col: 0x0c0c20 }, { z: -165, s: 1, w: 10, h: 42, d: 12, col: 0x090915 },
      { z: -215, s: -1, w: 13, h: 50, d: 10, col: 0x0a0a18 }, { z: -215, s: 1, w: 11, h: 60, d: 10, col: 0x0b0b1c },
      { z: -265, s: -1, w: 10, h: 65, d: 10, col: 0x080818 }, { z: -265, s: 1, w: 12, h: 48, d: 12, col: 0x0c0c22 },
      { z: -315, s: -1, w: 14, h: 70, d: 10, col: 0x080820 }, { z: -315, s: 1, w: 11, h: 55, d: 10, col: 0x0a0a1c },
    ];
    buildingData.forEach(({ z, s, w, h, d, col }) => {
      const b = mkBuilding(w, h, d, col);
      b.position.set(s * (ROAD_W / 2 + w / 2 + 5), 0, z);
      scene.add(b);
      const bLight = new THREE.PointLight(s > 0 ? 0x00f5ff : 0xcc44ff, 0.8, 25);
      bLight.position.set(s * (ROAD_W / 2 + w / 2 + 5), h + 2, z);
      scene.add(bLight);
    });

    /* Billboards */
    [
      { z: -60, s: -1, text: "SPEED+", col: "#00f5ff" },
      { z: -130, s: 1, text: "NITRO", col: "#cc44ff" },
      { z: -200, s: -1, text: "GT-R", col: "#ff2266" },
      { z: -270, s: 1, text: "RACE!", col: "#ffee00" },
    ].forEach(({ z, s, text, col }) => {
      const bb = mkBillboard(text, col);
      bb.position.set(s * (ROAD_W / 2 + 12), 0, z);
      bb.rotation.y = s > 0 ? Math.PI * 1.1 : -Math.PI * 0.1;
      scene.add(bb);
    });

    /* Turn sign arrows for intermediate/advanced */
    const turnSigns = [];
    (MODE_TURNS.intermediate.concat(MODE_TURNS.advanced)).forEach(turn => {
      // We'll use a sprite sign
      const sc = Object.assign(document.createElement("canvas"), { width: 256, height: 128 });
      const sx = sc.getContext("2d");
      sx.fillStyle = "rgba(255,200,0,0.85)"; sx.fillRect(10, 10, 236, 108);
      sx.strokeStyle = "#ff6600"; sx.lineWidth = 6; sx.strokeRect(10, 10, 236, 108);
      sx.fillStyle = "#000"; sx.font = "bold 80px monospace"; sx.textAlign = "center"; sx.textBaseline = "middle";
      sx.fillText(turn.dir > 0 ? "▶" : "◀", 128, 64);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sc), transparent: true }));
      spr.scale.set(5, 2.5, 1);
      const signZ = -(turn.at * TRACK_LEN);
      spr.position.set(turn.dir * -(ROAD_W / 2 + 5), 4, signZ);
      spr.userData = { turnAt: turn.at };
      scene.add(spr);
      turnSigns.push(spr);
    });

    /* Finish line */
    const finishZ = -(TRACK_LEN - 12);
    const finLight = mkFinishLine(scene, finishZ);

    /* Opponent car */
    const oppGrp = new THREE.Group();
    const oppBody = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.65, 1.8),
      new THREE.MeshPhongMaterial({ color: 0x880010, shininess: 180, specular: 0xff3333 }));
    oppBody.position.y = 0.45; oppGrp.add(oppBody);
    const oppCab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 1.3),
      new THREE.MeshPhongMaterial({ color: 0x660008 }));
    oppCab.position.set(0, 1.05, 0.1); oppGrp.add(oppCab);
    [-1.2, 1.2].forEach(sx => [-0.55, 0.65].forEach(sz => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 12),
        new THREE.MeshPhongMaterial({ color: 0x111118 }));
      w.rotation.z = Math.PI / 2; w.position.set(sx, 0.33, sz); oppGrp.add(w);
    }));
    [-0.8, 0.8].forEach(sx => {
      const tl = new THREE.Mesh(new THREE.CircleGeometry(0.12, 8),
        new THREE.MeshBasicMaterial({ color: 0xff1100 }));
      tl.position.set(sx, 0.5, -0.92); tl.rotation.y = Math.PI; oppGrp.add(tl);
    });
    scene.add(oppGrp);

    /* Exhaust particles */
    const PC = 150;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(PC * 3);
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0xcc44ff, size: 0.2, transparent: true, opacity: 0.75, sizeAttenuation: true });
    scene.add(new THREE.Points(pGeo, pMat));
    const pSt = Array.from({ length: PC }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0 }));

    /* Nitro burst particles */
    const NBC = 80;
    const nbGeo = new THREE.BufferGeometry();
    const nbPos = new Float32Array(NBC * 3);
    nbGeo.setAttribute("position", new THREE.BufferAttribute(nbPos, 3));
    const nbMat = new THREE.PointsMaterial({ color: 0x00f5ff, size: 0.35, transparent: true, opacity: 0, sizeAttenuation: true });
    scene.add(new THREE.Points(nbGeo, nbMat));
    const nbSt = Array.from({ length: NBC }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0 }));

    /* Speed lines */
    const slCount = 60;
    const slGeo = new THREE.BufferGeometry();
    const slPos = new Float32Array(slCount * 6);
    for (let i = 0; i < slCount; i++) {
      const x = (Math.random() - 0.5) * 22, y = Math.random() * 5 + 0.5, z = -5 - Math.random() * 20;
      slPos[i * 6] = x; slPos[i * 6 + 1] = y; slPos[i * 6 + 2] = z;
      slPos[i * 6 + 3] = x; slPos[i * 6 + 4] = y; slPos[i * 6 + 5] = z + 4 + Math.random() * 6;
    }
    slGeo.setAttribute("position", new THREE.BufferAttribute(slPos, 3));
    const slMat = new THREE.LineBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0 });
    const speedLines = new THREE.LineSegments(slGeo, slMat);
    scene.add(speedLines);

    /* Resize */
    const ro = new ResizeObserver(() => {
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    let prevT = performance.now(), camLean = 0, pulseCycle = 0, camShake = 0;

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const now = performance.now(), dt = Math.min((now - prevT) / 1000, 0.05); prevT = now;
      const { speedPct: sp, focusStrength: fs, turnState: ts, progress: prog, modeKey: mk } = propsRef.current;
      pulseCycle += dt;

      const carZ = -prog * TRACK_LEN;
      const isNitro = sp > 0.88;

      /* Camera lean matching turn state */
      camLean += (ts * -0.08 - camLean) * 0.08;

      /* Camera shake at max speed */
      if (isNitro) {
        camShake = (Math.random() - 0.5) * 0.06;
      } else {
        camShake *= 0.85;
      }

      camera.position.set(
        camLean * 5 + camShake,
        CAM_H + (isNitro ? (Math.random() - 0.5) * 0.04 : 0),
        carZ + CAM_B
      );
      // Look ahead further and tilt with turn
      camera.lookAt(camLean * 14, 1.8, carZ - 65 - sp * 25);
      camera.rotation.z = camLean * 0.1;

      /* Road scroll */
      rTex.offset.y += sp * 0.028 + 0.003;
      refTex.offset.y += sp * 0.018 + 0.002;

      /* Opponent */
      oppGrp.position.set(2.2 * Math.sin(now * 0.0004), 0, carZ - 38 - prog * 18);

      /* Neon pulsing */
      const pulse = 0.7 + 0.3 * Math.sin(pulseCycle * 3.14);
      pLight.intensity = 3.0 * pulse + (isNitro ? 5 : 0);
      cLight.intensity = 2.8 * pulse + (isNitro ? 3 : 0);
      stripL.position.z = stripR.position.z = Math.min(-0.5, carZ - 12);

      /* Finish line light pulse */
      finLight.intensity = 6 + 4 * Math.sin(pulseCycle * 5);

      /* Nitro boost light */
      nitroLight.intensity = isNitro ? 8 * pulse + 6 : 0;
      nitroLight.position.set(camLean * 3, 1, carZ + CAM_B - 2);
      nitroLight.color.set(isNitro ? 0x00ccff : 0xcc44ff);

      /* Speed lines */
      slMat.opacity = sp > 0.35 ? Math.min(isNitro ? 0.9 : 0.55, (sp - 0.35) * 1.5) : 0;
      if (sp > 0.3) {
        const slArr = slGeo.attributes.position.array;
        for (let i = 0; i < slCount; i++) {
          slArr[i * 6 + 2] += sp * (isNitro ? 3.5 : 1.8);
          slArr[i * 6 + 5] += sp * (isNitro ? 3.5 : 1.8);
          if (slArr[i * 6 + 2] > carZ + CAM_B + 2) {
            const nx = (Math.random() - 0.5) * 22, ny = Math.random() * 4.5 + 0.5, nz = carZ - 22 - Math.random() * 20;
            slArr[i * 6] = nx; slArr[i * 6 + 1] = ny; slArr[i * 6 + 2] = nz;
            slArr[i * 6 + 3] = nx; slArr[i * 6 + 4] = ny; slArr[i * 6 + 5] = nz + 4 + Math.random() * 6;
          }
        }
        slGeo.attributes.position.needsUpdate = true;
      }
      // Nitro: change speed line color to cyan
      slMat.color.set(isNitro ? 0x00ffff : 0x00f5ff);

      /* Regular exhaust */
      pMat.color.set(isNitro ? 0x00ccff : fs > 0.8 ? 0xcc44ff : 0xaaaaff);
      pMat.opacity = sp > 0.05 ? Math.min(0.9, 0.65 * sp) : 0;
      pMat.size = isNitro ? 0.28 : 0.18;
      if (sp > 0.08) {
        for (let i = 0; i < (isNitro ? 8 : 5); i++) {
          const d = pSt.findIndex(p => p.life <= 0);
          if (d >= 0) {
            const p = pSt[d];
            [p.x, p.y, p.z] = [camLean * 3 + (Math.random() - 0.5) * 1.4, 0.12, carZ + CAM_B - 1.5];
            [p.vx, p.vy, p.vz] = [(Math.random() - 0.5) * 0.07, isNitro ? 0.1 : fs > 0.8 ? 0.06 : 0.015, 0.08 + Math.random() * 0.08];
            p.life = isNitro ? 0.6 + Math.random() * 0.4 : 0.35 + Math.random() * 0.3;
          }
        }
      }
      for (let i = 0; i < PC; i++) {
        const p = pSt[i];
        if (p.life > 0) { p.life -= dt; p.x += p.vx; p.y += p.vy; p.z += p.vz; }
        pPos[i * 3] = p.life > 0 ? p.x : 9999;
        pPos[i * 3 + 1] = p.life > 0 ? p.y : 9999;
        pPos[i * 3 + 2] = p.life > 0 ? p.z : 9999;
      }
      pGeo.attributes.position.needsUpdate = true;

      /* Nitro burst particles */
      nbMat.opacity = isNitro ? 0.85 : 0;
      if (isNitro) {
        for (let i = 0; i < 6; i++) {
          const d = nbSt.findIndex(p => p.life <= 0);
          if (d >= 0) {
            const p = nbSt[d];
            [p.x, p.y, p.z] = [camLean * 3 + (Math.random() - 0.5) * 2.0, 0.1 + Math.random() * 0.5, carZ + CAM_B - 1.2];
            [p.vx, p.vy, p.vz] = [(Math.random() - 0.5) * 0.2, 0.05 + Math.random() * 0.15, 0.12 + Math.random() * 0.1];
            p.life = 0.5 + Math.random() * 0.5;
          }
        }
      }
      for (let i = 0; i < NBC; i++) {
        const p = nbSt[i];
        if (p.life > 0) { p.life -= dt; p.x += p.vx; p.y += p.vy; p.z += p.vz; }
        nbPos[i * 3] = p.life > 0 ? p.x : 9999;
        nbPos[i * 3 + 1] = p.life > 0 ? p.y : 9999;
        nbPos[i * 3 + 2] = p.life > 0 ? p.z : 9999;
      }
      nbGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current); ro.disconnect();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
      });
    };
  }, []);

  return (
    <div ref={mountRef} style={{ width: "100%", height: "100%", position: "relative", background: "#000008" }}>

      {/* Hidden DOM refs for collision detection */}
      <div ref={finishLineRef} style={{ position: "absolute", top: "36%", left: "10%", width: "80%", height: "4px", opacity: 0, pointerEvents: "none" }} />
      <div ref={playerCarRef} aria-label="Car" style={{ position: "absolute", bottom: "2%", left: "20%", width: "60%", height: "38%", opacity: 0, pointerEvents: "none" }} />

      {/* ── Nissan GT-R PNG overlay — player car (movement with turn) ── */}
      <div
        ref={carDivRef}
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "62%",
          maxWidth: 520,
          pointerEvents: "none",
          zIndex: 10,
          filter: "drop-shadow(0 -6px 28px rgba(0,245,255,0.45)) drop-shadow(0 0 60px rgba(100,0,200,0.4))",
          // Lean slightly with turn
          transform: `translateX(calc(-50% + ${(turnState || 0) * -18}px)) rotate(${(turnState || 0) * -2.5}deg)`,
          transition: "transform 0.25s ease-out",
        }}
      >
        <img
          src={nissanImg}
          alt="Player Car - Nissan GT-R"
          style={{
            width: "100%",
            display: "block",
            mixBlendMode: "multiply",
            filter: "contrast(1.12) saturate(1.15) brightness(0.92)",
            userSelect: "none",
          }}
          draggable={false}
        />

        {/* Neon ground reflection under car */}
        <div style={{
          position: "absolute", bottom: 0, left: "10%", width: "80%", height: 18,
          background: "radial-gradient(ellipse at center, rgba(0,245,255,0.55) 0%, transparent 75%)",
          filter: "blur(6px)", borderRadius: "50%",
        }} />

        {/* Nitro flame ── shown at max speed */}
        <div
          ref={nitroDivRef}
          style={{
            position: "absolute",
            bottom: "2%",
            left: "50%",
            transform: "translateX(-50%) scaleX(0.6) scaleY(0.4)",
            opacity: 0,
            transition: "opacity 0.15s, transform 0.15s",
            pointerEvents: "none",
            width: 180,
            marginLeft: -90,
          }}
        >
          {/* Triple-layer nitro flame */}
          <div style={{
            width: "100%", height: 80,
            background: "linear-gradient(0deg, rgba(0,245,255,0) 0%, rgba(0,200,255,0.9) 35%, rgba(0,100,255,0.7) 60%, rgba(100,0,255,0.5) 80%, rgba(180,0,255,0.2) 100%)",
            filter: "blur(8px)",
            borderRadius: "50% 50% 0 0",
            animation: "nitroFlame 0.06s ease-in-out infinite alternate",
          }} />
          <div style={{
            position: "absolute", inset: "15px 25px 0",
            background: "linear-gradient(0deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 40%, rgba(0,220,255,0.7) 70%, transparent 100%)",
            filter: "blur(4px)",
            borderRadius: "50% 50% 0 0",
          }} />
        </div>
      </div>

      {/* ── Nitro screen flash overlay ── */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 8,
        background: speedPct > 0.88
          ? "radial-gradient(ellipse at center, rgba(0,200,255,0.08) 0%, rgba(0,0,255,0.04) 50%, transparent 80%)"
          : "transparent",
        transition: "background 0.1s",
      }} />

      {/* Speed vignette */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5,
        background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,8,0.65) 100%)",
      }} />

      {/* ── Bottom HUD overlay ── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "22%",
        background: "linear-gradient(0deg, rgba(0,0,12,0.92) 0%, transparent 100%)",
        display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 24px 12px",
        pointerEvents: "none", zIndex: 20,
      }}>
        {/* Mini Map */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "radial-gradient(circle, #020218 60%, #00f5ff18)",
            border: "2.5px solid rgba(0,245,255,0.6)",
            boxShadow: "0 0 18px rgba(0,245,255,0.45), inset 0 0 10px rgba(0,245,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 2,
          }}>
            <div style={{ fontSize: 22 }}>🧭</div>
            <div style={{ fontSize: "0.45rem", color: "rgba(0,245,255,0.8)", letterSpacing: 1.5, fontFamily: "monospace" }}>MINI MAP</div>
          </div>
        </div>

        {/* Progress */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "monospace", fontSize: "0.62rem", color: "rgba(0,245,255,0.6)", letterSpacing: 3 }}>race progress</div>
          <div ref={progressLabelRef} style={{
            fontFamily: "'Courier New', monospace",
            fontSize: "2rem", fontWeight: 900,
            color: "#ffe033",
            textShadow: "0 0 24px rgba(255,224,51,0.95), 0 0 50px rgba(255,224,51,0.5)",
            letterSpacing: 2,
          }}>0%</div>
          <div style={{ fontFamily: "monospace", fontSize: "0.6rem", color: "rgba(255,255,255,0.45)", letterSpacing: 2 }}>TO FINISH</div>
        </div>

        {/* Nitro indicator */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: speedPct > 0.88
              ? "radial-gradient(circle, #00111a 30%, #00f5ff55)"
              : "radial-gradient(circle, #06001a 60%, #cc44ff18)",
            border: speedPct > 0.88 ? "2.5px solid rgba(0,245,255,1)" : "2.5px solid rgba(168,85,247,0.7)",
            boxShadow: speedPct > 0.88
              ? "0 0 28px rgba(0,245,255,0.9), inset 0 0 16px rgba(0,245,255,0.2)"
              : "0 0 18px rgba(168,85,247,0.45), inset 0 0 10px rgba(168,85,247,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 0,
            transition: "all 0.2s",
          }}>
            <div style={{
              fontSize: "0.55rem", fontWeight: 700,
              color: speedPct > 0.88 ? "#00f5ff" : "rgba(168,85,247,0.9)",
              fontFamily: "monospace", letterSpacing: 1,
            }}>NITRO</div>
            <div style={{ fontSize: "0.45rem", color: speedPct > 0.88 ? "#00f5ff" : "rgba(168,85,247,0.6)", letterSpacing: 1, fontFamily: "monospace" }}>BOOST</div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes nitroFlame {
          from { transform: scaleX(0.9) scaleY(0.85); }
          to   { transform: scaleX(1.1) scaleY(1.15); }
        }
      `}</style>
    </div>
  );
}
