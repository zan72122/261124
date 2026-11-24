// audio.js — synthesised kitchen sound effects + BGM for "helping Mama cook curry".
// ES module; asks assets.js only when to start downloading the music. Everything is a safe no-op before audio.unlock()
// or when Web Audio is unavailable.
//
// Musical one-shots use the C-major pentatonic set (C D E G A). Analysis of
// assets/bgm.mp3 (chroma over 8 s windows) shows C / E / G / A as the dominant
// pitch classes with a C-major tonic (some passing F# / G# from secondary
// dominants), so C pentatonic fits without transposition (it is also a subset
// of G major, the closest neighbouring key).

import { whenSceneReady } from './assets.js';

const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;

// ---------------------------------------------------------------- utilities
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dB = (d) => Math.pow(10, d / 20);

// pentatonic index: 0 = C4, 1 = D4, 2 = E4, 3 = G4, 4 = A4, 5 = C5, ...
const PENT_DEG = [0, 2, 4, 7, 9];
function pn(i) {
  const o = Math.floor(i / 5), d = PENT_DEG[((i % 5) + 5) % 5];
  return 261.6256 * Math.pow(2, o + d / 12);
}

// shared noise buffers, one set per context
const bufCache = new WeakMap();
function buffersFor(ctx) {
  let b = bufCache.get(ctx);
  if (b) return b;
  const sr = ctx.sampleRate, n = Math.floor(sr * 2);
  const white = ctx.createBuffer(1, n, sr), pink = ctx.createBuffer(1, n, sr);
  const w = white.getChannelData(0), p = pink.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const x = Math.random() * 2 - 1;
    w[i] = x * 0.7;
    b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759;
    b2 = 0.969 * b2 + x * 0.153852; b3 = 0.8665 * b3 + x * 0.3104856;
    b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
    p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11;
    b6 = x * 0.115926;
  }
  b = { white, pink };
  bufCache.set(ctx, b);
  return b;
}

// ---------------------------------------------------------------- voice + node helpers
// A "voice" V collects every node it creates so it can be disconnected when its
// sources have all ended.
function newVoice(ctx, dest, onDone) {
  const V = { ctx, buf: buffersFor(ctx), nodes: [], srcs: [], out: null, onDone, live: 0 };
  V.out = ctx.createGain();
  V.out.connect(dest);
  V.nodes.push(V.out);
  return V;
}
function finishVoice(V) {
  // attach ended handlers after synthesis
  V.live = V.srcs.length;
  if (!V.live) { cleanup(V); return; }
  for (const s of V.srcs) {
    s.onended = () => { if (--V.live <= 0) cleanup(V); };
  }
}
function cleanup(V) {
  for (const n of V.nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } }
  V.nodes.length = 0; V.srcs.length = 0;
  if (V.onDone) { const f = V.onDone; V.onDone = null; f(); }
}
const mk = (V, n) => (V.nodes.push(n), n);
const srcNode = (V, n) => (V.nodes.push(n), V.srcs.push(n), n);
function G(V, v = 1) { const g = mk(V, V.ctx.createGain()); g.gain.value = v; return g; }
function F(V, type, f, q = 0.7) {
  const b = mk(V, V.ctx.createBiquadFilter());
  b.type = type; b.frequency.value = f; b.Q.value = q; return b;
}
function chain(...ns) { for (let i = 0; i < ns.length - 1; i++) ns[i].connect(ns[i + 1]); return ns[0]; }
function panner(V, pan) {
  if (!pan || !V.ctx.createStereoPanner) return null;
  const p = mk(V, V.ctx.createStereoPanner()); p.pan.value = clamp(pan, -1, 1); return p;
}
// attack (linear) then exponential decay
function envAD(param, t, a, d, peak) {
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + Math.max(0.001, a));
  param.exponentialRampToValueAtTime(Math.max(peak * 0.0005, 1e-5), t + a + d);
  param.linearRampToValueAtTime(0, t + a + d + 0.01);
}
function osc(V, type, f, t, dur) {
  const o = srcNode(V, V.ctx.createOscillator());
  o.type = type; o.frequency.setValueAtTime(f, t);
  o.start(t); o.stop(t + dur + 0.03); return o;
}
function noiseSrc(V, t, dur, color = 'white', rate = 1) {
  const s = srcNode(V, V.ctx.createBufferSource());
  s.buffer = V.buf[color] || V.buf.white; s.loop = true; s.playbackRate.value = rate;
  s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.03); return s;
}

// pitched tone with AD envelope. Optional exponential glide to f2 over glide sec,
// optional vibrato (vib = depth ratio, vibRate Hz).
function tone(V, dest, o) {
  const t = Math.max(o.t, V.ctx.currentTime);
  const { f, type = 'sine', a = 0.005, d = 0.2, peak = 0.3 } = o;
  const dur = a + d;
  const os = osc(V, type, f, t, dur);
  if (o.f2) os.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + (o.glide || dur));
  if (o.vib) {
    const l = osc(V, 'sine', o.vibRate || 6, t, dur);
    const lg = G(V, f * o.vib);
    if (o.vibDelay) { lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * o.vib, t + o.vibDelay); }
    chain(l, lg, os.frequency);
  }
  const g = G(V, 0);
  envAD(g.gain, t, a, d, peak);
  chain(os, g, dest);
  return { os, g, end: t + dur };
}
// filtered noise burst with AD envelope. Optional filter glide to f2.
function nz(V, dest, o) {
  const t = Math.max(o.t, V.ctx.currentTime);
  const { a = 0.003, d = 0.1, peak = 0.3, color = 'white', ft = 'bandpass', f = 1000, q = 1, rate = 1 } = o;
  const dur = a + d;
  const s = noiseSrc(V, t, dur, color, rate);
  const fl = F(V, ft, f, q);
  if (o.f2) {
    fl.frequency.setValueAtTime(f, t);
    fl.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide || dur));
  }
  const g = G(V, 0);
  envAD(g.gain, t, a, d, peak);
  // lowpassed noise: trim sub-bass small speakers cannot play anyway
  const head = ft === 'lowpass' ? chain(F(V, 'highpass', 150, 0.6), g) : g;
  if (o.lp) chain(s, fl, F(V, 'lowpass', o.lp, 0.5), head); else chain(s, fl, head);
  g.connect(dest);
  return { s, fl, g, end: t + dur };
}
// bell: harmonic-ish partials, upper ones decay faster (warm, glassy)
function bell(V, dest, f, t, peak = 0.25, dur = 1.0) {
  tone(V, dest, { t, f, a: 0.004, d: dur, peak });
  tone(V, dest, { t, f: f * 2.0, a: 0.003, d: dur * 0.45, peak: peak * 0.3 });
  tone(V, dest, { t, f: f * 3.01, a: 0.002, d: dur * 0.2, peak: peak * 0.1 });
  if (f < 1500) tone(V, dest, { t, f: f * 4.2, a: 0.002, d: dur * 0.1, peak: peak * 0.06 });
  return t + dur;
}
// marimba: sine body + quick 4th partial + tiny mallet click
function marimba(V, dest, f, t, peak = 0.3, dur = 0.5) {
  tone(V, dest, { t, f, a: 0.003, d: dur, peak });
  tone(V, dest, { t, f: f * 3.99, a: 0.002, d: 0.06, peak: peak * 0.25 });
  tone(V, dest, { t, f: f * 2, type: 'triangle', a: 0.002, d: dur * 0.3, peak: peak * 0.12 });
  nz(V, dest, { t, a: 0.001, d: 0.012, peak: peak * 0.15, f: Math.min(f * 3, 3500), q: 1.5 });
  return t + dur;
}
// wooden / soft click transient
function click(V, dest, t, peak = 0.3, f = 2500, d = 0.008, q = 1.2) {
  return nz(V, dest, { t, a: 0.0008, d, peak, f, q });
}
// water bubble: rising sine chirp
function bubbleBlip(V, dest, t, f, peak = 0.2, d = 0.06) {
  tone(V, dest, { t, f, f2: f * 1.7, glide: d * 0.8, a: 0.003, d, peak });
  return t + d;
}
// formant voice syllable (wordless babble)
const VOWELS = { a: [800, 1250], e: [500, 1800], i: [350, 2200], o: [520, 900], u: [330, 750] };
function syllable(V, dest, o) {
  const { t, f, d = 0.1, peak = 0.25, vowel = 'a', f2, glide, vib, vibRate, startRatio = 0.94 } = o;
  const dur = d + 0.012;
  const src1 = osc(V, 'sawtooth', f * startRatio, t, dur);
  const src2 = osc(V, 'triangle', f * startRatio, t, dur);
  for (const s of [src1, src2]) {
    s.frequency.exponentialRampToValueAtTime(f, t + Math.min(0.035, d * 0.4));
    if (f2) s.frequency.exponentialRampToValueAtTime(f2, t + (glide || d));
  }
  if (vib) {
    const l = osc(V, 'sine', vibRate || 6, t, dur), lg = G(V, 0);
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * vib, t + d * 0.4);
    chain(l, lg); lg.connect(src1.frequency); lg.connect(src2.frequency);
  }
  const mix = G(V, 1);
  const sawG = G(V, 0.35); chain(src1, sawG, mix); src2.connect(mix);
  const lp = F(V, 'lowpass', Math.min(3000, f * 3.2), 0.6);
  const [F1, F2] = VOWELS[vowel] || VOWELS.a;
  const env = G(V, 0);
  envAD(env.gain, t, 0.012, d, peak);
  mix.connect(lp);
  const dry = G(V, 0.5); chain(lp, dry, env);
  const b1 = F(V, 'bandpass', F1, 3), b1g = G(V, 1.6); chain(lp, b1, b1g, env);
  const b2 = F(V, 'bandpass', F2, 4), b2g = G(V, 1.0); chain(lp, b2, b2g, env);
  env.connect(dest);
  return t + dur;
}

