// ピンクとブルーのプール — a wordless pool game for small fingers.
import * as THREE from './three.module.min.js';

// ---------------------------------------------------------------- utils
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeIO = t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

const tweens = [];
function tween(dur, fn, done) { const w = { t: 0, dur, fn, done }; tweens.push(w); if (fn) fn(0); return w; }
function updTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const w = tweens[i]; if (!w) continue;
    w.t += dt; const k = Math.min(1, w.t / w.dur);
    if (w.fn) w.fn(k);
    if (k >= 1) { tweens.splice(i, 1); if (w.done) w.done(); }
  }
}
const wait = s => new Promise(r => tween(s, null, r));
const play = (d, fn) => new Promise(r => tween(d, fn, r));

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd0f5);
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);

// sky environment for reflections
{
  const env = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 p; void main(){
      vec3 top = vec3(.25,.55,.95), hor = vec3(.92,.96,1.), gnd = vec3(.32,.45,.25);
      vec3 c = p.y > 0. ? mix(hor, top, pow(p.y,.6)) : mix(hor, gnd, pow(-p.y,.4));
      float s = pow(max(dot(p, normalize(vec3(.5,.8,.4))),0.), 300.)*30.;
      gl_FragColor = vec4(c + s, 1.); }`
  }));
  env.add(sky);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.02).texture;
  scene.environmentIntensity = 0.9;
}

const hemi = new THREE.HemisphereLight(0xe4f4ff, 0x7a9a5a, 0.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 2.8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -9; sun.shadow.camera.right = 9;
sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 40;
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
function sunAt(c) { sun.target.position.copy(c); sun.position.set(c.x + 6, 13, c.z + 7); }
sunAt(V());

// ---------------------------------------------------------------- textures
const loading = { n: 0, done: 0 };
const loadBar = document.querySelector('#load i');
const tl = new THREE.TextureLoader();
function texR(name, rx, ry) { return tex(name + '.jpg', rx, ry); }
function tex(url, rx = 1, ry = 1, mirror = true) {
  loading.n++;
  const t = tl.load(url, () => { loading.done++; loadBar.style.width = (100 * loading.done / loading.n) + '%'; });
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = mirror ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
  t.repeat.set(rx, ry); t.anisotropy = 8;
  return t;
}
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const PINK = 0xff5fa2, BLUE = 0x3d8bff;
const PINK_S = '#ff5fa2', BLUE_S = '#3d8bff';

// materials helpers
const M = (color, rough = .55, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
const PM = (color, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: .28, clearcoat: 1, clearcoatRoughness: .06, ...extra });
function mesh(geo, mat, parent, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

// ---------------------------------------------------------------- audio
const Snd = {
  ctx: null, master: null, nb: null,
  init() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = .9;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp); comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2, b = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.nb = b;
      const s = this.ctx.createBufferSource(); s.buffer = this.ctx.createBuffer(1, 1, 22050); s.connect(this.master); s.start(0);
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.music();
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) this.ctx.suspend(); else this.ctx.resume();
      });
    } catch (e) { this.ctx = null; }
  },
  tone(f, dur, { type = 'sine', vol = .2, to = null, delay = 0, attack = .006 } = {}) {
    const c = this.ctx; if (!c) return;
    const t0 = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + .05);
  },
  noise(dur, { vol = .2, type = 'lowpass', f = 1000, to = null, q = 1, delay = 0, attack = .005 } = {}) {
    const c = this.ctx; if (!c) return;
    const t0 = c.currentTime + delay, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.nb; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t0);
    if (to) fl.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    s.connect(fl); fl.connect(g); g.connect(this.master);
    s.start(t0, Math.random()); s.stop(t0 + dur + .05);
  },
  // tiny formant voice: no words, just feelings
  voice(p0, p1, dur, vowel = 'a', { vol = .16, delay = 0, p2 = null } = {}) {
    const c = this.ctx; if (!c) return;
    const F = { a: [900, 1300], e: [600, 2100], i: [420, 2600], o: [600, 950], u: [420, 900] }[vowel];
    const t0 = c.currentTime + delay, o = c.createOscillator(), g = c.createGain(), out = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(p0, t0);
    if (p2) { o.frequency.linearRampToValueAtTime(p1, t0 + dur * .5); o.frequency.linearRampToValueAtTime(p2, t0 + dur); }
    else o.frequency.linearRampToValueAtTime(p1, t0 + dur);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 6; lg.gain.value = p0 * .02;
    lfo.connect(lg); lg.connect(o.frequency);
    for (const f of F) { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 5; o.connect(bp); bp.connect(g); }
    g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(vol * 3, t0 + .03);
    g.gain.setValueAtTime(vol * 3, t0 + dur * .7); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    g.connect(out); out.connect(this.master);
    o.start(t0); lfo.start(t0); o.stop(t0 + dur + .05); lfo.stop(t0 + dur + .05);
  },
  music() {
    const c = this.ctx, g = c.createGain(); g.gain.value = .045; g.connect(this.master);
    const beat = 60 / 100, mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    const chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
    const mel = [0, 2, 1, 2, 1, 2, 0, 1];
    let next = c.currentTime + .2, step = 0;
    const pl = (m, t, d, v) => {
      const o = c.createOscillator(), o2 = c.createOscillator(), e = c.createGain(), e2 = c.createGain();
      o.frequency.value = mtof(m); o2.frequency.value = mtof(m) * 4; e2.gain.value = .12;
      o2.connect(e2); e2.connect(e); o.connect(e); e.connect(g);
      e.gain.setValueAtTime(.0001, t); e.gain.exponentialRampToValueAtTime(v, t + .01); e.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.start(t); o2.start(t); o.stop(t + d + .05); o2.stop(t + d + .05);
    };
    setInterval(() => {
      while (next < c.currentTime + .5) {
        const ch = chords[Math.floor(step / 8) % 4], s = step % 8;
        if (s === 0) pl(ch[0] - 12, next, beat * 1.8, .9);
        if (s === 4) pl(ch[0] - 5, next, beat * 1.5, .6);
        if (s !== 7) pl(ch[mel[s]] + 12, next, beat * .8, s % 2 ? .3 : .45);
        next += beat / 2; step++;
      }
    }, 120);
  },
};
const sfx = {
  splash(s = 1) { Snd.noise(.45 * s, { vol: .3 * Math.min(1.3, s), f: 2600, to: 300 }); Snd.noise(.16, { vol: .14, type: 'bandpass', f: 3200, to: 1400, q: 1 }); Snd.tone(rnd(180, 260), .18, { vol: .12, to: 600 }); },
  plop() { Snd.tone(rnd(300, 420), .12, { vol: .22, to: 900 }); Snd.noise(.2, { vol: .1, f: 1500, to: 300 }); },
  whoosh() { Snd.noise(.28, { vol: .12, type: 'bandpass', f: 500, to: 2600, q: 1.5 }); },
  pop() { Snd.tone(rnd(650, 800), .09, { vol: .22, to: 240 }); },
  boing() { Snd.tone(170, .45, { vol: .3, to: 560, type: 'triangle' }); Snd.tone(560, .25, { vol: .1, to: 200, delay: .2 }); },
  sparkle(n = 6) { for (let i = 0; i < n; i++) Snd.tone(rnd(1700, 3300), .3, { vol: .05, delay: i * .05 }); },
  magic() { Snd.tone(360, .8, { vol: .12, to: 1500, type: 'triangle' }); sfx.sparkle(9); },
  fanfare() { [[523, 0], [659, .12], [784, .24], [1047, .4]].forEach(([f, d]) => { Snd.tone(f, .5, { vol: .14, delay: d, type: 'triangle' }); Snd.tone(f * 1.5, .4, { vol: .05, delay: d }); }); sfx.sparkle(10); },
  squeak() { Snd.tone(1100, .14, { vol: .1, to: 1500, type: 'square' }); },
  click() { for (let i = 0; i < 5; i++) Snd.tone(rnd(2200, 3200), .04, { vol: .08, delay: i * .045, type: 'square' }); Snd.tone(1800, .3, { vol: .07, to: 3200, delay: .25 }); },
  snore() { Snd.noise(1.1, { vol: .07, f: 260, to: 520, q: 3, attack: .4 }); },
  snap() { Snd.tone(1600, .05, { vol: .12, type: 'square' }); Snd.tone(1400, .05, { vol: .12, type: 'square', delay: .12 }); },
  bubble() { Snd.tone(rnd(500, 800), .1, { vol: .08, to: 1400 }); },
};
// character voices
const VO = {
  girl: 420, boy: 350, mom: 290, papa: 150,
};
function say(who, kind) {
  const p = VO[who] || 400;
  if (kind === 'yay') { Snd.voice(p, p * 1.45, .32, 'e', { p2: p * 1.1 }); }
  else if (kind === 'huh') { Snd.voice(p * .9, p * .85, .14, 'a'); Snd.voice(p * .85, p * 1.5, .3, 'a', { delay: .16 }); }
  else if (kind === 'oh') { Snd.voice(p * 1.2, p * .8, .45, 'o'); }
  else if (kind === 'wow') { Snd.voice(p, p * 1.6, .45, 'o', { p2: p * 1.2 }); }
  else if (kind === 'laugh') { for (let i = 0; i < 4; i++) Snd.voice(p * (1.25 - i * .05), p * (1.1 - i * .05), .1, 'a', { delay: i * .13, vol: .13 }); }
  else if (kind === 'uh') { Snd.voice(p * 1.1, p * .7, .5, 'u'); }
}

// ---------------------------------------------------------------- particles
const dropTex = canvasTex(64, 64, (x, w) => {
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.5, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, w);
});
const starTex = canvasTex(64, 64, (x) => {
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#fff'; x.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 5 : 31; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
  x.fill();
});
class Particles {
  constructor(n, map, additive) {
    this.n = n; this.i = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.grav = new Float32Array(n); this.s0 = new Float32Array(n); this.drag = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('psize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('palpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, scale: { value: 500 } },
      vertexShader: `attribute vec3 pcolor; attribute float psize; attribute float palpha; uniform float scale;
        varying vec3 vC; varying float vA;
        void main(){ vC = pcolor; vA = palpha; vec4 mv = modelViewMatrix*vec4(position,1.);
          gl_PointSize = psize*scale/max(.1,-mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); if(vA<=0.) discard; gl_FragColor = vec4(vC*t.rgb, t.a*vA); }`,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = 10;
    this.geo = g; scene.add(this.pts);
  }
  emit(p, o = {}) {
    const { count = 20, colors = [new THREE.Color(1, 1, 1)], speed = 2, up = 2, spread = 1, size = .12, life = 1, grav = 6, drag = 0, box = 0 } = o;
    for (let k = 0; k < count; k++) {
      const i = this.i; this.i = (this.i + 1) % this.n;
      this.pos[i * 3] = p.x + rnd(-box, box); this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z + rnd(-box, box);
      const a = rnd(0, TAU), s = rnd(.3, 1) * speed * spread;
      this.vel[i * 3] = Math.cos(a) * s; this.vel[i * 3 + 1] = up * rnd(.6, 1.2); this.vel[i * 3 + 2] = Math.sin(a) * s;
      const c = pick(colors); this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
      this.life[i] = this.max[i] = life * rnd(.6, 1.2); this.grav[i] = grav; this.s0[i] = size * rnd(.6, 1.3); this.drag[i] = drag;
    }
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const d = 1 - this.drag[i] * dt;
      this.vel[i * 3] *= d; this.vel[i * 3 + 2] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const k = this.life[i] / this.max[i];
      this.alpha[i] = Math.min(1, k * 2.5); this.size[i] = this.s0[i] * (.5 + .5 * k);
    }
    for (const a of ['position', 'pcolor', 'psize', 'palpha']) this.geo.attributes[a].needsUpdate = true;
  }
}
const drops = new Particles(700, dropTex, false);
const sparks = new Particles(600, starTex, true);
const confetti = new Particles(500, dropTex, false);
const WATERC = [new THREE.Color(.85, .95, 1), new THREE.Color(1, 1, 1), new THREE.Color(.6, .85, 1)];
function splashAt(p, s = 1, tint) {
  const cols = tint ? [...WATERC, tint] : WATERC;
  drops.emit(p, { count: Math.round(26 * s), colors: cols, speed: 1.3 * s, up: 2.6 * s, size: .09 * Math.sqrt(s), life: .8, grav: 9 });
  drops.emit(p, { count: Math.round(10 * s), colors: WATERC, speed: .6, up: 1, size: .16 * s, life: .45, grav: 5 });
}
function sparkleAt(p, cols, n = 24, speed = 1.5) {
  sparks.emit(p, { count: n, colors: cols, speed, up: 1.4, size: .22, life: 1.1, grav: -.3, drag: 1.5 });
}
const C_PINK = new THREE.Color(PINK), C_BLUE = new THREE.Color(BLUE), C_GOLD = new THREE.Color(1, .9, .5), C_WHITE = new THREE.Color(1, 1, 1);
function confettiAt(p, n = 80) {
  confetti.emit(p, { count: n, colors: [C_PINK, C_BLUE, C_GOLD, C_WHITE, new THREE.Color(.5, 1, .7)], speed: 3, up: 6, size: .1, life: 2.6, grav: 4, drag: 1.2, box: .5 });
}

// ---------------------------------------------------------------- water
const causticTex = (() => {
  const S = 128, pts = [];
  for (let i = 0; i < 18; i++) pts.push([Math.random() * S, Math.random() * S]);
  return canvasTex(S, S, (x) => {
    const img = x.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let X = 0; X < S; X++) {
      let f1 = 1e9, f2 = 1e9;
      for (const [px, py] of pts) for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const dx = X - (px + ox * S), dy = y - (py + oy * S), d = Math.sqrt(dx * dx + dy * dy);
        if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
      }
      const v = Math.pow(1 - clamp((f2 - f1) / 9, 0, 1), 4) * 255, o = (y * S + X) * 4;
      img.data[o] = v; img.data[o + 1] = v; img.data[o + 2] = v; img.data[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
  }, false);
})();
causticTex.wrapS = causticTex.wrapT = THREE.RepeatWrapping;

class Water {
  constructor(geo, origin, level, color) {
    this.geo = geo; this.origin = origin; this.level = level; this.ripples = [];
    const p = geo.attributes.position; this.base = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { this.base[i * 2] = p.getX(i); this.base[i * 2 + 1] = p.getZ(i); }
    this.mat = new THREE.MeshPhysicalMaterial({
      color, roughness: .06, metalness: 0, transparent: true, opacity: .7,
      clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: 1.3, side: THREE.DoubleSide,
      specularIntensity: 1, depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.position.copy(origin); this.mesh.position.y = level;
    this.mesh.receiveShadow = true; this.mesh.renderOrder = 3;
    scene.add(this.mesh);
    this.t = 0;
  }
  h(lx, lz) {
    const t = this.t;
    let h = .012 * Math.sin(1.7 * lx + 1.3 * t) + .01 * Math.sin(2.3 * lz - 1.1 * t + 1) + .006 * Math.sin(3.1 * (lx + lz) + 2 * t);
    for (const r of this.ripples) {
      const dx = lx - r.x, dz = lz - r.z, d = Math.sqrt(dx * dx + dz * dz), front = r.age * 1.8;
      if (d > front + .2) continue;
      h += r.a * Math.exp(-r.age * 1.4 - d * .7) * Math.sin(8 * d - 11 * r.age) * clamp((front - d + .2) * 3, 0, 1);
    }
    return h;
  }
  heightAt(x, z) { return this.level + this.h(x - this.origin.x, z - this.origin.z); }
  ripple(x, z, a = .08) {
    this.ripples.push({ x: x - this.origin.x, z: z - this.origin.z, a, age: 0 });
    if (this.ripples.length > 10) this.ripples.shift();
  }
  update(dt) {
    this.t += dt;
    for (const r of this.ripples) r.age += dt;
    this.ripples = this.ripples.filter(r => r.age < 3);
    const p = this.geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, this.h(this.base[i * 2], this.base[i * 2 + 1]));
    p.needsUpdate = true; this.geo.computeVertexNormals();
  }
}

// ---------------------------------------------------------------- world: backyard
const T = {
  tile: tex('tile.jpg', 1, 1), deck: tex('deck.jpg', 1, 1), grass: tex('grass.jpg', 1, 1),
  yard: tex('backyard.jpg', 1, 1, false), park: tex('park.jpg', 1, 1, false),
};
T.yard.wrapS = T.yard.wrapT = T.park.wrapS = T.park.wrapT = THREE.ClampToEdgeWrapping;

const POOL = { w: 4.8, d: 2.8, depth: 1.05, wy: -.13 };
const AQUA = new THREE.Color(0x2fbad6);
let pool;

function backdrop(map, c, w, hor, z) {
  const h = w / 2.4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, toneMapped: false, fog: false }));
  m.position.set(c.x, hor * h - h / 2 - .2, c.z + z);
  scene.add(m); return m;
}

function shapeRectHole(W, D, w, d) {
  const s = new THREE.Shape(); s.moveTo(-W / 2, -D / 2); s.lineTo(W / 2, -D / 2); s.lineTo(W / 2, D / 2); s.lineTo(-W / 2, D / 2); s.closePath();
  const h = new THREE.Path(); h.moveTo(-w / 2, -d / 2); h.lineTo(-w / 2, d / 2); h.lineTo(w / 2, d / 2); h.lineTo(w / 2, -d / 2); h.closePath();
  s.holes.push(h); return s;
}
function flatShape(shape, mat, y, parent = scene) {
  const g = new THREE.ShapeGeometry(shape, 24); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.position.y = y; m.receiveShadow = true; parent.add(m); return m;
}

function buildYard() {
  const yard = new THREE.Group(); scene.add(yard);
  backdrop(T.yard, V(0, 0, 0), 46, .87, -17);
  // lawn
  const gm = M(0xffffff, .95, { map: T.grass });
  const lawnShape = shapeRectHole(60, 40, 9.2, 6.4);
  const lawn = flatShape(lawnShape, gm, -.02, yard);
  lawn.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = v / 3; });
  // deck pavers
  const dm = M(0xffffff, .8, { map: T.deck });
  const deck = flatShape(shapeRectHole(9.2, 6.4, POOL.w, POOL.d), dm, 0, yard);
  deck.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = v / 1.6; });
  // deck thickness edge
  const edgeM = M(0xd8cdb8, .9);
  for (const [w, d, x, z] of [[9.2, .1, 0, 3.2], [9.2, .1, 0, -3.2], [.1, 6.4, 4.6, 0], [.1, 6.4, -4.6, 0]]) mesh(new THREE.BoxGeometry(w, .06, d), edgeM, yard, x, -.01, z, false);
  // coping
  const cop = M(0xf4f1ea, .6);
  const cw = .22;
  for (const [w, d, x, z] of [[POOL.w + cw * 2, cw, 0, POOL.d / 2 + cw / 2], [POOL.w + cw * 2, cw, 0, -POOL.d / 2 - cw / 2], [cw, POOL.d, POOL.w / 2 + cw / 2, 0], [cw, POOL.d, -POOL.w / 2 - cw / 2, 0]]) {
    const m = mesh(new THREE.BoxGeometry(w, .07, d), cop, yard, x, .03, z); m.castShadow = false;
  }
  // basin
  const tm = M(0xffffff, .35, { map: texR('tile', 4, 2.4) });
  const floor = mesh(new THREE.PlaneGeometry(POOL.w, POOL.d), tm, yard, 0, -POOL.depth, 0, false); floor.rotation.x = -Math.PI / 2;
  const wallM = M(0xffffff, .35, { map: texR('tile', 4, .9) });
  const wallM2 = M(0xffffff, .35, { map: texR('tile', 2.3, .9) });
  const wz = mesh(new THREE.PlaneGeometry(POOL.w, POOL.depth), wallM, yard, 0, -POOL.depth / 2, -POOL.d / 2, false);
  const wz2 = mesh(new THREE.PlaneGeometry(POOL.w, POOL.depth), wallM, yard, 0, -POOL.depth / 2, POOL.d / 2, false); wz2.rotation.y = Math.PI;
  const wx = mesh(new THREE.PlaneGeometry(POOL.d, POOL.depth), wallM2, yard, -POOL.w / 2, -POOL.depth / 2, 0, false); wx.rotation.y = Math.PI / 2;
  const wx2 = mesh(new THREE.PlaneGeometry(POOL.d, POOL.depth), wallM2, yard, POOL.w / 2, -POOL.depth / 2, 0, false); wx2.rotation.y = -Math.PI / 2;
  // dark band at waterline
  const band = M(0x2b7fa0, .4);
  for (const [w, x, z, ry] of [[POOL.w, 0, -POOL.d / 2 + .002, 0], [POOL.w, 0, POOL.d / 2 - .002, Math.PI], [POOL.d, -POOL.w / 2 + .002, 0, Math.PI / 2], [POOL.d, POOL.w / 2 - .002, 0, -Math.PI / 2]]) {
    const m = mesh(new THREE.PlaneGeometry(w, .1), band, yard, x, -.07, z, false); m.rotation.y = ry;
  }
  // caustics
  const cm = new THREE.MeshBasicMaterial({ map: causticTex, transparent: true, opacity: .32, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xcff6ff });
  cm.map = causticTex.clone(); cm.map.repeat.set(2.6, 1.5); cm.map.needsUpdate = true;
  const cs = new THREE.Mesh(new THREE.PlaneGeometry(POOL.w, POOL.d), cm); cs.rotation.x = -Math.PI / 2; cs.position.y = -POOL.depth + .01; cs.renderOrder = 1; yard.add(cs);
  const cm2 = cm.clone(); cm2.map = causticTex.clone(); cm2.map.repeat.set(1.9, 1.1); cm2.map.needsUpdate = true; cm2.opacity = .22;
  const cs2 = cs.clone(); cs2.material = cm2; cs2.position.y += .01; yard.add(cs2);
  // water
  const wg = new THREE.PlaneGeometry(POOL.w, POOL.d, 48, 28); wg.rotateX(-Math.PI / 2);
  pool = new Water(wg, V(0, 0, 0), POOL.wy, AQUA.clone());
  pool.caustics = [cm.map, cm2.map];
  // ladder
  const steel = M(0xdfe6ea, .15, { metalness: 1 });
  for (const s of [-.22, .22]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(.32, .025, 8, 24, Math.PI), steel);
    r.position.set(2.0 + s, .0, -POOL.d / 2 + .05); r.rotation.y = Math.PI / 2; r.rotation.z = 0; yard.add(r);
    mesh(new THREE.CylinderGeometry(.025, .025, .9, 8), steel, yard, 2.0 + s, -.45, -POOL.d / 2 + .37);
  }
  // pots with hydrangeas
  for (const [x, z, c] of [[-4.2, -2.8, PINK], [4.2, -2.8, BLUE], [-4.2, 2.8, BLUE], [4.2, 2.8, PINK]]) {
    const pot = mesh(new THREE.CylinderGeometry(.32, .24, .5, 20), M(0xc8714a, .8), yard, x, .25, z);
    const bm = M(c, .8);
    for (let i = 0; i < 9; i++) mesh(new THREE.IcosahedronGeometry(rnd(.14, .2), 1), i % 3 ? bm : M(0x3d7a35, .8), yard, x + rnd(-.22, .22), .6 + rnd(0, .25), z + rnd(-.22, .22));
  }
  return yard;
}

// ---------------------------------------------------------------- props
function stripeTex(c1, c2, n = 8, vertical = false) {
  return canvasTex(256, 256, (x) => {
    for (let i = 0; i < n; i++) {
      x.fillStyle = i % 2 ? c2 : c1;
      if (vertical) x.fillRect(0, i * 256 / n, 256, 256 / n + 1); else x.fillRect(i * 256 / n, 0, 256 / n + 1, 256);
    }
  });
}
function makeChair() {
  const g = new THREE.Group();
  const frame = M(0xffffff, .3);
  const cushion = M(0xffffff, .7, { map: stripeTex('#ffffff', '#7cc4ff', 10, true) });
  mesh(new THREE.BoxGeometry(.7, .1, 1.3), cushion, g, 0, .38, .25);
  const back = mesh(new THREE.BoxGeometry(.7, .1, .75), cushion, g, 0, .62, -.62); back.rotation.x = .75;
  for (const [x, z] of [[-.32, .82], [.32, .82], [-.32, -.4], [.32, -.4]]) mesh(new THREE.CylinderGeometry(.03, .03, .34, 8), frame, g, x, .17, z);
  return g;
}
function makeBasket() {
  const g = new THREE.Group();
  const wm = M(0xd9b98a, .9, { map: canvasTex(128, 128, (x) => { x.fillStyle = '#d9b98a'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#a77d4a'; x.lineWidth = 6; for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16, 128); x.stroke(); x.beginPath(); x.moveTo(0, i * 16 + 4); x.lineTo(128, i * 16 + 4); x.stroke(); } }) });
  wm.map.wrapS = wm.map.wrapT = THREE.RepeatWrapping; wm.map.repeat.set(4, 1);
  wm.side = THREE.DoubleSide;
  mesh(new THREE.CylinderGeometry(.42, .34, .42, 28, 1, true), wm, g, 0, .21, 0);
  mesh(new THREE.CircleGeometry(.34, 24).rotateX(-Math.PI / 2), wm, g, 0, .01, 0);
  mesh(new THREE.TorusGeometry(.42, .03, 8, 32).rotateX(Math.PI / 2), M(0xb8925c, .8), g, 0, .42, 0);
  return g;
}

// picture sign (no words): drawn with simple shapes
function makeSign(draw) {
  const g = new THREE.Group();
  const wood = M(0x9a6a3e, .8);
  mesh(new THREE.CylinderGeometry(.04, .04, 1.1, 8), wood, g, 0, .55, 0);
  const t = canvasTex(512, 384, (x) => {
    x.fillStyle = '#fffaf0'; x.fillRect(0, 0, 512, 384);
    x.strokeStyle = '#9a6a3e'; x.lineWidth = 18; x.strokeRect(9, 9, 494, 366);
    draw(x);
  });
  const board = mesh(new THREE.BoxGeometry(1.0, .75, .05), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: t, roughness: .7 }), wood], g, 0, 1.3, 0);
  g.board = board; g.setDraw = (d) => {
    const c = t.image, x = c.getContext('2d');
    x.fillStyle = '#fffaf0'; x.fillRect(0, 0, 512, 384); x.strokeStyle = '#9a6a3e'; x.lineWidth = 18; x.strokeRect(9, 9, 494, 366);
    d(x); t.needsUpdate = true;
  };
  return g;
}
function drawBall(x, cx, cy, r, col) {
  const g = x.createRadialGradient(cx - r * .35, cy - r * .35, r * .1, cx, cy, r);
  g.addColorStop(0, '#fff'); g.addColorStop(.3, col); g.addColorStop(1, col);
  x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
}
function drawArrow(x, x0, y0, x1, y1, col = '#ff9f1c') {
  x.strokeStyle = col; x.lineWidth = 14; x.lineCap = 'round';
  x.beginPath(); x.moveTo(x0, y0); x.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - 60, x1, y1); x.stroke();
  const a = Math.atan2(y1 - (Math.min(y0, y1) - 60), x1 - (x0 + x1) / 2);
  x.fillStyle = col; x.beginPath(); x.moveTo(x1 + Math.cos(a) * 22, y1 + Math.sin(a) * 22);
  x.lineTo(x1 + Math.cos(a + 2.3) * 28, y1 + Math.sin(a + 2.3) * 28); x.lineTo(x1 + Math.cos(a - 2.3) * 28, y1 + Math.sin(a - 2.3) * 28); x.fill();
}
function drawPoolRect(x, X, Y, W, H) {
  x.fillStyle = '#e9dcc4'; x.fillRect(X - 14, Y - 14, W + 28, H + 28);
  x.fillStyle = '#5fd3e6'; x.fillRect(X, Y, W, H);
}
function drawSmile(x, cx, cy, r, cap) {
  x.fillStyle = '#ffd9bf'; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
  if (cap) { x.fillStyle = cap; x.beginPath(); x.arc(cx, cy, r * 1.04, Math.PI * 1.05, Math.PI * 1.95); x.fill(); }
  x.strokeStyle = '#3a2416'; x.lineWidth = r * .12; x.lineCap = 'round';
  x.beginPath(); x.arc(cx - r * .35, cy, r * .14, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
  x.beginPath(); x.arc(cx + r * .35, cy, r * .14, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
  x.fillStyle = '#b8343f'; x.beginPath(); x.arc(cx, cy + r * .28, r * .3, 0, Math.PI); x.fill();
}

// ---------------------------------------------------------------- faces
const FACE = {};
function faceTex(kind) {
  return canvasTex(256, 256, (x) => {
    x.lineCap = 'round'; x.lineJoin = 'round';
    const E = [[94, 120], [162, 120]], dark = '#2a1a12';
    // blush
    for (const [cx] of E) { const g = x.createRadialGradient(cx + (cx < 128 ? -14 : 14), 160, 2, cx + (cx < 128 ? -14 : 14), 160, 22); g.addColorStop(0, 'rgba(255,110,140,.45)'); g.addColorStop(1, 'rgba(255,110,140,0)'); x.fillStyle = g; x.fillRect(cx - 50, 130, 100, 60); }
    const eyeOpen = (s = 1, hl = true) => {
      for (const [cx, cy] of E) {
        x.fillStyle = dark; x.beginPath(); x.ellipse(cx, cy, 13 * s, 18 * s, 0, 0, TAU); x.fill();
        if (hl) { x.fillStyle = '#fff'; x.beginPath(); x.arc(cx - 4 * s, cy - 7 * s, 5.5 * s, 0, TAU); x.fill(); x.beginPath(); x.arc(cx + 4 * s, cy + 5 * s, 2 * s, 0, TAU); x.fill(); }
      }
    };
    const brows = (dy = 0, tilt = 0) => {
      x.strokeStyle = '#5b3a22'; x.lineWidth = 5;
      for (const [cx, cy] of E) { x.beginPath(); x.moveTo(cx - 12, cy - 28 + dy); x.quadraticCurveTo(cx, cy - 35 + dy, cx + 12, cy - 28 + dy); x.stroke(); }
    };
    const mouthSmile = (w = 16) => { x.strokeStyle = '#7a2a2a'; x.lineWidth = 5; x.beginPath(); x.arc(128, 160, w, Math.PI * .2, Math.PI * .8); x.stroke(); };
    const mouthOpen = (w = 22, h = 24) => {
      x.fillStyle = '#7d2330'; x.beginPath(); x.moveTo(128 - w, 166); x.quadraticCurveTo(128, 166 - 4, 128 + w, 166); x.quadraticCurveTo(128 + w * .8, 166 + h, 128, 166 + h); x.quadraticCurveTo(128 - w * .8, 166 + h, 128 - w, 166); x.fill();
      x.fillStyle = '#ff8a9a'; x.beginPath(); x.ellipse(128, 166 + h * .72, w * .5, h * .25, 0, 0, TAU); x.fill();
      x.fillStyle = '#fff'; x.fillRect(128 - w * .6, 166, w * 1.2, 4);
    };
    const arcs = (down) => { x.strokeStyle = dark; x.lineWidth = 6; for (const [cx, cy] of E) { x.beginPath(); if (down) x.arc(cx, cy - 6, 11, Math.PI * .15, Math.PI * .85); else x.arc(cx, cy + 6, 11, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); } };
    switch (kind) {
      case 'normal': eyeOpen(); brows(); mouthSmile(); break;
      case 'blink': arcs(true); brows(); mouthSmile(); break;
      case 'happy': arcs(false); brows(-3); mouthOpen(); break;
      case 'wow': eyeOpen(1.15); brows(-8); mouthOpen(16, 28); break;
      case 'surprised': eyeOpen(1.2); brows(-10, 0);
        x.fillStyle = '#7d2330'; x.beginPath(); x.ellipse(128, 172, 8, 10, 0, 0, TAU); x.fill(); break;
      case 'sad': eyeOpen(.95);
        x.strokeStyle = '#5b3a22'; x.lineWidth = 5;
        x.beginPath(); x.moveTo(80, 96); x.lineTo(104, 88); x.stroke(); x.beginPath(); x.moveTo(176, 96); x.lineTo(152, 88); x.stroke();
        x.strokeStyle = '#7a2a2a'; x.beginPath(); x.arc(128, 182, 14, Math.PI * 1.2, Math.PI * 1.8); x.stroke(); break;
      case 'sleep': arcs(true); x.fillStyle = '#7d2330'; x.beginPath(); x.ellipse(128, 168, 5, 6, 0, 0, TAU); x.fill(); break;
    }
    // nose
    x.strokeStyle = 'rgba(120,60,40,.35)'; x.lineWidth = 3; x.beginPath(); x.arc(128, 142, 5, Math.PI * .2, Math.PI * .8); x.stroke();
  });
}
for (const k of ['normal', 'blink', 'happy', 'wow', 'surprised', 'sad', 'sleep']) FACE[k] = faceTex(k);

// sweat drop sprite for the "huh?" moment
const dropSpriteTex = canvasTex(64, 96, (x) => {
  x.fillStyle = '#8fd8ff'; x.strokeStyle = '#2f7fb8'; x.lineWidth = 4;
  x.beginPath(); x.moveTo(32, 6); x.quadraticCurveTo(60, 56, 46, 78); x.arc(32, 66, 20, .55, Math.PI - .55); x.quadraticCurveTo(4, 56, 32, 6); x.fill(); x.stroke();
  x.fillStyle = '#fff'; x.beginPath(); x.ellipse(24, 60, 5, 9, -.3, 0, TAU); x.fill();
});

// ---------------------------------------------------------------- people
const SKIN = { girl: 0xf5cba7, boy: 0xf0c29c, papa: 0xe8b48e, mom: 0xf7d0b0 };
function makePerson(o) {
  const P = { kind: o.kind, voice: o.kind, mood: 'normal', face: 'normal', faceT: 0, blinkT: rnd(1, 3), hopT: 1, pose: 'idle', poseT: 0, tilt: 0, walking: false };
  const g = new THREE.Group(); P.g = g;
  const body = new THREE.Group(); g.add(body); P.body = body;
  const skin = M(SKIN[o.kind], .55);
  const topM = PM(o.top, { roughness: .45, clearcoat: .3 }); P.topM = topM;
  const botM = M(o.bottom, .6); P.botM = botM;
  const hairM = M(o.hair, .45);
  const { legL, legR, tR, tL, headR, armR } = o;
  P.legL = legL; P.headR = headR;
  // legs
  P.legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * tR * .45, legL, 0); body.add(hip);
    mesh(new THREE.CapsuleGeometry(legR, legL - legR * 2, 4, 10), skin, hip, 0, -legL / 2, 0);
    const foot = mesh(new THREE.SphereGeometry(legR * 1.15, 12, 8), skin, hip, 0, -legL + legR * .45, legR * .6); foot.scale.set(1, .55, 1.6);
    P.legs.push(hip);
  }
  const hips = mesh(new THREE.CylinderGeometry(tR * .96, tR * 1.02, o.shortsL, 18), botM, body, 0, legL - o.shortsL / 2 + .06, 0); hips.scale.z = .8;
  const cy = legL + .6 * tR + tL / 2;
  const torso = mesh(new THREE.CapsuleGeometry(tR, tL, 6, 18), topM, body, 0, cy, 0); torso.scale.z = .8;
  if (o.skirt) { const sk = mesh(new THREE.CylinderGeometry(tR * .9, tR * 1.45, .12, 20, 1, true), topM, body, 0, legL + .02, 0); sk.scale.z = .85; sk.material = topM; }
  const top = cy + tL / 2 + tR;
  const shoulderY = top - tR * .55;
  P.top = top;
  // arms
  P.arms = [];
  const armL = o.armL;
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * (tR + armR * .7), shoulderY, 0); body.add(piv);
    mesh(new THREE.CapsuleGeometry(armR, armL - armR * 2, 4, 10), o.sleeves ? topM : skin, piv, 0, -armL / 2, 0);
    const hand = mesh(new THREE.SphereGeometry(armR * 1.25, 12, 10), skin, piv, 0, -armL, 0);
    piv.hand = hand; piv.s = s; piv.cur = { x: 0, z: s * .12 };
    mesh(new THREE.SphereGeometry(armR * 1.25, 12, 10), o.sleeves ? topM : skin, piv, 0, -armR * .2, 0);
    P.arms.push(piv);
  }
  // head
  const head = new THREE.Group(); head.position.set(0, top + headR * .82, 0); body.add(head); P.head = head;
  mesh(new THREE.CylinderGeometry(headR * .33, headR * .38, headR * .6, 12), skin, body, 0, top + headR * .05, 0);
  mesh(new THREE.SphereGeometry(headR, 32, 20), skin, head);
  const faceMat = new THREE.MeshStandardMaterial({ map: FACE.normal, transparent: true, roughness: .55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const face = mesh(new THREE.SphereGeometry(headR * 1.004, 32, 16, Math.PI / 2 - 1, 2, .85, 1.4), faceMat, head, 0, 0, 0, false);
  face.renderOrder = 2; P.faceMesh = face;
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(headR * .2, 10, 8), skin, head, s * headR * .97, -headR * .05, -headR * .05).scale.set(.6, 1, .8);
  // hair
  const cap = mesh(new THREE.SphereGeometry(headR * 1.07, 32, 16, 0, TAU, 0, o.hairCap || 1.2), hairM, head); cap.rotation.x = -.32;
  const backH = mesh(new THREE.SphereGeometry(headR * 1.06, 24, 16, Math.PI, Math.PI, 0, o.hairBack || 2.0), hairM, head); backH.rotation.x = -.05;
  P.hairCap = cap;
  if (o.kind === 'girl') {
    for (const s of [-1, 1]) {
      const pt = new THREE.Group(); pt.position.set(s * headR * .9, headR * .25, -headR * .35); head.add(pt);
      const tail = mesh(new THREE.CapsuleGeometry(headR * .26, headR * .9, 4, 10), hairM, pt, s * headR * .3, -headR * .45, 0); tail.rotation.z = s * .5;
      mesh(new THREE.SphereGeometry(headR * .14, 10, 8), M(0xffffff, .4), pt, 0, 0, 0);
      P.tails = P.tails || []; P.tails.push(pt);
    }
  }
  if (o.kind === 'mom') {
    mesh(new THREE.SphereGeometry(headR * .45, 16, 12), hairM, head, 0, headR * .5, -headR * .85);
    const hat = new THREE.Group(); hat.position.y = headR * .62; hat.rotation.x = -.12; head.add(hat);
    const straw = M(0xf0dca8, .85);
    mesh(new THREE.CylinderGeometry(headR * 2.2, headR * 2.2, .015, 32), straw, hat);
    mesh(new THREE.SphereGeometry(headR * 1.05, 24, 12, 0, TAU, 0, Math.PI / 2), straw, hat, 0, -.02, 0);
    mesh(new THREE.CylinderGeometry(headR * 1.06, headR * 1.06, headR * .22, 24, 1, true), M(PINK, .5), hat, 0, headR * .06, 0);
  }
  if (o.kind === 'papa') {
    // sunglasses resting on hair
    const sg = M(0x222222, .2);
    for (const s of [-1, 1]) { const l = mesh(new THREE.CylinderGeometry(headR * .24, headR * .24, .02, 16), sg, head, s * headR * .34, headR * .78, headR * .5); l.rotation.x = 1.1; }
  }
  // swim cap (girl/boy) hidden until worn
  if (o.kind === 'girl' || o.kind === 'boy') {
    const scM = PM(0xffffff);
    const sc = mesh(new THREE.SphereGeometry(headR * 1.12, 32, 16, 0, TAU, 0, 1.35), scM, head); sc.rotation.x = -.28; sc.visible = false;
    const gl = M(0xffffff, .2);
    const lensM = new THREE.MeshPhysicalMaterial({ color: 0x9fe6ff, roughness: .05, transmission: .2, transparent: true, opacity: .7 });
    const gog = new THREE.Group(); sc.add(gog);
    for (const s of [-1, 1]) {
      const r = mesh(new THREE.TorusGeometry(headR * .2, headR * .05, 8, 20), gl, gog, s * headR * .34, headR * .62, headR * .9);
      r.rotation.x = -.75;
      const l = mesh(new THREE.CircleGeometry(headR * .19, 20), lensM, gog, s * headR * .34, headR * .62, headR * .9); l.rotation.x = -.75;
    }
    P.swimCap = sc; P.swimCapM = scM; P.gogM = gl;
  }
  g.traverse(m => { if (m.isMesh && m !== face) { m.castShadow = true; } });
  // float slot (waist)
  P.waistY = legL + .08;
  P.setFace = (k, dur = 0) => { P.face = k; P.faceT = dur; faceMat.map = FACE[k]; faceMat.needsUpdate = true; };
  P.setMood = (k) => { P.mood = k; if (P.faceT <= 0) P.setFace(k); };
  P.hop = (h = .22) => { P.hopT = 0; P.hopH = h; };
  P.react = (kind) => react(P, kind);
  P.handWorld = (i = 1) => P.arms[i].hand.getWorldPosition(V());
  P.lookAt = (x, z) => { P.faceDir = Math.atan2(x - g.position.x, z - g.position.z); };
  P.faceDir = 0;
  P.update = (dt, t) => {
    // face timing
    if (P.faceT > 0) { P.faceT -= dt; if (P.faceT <= 0) P.setFace(P.mood); }
    P.blinkT -= dt;
    if (P.blinkT < 0 && P.face === 'normal') { faceMat.map = FACE.blink; faceMat.needsUpdate = true; if (P.blinkT < -.12) { faceMat.map = FACE[P.face]; faceMat.needsUpdate = true; P.blinkT = rnd(2, 4.5); } }
    else if (P.blinkT < -.2) P.blinkT = rnd(2, 4);
    // hop
    if (P.hopT < 1) { P.hopT = Math.min(1, P.hopT + dt / .45); body.position.y = Math.sin(Math.PI * P.hopT) * P.hopH; }
    else body.position.y = Math.sin(t * 2.2 + o.legL * 10) * .006;
    // facing
    let d = P.faceDir - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g.rotation.y += d * Math.min(1, dt * 7);
    // head tilt
    head.rotation.z = lerp(head.rotation.z, P.tilt, Math.min(1, dt * 8));
    head.rotation.x = lerp(head.rotation.x, P.nod || 0, Math.min(1, dt * 8));
    // arms
    P.poseT += dt;
    const pose = POSES[P.pose] || POSES.idle;
    for (const a of P.arms) {
      const tg = pose(a.s, t, P.poseT, P);
      a.cur.x = lerp(a.cur.x, tg.x, Math.min(1, dt * (tg.k || 12)));
      a.cur.z = lerp(a.cur.z, tg.z, Math.min(1, dt * (tg.k || 12)));
      a.rotation.x = a.cur.x; a.rotation.z = a.cur.z;
    }
    // legs
    const sitting = P.sitting;
    P.legs.forEach((l, i) => {
      const tx = sitting ? -1.25 + Math.sin(t * 3 + i * 2) * .15 : P.walking ? Math.sin(t * 11 + i * Math.PI) * .5 : 0;
      l.rotation.x = lerp(l.rotation.x, tx, Math.min(1, dt * 10));
    });
    if (P.tails) P.tails.forEach((pt, i) => { pt.rotation.z = Math.sin(t * 3 + i) * .08 + (P.hopT < 1 ? Math.sin(P.hopT * Math.PI) * .3 * (i ? 1 : -1) : 0); });
  };
  return P;
}
// arm poses: x forward(-)/back(+), z outward = s*angle
const POSES = {
  idle: (s, t) => ({ x: Math.sin(t * 1.4 + s) * .05, z: s * .14 }),
  throw: (s, t, k) => s > 0 ? (k < .14 ? { x: .9, z: s * .2, k: 25 } : { x: -2.3, z: s * .15, k: 22 }) : { x: -.4, z: s * .3 },
  cheer: (s, t) => ({ x: -.3, z: s * (2.6 + Math.sin(t * 12 + s) * .25) }),
  hold: (s) => ({ x: -2.75, z: s * .32 }),
  clap: (s, t) => ({ x: -1.35, z: s * (-.32 + Math.abs(Math.sin(t * 9)) * .32), k: 20 }),
  point: (s) => s > 0 ? { x: -1.55, z: s * .1 } : { x: 0, z: s * .14 },
  flail: (s, t) => ({ x: Math.sin(t * 9 + s) * .4 - .4, z: s * (1.9 + Math.sin(t * 10 + s * 2) * .6) }),
  float: (s, t) => ({ x: -.25, z: s * (1.15 + Math.sin(t * 2 + s) * .08) }),
  reach: (s) => ({ x: -1.6, z: s * .25 }),
  hug: (s) => ({ x: -1.2, z: s * -.55 }),
  wave: (s, t) => s > 0 ? { x: -.2, z: s * (2.5 + Math.sin(t * 10) * .35) } : { x: 0, z: s * .14 },
};
function setPose(P, pose, dur = 0, back = 'idle') {
  P.pose = pose; P.poseT = 0;
  if (dur) { const tok = (P.poseTok = (P.poseTok || 0) + 1); wait(dur).then(() => { if (P.poseTok === tok) { P.pose = P.basePose || back; P.poseT = 0; } }); }
}
const huhSprites = [];
function react(C, kind) {
  if (kind === 'happy') {
    if (C.setFace) C.setFace('happy', 1.6); C.hop(); if (C.arms) setPose(C, 'cheer', 1.2); say(C.voice, 'yay');
  } else if (kind === 'wow') {
    if (C.setFace) C.setFace('wow', 1.4); C.hop(.3); if (C.arms) setPose(C, 'cheer', 1.4); say(C.voice, 'wow');
  } else if (kind === 'huh') {
    if (C.setFace) C.setFace('surprised', 1.1); C.tilt = .32; say(C.voice, 'huh');
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dropSpriteTex, depthTest: false }));
    sp.scale.set(.13, .2, 1); sp.renderOrder = 20;
    const hp = (C.head || C.g).getWorldPosition(V()); sp.position.copy(hp).add(V(.2, .15, .1));
    scene.add(sp);
    tween(1, k => { sp.position.y = hp.y + .15 - k * .12; sp.material.opacity = 1 - k * k; }, () => scene.remove(sp));
    wait(1.0).then(() => { C.tilt = 0; });
  } else if (kind === 'laugh') {
    if (C.setFace) C.setFace('happy', 1.4); C.hop(.12); say(C.voice, 'laugh');
  } else if (kind === 'sad') {
    if (C.setFace) C.setFace('sad', 1.5); say(C.voice, 'uh');
  }
}

// ---------------------------------------------------------------- animals
function eye(parent, x, y, z, r) {
  const e = mesh(new THREE.SphereGeometry(r, 16, 12), PM(0x0d0d10, { roughness: .1 }), parent, x, y, z, false);
  mesh(new THREE.SphereGeometry(r * .32, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), e, r * .25, r * .45, r * .7, false);
  return e;
}
function vcolorize(geo, belly, back, axis = 'y', lo = -.05, hi = .12) {
  const p = geo.attributes.position, c = new Float32Array(p.count * 3), a = new THREE.Color(belly), b = new THREE.Color(back);
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < p.count; i++) { const v = axis === 'y' ? p.getY(i) : p.getZ(i); mn = Math.min(mn, v); mx = Math.max(mx, v); }
  for (let i = 0; i < p.count; i++) {
    const v = ((axis === 'y' ? p.getY(i) : p.getZ(i)) - mn) / (mx - mn) - .5;
    const k = clamp((v - lo) / (hi - lo), 0, 1), cc = a.clone().lerp(b, k * k * (3 - 2 * k));
    c[i * 3] = cc.r; c[i * 3 + 1] = cc.g; c[i * 3 + 2] = cc.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
}
function makeAnimalBase(kind, toyColor) {
  const A = { kind, real: false, g: new THREE.Group(), body: new THREE.Group(), parts: [], hopT: 1, hopH: .2, tilt: 0, voice: kind };
  A.g.add(A.body);
  A.toyM = PM(toyColor, { roughness: .2 });
  A.hop = (h = .2) => { A.hopT = 0; A.hopH = h; };
  A.react = (k) => animalReact(A, k);
  A.reg = (m, realMat) => { A.parts.push({ m, real: realMat }); m.material = A.toyM; return m; };
  A.setReal = (r) => { A.real = r; for (const p of A.parts) p.m.material = r ? p.real : A.toyM; };
  A.baseUpdate = (dt) => {
    if (A.hopT < 1) { A.hopT = Math.min(1, A.hopT + dt / .5); A.body.position.y = Math.sin(Math.PI * A.hopT) * A.hopH; }
    else A.body.position.y = 0;
    A.body.rotation.z = lerp(A.body.rotation.z, A.tilt, Math.min(1, dt * 8));
  };
  return A;
}
function animalReact(A, k) {
  if (k === 'happy' || k === 'wow' || k === 'laugh') { A.hop(.3); animalVoice(A.kind); if (A.eyes) A.eyes.forEach(e => e.scale.setScalar(1.25)); wait(.6).then(() => A.eyes && A.eyes.forEach(e => e.scale.setScalar(1))); }
  if (k === 'huh') {
    A.tilt = .35; animalVoice(A.kind, true); if (A.eyes) A.eyes.forEach(e => e.scale.setScalar(1.4));
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dropSpriteTex, depthTest: false })); sp.scale.set(.12, .18, 1); sp.renderOrder = 20;
    const hp = (A.headNode || A.body).getWorldPosition(V()); sp.position.copy(hp).add(V(.18, .25, .1)); scene.add(sp);
    tween(1, kk => { sp.position.y = hp.y + .25 - kk * .12; sp.material.opacity = 1 - kk * kk; }, () => scene.remove(sp));
    wait(1).then(() => { A.tilt = 0; if (A.eyes) A.eyes.forEach(e => e.scale.setScalar(1)); });
  }
}
function animalVoice(kind, q) {
  if (kind === 'dolphin') sfx.click();
  else if (kind === 'seal') { Snd.voice(260, q ? 420 : 200, .22, 'a', { vol: .14 }); Snd.voice(250, q ? 480 : 190, .22, 'a', { vol: .14, delay: .26 }); }
  else if (kind === 'crab') { sfx.snap(); if (q) Snd.tone(600, .25, { vol: .1, to: 1100 }); }
  else if (kind === 'octopus') { Snd.tone(300, .2, { vol: .15, to: q ? 700 : 520 }); Snd.tone(520, .15, { vol: .1, to: 300, delay: .2 }); }
}

function makeDolphin() {
  const A = makeAnimalBase('dolphin', 0x4fc3ff);
  const prof = [[0, -.78], [.05, -.7], [.09, -.52], [.16, -.25], [.21, 0], [.22, .2], [.19, .36], [.13, .47], [.08, .53], [.065, .63], [.035, .7], [0, .72]].map(([r, y]) => new THREE.Vector2(r, y));
  const bg = new THREE.LatheGeometry(prof, 28); bg.rotateX(Math.PI / 2); bg.rotateZ(0);
  // lathe rotated: +y -> +z ... we want nose forward (+z): after rotateX(+90deg) y->z, fine
  vcolorize(bg, 0xe9eef2, 0x5f7486, 'y', -.15, .1);
  const realM = M(0xffffff, .3, { vertexColors: true, roughness: .25 });
  const finM = M(0x5a6f80, .35);
  A.reg(mesh(bg, null, A.body), realM);
  const finShape = new THREE.Shape(); finShape.moveTo(0, 0); finShape.quadraticCurveTo(.02, .2, -.14, .24); finShape.quadraticCurveTo(-.08, .1, -.2, 0); finShape.closePath();
  const fin = new THREE.ExtrudeGeometry(finShape, { depth: .025, bevelEnabled: true, bevelThickness: .01, bevelSize: .01, bevelSegments: 2 });
  fin.translate(0, 0, -.0125); fin.rotateY(-Math.PI / 2);
  A.reg(mesh(fin, null, A.body, 0, .19, .0), finM);
  const tail = new THREE.Group(); tail.position.z = -.72; A.body.add(tail); A.tail = tail;
  const fl = new THREE.Shape(); fl.moveTo(0, 0); fl.quadraticCurveTo(.12, -.04, .22, -.16); fl.quadraticCurveTo(.1, -.12, 0, -.08); fl.quadraticCurveTo(-.1, -.12, -.22, -.16); fl.quadraticCurveTo(-.12, -.04, 0, 0);
  const flg = new THREE.ExtrudeGeometry(fl, { depth: .02, bevelEnabled: true, bevelThickness: .01, bevelSize: .01, bevelSegments: 2 }); flg.rotateX(Math.PI / 2); flg.translate(0, .01, 0);
  A.reg(mesh(flg, null, tail, 0, 0, .02), finM);
  for (const s of [-1, 1]) { const f = A.reg(mesh(new THREE.SphereGeometry(.1, 12, 8), null, A.body, s * .19, -.08, .18), finM); f.scale.set(.25, .12, 1); f.rotation.y = s * .5; f.rotation.z = s * -.5; }
  A.eyes = [eye(A.body, -.135, .05, .4, .028), eye(A.body, .135, .05, .4, .028)];
  A.realScale = 1; A.toyScale = .32;
  A.update = (dt, t) => { A.baseUpdate(dt); tail.rotation.x = Math.sin(t * (A.real ? 6 : 0)) * .25; };
  return A;
}
function makeCrab() {
  const A = makeAnimalBase('crab', 0xff8a1f);
  const shell = M(0xe0482a, .45);
  const leg = M(0xd14a2c, .5);
  const b = A.reg(mesh(new THREE.SphereGeometry(.22, 24, 16), null, A.body, 0, .16, 0), shell); b.scale.set(1.15, .55, .85);
  A.eyes = [];
  for (const s of [-1, 1]) {
    A.reg(mesh(new THREE.CylinderGeometry(.018, .02, .12, 8), null, A.body, s * .07, .3, .1), leg);
    const e = mesh(new THREE.SphereGeometry(.045, 14, 10), M(0xffffff, .2), A.body, s * .07, .37, .11, false);
    eye(e, 0, 0, .03, .028); A.eyes.push(e);
    // claws
    const arm = new THREE.Group(); arm.position.set(s * .24, .17, .12); A.body.add(arm); A['claw' + s] = arm;
    A.reg(mesh(new THREE.CylinderGeometry(.025, .03, .16, 8), null, arm, s * .05, .02, .04), leg).rotation.set(.8, 0, s * -.9);
    const pin = A.reg(mesh(new THREE.SphereGeometry(.085, 16, 12), null, arm, s * .1, .09, .1), shell); pin.scale.set(.8, 1, .7);
    A.reg(mesh(new THREE.ConeGeometry(.035, .1, 10), null, arm, s * .1, .19, .12), shell).rotation.x = .3;
    // legs
    for (let i = 0; i < 3; i++) {
      const lg = A.reg(mesh(new THREE.CylinderGeometry(.016, .012, .22, 6), null, A.body, s * .27, .08, -.08 + i * -.06 + .06), leg);
      lg.rotation.z = s * 1.0; lg.rotation.y = (i - 1) * .3 * s;
    }
  }
  // smile
  A.reg(mesh(new THREE.TorusGeometry(.04, .008, 6, 12, Math.PI), null, A.body, 0, .17, .19), M(0x5a1a10, .5)).rotation.z = Math.PI;
  A.realScale = 1; A.toyScale = .45;
  A.update = (dt, t) => {
    A.baseUpdate(dt);
    const sn = A.snapT > 0 ? Math.abs(Math.sin(t * 20)) * .4 : Math.sin(t * 2) * .05;
    if (A.snapT > 0) A.snapT -= dt;
    A['claw-1'].rotation.z = -sn; A['claw1'].rotation.z = sn;
  };
  return A;
}
const spotTex = canvasTex(256, 128, (x) => {
  x.fillStyle = '#8d9aa3'; x.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(60,70,80,${rnd(.15, .4)})`; x.beginPath(); x.ellipse(rnd(0, 256), rnd(0, 128), rnd(2, 6), rnd(2, 5), rnd(0, 3), 0, TAU); x.fill(); }
});
function makeSeal() {
  const A = makeAnimalBase('seal', 0xb8c4cf);
  const prof = [[0, -.55], [.08, -.5], [.15, -.35], [.22, -.1], [.25, .1], [.22, .28], [.16, .38], [.0, .42]].map(([r, y]) => new THREE.Vector2(r, y));
  const bg = new THREE.LatheGeometry(prof, 28); bg.rotateX(Math.PI / 2);
  const realM = M(0xffffff, .35, { map: spotTex });
  A.reg(mesh(bg, null, A.body, 0, .22, 0), realM);
  const head = new THREE.Group(); head.position.set(0, .36, .38); A.body.add(head); A.headNode = head;
  A.reg(mesh(new THREE.SphereGeometry(.17, 24, 16), null, head), realM);
  const snout = A.reg(mesh(new THREE.SphereGeometry(.09, 16, 12), null, head, 0, -.04, .13), M(0xc3ccd3, .4)); snout.scale.set(1.2, .8, .9);
  mesh(new THREE.SphereGeometry(.025, 10, 8), PM(0x1a1a1a), head, 0, 0, .21);
  A.eyes = [eye(head, -.07, .05, .13, .035), eye(head, .07, .05, .13, .035)];
  const wh = new THREE.MeshBasicMaterial({ color: 0xf5f5f5 });
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const w = mesh(new THREE.CylinderGeometry(.003, .003, .14, 4), wh, head, s * .1, -.04 + i * .02, .16, false); w.rotation.z = s * (Math.PI / 2 + (i - 1) * .2); }
  const flM = M(0x6c7a86, .5);
  A.flips = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Group(); f.position.set(s * .2, .12, .18); A.body.add(f); A.flips.push(f);
    const fm = A.reg(mesh(new THREE.SphereGeometry(.09, 12, 8), null, f, s * .06, -.03, 0), flM); fm.scale.set(.5, .2, 1);
    const rf = A.reg(mesh(new THREE.SphereGeometry(.09, 12, 8), null, A.body, s * .07, .2, -.6), flM); rf.scale.set(.6, .2, 1.1); rf.rotation.y = s * .4;
  }
  A.realScale = 1.25; A.toyScale = .4;
  A.sleep = false;
  A.update = (dt, t) => {
    A.baseUpdate(dt);
    if (A.sleep) { A.eyes.forEach(e => e.scale.y = .12); head.rotation.x = .25 + Math.sin(t * 1.5) * .03; A.body.scale.y = 1 + Math.sin(t * 1.5) * .03; }
    else { head.rotation.x = 0; A.body.scale.y = 1; }
    if (A.clapT > 0) { A.clapT -= dt; A.flips.forEach((f, i) => f.rotation.z = (i ? 1 : -1) * Math.abs(Math.sin(t * 14)) * .9); }
    else A.flips.forEach(f => f.rotation.z = 0);
  };
  return A;
}
function makeOctopus() {
  const A = makeAnimalBase('octopus', 0xff6ad5);
  const realM = M(0xf07a63, .4);
  const under = M(0xffc8b0, .5);
  const head = A.reg(mesh(new THREE.SphereGeometry(.2, 28, 20), null, A.body, 0, .3, 0), realM); head.scale.set(1, 1.15, 1);
  A.headNode = head;
  A.eyes = [];
  for (const s of [-1, 1]) {
    const w = mesh(new THREE.SphereGeometry(.055, 14, 10), M(0xffffff, .2), A.body, s * .075, .28, .16, false);
    eye(w, 0, 0, .03, .035); A.eyes.push(w);
  }
  A.reg(mesh(new THREE.TorusGeometry(.035, .01, 6, 12, Math.PI), null, A.body, 0, .21, .18), M(0x7a2a2a, .5)).rotation.z = Math.PI;
  A.tents = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    let parent = new THREE.Group(); parent.position.set(Math.sin(a) * .13, .15, Math.cos(a) * .13); parent.rotation.y = a; A.body.add(parent);
    const chain = [];
    for (let j = 0; j < 5; j++) {
      const seg = new THREE.Group(); if (j) seg.position.z = .07; parent.add(seg);
      const r = .045 * (1 - j * .15);
      A.reg(mesh(new THREE.SphereGeometry(r, 10, 8), null, seg, 0, 0, .035), j % 2 ? under : realM).scale.set(1, .8, 1.3);
      chain.push(seg); parent = seg;
    }
    A.tents.push(chain);
  }
  A.realScale = 1.2; A.toyScale = .42;
  A.update = (dt, t) => {
    A.baseUpdate(dt);
    const sp = A.real ? 1 : 0;
    A.tents.forEach((ch, i) => ch.forEach((s, j) => { s.rotation.x = .35 + Math.sin(t * 3 * sp + i * .8 + j * .6) * .25 * sp; }));
    A.body.rotation.y += (A.spinT > 0 ? dt * 10 : 0); if (A.spinT > 0) A.spinT -= dt;
  };
  return A;
}

