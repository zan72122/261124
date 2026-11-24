// core: renderer, tweens, audio, textures, particles, people, input, hint
import * as THREE from 'three';
import { RoundedBoxGeometry } from './RoundedBoxGeometry.js';
import { RoomEnvironment } from './RoomEnvironment.js';
export { THREE, RoundedBoxGeometry };

// ---------- renderer / scene ----------
export const canvas = document.getElementById('c');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe3ff);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

export const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
scene.add(camera);

export const hemi = new THREE.HemisphereLight(0xdff2ff, 0x6a8a4a, 0.9);
scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xfff3e0, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
sun.shadow.camera.left = -12; sun.shadow.camera.right = 12;
sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun); scene.add(sun.target);
export function aimSun(x, z) {
  sun.position.set(x + 6, 14, z + 9);
  sun.target.position.set(x, 0, z);
}
aimSun(0, 0);

// ---------- time / tween ----------
let tweens = [];
let updaters = new Set();
export const T = { now: 0 };
export const ease = {
  lin: t => t,
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  io: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  back: t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  bounce: t => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375;
    return n * (t -= 2.625 / d) * t + .984375;
  },
};
export function tween(dur, fn, e = ease.io) {
  return new Promise(res => {
    tweens.push({ t: 0, dur: Math.max(dur, 0.0001), fn, e, res });
    fn(0);
  });
}
export function wait(s) { return tween(s, () => {}, ease.lin); }
export function onUpdate(fn) { updaters.add(fn); return () => updaters.delete(fn); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function rand(a, b) { return a + Math.random() * (b - a); }
export function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

// move object along an arc to world position (in parent space of obj)
export function arcTo(obj, to, dur = 0.7, height = 1, e = ease.io, spin = 0) {
  const from = obj.position.clone();
  const r0 = obj.rotation.y;
  return tween(dur, t => {
    obj.position.lerpVectors(from, to, t);
    obj.position.y += Math.sin(Math.PI * t) * height;
    if (spin) obj.rotation.y = r0 + spin * t;
  }, e);
}
export function scaleTo(obj, s, dur = 0.3, e = ease.back) {
  const from = obj.scale.clone();
  const to = typeof s === 'number' ? new THREE.Vector3(s, s, s) : s;
  return tween(dur, t => obj.scale.lerpVectors(from, to, t), e);
}
export function squash(obj, amt = 0.25, dur = 0.45) {
  const s = obj.scale.clone();
  return tween(dur, t => {
    const k = Math.sin(t * Math.PI * 3) * (1 - t) * amt;
    obj.scale.set(s.x * (1 + k), s.y * (1 - k), s.z * (1 + k));
  }, ease.lin).then(() => obj.scale.copy(s));
}

// ---------- camera shots ----------
let shot = null;
const camLook = new THREE.Vector3();
export function shotPose(s) {
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const tv = Math.tan(fov / 2);
  const dist = Math.max(s.h / 2 / tv, s.w / 2 / (tv * camera.aspect)) + (s.pad || 0);
  const dir = s.dir.clone().normalize();
  return { pos: s.look.clone().addScaledVector(dir, dist), look: s.look.clone() };
}
export function setShot(s, dur = 0) {
  const p0 = camera.position.clone(), l0 = camLook.clone();
  shot = s;
  if (!dur) { const p = shotPose(s); camera.position.copy(p.pos); camLook.copy(p.look); camera.lookAt(camLook); return Promise.resolve(); }
  return tween(dur, t => {
    const p = shotPose(s);
    camera.position.lerpVectors(p0, p.pos, t);
    camLook.lerpVectors(l0, p.look, t);
    camera.lookAt(camLook);
  }, ease.io);
}
let shakeAmt = 0;
export function shake(a = 0.08) { shakeAmt = a; }

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (shot) { const p = shotPose(shot); camera.position.copy(p.pos); camLook.copy(p.look); camera.lookAt(camLook); }
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();
export const isPortrait = () => camera.aspect < 1;

// ---------- loop ----------
let last = performance.now();
export let frameHook = null;
export function setFrameHook(f) { frameHook = f; }
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min((now - last) / 1000, 0.05);
  last = now; T.now += dt;
  const live = tweens; tweens = [];
  for (const tw of live) {
    tw.t += dt;
    const k = Math.min(tw.t / tw.dur, 1);
    tw.fn(tw.e(k));
    if (k >= 1) tw.res(); else tweens.push(tw);
  }
  for (const u of updaters) u(dt);
  if (frameHook) frameHook(dt);
  if (shakeAmt > 0.001) {
    camera.position.x += (Math.random() - .5) * shakeAmt;
    camera.position.y += (Math.random() - .5) * shakeAmt;
    shakeAmt *= 0.88;
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);

// ---------- textures ----------
const loader = new THREE.TextureLoader();
export function loadTex(url, repeat = 1, srgb = true) {
  const t = loader.load(url);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  t.anisotropy = 4;
  return t;
}
export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.userData = { canvas: c, g };
  return t;
}