// ---------------------------------------------------------------- one-shots
// signature: (V, out, t, o) where o.p = pitch multiplier, plus extra opts.
const SFX = {
  // ---------- UI / feedback
  tap(V, out, t, { p }) {
    click(V, out, t, 0.28, 1700 * p, 0.012, 2);
    tone(V, out, { t, f: 820 * p, f2: 560 * p, glide: 0.03, a: 0.001, d: 0.035, peak: 0.22 });
  },
  pop(V, out, t, { p }) {
    tone(V, out, { t, f: 420 * p, f2: 880 * p, glide: 0.05, a: 0.004, d: 0.13, peak: 0.42 });
    tone(V, out, { t, f: 840 * p, f2: 1500 * p, glide: 0.04, type: 'triangle', a: 0.003, d: 0.05, peak: 0.08 });
  },
  sparkle(V, out, t, { p }) {
    const seq = pick([[13, 12, 11, 12, 13, 14, 15], [15, 14, 13, 12, 13, 14], [11, 12, 13, 14, 15, 14]]);
    seq.forEach((i, k) => bell(V, out, pn(i) * p, t + k * 0.055, 0.12 * (1 - k * 0.06), 0.35));
  },
  ding(V, out, t, { p }) {
    bell(V, out, pn(10) * p, t, 0.32, 1.1); // C6
    tone(V, out, { t, f: pn(5) * p, a: 0.004, d: 0.6, peak: 0.08 }); // warm octave below
  },
  success(V, out, t, { p }) {
    [5, 7, 8, 10].forEach((i, k) => marimba(V, out, pn(i) * p, t + k * 0.11, 0.3, k === 3 ? 0.45 : 0.28));
    bell(V, out, pn(10) * p, t + 0.33, 0.1, 0.45);
  },
  fanfare(V, out, t, { p }) {
    [5, 7, 8, 10, 12].forEach((i, k) => marimba(V, out, pn(i) * p, t + k * 0.09, 0.26, 0.3));
    const tc = t + 0.5;
    [5, 7, 8, 10].forEach((i) => bell(V, out, pn(i) * p, tc, 0.13, 1.5));
    // soft triangle pad (C4 E4 G4 C5)
    [0, 2, 3, 5].forEach((i) => {
      const r = tone(V, out, { t: tc, f: pn(i) * p, type: 'triangle', a: 0.06, d: 1.5, peak: 0.07, vib: 0.004, vibRate: 5 });
      return r;
    });
    for (let k = 0; k < 12; k++) {
      const tt = tc + 0.12 + k * 0.11 + rnd(0, 0.05);
      bell(V, out, pn(pick([11, 12, 13, 14, 15])) * p, tt, 0.07 * (1 - k / 14), 0.3);
    }
  },
  heart(V, out, t, { p }) {
    tone(V, out, { t, f: pn(4) * p, f2: pn(7) * p, glide: 0.16, a: 0.03, d: 0.45, peak: 0.36, vib: 0.01, vibRate: 7 });
    tone(V, out, { t, f: pn(4) * 2 * p, f2: pn(7) * 2 * p, glide: 0.16, type: 'triangle', a: 0.03, d: 0.25, peak: 0.06 });
  },
  whoosh(V, out, t, { p }) {
    const r = nz(V, out, { t, color: 'pink', a: 0.14, d: 0.3, peak: 0.55, f: 450 * p, q: 1.1, f2: 2200 * p, glide: 0.17 });
    r.fl.frequency.exponentialRampToValueAtTime(700 * p, t + 0.45);
  },
  drop(V, out, t, { p }) {
    tone(V, out, { t, f: 210 * p, f2: 140 * p, glide: 0.08, type: 'triangle', a: 0.002, d: 0.11, peak: 0.55 });
    tone(V, out, { t, f: 420 * p, f2: 300 * p, glide: 0.05, a: 0.002, d: 0.05, peak: 0.12 });
    nz(V, out, { t, color: 'pink', ft: 'lowpass', f: 700 * p, q: 0.5, a: 0.002, d: 0.07, peak: 0.45 });
  },
  no(V, out, t, { p }) {
    const lp = F(V, 'lowpass', 1100, 0.5); lp.connect(out);
    tone(V, lp, { t, f: pn(2) * p, type: 'triangle', a: 0.01, d: 0.1, peak: 0.3 });
    tone(V, lp, { t: t + 0.16, f: pn(0) * p, f2: pn(0) * 0.95 * p, type: 'triangle', a: 0.01, d: 0.16, peak: 0.28 });
  },

  // ---------- story
  door(V, out, t, { p }) {
    click(V, out, t, 0.25, 2400 * p, 0.01, 2);
    tone(V, out, { t, f: 1650 * p, a: 0.001, d: 0.05, peak: 0.05 });
    click(V, out, t + 0.06, 0.32, 1900 * p, 0.014, 2);
    tone(V, out, { t: t + 0.06, f: 1250 * p, a: 0.001, d: 0.07, peak: 0.06 });
    const t2 = t + 0.38;
    tone(V, out, { t: t2, f: 190 * p, f2: 120 * p, glide: 0.12, type: 'triangle', a: 0.004, d: 0.18, peak: 0.5 });
    nz(V, out, { t: t2, color: 'pink', ft: 'lowpass', f: 550 * p, q: 0.5, a: 0.004, d: 0.16, peak: 0.45 });
    click(V, out, t2, 0.08, 1500 * p, 0.012, 1);
  },
  steps(V, out, t, { p }) {
    for (let k = 0; k < 4; k++) {
      const tt = t + k * 0.33 + rnd(0, 0.03), v = rnd(0.8, 1.0) * (k % 2 ? 0.9 : 1);
      nz(V, out, { t: tt, color: 'pink', ft: 'lowpass', f: 750 * p, q: 0.6, a: 0.006, d: 0.08, peak: 0.42 * v });
      tone(V, out, { t: tt, f: 210 * p, f2: 150 * p, glide: 0.05, type: 'triangle', a: 0.004, d: 0.06, peak: 0.28 * v });
      nz(V, out, { t: tt + 0.03, color: 'white', f: 2600 * p, q: 1.5, a: 0.004, d: 0.03, peak: 0.03 * v });
    }
  },
  sigh(V, out, t, { p }) {
    const a = nz(V, out, { t, color: 'pink', f: 950 * p, q: 1.2, f2: 380 * p, glide: 1.0, a: 0.22, d: 0.85, peak: 0.6 });
    nz(V, out, { t, color: 'pink', f: 1700 * p, q: 2.5, f2: 800 * p, glide: 1.0, a: 0.2, d: 0.7, peak: 0.25 });
    return a;
  },
  thump(V, out, t, { p }) {
    tone(V, out, { t, f: 205 * p, f2: 150 * p, glide: 0.12, type: 'triangle', a: 0.003, d: 0.16, peak: 0.5 });
    tone(V, out, { t, f: 410 * p, f2: 300 * p, glide: 0.08, a: 0.003, d: 0.08, peak: 0.16 });
    nz(V, out, { t, color: 'pink', ft: 'lowpass', f: 600 * p, q: 0.5, a: 0.003, d: 0.13, peak: 0.5 });
    // wicker rustle
    nz(V, out, { t: t + 0.01, color: 'white', f: 2800 * p, q: 0.8, a: 0.01, d: 0.12, peak: 0.06 });
  },
  idea(V, out, t, { p }) {
    const f1 = pn(8) * p, f2 = pn(10) * p; // G5 -> C6
    tone(V, out, { t, f: f1, a: 0.003, d: 0.09, peak: 0.3 });
    tone(V, out, { t, f: f1 * 2, type: 'triangle', a: 0.003, d: 0.05, peak: 0.06 });
    bell(V, out, f2, t + 0.1, 0.3, 0.55);
    tone(V, out, { t: t + 0.1, f: f2, type: 'triangle', a: 0.004, d: 0.3, peak: 0.08, vib: 0.008, vibRate: 7 });
  },
  growl(V, out, t, { p }) {
    // cute tummy rumble: FM triangle around 160 Hz, wobbling AM ~ 13 Hz, harmonics kept for small speakers
    const dur = 1.05, f = 165 * p;
    const car = osc(V, 'triangle', f, t, dur);
    car.frequency.setValueAtTime(f * 1.05, t);
    car.frequency.linearRampToValueAtTime(f * 1.12, t + 0.35);
    car.frequency.exponentialRampToValueAtTime(f * 0.88, t + dur);
    const mod = osc(V, 'sine', f * 1.5, t, dur), mg = G(V, f * 0.9);
    chain(mod, mg, car.frequency);
    const wob = osc(V, 'sine', 12, t, dur);
    wob.frequency.linearRampToValueAtTime(16, t + dur);
    const wg = G(V, 0.45); chain(wob, wg);
    const am = G(V, 0.55); wg.connect(am.gain);
    const lp = F(V, 'lowpass', 1100, 0.9);
    const env = G(V, 0);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.55, t + 0.12);
    env.gain.setValueAtTime(0.55, t + 0.6);
    env.gain.exponentialRampToValueAtTime(0.002, t + dur);
    chain(car, am, lp, env, out);
    // soft gurgle noise
    nz(V, out, { t: t + 0.05, color: 'pink', f: 380 * p, q: 3, f2: 260 * p, glide: 0.9, a: 0.2, d: 0.75, peak: 0.12 });
  },
  clap(V, out, t, { p }) {
    for (let k = 0; k < 3; k++) {
      nz(V, out, { t: t + k * 0.006, color: 'white', f: 1250 * p, q: 0.9, a: 0.0008, d: k === 2 ? 0.11 : 0.012, peak: 0.55, lp: 4000 });
    }
    nz(V, out, { t, color: 'pink', ft: 'lowpass', f: 500, q: 0.5, a: 0.001, d: 0.05, peak: 0.25 });
  },
  girl(V, out, t, o) { babble(V, out, t, o, 8, 1.0); },
  mama(V, out, t, o) { babble(V, out, t, o, 3, 0.95); },

  // ---------- wash
  splash(V, out, t, { p }) {
    nz(V, out, { t, color: 'white', f: 1300 * p, q: 0.6, f2: 900 * p, glide: 0.3, a: 0.006, d: 0.3, peak: 0.45, lp: 4200 });
    nz(V, out, { t, color: 'pink', ft: 'lowpass', f: 700 * p, q: 0.5, a: 0.004, d: 0.09, peak: 0.3 });
    for (let k = 0; k < 6; k++) bubbleBlip(V, out, t + rnd(0.02, 0.3), rnd(600, 1300) * p, rnd(0.05, 0.12), rnd(0.03, 0.06));
  },
  scrub(V, out, t, { p }) {
    const f = 1500 * p;
    const r = nz(V, out, { t, color: 'white', f, q: 4, f2: f * 1.25, glide: 0.11, a: 0.02, d: 0.1, peak: 0.55, lp: 4000 });
    // squeaky fast amplitude flutter
    const l = osc(V, 'square', rnd(38, 55), t, 0.13), lg = G(V, 0.4);
    const am = G(V, 0.6); chain(l, lg, am.gain);
    r.g.disconnect(); chain(r.g, am, out);
    tone(V, out, { t: t + 0.01, f: 1050 * p, f2: 1250 * p, glide: 0.1, a: 0.02, d: 0.09, peak: 0.05 });
    nz(V, out, { t, color: 'pink', f: 600 * p, q: 1, a: 0.02, d: 0.09, peak: 0.12 });
  },
  bubble(V, out, t, { p }) {
    bubbleBlip(V, out, t, rnd(380, 900) * p, 0.35, rnd(0.05, 0.08));
  },
  shine(V, out, t, { p }) {
    // "kyu" squeak
    tone(V, out, { t, f: 1150 * p, f2: 2100 * p, glide: 0.09, a: 0.012, d: 0.1, peak: 0.16, vib: 0.03, vibRate: 30 });
    tone(V, out, { t, f: 575 * p, f2: 1050 * p, glide: 0.09, type: 'triangle', a: 0.012, d: 0.08, peak: 0.08 });
    // "pin!"
    bell(V, out, pn(12) * p, t + 0.13, 0.26, 0.6); // E6
    [13, 14, 15].forEach((i, k) => bell(V, out, pn(i) * p, t + 0.2 + k * 0.06, 0.08, 0.3));
  },

  // ---------- cut
  chop(V, out, t, { p, soft }) {
    const s = soft ? 0.45 : 1;
    // blade transient
    click(V, out, t, 0.7 * s, 3200 * p, soft ? 0.01 : 0.006, 1.0);
    nz(V, out, { t, color: 'white', ft: 'highpass', f: 1800, q: 0.5, a: 0.0006, d: 0.004, peak: 0.22 * s, lp: 6000 });
    // woody body ~180 Hz with harmonics so phones can play it
    const tb = t + 0.004;
    tone(V, out, { t: tb, f: 185 * p, f2: 160 * p, glide: 0.06, a: soft ? 0.004 : 0.001, d: 0.09, peak: 0.55 * (soft ? 0.75 : 1) });
    tone(V, out, { t: tb, f: 370 * p, a: 0.001, d: 0.05, peak: 0.18 * s, type: 'triangle' });
    nz(V, out, { t: tb, color: 'pink', f: 520 * p, q: 2, a: 0.001, d: 0.05, peak: 0.45 * (soft ? 0.7 : 1) });
    if (soft) nz(V, out, { t, color: 'white', f: 2200 * p, q: 1, a: 0.01, d: 0.04, peak: 0.06 }); // juicy onion crunch
  },
  stamp(V, out, t, { p }) {
    click(V, out, t, 0.35, 2600 * p, 0.007, 1.2);
    tone(V, out, { t, f: 240 * p, f2: 170 * p, glide: 0.05, type: 'triangle', a: 0.001, d: 0.06, peak: 0.35 });
    const t2 = t + 0.045;
    tone(V, out, { t: t2, f: 820 * p, f2: 520 * p, glide: 0.05, a: 0.002, d: 0.08, peak: 0.32 });
    nz(V, out, { t: t2, color: 'white', f: 900 * p, q: 8, a: 0.001, d: 0.07, peak: 0.6 });
  },
  slide(V, out, t, { p }) {
    const r = nz(V, out, { t, color: 'pink', f: 1100 * p, q: 0.8, f2: 1500 * p, glide: 0.25, a: 0.06, d: 0.19, peak: 0.55, lp: 3500 });
    const l = osc(V, 'sawtooth', rnd(22, 30), t, 0.26), lg = G(V, 0.3), am = G(V, 0.7);
    chain(l, lg, am.gain); r.g.disconnect(); chain(r.g, am, out);
    nz(V, out, { t, color: 'pink', f: 380 * p, q: 1, a: 0.05, d: 0.2, peak: 0.18 });
  },

  // ---------- pot
  ignite(V, out, t, { p }) {
    const n = 4;
    for (let k = 0; k < n; k++) {
      const tt = t + k * 0.075 + rnd(0, 0.01);
      click(V, out, tt, 0.32, rnd(2600, 3400) * p, 0.006, 2);
      tone(V, out, { t: tt, f: 2100 * p, a: 0.001, d: 0.015, peak: 0.04 });
    }
    const tb = t + n * 0.075 + 0.04;
    const r = nz(V, out, { t: tb, color: 'pink', ft: 'lowpass', f: 250, q: 0.8, f2: 1400, glide: 0.12, a: 0.05, d: 0.5, peak: 0.6 });
    r.fl.frequency.exponentialRampToValueAtTime(500, tb + 0.5);
    tone(V, out, { t: tb, f: 170, f2: 120, glide: 0.2, type: 'triangle', a: 0.04, d: 0.25, peak: 0.12 });
  },
  plop(V, out, t, { p }) {
    tone(V, out, { t, f: 950 * p, f2: 260 * p, glide: 0.075, a: 0.002, d: 0.11, peak: 0.42 });
    tone(V, out, { t, f: 1900 * p, f2: 520 * p, glide: 0.075, type: 'triangle', a: 0.002, d: 0.05, peak: 0.06 });
    nz(V, out, { t, color: 'pink', ft: 'lowpass', f: 600, q: 0.5, a: 0.002, d: 0.06, peak: 0.25 });
    nz(V, out, { t: t + 0.05, color: 'white', f: 2000 * p, q: 0.8, a: 0.004, d: 0.08, peak: 0.1, lp: 4000 });
    bubbleBlip(V, out, t + 0.09, rnd(700, 1000) * p, 0.07, 0.04);
    bubbleBlip(V, out, t + 0.14, rnd(900, 1300) * p, 0.05, 0.035);
  },
  clink(V, out, t, { p }) {
    const hit = (tt, v) => {
      click(V, out, tt, 0.18 * v, 3000 * p, 0.004, 1.5);
      [[1180, 0.45, 0.2], [2290, 0.3, 0.09], [3350, 0.2, 0.05], [4500, 0.1, 0.03]].forEach(([f, d, pk]) =>
        tone(V, out, { t: tt, f: f * p, a: 0.001, d, peak: pk * v }));
    };
    hit(t, 1); hit(t + 0.07, 0.45);
  },
  rattle(V, out, t, { p }) {
    let tt = t;
    for (let k = 0; k < 8; k++) {
      const v = (0.7 + 0.3 * Math.sin(k * 0.8)) * rnd(0.75, 1);
      click(V, out, tt, 0.14 * v, 2500 * p, 0.004, 1.5);
      tone(V, out, { t: tt, f: rnd(900, 1000) * p, a: 0.001, d: 0.05, peak: 0.13 * v });
      tone(V, out, { t: tt, f: rnd(1650, 1800) * p, a: 0.001, d: 0.03, peak: 0.05 * v });
      tone(V, out, { t: tt, f: 300 * p, f2: 240 * p, glide: 0.03, type: 'triangle', a: 0.001, d: 0.035, peak: 0.12 * v });
      tt += rnd(0.06, 0.085);
    }
  },
  steam(V, out, t, { p }) {
    const r = nz(V, out, { t, color: 'pink', f: 500 * p, q: 0.6, f2: 2300 * p, glide: 0.4, a: 0.32, d: 0.85, peak: 0.6, lp: 4500 });
    r.fl.frequency.exponentialRampToValueAtTime(1100 * p, t + 1.17);
    nz(V, out, { t, color: 'white', ft: 'highpass', f: 2500, q: 0.5, a: 0.4, d: 0.6, peak: 0.05, lp: 5500 });
  },
  blub(V, out, t, { p }) {
    tone(V, out, { t, f: 210 * p, f2: 400 * p, glide: 0.08, a: 0.012, d: 0.1, peak: 0.45 });
    tone(V, out, { t, f: 420 * p, f2: 800 * p, glide: 0.08, type: 'triangle', a: 0.012, d: 0.06, peak: 0.08 });
    nz(V, out, { t: t + 0.08, color: 'pink', f: 1100 * p, q: 2, a: 0.001, d: 0.025, peak: 0.18 });
  },
  tok(V, out, t, { p }) {
    click(V, out, t, 0.25, 1500 * p, 0.01, 3);
    tone(V, out, { t, f: 420 * p, f2: 380 * p, glide: 0.04, type: 'triangle', a: 0.001, d: 0.05, peak: 0.35 });
    tone(V, out, { t, f: 720 * p, a: 0.001, d: 0.16, peak: 0.08 });
    tone(V, out, { t, f: 1130 * p, a: 0.001, d: 0.1, peak: 0.05 });
  },

  // ---------- serve / eat
  rice(V, out, t, { p }) {
    nz(V, out, { t, color: 'pink', ft: 'lowpass', f: 850 * p, q: 0.7, a: 0.01, d: 0.09, peak: 0.55 });
    tone(V, out, { t, f: 270 * p, f2: 180 * p, glide: 0.06, type: 'triangle', a: 0.006, d: 0.07, peak: 0.25 });
    for (let k = 0; k < 3; k++) nz(V, out, { t: t + 0.03 + k * rnd(0.025, 0.04), color: 'white', f: rnd(1400, 2000) * p, q: 2, a: 0.002, d: 0.02, peak: 0.05 });
  },
  pour(V, out, t, { p }) {
    const r = nz(V, out, { t, color: 'pink', ft: 'lowpass', f: 650 * p, q: 0.9, a: 0.12, d: 0.75, peak: 0.42 });
    r.g.gain.cancelScheduledValues(t);
    r.g.gain.setValueAtTime(0, t);
    r.g.gain.linearRampToValueAtTime(0.42, t + 0.12);
    r.g.gain.setValueAtTime(0.42, t + 0.6);
    r.g.gain.linearRampToValueAtTime(0, t + 0.9);
    let tt = t + 0.05;
    while (tt < t + 0.8) {
      const f = rnd(200, 320) * p;
      tone(V, out, { t: tt, f, f2: f * 1.4, glide: 0.07, a: 0.015, d: 0.08, peak: rnd(0.15, 0.26) });
      tone(V, out, { t: tt, f: f * 2, f2: f * 2.8, glide: 0.07, type: 'triangle', a: 0.015, d: 0.05, peak: 0.04 });
      tt += rnd(0.09, 0.14);
    }
  },
  spoon(V, out, t, { p }) {
    click(V, out, t, 0.12, 3000 * p, 0.003, 2);
    tone(V, out, { t, f: 1650 * p, a: 0.001, d: 0.18, peak: 0.2 });
    tone(V, out, { t, f: 2870 * p, a: 0.001, d: 0.09, peak: 0.08 });
    tone(V, out, { t, f: 4200 * p, a: 0.001, d: 0.04, peak: 0.025 });
  },
  munch(V, out, t, { p }) {
    const n = Math.random() < 0.5 ? 2 : 3;
    for (let k = 0; k < n; k++) {
      const tt = t + k * 0.27 + rnd(0, 0.03), v = rnd(0.8, 1);
      nz(V, out, { t: tt, color: 'pink', f: 650 * p, q: 1.2, f2: 420 * p, glide: 0.12, a: 0.03, d: 0.11, peak: 0.5 * v });
      tone(V, out, { t: tt, f: 260 * p, f2: 200 * p, glide: 0.1, type: 'triangle', a: 0.03, d: 0.08, peak: 0.14 * v });
      nz(V, out, { t: tt + 0.02, color: 'white', f: 1800 * p, q: 2, a: 0.01, d: 0.05, peak: 0.04 * v });
    }
  },
  yum(V, out, t, { p }) {
    const lp = F(V, 'lowpass', 1600, 0.6); lp.connect(out);
    tone(V, lp, { t, f: pn(5) * p, f2: pn(8) * p, glide: 0.3, type: 'triangle', a: 0.05, d: 0.45, peak: 0.42, vib: 0.02, vibRate: 6.5 });
    tone(V, lp, { t, f: pn(5) * 2 * p, f2: pn(8) * 2 * p, glide: 0.3, a: 0.05, d: 0.3, peak: 0.05 });
    [12, 13, 15].forEach((i, k) => bell(V, out, pn(i) * p, t + 0.32 + k * 0.06, 0.08, 0.3));
  },

  // ---------- end
  hanamaru(V, out, t, { p }) {
    const dur = 1.0;
    const s = noiseSrc(V, t, dur + 0.05, 'white');
    const bp = F(V, 'bandpass', 500, 2.5);
    bp.frequency.setValueAtTime(500 * p, t);
    bp.frequency.exponentialRampToValueAtTime(2100 * p, t + dur);
    const lfo = osc(V, 'sine', 3, t, dur);
    lfo.frequency.linearRampToValueAtTime(7, t + dur);
    const depth = G(V, 150); depth.gain.linearRampToValueAtTime(650 * p, t + dur);
    chain(lfo, depth, bp.frequency);
    const am = G(V, 0.6); const amd = G(V, 0.35); chain(lfo, amd, am.gain);
    const env = G(V, 0);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.5, t + 0.1);
    env.gain.setValueAtTime(0.5, t + dur - 0.15);
    env.gain.linearRampToValueAtTime(0, t + dur);
    chain(s, bp, F(V, 'lowpass', 4000, 0.5), am, env, out);
    const tc = t + dur;
    [5, 10, 12, 13].forEach((i, k) => bell(V, out, pn(i) * p, tc + k * 0.015, k ? 0.14 : 0.1, 0.6));
  },
  confetti(V, out, t, { p }) {
    for (let k = 0; k < 26; k++) {
      const tt = t + Math.pow(Math.random(), 1.4) * 0.8;
      const pnr = panner(V, rnd(-0.7, 0.7));
      let d = out;
      if (pnr) { pnr.connect(out); d = pnr; }
      const f = rnd(1100, 2300) * p;
      tone(V, d, { t: tt, f, f2: f * 1.3, glide: 0.02, a: 0.002, d: rnd(0.025, 0.045), peak: rnd(0.05, 0.12) });
    }
  },
};

