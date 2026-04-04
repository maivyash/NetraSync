/* ================================================================
   OrbDrive — Web Audio Sound Engine
   All sounds synthesized with the Web Audio API (no files needed).
   Provides: engine loop, nitro boost, countdown beeps,
   finish celebration, warning, tire screech, and wind ambience.
   ================================================================ */

let ctx = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/* =========================================================
   1.  ENGINE LOOP — continuous tone whose pitch + volume
       follow car speed. Call updateEngine(speedPct) every frame.
   ========================================================= */
let engineNodes = null;

export function startEngine() {
  if (engineNodes) return;
  const c = getCtx();

  // Base engine: low sawtooth
  const osc1 = c.createOscillator();
  osc1.type = "sawtooth";
  osc1.frequency.value = 55; // idle

  // Harmonic overtone for richness
  const osc2 = c.createOscillator();
  osc2.type = "square";
  osc2.frequency.value = 110;

  // Rumble — sub-bass sine
  const osc3 = c.createOscillator();
  osc3.type = "sine";
  osc3.frequency.value = 35;

  // Low-pass to remove harsh digital edge
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 400;
  lp.Q.value = 2;

  // Gain nodes
  const g1 = c.createGain();
  g1.gain.value = 0.06;
  const g2 = c.createGain();
  g2.gain.value = 0.03;
  const g3 = c.createGain();
  g3.gain.value = 0.05;
  const master = c.createGain();
  master.gain.value = 0.18;

  osc1.connect(g1).connect(lp);
  osc2.connect(g2).connect(lp);
  osc3.connect(g3).connect(lp);
  lp.connect(master).connect(c.destination);

  osc1.start();
  osc2.start();
  osc3.start();

  engineNodes = { osc1, osc2, osc3, g1, g2, g3, master, lp };
}

/** Call every frame with speedPct 0..1 to modulate engine pitch + volume */
export function updateEngine(speedPct) {
  if (!engineNodes) return;
  const c = getCtx();
  const t = c.currentTime + 0.05; // slight lookahead for smooth ramps
  const s = Math.max(0, Math.min(1, speedPct));

  // Pitch rises with speed
  engineNodes.osc1.frequency.linearRampToValueAtTime(55 + s * 120, t);
  engineNodes.osc2.frequency.linearRampToValueAtTime(110 + s * 200, t);
  engineNodes.osc3.frequency.linearRampToValueAtTime(35 + s * 30, t);

  // Volume rises with speed
  engineNodes.master.gain.linearRampToValueAtTime(0.12 + s * 0.14, t);

  // Filter opens up at higher speed for brighter tone
  engineNodes.lp.frequency.linearRampToValueAtTime(400 + s * 600, t);
}

export function stopEngine() {
  if (!engineNodes) return;
  try {
    engineNodes.osc1.stop();
    engineNodes.osc2.stop();
    engineNodes.osc3.stop();
  } catch (_) {}
  engineNodes = null;
}

/* =========================================================
   2.  WIND / ROAD AMBIENCE — filtered white noise whose
       volume follows speed, giving a rushing-air feel.
   ========================================================= */
let windNodes = null;

export function startWind() {
  if (windNodes) return;
  const c = getCtx();
  const sr = c.sampleRate;

  // 3-second noise buffer, looped
  const buf = c.createBuffer(1, sr * 3, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;

  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 800;

  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 3000;

  const gain = c.createGain();
  gain.gain.value = 0.0; // silent until car moves

  src.connect(hp).connect(lp).connect(gain).connect(c.destination);
  src.start();

  windNodes = { src, hp, lp, gain };
}

/** Update wind volume based on speed 0..1 */
export function updateWind(speedPct) {
  if (!windNodes) return;
  const c = getCtx();
  const s = Math.max(0, Math.min(1, speedPct));
  const t = c.currentTime + 0.05;
  windNodes.gain.gain.linearRampToValueAtTime(s * 0.12, t);
  // Higher speed = wider band
  windNodes.lp.frequency.linearRampToValueAtTime(2000 + s * 4000, t);
}

export function stopWind() {
  if (!windNodes) return;
  try { windNodes.src.stop(); } catch (_) {}
  windNodes = null;
}

/* =========================================================
   3.  NITRO BOOST — triggered when focus hits 100%.
       Rising whoosh + bright shimmer chord.
   ========================================================= */
let nitroPlaying = false;

export function playNitroBoost() {
  if (nitroPlaying) return;
  nitroPlaying = true;
  setTimeout(() => { nitroPlaying = false; }, 1200);

  const c = getCtx();
  const now = c.currentTime;

  // Rising whoosh — filtered noise sweep
  const sr = c.sampleRate;
  const dur = 0.8;
  const buf = c.createBuffer(1, sr * dur, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    d[i] = (Math.random() * 2 - 1) * (1 - (i / d.length) * 0.4);
  }
  const src = c.createBufferSource();
  src.buffer = buf;

  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(600, now);
  bp.frequency.exponentialRampToValueAtTime(4000, now + 0.6);
  bp.Q.value = 2;

  const g = c.createGain();
  g.gain.setValueAtTime(0.18, now);
  g.gain.setValueAtTime(0.18, now + 0.4);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);

  src.connect(bp).connect(g).connect(c.destination);
  src.start(now);

  // Bright shimmer — ascending tones
  [1200, 1600, 2400].forEach((freq, i) => {
    const osc = c.createOscillator();
    const og = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = now + 0.1 + i * 0.08;
    og.gain.setValueAtTime(0.08, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(og).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.55);
  });

  // Momentarily boost engine if running
  if (engineNodes) {
    const mg = engineNodes.master.gain;
    mg.cancelScheduledValues(now);
    mg.setValueAtTime(0.32, now);
    mg.linearRampToValueAtTime(0.22, now + 0.8);
  }
}

