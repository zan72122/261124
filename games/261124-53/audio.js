// すべての音は WebAudio で合成（声・言葉は使わない）
let ctx = null, master = null, bgmGain = null, bgmTimer = null, noiseBuf = null;

export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.8;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);
      bgmGain = ctx.createGain(); bgmGain.gain.value = 0.16; bgmGain.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state !== 'running') ctx.resume();
    // iOS 用：無音を一度鳴らす
    const b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, 22050); b.connect(master); b.start();
  } catch (e) { /* 音が出なくても遊べる */ }
}

const now = () => ctx.currentTime;
function ok() { return ctx && ctx.state === 'running'; }

function env(g, t, a, peak, d, sustain = 0) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t + a + d);
}

function tone({ type = 'sine', f = 440, f2 = null, t = 0, a = 0.01, d = 0.3, vol = 0.3, vib = 0, vibF = 6, filter = null, q = 1, out = master }) {
  if (!ok()) return;
  const t0 = now() + t;
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + a + d);
  const g = ctx.createGain();
  let node = o;
  if (vib) {
    const l = ctx.createOscillator(); l.frequency.value = vibF;
    const lg = ctx.createGain(); lg.gain.value = vib;
    l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + a + d + 0.1);
  }
  if (filter) {
    const bq = ctx.createBiquadFilter(); bq.type = filter.type || 'lowpass';
    bq.frequency.setValueAtTime(filter.f, t0);
    if (filter.f2) bq.frequency.exponentialRampToValueAtTime(filter.f2, t0 + a + d);
    bq.Q.value = q; node.connect(bq); node = bq;
  }
  node.connect(g); g.connect(out);
  env(g, t0, a, vol, d);
  o.start(t0); o.stop(t0 + a + d + 0.05);
}

function noise({ t = 0, a = 0.01, d = 0.2, vol = 0.2, type = 'bandpass', f = 1000, f2 = null, q = 1 }) {
  if (!ok()) return;
  const t0 = now() + t;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  s.playbackRate.value = 1;
  const bq = ctx.createBiquadFilter(); bq.type = type; bq.Q.value = q;
  bq.frequency.setValueAtTime(f, t0);
  if (f2) bq.frequency.exponentialRampToValueAtTime(f2, t0 + a + d);
  const g = ctx.createGain();
  s.connect(bq); bq.connect(g); g.connect(master);
  env(g, t0, a, vol, d);
  s.start(t0, Math.random()); s.stop(t0 + a + d + 0.05);
}

