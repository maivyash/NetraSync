/* ================================================================
   Fusion Hoops — Web Audio Sound Engine
   All sounds are synthesized via the Web Audio API (no files needed).
   ================================================================ */

let ctx = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/* ---- helper: simple tone ---- */
function playTone(freq, type, duration, vol = 0.25, rampDown = true) {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = vol;
  if (rampDown) gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + duration);
}

/* ---- helper: noise burst (crowd / swoosh) ---- */
function noiseBuffer(duration, sampleRate) {
  const len = sampleRate * duration;
  const buf = new Float32Array(len);
  for (let i = 0; i < len; i++) buf[i] = Math.random() * 2 - 1;
  return buf;
}

/* =======================================================
   1.  CROWD AMBIENCE  — looping filtered white-noise
   ======================================================= */
let crowdNodes = null;

export function startCrowdAmbience() {
  if (crowdNodes) return; // already playing
  const c = getCtx();
  const sr = c.sampleRate;

  // Create noise buffer (4 seconds, looped)
  const abuf = c.createBuffer(1, sr * 4, sr);
  const data = abuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const source = c.createBufferSource();
  source.buffer = abuf;
  source.loop = true;

  // Band-pass to make it sound like a muffled crowd
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 600;
  bp.Q.value = 0.6;

  // Second filter for warmth
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1200;

  // Slow LFO on gain to give a "wave" feel (cheering rises + falls)
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.type = "sine";
  lfo.frequency.value = 0.18;          // slow swell
  lfoGain.gain.value = 0.04;           // modulation depth

  const masterGain = c.createGain();
  masterGain.gain.value = 0.10;        // quiet background

  lfo.connect(lfoGain).connect(masterGain.gain);
  source.connect(bp).connect(lp).connect(masterGain).connect(c.destination);
  source.start();
  lfo.start();

  crowdNodes = { source, lfo, masterGain, bp, lp, lfoGain };
}

export function stopCrowdAmbience() {
  if (!crowdNodes) return;
  try {
    crowdNodes.source.stop();
    crowdNodes.lfo.stop();
  } catch (_) { /* already stopped */ }
  crowdNodes = null;
}

/** Momentarily boost crowd volume (crowd roar on swish) */
export function crowdRoar() {
  if (!crowdNodes) return;
  const c = getCtx();
  const g = crowdNodes.masterGain.gain;
  g.cancelScheduledValues(c.currentTime);
  g.setValueAtTime(0.32, c.currentTime);
  g.exponentialRampToValueAtTime(0.10, c.currentTime + 1.8);
}

/* =======================================================
   2.  WHISTLE  — perfect shot (swish)
   Two-tone referee whistle + crowd roar
   ======================================================= */
export function playWhistle() {
  const c = getCtx();
  const now = c.currentTime;

  // High pitched whistle — two oscillators for a "trilling" effect
  [3200, 3600].forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    // slight vibrato
    const vib = c.createOscillator();
    const vibG = c.createGain();
    vib.frequency.value = 18;
    vibG.gain.value = 80;
    vib.connect(vibG).connect(osc.frequency);
    vib.start(now);
    vib.stop(now + 0.6);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.setValueAtTime(0.18, now + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc.connect(gain).connect(c.destination);
    osc.start(now + i * 0.02);
    osc.stop(now + 0.6);
  });

  // Net swish swoosh
  setTimeout(() => playNetSwish(), 100);

  // Crowd roar
  crowdRoar();
}

/* Net "swish" swoosh — short filtered noise */
function playNetSwish() {
  const c = getCtx();
  const sr = c.sampleRate;
  const dur = 0.25;
  const buf = c.createBuffer(1, sr * dur, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 3000;
  const g = c.createGain();
  g.gain.value = 0.14;
  src.connect(hp).connect(g).connect(c.destination);
  src.start();
}

/* =======================================================
   3.  CLOSE SHOT  — rim clang + short buzz
   ======================================================= */
export function playCloseShot() {
  const c = getCtx();
  const now = c.currentTime;

  // Metallic rim clang — inharmonic mix
  [480, 720, 1150].forEach((freq) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain).connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  });

  // Backboard thud — low noise burst
  const sr = c.sampleRate;
  const dur = 0.15;
  const buf = c.createBuffer(1, sr * dur, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 400;
  const g = c.createGain();
  g.gain.value = 0.18;
  src.connect(lp).connect(g).connect(c.destination);
  src.start(now + 0.05);

  // Mild crowd "ooh"
  if (crowdNodes) {
    const mg = crowdNodes.masterGain.gain;
    mg.cancelScheduledValues(now);
    mg.setValueAtTime(0.18, now + 0.1);
    mg.exponentialRampToValueAtTime(0.10, now + 1.2);
  }
}

/* =======================================================
   4.  MISS  — dull thud + disappointed crowd sigh
   ======================================================= */
export function playMiss() {
  const c = getCtx();
  const now = c.currentTime;

  // Low dull "bonk"
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.25);
  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.35);

  // Descending "wah-wah" — two notes going down
  [320, 260].forEach((freq, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sawtooth";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.06, now + 0.15 + i * 0.22);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.35 + i * 0.22);
    o.connect(g).connect(c.destination);
    o.start(now + 0.15 + i * 0.22);
    o.stop(now + 0.45 + i * 0.22);
  });

  // Crowd quiets down briefly
  if (crowdNodes) {
    const mg = crowdNodes.masterGain.gain;
    mg.cancelScheduledValues(now);
    mg.setValueAtTime(0.04, now);
    mg.exponentialRampToValueAtTime(0.10, now + 1.5);
  }
}

/* =======================================================
   5.  LEVEL UP  — ascending fanfare + crowd explosion
   ======================================================= */
export function playLevelUp() {
  const c = getCtx();
  const now = c.currentTime;

  // Ascending triumphant notes
  const notes = [523, 659, 784, 1047];   // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    const t = now + i * 0.18;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.04);
    gain.gain.setValueAtTime(0.12, t + 0.14);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.35);
  });

  // Bright shimmer — high sine chord
  [1568, 1976, 2637].forEach((freq) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = now + 0.72;
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 1.3);
  });

  // Big crowd roar
  crowdRoar();
  // Second roar after fanfare
  setTimeout(() => crowdRoar(), 750);
}

/* =======================================================
   6.  GAME OVER BUZZER
   ======================================================= */
export function playBuzzer() {
  const c = getCtx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.value = 180;
  gain.gain.setValueAtTime(0.16, now);
  gain.gain.setValueAtTime(0.16, now + 0.6);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + 1.1);
}

/* =======================================================
   7.  BALL BOUNCE (shoot sound)
   ======================================================= */
export function playBallBounce() {
  const c = getCtx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.exponentialRampToValueAtTime(150, now + 0.12);
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.18);
}