// ---------------------------------------------------------------- balls & floats
const ballGeo = new THREE.SphereGeometry(.2, 24, 16);
const BALLM = { pink: PM(PINK, { roughness: .22 }), blue: PM(BLUE, { roughness: .22 }) };
function makeBall(col) { const m = mesh(ballGeo, BALLM[col], scene); m.castShadow = true; return m; }

function floatTex(kind) {
  if (kind === 'stripe') return stripeTex(PINK_S, BLUE_S, 8);
  if (kind === 'tiny') return canvasTex(256, 128, (x) => { x.fillStyle = '#ffb3d5'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#fff'; for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(i * 16 + (j % 2) * 8, j * 32 + 16, 5, 0, TAU); x.fill(); } });
  return null;
}
function starShape(R, r, n = 5) { const s = new THREE.Shape(); for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU + Math.PI / 2, rr = i % 2 ? r : R; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (i) s.lineTo(x, y); else s.moveTo(x, y); } s.closePath(); return s; }
function heartPath(p, s) {
  p.moveTo(0, -.9 * s); p.bezierCurveTo(-.25 * s, -.55 * s, -1 * s, -.2 * s, -1 * s, .3 * s); p.bezierCurveTo(-1 * s, .85 * s, -.3 * s, 1 * s, 0, .55 * s);
  p.bezierCurveTo(.3 * s, 1 * s, 1 * s, .85 * s, 1 * s, .3 * s); p.bezierCurveTo(1 * s, -.2 * s, .25 * s, -.55 * s, 0, -.9 * s); return p;
}
function makeFloat(kind, playerCol, otherCol) {
  const g = new THREE.Group(); g.kind = kind;
  let geo, mat;
  const ex = { depth: .1, bevelEnabled: true, bevelThickness: .07, bevelSize: .07, bevelSegments: 5, curveSegments: 24 };
  if (kind === 'mine' || kind === 'boys' || kind === 'stripe') {
    geo = new THREE.TorusGeometry(.33, .12, 18, 40); geo.rotateX(Math.PI / 2);
    mat = kind === 'stripe' ? PM(0xffffff, { map: floatTex('stripe') }) : PM(kind === 'mine' ? playerCol : otherCol);
  } else if (kind === 'tiny') {
    geo = new THREE.TorusGeometry(.2, .065, 14, 32); geo.rotateX(Math.PI / 2);
    mat = PM(0xffffff, { map: floatTex('tiny') });
  } else if (kind === 'heart') {
    const s = heartPath(new THREE.Shape(), .5), h = heartPath(new THREE.Path(), .26); s.holes.push(h);
    geo = new THREE.ExtrudeGeometry(s, ex); geo.center(); geo.rotateX(-Math.PI / 2); mat = PM(PINK);
  } else if (kind === 'star') {
    const s = starShape(.55, .32), h = starShape(.24, .2, 10); s.holes.push(new THREE.Path(h.getPoints()));
    geo = new THREE.ExtrudeGeometry(s, ex); geo.center(); geo.rotateX(-Math.PI / 2); mat = PM(BLUE);
  }
  const m = mesh(geo, mat, g); m.castShadow = true;
  g.mat = mat;
  return g;
}
function drawFloatIcon(x, kind, cx, cy, R, playerS, otherS) {
  x.save(); x.translate(cx, cy);
  const ring = (col, r = R, w = R * .45, img) => {
    x.lineWidth = w; x.strokeStyle = col; x.beginPath(); x.arc(0, 0, r - w / 2, 0, TAU); x.stroke();
    x.lineWidth = 3; x.strokeStyle = 'rgba(0,0,0,.15)'; x.beginPath(); x.arc(0, 0, r, 0, TAU); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = w * .2; x.beginPath(); x.arc(0, 0, r - w / 2, Math.PI * 1.1, Math.PI * 1.5); x.stroke();
  };
  if (kind === 'mine') ring(playerS);
  if (kind === 'boys') ring(otherS);
  if (kind === 'stripe') { for (let i = 0; i < 8; i++) { x.lineWidth = R * .45; x.strokeStyle = i % 2 ? BLUE_S : PINK_S; x.beginPath(); x.arc(0, 0, R * .775, i / 8 * TAU, (i + 1) / 8 * TAU + .02); x.stroke(); } }
  if (kind === 'tiny') { ring('#ffb3d5', R * .7, R * .3); x.fillStyle = '#fff'; for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(Math.cos(i / 8 * TAU) * R * .55, Math.sin(i / 8 * TAU) * R * .55, R * .06, 0, TAU); x.fill(); } }
  if (kind === 'heart') { x.fillStyle = PINK_S; x.beginPath(); const p = new Path2D(); const s = R; p.moveTo(0, s * .9); p.bezierCurveTo(-.25 * s, .55 * s, -s, .2 * s, -s, -.3 * s); p.bezierCurveTo(-s, -.85 * s, -.3 * s, -s, 0, -.55 * s); p.bezierCurveTo(.3 * s, -s, s, -.85 * s, s, -.3 * s); p.bezierCurveTo(s, .2 * s, .25 * s, .55 * s, 0, s * .9); x.fill(p); x.fillStyle = '#fff'; x.beginPath(); x.arc(0, -.05 * s, s * .28, 0, TAU); x.fill(); }
  if (kind === 'star') { x.fillStyle = BLUE_S; x.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, r = i % 2 ? R * .55 : R; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, R * .25, 0, TAU); x.fill(); }
  x.restore();
}
function makeBubble(kind, pS, oS) {
  const t = canvasTex(256, 256, (x) => {
    x.fillStyle = 'rgba(0,0,0,.12)';
    x.beginPath(); x.arc(130, 112, 98, 0, TAU); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(128, 108, 96, 0, TAU); x.fill();
    x.beginPath(); x.arc(70, 214, 18, 0, TAU); x.fill(); x.beginPath(); x.arc(48, 242, 10, 0, TAU); x.fill();
    drawFloatIcon(x, kind, 128, 108, 66, pS, oS);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
  sp.scale.set(.85, .85, 1); sp.renderOrder = 15;
  return sp;
}

// ---------------------------------------------------------------- camera
const cam = { look: V(0, 0, 0), dir: V(0, .6, 1).normalize(), fitW: 8, fitH: 5, curPos: V(0, 5, 8), curLook: V(), speed: 1.6 };
function shot(look, dir, fitW, fitH, speed = 1.6) { cam.look.copy(look); cam.dir.copy(dir).normalize(); cam.fitW = fitW; cam.fitH = fitH; cam.speed = speed; }
function camLook() {
  // tall phone screens: shift the view toward the near deck so the extra height shows the yard, not empty lawn
  return camera.aspect < .62 ? cam.look.clone().add(V(0, cam.fitW * .05, cam.fitW * .06)) : cam.look;
}
function camTarget() {
  const vf = THREE.MathUtils.degToRad(camera.fov) / 2, asp = camera.aspect;
  const fw = asp < .8 ? cam.fitW * (asp < .62 ? .8 : .85) : cam.fitW;
  const d = Math.max(cam.fitH / 2 / Math.tan(vf), fw / 2 / (Math.tan(vf) * asp));
  const dir = asp < .62 ? cam.dir.clone().multiply(V(1, .7, 1)).normalize() : cam.dir;
  return camLook().clone().addScaledVector(dir, d);
}
function snapCam() { cam.curPos.copy(camTarget()); cam.curLook.copy(camLook()); }
let swayT = 0;
function updateCam(dt) {
  swayT += dt;
  const k = 1 - Math.exp(-dt * cam.speed);
  cam.curPos.lerp(camTarget(), k); cam.curLook.lerp(camLook(), k);
  camera.position.copy(cam.curPos).add(V(Math.sin(swayT * .3) * .08, Math.sin(swayT * .23) * .05, 0));
  camera.lookAt(cam.curLook);
}

// ---------------------------------------------------------------- input
const raycaster = new THREE.Raycaster();
let pickables = [];
let waterTap = null; // fn(point)
let inputOn = false;
let lastInput = performance.now();
function addPick(obj, r, fn, enabled = () => true, off = V()) { const p = { obj, r, fn, enabled, off }; pickables.push(p); return p; }
function screenOf(v) { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight, z: p.z }; }
function onTap(cx, cy) {
  lastInput = performance.now(); hideHint();
  if (!inputOn) return;
  let best = null, bestS = Infinity;
  for (const p of pickables) {
    if (!p.enabled() || !p.obj.parent) continue;
    const c = p.obj.localToWorld(p.off.clone());
    const s = screenOf(c); if (s.z > 1) continue;
    const e = screenOf(c.clone().add(V().setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(p.r)));
    const rad = Math.max(34, Math.hypot(e.x - s.x, e.y - s.y)) + 14;
    const d = Math.hypot(cx - s.x, cy - s.y);
    if (d < rad && d / rad < bestS) { bestS = d / rad; best = p; }
  }
  if (best) { best.fn(); return; }
  if (waterTap) {
    const ndc = new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    waterTap(raycaster.ray, cx, cy);
  }
}
canvas.addEventListener('pointerdown', e => { e.preventDefault(); onTap(e.clientX, e.clientY); }, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());
function rayToPlane(ray, y) { const t = (y - ray.origin.y) / ray.direction.y; if (t <= 0) return null; return ray.origin.clone().addScaledVector(ray.direction, t); }

const handEl = document.getElementById('hand');
let hintFn = null, hintShown = false;
function hideHint() { handEl.classList.remove('on'); hintShown = false; }
function updateHint() {
  if (!inputOn || !hintFn) { if (hintShown) hideHint(); return; }
  if (performance.now() - lastInput < 5500) return;
  const p = hintFn(); if (!p) { hideHint(); return; }
  const s = screenOf(p);
  handEl.style.transform = `translate(${s.x}px,${s.y}px)`;
  if (!hintShown) { handEl.classList.add('on'); hintShown = true; }
}

const fadeEl = document.getElementById('fade');
const fade = (on) => { fadeEl.style.opacity = on ? 1 : 0; return wait(.5); };

// ---------------------------------------------------------------- world objects
const yard = buildYard();
const sign = makeSign(() => { }); sign.position.set(-3.95, 0, -2.2); sign.rotation.y = .35; scene.add(sign);
const chair = makeChair(); chair.position.set(3.35, 0, -2.05); chair.rotation.y = -.25; scene.add(chair);
const basket = makeBasket(); basket.position.set(-3.85, 0, .9); scene.add(basket);
const basketBalls = [];

const girl = makePerson({ kind: 'girl', top: 0xf6f2ee, bottom: 0xf6f2ee, hair: 0x5a3720, legL: .42, legR: .064, tR: .15, tL: .15, headR: .19, armR: .052, armL: .36, shortsL: .1, skirt: true, hairCap: 1.15 });
const boy = makePerson({ kind: 'boy', top: 0xffffff, bottom: 0x24365e, hair: 0x3e2817, legL: .45, legR: .066, tR: .155, tL: .16, headR: .19, armR: .054, armL: .38, shortsL: .18, sleeves: true, hairCap: 1.25, hairBack: 1.6 });
const papa = makePerson({ kind: 'papa', top: 0x2bb3a3, bottom: 0xff8a5c, hair: 0x2a1c12, legL: .82, legR: .095, tR: .22, tL: .34, headR: .155, armR: .078, armL: .62, shortsL: .32, sleeves: false, hairCap: 1.2, hairBack: 1.7 });
const mom = makePerson({ kind: 'mom', top: 0xff9eb8, bottom: 0xff9eb8, hair: 0x6b3b22, legL: .78, legR: .078, tR: .17, tL: .32, headR: .145, armR: .062, armL: .56, shortsL: .14, skirt: true, hairCap: 1.25, hairBack: 2.2 });
const people = [girl, boy, papa, mom];
people.forEach(p => scene.add(p.g));
function place(P, x, z, face) { P.g.position.set(x, 0, z); if (face !== undefined) { P.faceDir = face; P.g.rotation.y = face; } }

const dolphin = makeDolphin(), crab = makeCrab(), seal = makeSeal(), octo = makeOctopus();
const animals = [dolphin, crab, seal, octo];
animals.forEach(a => { a.g.scale.setScalar(a.toyScale); a.g.visible = false; scene.add(a.g); });

let playerCol = 'pink', otherCol = 'blue';
const colHex = () => (playerCol === 'pink' ? PINK : BLUE);
const otherHex = () => (otherCol === 'pink' ? PINK : BLUE);
const colS = () => (playerCol === 'pink' ? PINK_S : BLUE_S);
const otherS = () => (otherCol === 'pink' ? PINK_S : BLUE_S);
const tintFor = c => new THREE.Color(c === 'pink' ? 0xff86c0 : 0x3f93ff);

// ---------------------------------------------------------------- stage 0: dress up
async function stageDress() {
  place(girl, -2.9, .75, Math.PI * .5 - .9);
  girl.faceDir = .35; girl.g.rotation.y = .35;
  place(boy, 6.5, -1, -Math.PI / 2); boy.g.visible = false;
  place(papa, .2, -2.35, 0); place(mom, -1.3, -2.5, .15);
  papa.g.visible = mom.g.visible = false;
  sign.visible = false;
  shot(V(-2.75, .78, .75), V(.25, .28, 1), 2.0, 1.9, 2.2); snapCam();
  // caps hovering
  const caps = [];
  for (const [col, hex, dx] of [['pink', PINK, -.55], ['blue', BLUE, .55]]) {
    const c = new THREE.Group();
    const m = mesh(new THREE.SphereGeometry(.2, 32, 16, 0, TAU, 0, 1.4), PM(hex), c); m.castShadow = true;
    const gm = M(0xffffff, .2);
    for (const s of [-1, 1]) mesh(new THREE.TorusGeometry(.04, .012, 8, 16), gm, c, s * .07, .1, .15).rotation.x = -.6;
    c.position.set(-2.9 + dx * 1.1, 1.0, .75 + .55);
    c.home = c.position.clone(); c.col = col; c.hex = hex;
    scene.add(c); caps.push(c);
  }
  await wait(.4);
  girl.setFace('wow', 1.2); say('girl', 'wow');
  let chosen = null;
  const pk = caps.map(c => addPick(c, .25, () => { if (!chosen) chosen = c; }));
  hintFn = () => caps[Math.floor(performance.now() / 2000) % 2].position;
  inputOn = true;
  lastInput = performance.now() - 3500;
  await new Promise(res => {
    const iv = setInterval(() => { if (chosen) { clearInterval(iv); res(); } }, 50);
    const bob = () => { if (chosen) return; caps.forEach((c, i) => { c.position.y = c.home.y + Math.sin(performance.now() / 400 + i * 2) * .05; c.rotation.y += .02; }); requestAnimationFrame(bob); };
    bob();
  });
  inputOn = false; hintFn = null; pickables = pickables.filter(p => !pk.includes(p));
  playerCol = chosen.col; otherCol = playerCol === 'pink' ? 'blue' : 'pink';
  const other = caps.find(c => c !== chosen);
  sfx.whoosh();
  setPose(girl, 'hold', .9);
  const from = chosen.position.clone(), to = girl.head.getWorldPosition(V()).add(V(0, .2, 0));
  await play(.5, k => { chosen.position.lerpVectors(from, to, easeIO(k)); chosen.position.y += Math.sin(Math.PI * k) * .3; chosen.rotation.y = 0; chosen.scale.setScalar(1 - k * .1); });
  scene.remove(chosen);
  girl.swimCap.visible = true; girl.swimCapM.color.setHex(colHex()); girl.hairCap.visible = false;
  girl.topM.color.setHex(colHex()); girl.botM.color.setHex(colHex());
  sparkleAt(girl.head.getWorldPosition(V()), [colHex() === PINK ? C_PINK : C_BLUE, C_WHITE, C_GOLD], 40);
  sfx.magic();
  girl.react('happy'); girl.setMood('normal');
  girl.faceDir = 0;
  await play(.4, k => other.scale.setScalar(1 - k));
  scene.remove(other);
  boy.swimCap.visible = true; boy.swimCapM.color.setHex(otherHex()); boy.hairCap.visible = false; boy.topM.color.setHex(otherHex());
  await wait(1.0);
}

function quickDress() {
  boy.g.visible = papa.g.visible = mom.g.visible = true;
  girl.swimCap.visible = true; girl.swimCapM.color.setHex(colHex()); girl.hairCap.visible = false;
  girl.topM.color.setHex(colHex()); girl.botM.color.setHex(colHex());
  boy.swimCap.visible = true; boy.swimCapM.color.setHex(otherHex()); boy.hairCap.visible = false; boy.topM.color.setHex(otherHex());
  sign.visible = true;
}
// ---------------------------------------------------------------- stage 1: balls
function signBalls(x) {
  drawPoolRect(x, 150, 150, 300, 170);
  for (let i = 0; i < 14; i++) drawBall(x, 175 + (i % 7) * 42, 190 + Math.floor(i / 7) * 60 + (i % 2) * 10, 20, colS());
  drawBall(x, 80, 120, 26, colS());
  drawArrow(x, 80, 100, 250, 160);
  drawSmile(x, 440, 90, 40, colS());
}
const balls = [];
let mineCount = 0;
function throwBall(from, target, col, by) {
  const b = makeBall(col); b.position.copy(from);
  const ball = { m: b, x: target.x, z: target.z, vx: 0, vz: 0, col, state: 'fly', spin: V(rnd(-3, 3), rnd(-3, 3), 0) };
  balls.push(ball);
  sfx.whoosh();
  const to = V(target.x, POOL.wy, target.z);
  const dur = .55 + from.distanceTo(to) * .04;
  tween(dur, k => { b.position.lerpVectors(from, to, k); b.position.y += Math.sin(Math.PI * k) * 1.1; b.rotation.x += .2; }, () => {
    ball.state = 'float'; ball.vx = rnd(-.3, .3); ball.vz = rnd(-.3, .3);
    splashAt(V(to.x, POOL.wy + .05, to.z), .8, tintFor(col)); pool.ripple(to.x, to.z, .07); sfx.plop();
    if (col === playerCol) { mineCount++; }
    if (by && by.after) by.after();
  });
  return ball;
}
function updateBalls(dt, t) {
  const R = .2, hw = POOL.w / 2 - R, hd = POOL.d / 2 - R;
  const fl = balls.filter(b => b.state === 'float');
  for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) {
    const a = fl[i], b = fl[j], dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
    if (d2 < 4 * R * R && d2 > 1e-6) { const d = Math.sqrt(d2), o = (2 * R - d) / 2, nx = dx / d, nz = dz / d; a.x -= nx * o; a.z -= nz * o; b.x += nx * o; b.z += nz * o; a.vx -= nx * .05; b.vx += nx * .05; a.vz -= nz * .05; b.vz += nz * .05; }
  }
  for (const b of fl) {
    b.vx += Math.sin(t * .5 + b.z * 2) * .02 * dt; b.vz += Math.cos(t * .4 + b.x * 2) * .02 * dt;
    b.vx *= 1 - dt * .8; b.vz *= 1 - dt * .8;
    b.x += b.vx * dt; b.z += b.vz * dt;
    if (b.x < -hw) { b.x = -hw; b.vx = Math.abs(b.vx) * .5; } if (b.x > hw) { b.x = hw; b.vx = -Math.abs(b.vx) * .5; }
    if (b.z < -hd) { b.z = -hd; b.vz = Math.abs(b.vz) * .5; } if (b.z > hd) { b.z = hd; b.vz = -Math.abs(b.vz) * .5; }
    let lift = 0;
    if (b.hop > 0) { b.hop -= dt; lift = Math.sin((1 - b.hop / .5) * Math.PI) * .45; }
    b.m.position.set(b.x, pool.heightAt(b.x, b.z) + .03 + lift, b.z);
    b.m.rotation.x += b.vz * dt * 4; b.m.rotation.z -= b.vx * dt * 4;
  }
}
async function throwAnim(P, target) {
  P.lookAt(target.x, target.z); setPose(P, 'throw', .45);
  await wait(.13);
  return P.handWorld(1);
}