/* =========================================================
   4.  COUNTDOWN BEEP — short pip on each count,
       higher pitch on "GO" (count 0).
   ========================================================= */
export function playCountdownBeep(num) {
  const c = getCtx();
  const now = c.currentTime;
  const freq = num > 0 ? 660 : 1320; // higher on GO
  const dur = num > 0 ? 0.15 : 0.35;

  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;

  const g = c.createGain();
  g.gain.setValueAtTime(0.20, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);

  osc.connect(g).connect(c.destination);
  osc.start(now);
  osc.stop(now + dur + 0.05);

  // On GO (0), play a quick engine rev
  if (num <= 0) {
    const rev = c.createOscillator();
    const rg = c.createGain();
    rev.type = "sawtooth";
    rev.frequency.setValueAtTime(80, now);
    rev.frequency.exponentialRampToValueAtTime(200, now + 0.4);
    rg.gain.setValueAtTime(0.10, now);
    rg.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    rev.connect(rg).connect(c.destination);
    rev.start(now);
    rev.stop(now + 0.55);
  }
}

/* =========================================================
   5.  FINISH / RACE COMPLETE — triumphant fanfare +
       crowd cheer + engine wind-down.
   ========================================================= */
export function playFinish() {
  const c = getCtx();
  const now = c.currentTime;

  // Ascending victory notes C5-E5-G5-C6
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    const t = now + i * 0.16;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.10, t + 0.03);
    g.gain.setValueAtTime(0.10, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.32);
  });

  // Sustain chord shimmer
  [1047, 1319, 1568].forEach((freq) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = now + 0.65;
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + 1.6);
  });

  // Crowd cheer burst (filtered noise swell)
  const sr = c.sampleRate;
  const cheerDur = 2.0;
  const cheerBuf = c.createBuffer(1, sr * cheerDur, sr);
  const cd = cheerBuf.getChannelData(0);
  for (let i = 0; i < cd.length; i++) cd[i] = Math.random() * 2 - 1;
  const cheerSrc = c.createBufferSource();
  cheerSrc.buffer = cheerBuf;
  const cbp = c.createBiquadFilter();
  cbp.type = "bandpass";
  cbp.frequency.value = 700;
  cbp.Q.value = 0.5;
  const cg = c.createGain();
  cg.gain.setValueAtTime(0, now + 0.3);
  cg.gain.linearRampToValueAtTime(0.16, now + 0.8);
  cg.gain.exponentialRampToValueAtTime(0.001, now + cheerDur + 0.3);
  cheerSrc.connect(cbp).connect(cg).connect(c.destination);
  cheerSrc.start(now + 0.3);

  // Engine wind-down
  if (engineNodes) {
    const mg = engineNodes.master.gain;
    mg.cancelScheduledValues(now);
    mg.setValueAtTime(mg.value, now);
    mg.exponentialRampToValueAtTime(0.01, now + 1.5);
    engineNodes.osc1.frequency.linearRampToValueAtTime(45, now + 1.5);
    engineNodes.osc2.frequency.linearRampToValueAtTime(90, now + 1.5);
  }
}

/* =========================================================
   6.  WARNING / CONVERGENCE LOST — alarm tone
   ========================================================= */
let warningPlaying = false;

export function playWarning() {
  if (warningPlaying) return;
  warningPlaying = true;
  setTimeout(() => { warningPlaying = false; }, 1500);

  const c = getCtx();
  const now = c.currentTime;

  // Two-tone alarm
  [0, 0.25, 0.5].forEach((offset) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(880, now + offset);
    osc.frequency.setValueAtTime(660, now + offset + 0.12);
    g.gain.setValueAtTime(0.08, now + offset);
    g.gain.setValueAtTime(0.08, now + offset + 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.24);
    osc.connect(g).connect(c.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.25);
  });
}

/* =========================================================
   7.  TIRE SCREECH — on race reset / emergency brake
   ========================================================= */
export function playTireScreech() {
  const c = getCtx();
  const now = c.currentTime;
  const sr = c.sampleRate;

  // Noise burst shaped like a screech
  const dur = 0.5;
  const buf = c.createBuffer(1, sr * dur, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - (i / d.length) * 0.8);
  }
  const src = c.createBufferSource();
  src.buffer = buf;

  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2800;
  bp.Q.value = 4;

  const g = c.createGain();
  g.gain.setValueAtTime(0.18, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);

  src.connect(bp).connect(g).connect(c.destination);
  src.start(now);
}

/* =========================================================
   8.  GEAR SHIFT — quick blip when speed jumps significantly
   ========================================================= */
let lastGearSpeed = 0;
const GEAR_THRESHOLDS = [0.25, 0.50, 0.75];

export function checkGearShift(speedPct) {
  const s = Math.max(0, Math.min(1, speedPct));
  for (const threshold of GEAR_THRESHOLDS) {
    if (lastGearSpeed < threshold && s >= threshold) {
      playGearBlip(threshold);
    }
  }
  lastGearSpeed = s;
}

export function resetGears() {
  lastGearSpeed = 0;
}

function playGearBlip(level) {
  const c = getCtx();
  const now = c.currentTime;

  // Short rev dip then rise — mimics gear change
  const freq = 100 + level * 80;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(freq + 40, now);
  osc.frequency.linearRampToValueAtTime(freq - 20, now + 0.06);
  osc.frequency.linearRampToValueAtTime(freq + 60, now + 0.18);
  g.gain.setValueAtTime(0.10, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  osc.connect(g).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.25);
}

/* =========================================================
   CLEANUP — stop everything
   ========================================================= */
export function stopAll() {
  stopEngine();
  stopWind();
  resetGears();
}