export const TEX = {
  fluff: loadTex('img/fluff.jpg'),
  grass: loadTex('img/grass.jpg', 1),
  yard: loadTex('img/yard.jpg'),
  pool: loadTex('img/pool.jpg'),
};
TEX.fluff.wrapS = TEX.fluff.wrapT = THREE.RepeatWrapping;
TEX.grass.wrapS = TEX.grass.wrapT = THREE.RepeatWrapping;
TEX.grass.repeat.set(18, 18);

// soft fluffy material, uv scale controlled by repeat
const fluffCache = {};
export function fluffMat(tint = 0xffffff, rep = 1) {
  const k = tint + '_' + rep;
  if (fluffCache[k]) return fluffCache[k];
  const map = TEX.fluff.clone(); map.needsUpdate = true; map.repeat.set(rep, rep);
  const m = new THREE.MeshPhysicalMaterial({
    color: tint, map, bumpMap: map, bumpScale: 2.2, roughness: 1, metalness: 0,
    sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xffd1ea), envMapIntensity: 0.6,
  });
  fluffCache[k] = m; return m;
}
export function mat(color, o = {}) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0, envMapIntensity: 0.7 }, o));
}
export function shadowy(obj, cast = true, recv = true) {
  obj.traverse(o => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = recv; } });
  return obj;
}

// sprite textures
export const SPR = {
  soft: canvasTex(64, 64, (g, w) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.5, 'rgba(255,255,255,.7)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  }),
  star: canvasTex(64, 64, g => {
    g.translate(32, 32); g.fillStyle = '#fff'; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 11 : 30; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fill();
  }),
  heart: canvasTex(64, 64, g => {
    g.fillStyle = '#ff4f8b'; g.beginPath(); g.moveTo(32, 56);
    g.bezierCurveTo(-6, 30, 12, 0, 32, 18); g.bezierCurveTo(52, 0, 70, 30, 32, 56); g.fill();
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(20, 22, 6, 4, -0.6, 0, 7); g.fill();
  }),
  drop: canvasTex(64, 64, g => {
    g.fillStyle = '#bfe9ff'; g.beginPath(); g.moveTo(32, 4); g.bezierCurveTo(52, 34, 52, 60, 32, 60); g.bezierCurveTo(12, 60, 12, 34, 32, 4); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(26, 42, 5, 8, 0.3, 0, 7); g.fill();
  }),
};

// ---------- particles ----------
const parts = [];
export function burst(pos, o = {}) {
  const n = o.n || 12;
  for (let i = 0; i < n; i++) {
    const m = new THREE.SpriteMaterial({ map: o.map || SPR.star, color: o.color ? (Array.isArray(o.color) ? pick(o.color) : o.color) : 0xffffff,
      transparent: true, depthWrite: false, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending });
    const s = new THREE.Sprite(m);
    const size = (o.size || 0.15) * rand(0.6, 1.3);
    s.scale.setScalar(size);
    s.position.copy(pos);
    const sp = o.speed || 2;
    const v = new THREE.Vector3(rand(-1, 1), rand(o.up ?? 0.3, 1.2), rand(-1, 1)).normalize().multiplyScalar(sp * rand(0.5, 1));
    s.renderOrder = 10;
    scene.add(s);
    parts.push({ s, v, life: (o.life || 0.9) * rand(0.7, 1.2), age: 0, g: o.gravity ?? 3, size, grow: o.grow || 0 });
  }
}
onUpdate(dt => {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.age += dt;
    p.v.y -= p.g * dt;
    p.v.multiplyScalar(1 - 1.2 * dt);
    p.s.position.addScaledVector(p.v, dt);
    const k = p.age / p.life;
    p.s.material.opacity = 1 - k * k;
    p.s.scale.setScalar(p.size * (1 + p.grow * k));
    p.s.material.rotation += dt * 2;
    if (k >= 1) { scene.remove(p.s); p.s.material.dispose(); parts.splice(i, 1); }
  }
});
export const FX = {
  sparkle: (p, n = 14) => burst(p, { n, map: SPR.star, color: [0xfff59d, 0xffffff, 0xff9ed2, 0x9ee7ff], size: 0.18, speed: 2.2, gravity: 0.5, add: false }),
  puff: (p, n = 10, color = 0xffb6dc, size = 0.5) => burst(p, { n, map: SPR.soft, color, size, speed: 1.6, gravity: -0.3, grow: 1.5, life: 0.8 }),
  hearts: (p, n = 6) => burst(p, { n, map: SPR.heart, size: 0.22, speed: 1.2, gravity: -1.2, up: 0.8, life: 1.4 }),
  drops: (p, n = 16) => burst(p, { n, map: SPR.drop, size: 0.14, speed: 3, gravity: 7, up: 0.6, life: 1 }),
  confetti: (p, n = 40) => burst(p, { n, map: SPR.star, color: [0xff6fb5, 0xffe066, 0x7bdff2, 0xb2f7a5, 0xffffff], size: 0.2, speed: 4.5, gravity: 2.5, up: 0.8, life: 1.8 }),
};