async function stage1() {
  // set the scene
  boy.g.visible = papa.g.visible = mom.g.visible = true;
  place(girl, -2.6, 1.55, Math.PI / 2); girl.lookAt(0, .3);
  place(boy, 2.65, .95, -Math.PI / 2); boy.lookAt(0, 0);
  place(papa, .3, -2.25, 0); place(mom, -1.6, -2.45, .2);
  sign.visible = true; sign.setDraw(signBalls);
  for (let i = 0; i < 9; i++) { const b = makeBall(playerCol); b.position.set(basket.position.x + rnd(-.22, .22), .38 + rnd(0, .14), basket.position.z + rnd(-.22, .22)); basketBalls.push(b); }
  shot(V(0, .1, -.25), V(0, .44, 1), 7.6, 4.6, 1.2);
  // walk boy in
  await wait(1.2);
  // papa gag: throws a ball straight up... and it bonks his head
  shot(V(.1, 1.15, -1.7), V(0, .3, 1), 3.6, 3.4, 2);
  await wait(.6);
  papa.setMood('happy'); setPose(papa, 'reach', .5);
  const pb = makeBall(playerCol); pb.position.copy(papa.handWorld(1));
  await wait(.3);
  setPose(papa, 'cheer', .5); sfx.whoosh();
  const p0 = papa.handWorld(1), top = papa.head.getWorldPosition(V()).add(V(0, 1.6, 0));
  papa.nod = -.5;
  await play(.55, k => { pb.position.lerpVectors(p0, top, Math.sin(k * Math.PI / 2)); });
  const hd = papa.head.getWorldPosition(V()).add(V(0, papa.headR + .2, 0));
  await play(.4, k => { pb.position.lerpVectors(top, hd, k * k); });
  sfx.boing(); papa.nod = 0; papa.setMood('normal'); papa.setFace('surprised', 1.4); papa.tilt = .3; papa.hop(.1);
  setPose(papa, 'flail', 1);
  const land = V(.5, POOL.wy, -.6);
  await play(.6, k => { pb.position.lerpVectors(hd, land, k); pb.position.y += Math.sin(Math.PI * k) * .9; });
  splashAt(land, 1); pool.ripple(land.x, land.z, .09); sfx.plop();
  balls.push({ m: pb, x: land.x, z: land.z, vx: 0, vz: .2, col: playerCol, state: 'float' }); mineCount++;
  papa.tilt = 0;
  await wait(.2);
  girl.react('laugh'); boy.react('laugh'); mom.react('laugh'); papa.react('laugh');
  await wait(1.0);
  shot(V(0, .1, -.25), V(0, .44, 1), 7.6, 4.6, 1.4);
  // play
  const GOAL = 26;
  let done = false, boyConverted = false, lastThrow = 0;
  waterTap = async (ray) => {
    const p = rayToPlane(ray, POOL.wy); if (!p) return;
    if (Math.abs(p.x) > POOL.w / 2 + .5 || Math.abs(p.z) > POOL.d / 2 + .6) return;
    const now = performance.now(); if (now - lastThrow < 170) return; lastThrow = now;
    p.x = clamp(p.x, -POOL.w / 2 + .25, POOL.w / 2 - .25); p.z = clamp(p.z, -POOL.d / 2 + .25, POOL.d / 2 - .25);
    const from = await throwAnim(girl, p);
    throwBall(from, p, playerCol);
    if (Math.random() < .3) girl.setFace('happy', .6);
  };
  // tap the boy: hand him a ball of your color
  addPick(boy.g, .45, async () => {
    if (boyConverted || boy.busy) return; boy.busy = true;
    const from = await throwAnim(girl, boy.g.position);
    const b = makeBall(playerCol); b.position.copy(from); sfx.whoosh();
    setPose(boy, 'reach', 1);
    const to = boy.handWorld(1).add(V(-.1, .1, 0));
    await play(.5, k => { b.position.lerpVectors(from, to, k); b.position.y += Math.sin(Math.PI * k) * .8; });
    scene.remove(b); sfx.pop();
    boy.react('huh');
    await wait(1.0);
    boyConverted = true; boy.busy = false;
    boy.swimCapM.color.setHex(colHex()); boy.topM.color.setHex(colHex());
    sparkleAt(boy.head.getWorldPosition(V()), [colHex() === PINK ? C_PINK : C_BLUE, C_WHITE, C_GOLD], 30); sfx.magic();
    boy.react('happy'); girl.react('happy');
  }, () => !done, V(0, .7, 0));
  addPick(papa.g, .5, () => { papa.react('laugh'); setPose(papa, 'wave', 1); }, () => !done, V(0, 1.1, 0));
  addPick(mom.g, .45, () => { mom.react('happy'); setPose(mom, 'clap', 1); sfx.snap(); }, () => !done, V(0, 1.0, 0));
  addPick(basket, .5, () => { const p = V(rnd(-1.8, 1.8), POOL.wy, rnd(-1, 1)); throwAnim(girl, p).then(f => throwBall(f, p, playerCol)); }, () => !done, V(0, .3, 0));
  hintFn = () => V(rnd(-.5, .5) + Math.sin(performance.now() / 900), POOL.wy, 0);
  inputOn = true; lastInput = performance.now() - 2500;
  // boy AI + tint + goal
  let boyT = 1.5;
  const water0 = AQUA.clone(), tint = tintFor(playerCol);
  await new Promise(res => {
    stage1.tick = (dt) => {
      boyT -= dt;
      if (boyT <= 0 && balls.length < 70) {
        boyT = boyConverted ? rnd(1.1, 1.6) : rnd(1.8, 2.6);
        const p = V(rnd(-2, 2), POOL.wy, rnd(-1.1, 1.1));
        boy.lookAt(p.x, p.z); setPose(boy, 'throw', .45);
        wait(.13).then(() => throwBall(boy.handWorld(1), p, boyConverted ? playerCol : otherCol));
        if (!boyConverted && Math.random() < .5) boy.setFace('happy', .6);
      }
      pool.mat.color.copy(water0).lerp(tint, clamp(mineCount / GOAL, 0, 1) * .55);
      if (mineCount >= GOAL && !done) { done = true; res(); }
    };
  });
  stage1.tick = null; inputOn = false; hintFn = null; waterTap = null; pickables = [];
  // ---- big change: the whole pool turns one color
  await wait(.6);
  shot(V(0, -.1, .1), V(0, .75, 1), 7.2, 4.6, 1.2);
  const other = balls.filter(b => b.col !== playerCol);
  other.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  other.forEach((b, i) => wait(i * .08).then(() => { b.col = playerCol; b.m.material = BALLM[playerCol]; b.hop = .5; sparkleAt(b.m.position, [tint, C_WHITE], 8, .8); sfx.pop(); }));
  const c0 = pool.mat.color.clone(), strong = tintFor(playerCol).multiplyScalar(1.05);
  await play(1.6, k => { pool.mat.color.copy(c0).lerp(strong, easeIO(k)); pool.mat.opacity = .7 + .15 * k; });
  sfx.fanfare(); confettiAt(V(0, .5, 0), 140);
  for (const P of people) { P.lookAt(0, 0); P.react('wow'); }
  balls.forEach((b, i) => { b.hop = .5 + (i % 5) * .05; });
  await wait(1.6);
  for (const P of people) { P.faceDir = 0; P.react('happy'); }
  await wait(1.2);
  // tidy up: everything hops into the basket
  sfx.whoosh();
  const bpos = basket.position.clone().add(V(0, .4, 0));
  balls.forEach((b, i) => {
    b.state = 'out';
    const from = b.m.position.clone();
    wait(i * .035).then(() => tween(.7, k => { b.m.position.lerpVectors(from, bpos, k); b.m.position.y += Math.sin(Math.PI * k) * 1.6; b.m.scale.setScalar(k > .85 ? (1 - k) / .15 : 1); }, () => { scene.remove(b.m); if (i % 4 === 0) sfx.pop(); }));
  });
  await play(1.5, k => { pool.mat.color.copy(strong).lerp(AQUA.clone().lerp(tint, .18), easeIO(k)); pool.mat.opacity = .85 - .15 * k; });
  balls.length = 0;
}

