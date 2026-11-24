// すべて WebAudio で合成する効果音・声・BGM（外部音源なし）
const AC = window.AudioContext || window.webkitAudioContext;
let ac = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
let musicOn = false, musicTimer = 0, musicStep = 0, musicNext = 0;

export function audioInit() {
  if (!AC) return;
  if (!ac) {
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = 0.16; musicBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state !== 'running') ac.resume();
}
document.addEventListener('visibilitychange', () => {
  if (!ac) return;
  if (document.hidden) ac.suspend(); else ac.resume();
});

function now() { return ac.currentTime; }

function tone(freq, dur, { type = 'sine', vol = 0.2, when = 0, slide = 0, attack = 0.01, bus = sfxBus, vib = 0 } = {}) {
  if (!ac) return;
  const t = now() + when;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
  if (vib) {
    const l = ac.createOscillator(), lg = ac.createGain();
    l.frequency.value = 18; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur, { type = 'lowpass', f = 1000, f2 = 0, q = 1, vol = 0.2, when = 0, attack = 0.01 } = {}) {
  if (!ac) return;
  const t = now() + when;
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = ac.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(sfxBus);
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
}

// 声っぽい音（フォルマント付きのこぎり波）
function voice(notes, { base = 400, formant = 1100, vol = 0.12, gap = 0.12, len = 0.1, when = 0 } = {}) {
  if (!ac) return;
  notes.forEach((m, i) => {
    const t = now() + when + i * gap;
    const o = ac.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(base * m, t);
    o.frequency.exponentialRampToValueAtTime(base * m * 0.86, t + len);
    const f1 = ac.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = formant; f1.Q.value = 3;
    const f2 = ac.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = formant * 2.3; f2.Q.value = 4;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(sfxBus);
    o.start(t); o.stop(t + len + 0.05);
  });
}

const VOICE = {
  girl: { base: 520, formant: 1300 },
  dad: { base: 150, formant: 700 },
  mom: { base: 300, formant: 1000 },
  boy: { base: 600, formant: 1500 },
};

export const sfx = {
  tap() { tone(900, 0.08, { type: 'triangle', vol: 0.12 }); },
  pick() { tone(600, 0.12, { type: 'triangle', vol: 0.14, slide: 1100 }); },
  whoosh() { noise(0.45, { type: 'bandpass', f: 500, f2: 2600, q: 1.2, vol: 0.12, attack: 0.15 }); },
  place(kind) {
    if (kind === 'card') { noise(0.18, { type: 'lowpass', f: 700, vol: 0.35 }); tone(140, 0.15, { vol: 0.25, slide: 90 }); }
    else if (kind === 'fluff') { noise(0.35, { type: 'lowpass', f: 400, vol: 0.25, attack: 0.05 }); tone(330, 0.3, { vol: 0.12, slide: 500 }); }
    else { tone(1800, 0.06, { type: 'square', vol: 0.06 }); tone(2400, 0.05, { type: 'square', vol: 0.05, when: 0.05 }); tone(160, 0.12, { vol: 0.2 }); }
    tone(880, 0.12, { type: 'triangle', vol: 0.08, when: 0.08 }); tone(1320, 0.18, { type: 'triangle', vol: 0.07, when: 0.14 });
  },
  pop() { tone(500 + Math.random() * 500, 0.09, { vol: 0.12, slide: 1600 }); },
  boing() { tone(420, 0.5, { type: 'sine', vol: 0.25, slide: 90, vib: 30 }); },
  thud() { tone(90, 0.3, { vol: 0.4, slide: 45 }); noise(0.2, { f: 300, vol: 0.25 }); },
  sparkle() { [0, 1, 2, 3, 4].forEach(i => tone(1568 * Math.pow(1.122, i), 0.25, { type: 'triangle', vol: 0.06, when: i * 0.06 })); },
  fanfare() {
    const n = [523, 659, 784, 1047, 784, 1047];
    n.forEach((f, i) => tone(f, i === 5 ? 0.7 : 0.18, { type: 'triangle', vol: 0.16, when: i * 0.13 }));
    n.forEach((f, i) => tone(f / 2, i === 5 ? 0.7 : 0.18, { type: 'sine', vol: 0.1, when: i * 0.13 }));
  },
  giggle(who = 'girl') { const v = VOICE[who] || VOICE.girl; voice([1.3, 1.2, 1.25, 1.1], { ...v, vol: 0.1 }); },
  wow(who = 'girl') {
    if (!ac) return; const v = VOICE[who] || VOICE.girl;
    const t = now(); const o = ac.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(v.base, t); o.frequency.exponentialRampToValueAtTime(v.base * 1.6, t + 0.25);
    o.frequency.exponentialRampToValueAtTime(v.base * 1.1, t + 0.6);
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(v.formant * 0.6, t); f.frequency.linearRampToValueAtTime(v.formant * 1.2, t + 0.5);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    o.connect(f); f.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.7);
  },
  are(who = 'girl') { const v = VOICE[who] || VOICE.girl; tone(v.base * 0.9, 0.18, { type: 'triangle', vol: 0.14 }); tone(v.base, 0.3, { type: 'triangle', vol: 0.14, when: 0.2, slide: v.base * 1.6 }); },
  oops() { voice([1.2, 0.9], { ...VOICE.dad, gap: 0.22, len: 0.2, vol: 0.14 }); },
  bark() { voice([1, 1.1], { base: 380, formant: 900, gap: 0.18, len: 0.12, vol: 0.14 }); },
  step() { noise(0.06, { type: 'lowpass', f: 500, vol: 0.06 }); },
  creak() { tone(220, 0.5, { type: 'sawtooth', vol: 0.03, slide: 300, vib: 20 }); },
  swoosh() { noise(0.7, { type: 'bandpass', f: 300, f2: 1200, q: 0.8, vol: 0.12, attack: 0.3 }); },
  clap() { [0, 0.22, 0.44].forEach(w => noise(0.07, { type: 'highpass', f: 1500, vol: 0.2, when: w })); },
  drip() { tone(900, 0.12, { vol: 0.08, slide: 1800 }); },
};