// wordless "voice" motifs (Animal-Crossing-like babble), pentatonic pitches
function babble(V, out, t, o, base, speed) {
  const { p } = o, mood = o.mood || 'happy';
  const vow = () => pick(['a', 'e', 'o', 'a', 'i']);
  const f = (i) => pn(base + i) * p;
  let seq;
  if (mood === 'wow') {
    seq = [{ i: -1, d: 0.08, v: 'o' }, { i: 2, d: 0.32, v: 'a', up: 1.08, gap: 0.12 }];
  } else if (mood === 'tired') {
    seq = [{ i: 1, d: 0.16, v: 'a', gap: 0.24 }, { i: 0, d: 0.16, v: 'o', gap: 0.26 }, { i: -1, d: 0.42, v: 'o', up: 0.86, pk: 0.75 }];
  } else if (mood === 'yum') {
    seq = [{ i: 1, d: 0.08, v: 'a' }, { i: 0, d: 0.08, v: 'e' }, { i: 1, d: 0.6, v: 'u', vib: 0.035, gap: 0.12 }];
  } else {
    seq = pick([
      [{ i: 0, d: 0.07 }, { i: 1, d: 0.07 }, { i: 1, d: 0.07 }, { i: 2, d: 0.14, up: 1.04 }],
      [{ i: 0, d: 0.07 }, { i: 2, d: 0.07 }, { i: 1, d: 0.07 }, { i: 2, d: 0.07 }, { i: 3, d: 0.13 }],
      [{ i: 1, d: 0.07 }, { i: 0, d: 0.07 }, { i: 2, d: 0.15, up: 1.05 }],
    ]);
  }
  let tt = t;
  const gapBase = 0.105 / speed;
  for (const s of seq) {
    const fr = f(s.i);
    syllable(V, out, {
      t: tt, f: fr, d: s.d, vowel: s.v || vow(), peak: 0.3 * (s.pk || 1),
      f2: s.up ? fr * s.up : undefined, glide: s.d, vib: s.vib, vibRate: 6,
      startRatio: mood === 'tired' ? 1.0 : 0.93,
    });
    tt += Math.max(s.d + 0.03, s.gap || gapBase);
  }
}

