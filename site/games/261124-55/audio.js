// 効果音はすべて Web Audio で合成する（音声ファイルなし・文字なし）。
let ac = null, master = null, noiseBuf = null;

export function unlockAudio() {
  try {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master = ac.createGain(); master.gain.value = 0.75;
      master.connect(comp); comp.connect(ac.destination);
      const len = ac.sampleRate * 2;
      noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // iOS: 無音を1回鳴らして解錠
      const b = ac.createBuffer(1, 1, 22050), s = ac.createBufferSource();
      s.buffer = b; s.connect(ac.destination); s.start(0);
    }
    if (ac.state === 'suspended') ac.resume();
  } catch (e) { /* 音が出なくても遊べる */ }
}

const ok = () => ac && ac.state === 'running';
const now = () => ac.currentTime;

function env(g, t, vol, att, dur, rel) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + att);
  g.gain.setValueAtTime(vol, t + Math.max(att, dur - rel));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

export function tone({ f = 440, f2 = null, type = 'sine', at = 0, dur = 0.2, vol = 0.25, att = 0.005, rel = null, vib = 0, vibF = 6, lp = null, bp = null, curve = 'exp' } = {}) {
  if (!ok()) return;
  const t = now() + at;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) {
    if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    else o.frequency.linearRampToValueAtTime(f2, t + dur);
  }
  let node = o;
  if (vib) {
    const l = ac.createOscillator(), lg = ac.createGain();
    l.frequency.value = vibF; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency);
    l.start(t); l.stop(t + dur + 0.05);
  }
  if (lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; node.connect(fl); node = fl; }
  if (bp) { const fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = bp; fl.Q.value = 3; node.connect(fl); node = fl; }
  node.connect(g); g.connect(master);
  env(g, t, vol, att, dur, rel == null ? dur * 0.6 : rel);
  o.start(t); o.stop(t + dur + 0.05);
}

export function noise({ at = 0, dur = 0.3, vol = 0.2, type = 'bandpass', f = 1000, f2 = null, q = 1, att = 0.005, rel = null } = {}) {
  if (!ok()) return;
  const t = now() + at;
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = ac.createBiquadFilter(); fl.type = type; fl.Q.value = q;
  fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ac.createGain();
  s.connect(fl); fl.connect(g); g.connect(master);
  env(g, t, vol, att, dur, rel == null ? dur * 0.7 : rel);
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
}

const N = (n) => 440 * Math.pow(2, (n - 69) / 12);

