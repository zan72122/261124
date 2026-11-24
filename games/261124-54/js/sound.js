// tiny synthesized sound kit (no audio files)
let ac = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;

export function unlock() {
  try {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
      sfxBus = ac.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
      musicBus = ac.createGain(); musicBus.gain.value = 0.07; musicBus.connect(master);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // iOS: play a silent buffer inside the gesture
      const b = ac.createBufferSource(); b.buffer = ac.createBuffer(1, 1, 22050); b.connect(master); b.start(0);
    }
    if (ac.state !== 'running') ac.resume();
  } catch (_) {}
}
document.addEventListener('visibilitychange', () => {
  if (!ac) return;
  if (document.hidden) ac.suspend(); else ac.resume();
});

const now = () => ac.currentTime;
function tone(freq, dur, o = {}) {
  if (!ac) return;
  const t = now() + (o.when || 0);
  const osc = ac.createOscillator();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + (o.slideT || dur));
  const g = ac.createGain();
  const v = o.vol || 0.25, a = o.attack || 0.005;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = osc;
  if (o.vib) {
    const l = ac.createOscillator(), lg = ac.createGain();
    l.frequency.value = o.vib; lg.gain.value = o.vibAmt || 8;
    l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + 0.05);
  }
  if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
  node.connect(g); g.connect(o.bus || sfxBus);
  osc.start(t); osc.stop(t + dur + 0.05);
}
function noise(dur, o = {}) {
  if (!ac) return;
  const t = now() + (o.when || 0);
  const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = o.type || 'bandpass';
  f.frequency.setValueAtTime(o.freq || 1000, t);
  if (o.slide) f.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
  f.Q.value = o.q || 1;
  const g = ac.createGain();
  const v = o.vol || 0.2, a = o.attack || 0.005;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(sfxBus);
  src.start(t, Math.random()); src.stop(t + dur + 0.05);
  return { src, g };
}
const rnd = (a, b) => a + Math.random() * (b - a);

export const sfx = {
  ding() { // brass desk bell
    [[1, 0.28, 2.2], [2.32, 0.12, 1.4], [4.25, 0.07, 0.9], [6.1, 0.03, 0.5]].forEach(([r, v, d]) => tone(1568 * r, d, { vol: v }));
    tone(1568 * 1.003, 2.0, { vol: 0.12 });
  },
  pop() { tone(rnd(500, 700), 0.09, { slide: rnd(1100, 1500), vol: 0.22 }); noise(0.03, { freq: 3000, vol: 0.08 }); },
  boing(h = 1) { tone(160 * h, 0.35, { slide: 480 * h, vol: 0.2, type: 'sine', vib: 14, vibAmt: 25 }); },
  whoosh() { noise(0.45, { freq: 300, slide: 2400, q: 0.8, vol: 0.15, attack: 0.1 }); },
  chop() { noise(0.06, { type: 'highpass', freq: 2500, vol: 0.25 }); tone(180, 0.08, { vol: 0.25 }); },
  sizzle() { noise(0.6, { type: 'highpass', freq: 4000, vol: 0.1, attack: 0.03 }); },
  clink() { tone(2600, 0.25, { vol: 0.1 }); tone(3900, 0.18, { vol: 0.06 }); },
  stir() { tone(rnd(2200, 2800), 0.2, { vol: 0.08 }); noise(0.2, { freq: 800, vol: 0.06, q: 3 }); },
  flip() { tone(300, 0.15, { slide: 700, vol: 0.15, type: 'triangle' }); noise(0.15, { freq: 1500, vol: 0.06 }); },
  splash() { noise(0.6, { type: 'lowpass', freq: 3000, slide: 300, vol: 0.35 }); tone(220, 0.3, { slide: 90, vol: 0.2 }); },
  step() { tone(110, 0.08, { vol: 0.12 }); },
  swish() { noise(0.18, { freq: 1800, q: 2, vol: 0.1, attack: 0.04 }); },
  sparkle() { [0, 1, 2, 3, 4].forEach(i => tone(1800 + i * 330, 0.3, { vol: 0.07, when: i * 0.05 })); },
  yay() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, { vol: 0.15, type: 'triangle', when: i * 0.08 })); },
  hm() { // "are?" — a questioning hum
    tone(330, 0.22, { type: 'triangle', vol: 0.2, slide: 290, lp: 1200 });
    tone(300, 0.35, { type: 'triangle', vol: 0.2, slide: 470, lp: 1400, when: 0.24, vib: 6, vibAmt: 6 });
  },
  oops() {
    tone(420, 0.35, { type: 'sawtooth', vol: 0.12, slide: 330, lp: 900, vib: 5, vibAmt: 10 });
    tone(330, 0.6, { type: 'sawtooth', vol: 0.12, slide: 200, lp: 800, when: 0.38, vib: 5, vibAmt: 12 });
  },
  giggle() { for (let i = 0; i < 6; i++) tone(rnd(650, 900) - i * 25, 0.1, { type: 'triangle', vol: 0.12, when: i * 0.11, slide: rnd(500, 650) }); },
  laughLow() { for (let i = 0; i < 5; i++) tone(rnd(220, 280) - i * 8, 0.13, { type: 'triangle', vol: 0.16, when: i * 0.14, slide: 180 }); },
  yum() { tone(400, 0.18, { type: 'triangle', vol: 0.14, slide: 520 }); tone(520, 0.3, { type: 'triangle', vol: 0.14, when: 0.2, slide: 380 }); },
  fanfare() {
    const n = [[392, 0, 0.18], [523, 0.18, 0.18], [659, 0.36, 0.18], [784, 0.54, 0.7], [659, 1.3, 0.18], [784, 1.48, 0.9]];
    n.forEach(([f, w, d]) => { tone(f, d + 0.1, { type: 'sawtooth', vol: 0.09, lp: 2200, when: w, attack: 0.02 }); tone(f / 2, d + 0.1, { type: 'triangle', vol: 0.1, when: w }); });
  },
  clap(n = 8) { for (let i = 0; i < n; i++) noise(0.05, { freq: rnd(1200, 2200), q: 1.5, vol: 0.18, when: i * rnd(0.13, 0.2) }); },
  shutter() { noise(0.04, { type: 'highpass', freq: 3000, vol: 0.3 }); noise(0.05, { type: 'highpass', freq: 2000, vol: 0.25, when: 0.09 }); },
  blip() { tone(rnd(700, 1400), 0.12, { slide: rnd(1500, 2200), vol: 0.07 }); },
  thud() { tone(90, 0.25, { slide: 50, vol: 0.35 }); noise(0.12, { type: 'lowpass', freq: 500, vol: 0.2 }); },
  door() { tone(140, 0.2, { vol: 0.15, type: 'triangle' }); noise(0.25, { freq: 400, vol: 0.08 }); },
  roll() { noise(1.0, { type: 'lowpass', freq: 400, vol: 0.12, attack: 0.1 }); },
  pour() { noise(0.9, { freq: 900, q: 4, vol: 0.12, attack: 0.1 }); for (let i = 0; i < 4; i++) tone(rnd(500, 900), 0.08, { vol: 0.05, when: i * 0.2, slide: 1200 }); },
};