// ---------------------------------------------------------------- loops
// build(L) gets a loop object with L.V (node holder), L.out (destination),
// returns { apply(i, t, glide), events(t0, t1, i) }.
// Event voices are created with L.ev(t, fn).
function tc(g) { return Math.max(0.01, g / 3); } // setTargetAtTime time constant
function setP(param, v, t, glide) { param.cancelScheduledValues(t); param.setTargetAtTime(v, t, tc(glide)); }

function contNoise(V, color, rate = 1) {
  const s = srcNode(V, V.ctx.createBufferSource());
  s.buffer = V.buf[color]; s.loop = true; s.playbackRate.value = rate;
  s.start(V.t0, Math.random() * 1.5); return s;
}
function contOsc(V, type, f) {
  const o = srcNode(V, V.ctx.createOscillator()); o.type = type; o.frequency.value = f; o.start(V.t0); return o;
}
// interval scheduler: returns events(t0,t1,i) that fires fn at random intervals
function poisson(rateFn, fn) {
  let next = -1;
  return (t0, t1, i) => {
    if (next < t0) next = t0 + Math.random() * 0.05;
    let guard = 0;
    while (next < t1 && guard++ < 200) {
      const r = rateFn(i);
      if (r > 0.01) fn(next, i);
      next += r > 0.01 ? -Math.log(1 - Math.random() * 0.999) / r : 0.1;
    }
  };
}