// ---------------------------------------------------------------- stage 2: sea toys come alive
function signToys(x) {
  // toy (small, flat) -> water -> real (big, sparkly)
  const dolph = (cx, cy, s, col) => {
    x.fillStyle = col; x.beginPath(); x.ellipse(cx, cy, 60 * s, 24 * s, -.15, 0, TAU); x.fill();
    x.beginPath(); x.moveTo(cx - 10 * s, cy - 18 * s); x.lineTo(cx - 25 * s, cy - 45 * s); x.lineTo(cx + 10 * s, cy - 20 * s); x.fill();
    x.beginPath(); x.moveTo(cx - 55 * s, cy); x.lineTo(cx - 85 * s, cy - 20 * s); x.lineTo(cx - 80 * s, cy + 18 * s); x.fill();
    x.fillStyle = '#111'; x.beginPath(); x.arc(cx + 32 * s, cy - 6 * s, 4 * s, 0, TAU); x.fill();
  };
  dolph(95, 210, .6, '#4fc3ff');
  x.fillStyle = '#5fd3e6'; x.beginPath(); x.moveTo(180, 240); for (let i = 0; i <= 6; i++) x.quadraticCurveTo(185 + i * 14 - 7, 222, 185 + i * 14, 240); x.lineTo(270, 270); x.lineTo(180, 270); x.fill();
  drawArrow(x, 70, 170, 220, 215);
  dolph(380, 200, 1.1, '#6f8597');
  x.fillStyle = '#ffd54a'; for (const [sx, sy] of [[300, 120], [460, 130], [420, 280]]) { x.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, r = i % 2 ? 7 : 18; x.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); } x.fill(); }
}
async function stage2() {
  sign.setDraw(signToys);
  // characters move around
  place(girl, -2.75, 1.45, Math.PI / 2); girl.lookAt(0, .3);
  place(boy, 2.4, -2.3, 0); place(papa, .2, -2.35, 0); place(mom, -1.5, -2.45, .2);
  boy.faceDir = -.2;
  // toys on the near deck
  const spots = [[-1.95, 2.05], [-.65, 2.15], [.65, 2.15], [1.95, 2.05]];
  const order = [dolphin, octo, seal, crab];
  order.forEach((a, i) => { a.g.visible = true; a.g.position.set(spots[i][0], 0, spots[i][1]); a.g.rotation.y = rnd(-.3, .3) + (a === dolphin ? .6 : 0); a.g.scale.setScalar(a.toyScale); a.setReal(false); a.mode = 'toy'; a.home = a.g.position.clone(); });
  shot(V(0, -.15, .55), V(0, .5, 1), 7.6, 4.6, 1.2);
  await wait(.8);
  girl.setFace('wow', 1); say('girl', 'wow');
  const into = { dolphin: V(-.9, 0, -.2), octopus: V(-1.5, 0, .55), seal: V(.5, 0, -.5), crab: V(1.4, 0, .45) };
  let finished = false;
  const transform = async (A) => {
    if (A.mode !== 'toy') return; A.mode = 'flying';
    sfx.squeak();
    girl.lookAt(A.g.position.x, A.g.position.z); setPose(girl, 'throw', .45);
    const from = A.g.position.clone(), to = into[A.kind].clone(); to.y = POOL.wy;
    await play(.7, k => { A.g.position.lerpVectors(from, to, k); A.g.position.y += Math.sin(Math.PI * k) * 1.3; A.g.rotation.x = k * TAU; });
    A.g.rotation.x = 0;
    splashAt(to, 1.3); pool.ripple(to.x, to.z, .12); sfx.splash(1);
    A.g.position.y = POOL.wy - .1;
    await wait(.35);
    sfx.magic();
    sparkleAt(V(to.x, .1, to.z), [C_GOLD, C_WHITE, tintFor(playerCol)], 50, 2);
    let swapped = false;
    await play(.9, k => {
      const s = lerp(A.toyScale, A.realScale, easeBack(k)); A.g.scale.setScalar(s);
      A.g.rotation.y += .25 * (1 - k);
      if (k > .4 && !swapped) { swapped = true; A.setReal(true); }
    });
    A.mode = 'real'; A.t0 = 0; A.react('happy');
    for (const P of [girl, boy, mom, papa]) { P.lookAt(to.x, to.z); }
    girl.react('wow'); wait(.3).then(() => boy.react('happy'));
    wait(1.2).then(() => [girl, boy, mom, papa].forEach(P => { P.faceDir = P === girl ? Math.PI / 2 : 0; }));
    if (A === seal) { A.mode = 'toChair'; sealToChair(); }
  };
  const sealToChair = async () => {
    await wait(1.4);
    const a = seal.g.position.clone(), b = V(2.15, POOL.wy - .05, -.95);
    seal.g.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    await play(1.6, k => { seal.g.position.lerpVectors(a, b, easeIO(k)); seal.g.position.y = POOL.wy - .08 + Math.sin(k * 12) * .02; });
    const top = chair.position.clone().add(V(0, .45, .05));
    shot(V(2.6, .2, -1.4), V(-.15, .45, 1), 3.6, 2.6, 2);
    splashAt(b, .9); sfx.splash(.8);
    const r0 = seal.g.rotation.y, r1 = Math.PI + chair.rotation.y;
    await play(.8, k => { seal.g.position.lerpVectors(b, top, k); seal.g.position.y += Math.sin(Math.PI * k) * .8; seal.g.rotation.y = lerp(r0, r1, k); });
    seal.g.rotation.x = -.35;
    seal.react('happy');
    await wait(.9);
    seal.sleep = true; seal.mode = 'asleep'; sfx.snore();
    girl.react('happy');
    await wait(1.2);
    if (!finished) shot(V(0, -.15, .55), V(0, .5, 1), 7.6, 4.6, 1.2);
  };
  for (const A of order) {
    addPick(A.g, .35, () => {
      if (A.mode === 'toy') transform(A);
      else if (A.mode === 'real') {
        if (A === dolphin) dolphin.leapNow = true;
        if (A === crab) { crab.snapT = .8; crab.react('happy'); }
        if (A === octo) { octo.spinT = .6; octo.react('happy'); drops.emit(octo.g.position.clone().add(V(0, .3, 0)), { count: 40, colors: WATERC, speed: .5, up: 4, size: .08, life: 1.2, grav: 7 }); sfx.splash(.6); }
      } else if (A.mode === 'asleep') {
        seal.sleep = false; seal.clapT = 1.2; seal.react('happy'); seal.eyes.forEach(e => e.scale.y = 1);
        wait(2).then(() => { seal.sleep = true; sfx.snore(); });
      }
    }, () => true, V(0, .2, 0));
  }
  addPick(papa.g, .5, () => { papa.react('laugh'); }, () => true, V(0, 1.1, 0));
  addPick(mom.g, .45, () => { mom.react('happy'); setPose(mom, 'clap', 1); }, () => true, V(0, 1.0, 0));
  addPick(boy.g, .45, () => { boy.react('happy'); }, () => true, V(0, .7, 0));
  waterTap = (ray) => {
    const p = rayToPlane(ray, POOL.wy); if (!p || Math.abs(p.x) > POOL.w / 2 || Math.abs(p.z) > POOL.d / 2) return;
    splashAt(p, .6); pool.ripple(p.x, p.z, .06); sfx.plop();
  };
  hintFn = () => { const a = order.find(a => a.mode === 'toy'); return a ? a.g.position.clone().add(V(0, .15, 0)) : null; };
  inputOn = true; lastInput = performance.now() - 3000;
  let snoreT = 3, bubT = 0;
  await new Promise(res => {
    stage2.tick = (dt, t) => {
      // behaviours
      if (dolphin.mode === 'real') {
        dolphin.t0 += dt;
        const a = dolphin.t0 * .7, x = Math.cos(a) * 1.5 - .3, z = Math.sin(a) * .7;
        const nx = Math.cos(a + .05) * 1.5 - .3, nz = Math.sin(a + .05) * .7;
        const bl = Math.min(1, dolphin.t0); dolphin.g.position.x = lerp(dolphin.g.position.x, x, bl); dolphin.g.position.z = lerp(dolphin.g.position.z, z, bl);
        dolphin.g.rotation.y = Math.atan2(nx - x, nz - z);
        dolphin.leapT = (dolphin.leapT ?? 3) - dt;
        if ((dolphin.leapT < 0 || dolphin.leapNow) && !dolphin.leaping) { dolphin.leaping = 0.001; dolphin.leapNow = false; splashAt(V(x, POOL.wy, z), 1); sfx.splash(.7); sfx.click(); }
        if (dolphin.leaping) {
          dolphin.leaping += dt / 1.1; const k = dolphin.leaping;
          dolphin.g.position.y = POOL.wy - .15 + Math.sin(Math.PI * k) * 1.3; dolphin.g.rotation.x = -(k - .5) * 1.8;
          if (k >= 1) { dolphin.leaping = 0; dolphin.leapT = rnd(3, 5); splashAt(V(x, POOL.wy, z), 1.2); pool.ripple(x, z, .1); sfx.splash(.9); dolphin.g.rotation.x = 0; }
        } else { dolphin.g.position.y = POOL.wy - .18 + Math.sin(t * 3) * .03; dolphin.g.rotation.x = Math.sin(t * 3) * .08; }
      }
      if (crab.mode === 'real') {
        crab.t0 += dt;
        if (!crab.out) { crab.out = true; const a = crab.g.position.clone(), b = V(2.75, 0, .2); crab.mode = 'moving'; tween(.9, k => { crab.g.position.lerpVectors(a, b, k); crab.g.position.y = lerp(POOL.wy, 0, k) + Math.sin(Math.PI * k) * .5; }, () => { crab.mode = 'real'; crab.base = b.clone(); crab.g.rotation.y = -Math.PI / 2 + .3; }); }
        else if (crab.base) { crab.g.position.z = crab.base.z + Math.sin(crab.t0 * 1.2) * .9; crab.g.position.y = Math.abs(Math.sin(crab.t0 * 10)) * .015; crab.g.rotation.z = Math.sin(crab.t0 * 10) * .05; }
      }
      if (octo.mode === 'real') {
        octo.t0 += dt;
        const a = octo.t0 * .5, bl = Math.min(1, octo.t0 * .7); octo.g.position.x = lerp(octo.g.position.x, -1.4 + Math.cos(a) * .5, bl); octo.g.position.z = lerp(octo.g.position.z, .35 + Math.sin(a) * .3, bl);
        octo.g.position.y = POOL.wy - .2 + Math.sin(t * 2.5) * .06;
      }
      if (seal.mode === 'asleep' && seal.sleep) {
        snoreT -= dt; bubT -= dt;
        if (snoreT < 0) { snoreT = 2.6; sfx.snore(); }
        if (bubT < 0) { bubT = .9; sparks.emit(seal.headNode.getWorldPosition(V()).add(V(.05, .15, 0)), { count: 1, colors: [new THREE.Color(.7, .85, 1)], speed: .05, up: .35, size: .18, life: 2, grav: -.05 }); sfx.bubble(); }
      }
      if (!finished && order.every(a => a.mode === 'real' || a.mode === 'asleep' || a.mode === 'moving') && seal.mode === 'asleep') { finished = true; res(); }
    };
  });
  await wait(1.5);
  inputOn = false; hintFn = null;
  // papa wants the deck chair... a seal is already there
  shot(V(2.5, .4, -1.6), V(-.2, .4, 1), 4.2, 2.8, 1.6);
  papa.walking = true; const pa = papa.g.position.clone(), pb = V(2.4, 0, -2.4);
  papa.lookAt(pb.x, pb.z);
  await play(1.2, k => papa.g.position.lerpVectors(pa, pb, k));
  papa.walking = false; papa.lookAt(chair.position.x, chair.position.z);
  await wait(.3);
  papa.react('huh');
  await wait(1.1);
  papa.react('laugh'); papa.faceDir = 0;
  seal.sleep = false; seal.clapT = 1; seal.react('happy'); seal.eyes.forEach(e => e.scale.y = 1);
  await wait(.6);
  // finale: dolphin leaps, everybody cheers
  shot(V(0, -.1, .3), V(0, .55, 1), 7.6, 4.8, 1.3);
  dolphin.leapNow = true;
  await wait(.5);
  confettiAt(V(0, .5, 0), 120); sfx.fanfare();
  for (const P of people) P.react('happy');
  crab.snapT = 1; octo.spinT = .8;
  await wait(2.2);
  stage2.tick = null; waterTap = null; pickables = [];
}