// ---------- audio ----------
let ac = null, master = null, noiseBuf = null;
export function audioInit() {
  if (ac) { if (ac.state !== 'running') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const b = ac.createBufferSource(); b.buffer = ac.createBuffer(1, 1, 22050); b.connect(ac.destination); b.start(0);
}
document.addEventListener('visibilitychange', () => { if (ac && document.visibilityState === 'visible') ac.resume(); });
function tone(f, d, type = 'sine', v = 0.25, f2 = null, delay = 0) {
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + d + 0.05);
}
function noise(d, v = 0.2, f = 1200, ftype = 'lowpass', delay = 0, f2 = null, q = 1) {
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const fl = ac.createBiquadFilter(); fl.type = ftype; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + d);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  s.connect(fl); fl.connect(g); g.connect(master); s.start(t0, Math.random() * 0.5); s.stop(t0 + d + 0.05);
}
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
export const SFX = {
  tap: () => tone(880, 0.06, 'sine', 0.12, 1100),
  pop: () => { tone(500, 0.09, 'sine', 0.3, 1300); },
  poof: () => { noise(0.35, 0.25, 2500, 'lowpass', 0, 300); tone(320, 0.18, 'triangle', 0.15, 620); },
  boing: () => { tone(180, 0.18, 'sine', 0.3, 520); tone(520, 0.25, 'sine', 0.2, 260, 0.16); },
  whoosh: () => noise(0.45, 0.2, 400, 'bandpass', 0, 3000, 2),
  scoop: () => { noise(0.18, 0.18, 900, 'lowpass', 0, 300); tone(420, 0.15, 'sine', 0.2, 260, 0.05); },
  squirt: () => { noise(0.4, 0.2, 700, 'bandpass', 0, 300, 4); },
  sprinkle: () => { for (let i = 0; i < 8; i++) tone(rand(2000, 3600), 0.05, 'sine', 0.06, null, i * 0.04); },
  plop: () => { tone(300, 0.12, 'sine', 0.3, 120); },
  pip: () => { tone(2100, 0.13, 'square', 0.12); },
  ching: () => { tone(NOTE(84), 0.5, 'triangle', 0.2); tone(NOTE(88), 0.6, 'triangle', 0.18, null, 0.07); noise(0.15, 0.08, 6000, 'highpass'); },
  happy: () => { [72, 76, 79, 84].forEach((n, i) => tone(NOTE(n), 0.22, 'triangle', 0.18, null, i * 0.08)); },
  yay: (p = 1) => { tone(520 * p, 0.14, 'triangle', 0.18, 900 * p); tone(700 * p, 0.2, 'triangle', 0.18, 1100 * p, 0.15); },
  are: (p = 1) => { tone(560 * p, 0.12, 'triangle', 0.2, 520 * p); tone(440 * p, 0.32, 'triangle', 0.2, 700 * p, 0.16); },
  sad: () => { tone(560, 0.5, 'triangle', 0.18, 300); },
  splat: () => { noise(0.3, 0.3, 700, 'lowpass', 0, 150); tone(160, 0.2, 'sine', 0.25, 60); },
  slip: () => { tone(300, 0.35, 'sine', 0.22, 1400); tone(1400, 0.4, 'sine', 0.2, 250, 0.35); },
  splash: () => { noise(1.0, 0.45, 3000, 'lowpass', 0, 250); noise(0.4, 0.2, 5000, 'highpass', 0.05); tone(120, 0.3, 'sine', 0.3, 50); },
  giggle: (p = 1) => { for (let i = 0; i < 5; i++) tone((i % 2 ? 760 : 900) * p, 0.08, 'triangle', 0.14, null, i * 0.09); },
  laugh: (p = 1) => { for (let i = 0; i < 4; i++) tone((620 - i * 30) * p, 0.1, 'sawtooth', 0.05, null, i * 0.13), tone((620 - i * 30) * p, 0.1, 'triangle', 0.15, null, i * 0.13); },
  wipe: () => noise(0.15, 0.12, 1800, 'bandpass', 0, 3000, 3),
  sparkle: () => { for (let i = 0; i < 6; i++) tone(rand(1800, 3200), 0.15, 'sine', 0.07, null, i * 0.05); },
  bird: () => { const b = rand(2600, 3400); for (let i = 0; i < 3; i++) tone(b, 0.08, 'sine', 0.035, b * 1.3, i * 0.13); },
  block: () => { tone(260, 0.09, 'square', 0.06, 180); noise(0.08, 0.15, 900); },
  dig: () => { noise(0.16, 0.22, 1400, 'lowpass', 0, 400); tone(140, 0.1, 'triangle', 0.12, 90); },
  thud: () => { tone(110, 0.25, 'sine', 0.35, 50); noise(0.2, 0.2, 400); },
  tiptoe: () => { tone(1200, 0.05, 'sine', 0.08); },
  jingle: () => {
    const mel = [[76, 1], [79, 1], [84, 1], [79, 1], [81, 1], [79, 1], [76, 2], [74, 1], [76, 1], [79, 1], [77, 1], [76, 1], [74, 1], [72, 2]];
    let t = 0;
    for (const [n, l] of mel) { tone(NOTE(n), 0.22 * l, 'triangle', 0.16, null, t); tone(NOTE(n + 12), 0.14 * l, 'sine', 0.06, null, t); t += 0.16 * l; }
  },
  fanfare: () => { [[72, 0], [76, .12], [79, .24], [84, .36], [79, .55], [84, .68]].forEach(([n, d]) => { tone(NOTE(n), 0.3, 'triangle', 0.18, null, d); tone(NOTE(n - 12), 0.3, 'sine', 0.1, null, d); }); },
};
setInterval(() => { if (ac && Math.random() < 0.5 && SFX.birdsOn) SFX.bird(); }, 2600);