const LOOPS = {
  water(L) {
    const { V } = L;
    const s = contNoise(V, 'pink');
    const bp = F(V, 'bandpass', 600, 0.9);
    const lp = F(V, 'lowpass', 2500, 0.5);
    const g = G(V, 0);
    // slow slosh
    const l1 = contOsc(V, 'sine', 0.55), l1g = G(V, 0.35);
    const slosh = G(V, 0.6); chain(l1, l1g, slosh.gain);
    const l2 = contOsc(V, 'sine', 1.3), l2g = G(V, 180); chain(l2, l2g, bp.frequency);
    chain(s, bp, lp, slosh, g, L.out);
    const ev = poisson((i) => 3 + 10 * i, (t, i) => L.ev(t, (EV, d) => {
      bubbleBlip(EV, d, t, rnd(450, 1100), rnd(0.03, 0.09) * (0.5 + i), rnd(0.03, 0.07));
    }));
    return {
      apply(i, t, gl) { setP(g.gain, 0.42 * Math.sqrt(i), t, gl); setP(bp.frequency, 450 + 700 * i, t, gl); setP(lp.frequency, 1500 + 2000 * i, t, gl); },
      events: ev,
    };
  },
  sizzle(L) {
    const { V } = L;
    const s = contNoise(V, 'white');
    const hp = F(V, 'highpass', 1600, 0.6);
    const pk = F(V, 'peaking', 3000, 0.8); pk.gain.value = 4;
    const lp = F(V, 'lowpass', 4200, 0.6);
    // random amplitude flutter from a slow noise source
    const ms = contNoise(V, 'white', 0.02);
    const mlp = F(V, 'lowpass', 30, 0.5), mg = G(V, 1.4);
    const am = G(V, 0.5); chain(ms, mlp, mg, am.gain);
    const g = G(V, 0);
    chain(s, hp, pk, lp, am, g, L.out);
    // "juuu" body
    const s2 = contNoise(V, 'pink'), b2 = F(V, 'bandpass', 900, 0.8), g2 = G(V, 0);
    chain(s2, b2, g2, L.out);
    const ev = poisson((i) => 6 + 45 * i * i, (t, i) => L.ev(t, (EV, d) => {
      const v = Math.pow(Math.random(), 2);
      click(EV, d, t, (0.06 + 0.32 * v) * (0.5 + 0.6 * i), rnd(1800, 4200), rnd(0.002, 0.006), rnd(1, 3));
    }));
    return {
      apply(i, t, gl) {
        setP(g.gain, 0.22 * i, t, gl); setP(g2.gain, 0.16 * i, t, gl);
        setP(lp.frequency, 3000 + 1800 * i, t, gl); setP(hp.frequency, 1900 - 500 * i, t, gl);
      },
      events: ev,
    };
  },
  pourwater(L) {
    const { V } = L;
    const s = contNoise(V, 'pink');
    const bp = F(V, 'bandpass', 1000, 0.6), lp = F(V, 'lowpass', 3200, 0.5), g = G(V, 0);
    const fl = contNoise(V, 'white', 0.01), flp = F(V, 'lowpass', 12, 0.5), flg = G(V, 0.8), am = G(V, 0.7);
    chain(fl, flp, flg, am.gain);
    chain(s, bp, lp, am, g, L.out);
    const s2 = contNoise(V, 'pink'), b2 = F(V, 'bandpass', 420, 1.5), g2 = G(V, 0);
    chain(s2, b2, g2, L.out);
    const ev = poisson((i) => 4 + 6 * i, (t, i) => L.ev(t, (EV, d) => {
      const f = rnd(240, 480);
      tone(EV, d, { t, f, f2: f * 1.5, glide: 0.06, a: 0.01, d: 0.07, peak: rnd(0.08, 0.16) * (0.4 + i) });
      tone(EV, d, { t, f: f * 2, f2: f * 3, glide: 0.06, type: 'triangle', a: 0.01, d: 0.04, peak: 0.03 * (0.4 + i) });
    }));
    return {
      apply(i, t, gl) { setP(g.gain, 0.4 * i, t, gl); setP(g2.gain, 0.2 * i, t, gl); setP(bp.frequency, 700 + 700 * i, t, gl); },
      events: ev,
    };
  },
  flame(L) {
    const { V } = L;
    const s = contNoise(V, 'pink');
    const bp = F(V, 'bandpass', 1200, 0.5), lp = F(V, 'lowpass', 2500, 0.5), g = G(V, 0);
    const fl = contNoise(V, 'white', 0.008), flp = F(V, 'lowpass', 6, 0.5), flg = G(V, 0.5), am = G(V, 0.8);
    chain(fl, flp, flg, am.gain);
    chain(s, bp, lp, am, g, L.out);
    const s2 = contNoise(V, 'pink'), l2 = F(V, 'bandpass', 320, 0.8), g2 = G(V, 0);
    chain(s2, l2, g2, L.out);
    return {
      apply(i, t, gl) { setP(g.gain, 0.12 * i, t, gl); setP(g2.gain, 0.1 * i, t, gl); setP(lp.frequency, 1500 + 1500 * i, t, gl); },
      events: null,
    };
  },
  simmer(L) {
    const { V } = L;
    const s = contNoise(V, 'pink'), hp = F(V, 'bandpass', 2200, 0.6), g = G(V, 0);
    chain(s, hp, g, L.out);
    let burst = 0;
    const ev = poisson((i) => (3 + 10 * i) * (burst > 0 ? 2.5 : 1), (t, i) => {
      if (burst > 0) burst--; else if (Math.random() < 0.25) burst = (2 + Math.random() * 3) | 0;
      L.ev(t, (EV, d) => {
        const f = rnd(150, 300) * (Math.random() < 0.15 ? 0.6 : 1);
        const v = rnd(0.5, 1) * (0.35 + 0.65 * i);
        tone(EV, d, { t, f, f2: f * rnd(1.4, 1.9), glide: 0.05, type: 'triangle', a: 0.006, d: rnd(0.05, 0.09), peak: 0.32 * v });
        tone(EV, d, { t, f: f * 2, f2: f * 3.2, glide: 0.05, a: 0.004, d: 0.04, peak: 0.1 * v });
        if (Math.random() < 0.4) nz(EV, d, { t: t + 0.05, color: 'pink', f: rnd(900, 1500), q: 2, a: 0.001, d: 0.02, peak: 0.08 * v });
      });
    });
    return { apply(i, t, gl) { setP(g.gain, 0.05 * i, t, gl); }, events: ev };
  },
  thick(L) {
    const { V } = L;
    const s = contNoise(V, 'pink'), bp = F(V, 'bandpass', 260, 1.2), g = G(V, 0);
    chain(s, bp, g, L.out);
    const ev = poisson((i) => 0.6 + 1.4 * i, (t, i) => L.ev(t, (EV, d) => {
      const f = rnd(170, 240), v = rnd(0.7, 1) * (0.4 + 0.6 * i);
      tone(EV, d, { t, f, f2: f * 1.9, glide: 0.13, a: 0.03, d: 0.13, peak: 0.42 * v });
      tone(EV, d, { t, f: f * 2, f2: f * 3.8, glide: 0.13, type: 'triangle', a: 0.03, d: 0.09, peak: 0.1 * v });
      nz(EV, d, { t: t + 0.14, color: 'pink', f: rnd(700, 1000), q: 2.5, a: 0.001, d: 0.03, peak: 0.16 * v });
      if (Math.random() < 0.4) {
        const t2 = t + rnd(0.18, 0.28);
        tone(EV, d, { t: t2, f: f * 1.25, f2: f * 2.2, glide: 0.08, a: 0.02, d: 0.08, peak: 0.2 * v });
      }
    }));
    return { apply(i, t, gl) { setP(g.gain, 0.08 * i, t, gl); }, events: ev };
  },
  stir(L) {
    const { V } = L;
    const s = contNoise(V, 'pink');
    const bp = F(V, 'bandpass', 600, 1.3), g = G(V, 0);
    chain(s, bp, g, L.out);
    const s2 = contNoise(V, 'white'), b2 = F(V, 'bandpass', 1700, 2.5), g2 = G(V, 0);
    chain(s2, b2, F(V, 'lowpass', 3500, 0.5), g2, L.out);
    const ev = poisson((i) => (i > 0.05 ? 1 + 7 * i : 0), (t, i) => L.ev(t, (EV, d) => {
      const f = rnd(260, 520);
      tone(EV, d, { t, f, f2: f * 1.5, glide: 0.05, a: 0.01, d: 0.06, peak: 0.12 * i });
    }));
    return {
      apply(i, t, gl) {
        const e = Math.pow(i, 1.2);
        setP(g.gain, 0.55 * e, t, gl); setP(g2.gain, 0.08 * e, t, gl);
        setP(bp.frequency, 450 + 900 * i, t, gl);
      },
      events: ev,
    };
  },
};