// ---------------------------------------------------------------- stage 3: water park, lazy river
const PARK = V(60, 0, 0);
const RIV = { a: 4.4, b: 2.5, hw: .85, wy: -.15, depth: 1.0 };
let river;
function ellipsePt(th, s = 0, y = 0) { return V(PARK.x + (RIV.a + s) * Math.cos(th), y, PARK.z + (RIV.b + s) * Math.sin(th)); }
function ringGeo(N, M, s0, s1, yFn, uvScale = 1) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const th = i / N * TAU;
    for (let j = 0; j <= M; j++) {
      const s = lerp(s0, s1, j / M);
      pos.push((RIV.a + s) * Math.cos(th), yFn ? yFn(j / M) : 0, (RIV.b + s) * Math.sin(th));
      uv.push(i / N * 20 * uvScale, j / M * uvScale);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * (M + 1) + j, b = a + M + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function wallGeo(N, s, depth) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const th = i / N * TAU, x = (RIV.a + s) * Math.cos(th), z = (RIV.b + s) * Math.sin(th);
    pos.push(x, 0, z, x, -depth, z); uv.push(i / N * 30, 1, i / N * 30, 0);
  }
  for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function ellipseShape(a, b, hole) {
  const s = new THREE.Shape(); s.absellipse(0, 0, a, b, 0, TAU, false);
  if (hole) { const h = new THREE.Path(); h.absellipse(0, 0, hole[0], hole[1], 0, TAU, true); s.holes.push(h); }
  return s;
}
function palm(parent, x, z, h = 3.2, lean = .2) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  const trunkM = M(0x9c7a55, .9, { map: stripeTex('#a98560', '#8a6a48', 16, true) });
  let y = 0, px = 0;
  for (let i = 0; i < 8; i++) { const nx = Math.sin(i / 8 * 1.2) * lean * h / 2; mesh(new THREE.CylinderGeometry(.11 - i * .006, .13 - i * .006, h / 8 + .02, 10), trunkM, g, (px + nx) / 2, y + h / 16, 0).rotation.z = -(nx - px) * 2; px = nx; y += h / 8; }
  const leafT = canvasTex(256, 64, (x) => { x.fillStyle = '#3e8a2e'; x.strokeStyle = '#2f6e22'; x.lineWidth = 4; x.beginPath(); x.moveTo(0, 32); x.lineTo(256, 32); x.stroke(); for (let i = 0; i < 40; i++) { const xx = i * 6.2; x.beginPath(); x.moveTo(xx, 32); x.lineTo(xx + 14, 4 + i * .4); x.lineTo(xx + 10, 32); x.lineTo(xx + 14, 60 - i * .4); x.closePath(); x.fill(); } });
  const lm = new THREE.MeshStandardMaterial({ map: leafT, alphaTest: .5, side: THREE.DoubleSide, roughness: .7, transparent: false });
  leafT.colorSpace = THREE.SRGBColorSpace;
  // need alpha: redraw on transparent canvas
  const lc = leafT.image.getContext('2d'); const img = lc.getImageData(0, 0, 256, 64);
  for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 1] < 20) img.data[i + 3] = 0; lc.putImageData(img, 0, 0); leafT.needsUpdate = true;
  for (let i = 0; i < 9; i++) {
    const geo = new THREE.PlaneGeometry(1.5, .4, 10, 1); geo.translate(.75, 0, 0);
    const p = geo.attributes.position; for (let k = 0; k < p.count; k++) { const xx = p.getX(k); p.setZ(k, -xx * xx * .25); } geo.computeVertexNormals();
    geo.rotateX(Math.PI / 2);
    const l = mesh(geo, lm, g, px, y, 0); l.rotation.y = i / 9 * TAU; l.rotation.z = .25;
  }
  mesh(new THREE.SphereGeometry(.12, 10, 8), M(0x6b4a2a, .6), g, px + .1, y - .1, .05);
  return g;
}
function buildPark() {
  const g = new THREE.Group(); g.position.copy(PARK); scene.add(g);
  backdrop(T.park, PARK, 50, .78, -18);
  const pinkDeck = M(0xffc4d4, .85, { map: T.deck });
  const outer = flatShape(ellipseShape(40, 26, [RIV.a + RIV.hw, RIV.b + RIV.hw]), pinkDeck, 0, g);
  outer.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = v / 1.6; });
  const isl = flatShape(ellipseShape(RIV.a - RIV.hw, RIV.b - RIV.hw), M(0xffffff, .95, { map: T.grass }), .02, g);
  isl.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = v / 2; });
  const tm = M(0xffffff, .35, { map: texR('tile', 1, 1) });
  const fl = new THREE.Mesh(ringGeo(96, 4, -RIV.hw, RIV.hw, null, 1), tm); fl.position.y = -RIV.depth; fl.receiveShadow = true; g.add(fl);
  const wm = M(0xffffff, .35, { map: texR('tile', 1, 1), side: THREE.DoubleSide });
  g.add(new THREE.Mesh(wallGeo(120, RIV.hw, RIV.depth), wm), new THREE.Mesh(wallGeo(120, -RIV.hw, RIV.depth), wm));
  const cop = M(0xf7f3ec, .6);
  const c1 = new THREE.Mesh(ringGeo(120, 1, RIV.hw, RIV.hw + .2), cop); c1.position.y = .025; c1.receiveShadow = true;
  const c2 = new THREE.Mesh(ringGeo(120, 1, -RIV.hw - .2, -RIV.hw), cop); c2.position.y = .04; c2.receiveShadow = true;
  g.add(c1, c2);
  const cm = new THREE.MeshBasicMaterial({ map: causticTex.clone(), transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xcff6ff });
  cm.map.repeat.set(1, .3); cm.map.needsUpdate = true;
  const cs = new THREE.Mesh(ringGeo(96, 4, -RIV.hw, RIV.hw, null, 1), cm); cs.position.y = -RIV.depth + .01; cs.renderOrder = 1; g.add(cs);
  const wg = ringGeo(144, 8, -RIV.hw, RIV.hw);
  river = new Water(wg, PARK.clone(), RIV.wy, AQUA.clone());
  river.caustics = [cm.map];
  // island: palms, little slide tower
  palm(g, -2.2, -.3, 3.0, .25); palm(g, -1.4, .5, 2.4, -.2); palm(g, 2.6, .2, 2.8, .3);
  palm(g, -7.5, -4.5, 3.6, .2); palm(g, 7.8, -4.2, 3.4, -.2); palm(g, -8.2, 2.5, 3.0, .3); palm(g, 8.4, 2.0, 3.2, -.3);
  const tower = new THREE.Group(); tower.position.set(.6, 0, -.4); g.add(tower);
  const post = M(0xffd25a, .6);
  for (const [x, z] of [[-.4, -.4], [.4, -.4], [-.4, .4], [.4, .4]]) mesh(new THREE.CylinderGeometry(.05, .05, 1.8, 10), post, tower, x, .9, z);
  mesh(new THREE.BoxGeometry(1, .1, 1), M(0x3d8bff, .5), tower, 0, 1.8, 0);
  mesh(new THREE.ConeGeometry(.8, .6, 4), M(PINK, .5), tower, 0, 2.95, 0).rotation.y = Math.PI / 4;
  for (const [x, z] of [[-.4, -.4], [.4, -.4], [-.4, .4], [.4, .4]]) mesh(new THREE.CylinderGeometry(.04, .04, .85, 8), post, tower, x, 2.25, z);
  // slide curve from tower to river (far side)
  const pts = [V(.6, 1.85, -.4), V(.3, 1.6, -1.0), V(-.6, 1.2, -1.3), V(-1.5, .7, -1.5), V(-2.1, .25, -2.1), V(-2.2, .0, -2.55)].map(p => p);
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.TubeGeometry(curve, 60, .22, 16, false);
  const sm = PM(PINK, { side: THREE.DoubleSide, roughness: .3 });
  mesh(tube, sm, g).castShadow = true;
  g.slideCurve = curve; g.tower = tower;
  // umbrellas
  for (const [x, z, c] of [[-6, 3.8, PINK_S], [6, 3.9, BLUE_S], [-6.4, -3.2, BLUE_S], [6.5, -3.0, PINK_S]]) {
    const u = new THREE.Group(); u.position.set(x, 0, z); g.add(u);
    mesh(new THREE.CylinderGeometry(.03, .03, 2.2, 8), M(0xffffff, .4), u, 0, 1.1, 0);
    const can = mesh(new THREE.ConeGeometry(1.1, .45, 16, 1, true), M(0xffffff, .7, { map: stripeTex(c, '#ffffff', 8), side: THREE.DoubleSide }), u, 0, 2.15, 0);
    can.castShadow = true;
  }
  return g;
}
const park = buildPark();

