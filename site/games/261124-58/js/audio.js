// All sounds are synthesized (no files, no voices with words).
let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
const last = {};

export function initAudio() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch (e) { /* ignore */ }
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.16; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startMusic();
  }
  if (ctx.state !== 'running') ctx.resume();
}

function throttle(name, gap) {
  if (!ctx) return false;
  const t = ctx.currentTime;
  if (last[name] && t - last[name] < gap) return false;
  last[name] = t;
  return true;
}

function tone({ f = 440, f2 = null, dur = 0.2, type = 'sine', vol = 0.3, at = 0, attack = 0.005, bus = null, q = null }) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  if (q) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = q; g.connect(fl); fl.connect(bus || sfxBus); }
  else g.connect(bus || sfxBus);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise({ dur = 0.2, f = 1000, f2 = null, type = 'bandpass', q = 1, vol = 0.3, at = 0, attack = 0.005 }) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf; s.loop = true;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q;
  fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(sfxBus);
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
}

// A little vocal-ish blip (vowel formant) for giggles and "huh?"
function voice(f, f2, dur, vol = 0.18, at = 0, vowel = 'a') {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const forms = vowel === 'a' ? [850, 1300] : vowel === 'e' ? [500, 2000] : vowel === 'o' ? [500, 900] : [320, 2400];
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  forms.forEach((ff, i) => {
    const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = ff; b.Q.value = 6;
    const bg = ctx.createGain(); bg.gain.value = i ? 0.6 : 1;
    o.connect(b); b.connect(bg); bg.connect(g);
  });
  g.connect(sfxBus);
  o.start(t); o.stop(t + dur + 0.05);
}

export const sfx = {
  tap() { tone({ f: 880, f2: 1320, dur: 0.08, type: 'triangle', vol: 0.12 }); },
  pick() { tone({ f: 520, f2: 900, dur: 0.12, type: 'sine', vol: 0.2 }); },
  drop() { tone({ f: 700, f2: 300, dur: 0.15, type: 'sine', vol: 0.2 }); noise({ dur: 0.08, f: 600, vol: 0.1 }); },
  pop() { if (!throttle('pop', 0.03)) return; tone({ f: 900, f2: 140, dur: 0.09, vol: 0.3 }); noise({ dur: 0.06, f: 3000, type: 'highpass', vol: 0.15 }); },
  boing() { if (!throttle('boing', 0.12)) return; tone({ f: 180, f2: 420, dur: 0.18, vol: 0.25 }); tone({ f: 420, f2: 200, dur: 0.25, at: 0.12, vol: 0.18 }); },
  squish() { if (!throttle('squish', 0.09)) return; noise({ dur: 0.18, f: 400, f2: 1200, q: 4, vol: 0.22 }); tone({ f: 120, f2: 200, dur: 0.15, vol: 0.15 }); },
  gloop() { tone({ f: 300, f2: 80, dur: 0.35, vol: 0.3 }); noise({ dur: 0.3, f: 300, f2: 120, q: 3, vol: 0.3 }); },
  stretch() { if (!throttle('stretch', 0.2)) return; tone({ f: 200, f2: 520, dur: 0.3, type: 'triangle', vol: 0.1 }); },
  clack(p = 1) {
    if (!throttle('clack', 0.035)) return;
    tone({ f: 700 * p, f2: 500 * p, dur: 0.07, type: 'triangle', vol: 0.22 });
    noise({ dur: 0.05, f: 2200 * p, q: 3, vol: 0.18 });
  },
  crash() { for (let i = 0; i < 7; i++) { tone({ f: 500 + Math.random() * 500, f2: 300, dur: 0.07, type: 'triangle', vol: 0.18, at: i * 0.06 + Math.random() * 0.03 }); } noise({ dur: 0.5, f: 1500, f2: 400, q: 1, vol: 0.2 }); },
  chime() { [0, 4, 7, 12].forEach((s, i) => tone({ f: 660 * Math.pow(2, s / 12), dur: 0.5, type: 'sine', vol: 0.18, at: i * 0.09 })); },
  fanfare() {
    [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => { tone({ f: 523 * Math.pow(2, s / 12), dur: 0.35, type: 'triangle', vol: 0.18, at: i * 0.12 }); tone({ f: 1046 * Math.pow(2, s / 12), dur: 0.3, vol: 0.06, at: i * 0.12 }); });
  },
  sparkle() { for (let i = 0; i < 5; i++) tone({ f: 1500 + Math.random() * 1500, dur: 0.15, vol: 0.07, at: i * 0.05 }); },
  whoosh() { noise({ dur: 0.6, f: 300, f2: 3000, q: 1.5, vol: 0.25, attack: 0.2 }); },
  step() { if (!throttle('step', 0.12)) return; noise({ dur: 0.05, f: 500, q: 2, vol: 0.06 }); },
  giggle(p = 1) {
    if (!throttle('giggle' + p, 0.4)) return;
    for (let i = 0; i < 4; i++) voice(520 * p + i * 10, 440 * p, 0.1, 0.13, i * 0.12, 'e');
  },
  laughAll() { [1, 1.15, 0.9, 1.3].forEach((p, j) => { for (let i = 0; i < 4; i++) voice(480 * p, 400 * p, 0.1, 0.09, j * 0.05 + i * 0.13, i % 2 ? 'a' : 'e'); }); },
  huh() { voice(300, 520, 0.35, 0.16, 0, 'a'); },
  ooh(p = 1) { voice(380 * p, 300 * p, 0.45, 0.13, 0, 'o'); },
  yay() { [1, 1.2, 0.85, 1.35].forEach((p, j) => voice(500 * p, 760 * p, 0.45, 0.09, j * 0.03, 'a')); },
  wow() { [1, 1.25, 0.9].forEach((p, j) => voice(320 * p, 620 * p, 0.6, 0.09, j * 0.04, 'o')); },
  peek() { voice(400, 900, 0.18, 0.15, 0, 'a'); },
  clink() { [2637, 3520, 4186].forEach((f, i) => tone({ f, dur: 0.6 - i * 0.1, vol: 0.09, at: i * 0.01 })); },
  splash() { noise({ dur: 0.45, f: 1800, f2: 400, q: 0.8, vol: 0.35 }); tone({ f: 400, f2: 120, dur: 0.2, vol: 0.15 }); },
  plop() { tone({ f: 260, f2: 900, dur: 0.12, vol: 0.25 }); noise({ dur: 0.2, f: 1200, q: 2, vol: 0.12, at: 0.05 }); },
  pour(d = 1) { noise({ dur: d, f: 900, f2: 1600, q: 1.2, vol: 0.14, attack: 0.1 }); },
  swish() { if (!throttle('swish', 0.18)) return; noise({ dur: 0.22, f: 700, f2: 1400, q: 2, vol: 0.12 }); },
  wipe() { if (!throttle('wipe', 0.15)) return; noise({ dur: 0.18, f: 2500, f2: 1200, q: 1, vol: 0.12 }); },
  gulp() { tone({ f: 180, f2: 90, dur: 0.12, vol: 0.25 }); tone({ f: 200, f2: 100, dur: 0.12, vol: 0.25, at: 0.22 }); voice(300, 260, 0.4, 0.1, 0.5, 'a'); },
  door() { tone({ f: 200, f2: 160, dur: 0.3, type: 'triangle', vol: 0.1 }); },
  magic() { for (let i = 0; i < 10; i++) tone({ f: 600 * Math.pow(2, i / 7), dur: 0.25, vol: 0.07, at: i * 0.05, type: 'triangle' }); },
  balloonRain() { for (let i = 0; i < 14; i++) tone({ f: 300 + Math.random() * 300, f2: 500, dur: 0.12, vol: 0.06, at: i * 0.09 }); },
  bonk() { tone({ f: 260, f2: 160, dur: 0.15, type: 'square', vol: 0.06, q: 900 }); },
};