// Build a loop into ctx → dest. Returns internal loop object.
function buildLoop(ctx, dest, name, onEvVoice) {
  const def = LOOPS[name];
  if (!def) return null;
  const fade = ctx.createGain(); fade.gain.value = 0; fade.connect(dest);
  const V = { ctx, buf: buffersFor(ctx), nodes: [fade], srcs: [], t0: ctx.currentTime };
  const evBus = ctx.createGain(); evBus.connect(fade); V.nodes.push(evBus);
  const L = {
    V, out: fade, i: 0, stopped: false,
    ev(t, fn) {
      if (L.stopped) return;
      if (onEvVoice && !onEvVoice()) return;
      const EV = newVoice(ctx, evBus, onEvVoice ? () => onEvVoice(true) : null);
      try { fn(EV, EV.out); } catch (e) { /* ignore */ }
      finishVoice(EV);
    },
  };
  const impl = def(L);
  L.apply = impl.apply; L.events = impl.events; L.fade = fade;
  return L;
}

// ---------------------------------------------------------------- engine state
let ctx = null, master = null, limiter = null, sfxBus = null, bgmBus = null, bgmDuck = null;
let muted = false, unlocking = null;
let activeVoices = 0;
const MAX_VOICES = 24;
const lastPlay = Object.create(null);
const loops = new Map();
let schedTimer = null;
let bgmBuf = null, stirBuf = null, bgmSrc = null, bgmFade = null, bgmWanted = false, loadStarted = false;