function signFloats(x) {
  // papa with lots of rings -> rings to friends
  drawSmile(x, 120, 200, 46);
  for (let i = 0; i < 4; i++) drawFloatIcon(x, ['mine', 'stripe', 'heart', 'star'][i], 60 + i * 40, 290 - (i % 2) * 18, 30, colS(), otherS());
  drawArrow(x, 190, 190, 330, 190);
  drawSmile(x, 400, 140, 34, otherS()); drawFloatIcon(x, 'boys', 400, 245, 38, colS(), otherS());
}

async function stage3() {
  await fade(true);
  sfx.whoosh();
  sunAt(PARK); area = 1;
  animals.forEach(a => { a.g.visible = false; a.g.rotation.set(0, 0, 0); a.mode = 'idle'; a.setReal(true); a.sleep = false; });
  sign.position.set(PARK.x - 6.4, 0, PARK.z + 3.3); sign.rotation.y = .5; sign.setDraw(signFloats);
  const nearZ = PARK.z + RIV.b + RIV.hw + .75, SX = innerWidth / innerHeight < .8 ? .66 : 1;
  const W = [
    { C: mom, x: -3.6, want: 'heart' }, { C: seal, x: -2.35, want: 'stripe' }, { C: octo, x: -1.2, want: 'star' },
    { C: crab, x: 1.35, want: 'tiny' }, { C: boy, x: 2.6, want: 'boys' },
  ];
  place(girl, PARK.x + .1, nearZ + .2, 0);
  for (const w of W) {
    const C = w.C; C.g.visible = true;
    C.g.position.set(PARK.x + w.x * SX, 0, nearZ + (C.kind === 'crab' || C.kind === 'octopus' ? .1 : 0));
    if (C.setReal) { C.g.scale.setScalar(C.realScale * .8); C.g.rotation.set(0, 0, 0); C.sleep = false; C.eyes && C.eyes.forEach(e => e.scale.setScalar(1)); }
    else { C.faceDir = 0; C.g.rotation.y = 0; C.sitting = false; }
    w.bub = makeBubble(w.want, colS(), otherS()); w.bub.visible = false; scene.add(w.bub);
    w.got = null;
  }
  dolphin.g.visible = true; dolphin.g.scale.setScalar(.85); dolphin.mode = 'river'; dolphin.th = 0;
  // papa with ALL the floats
  place(papa, PARK.x - .9 * SX, nearZ - .05, 0);
  const kinds = ['mine', 'boys', 'stripe', 'heart', 'star', 'tiny'];
  const fl = {};
  const slots = [
    ['mine', V(0, papa.waistY + .05, 0), V(0, 0, 0), 1.25],
    ['stripe', V(0, papa.top - .15, 0), V(0, 0, 0), 1.0],
    ['boys', V(0, papa.top + .3, -.05), V(.3, 0, .2), .85],
    ['heart', V(-.42, papa.top - .45, .05), V(0, 0, 1.3), .7],
    ['star', V(.42, papa.top - .45, .05), V(0, 0, -1.3), .7],
    ['tiny', V(0, papa.top + papa.headR * 2 + .05, 0), V(.2, 0, 0), 1.1],
  ];
  for (const [k, p, r, s] of slots) { const f = makeFloat(k, colHex(), otherHex()); f.position.copy(p); f.rotation.set(r.x, r.y, r.z); f.scale.setScalar(s); f.slot = { p, r, s }; papa.body.add(f); fl[k] = f; }
  shot(V(PARK.x, .3, PARK.z + 1.1), V(0, .5, 1), 11.4, 6.4, 1.2); snapCam();
  people.forEach(p => { p.tilt = 0; p.setMood('normal'); });
  await fade(false);
  // papa hogs them all
  shot(V(PARK.x - .9, 1.0, nearZ - .2), V(0, .3, 1), 3.2, 3, 1.8);
  papa.setFace('happy', 1.5); setPose(papa, 'hug'); say('papa', 'laugh');
  await wait(1.4);
  for (const w of W) { w.C.lookAt ? w.C.lookAt(papa.g.position.x, papa.g.position.z) : null; }
  boy.react('sad'); mom.setFace('surprised', 1);
  await wait(.8);
  // papa jumps in... and floats away
  sfx.whoosh(); papa.setFace('happy', 1);
  const from = papa.g.position.clone(), th0 = Math.PI / 2 - .25, land = ellipsePt(th0, 0, RIV.wy - papa.waistY);
  await play(.7, k => { papa.g.position.lerpVectors(from, land, k); papa.g.position.y += Math.sin(Math.PI * k) * .9; });
  splashAt(V(land.x, RIV.wy, land.z), 1.6); river.ripple(land.x, land.z, .12); sfx.splash(1.3);
  papa.sitting = true; papa.basePose = 'flail'; setPose(papa, 'flail');
  shot(V(PARK.x, .3, PARK.z + 1.1), V(0, .5, 1), 11.4, 6.4, 1.0);
  papa.th = th0; papa.mode = 'drift';
  let given = 0;
  const TOTAL = W.length;
  const REST = th0 + Math.PI * (SX < 1 ? .5 : .6);
  const thTarget = () => lerp(REST, th0 + TAU, given / TOTAL);
  // drift to far side
  await play(2.4, k => { papa.th = lerp(th0, REST, easeIO(k)); });
  papa.setMood('sad'); say('papa', 'uh');
  girl.setFace('surprised', 1); W.forEach(w => { w.bub.visible = true; });
  // interaction
  let held = null;
  const holdPos = () => girl.g.position.clone().add(V(0, 1.42, 0));
  const takeFloat = (f) => {
    if (held || !f.parent || f.flying) return;
    f.flying = true;
    const wp = f.getWorldPosition(V()); scene.attach(f); f.position.copy(wp);
    sfx.pop(); papa.setFace('surprised', .6);
    const a = f.position.clone(), r0 = f.rotation.clone(), s0 = f.scale.x;
    held = f; setPose(girl, 'hold'); girl.basePose = 'hold';
    tween(.7, k => { f.position.lerpVectors(a, holdPos(), easeIO(k)); f.position.y += Math.sin(Math.PI * k) * 1.2; f.rotation.set(r0.x * (1 - k), 0, r0.z * (1 - k)); f.scale.setScalar(lerp(s0, .9, k)); },
      () => { f.flying = false; girl.setFace('happy', .6); W.forEach(w => { if (!w.got) { w.C.hop && w.C.hop(.12); if (w.C.arms) setPose(w.C, 'reach', 1.2); } }); });
  };
  const give = async (w) => {
    if (w.got || w.busy) return;
    if (!held || held.flying) {
      // empty hands: they point at papa
      if (w.C.arms) { w.C.lookAt(papa.g.position.x, papa.g.position.z); setPose(w.C, 'point', 1.2); }
      w.C.react('laugh'); lastInput = 0; return;
    }
    const f = held; held = null; girl.basePose = 'idle'; w.busy = true; w.got = f;
    girl.lookAt(w.C.g.position.x, w.C.g.position.z); setPose(girl, 'throw', .45); sfx.whoosh();
    const isP = !!w.C.arms;
    const wy = isP ? w.C.waistY + .05 : (w.C === seal ? .3 : w.C === crab ? .12 : .22);
    const target = w.C.g.position.clone().add(V(0, wy, 0));
    const a = f.position.clone();
    await play(.6, k => { f.position.lerpVectors(a, target, k); f.position.y += Math.sin(Math.PI * k) * .9; f.rotation.y += .2; });
    w.C.g.attach(f); f.rotation.set(0, 0, 0);
    if (w.C.setReal) { const ws = { seal: 1, octopus: .72, crab: .5 }[w.C.kind] * (f.kind === 'tiny' ? 1.6 : 1); f.scale.setScalar(ws / w.C.g.scale.x); f.position.set(0, wy / w.C.g.scale.x, 0); }
    else { f.scale.setScalar(w.C === boy ? .85 : .9); f.position.set(0, w.C.waistY + .03, 0); }
    w.bub.visible = false;
    const right = f.kind === w.want;
    if (right) { w.C.react('wow'); sparkleAt(target, [C_GOLD, C_WHITE], 26); sfx.sparkle(5); }
    else { w.C.react('huh'); await wait(1.05); w.C.react('happy'); }
    given++;
    papa.setFace('happy', .8);
    girl.faceDir = 0;
    await wait(.7);
    // hop into the river and float away happily
    const th = Math.atan2((w.C.g.position.z - PARK.z) / RIV.b, (w.C.g.position.x - PARK.x) / RIV.a);
    const startTh = th;
    const tgt = ellipsePt(startTh, rnd(-.3, .3), RIV.wy - (isP ? w.C.waistY : wy));
    const a2 = w.C.g.position.clone();
    sfx.whoosh();
    await play(.6, k => { w.C.g.position.lerpVectors(a2, tgt, k); w.C.g.position.y += Math.sin(Math.PI * k) * .7; });
    splashAt(V(tgt.x, RIV.wy, tgt.z), 1.1); river.ripple(tgt.x, tgt.z, .1); sfx.splash(.9);
    riders.push({ C: w.C, th: startTh, s: rnd(-.3, .3), yOff: isP ? -w.C.waistY : -wy, spin: rnd(-.4, .4) });
    if (isP) { w.C.sitting = true; w.C.basePose = 'float'; setPose(w.C, 'float'); w.C.setMood('happy'); }
    w.busy = false;
  };
  for (const k of kinds) addPick(fl[k], .4, () => takeFloat(fl[k]), () => fl[k].parent === papa.body && !held);
  addPick(papa.g, .6, () => { const f = kinds.map(k => fl[k]).find(f => f.parent === papa.body); if (f) takeFloat(f); }, () => !held && papa.mode === 'drift', V(0, .9, 0));
  for (const w of W) addPick(w.C.g, .45, () => give(w), () => !w.got, V(0, w.C.arms ? .8 : .25, 0));
  hintFn = () => {
    if (held) { const w = W.find(w => !w.got); return w ? w.C.g.position.clone().add(V(0, w.C.arms ? .7 : .25, 0)) : null; }
    const f = kinds.map(k => fl[k]).find(f => f.parent === papa.body); return f ? f.getWorldPosition(V()) : null;
  };
  inputOn = true; lastInput = performance.now() - 2500;
  // wait until all friends have a float
  await new Promise(res => {
    stage3.tick = (dt) => {
      for (const w of W) if (w.bub.visible) w.bub.position.copy(w.C.g.position).add(V(.28, w.C.arms ? w.C.top + w.C.headR * 2 + .42 : .78, 0));
      papa.th = lerp(papa.th, thTarget(), Math.min(1, dt * .8));
      if (given >= TOTAL && Math.abs(papa.th - thTarget()) < .05) res();
    };
  });
  inputOn = false; hintFn = null;
  // papa is back — gives the last float to the girl
  papa.mode = 'back'; papa.basePose = 'idle'; setPose(papa, 'wave'); papa.setMood('happy');
  shot(V(girl.g.position.x - .3, .8, girl.g.position.z - .6), V(0, .45, 1), 3.4, 2.8, 1.8);
  const pf = papa.g.position.clone(), pt = V(girl.g.position.x - .8, 0, girl.g.position.z - .15);
  await play(.8, k => { papa.g.position.lerpVectors(pf, pt, k); papa.g.position.y = lerp(pf.y, 0, k) + Math.sin(Math.PI * k) * .6; });
  papa.sitting = false; papa.lookAt(girl.g.position.x, girl.g.position.z); girl.lookAt(papa.g.position.x, papa.g.position.z);
  splashAt(V(pt.x, 0, pt.z), .5);
  const last = kinds.map(k => fl[k]).find(f => f.parent === papa.body) || (held && held);
  if (held) { held = null; }
  setPose(girl, 'idle'); girl.basePose = 'idle';
  if (last) {
    scene.attach(last); const a = last.position.clone();
    await play(.6, k => { last.position.lerpVectors(a, girl.g.position.clone().add(V(0, girl.waistY + .05, 0)), easeIO(k)); last.rotation.set(0, 0, 0); last.scale.setScalar(lerp(last.scale.x, .85, k)); });
    girl.g.attach(last); last.position.set(0, girl.waistY + .03, 0);
  }
  setPose(papa, 'hug', 1.2); setPose(girl, 'hug', 1.2); girl.react('wow'); papa.react('laugh');
  sfx.fanfare(); confettiAt(girl.g.position.clone().add(V(0, 1.2, -.5)), 120);
  await wait(1.8);
  // everyone in!
  for (const [P, d] of [[girl, .25], [papa, -.35]]) {
    const th = Math.PI / 2 + d, tgt = ellipsePt(th, 0, RIV.wy - P.waistY), a = P.g.position.clone();
    tween(.7, k => { P.g.position.lerpVectors(a, tgt, k); P.g.position.y += Math.sin(Math.PI * k) * .9; }, () => {
      splashAt(V(tgt.x, RIV.wy, tgt.z), 1.4); sfx.splash(1.1); river.ripple(tgt.x, tgt.z, .12);
      P.sitting = true; P.basePose = 'float'; setPose(P, 'float'); P.setMood('happy');
      riders.push({ C: P, th, s: 0, yOff: -P.waistY, spin: rnd(-.3, .3) });
    });
  }
  // papa gets his own (silly little) float back: the slide drops one for him
  const pfl = makeFloat('mine', 0xffd25a, 0xffd25a); papa.g.add(pfl); pfl.position.set(0, papa.waistY + .05, 0); pfl.scale.setScalar(1.25);
  await wait(1);
  shot(V(PARK.x, .3, PARK.z + 1.1), V(0, .5, 1), 11.4, 6.4, 1.0);
  await freePlay();
}