// 噴射ループ（泡・水）
export function makeLoop(kind) {
  let src = null, g = null;
  return {
    start() {
      if (!ac || src) return;
      src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const f = ac.createBiquadFilter();
      if (kind === 'foam') { f.type = 'lowpass'; f.frequency.value = 2200; }
      else { f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.6; }
      g = ac.createGain(); g.gain.setValueAtTime(0.0001, now()); g.gain.exponentialRampToValueAtTime(kind === 'foam' ? 0.22 : 0.12, now() + 0.12);
      src.connect(f); f.connect(g); g.connect(sfxBus); src.start();
    },
    stop() {
      if (!src) return;
      const s = src, gg = g; src = null; g = null;
      gg.gain.cancelScheduledValues(now()); gg.gain.setValueAtTime(gg.gain.value, now());
      gg.gain.exponentialRampToValueAtTime(0.0001, now() + 0.15); s.stop(now() + 0.2);
    },
  };
}

// やさしい BGM（ペンタトニックのマリンバ風）
const MEL = [0, 2, 4, 7, 4, 2, 9, 7, 0, 4, 7, 9, 7, 4, 2, 0];
const BASS = [0, 0, 5, 5, 7, 7, 5, 5];
export function musicStart() {
  if (!ac || musicOn) return;
  musicOn = true; musicNext = now() + 0.2;
  musicTimer = setInterval(() => {
    if (!ac) return;
    while (musicNext < now() + 0.5) {
      const st = musicStep++, beat = 0.3;
      const when = musicNext - now();
      if (st % 2 === 0 || Math.random() < 0.35) {
        const m = MEL[st % 16], f = 523.25 * Math.pow(2, m / 12);
        tone(f, 0.35, { type: 'sine', vol: 0.35, when, bus: musicBus, attack: 0.005 });
        tone(f * 4, 0.08, { type: 'sine', vol: 0.05, when, bus: musicBus, attack: 0.003 });
      }
      if (st % 4 === 0) {
        const b = 130.8 * Math.pow(2, BASS[(st / 4) % 8] / 12);
        tone(b, 0.6, { type: 'triangle', vol: 0.3, when, bus: musicBus });
      }
      musicNext += beat;
    }
  }, 120);
}