// ---------- faces ----------
const SKIN = '#f6c9a8';
export function drawFace(g, expr, o = {}) {
  const W = 256, H = 256;
  g.clearRect(0, 0, W, H);
  if (o.fill) { g.fillStyle = o.fill; g.fillRect(0, 0, W, H); }
  const ink = '#3a2418';
  const eyeY = o.eyeY || 118, ex = o.eyeX || 46, cx = 128;
  g.lineCap = 'round'; g.lineJoin = 'round';
  // cheeks
  g.fillStyle = 'rgba(255,120,140,0.45)';
  g.beginPath(); g.ellipse(cx - ex - 20, eyeY + 32, 20, 12, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(cx + ex + 20, eyeY + 32, 20, 12, 0, 0, 7); g.fill();
  const eye = (x, kind) => {
    g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 7;
    if (kind === 'closed') { g.beginPath(); g.arc(x, eyeY + 6, 14, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); return; }
    if (kind === 'blink') { g.beginPath(); g.moveTo(x - 13, eyeY + 2); g.lineTo(x + 13, eyeY + 2); g.stroke(); return; }
    if (kind === 'squeeze') { g.beginPath(); g.moveTo(x - 12, eyeY - 8); g.lineTo(x + 8, eyeY); g.lineTo(x - 12, eyeY + 8); g.stroke(); return; }
    const big = kind === 'wide' ? 1.25 : 1;
    g.beginPath(); g.ellipse(x, eyeY, 12 * big, 17 * big, 0, 0, 7); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(x + 4, eyeY - 7, 5 * big, 0, 7); g.fill();
    g.beginPath(); g.arc(x - 4, eyeY + 6, 2.5 * big, 0, 7); g.fill();
  };
  const brow = (x, dy, tilt) => {
    g.strokeStyle = o.brow || '#6b4430'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(x - 14, eyeY - 30 + dy - tilt); g.lineTo(x + 14, eyeY - 30 + dy + tilt); g.stroke();
  };
  const my = eyeY + 52;
  g.strokeStyle = ink; g.lineWidth = 7; g.fillStyle = '#c0394b';
  switch (expr) {
    case 'smile': eye(cx - ex); eye(cx + ex); g.beginPath(); g.arc(cx, my - 16, 22, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); break;
    case 'blink': eye(cx - ex, 'blink'); eye(cx + ex, 'blink'); g.beginPath(); g.arc(cx, my - 16, 22, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); break;
    case 'happy':
    case 'laugh': {
      eye(cx - ex, expr === 'laugh' ? 'closed' : undefined); eye(cx + ex, expr === 'laugh' ? 'closed' : undefined);
      g.beginPath(); g.moveTo(cx - 28, my - 6); g.quadraticCurveTo(cx, my + 44, cx + 28, my - 6); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ff8fa3'; g.beginPath(); g.ellipse(cx, my + 14, 12, 7, 0, 0, 7); g.fill();
      break;
    }
    case 'wow':
      eye(cx - ex, 'wide'); eye(cx + ex, 'wide'); brow(cx - ex, -6, 0); brow(cx + ex, -6, 0);
      g.beginPath(); g.ellipse(cx, my + 4, 13, 17, 0, 0, 7); g.fill(); g.stroke(); break;
    case 'are': // puzzled "huh?"
      eye(cx - ex); eye(cx + ex, 'wide'); brow(cx - ex, 4, 4); brow(cx + ex, -10, -5);
      g.beginPath(); g.moveTo(cx - 18, my); g.quadraticCurveTo(cx - 8, my - 10, cx, my); g.quadraticCurveTo(cx + 8, my + 10, cx + 18, my); g.stroke();
      g.fillStyle = '#8fd3ff'; g.beginPath(); g.moveTo(cx + ex + 44, eyeY - 40); g.quadraticCurveTo(cx + ex + 58, eyeY - 14, cx + ex + 44, eyeY - 10); g.quadraticCurveTo(cx + ex + 30, eyeY - 14, cx + ex + 44, eyeY - 40); g.fill();
      break;
    case 'sad':
      eye(cx - ex); eye(cx + ex); brow(cx - ex, 0, 6); brow(cx + ex, 0, -6);
      g.beginPath(); g.arc(cx, my + 16, 20, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke();
      g.fillStyle = '#8fd3ff'; g.beginPath(); g.ellipse(cx - ex + 2, eyeY + 28, 6, 10, 0, 0, 7); g.fill(); break;
    case 'oops':
      eye(cx - ex, 'squeeze'); g.save(); g.translate(2 * cx, 0); g.scale(-1, 1); eye(cx - ex, 'squeeze'); g.restore();
      g.beginPath(); g.moveTo(cx - 22, my); g.lineTo(cx + 22, my); g.stroke();
      g.fillStyle = '#8fd3ff'; g.beginPath(); g.ellipse(cx + ex + 42, eyeY - 24, 7, 11, 0, 0, 7); g.fill(); break;
    case 'yum':
      eye(cx - ex, 'closed'); eye(cx + ex, 'closed');
      g.beginPath(); g.arc(cx, my - 16, 22, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
      g.fillStyle = '#ff7a95'; g.beginPath(); g.ellipse(cx + 10, my + 8, 9, 11, 0, 0, 7); g.fill(); break;
  }
  if (o.glasses) {
    g.strokeStyle = '#7a5a3a'; g.lineWidth = 5;
    g.beginPath(); g.arc(cx - ex, eyeY, 26, 0, 7); g.stroke();
    g.beginPath(); g.arc(cx + ex, eyeY, 26, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(cx - ex + 26, eyeY); g.lineTo(cx + ex - 26, eyeY); g.stroke();
  }
  if (o.mustache) {
    g.fillStyle = '#5a3a26'; g.beginPath(); g.ellipse(cx - 16, eyeY + 40, 18, 8, 0.2, 0, 7); g.ellipse(cx + 16, eyeY + 40, 18, 8, -0.2, 0, 7); g.fill();
  }
}

// ---------- people ----------
function capsule(r, len, m) {
  const g = new THREE.CapsuleGeometry(r, len, 6, 12);
  const mesh = new THREE.Mesh(g, m); return mesh;
}
export function makePerson(o) {
  const s = o.size || 1; // 1 = 5yo child (1.1m)
  const P = new THREE.Group();
  const body = new THREE.Group(); P.add(body);
  const skin = mat(o.skin || SKIN, { roughness: 0.75 });
  const shirt = o.shirtMat || mat(o.shirt || 0x7ec8ff, { roughness: 0.85 });
  const pants = mat(o.pants || 0x3b5b8c, { roughness: 0.9 });
  const shoe = mat(o.shoe || 0xffffff, { roughness: 0.5 });
  const hairM = mat(o.hair || 0x5a3420, { roughness: 0.7 });
  const legLen = o.legLen || 0.34, torsoLen = o.torsoLen || 0.28, headR = o.headR || 0.17;
  const hipY = legLen + 0.06;
  // legs
  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(side * 0.07 * (o.wide || 1), hipY, 0);
    const leg = capsule(0.055, legLen - 0.1, o.bareLegs ? skin : pants); leg.position.y = -legLen / 2 + 0.02; pivot.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), shoe); foot.scale.set(1, 0.6, 1.5); foot.position.set(0, -legLen + 0.03, 0.03); pivot.add(foot);
    body.add(pivot); legs.push(pivot);
  }
  // torso
  const torsoR = o.torsoR || 0.13;
  const torso = capsule(torsoR, torsoLen, shirt); torso.position.y = hipY + torsoLen / 2 + 0.06; torso.scale.z = 0.8; body.add(torso);
  if (o.skirt) {
    const sk = new THREE.Mesh(new THREE.CylinderGeometry(torsoR * 0.95, torsoR * 1.7, 0.22, 20, 1, true), o.skirtMat || mat(o.skirt, { side: THREE.DoubleSide, roughness: 0.9 }));
    sk.position.y = hipY + 0.02; body.add(sk);
  }
  // apron slot
  const apronSlot = new THREE.Group(); apronSlot.position.y = torso.position.y; body.add(apronSlot);
  // arms
  const arms = [];
  const shoulderY = hipY + torsoLen + 0.08;
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(side * (torsoR + 0.05), shoulderY, 0);
    const armLen = o.armLen || 0.3;
    const arm = capsule(0.045, armLen - 0.08, shirt); arm.position.y = -armLen / 2; pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), skin); hand.position.y = -armLen; pivot.add(hand);
    const grip = new THREE.Group(); grip.position.set(0, -armLen - 0.02, 0.04); pivot.add(grip);
    pivot.rotation.z = side * 0.18;
    body.add(pivot); arms.push({ pivot, grip, side });
  }
  // head
  const head = new THREE.Group(); head.position.y = shoulderY + headR * 0.95; body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(headR, 32, 24), skin); head.add(skull);
  const faceTex = canvasTex(256, 256, () => {});
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const face = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.005, 32, 24, Math.PI / 2 - 1.1, 2.2, 0.55, 1.65), faceMat);
  head.add(face);
  // ears
  for (const side of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.22, 10, 8), skin); e.position.set(side * headR * 0.98, -headR * 0.05, 0); e.scale.z = 0.6; head.add(e); }
  // nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.1, 10, 8), skin); nose.position.set(0, -headR * 0.12, headR * 0.98); head.add(nose);
  // hair
  const hairStyle = o.hairStyle || 'short';
  if (hairStyle !== 'bald') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.07, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), hairM);
    cap.rotation.x = -0.25; head.add(cap);
    const back = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.06, 24, 16, Math.PI * 1.15, Math.PI * 0.7, 0.2, Math.PI * 0.55), hairM);
    head.add(back);
    if (hairStyle === 'pigtails') {
      for (const side of [-1, 1]) {
        const tie = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), fluffMat(0xffffff, 0.2)); tie.position.set(side * headR * 1.02, headR * 0.15, -headR * 0.3); head.add(tie);
        const tail = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), hairM); tail.scale.set(0.8, 1.4, 0.8); tail.position.set(side * headR * 1.22, -headR * 0.15, -headR * 0.35); tail.rotation.z = side * 0.4; head.add(tail);
      }
    } else if (hairStyle === 'bun') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.45, 14, 10), hairM); bun.position.set(0, headR * 0.85, -headR * 0.45); head.add(bun);
    } else if (hairStyle === 'long') {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.95, headR * 1.15, headR * 1.8, 20, 1, true, Math.PI * 0.6, Math.PI * 1.8), hairM);
      l.material = hairM; l.position.set(0, -headR * 0.55, -headR * 0.05); head.add(l);
      hairM.side = THREE.DoubleSide;
    }
  }
  if (o.capColor) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), mat(o.capColor)); c.rotation.x = -0.15; head.add(c);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.7, headR * 0.7, 0.02, 20, 1, false, 0, Math.PI), mat(o.capColor)); brim.position.set(0, headR * 0.45, headR * 0.65); brim.rotation.y = Math.PI / 2 * 0; brim.rotation.y = -Math.PI / 2; head.add(brim);
  }
  const hatSlot = new THREE.Group(); hatSlot.position.y = headR * 0.75; head.add(hatSlot);

  const faceOpts = { glasses: o.glasses, mustache: o.mustache };
  P.scale.setScalar(s);
  shadowy(P, true, false);
  face.castShadow = false;

  const st = { expr: 'smile', exprUntil: 0, pose: 'idle', poseUntil: 0, walk: 0, t: Math.random() * 10, blinkAt: 2, look: 0, baseY: 0, faceTarget: null };
  function paint(e) { drawFace(faceTex.userData.g, e, faceOpts); faceTex.needsUpdate = true; }
  paint('smile');
  const api = {
    root: P, body, head, arms, legs, hatSlot, apronSlot, torso, st, s,
    face(e, dur = 0) { st.expr = e; st.exprUntil = dur ? T.now + dur : 0; paint(e); },
    pose(p, dur = 1.2) { st.pose = p; st.poseUntil = T.now + dur; st.poseT = 0; },
    lookAt(x) { st.look = x; },
    hand(side = 1) { return arms[side > 0 ? 1 : 0].grip; },
    async walkTo(x, z, speed = 1.4) {
      const from = P.position.clone(), to = new THREE.Vector3(x, P.position.y, z);
      const d = from.distanceTo(to); if (d < 0.01) return;
      const dir = Math.atan2(to.x - from.x, to.z - from.z);
      P.rotation.y = dir; st.walk = 1;
      await tween(d / speed, t => P.position.lerpVectors(from, to, t), ease.lin);
      st.walk = 0;
    },
    turn(r, dur = 0.3) { const a = P.rotation.y; let b = r; while (b - a > Math.PI) b -= Math.PI * 2; while (b - a < -Math.PI) b += Math.PI * 2; return tween(dur, t => P.rotation.y = lerp(a, b, t)); },
    update(dt) {
      st.t += dt;
      if (st.exprUntil && T.now > st.exprUntil) { st.exprUntil = 0; st.expr = o.defaultFace || 'smile'; paint(st.expr); }
      if (st.poseUntil && T.now > st.poseUntil) { st.pose = 'idle'; st.poseUntil = 0; }
      st.poseT = (st.poseT || 0) + dt;
      // blink
      if (st.t > st.blinkAt && (st.expr === 'smile')) { paint('blink'); st.blinkAt = st.t + rand(2, 4.5); setTimeout(() => { if (st.expr === 'smile') paint('smile'); }, 130); }
      const t = st.t;
      let by = 0, aL = 0.18, aR = -0.18, aLx = 0, aRx = 0, lean = 0, headTilt = 0, legSw = 0;
      if (st.walk) {
        legSw = Math.sin(t * 10) * 0.6; aLx = Math.sin(t * 10) * 0.5; aRx = -aLx; by = Math.abs(Math.sin(t * 10)) * 0.03;
      } else by = Math.sin(t * 2) * 0.006;
      switch (st.pose) {
        case 'cheer': aL = 2.7 + Math.sin(t * 14) * 0.2; aR = -2.7 - Math.sin(t * 14) * 0.2; by = Math.abs(Math.sin(t * 9)) * 0.12; break;
        case 'wave': aR = -2.4 + Math.sin(t * 12) * 0.35; break;
        case 'reach': aRx = -1.3; aR = -0.3; lean = 0.12; break;
        case 'reach2': aRx = -1.4; aLx = -1.4; lean = 0.1; break;
        case 'hold': aRx = -1.0; break;
        case 'clap': { const k = Math.abs(Math.sin(t * 12)); aLx = -1.2; aRx = -1.2; aL = 0.6 * k - 0.3; aR = -0.6 * k + 0.3; by = k * 0.02; break; }
        case 'point': aR = -1.5; aRx = -0.4; break;
        case 'sad': aL = 0.1; aR = -0.1; lean = 0.15; headTilt = 0.25; break;
        case 'shrug': aL = 1.0; aR = -1.0; headTilt = 0.15 * Math.sin(t * 3); break;
        case 'think': aRx = -2.2; aR = 0.4; headTilt = 0.25; break;
        case 'jump': by = Math.max(0, Math.sin(st.poseT * 8)) * 0.25; aL = 2.4; aR = -2.4; break;
        case 'lick': aRx = -1.6; aR = 0.35; headTilt = -0.1; by = Math.abs(Math.sin(t * 5)) * 0.02; break;
        case 'swim': aL = 2.2 + Math.sin(t * 8) * 0.6; aR = -2.2 - Math.sin(t * 8) * 0.6; break;
        case 'tiptoe': aL = 1.2; aR = -1.2; aLx = -0.4; aRx = -0.4; legSw = Math.sin(t * 6) * 0.3; by = 0.04 + Math.abs(Math.sin(t * 6)) * 0.04; break;
      }
      arms[0].pivot.rotation.z = lerp(arms[0].pivot.rotation.z, aL, 0.25);
      arms[1].pivot.rotation.z = lerp(arms[1].pivot.rotation.z, aR, 0.25);
      arms[0].pivot.rotation.x = lerp(arms[0].pivot.rotation.x, aLx, 0.25);
      arms[1].pivot.rotation.x = lerp(arms[1].pivot.rotation.x, aRx, 0.25);
      legs[0].rotation.x = legSw; legs[1].rotation.x = -legSw;
      body.position.y = st.baseY + by;
      body.rotation.x = st.leanOverride != null ? st.leanOverride : lerp(body.rotation.x, lean, 0.2);
      head.rotation.z = lerp(head.rotation.z, headTilt, 0.2);
      head.rotation.y = lerp(head.rotation.y, st.look, 0.15);
    },
  };
  onUpdate(dt => { if (P.visible) api.update(dt); });
  return api;
}