const riders = [];
const parkBalls = [];
function updateRiders(dt, t) {
  for (const r of riders) {
    r.th += dt * .16;
    r.s += (Math.sin(t * .3 + r.th * 3) * .25 - r.s) * dt * .3;
    const p = ellipsePt(r.th, r.s);
    const y = river.heightAt(p.x, p.z);
    r.C.g.position.set(p.x, y + r.yOff + (r.jump || 0), p.z);
    if (r.jumpT > 0) { r.jumpT -= dt; r.jump = Math.sin((1 - r.jumpT / .6) * Math.PI) * .6; if (r.jumpT <= 0) { r.jump = 0; splashAt(V(p.x, RIV.wy, p.z), 1); sfx.splash(.7); river.ripple(p.x, p.z, .1); } }
    const yaw = Math.sin(t * .5 + r.spin * 5) * .6 + (r.twirl || 0);
    if (r.twirl > 0) r.twirl = Math.max(0, r.twirl - dt * 6);
    if (r.C.arms) r.C.faceDir = yaw; else r.C.g.rotation.y = yaw;
  }
  // dolphin swims laps (a bit faster), leaping now and then
  if (dolphin.mode === 'river') {
    dolphin.th += dt * .32; const p = ellipsePt(dolphin.th, -.35), n = ellipsePt(dolphin.th + .05, -.35);
    dolphin.g.position.set(p.x, RIV.wy - .25, p.z); dolphin.g.rotation.y = Math.atan2(n.x - p.x, n.z - p.z);
    dolphin.lt = (dolphin.lt ?? 4) - dt;
    if (dolphin.lt < 0 || dolphin.leapNow) { dolphin.leapNow = false; dolphin.lt = rnd(4, 7); dolphin.lk = .001; splashAt(V(p.x, RIV.wy, p.z), 1); sfx.splash(.6); sfx.click(); }
    if (dolphin.lk) { dolphin.lk += dt / 1; const k = dolphin.lk; dolphin.g.position.y = RIV.wy - .2 + Math.sin(Math.PI * Math.min(1, k)) * 1.2; dolphin.g.rotation.x = -(k - .5) * 1.8; if (k >= 1) { dolphin.lk = 0; dolphin.g.rotation.x = 0; splashAt(V(p.x, RIV.wy, p.z), 1.2); sfx.splash(.9); river.ripple(p.x, p.z, .1); } }
  }
  if (papa.mode === 'drift') {
    const p = ellipsePt(papa.th, Math.sin(t * .7) * .2);
    papa.g.position.set(p.x, river.heightAt(p.x, p.z) - papa.waistY, p.z);
    papa.faceDir = Math.PI + Math.sin(t * .8) * 1.2;
  }
  for (const b of parkBalls) {
    if (b.state !== 'float') continue;
    b.th += dt * .16; const p = ellipsePt(b.th, b.s);
    b.m.position.set(p.x, river.heightAt(p.x, p.z) + .07, p.z); b.m.rotation.x += dt;
  }
}
async function freePlay() {
  // tap anyone: they splash, giggle and twirl. tap the slide: balls come sliding down. tap water: splash.
  for (const r of riders) {
    addPick(r.C.g, .45, () => {
      if (r.jumpT > 0) return; r.jumpT = .6; r.twirl = TAU; r.C.react(r.C.arms ? 'laugh' : 'happy');
      if (r.C === octo) octo.spinT = .5; if (r.C === crab) crab.snapT = .6; if (r.C === seal) seal.clapT = .8;
    }, () => true, V(0, r.C.arms ? .9 : .25, 0));
  }
  addPick(dolphin.g, .5, () => { dolphin.leapNow = true; }, () => !dolphin.lk);
  addPick(park.tower, 1.0, () => slideBalls(), () => true, V(0, 1.6, 0));
  waterTap = (ray) => {
    const p = rayToPlane(ray, RIV.wy); if (!p) return;
    const lx = (p.x - PARK.x) / RIV.a, lz = (p.z - PARK.z) / RIV.b;
    const th = Math.atan2(lz, lx), c = ellipsePt(th), s = Math.hypot(p.x - PARK.x, p.z - PARK.z) - Math.hypot(c.x - PARK.x, c.z - PARK.z);
    if (Math.abs(s) > RIV.hw + .3) { slideBalls(); return; }
    splashAt(V(p.x, RIV.wy, p.z), .8); river.ripple(p.x, p.z, .08); sfx.plop();
    const b = makeBall(Math.random() < .5 ? 'pink' : 'blue'); b.position.set(p.x, RIV.wy - .4, p.z);
    const ball = { m: b, th, s: clamp(s, -RIV.hw + .2, RIV.hw - .2), state: 'pop' }; parkBalls.push(ball);
    tween(.6, k => { b.position.y = RIV.wy - .4 + Math.sin(Math.PI * k) * 1.4 + k * .45; }, () => { ball.state = 'float'; });
    if (parkBalls.length > 40) { const o = parkBalls.shift(); scene.remove(o.m); }
  };
  hintFn = () => park.tower.getWorldPosition(V()).add(V(0, 1.9, 0));
  inputOn = true; lastInput = performance.now();
  document.getElementById('again').style.display = 'block';
  let auto = 6;
  stage3.tick = (dt) => { auto -= dt; if (auto < 0) { auto = rnd(7, 11); const r = pick(riders); if (r && !(r.jumpT > 0)) { r.jumpT = .6; r.twirl = TAU; r.C.react(r.C.arms ? 'laugh' : 'happy'); } } };
}
let sliding = 0;
function slideBalls() {
  if (sliding > 2) return; sliding++;
  const curve = park.slideCurve;
  sfx.whoosh();
  for (let i = 0; i < 6; i++) {
    const col = i % 2 ? 'pink' : 'blue';
    wait(i * .18).then(() => {
      const b = makeBall(col);
      tween(1.1, k => { const p = curve.getPoint(Math.pow(k, 1.3)); b.position.copy(p).add(PARK).add(V(0, .12, 0)); b.rotation.x += .3; }, () => {
        const end = curve.getPoint(1).add(PARK);
        const th = Math.atan2((end.z - PARK.z) / RIV.b, (end.x - PARK.x) / RIV.a);
        splashAt(V(end.x, RIV.wy, end.z), .7, tintFor(col)); sfx.plop(); river.ripple(end.x, end.z, .07);
        parkBalls.push({ m: b, th: th + rnd(-.05, .05), s: rnd(-.4, .4), state: 'float' });
        if (parkBalls.length > 40) { const o = parkBalls.shift(); scene.remove(o.m); }
        if (i === 5) sliding--;
      });
    });
  }
  const r = pick(riders); if (r) r.C.react(r.C.arms ? 'wow' : 'happy');
}
document.getElementById('again').addEventListener('pointerdown', (e) => { e.stopPropagation(); location.reload(); });