export const sfx = {
  knock(at = 0) { tone({ f: 1100, f2: 700, type: 'triangle', at, dur: 0.07, vol: 0.35 }); noise({ at, dur: 0.04, f: 2500, vol: 0.15, q: 2 }); },
  tonton() { sfx.knock(0); sfx.knock(0.2); },
  sparkle(at = 0) { [84, 88, 91, 96, 100].forEach((n, i) => tone({ f: N(n), at: at + i * 0.06, dur: 0.35, vol: 0.12 })); },
  grow() {
    tone({ f: 180, f2: 900, type: 'sine', dur: 0.9, vol: 0.25, vib: 12, vibF: 9 });
    tone({ f: 360, f2: 1800, type: 'triangle', dur: 0.9, vol: 0.08 });
    sfx.sparkle(0.7);
  },
  boing(at = 0) { tone({ f: 320, f2: 110, type: 'sine', at, dur: 0.45, vol: 0.35, vib: 30, vibF: 14 }); },
  pop(at = 0, n = 76) { tone({ f: N(n) * 0.6, f2: N(n), type: 'sine', at, dur: 0.12, vol: 0.3 }); },
  note(i) { const sc = [72, 74, 76, 79, 81, 84, 86, 88]; const f = N(sc[i % sc.length]); tone({ f, type: 'sine', dur: 0.5, vol: 0.3 }); tone({ f: f * 2, type: 'sine', dur: 0.2, vol: 0.08 }); },
  // 乗り物の声
  pipo() { for (let i = 0; i < 4; i++) tone({ f: i % 2 ? 770 : 960, type: 'square', at: i * 0.38, dur: 0.36, vol: 0.07, lp: 2400, att: 0.01 }); },
  siren() { tone({ f: 600, f2: 1250, type: 'sawtooth', dur: 0.8, vol: 0.06, lp: 2000, curve: 'lin', att: 0.05 }); tone({ f: 1250, f2: 600, type: 'sawtooth', at: 0.8, dur: 0.8, vol: 0.06, lp: 2000, curve: 'lin' }); },
  busHorn() { [0, 0.3].forEach((a, i) => { const d = i ? 0.45 : 0.18; tone({ f: 370, type: 'sawtooth', at: a, dur: d, vol: 0.07, lp: 1500, att: 0.01 }); tone({ f: 466, type: 'sawtooth', at: a, dur: d, vol: 0.06, lp: 1500, att: 0.01 }); }); },
  truckHorn() { tone({ f: 196, type: 'sawtooth', dur: 0.6, vol: 0.08, lp: 900, att: 0.02 }); tone({ f: 247, type: 'sawtooth', dur: 0.6, vol: 0.07, lp: 900, att: 0.02 }); },
  beep() { for (let i = 0; i < 3; i++) tone({ f: 1050, type: 'square', at: i * 0.32, dur: 0.16, vol: 0.06, lp: 3000 }); },
  melody() { [72, 76, 79, 76, 77, 74, 72].forEach((n, i) => tone({ f: N(n), type: 'triangle', at: i * 0.16, dur: 0.18, vol: 0.14 })); },
  munch() { for (let i = 0; i < 3; i++) { noise({ at: i * 0.22, dur: 0.16, type: 'lowpass', f: 500, vol: 0.35 }); tone({ f: 120, f2: 70, at: i * 0.22, dur: 0.15, vol: 0.25 }); } },
  rumble(dur = 1.5) { noise({ dur, type: 'lowpass', f: 160, vol: 0.4, att: 0.15, q: 3 }); tone({ f: 55, type: 'sawtooth', dur, vol: 0.06, lp: 200, vib: 4, vibF: 7, att: 0.1 }); },
  pour(dur = 1.4) { noise({ dur, type: 'bandpass', f: 420, f2: 260, vol: 0.35, q: 1.5, att: 0.1 }); for (let i = 0; i < 6; i++) tone({ f: 160 + Math.random() * 80, f2: 60, at: 0.1 + i * dur / 6, dur: 0.12, vol: 0.15 }); },
  sand(dur = 1.6) { noise({ dur, type: 'highpass', f: 1800, vol: 0.18, att: 0.2 }); noise({ dur, type: 'bandpass', f: 700, vol: 0.12, att: 0.3 }); },
  thump(at = 0) { tone({ f: 90, f2: 38, at, dur: 0.35, vol: 0.55 }); noise({ at, dur: 0.18, type: 'lowpass', f: 300, vol: 0.3 }); },
  gao() { tone({ f: 260, f2: 340, type: 'sawtooth', dur: 0.25, vol: 0.12, bp: 900, att: 0.03 }); tone({ f: 340, f2: 200, type: 'sawtooth', at: 0.22, dur: 0.55, vol: 0.12, bp: 800, vib: 18, vibF: 11 }); tone({ f: 520, f2: 400, type: 'sine', at: 0.22, dur: 0.5, vol: 0.06 }); },
  snap() { sfx.knock(0); sfx.knock(0.13); tone({ f: 500, f2: 700, type: 'sine', at: 0.25, dur: 0.15, vol: 0.15 }); },
  zip(dur = 1.2) { noise({ dur, type: 'bandpass', f: 900, f2: 3200, vol: 0.2, q: 4 }); for (let i = 0; i < dur * 14; i++) tone({ f: 3000, type: 'square', at: i / 14, dur: 0.015, vol: 0.03 }); tone({ f: 1400, f2: 900, type: 'triangle', at: dur, dur: 0.08, vol: 0.35 }); },
  // 人の声のかわり
  giggle() { [0, 0.13, 0.26, 0.39].forEach((a, i) => tone({ f: 720 - i * 30, f2: 560 - i * 30, type: 'triangle', at: a, dur: 0.1, vol: 0.14, bp: 1400 })); },
  are() { tone({ f: 380, f2: 620, type: 'triangle', dur: 0.35, vol: 0.2, att: 0.03 }); },
  wow() { tone({ f: 500, f2: 900, type: 'triangle', dur: 0.25, vol: 0.18 }); tone({ f: 900, f2: 760, type: 'triangle', at: 0.25, dur: 0.3, vol: 0.16 }); },
  oops() { tone({ f: 1300, f2: 260, type: 'sine', dur: 0.7, vol: 0.2, curve: 'exp' }); sfx.thump(0.7); },
  bonk() { tone({ f: 900, f2: 300, type: 'square', dur: 0.08, vol: 0.12, lp: 2500 }); sfx.boing(0.06); [0.4, 0.55, 0.7].forEach(a => tone({ f: 2200, f2: 2600, at: a, dur: 0.1, vol: 0.06 })); },
  spit() { tone({ f: 200, f2: 900, type: 'sine', dur: 0.18, vol: 0.3 }); noise({ dur: 0.1, f: 1500, vol: 0.2 }); },
  whoosh() { noise({ dur: 0.5, type: 'bandpass', f: 400, f2: 2000, vol: 0.18, q: 2 }); },
  fanfare() { [[72, 0], [76, 0.14], [79, 0.28], [84, 0.42]].forEach(([n, a]) => tone({ f: N(n), type: 'triangle', at: a, dur: 0.3, vol: 0.18 })); [72, 76, 79, 84].forEach(n => tone({ f: N(n), type: 'triangle', at: 0.6, dur: 0.9, vol: 0.09 })); sfx.sparkle(0.6); },
  star() { tone({ f: N(88), type: 'sine', dur: 0.25, vol: 0.2 }); tone({ f: N(91), type: 'sine', at: 0.1, dur: 0.4, vol: 0.2 }); },
  engine(dur = 1.2) { tone({ f: 70, f2: 110, type: 'sawtooth', dur, vol: 0.07, lp: 400, vib: 6, vibF: 18, att: 0.1 }); },
  clap() { for (let i = 0; i < 6; i++) noise({ at: i * 0.12 + Math.random() * 0.03, dur: 0.05, f: 1800, vol: 0.25, q: 0.8 }); },
};