const SFX = {
  tap() { tone({ f: 900, f2: 1300, d: 0.08, vol: 0.12 }); },
  sparkle() {
    [1568, 2093, 2637, 3136].forEach((f, i) => tone({ f, t: i * 0.05, d: 0.35, vol: 0.09 }));
  },
  grow() {
    noise({ f: 300, f2: 3000, d: 0.9, vol: 0.12, q: 2 });
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f, t: 0.15 + i * 0.09, d: 0.6, vol: 0.12 }));
    tone({ f: 200, f2: 600, d: 0.8, vol: 0.12 });
  },
  pop() { tone({ f: 700, f2: 180, d: 0.12, vol: 0.25 }); },
  boing() { tone({ type: 'triangle', f: 180, f2: 520, d: 0.3, vol: 0.25, vib: 40, vibF: 18 }); },
  hat() { tone({ type: 'triangle', f: 600, f2: 1200, d: 0.15, vol: 0.2 }); SFX.sparkle(); },
  roar() { // やさしい「がおー」
    tone({ type: 'sawtooth', f: 160, f2: 110, a: 0.12, d: 0.9, vol: 0.22, filter: { f: 900, f2: 400 }, vib: 6, vibF: 9 });
    tone({ type: 'sawtooth', f: 240, f2: 170, a: 0.12, d: 0.8, vol: 0.08, filter: { f: 1200, f2: 500 } });
    noise({ f: 500, d: 0.9, vol: 0.06, q: 0.7, a: 0.1 });
  },
  whinny() { // シマウマ
    tone({ type: 'sawtooth', f: 700, f2: 1100, a: 0.05, d: 0.25, vol: 0.12, vib: 90, vibF: 22, filter: { f: 2500 } });
    tone({ type: 'sawtooth', f: 1000, f2: 500, t: 0.28, a: 0.03, d: 0.5, vol: 0.12, vib: 120, vibF: 24, filter: { f: 2400 } });
  },
  purr() { // トラ
    for (let i = 0; i < 6; i++) noise({ t: i * 0.11, a: 0.02, d: 0.08, vol: 0.12, type: 'lowpass', f: 300 });
    tone({ type: 'sawtooth', f: 90, t: 0, a: 0.05, d: 0.7, vol: 0.08, filter: { f: 300 } });
  },
  yawn() { tone({ type: 'sawtooth', f: 300, f2: 150, a: 0.3, d: 0.8, vol: 0.1, filter: { f: 900, f2: 300 } }); },
  honk() { // トリケラトプス
    tone({ type: 'sawtooth', f: 110, f2: 140, a: 0.05, d: 0.35, vol: 0.2, filter: { f: 700 } });
    tone({ type: 'sawtooth', f: 140, f2: 100, t: 0.4, a: 0.05, d: 0.45, vol: 0.2, filter: { f: 700 } });
  },
  rumble() { // ティラノ（おどけた声）
    tone({ type: 'sawtooth', f: 70, f2: 95, a: 0.15, d: 0.7, vol: 0.28, filter: { f: 500 }, vib: 5, vibF: 7 });
    tone({ type: 'triangle', f: 280, f2: 520, t: 0.7, a: 0.05, d: 0.3, vol: 0.12 });
  },
  squawk() { // 翼竜
    [0, 0.18].forEach((t) => tone({ type: 'square', f: 1300, f2: 800, t, a: 0.02, d: 0.14, vol: 0.06, filter: { f: 3000 } }));
  },
  flap() { noise({ f: 400, d: 0.12, vol: 0.12, type: 'lowpass' }); },
  hmm() { // 「あれ？」
    tone({ type: 'triangle', f: 330, f2: 300, a: 0.05, d: 0.25, vol: 0.2 });
    tone({ type: 'triangle', f: 330, f2: 620, t: 0.32, a: 0.03, d: 0.3, vol: 0.2 });
  },
  happy() { [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f, t: i * 0.08, d: 0.35, vol: 0.15 })); },
  fanfare() {
    const n = [523, 523, 659, 784, 659, 784, 1047];
    const ts = [0, 0.12, 0.24, 0.36, 0.6, 0.72, 0.9];
    n.forEach((f, i) => { tone({ type: 'square', f, t: ts[i], d: i === 6 ? 0.7 : 0.14, vol: 0.07, filter: { f: 3000 } }); tone({ type: 'triangle', f: f / 2, t: ts[i], d: 0.2, vol: 0.1 }); });
  },
  thud() { tone({ f: 120, f2: 40, d: 0.3, vol: 0.5 }); noise({ f: 200, d: 0.2, vol: 0.2, type: 'lowpass' }); },
  stomp() { tone({ f: 70, f2: 35, d: 0.25, vol: 0.35 }); },
  step() { tone({ f: 160, f2: 90, d: 0.06, vol: 0.08 }); },
  swish() { noise({ f: 800, f2: 3000, d: 0.3, vol: 0.12, q: 0.8 }); },
  rustle() { for (let i = 0; i < 4; i++) noise({ t: i * 0.07, f: 3000, d: 0.06, vol: 0.06 }); },
  munch() { for (let i = 0; i < 4; i++) noise({ t: i * 0.13, a: 0.005, d: 0.07, vol: 0.18, f: 1800, q: 2 }); },
  chop() { noise({ f: 2500, d: 0.05, vol: 0.25, q: 3 }); tone({ f: 300, f2: 120, d: 0.08, vol: 0.2 }); },
  seed() { tone({ f: 1200, f2: 600, d: 0.06, vol: 0.12 }); },
  count(i) { tone({ type: 'triangle', f: [392, 440, 494, 523, 587][i % 5], d: 0.25, vol: 0.18 }); },
  giggle() { [0, 0.11, 0.22].forEach((t, i) => tone({ f: 900 - i * 60, f2: 1100 - i * 60, t, a: 0.01, d: 0.08, vol: 0.12, vib: 30, vibF: 30 })); },
  laughLow() { [0, 0.14, 0.28].forEach((t, i) => tone({ type: 'triangle', f: 260 - i * 15, f2: 300 - i * 15, t, a: 0.01, d: 0.1, vol: 0.18 })); },
  oops() { tone({ type: 'triangle', f: 600, f2: 200, a: 0.02, d: 0.5, vol: 0.2 }); },
  roll() { for (let i = 0; i < 8; i++) tone({ f: 90 + Math.random() * 30, t: i * 0.09, d: 0.06, vol: 0.12 }); },
  door() { tone({ type: 'triangle', f: 300, f2: 450, d: 0.3, vol: 0.12 }); noise({ f: 1500, d: 0.3, vol: 0.06 }); },
};

export function sfx(name, ...args) { try { SFX[name] && SFX[name](...args); } catch (e) { } }

// やさしいBGM（ウクレレ風の分散和音）
const SONGS = {
  home: { bpm: 104, chords: [[262, 330, 392], [220, 262, 330], [175, 220, 262], [196, 247, 294]] },
  seek: { bpm: 96, chords: [[220, 262, 330], [196, 247, 294], [175, 220, 262], [165, 208, 247]] },
  garden: { bpm: 116, chords: [[294, 370, 440], [247, 294, 370], [196, 247, 294], [220, 277, 330]] },
};
export function playBgm(name) {
  if (!ctx) return;
  stopBgm();
  const s = SONGS[name]; if (!s) return;
  const beat = 60 / s.bpm / 2;
  let step = 0, next = ctx.currentTime + 0.1;
  const pat = [0, 1, 2, 1, 0, 2, 1, 2];
  bgmTimer = setInterval(() => {
    if (!ok()) return;
    while (next < ctx.currentTime + 0.3) {
      const ch = s.chords[Math.floor(step / 8) % s.chords.length];
      const f = ch[pat[step % 8]] * (step % 8 === 0 ? 1 : 2);
      const t = next - ctx.currentTime;
      tone({ type: 'triangle', f, t, a: 0.005, d: 0.35, vol: 0.5, out: bgmGain });
      if (step % 8 === 0) tone({ type: 'sine', f: ch[0] / 2, t, a: 0.01, d: 0.8, vol: 0.6, out: bgmGain });
      step++; next += beat;
    }
  }, 100);
}
export function stopBgm() { if (bgmTimer) clearInterval(bgmTimer); bgmTimer = null; }