// ---------------------------------------------------------------- main loop
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = w / h < .8 ? 50 : 38;
  camera.updateProjectionMatrix();
  const sc = renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  for (const p of [drops, sparks, confetti]) p.mat.uniforms.scale.value = sc;
}
addEventListener('resize', resize); resize();
shot(V(0, .1, -.25), V(0, .44, 1), 7.6, 4.6); snapCam();
// title scene arrangement
place(girl, -3.0, .55, .5); place(boy, 3.0, .3, -.5); place(papa, .3, -2.25, 0); place(mom, -1.6, -2.45, .2);

let area = 0;
const QS = new URLSearchParams(location.search), DEBUG = QS.has('debug');
const clock = new THREE.Clock();
let T0 = 0;
function frame() {
  const dt = Math.min(DEBUG ? .15 : .05, clock.getDelta()); T0 += dt;
  updTweens(dt);
  if (stage1.tick) stage1.tick(dt, T0);
  if (stage2.tick) stage2.tick(dt, T0);
  if (stage3.tick) stage3.tick(dt, T0);
  if (area === 0) pool.update(dt); else river.update(dt);
  for (const c of pool.caustics) { c.offset.x = T0 * .03; c.offset.y = T0 * .02; }
  pool.caustics[1].offset.x = -T0 * .025;
  for (const c of river.caustics) { c.offset.x = T0 * .05; }
  updateBalls(dt, T0);
  updateRiders(dt, T0);
  for (const P of people) if (P.g.visible) P.update(dt, T0);
  for (const A of animals) if (A.g.visible) A.update(dt, T0);
  drops.update(dt); sparks.update(dt); confetti.update(dt);
  updateCam(dt); updateHint();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);


// ---------------------------------------------------------------- start
const startEl = document.getElementById('start');
let started = false;
async function begin() {
  if (started) return; started = true;
  Snd.init();
  startEl.style.transition = 'opacity .4s'; startEl.style.opacity = 0;
  setTimeout(() => startEl.remove(), 450);
  const st = +(QS.get('stage') || 0);
  if (st) quickDress(); else await stageDress();
  if (st <= 1) await stage1();
  if (st <= 2) await stage2();
  await stage3();
}
document.getElementById('go').addEventListener('pointerdown', (e) => { e.preventDefault(); begin(); });
startEl.addEventListener('pointerdown', (e) => { e.preventDefault(); begin(); });
// debug hook for automated screenshots
window.__game = { begin, tap: onTap, hint() { if (!inputOn || !hintFn) return null; const p = hintFn(); return p ? screenOf(p) : null; }, get mine() { return mineCount; } };