const BGM_LEVEL = dB(-14);
const VARY = new Set(['tap', 'pop', 'drop', 'steps', 'thump', 'chop', 'stamp', 'slide', 'scrub', 'bubble', 'splash',
  'plop', 'clink', 'rattle', 'blub', 'tok', 'rice', 'spoon', 'munch', 'clap', 'confetti', 'door']);
// per-sound level trims, from offline peak/RMS measurements
const VOL_TRIM = { whoosh: 4.5, slide: 4, sigh: 3, steam: 2.8, scrub: 3.5, munch: 3, clap: 3.5, confetti: 3,
  splash: 2.2, rattle: 2.2, sparkle: 2.2, tap: 1.8, hanamaru: 1.4, ignite: 2, steps: 1.3, spoon: 1.3, rice: 1.4 };
const LOOP_TRIM = { flame: 1.5, water: 2, sizzle: 2, stir: 2.2, pourwater: 1.3 };

function now() { return ctx ? ctx.currentTime : 0; }

function resume() {
  if (!ctx) return Promise.resolve();
  try {
    if (ctx.state !== 'running' && ctx.state !== 'closed') {
      const p = ctx.resume();
      if (p && p.catch) return p.catch(() => {});
    }
  } catch (e) { /* ignore */ }
  return Promise.resolve();
}

function createContext() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback'; // iOS 17+: play even with ringer switch off
  } catch (e) { /* ignore */ }
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 1;
  limiter = ctx.createDynamicsCompressor();
  try {
    limiter.threshold.value = -6; limiter.knee.value = 6; limiter.ratio.value = 12;
    limiter.attack.value = 0.003; limiter.release.value = 0.15;
  } catch (e) { /* ignore */ }
  sfxBus = ctx.createGain(); sfxBus.gain.value = 1;
  bgmBus = ctx.createGain(); bgmBus.gain.value = BGM_LEVEL;
  bgmDuck = ctx.createGain(); bgmDuck.gain.value = 1;
  bgmDuck.connect(bgmBus); bgmBus.connect(master); sfxBus.connect(master);
  master.connect(limiter); limiter.connect(ctx.destination);
  buffersFor(ctx);
  // iOS unlock: play a 1-sample silent buffer inside the gesture
  try {
    const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
    s.buffer = b; s.connect(ctx.destination); s.start(0);
  } catch (e) { /* ignore */ }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', () => { if (!document.hidden) resume(); });
    window.addEventListener('pagehide', () => { try { ctx.suspend(); } catch (e) { /* ignore */ } });
  }
}
function onVisibility() {
  if (!ctx) return;
  try {
    if (document.hidden) ctx.suspend();
    else resume();
  } catch (e) { /* ignore */ }
}

function decode(ab) {
  return new Promise((res, rej) => {
    try {
      const p = ctx.decodeAudioData(ab, res, rej);
      if (p && p.catch) p.catch(rej);
    } catch (e) { rej(e); }
  });
}
function loadBuffer(rel) {
  let url;
  try { url = new URL(rel, import.meta.url).href; } catch (e) { return Promise.resolve(null); }
  if (typeof fetch !== 'function') return Promise.resolve(null);
  return fetch(url)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('http ' + r.status))))
    .then(decode)
    .catch(() => null);
}
function startLoading() {
  if (loadStarted || !ctx) return;
  loadStarted = true;
  // the music waits until the home scene's pictures are in, the stir sound until the pot scene's,
  // so neither slows down the first screens on a slow connection
  whenSceneReady('home').then(() => loadBuffer('../assets/bgm.mp3')).then((b) => { bgmBuf = b; if (b && bgmWanted && !bgmSrc) startBgmNow(); });
  whenSceneReady('pot').then(() => loadBuffer('../assets/stir-audio.mp3')).then((b) => { stirBuf = b; });
}

function startBgmNow() {
  if (!ctx || !bgmBuf || bgmSrc) return;
  try {
    const t = now();
    bgmFade = ctx.createGain();
    bgmFade.gain.setValueAtTime(0, t);
    bgmFade.gain.linearRampToValueAtTime(1, t + 1.5);
    bgmSrc = ctx.createBufferSource();
    bgmSrc.buffer = bgmBuf; bgmSrc.loop = true;
    bgmSrc.connect(bgmFade); bgmFade.connect(bgmDuck);
    bgmSrc.start(t);
  } catch (e) { bgmSrc = null; }
}

function scheduleTick() {
  if (!ctx) return;
  const t0 = now(), t1 = t0 + 0.2;
  for (const L of loops.values()) {
    if (!L.events || L.stopped) continue;
    const from = Math.max(L.schedTo || t0, t0);
    if (from < t1) { try { L.events(from, t1, L.i); } catch (e) { /* ignore */ } L.schedTo = t1; }
  }
  if (!loops.size && schedTimer) { clearInterval(schedTimer); schedTimer = null; }
}

const DUMMY_LOOP = { set() {}, stop() {} };
const DUMMY_PLAY = { stop() {} };