// ---------- input ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let tappables = [];
export const input = { enabled: true, lastAct: 0, onAny: null, onMove: null, down: false };
export function tappable(obj, fn, opt = {}) {
  obj.userData.tap = fn; obj.userData.tapOpt = opt;
  tappables.push(obj);
  return obj;
}
export function untappable(obj) { tappables = tappables.filter(o => o !== obj); delete obj.userData.tap; }
export function clearTappables() { tappables = []; }
function visibleDeep(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }
export function pickAt(x, y, list) {
  ndc.set(x / window.innerWidth * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(list, true);
  for (const h of hits) { if (visibleDeep(h.object) || h.object.userData.proxy) return h; }
  return null;
}
function findTap(o) { while (o) { if (o.userData.tap) return o; o = o.parent; } return null; }
const ripple = document.getElementById('ripple');
function showRipple(x, y) {
  const d = document.createElement('div'); d.className = 'rip'; d.style.left = x + 'px'; d.style.top = y + 'px';
  ripple.appendChild(d); setTimeout(() => d.remove(), 600);
}
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  audioInit();
  input.down = true;
  showRipple(e.clientX, e.clientY);
  if (!input.enabled) return;
  input.lastAct = T.now;
  const live = tappables.filter(o => visibleDeep(o) || o.userData.proxy);
  const h = pickAt(e.clientX, e.clientY, live);
  if (h) {
    const o = findTap(h.object);
    if (o) { o.userData.tap(h, e); return; }
  }
  if (input.onAny) input.onAny(e);
}, { passive: false });
canvas.addEventListener('pointermove', e => { if (input.down && input.onMove && input.enabled) input.onMove(e); });
window.addEventListener('pointerup', () => { input.down = false; });
window.addEventListener('pointercancel', () => { input.down = false; });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
let lastTouch = 0;
document.addEventListener('touchend', e => { const n = Date.now(); if (n - lastTouch < 350) e.preventDefault(); lastTouch = n; }, { passive: false });

