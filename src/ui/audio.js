// Música lo-fi generativa + efectos cortos con WebAudio (sin archivos de audio).
// Arranca silenciado: los navegadores exigen un gesto del usuario para sonar.
const CHORDS = [
  [48, 55, 59, 64], // Cmaj7
  [45, 52, 55, 60], // Am7
  [41, 48, 52, 57], // Fmaj7
  [43, 50, 53, 59], // G7
];
const SCALE = [60, 62, 64, 67, 69, 72, 74, 76];
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.playing = false;
    this.timer = 0;
    this.step = 0;
    this.nextTime = 0;
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.18;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    this.master.connect(lp).connect(this.ctx.destination);
    return this.ctx;
  }

  setEnabled(on) {
    this.enabled = on;
    if (on) {
      this.ensure();
      this.ctx?.resume?.();
    }
    this.sync();
  }

  setPlaying(on) {
    this.playing = on;
    this.sync();
  }

  sync() {
    const run = this.enabled && this.playing && this.ctx;
    if (run && !this.timer) {
      this.nextTime = this.ctx.currentTime + 0.05;
      this.timer = setInterval(() => this.schedule(), 50);
    } else if (!run && this.timer) {
      clearInterval(this.timer);
      this.timer = 0;
    }
  }

  tone(freq, start, dur, { type = 'triangle', gain = 0.3, attack = 0.01 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(this.master);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  schedule() {
    const spb = 60 / 78 / 2; // corcheas a 78 bpm
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      const t = this.nextTime;
      const bar = Math.floor(this.step / 8) % CHORDS.length;
      const beat = this.step % 8;
      const chord = CHORDS[bar];
      if (beat === 0) {
        chord.forEach((m) => this.tone(mtof(m), t, spb * 7.5, { type: 'sine', gain: 0.12, attack: 0.08 }));
        this.tone(mtof(chord[0] - 12), t, spb * 3, { type: 'triangle', gain: 0.35 });
      }
      if (beat === 4) this.tone(mtof(chord[0] - 12), t, spb * 2, { type: 'triangle', gain: 0.25 });
      // Melodía suave pseudoaleatoria pero repetible
      const r = Math.sin(this.step * 12.9898) * 43758.5453;
      const rnd = r - Math.floor(r);
      if (beat % 2 === 1 && rnd > 0.35) this.tone(mtof(SCALE[Math.floor(rnd * SCALE.length)]), t, spb * 1.6, { gain: 0.12 });
      this.step++;
      this.nextTime += spb * (beat % 2 ? 0.9 : 1.1); // swing
    }
  }

  sfx(kind) {
    if (!this.enabled || !this.ensure()) return;
    const t = this.ctx.currentTime;
    if (kind === 'place') {
      this.tone(660, t, 0.08, { type: 'square', gain: 0.08 });
      this.tone(990, t + 0.05, 0.1, { type: 'square', gain: 0.06 });
    } else if (kind === 'remove') {
      this.tone(330, t, 0.12, { type: 'square', gain: 0.07 });
      this.tone(220, t + 0.06, 0.12, { type: 'square', gain: 0.06 });
    } else if (kind === 'toggle') {
      this.tone(880, t, 0.06, { type: 'sine', gain: 0.15 });
    } else if (kind === 'error') {
      this.tone(160, t, 0.15, { type: 'sawtooth', gain: 0.05 });
    } else if (kind === 'step') {
      this.tone(120 + Math.random() * 30, t, 0.04, { type: 'triangle', gain: 0.05 });
    } else if (kind === 'meow') {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(700, t);
      o.frequency.linearRampToValueAtTime(950, t + 0.12);
      o.frequency.linearRampToValueAtTime(500, t + 0.35);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.45);
    }
  }
}