function voiceSlot(release) {
  if (release) { activeVoices = Math.max(0, activeVoices - 1); return true; }
  if (activeVoices >= MAX_VOICES) return false;
  activeVoices++; return true;
}

// ---------------------------------------------------------------- public API
export const audio = {
  get ready() { return !!ctx && ctx.state === 'running'; },

  unlock() {
    if (!AC) return Promise.resolve(false);
    try {
      if (!ctx) createContext();
      startLoading();
      if (!unlocking || ctx.state !== 'running') {
        unlocking = resume().then(() => ctx.state === 'running');
      }
      return unlocking;
    } catch (e) {
      return Promise.resolve(false);
    }
  },

  sfx(name, opts) {
    try {
      if (!ctx || !SFX[name]) return;
      const o = opts || {};
      const t = now() + 0.005 + Math.max(0, +o.delay || 0);
      const last = lastPlay[name];
      if (last !== undefined && Math.abs(t - last) < 0.035) return;
      if (!voiceSlot()) return;
      lastPlay[name] = t;
      let p = +o.pitch > 0 ? +o.pitch : 1;
      let vol = o.vol === undefined ? 1 : Math.max(0, +o.vol || 0);
      if (VARY.has(name)) { p *= 1 + rnd(-0.045, 0.045); vol *= dB(rnd(-1, 1)); }
      if (VOL_TRIM[name]) vol *= VOL_TRIM[name];
      const V = newVoice(ctx, sfxBus, () => voiceSlot(true));
      V.out.gain.value = vol;
      const pnr = panner(V, +o.pan || 0);
      if (pnr) { V.out.disconnect(); V.out.connect(pnr); pnr.connect(sfxBus); }
      try { SFX[name](V, V.out, t, Object.assign({}, o, { p })); } catch (e) { /* ignore */ }
      finishVoice(V);
    } catch (e) { /* never throw */ }
  },

  loop(name, opts) {
    try {
      if (!ctx || !LOOPS[name]) return DUMMY_LOOP;
      const ex = loops.get(name);
      if (ex && !ex.stopped) return ex.handle;
      const o = opts || {};
      const L = buildLoop(ctx, sfxBus, name, voiceSlot);
      const vol = (o.vol === undefined ? 1 : Math.max(0, +o.vol || 0)) * (LOOP_TRIM[name] || 1);
      const t = now();
      L.i = clamp(o.intensity === undefined ? (name === 'stir' ? 0 : 0.7) : +o.intensity || 0, 0, 1);
      L.apply(L.i, t, 0.05);
      L.fade.gain.setValueAtTime(0, t);
      L.fade.gain.linearRampToValueAtTime(vol, t + 0.3);
      L.handle = {
        set(intensity, glideSec) {
          try {
            if (L.stopped) return;
            const i = clamp(+intensity || 0, 0, 1);
            L.i = i;
            L.apply(i, now(), glideSec === undefined ? 0.1 : Math.max(0.005, +glideSec || 0));
          } catch (e) { /* ignore */ }
        },
        stop(fadeSec) {
          try {
            if (L.stopped) return;
            L.stopped = true;
            if (loops.get(name) === L) loops.delete(name);
            const f = fadeSec === undefined ? 0.25 : Math.max(0.01, +fadeSec || 0);
            const tt = now();
            L.fade.gain.cancelScheduledValues(tt);
            L.fade.gain.setValueAtTime(L.fade.gain.value, tt);
            L.fade.gain.linearRampToValueAtTime(0, tt + f);
            for (const s of L.V.srcs) { try { s.stop(tt + f + 0.05); } catch (e) { /* ignore */ } }
            const srcs = L.V.srcs; let live = srcs.length;
            const done = () => { for (const n of L.V.nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } } };
            if (!live) done();
            for (const s of srcs) s.onended = () => { if (--live <= 0) done(); };
          } catch (e) { /* ignore */ }
        },
      };
      loops.set(name, L);
      if (!schedTimer) schedTimer = setInterval(scheduleTick, 50);
      scheduleTick();
      return L.handle;
    } catch (e) {
      return DUMMY_LOOP;
    }
  },

  stopAllLoops(fadeSec) {
    try { for (const L of Array.from(loops.values())) L.handle.stop(fadeSec); } catch (e) { /* ignore */ }
  },

  bgm: {
    start() {
      try {
        bgmWanted = true;
        if (!ctx) return;
        if (bgmSrc) return;
        if (bgmBuf) startBgmNow();
      } catch (e) { /* ignore */ }
    },
    duck(level, sec) {
      try {
        if (!ctx) return;
        const t = now(), s = sec === undefined ? 0.3 : Math.max(0.01, +sec || 0);
        const v = clamp(level === undefined ? 1 : +level, 0, 1);
        bgmDuck.gain.cancelScheduledValues(t);
        bgmDuck.gain.setValueAtTime(bgmDuck.gain.value, t);
        bgmDuck.gain.linearRampToValueAtTime(v, t + s);
      } catch (e) { /* ignore */ }
    },
    stop(sec) {
      try {
        bgmWanted = false;
        if (!ctx || !bgmSrc) return;
        const t = now(), s = sec === undefined ? 1 : Math.max(0.01, +sec || 0);
        const src = bgmSrc, fade = bgmFade;
        bgmSrc = null; bgmFade = null;
        fade.gain.cancelScheduledValues(t);
        fade.gain.setValueAtTime(fade.gain.value, t);
        fade.gain.linearRampToValueAtTime(0, t + s);
        src.onended = () => { try { src.disconnect(); fade.disconnect(); } catch (e) { /* ignore */ } };
        src.stop(t + s + 0.05);
      } catch (e) { /* ignore */ }
    },
  },

  playStir() {
    try {
      if (!ctx || !stirBuf) return DUMMY_PLAY;
      const t = now();
      const s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = stirBuf; g.gain.value = 0.9;
      s.connect(g); g.connect(sfxBus);
      s.onended = () => { try { s.disconnect(); g.disconnect(); } catch (e) { /* ignore */ } };
      s.start(t);
      let stopped = false;
      return {
        stop(fadeSec) {
          try {
            if (stopped) return; stopped = true;
            const tt = now(), f = fadeSec === undefined ? 0.1 : Math.max(0.01, +fadeSec || 0);
            g.gain.cancelScheduledValues(tt);
            g.gain.setValueAtTime(g.gain.value, tt);
            g.gain.linearRampToValueAtTime(0, tt + f);
            s.stop(tt + f + 0.02);
          } catch (e) { /* ignore */ }
        },
      };
    } catch (e) {
      return DUMMY_PLAY;
    }
  },

  setMuted(m) {
    try {
      muted = !!m;
      if (!ctx) return;
      const t = now();
      master.gain.cancelScheduledValues(t);
      master.gain.setTargetAtTime(muted ? 0 : 1, t, 0.03);
    } catch (e) { /* ignore */ }
  },

  ctxTime() { try { return ctx ? ctx.currentTime : 0; } catch (e) { return 0; } },
};

// Development hooks (used by the offline measurement harness; harmless in the game).
export const _dev = {
  SFX_NAMES: Object.keys(SFX),
  LOOP_NAMES: Object.keys(LOOPS),
  renderSfx(c, name, opts) {
    const V = newVoice(c, c.destination, null);
    V.out.gain.value = VOL_TRIM[name] || 1;
    const o = Object.assign({}, opts || {}, { p: (opts && opts.pitch) || 1 });
    SFX[name](V, V.out, 0.01, o);
    finishVoice(V);
  },
  renderLoop(c, name, intensity, dur) {
    const L = buildLoop(c, c.destination, name, null);
    L.fade.gain.value = LOOP_TRIM[name] || 1;
    L.apply(intensity, 0, 0.005);
    if (L.events) L.events(0, dur, intensity);
  },
};
