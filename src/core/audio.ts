// Prozedurale Musik + Soundeffekte mit der Web Audio API.
// PROVISORISCH: Später können hier echte Musik-/Sounddateien geladen werden
// (gleiche Schnittstelle: playMusic(name) / sfx(name)).

export type MusicName = 'menu' | 'aliens' | 'romans' | 'greece' | 'boss' | 'none';
export type SfxName =
  | 'shoot' | 'hit' | 'enemyDie' | 'hurt' | 'pickup' | 'coin' | 'door' | 'bomb'
  | 'item' | 'click' | 'shot' | 'charge' | 'win' | 'lose' | 'use' | 'error';

interface Track {
  bpm: number;
  root: number;          // MIDI-Grundton
  scale: number[];
  bass: (number | null)[];
  arp: (number | null)[];
  lead?: (number | null)[];
  bassWave: OscillatorType;
  arpWave: OscillatorType;
  drums: string;         // k = Kick, s = Snare, h = Hi-Hat, . = Pause
}

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const HARM = [0, 2, 3, 5, 7, 8, 11];
const PHRY = [0, 1, 3, 5, 7, 8, 10];
const WHOLE = [0, 2, 4, 6, 8, 10];
const _ = null;

const TRACKS: Record<Exclude<MusicName, 'none'>, Track> = {
  menu: {
    bpm: 84, root: 45, scale: MINOR, bassWave: 'triangle', arpWave: 'sine',
    bass: [0, _, _, _, _, _, _, _, 5, _, _, _, _, _, _, _, 3, _, _, _, _, _, _, _, 4, _, _, _, _, _, _, _],
    arp: [7, _, 9, _, 11, _, 9, _, 12, _, 11, _, 9, _, 7, _, 10, _, 12, _, 14, _, 12, _, 11, _, 9, _, 8, _, 9, _],
    drums: 'h.......h.......h.......h.......',
  },
  aliens: {
    bpm: 112, root: 40, scale: WHOLE, bassWave: 'sawtooth', arpWave: 'square',
    bass: [0, _, 0, _, _, 0, _, _, 2, _, 2, _, _, 1, _, _, 0, _, 0, _, _, 0, _, _, 3, _, 2, _, 1, _, _, _],
    arp: [6, 8, 10, 8, 6, 8, 10, 12, 7, 9, 11, 9, 7, 9, 11, 13, 6, 8, 10, 8, 6, 8, 10, 12, 9, 11, 13, 11, 9, 7, 8, 9],
    drums: 'k.h.s.h.k.h.s.hhk.h.s.h.k.hks.hh',
  },
  romans: {
    bpm: 104, root: 43, scale: HARM, bassWave: 'triangle', arpWave: 'triangle',
    bass: [0, _, _, 0, _, _, 0, _, 3, _, _, 3, _, _, 4, _, 0, _, _, 0, _, _, 0, _, 4, _, _, 4, _, 6, 4, _],
    arp: [7, _, 9, 10, _, 9, 7, _, 10, _, 11, 12, _, 11, 10, _, 7, _, 9, 10, _, 9, 7, _, 11, _, 10, 9, _, 8, 7, _],
    drums: 'k..sk.s.k..sk.ssk..sk.s.k..skss.',
  },
  greece: {
    bpm: 96, root: 42, scale: PHRY, bassWave: 'triangle', arpWave: 'sine',
    bass: [0, _, _, _, 0, _, 1, _, 0, _, _, _, 3, _, 1, _, 0, _, _, _, 0, _, 1, _, 4, _, 3, _, 1, _, _, _],
    arp: [7, 8, 10, 8, 7, _, 8, _, 10, 11, 10, 8, 7, _, 5, _, 7, 8, 10, 12, 11, 10, 8, _, 7, _, 8, _, 7, _, _, _],
    drums: 'k.h.h.s.k.h.h.s.k.h.h.s.k.hhs.s.',
  },
  boss: {
    bpm: 148, root: 38, scale: HARM, bassWave: 'sawtooth', arpWave: 'square',
    bass: [0, 0, 7, 0, 0, 6, 0, 5, 0, 0, 7, 0, 3, 4, 5, 6, 0, 0, 7, 0, 0, 6, 0, 5, 1, 1, 8, 1, 1, 6, 5, 4],
    arp: [14, _, 13, _, 14, _, 10, _, 11, _, 10, _, 9, _, 8, _, 14, _, 13, _, 14, _, 17, _, 15, _, 14, _, 13, _, 11, _],
    drums: 'k.hsk.hsk.hsk.hskkhsk.hsk.hsksss',
  },
};

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicGain!: GainNode;
  sfxGain!: GainNode;
  noise!: AudioBuffer;
  private current: MusicName = 'none';
  private wanted: MusicName = 'none';
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private musicVol = 0.6;
  private sfxVol = 0.8;
  private lastSfx: Record<string, number> = {};

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    this.musicGain = ctx.createGain();
    this.sfxGain = ctx.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.setVolumes(this.musicVol, this.sfxVol);
    const len = ctx.sampleRate * 1;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.timer = window.setInterval(() => this.schedule(), 25);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend(); else this.ctx.resume();
    });
    if (this.wanted !== 'none') this.playMusic(this.wanted);
  }

  setVolumes(music: number, sfx: number) {
    this.musicVol = music; this.sfxVol = sfx;
    if (!this.ctx) return;
    this.musicGain.gain.value = music * 0.35;
    this.sfxGain.gain.value = sfx * 0.6;
  }

  playMusic(name: MusicName) {
    this.wanted = name;
    if (!this.ctx || this.current === name) return;
    this.current = name;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || this.current === 'none') return;
    const tr = TRACKS[this.current];
    const stepDur = 60 / tr.bpm / 4;
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.12) {
      const i = this.step % 32;
      const t = this.nextTime;
      const deg = (d: number) => {
        const n = tr.scale.length;
        return tr.root + tr.scale[((d % n) + n) % n] + 12 * Math.floor(d / n);
      };
      const b = tr.bass[i];
      if (b !== null && b !== undefined) this.tone(deg(b), t, stepDur * 1.8, tr.bassWave, 0.32, this.musicGain, 900);
      const a = tr.arp[i];
      if (a !== null && a !== undefined) this.tone(deg(a) + 12, t, stepDur * 0.9, tr.arpWave, 0.09, this.musicGain, 3000);
      const dr = tr.drums[i];
      if (dr === 'k') this.kick(t);
      else if (dr === 's') this.noiseHit(t, 0.12, 1800, 0.18, 'bandpass', this.musicGain);
      else if (dr === 'h') this.noiseHit(t, 0.03, 7000, 0.07, 'highpass', this.musicGain);
      this.step++;
      this.nextTime += stepDur;
    }
  }

  private tone(m: number, t: number, dur: number, wave: OscillatorType, vol: number, out: AudioNode, cutoff = 4000) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = cutoff;
    o.type = wave;
    o.frequency.value = midi(m);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(out);
    o.start(t); o.stop(t + dur + 0.02);
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(this.musicGain);
    o.start(t); o.stop(t + 0.22);
  }

  private noiseHit(t: number, dur: number, freq: number, vol: number, type: BiquadFilterType, out: AudioNode) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  private sweep(t: number, f0: number, f1: number, dur: number, wave: OscillatorType, vol: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  sfx(name: SfxName) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    // gleiche Sounds nicht zu dicht hintereinander
    if (now - (this.lastSfx[name] || 0) < 0.03) return;
    this.lastSfx[name] = now;
    const t = now + 0.005;
    const out = this.sfxGain;
    switch (name) {
      case 'shoot': this.sweep(t, 620, 300, 0.09, 'sine', 0.25); break;
      case 'shot': this.sweep(t, 300, 150, 0.12, 'square', 0.08); break;
      case 'hit': this.noiseHit(t, 0.06, 2500, 0.25, 'bandpass', out); break;
      case 'enemyDie': this.sweep(t, 300, 60, 0.25, 'sawtooth', 0.18); this.noiseHit(t, 0.15, 900, 0.25, 'lowpass', out); break;
      case 'hurt': this.sweep(t, 400, 90, 0.3, 'sawtooth', 0.3); break;
      case 'pickup': this.tone(76, t, 0.08, 'square', 0.12, out); this.tone(83, t + 0.07, 0.12, 'square', 0.12, out); break;
      case 'coin': this.tone(88, t, 0.06, 'square', 0.1, out); this.tone(95, t + 0.05, 0.15, 'square', 0.1, out); break;
      case 'door': this.sweep(t, 120, 50, 0.3, 'triangle', 0.4); break;
      case 'bomb': this.noiseHit(t, 0.7, 500, 0.9, 'lowpass', out); this.sweep(t, 90, 30, 0.6, 'sine', 0.7); break;
      case 'item': [72, 76, 79, 84].forEach((m, i) => this.tone(m, t + i * 0.08, 0.25, 'triangle', 0.18, out)); break;
      case 'click': this.tone(84, t, 0.04, 'square', 0.06, out); break;
      case 'charge': this.tone(79, t, 0.1, 'sine', 0.15, out); this.tone(86, t + 0.08, 0.15, 'sine', 0.15, out); break;
      case 'use': this.sweep(t, 200, 900, 0.25, 'triangle', 0.25); break;
      case 'error': this.tone(50, t, 0.12, 'square', 0.1, out); break;
      case 'win': [67, 71, 74, 79, 83, 86].forEach((m, i) => this.tone(m, t + i * 0.1, 0.4, 'triangle', 0.2, out)); break;
      case 'lose': [64, 62, 59, 55].forEach((m, i) => this.tone(m, t + i * 0.18, 0.45, 'triangle', 0.2, out)); break;
    }
  }
}