// running water loop
let water = null;
export function waterOn() {
  if (!ac || water) return;
  const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 0.6;
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, now()); g.gain.exponentialRampToValueAtTime(0.16, now() + 0.3);
  src.connect(f); f.connect(g); g.connect(sfxBus); src.start();
  water = { src, g };
}
export function waterOff() {
  if (!water) return;
  const w = water; water = null;
  w.g.gain.cancelScheduledValues(now());
  w.g.gain.setValueAtTime(w.g.gain.value, now());
  w.g.gain.exponentialRampToValueAtTime(0.0001, now() + 0.4);
  w.src.stop(now() + 0.5);
}

// gentle background music (music-box style), a different tune per scene
const tunes = [
  { bpm: 104, wave: 'triangle', mel: [72, 76, 79, 76, 77, 76, 74, -1, 71, 74, 77, 74, 72, -1, 67, -1], bass: [48, 48, 53, 53, 55, 55, 48, 48] },
  { bpm: 112, wave: 'triangle', mel: [76, 74, 72, 74, 76, 76, 76, -1, 74, 74, 74, -1, 76, 79, 79, -1], bass: [48, 48, 55, 55, 53, 53, 48, 55] },
  { bpm: 96, wave: 'sine', mel: [79, -1, 76, 77, 79, -1, 72, -1, 74, 76, 77, 76, 74, -1, -1, -1], bass: [48, 52, 53, 50, 48, 52, 55, 55] },
  { bpm: 124, wave: 'square', mel: [72, 74, 76, 79, 76, 79, 84, -1, 81, 79, 76, 79, 77, 76, 74, -1], bass: [48, 48, 53, 53, 50, 55, 48, 48] },
];
let musicTimer = null, step = 0, nextT = 0, tune = null;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
export function playMusic(i) {
  tune = tunes[i % tunes.length];
  if (!ac) return;
  if (!musicTimer) {
    nextT = now() + 0.1; step = 0;
    musicTimer = setInterval(schedule, 60);
  }
}
function schedule() {
  if (!ac || !tune || ac.state !== 'running') return;
  const st = 60 / tune.bpm / 2;
  while (nextT < now() + 0.25) {
    const m = tune.mel[step % 16];
    const w = nextT - now();
    if (m > 0) {
      tone(mtof(m), st * 1.8, { type: tune.wave, vol: tune.wave === 'square' ? 0.25 : 0.6, when: w, bus: musicBus, lp: 2500 });
      tone(mtof(m + 12), st * 1.2, { type: 'sine', vol: 0.15, when: w, bus: musicBus });
    }
    if (step % 2 === 0) tone(mtof(tune.bass[(step / 2) % 8]), st * 1.9, { type: 'sine', vol: 0.7, when: w, bus: musicBus });
    step++; nextT += st;
  }
}