// ---------------- music: gentle marimba-ish loop ----------------
let musicMood = 0;
export function setMood(m) { musicMood = m; }
function startMusic() {
  const bpm = 104, beat = 60 / bpm;
  const prog = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7], [9, 12, 16], [5, 9, 12], [2, 5, 9], [7, 11, 14]];
  const scale = [0, 2, 4, 7, 9, 12, 14, 16];
  const root = 261.6;
  let next = ctx.currentTime + 0.2, step = 0;
  const mel = [];
  for (let i = 0; i < 64; i++) mel.push(Math.random() < 0.55 ? scale[(Math.random() * scale.length) | 0] : null);
  function pluck(f, t, vol, dur = 0.35) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 4;
    const g = ctx.createGain(); const g2 = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(vol * 0.25, t + 0.003); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g); o2.connect(g2); g.connect(musicBus); g2.connect(musicBus);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + 0.1);
  }
  setInterval(() => {
    if (!ctx || ctx.state !== 'running') { next = ctx ? ctx.currentTime + 0.1 : 0; return; }
    while (next < ctx.currentTime + 0.3) {
      const bar = Math.floor(step / 8) % prog.length;
      const chord = prog[bar];
      const st = step % 8;
      if (st === 0) pluck(root / 2 * Math.pow(2, chord[0] / 12), next, 0.5, 0.9);
      if (st === 4) pluck(root / 2 * Math.pow(2, chord[0] / 12) * 1.5, next, 0.3, 0.6);
      if (st % 2 === 1) pluck(root * Math.pow(2, chord[(st >> 1) % 3] / 12), next, 0.18, 0.25);
      const m = mel[step % 64];
      if (m !== null && (st % 2 === 0 || musicMood > 0)) pluck(root * 2 * Math.pow(2, m / 12), next, 0.22, 0.4);
      next += beat / 2;
      step++;
    }
  }, 100);
}
