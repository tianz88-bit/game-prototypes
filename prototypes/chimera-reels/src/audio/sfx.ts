// Synthesised placeholder sounds (WebAudio, no files). The context starts on
// the first tap or key press, as browsers require.
import { tune } from '../tune';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch {
    ctx = null;
  }
}

function ready(): AudioContext | null {
  if (!ctx || !master) return null;
  master.gain.value = tune.feel.volume;
  return ctx;
}

function tone(freq: number, dur: number, o: { type?: OscillatorType; vol?: number; slide?: number; delay?: number } = {}) {
  const c = ready();
  if (!c || !master) return;
  const t = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'square';
  osc.frequency.setValueAtTime(freq, t);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * o.slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol ?? 0.15, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function hiss(dur: number, o: { vol?: number; freq?: number; q?: number; delay?: number; type?: BiquadFilterType } = {}) {
  const c = ready();
  if (!c || !master || !noise) return;
  const t = c.currentTime + (o.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.frequency.value = o.freq ?? 1200;
  f.Q.value = o.q ?? 1;
  const g = c.createGain();
  g.gain.setValueAtTime(o.vol ?? 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

export const sfx = {
  tick: (pitch = 1) => tone(900 * pitch, 0.03, { type: 'triangle', vol: 0.05 }),
  reelStop: (reel: number) => {
    tone(180 - reel * 30, 0.12, { type: 'square', vol: 0.12, slide: 0.5 });
    hiss(0.06, { vol: 0.12, freq: 2500 });
  },
  tease: () => {
    for (let i = 0; i < 6; i++) tone(500 + i * 90, 0.08, { type: 'triangle', vol: 0.07, delay: i * 0.1 });
  },
  land: () => tone(660, 0.08, { type: 'triangle', vol: 0.08 }),
  match: (tier: number) => {
    const base = [523, 659, 784, 1047];
    for (let i = 0; i <= tier; i++) tone(base[i], 0.12, { type: 'square', vol: 0.06, delay: i * 0.05 });
  },
  execute: () => tone(220, 0.15, { type: 'sawtooth', vol: 0.08, slide: 1.8 }),
  hit: (big: boolean) => {
    hiss(big ? 0.22 : 0.12, { vol: big ? 0.35 : 0.22, freq: big ? 600 : 1000, q: 0.7 });
    tone(big ? 90 : 140, big ? 0.25 : 0.12, { type: 'sine', vol: 0.3, slide: 0.4 });
  },
  block: () => tone(1400, 0.08, { type: 'square', vol: 0.08, slide: 0.7 }),
  super: () => {
    [262, 330, 392, 523, 659].forEach((f, i) => tone(f, 0.35, { type: 'sawtooth', vol: 0.07, delay: i * 0.04 }));
    hiss(0.5, { vol: 0.25, freq: 400, q: 0.5, delay: 0.1 });
  },
  pocket: () => {
    for (let i = 0; i < 4; i++) tone(700 + i * 160, 0.06, { type: 'triangle', vol: 0.06, delay: i * 0.035 });
  },
  burn: () => {
    hiss(0.35, { vol: 0.25, freq: 3000, q: 0.4, type: 'highpass' });
    tone(300, 0.25, { type: 'sawtooth', vol: 0.06, slide: 2.5 });
  },
  break: () => {
    hiss(0.4, { vol: 0.35, freq: 350, q: 0.6 });
    tone(70, 0.4, { type: 'sine', vol: 0.35, slide: 0.5 });
    tone(1800, 0.15, { type: 'square', vol: 0.05, slide: 0.3, delay: 0.05 });
  },
  miss: () => tone(400, 0.15, { type: 'triangle', vol: 0.06, slide: 0.5 }),
  lost: () => tone(300, 0.25, { type: 'square', vol: 0.07, slide: 0.5 }),
  coin: (i = 0) => tone(1320 + i * 60, 0.07, { type: 'square', vol: 0.05, delay: i * 0.05 }),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'square', vol: 0.07, delay: i * 0.1 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.08, delay: i * 0.12 })),
  ui: () => tone(880, 0.04, { type: 'triangle', vol: 0.06 }),
};
