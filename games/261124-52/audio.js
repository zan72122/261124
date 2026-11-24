// すべて WebAudio で合成する効果音と小さなBGM（外部音声ファイルなし）
let ctx = null, master = null, musicGain = null, noiseBuf = null;
let engine = null, xrayHum = null;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startMusic();
  }
  if (ctx.state === 'suspended') ctx.resume();
}
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend(); else ctx.resume();
});

const T = () => ctx.currentTime;
function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(freq, dur, { type = 'sine', vol = 0.3, at = 0, slide = 0, attack = 0.01, out = master } = {}) {
  if (!ctx) return;
  const t = T() + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  env(g, t, attack, vol, dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + attack + dur + 0.05);
}
function noise(dur, { vol = 0.3, at = 0, type = 'bandpass', f = 1200, f2 = 0, q = 1, attack = 0.005 } = {}) {
  if (!ctx) return;
  const t = T() + at, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  env(g, t, attack, vol, dur);
  s.connect(fl); fl.connect(g); g.connect(master);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.1);
}

export const sfx = {
  pop() { tone(500, 0.12, { slide: 2.2, vol: 0.35 }); },
  pick() { tone(660, 0.08, { type: 'triangle', vol: 0.25 }); tone(990, 0.1, { type: 'triangle', vol: 0.2, at: 0.06 }); },
  boing() { tone(220, 0.35, { type: 'sine', slide: 1.8, vol: 0.35 }); tone(330, 0.3, { type: 'sine', slide: 0.6, vol: 0.2, at: 0.12 }); },
  snap() { noise(0.06, { f: 2500, vol: 0.4 }); tone(180, 0.1, { type: 'triangle', vol: 0.4 }); },
  tape() { // ビビーッ（テープを伸ばす音）
    for (let i = 0; i < 9; i++) noise(0.05, { f: 900 + i * 180, q: 3, vol: 0.28, at: i * 0.04 });
    noise(0.1, { f: 3500, vol: 0.2, at: 0.38 });
  },
  stamp() { tone(140, 0.12, { type: 'sine', slide: 0.5, vol: 0.6 }); noise(0.05, { f: 1800, vol: 0.35 }); },
  ding() { tone(1046, 0.35, { vol: 0.25 }); tone(1318, 0.5, { vol: 0.25, at: 0.16 }); },
  buzzer() { tone(110, 0.8, { type: 'square', vol: 0.18 }); tone(116, 0.8, { type: 'sawtooth', vol: 0.12 }); },
  thud() { tone(90, 0.3, { slide: 0.5, vol: 0.6 }); noise(0.2, { type: 'lowpass', f: 400, vol: 0.5 }); },
  slip() { tone(300, 0.4, { type: 'sine', slide: 3, vol: 0.25 }); },
  whoosh() { noise(0.7, { f: 300, f2: 2500, q: 0.7, vol: 0.35, attack: 0.15 }); },
  swoop() { noise(0.5, { f: 2500, f2: 300, q: 0.7, vol: 0.3, attack: 0.1 }); },
  beep(i = 0) { tone([880, 988, 1175, 1318][i % 4], 0.12, { type: 'square', vol: 0.1 }); },
  horn() { tone(392, 0.4, { type: 'triangle', vol: 0.35 }); tone(494, 0.4, { type: 'triangle', vol: 0.25 }); },
  slurp() { for (let i = 0; i < 4; i++) noise(0.07, { f: 700 + i * 120, q: 6, vol: 0.25, at: i * 0.09 }); },
  squeak() { tone(1200, 0.12, { type: 'sine', slide: 1.5, vol: 0.2 }); },
  wiggle() { tone(700, 0.08, { vol: 0.2 }); tone(900, 0.08, { vol: 0.2, at: 0.08 }); },
  sparkle() { [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, 0.25, { vol: 0.12, at: i * 0.06 })); },
  cheer() { for (let i = 0; i < 10; i++) tone(700 + Math.random() * 900, 0.15, { type: 'triangle', vol: 0.08, at: Math.random() * 0.5, slide: 1.3 }); },
  yay() { tone(523, 0.12, { type: 'triangle', vol: 0.25 }); tone(784, 0.3, { type: 'triangle', vol: 0.25, at: 0.1, slide: 1.1 }); },
  oops() { tone(600, 0.15, { vol: 0.22, slide: 0.8 }); tone(700, 0.25, { vol: 0.22, at: 0.2, slide: 1.25 }); },
  fanfare() { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, i === 5 ? 0.6 : 0.14, { type: 'triangle', vol: 0.25, at: i * 0.13 })); },
  splash() { noise(0.5, { f: 1500, f2: 400, q: 0.6, vol: 0.4 }); },
  balloon() { noise(0.08, { f: 3000, vol: 0.5 }); tone(900, 0.1, { slide: 0.4, vol: 0.2 }); },
  thump() { tone(70, 0.25, { slide: 0.6, vol: 0.5 }); },
  zip() { tone(400, 0.25, { type: 'triangle', slide: 3, vol: 0.18 }); },
};

export function setEngine(level) { // 0=停止, 1=アイドル, 2=全開
  if (!ctx) return;
  if (!engine) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(master); o.start(); o2.start();
    engine = { o, o2, f, g };
  }
  const t = T();
  engine.o.frequency.setTargetAtTime(level === 0 ? 40 : 45 + level * 30, t, 0.4);
  engine.o2.frequency.setTargetAtTime(level === 0 ? 20 : 22 + level * 15.3, t, 0.4);
  engine.f.frequency.setTargetAtTime(300 + level * 350, t, 0.4);
  engine.g.gain.setTargetAtTime(level === 0 ? 0 : 0.035 + level * 0.025, t, 0.3);
}
export function setXray(on) {
  if (!ctx) return;
  if (!xrayHum) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 180; o.type = 'sine'; g.gain.value = 0;
    o.connect(g); g.connect(master); o.start(); xrayHum = g;
  }
  xrayHum.gain.setTargetAtTime(on ? 0.05 : 0, T(), 0.1);
}

// ゆったりしたペンタトニックのBGM
let musicMood = 0;
export function setMusic(mood) { musicMood = mood; }
function startMusic() {
  const scale = [0, 2, 4, 7, 9, 12, 14, 16];
  const base = [261.6, 293.7, 349.2, 392];
  let step = 0, next = T() + 0.3;
  const tick = () => {
    if (!ctx) return;
    while (next < T() + 0.5) {
      const bar = Math.floor(step / 8) % 4, root = base[[0, 2, 3, 1][bar]];
      const tempo = musicMood === 2 ? 0.2 : 0.26;
      if (step % 8 === 0) bell(root / 2, next, 0.5, 0.9);
      if (step % 8 === 4) bell(root / 2 * 1.5, next, 0.35, 0.6);
      if (Math.random() < 0.55) {
        const n = scale[Math.floor(Math.random() * scale.length)];
        bell(261.6 * Math.pow(2, n / 12), next, 0.28, 0.35);
      }
      step++; next += tempo;
    }
    setTimeout(tick, 150);
  };
  tick();
}
function bell(f, t, vol, dur) {
  const o = ctx.createOscillator(), g = ctx.createGain(), o2 = ctx.createOscillator(), g2 = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(vol * 0.3, t + 0.01); g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.5);
  o.connect(g); o2.connect(g2); g.connect(musicGain); g2.connect(musicGain);
  o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}
