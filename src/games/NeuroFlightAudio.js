/**
 * NeuroFlightAudio.js
 * Synthesized audio engine using Web Audio API — no external audio files needed.
 * Exports a class with: startEngine(), stopEngine(), setThrottle(0-1),
 *                        playCollision(), playLevelUp(), playVictory()
 */

export class NeuroFlightAudio {
  constructor() {
    this._ctx      = null;
    this._engine   = null;     // OscillatorNode for engine hum
    this._gainNode = null;     // master gain
    this._running  = false;
  }

  // ── Lazy-init AudioContext on first user gesture ──────────────────────────
  _getCtx() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this._ctx.state === "suspended") {
      this._ctx.resume().catch(() => {});
    }
    return this._ctx;
  }

  // ── Engine hum: layered oscillators that simulate jet turbine ────────────
  startEngine() {
    if (this._running) return;
    const ctx = this._getCtx();
    this._running = true;

    // Master gain
    this._gainNode = ctx.createGain();
    this._gainNode.gain.setValueAtTime(0.0, ctx.currentTime);
    this._gainNode.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 1.2);
    this._gainNode.connect(ctx.destination);

    // Layer 1: low rumble
    const osc1 = ctx.createOscillator();
    osc1.type = "sawtooth";
    osc1.frequency.value = 88;
    const g1 = ctx.createGain(); g1.gain.value = 0.55;
    osc1.connect(g1); g1.connect(this._gainNode);
    osc1.start();

    // Layer 2: mid whine
    const osc2 = ctx.createOscillator();
    osc2.type = "sawtooth";
    osc2.frequency.value = 220;
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    osc2.connect(g2); g2.connect(this._gainNode);
    osc2.start();

    // Layer 3: high turbine
    const osc3 = ctx.createOscillator();
    osc3.type = "square";
    osc3.frequency.value = 440;
    const g3 = ctx.createGain(); g3.gain.value = 0.08;
    osc3.connect(g3); g3.connect(this._gainNode);
    osc3.start();

    // Subtle LFO flutter (gives life to engine sound)
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 12;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 4;
    lfo.connect(lfoGain); lfoGain.connect(osc1.frequency);
    lfo.start();

    // Low-pass filter to round off harshness
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    this._gainNode.connect(ctx.destination);

    this._osc1 = osc1; this._osc2 = osc2; this._osc3 = osc3; this._lfo = lfo;
  }

  stopEngine() {
    if (!this._running) return;
    this._running = false;
    const ctx = this._ctx;
    if (!ctx) return;
    // Fade out
    if (this._gainNode) {
      this._gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      setTimeout(() => {
        [this._osc1, this._osc2, this._osc3, this._lfo].forEach(o => {
          try { o?.stop(); } catch(e) {}
        });
        this._gainNode?.disconnect();
        this._gainNode = null;
      }, 700);
    }
  }

  // ── Throttle: adjust engine pitch/volume by 0-1 speed factor ─────────────
  setThrottle(t) {
    if (!this._ctx || !this._gainNode || !this._osc1) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const clamp = Math.max(0, Math.min(1, t));
    this._gainNode.gain.linearRampToValueAtTime(0.1 + clamp * 0.22, now + 0.2);
    this._osc1.frequency.linearRampToValueAtTime(80  + clamp * 60,  now + 0.2);
    this._osc2.frequency.linearRampToValueAtTime(200 + clamp * 120, now + 0.2);
  }

  // ── Collision alert: harsh descending beep bursts ─────────────────────────
  playCollision() {
    try {
      const ctx = this._getCtx();
      const now = ctx.currentTime;
      [0, 0.12, 0.24].forEach(offset => {
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(880, now + offset);
        osc.frequency.linearRampToValueAtTime(220, now + offset + 0.1);
        g.gain.setValueAtTime(0.4, now + offset);
        g.gain.linearRampToValueAtTime(0, now + offset + 0.1);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.12);
      });
    } catch(e) {}
  }

  // ── Level-up fanfare: ascending arpeggio ──────────────────────────────────
  playLevelUp() {
    try {
      const ctx  = this._getCtx();
      const now  = ctx.currentTime;
      const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, now + i * 0.12);
        g.gain.linearRampToValueAtTime(0.35, now + i * 0.12 + 0.04);
        g.gain.linearRampToValueAtTime(0,    now + i * 0.12 + 0.22);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.25);
      });
    } catch(e) {}
  }

  // ── Victory fanfare: full triumphant chord sequence ───────────────────────
  playVictory() {
    try {
      const ctx = this._getCtx();
      const now = ctx.currentTime;

      // Chord 1: C major (C4 E4 G4)
      [[261,0],[329,0],[392,0]].forEach(([f, t]) => _note(ctx, f, now+t, 0.6, 0.5));
      // Chord 2: F major (F4 A4 C5)
      [[349,0.55],[440,0.55],[523,0.55]].forEach(([f, t]) => _note(ctx, f, now+t, 0.5, 0.5));
      // Chord 3: G major (G4 B4 D5)
      [[392,1.1],[493,1.1],[587,1.1]].forEach(([f, t]) => _note(ctx, f, now+t, 0.5, 0.5));
      // Big C major chord + high octave
      [[261,1.65],[329,1.65],[392,1.65],[523,1.65],[784,1.65]].forEach(([f, t]) =>
        _note(ctx, f, now+t, 0.7, 1.2));
    } catch(e) {}
  }

  destroy() {
    this.stopEngine();
    setTimeout(() => {
      try { this._ctx?.close(); } catch(e) {}
      this._ctx = null;
    }, 800);
  }
}

function _note(ctx, freq, startTime, volume, duration) {
  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, startTime);
  g.gain.linearRampToValueAtTime(volume, startTime + 0.04);
  g.gain.linearRampToValueAtTime(0,      startTime + duration);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}