// ---------- hint hand ----------
const hintEl = document.getElementById('hint');
const HINT_DELAY = /[?&]fast/.test(location.search) ? 0.6 : 3.5;
let hintFn = null;
export function setHint(fn) { hintFn = fn; input.lastAct = T.now; }
const hv = new THREE.Vector3();
onUpdate(() => {
  let target = null;
  if (hintFn && input.enabled && T.now - input.lastAct > HINT_DELAY) target = hintFn();
  if (!target) { hintEl.style.opacity = 0; hintEl.dataset.x = ''; return; }
  if (target.isObject3D) target.getWorldPosition(hv); else hv.copy(target);
  hv.project(camera);
  if (hv.z > 1) { hintEl.style.opacity = 0; return; }
  const x = (hv.x + 1) / 2 * window.innerWidth, y = (1 - hv.y) / 2 * window.innerHeight;
  const b = Math.abs(Math.sin(T.now * 4)) * 18;
  hintEl.style.opacity = 1; hintEl.dataset.x = x; hintEl.dataset.y = y;
  hintEl.style.transform = `translate(${x - 8}px, ${y + 6 + b}px)`;
});

// glow pulse helper: makes obj gently bob/pulse while flag true
export function pulse(obj, on = true) {
  if (obj.userData.pulseOff) { obj.userData.pulseOff(); obj.userData.pulseOff = null; obj.scale.copy(obj.userData.pulseBase); }
  if (!on) return;
  const base = obj.scale.clone(); obj.userData.pulseBase = base;
  const t0 = T.now;
  obj.userData.pulseOff = onUpdate(() => { const k = 1 + Math.sin((T.now - t0) * 6) * 0.06; obj.scale.set(base.x * k, base.y * k, base.z * k); });
}

// fade overlay
const fadeEl = document.getElementById('fade');
export function fade(to, dur = 0.5) { fadeEl.style.transition = `opacity ${dur}s`; fadeEl.style.opacity = to; return wait(dur); }
