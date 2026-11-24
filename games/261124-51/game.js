// 3つのおうちづくり — 場面の進行・入力・カメラ
import * as THREE from './three.module.min.js';
import { audioInit, sfx, makeLoop, musicStart } from './audio.js';
import { W, D, H, T, R, BASE, DOOR_X0, tex, canvasTex, rbox, planarUV, mesh, makeKit, makePieces, makePile, Person, Dog } from './build.js';

const V3 = THREE.Vector3;
const Q = new URLSearchParams(location.search);
let timeScale = Number(Q.get('speed')) || 1;

// ---------- レンダラー ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: Q.has('shot') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc3f0);
scene.fog = new THREE.Fog(0xa8c294, 30, 75);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);

// 環境光（空のグラデーションから）
{
  const es = new THREE.Scene();
  const gt = canvasTex(8, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#5f9fe0'); g.addColorStop(0.45, '#cfe6ff'); g.addColorStop(0.52, '#f4f1e6'); g.addColorStop(0.56, '#6f8f4f'); g.addColorStop(1, '#3d5a2c');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  es.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ map: gt, side: THREE.BackSide })));
  const sun = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.95, 0.85).multiplyScalar(30) }));
  sun.position.set(9, 13, 9); es.add(sun);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(es, 0.03).texture;
  scene.environmentIntensity = 0.7;
}
scene.add(new THREE.HemisphereLight(0xdfeeff, 0x5d7a3e, 0.55));
const sunL = new THREE.DirectionalLight(0xfff0da, 2.4);
sunL.position.set(6, 11, 8); sunL.castShadow = true;
sunL.shadow.mapSize.set(2048, 2048);
Object.assign(sunL.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
sunL.shadow.bias = -0.0004; sunL.shadow.normalBias = 0.02;
scene.add(sunL);

// ---------- 庭 ----------
{
  const sky = tex('sky');
  const sm = new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, fog: false, toneMapped: false });
  sm.color.setScalar(0.92);
  const th = 2.6;
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(60, 60, 60 / 2.4 * th / 1.05, 48, 1, true, Math.PI - th / 2, th), sm);
  cyl.position.set(0, 60 / 2.4 * th / 1.05 / 2 - 4, 0);
  sky.wrapS = THREE.RepeatWrapping; sky.repeat.x = -1;
  scene.add(cyl);
  const gt = tex('grass', 45);
  const ground = mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshStandardMaterial({ map: gt, roughness: 1, color: 0xe8ffe0 }), { cast: false });
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  // 木の塀
  const wood = tex('wood', 10, 1);
  const fence = mesh(new THREE.BoxGeometry(34, 1.7, 0.08), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.85 }));
  fence.position.set(0, 0.85, -9); scene.add(fence);
  for (const s of [-1, 1]) {
    const w2 = tex('wood', 5, 1);
    const f2 = mesh(new THREE.BoxGeometry(0.08, 1.7, 16), new THREE.MeshStandardMaterial({ map: w2, roughness: 0.85 }));
    f2.position.set(s * 17, 0.85, -1); scene.add(f2);
  }
  // 小道
  const pv = tex('paving', 1.2, 8);
  const path = mesh(new THREE.PlaneGeometry(1.2, 9), new THREE.MeshStandardMaterial({ map: pv, roughness: 0.9 }), { cast: false });
  path.rotation.x = -Math.PI / 2; path.position.set(-0.8, 0.005, D / 2 + 4.6); scene.add(path);
  // 茂みと木
  const leaf = new THREE.MeshStandardMaterial({ color: 0x3f7a32, roughness: 0.9 });
  const leaf2 = new THREE.MeshStandardMaterial({ color: 0x5a9a3a, roughness: 0.9 });
  const bush = (x, z, s) => {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const geo = new THREE.SphereGeometry(s * (0.6 + Math.random() * 0.4), 24, 16);
      const p = geo.attributes.position, ph = Math.random() * 9;
      for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k), z = p.getZ(k); const f = 1 + 0.07 * Math.sin(x * 11 / s + ph) * Math.sin(y * 13 / s) * Math.sin(z * 12 / s + ph) + 0.05 * Math.sin(x * 23 / s + y * 19 / s); p.setXYZ(k, x * f, y * f, z * f); }
      geo.computeVertexNormals();
      const m = mesh(geo, i % 2 ? leaf : leaf2); m.position.set((Math.random() - 0.5) * s * 1.6, s * 0.6 + Math.random() * s * 0.4, (Math.random() - 0.5) * s); g.add(m);
    }
    g.position.set(x, 0, z); scene.add(g); return g;
  };
  [[-6, -8, 0.9], [-3.5, -8.2, 0.7], [4, -8, 0.8], [7, -7.8, 1.0], [10, -8, 0.8], [-9, -7.6, 1.1], [-11, -3, 0.9], [11.5, -2, 1.0]].forEach(a => bush(...a));
  const tree = (x, z, s) => {
    const trunk = mesh(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 2.6 * s, 12), new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 }));
    trunk.position.set(x, 1.3 * s, z); scene.add(trunk);
    const crown = bush(x, z, 1.3 * s); crown.position.y = 2.0 * s;
  };
  tree(-6.5, -5, 1.2); tree(7.5, -5.5, 1.0);
  // 花
  const fcols = [0xff5f8f, 0xffd54f, 0xffffff, 0xba68c8];
  const stem = new THREE.MeshStandardMaterial({ color: 0x3f8a3a });
  for (let i = 0; i < 40; i++) {
    const x = (Math.random() - 0.5) * 30, z = -8.6 + Math.random() * 0.9;
    const s = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 4), stem, { cast: false }); s.position.set(x, 0.15, z); scene.add(s);
    const f = mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: fcols[i % 4], roughness: 0.6 }), { cast: false });
    f.position.set(x, 0.32, z); scene.add(f);
  }
  // 家の土台（ウッドデッキ）
  const dw = tex('wood', 3);
  const deck = mesh(rbox(W + 0.4, 0.12, D + 0.3, 0.02), new THREE.MeshStandardMaterial({ map: dw, roughness: 0.8, color: 0xe6d2b6 }));
  planarUV(deck.geometry, 0.5); deck.position.set(0, BASE - 0.06, 0); scene.add(deck);
}

// ---------- ユーティリティ ----------
const ease = { io: k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, out: k => 1 - Math.pow(1 - k, 3), lin: k => k, back: k => { const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); } };
const tweens = [];
function tween(dur, fn, e = ease.io) { return new Promise(res => tweens.push({ t: 0, dur: Math.max(dur, 1e-4), fn, e, res })); }
const wait = s => tween(s, () => {});
const updaters = new Set();
let busy = 0;
async function cut(fn) { busy++; try { return await fn(); } finally { busy--; } }

function toScreen(v) { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight, z: p.z }; }
const ray = new THREE.Raycaster();
function setRay(x, y) { ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), camera); return ray; }

async function flyTo(obj, parent, lpos, lquat, lscale, dur = 0.8, arc = 1.2, e = ease.io) {
  scene.attach(obj);
  const p0 = obj.position.clone(), q0 = obj.quaternion.clone(), s0 = obj.scale.clone();
  const pw = new V3(), qw = new THREE.Quaternion(), sw = new V3();
  await tween(dur, k => {
    parent.updateWorldMatrix(true, false);
    pw.copy(lpos).applyMatrix4(parent.matrixWorld);
    parent.getWorldQuaternion(qw).multiply(lquat);
    parent.getWorldScale(sw).multiply(lscale);
    obj.position.lerpVectors(p0, pw, k); obj.position.y += Math.sin(k * Math.PI) * arc;
    obj.quaternion.slerpQuaternions(q0, qw, k); obj.scale.lerpVectors(s0, sw, k);
  }, e);
  parent.add(obj); obj.position.copy(lpos); obj.quaternion.copy(lquat); obj.scale.copy(lscale);
}
const qY = a => new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), a);

// ---------- パーティクル ----------
class Particles {
  constructor(max, geo, mat, grav = -9.8) {
    this.im = new THREE.InstancedMesh(geo, mat, max); this.im.frustumCulled = false; this.im.castShadow = false;
    this.max = max; this.grav = grav; this.p = []; this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler();
    for (let i = 0; i < max; i++) { this.p.push({ life: 0 }); this.im.setColorAt(i, new THREE.Color(1, 1, 1)); }
    this.i = 0; scene.add(this.im); updaters.add(dt => this.update(dt));
  }
  emit(pos, vel, life, size, color, spin = 0) {
    const p = this.p[this.i]; this.i = (this.i + 1) % this.max;
    p.pos = pos.clone(); p.vel = vel.clone(); p.life = life; p.max = life; p.size = size; p.rot = new V3(Math.random() * 6, Math.random() * 6, 0); p.spin = spin;
    if (color !== undefined) { this.im.setColorAt(this.p.indexOf(p), new THREE.Color(color)); this.im.instanceColor.needsUpdate = true; }
    return p;
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i];
      if (p.life > 0) {
        p.life -= dt; p.vel.y += this.grav * dt; p.pos.addScaledVector(p.vel, dt);
        if (p.pos.y < 0.02) { p.pos.y = 0.02; p.vel.multiplyScalar(0.3); }
        p.rot.x += p.spin * dt; p.rot.y += p.spin * 0.7 * dt;
        const s = p.size * Math.min(1, p.life / p.max * 3);
        this.q.setFromEuler(this.e.set(p.rot.x, p.rot.y, 0));
        this.m.compose(p.pos, this.q, new V3(s, s, s));
      } else this.m.makeScale(0, 0, 0);
      this.im.setMatrixAt(i, this.m);
    }
    this.im.instanceMatrix.needsUpdate = true;
  }
}
const puff = new Particles(120, new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.8 }), 1.5);
const confetti = new Particles(220, new THREE.PlaneGeometry(1, 0.6), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6 }), -2.2);
const foamSpray = new Particles(260, new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, emissive: 0x333333 }), -3);
const water = new Particles(260, new THREE.SphereGeometry(1, 8, 6), new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, roughness: 0.05, transparent: true, opacity: 0.75, emissive: 0x18304a }), -9.8);

function dust(pos, n = 10, s = 0.12) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    puff.emit(pos.clone().add(new V3(Math.cos(a) * 0.2, 0.05, Math.sin(a) * 0.2)), new V3(Math.cos(a) * 1.2, 0.6 + Math.random(), Math.sin(a) * 1.2), 0.6 + Math.random() * 0.3, s * (0.6 + Math.random()));
  }
}
function confettiBurst(center, n = 120) {
  const cols = [0xff5f8f, 0xffd54f, 0x4fc3f7, 0x81c784, 0xba68c8, 0xff8a65];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 2.5;
    confetti.emit(center.clone(), new V3(Math.cos(a) * sp, 3 + Math.random() * 3, Math.sin(a) * sp * 0.6 + 0.8), 2.5 + Math.random(), 0.07, cols[i % 6], 8);
  }
}
// キラキラ
const starTex = canvasTex(64, 64, (x) => {
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,250,210,.8)'); g.addColorStop(1, 'rgba(255,240,150,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#fff'; x.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 6 : 31; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
  x.fill();
});
const sparks = [];
for (let i = 0; i < 70; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: 0xfff6c0 }));
  s.visible = false; s.life = 0; scene.add(s); sparks.push(s);
}
let sparkI = 0;
function sparkle(pos, size = 0.35, life = 0.9) {
  const s = sparks[sparkI = (sparkI + 1) % sparks.length];
  s.position.copy(pos); s.life = life; s.max = life; s.size = size; s.visible = true;
}
updaters.add(dt => sparks.forEach(s => {
  if (!s.visible) return;
  s.life -= dt; if (s.life <= 0) { s.visible = false; return; }
  const k = s.life / s.max, sc = s.size * Math.sin(k * Math.PI) * (1 + 0.2 * Math.sin(s.life * 30));
  s.scale.set(sc, sc, sc); s.material.rotation = k * 3;
}));
function sparkleAround(obj, n = 12, spread = 1) {
  const b = new THREE.Box3().setFromObject(obj), c = b.getCenter(new V3()), sz = b.getSize(new V3()).multiplyScalar(0.5 * spread);
  for (let i = 0; i < n; i++) setTimeout(() => sparkle(c.clone().add(new V3((Math.random() * 2 - 1) * sz.x, (Math.random() * 2 - 1) * sz.y, (Math.random() * 2 - 1) * sz.z + 0.2)), 0.18 + Math.random() * 0.22), i * 40 / timeScale);
}

// ---------- 人物 ----------
const girl = new Person({ kind: 'girl', kid: true, height: 1.12, shirt: 0xfff1a8, skirt: 0x8e5bd6, pants: 0xffffff, hair: 0x3b2416, hairStyle: 'pigtails', shoe: 0xff6fa0 });
const dad = new Person({ kind: 'dad', height: 1.78, shirt: 0x3f7fd0, pants: 0x2f3f5f, hair: 0x2a1a10, longSleeve: true, shoe: 0x5a4636 });
const mom = new Person({ kind: 'mom', height: 1.66, shirt: 0x46b3a2, dress: 0x46b3a2, pants: 0x46b3a2, hair: 0x5a3420, hairStyle: 'long', shoe: 0xffffff });
const boy = new Person({ kind: 'boy', kid: true, height: 0.92, shirt: 0xff7043, pants: 0x355c9a, hair: 0x6b4426, shoe: 0x1e88e5 });
const dog = new Dog();
const people = [girl, dad, mom, boy, dog];
people.forEach(p => scene.add(p.g));
const GIRL_HOME = new V3(2.6, 0, 1.25);
girl.g.position.copy(GIRL_HOME); girl.g.rotation.y = -0.55;
dad.g.position.set(-2.45, 0, 0.85); dad.g.rotation.y = 0.5;
[mom, boy, dog].forEach(p => { p.g.visible = false; p.g.position.set(-9, 0, 3.5); });

function lookAt(p, target) { p.g.rotation.y = Math.atan2(target.x - p.g.position.x, target.z - p.g.position.z); }
async function walkTo(p, x, z, speed = 1.5) {
  const from = p.g.position.clone(), to = new V3(x, from.y, z), d = from.distanceTo(to);
  if (d < 0.01) return;
  lookAt(p, to); p.st.walk = 1;
  let acc = 0;
  await tween(d / speed, k => { p.g.position.lerpVectors(from, to, k); }, ease.lin);
  p.st.walk = 0;
}
// 歩く音
updaters.add(dt => { people.forEach(p => { if (p.st.walk && p.g.visible) { p._st = (p._st || 0) + dt; if (p._st > 0.32) { p._st = 0; sfx.step(); } } }); });

// ---------- 衣装 ----------
const crate = new THREE.Group();
{
  const w = tex('wood');
  const cm = new THREE.MeshStandardMaterial({ map: w, roughness: 0.85, color: 0xd9b991 });
  const b = mesh(rbox(0.6, 0.45, 0.45, 0.02), cm); planarUV(b.geometry, 1.4); b.position.y = 0.225; crate.add(b);
  crate.position.set(1.75, 0, 1.75); crate.rotation.y = -0.3; scene.add(crate);
}
const hat = new THREE.Group();
{
  const r = girl.headR * 1.18;
  const yel = new THREE.MeshPhysicalMaterial({ color: 0xffc61a, roughness: 0.35, clearcoat: 0.8 });
  hat.add(mesh(new THREE.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), yel));
  const brim = mesh(new THREE.CylinderGeometry(r * 1.22, r * 1.25, r * 0.08, 32), yel); brim.position.z = r * 0.15; brim.scale.z = 1.12; hat.add(brim);
  const ridge = mesh(rbox(r * 0.22, r * 0.25, r * 2.0, r * 0.08), yel); ridge.position.y = r * 0.9; hat.add(ridge);
  hat.position.set(-0.12, 0.45, 0.02); crate.add(hat);
}
const vest = new THREE.Group();
{
  const tl = girl.torsoL, tr = girl.torR;
  const om = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.6, side: THREE.DoubleSide });
  const v = mesh(new THREE.CylinderGeometry(tr * 1.25, tr * 1.3, tl * 0.7, 24, 1, true), om); v.scale.set(1.18, 1, 0.86); vest.add(v);
  const sil = new THREE.MeshStandardMaterial({ color: 0xe8eef2, roughness: 0.2, metalness: 0.6, emissive: 0x404040, side: THREE.DoubleSide });
  for (const y of [-0.08, 0.1]) { const b = mesh(new THREE.CylinderGeometry(tr * 1.28, tr * 1.3, tl * 0.08, 24, 1, true), sil); b.scale.set(1.18, 1, 0.86); b.position.y = y * tl * 2; vest.add(b); }
  vest.position.set(0.15, 0.48, 0); vest.rotation.z = Math.PI / 2; vest.scale.setScalar(1);
  crate.add(vest);
}

// ---------- 看板（ルールの絵） ----------
function drawHouse(x, cx, cy, s, wall = '#e8c79a', roof = '#e0565b') {
  x.lineWidth = 6 * s; x.strokeStyle = '#4a3426'; x.lineJoin = 'round';
  x.fillStyle = wall; x.fillRect(cx - 60 * s, cy - 40 * s, 120 * s, 90 * s); x.strokeRect(cx - 60 * s, cy - 40 * s, 120 * s, 90 * s);
  x.fillStyle = roof; x.beginPath(); x.moveTo(cx - 78 * s, cy - 36 * s); x.lineTo(cx, cy - 100 * s); x.lineTo(cx + 78 * s, cy - 36 * s); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#9ad7ff'; x.fillRect(cx + 10 * s, cy - 20 * s, 36 * s, 32 * s); x.strokeRect(cx + 10 * s, cy - 20 * s, 36 * s, 32 * s);
  x.fillStyle = '#b06a3a'; x.fillRect(cx - 44 * s, cy, 34 * s, 50 * s); x.strokeRect(cx - 44 * s, cy, 34 * s, 50 * s);
}
function drawArrow(x, cx, cy) {
  x.fillStyle = '#ff8a00'; x.strokeStyle = '#7a4200'; x.lineWidth = 5;
  x.beginPath(); x.moveTo(cx - 40, cy - 14); x.lineTo(cx + 8, cy - 14); x.lineTo(cx + 8, cy - 32); x.lineTo(cx + 44, cy); x.lineTo(cx + 8, cy + 32); x.lineTo(cx + 8, cy + 14); x.lineTo(cx - 40, cy + 14); x.closePath(); x.fill(); x.stroke();
}
function drawStar(x, cx, cy, r, c = '#ffd84a') {
  x.fillStyle = c; x.strokeStyle = '#c99600'; x.lineWidth = 3; x.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  x.closePath(); x.fill(); x.stroke();
}
function drawPerson(x, cx, cy, s, c) {
  x.fillStyle = '#f3c9a8'; x.strokeStyle = '#4a3426'; x.lineWidth = 4;
  x.beginPath(); x.arc(cx, cy - 40 * s, 16 * s, 0, 7); x.fill(); x.stroke();
  x.fillStyle = c; x.beginPath(); x.moveTo(cx - 18 * s, cy + 20 * s); x.lineTo(cx, cy - 24 * s); x.lineTo(cx + 18 * s, cy + 20 * s); x.closePath(); x.fill(); x.stroke();
}
const SIGNS = {
  build: (x) => {
    [['#c49a64', 40, 205, 60, 46], ['#c49a64', 78, 215, 44, 36], ['#ff9cc0', 56, 168, 52, 40], ['#e53935', 92, 182, 34, 22], ['#fdd835', 30, 180, 30, 22], ['#1e88e5', 100, 160, 30, 22]]
      .forEach(([c, X, Y, w, h]) => { x.fillStyle = c; x.strokeStyle = '#4a3426'; x.lineWidth = 4; x.beginPath(); x.roundRect(X, Y, w, h, 8); x.fill(); x.stroke(); });
    drawArrow(x, 200, 190);
    drawHouse(x, 320, 210, 0.95);
    drawStar(x, 405, 85, 22);
  },
  wash: (x) => {
    x.fillStyle = '#2e9d48'; x.strokeStyle = '#1a5a2a'; x.lineWidth = 5;
    x.beginPath(); x.arc(70, 215, 42, 0, 7); x.fill(); x.stroke();
    x.fillStyle = '#ffd84a'; x.beginPath(); x.roundRect(98, 150, 46, 20, 8); x.fill(); x.stroke();
    x.fillStyle = '#4fc3f7';
    for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(160 + i * 14, 150 - i * 10 + i * i * 3, 8, 0, 7); x.fill(); }
    drawArrow(x, 225, 190);
    drawHouse(x, 345, 215, 0.85);
    drawStar(x, 420, 95, 20); drawStar(x, 280, 110, 14); drawStar(x, 400, 230, 14);
  },
  family: (x) => {
    x.fillStyle = '#b07a48'; x.fillRect(70, 150, 14, 110);
    x.fillStyle = '#fff'; x.strokeStyle = '#4a3426'; x.lineWidth = 5; x.fillRect(22, 90, 110, 80); x.strokeRect(22, 90, 110, 80);
    drawHouse(x, 77, 155, 0.42);
    drawArrow(x, 195, 180);
    drawHouse(x, 340, 210, 0.95);
    drawPerson(x, 260, 245, 0.9, '#3f7fd0'); drawPerson(x, 300, 250, 0.8, '#46b3a2'); drawPerson(x, 420, 255, 0.6, '#ff7043');
  },
};
const ruleSign = new THREE.Group();
const ruleCanvas = document.createElement('canvas'); ruleCanvas.width = 480; ruleCanvas.height = 300;
const ruleTex = new THREE.CanvasTexture(ruleCanvas); ruleTex.colorSpace = THREE.SRGBColorSpace;
{
  const wm = new THREE.MeshStandardMaterial({ map: tex('wood'), roughness: 0.85, color: 0xc9a27a });
  const post = mesh(rbox(0.1, 2.0, 0.1, 0.02), wm); post.position.y = 1.0; ruleSign.add(post);
  const fr = mesh(rbox(1.36, 0.88, 0.07, 0.02), wm); fr.position.set(0, 1.95, 0); ruleSign.add(fr);
  const pic = mesh(new THREE.PlaneGeometry(1.24, 0.775), new THREE.MeshStandardMaterial({ map: ruleTex, roughness: 0.8 }), { cast: false });
  pic.position.set(0, 1.95, 0.04); ruleSign.add(pic);
  ruleSign.position.set(-2.35, 0, -1.75); ruleSign.rotation.y = 0.25; scene.add(ruleSign);
}
function setRule(name) {
  const x = ruleCanvas.getContext('2d');
  x.fillStyle = '#fbf6ea'; x.fillRect(0, 0, 480, 300);
  x.save(); SIGNS[name](x); x.restore();
  ruleTex.needsUpdate = true;
  const s0 = ruleSign.scale.clone();
  tween(0.5, k => ruleSign.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.15), ease.lin).then(() => ruleSign.scale.copy(s0));
}

// ---------- カメラ ----------
const cam = { pos: new V3(2.5, 1.5, 6), look: new V3(2, 0.8, 1), tPos: new V3(), tLook: new V3(), speed: 1.6, shot: null };
function computeShot() {
  const s = cam.shot; if (!s) return;
  const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), th = tv * camera.aspect;
  const dist = Math.max(s.hw / th, s.hh / tv) + s.depth;
  cam.tLook.copy(s.c); cam.tPos.copy(s.c).addScaledVector(s.dir.clone().normalize(), dist);
}
function shot(c, hw, hh, dir, { speed = 1.6, instant = false, depth = 0.8, phw } = {}) {
  cam.shot = { c: new V3(...c), hw, hh, dir: new V3(...dir), depth, lhw: hw, phw: phw ?? hw };
  cam.shot.hw = portrait() ? cam.shot.phw : hw;
  cam.speed = speed; computeShot();
  if (instant) { cam.pos.copy(cam.tPos); cam.look.copy(cam.tLook); }
}
const portrait = () => innerWidth / innerHeight < 0.9;
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = w / h < 0.9 ? 52 : 40; camera.updateProjectionMatrix();
  if (cam.shot) { cam.shot.hw = portrait() ? cam.shot.phw : cam.shot.lhw; computeShot(); }
  if (state.round) layoutStage(true);
}
addEventListener('resize', resize);

// ---------- 入力 ----------
let mode = null, ptr = null, idleT = 0;
const hintEl = document.getElementById('hint');
function pickAt(x, y) {
  if (!mode || !mode.pick) return null;
  let best = null, bs = 1e9;
  const right = new V3().setFromMatrixColumn(camera.matrixWorld, 0);
  for (const p of mode.pick()) {
    if (p.enabled && !p.enabled()) continue;
    const c = p.center(), sc = toScreen(c);
    if (sc.z > 1) continue;
    const e = toScreen(c.clone().addScaledVector(right, p.r));
    const rad = Math.max(46, Math.hypot(e.x - sc.x, e.y - sc.y));
    const d = Math.hypot(sc.x - x, sc.y - y);
    if (d < rad && d / rad < bs) { bs = d / rad; best = p; }
  }
  return best;
}
canvas.addEventListener('pointerdown', e => {
  e.preventDefault(); audioInit(); musicStart(); idleT = 0; hintEl.classList.remove('on');
  if (ptr || busy || !mode) return;
  const x = e.clientX, y = e.clientY, p = pickAt(x, y);
  ptr = { id: e.pointerId, x0: x, y0: y, p, drag: false };
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  mode.onDown && mode.onDown(x, y, p);
});
canvas.addEventListener('pointermove', e => {
  if (!ptr || e.pointerId !== ptr.id) return;
  const x = e.clientX, y = e.clientY; idleT = 0;
  if (!ptr.drag && ptr.p && ptr.p.drag && Math.hypot(x - ptr.x0, y - ptr.y0) > 12) { ptr.drag = true; ptr.p.drag.start(x, y); }
  if (ptr.drag) ptr.p.drag.move(x, y);
  mode && mode.onMove && mode.onMove(x, y);
});
function endPtr(e) {
  if (!ptr || e.pointerId !== ptr.id) return;
  const p = ptr; ptr = null;
  if (p.drag) p.p.drag.end(e.clientX, e.clientY);
  else if (p.p && p.p.tap) p.p.tap();
  mode && mode.onUp && mode.onUp();
}
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

function updateHint(dt) {
  idleT += dt / timeScale;
  if (idleT > 5.5 && !busy && mode && mode.hint && !ptr) {
    const h = mode.hint();
    if (h) {
      const s = toScreen(h);
      hintEl.style.transform = `translate(${s.x}px,${s.y}px)`;
      hintEl.classList.add('on');
      if (idleT > 6 && !girl._hinted) { girl._hinted = true; lookAt(girl, h); girl.setFace('wow', 1); }
      return;
    }
  }
  hintEl.classList.remove('on'); girl._hinted = false;
}

// ---------- ゲームの状態 ----------
const state = { round: null, first: true, scene: 0 };
const OPEN = Math.PI / 2;

// 場面0：衣装を着せる
async function scene0() {
  state.scene = 0;
  shot([2.15, 0.75, 1.45], 1.05, 0.85, [0.15, 0.25, 1], { instant: true, phw: 0.8 });
  girl.setFace('smile');
  let left = 2;
  let done;
  const finished = new Promise(r => done = r);
  const items = [
    { obj: hat, parent: () => girl.head, pos: new V3(0, girl.headR * 0.22, 0), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12, 0, 0)), s: new V3(1, 1, 1) },
    { obj: vest, parent: () => girl.body, pos: new V3(0, girl.torsoL * 0.55, 0), q: new THREE.Quaternion(), s: new V3(1, 1, 1) },
  ];
  updaters.add(dt => items.forEach(it => { if (!it.worn && !it.flying) it.obj.scale.setScalar(1 + Math.sin(performance.now() / 260) * 0.06); }));
  const pick = items.map(it => ({
    center: () => it.obj.getWorldPosition(new V3()), r: 0.25, enabled: () => !it.worn && !it.flying,
    tap: async () => {
      it.flying = true; sfx.pick(); sfx.whoosh();
      girl.st.armX[1] = -2.2; girl.setFace('wow');
      await flyTo(it.obj, it.parent(), it.pos, it.q, it.s, 0.7, 0.6);
      it.worn = true; girl.st.armX[1] = 0;
      sfx.pop(); sfx.sparkle(); sparkleAround(it.obj, 8, 1.5);
      girl.setFace('laugh', 1.3); girl.jump(); sfx.giggle('girl');
      if (--left === 0) done();
    },
  }));
  mode = { pick: () => pick, hint: () => { const it = items.find(i => !i.worn); return it && it.obj.getWorldPosition(new V3()); } };
  await finished;
  mode = null;
  await cut(async () => {
    await wait(0.6);
    girl.st.cheer = true; girl.setFace('laugh'); sfx.fanfare(); girl.jump(3);
    sparkleAround(girl.g, 14, 1.4);
    await wait(1.6);
    girl.st.cheer = false; girl.setFace('smile');
    tween(0.6, k => { crate.scale.setScalar(1 - k); }).then(() => crate.visible = false);
  });
}

// 素材の山
const KINDS = ['card', 'fluff', 'blocks'];
function pileSpots() { return portrait() ? [-1.4, 0, 1.4] : [-2.3, 0, 2.3]; }
function newRound() {
  if (state.round) { scene.remove(state.round.root); }
  const root = new THREE.Group(); scene.add(root);
  const piles = KINDS.map((k, i) => { const g = makePile(k); g.position.set(pileSpots()[i], 0, 4.3); g.rotation.y = (i - 1) * -0.2; root.add(g); return { kind: k, g }; });
  const house = new THREE.Group(); house.position.y = BASE; root.add(house);
  const front = new THREE.Group(); front.position.set(0, T / 2, D / 2 - T / 2); front.rotation.x = OPEN; house.add(front);
  state.round = { root, piles, house, front, pieces: [], ghosts: [], placed: 0 };
  return state.round;
}

const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false });
updaters.add(() => { ghostMat.opacity = 0.13 + 0.1 * (0.5 + 0.5 * Math.sin(performance.now() / 300)); });

function layoutStage(instant) {
  const rd = state.round; if (!rd || !rd.pieces.length) return;
  const n = rd.pieces.length, rows = portrait() ? 3 : 2, per = Math.ceil(n / rows);
  const xs = portrait() ? 1.65 : 3.1;
  rd.pieces.forEach((p, i) => {
    const r = Math.floor(i / per), c = i % per, cnt = Math.min(per, n - r * per);
    const x = cnt === 1 ? 0 : -xs + (2 * xs) * c / (cnt - 1) + (r % 2 ? 0.25 : 0);
    const z = 4.0 + r * (portrait() ? 0.85 : 1.0);
    p.stage = new V3(x, -p.bmin * p.ss, z);
    if (instant && !p.placed && !p.flying && !p.dragging && !p.home) p.group.position.copy(p.stage);
  });
}

function pieceCenter(p) {
  const c = p.group.position.clone(); c.y += p.bh * p.group.scale.y * 0.5 + (p.group.position.y < 0 ? -p.group.position.y : 0);
  return c;
}

// 場面1：素材をえらんで家を建てる
async function scene1() {
  state.scene = 1;
  const rd = state.round || newRound();
  setRule('build');
  shot([0.1, 0.5, 3.3], 3.5, 2.3, [0, 0.62, 1], { phw: 2.7, speed: 1.2, depth: 1.6 });
  dad.g.position.set(-2.45, 0, 0.85); dad.g.rotation.y = 0.5; dad.st.pose = 'stand'; dad.setFace('smile');
  girl.g.position.copy(GIRL_HOME); girl.g.rotation.y = -0.55;
  let chosen;
  const picked = new Promise(r => chosen = r);
  rd.piles.forEach(p => { p.bob = Math.random() * 6; });
  const bob = dt => rd.piles.forEach(p => { if (!rd.kind) p.g.position.y = Math.abs(Math.sin(performance.now() / 400 + p.bob)) * 0.06; });
  updaters.add(bob);
  mode = {
    pick: () => rd.piles.map(p => ({ center: () => p.g.position.clone().add(new V3(0, 0.4, 0)), r: 0.75, tap: () => chosen(p) })),
    hint: () => rd.piles[1].g.position.clone().add(new V3(0, 0.5, 0)),
  };
  const pile = await picked;
  mode = null; updaters.delete(bob);
  rd.kind = pile.kind;
  await cut(async () => {
    sfx.pick(); girl.setFace('wow', 1.2); sfx.wow('girl'); lookAt(girl, pile.g.position);
    girl.st.armX[1] = -1.6;
    await tween(0.5, k => { pile.g.position.y = Math.sin(k * Math.PI) * 0.5; pile.g.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.2); });
    girl.st.armX[1] = 0;
    rd.piles.filter(p => p !== pile).forEach(p => {
      const from = p.g.position.clone(), s = Math.sign(from.x) || 1;
      tween(0.8, k => { p.g.position.set(from.x + s * k * 8, Math.sin(k * Math.PI) * 0.6, from.z + k * 2); p.g.scale.setScalar(1 - k * 0.6); }).then(() => p.g.visible = false);
    });
    sfx.swoosh();
    // 山がはじけてピースになる
    const kit = rd.kit = makeKit(pile.kind);
    const defs = makePieces(kit);
    rd.pieces = defs.map(d => {
      const g = d.group; g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
      const b = new THREE.Box3().setFromObject(g), sz = b.getSize(new V3());
      const ss = Math.min(0.85 / Math.max(sz.x, sz.y, sz.z), 0.55);
      const parent = d.parent === 'front' ? rd.front : rd.house;
      const ghost = g.clone(true); ghost.traverse(o => { if (o.isMesh) { o.material = ghostMat; o.castShadow = false; o.receiveShadow = false; } });
      ghost.position.copy(d.pos); ghost.rotation.y = d.rotY; ghost.visible = false; parent.add(ghost);
      return { ...d, parentObj: parent, ghost, ss, bmin: b.min.y, bh: sz.y, placed: false };
    });
    layoutStage(false);
    await tween(0.35, k => pile.g.scale.setScalar(1.2 * (1 - k) + 0.01));
    pile.g.visible = false;
    dust(pile.g.position, 14, 0.18);
    const origin = pile.g.position.clone().add(new V3(0, 0.3, 0));
    rd.pieces.forEach((p, i) => {
      rd.root.add(p.group); p.group.position.copy(origin); p.group.scale.setScalar(0.01); p.group.rotation.y = (Math.random() - 0.5) * 0.5;
      p.flying = true;
      const from = origin.clone();
      tween(0.7 + i * 0.04, k => { p.group.position.lerpVectors(from, p.stage, k); p.group.position.y += Math.sin(k * Math.PI) * 1.4; p.group.scale.setScalar(Math.max(0.01, p.ss * k)); }, ease.out)
        .then(() => { p.flying = false; p.group.position.copy(p.stage); sfx.pop(); });
    });
    sfx.sparkle();
    await wait(1.2);
    rd.pieces.forEach(p => p.ghost.visible = true);
    shot([0.25, 0.4, 3.0], 4.0, 3.1, [0, 0.85, 1], { phw: 2.5, speed: 1.2, depth: 1.5 });
    girl.setFace('laugh', 1); sfx.giggle('girl');
    if (state.first) await dadRoofGag(rd);
  });
  // 組み立て
  let done; const built = new Promise(r => done = r);
  const pick = rd.pieces.map(p => ({
    center: () => pieceCenter(p), r: 0.42, enabled: () => !p.placed && !p.flying,
    tap: () => placePiece(p, null, done),
    drag: dragPieceHandlers(p, done),
  }));
  mode = { pick: () => pick, hint: () => { const p = rd.pieces.find(q => !q.placed && !q.flying); return p && pieceCenter(p); } };
  await built;
  mode = null;
  await cut(() => houseComplete(rd));
}

async function dadRoofGag(rd) {
  const roof = rd.pieces.find(p => p.id === 'roof');
  const spot = roof.stage.clone();
  await walkTo(dad, spot.x - 0.75, spot.z - 0.55, 2.2);
  lookAt(dad, spot); dad.st.armX = [-1.2, -1.2];
  await wait(0.3);
  roof.flying = true;
  const headY = dad.height + 0.02;
  const from = roof.group.position.clone();
  sfx.whoosh();
  await tween(0.6, k => { roof.group.position.lerpVectors(from, dad.g.position.clone().add(new V3(0, headY - roof.bmin * roof.ss - (H) * roof.ss * 0.98, 0)), k); roof.group.position.y += Math.sin(k * Math.PI) * 0.5; });
  dad.st.armX = [-2.9, -2.9]; dad.setFace('laugh'); sfx.giggle('dad');
  lookAt(dad, camera.position);
  const follow = () => roof.group.position.copy(dad.g.position).add(new V3(0, headY - roof.bmin * roof.ss - H * roof.ss * 0.98 + dad.jy, 0));
  updaters.add(follow);
  dad.jump(2); await wait(0.6);
  girl.setFace('are'); sfx.are('girl'); lookAt(girl, dad.g.position);
  await wait(1.3);
  updaters.delete(follow);
  // 屋根がピョンと戻る
  const f2 = roof.group.position.clone();
  sfx.boing(); dad.setFace('oops'); dad.st.armX = [0, 0];
  await tween(0.7, k => { roof.group.position.lerpVectors(f2, roof.stage, k); roof.group.position.y += Math.sin(k * Math.PI) * 1.2; roof.group.rotation.y = k * Math.PI * 2; }, ease.io);
  roof.group.rotation.y = 0; roof.flying = false;
  sfx.oops();
  girl.setFace('laugh', 1.5); sfx.giggle('girl');
  await wait(0.5);
  dad.setFace('laugh', 1.2);
  await walkTo(dad, -2.45, 0.85, 2.2);
  dad.g.rotation.y = 0.5; dad.setFace('smile');
  state.first = false;
}

async function placePiece(p, wrong, done) {
  const rd = state.round;
  if (p.placed || p.flying) return;
  p.flying = true;
  girl.st.armX[1] = -2.0; lookAt(girl, p.ghost.getWorldPosition(new V3()));
  if (wrong) {
    girl.setFace('are'); sfx.are('girl');
    const w0 = p.group.rotation.z;
    await tween(0.8, k => { p.group.rotation.z = w0 + Math.sin(k * Math.PI * 4) * 0.25 * (1 - k); }, ease.lin);
    girl.setFace('smile');
  }
  sfx.whoosh(); girl.setFace('wow');
  await flyTo(p.group, p.parentObj, p.pos, qY(p.rotY), new V3(1, 1, 1), 0.75, 1.0);
  p.ghost.visible = false; p.placed = true; p.flying = false; p.home = true;
  girl.st.armX[1] = 0;
  sfx.place(rd.kind);
  // ぽよん
  tween(0.35, k => { const s = 1 + Math.sin(k * Math.PI) * 0.06; p.group.scale.set(1 + (s - 1) * 0.5, 2 - s, 1 + (s - 1) * 0.5); }, ease.lin).then(() => p.group.scale.set(1, 1, 1));
  const wp = p.group.getWorldPosition(new V3());
  dust(new V3(wp.x, 0.05, wp.z), 8, 0.1);
  sparkleAround(p.group, 6, 0.9);
  girl.setFace(wrong ? 'laugh' : (Math.random() < 0.5 ? 'laugh' : 'smile'), 1.2); girl.jump(1.6);
  if (Math.random() < 0.5) sfx.giggle('girl');
  if (Math.random() < 0.3) { dad.setFace('laugh', 1); dad.jump(1.4); }
  rd.placed++;
  if (rd.placed === rd.pieces.length) done();
}

function dragPieceHandlers(p, done) {
  const plane = new THREE.Plane(), hit = new V3();
  return {
    start() {
      if (p.placed || p.flying) return;
      p.dragging = true; sfx.pick(); girl.setFace('wow'); girl.st.armX[1] = -2.0;
      const n = new V3(); camera.getWorldDirection(n);
      plane.setFromNormalAndCoplanarPoint(n.negate(), new V3(0, 1.0, 1.4));
      tween(0.2, k => p.group.scale.setScalar(p.ss * (1 + k * 0.4)));
    },
    move(x, y) {
      if (!p.dragging) return;
      if (setRay(x, y).ray.intersectPlane(plane, hit)) { hit.y = Math.max(hit.y, 0.05); p.group.position.lerp(hit, 0.6); lookAt(girl, hit); }
    },
    end(x, y) {
      if (!p.dragging) return;
      p.dragging = false;
      const rd = state.round;
      let best = null, bd = 110;
      rd.pieces.forEach(q => {
        if (q.placed || !q.ghost.visible) return;
        const b = new THREE.Box3().setFromObject(q.ghost), s = toScreen(b.getCenter(new V3()));
        const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = q; }
      });
      placePiece(p, best && best !== p ? best : null, done);
    },
  };
}

async function houseComplete(rd) {
  await wait(0.4);
  // 前の壁がパタンと立つ
  sfx.swoosh();
  shot([0.2, 1.3, 0.6], 2.9, 2.0, [0.15, 0.3, 1], { phw: 2.2, speed: 1.4 });
  await tween(1.0, k => { rd.front.rotation.x = OPEN * (1 - k); }, ease.io);
  sfx.thud(); dust(new V3(0, 0.05, D / 2 + 0.2), 18, 0.18);
  await tween(0.25, k => rd.front.rotation.x = -Math.sin(k * Math.PI) * 0.04, ease.lin);
  rd.front.rotation.x = 0;
  sfx.fanfare();
  confettiBurst(new V3(0, H + R + 0.3, 0.5));
  sparkleAround(rd.house, 20, 1.1);
  girl.st.cheer = true; girl.setFace('laugh'); lookAt(girl, new V3(0, 0, 6)); girl.jump(3); sfx.giggle('girl');
  dad.st.cheer = true; dad.setFace('laugh'); dad.jump(2.5);
  await wait(2.6);
  girl.st.cheer = false; dad.st.cheer = false; girl.setFace('smile'); dad.setFace('smile');
}

// ---------- 場面2：泡だらけ → ホースで流す ----------
const ext = new THREE.Group();
{
  const red = new THREE.MeshPhysicalMaterial({ color: 0xd8231f, roughness: 0.3, clearcoat: 0.8 });
  const b = mesh(new THREE.CapsuleGeometry(0.075, 0.32, 6, 16), red); ext.add(b);
  const top = mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.08, 12), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 })); top.position.y = 0.26; ext.add(top);
  const hose = mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0x111111 })); hose.position.set(0, 0.2, 0.1); hose.rotation.y = Math.PI / 2; ext.add(hose);
  const noz = mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.14, 10), new THREE.MeshStandardMaterial({ color: 0x111111 })); noz.position.set(0, 0.1, 0.22); noz.rotation.x = Math.PI / 2; ext.add(noz);
  ext.nozzle = new THREE.Object3D(); ext.nozzle.position.set(0, 0.1, 0.3); ext.add(ext.nozzle);
  ext.visible = false; scene.add(ext);
}
const reel = new THREE.Group();
{
  const gm = new THREE.MeshStandardMaterial({ color: 0x2e9d48, roughness: 0.45 });
  const st = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.4, metalness: 0.6 });
  for (let i = 0; i < 4; i++) { const t = mesh(new THREE.TorusGeometry(0.2 + i * 0.012, 0.025, 8, 28), gm); t.position.z = -0.07 + i * 0.045; reel.add(t); }
  const ax = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 10), st); ax.rotation.x = Math.PI / 2; reel.add(ax);
  for (const s of [-1, 1]) { const leg = mesh(new THREE.BoxGeometry(0.03, 0.42, 0.03), st); leg.position.set(s * 0.12, -0.12, 0.13 * s * 0); leg.rotation.z = s * 0.4; reel.add(leg); }
  reel.position.set(3.35, 0.32, 1.9); reel.rotation.y = -0.6; reel.visible = false; scene.add(reel);
}
const nozzle = new THREE.Group();
{
  nozzle.add(mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.2, 12), new THREE.MeshStandardMaterial({ color: 0xffc61a, roughness: 0.35 })));
  nozzle.tip = new THREE.Object3D(); nozzle.tip.position.y = -0.12; nozzle.add(nozzle.tip);
}
const hoseMat = new THREE.MeshStandardMaterial({ color: 0x2e9d48, roughness: 0.45 });
let hoseTube = null;
function updateHoseTube() {
  if (hoseTube) { scene.remove(hoseTube); hoseTube.geometry.dispose(); hoseTube = null; }
  if (!nozzle.parent) return;
  const a = reel.position.clone(), b = nozzle.getWorldPosition(new V3());
  const m1 = a.clone().lerp(b, 0.35); m1.y = 0.04; const m2 = a.clone().lerp(b, 0.7); m2.y = 0.12;
  const curve = new THREE.CatmullRomCurve3([a, new V3(a.x, 0.05, a.z + 0.1), m1, m2, b]);
  hoseTube = mesh(new THREE.TubeGeometry(curve, 40, 0.022, 6), hoseMat); scene.add(hoseTube);
}

const foamGeo = new THREE.SphereGeometry(1, 14, 10);
const foamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, emissive: 0x2a2a2a, envMapIntensity: 1.3 });
function buildFoam(rd) {
  const meshes = []; rd.house.traverse(o => { if (o.isMesh && !(o.material.transparent && o.material.opacity < 0.6)) meshes.push(o); });
  rd.house.updateWorldMatrix(true, true);
  const blobs = [], rc = new THREE.Raycaster(), center = new V3(0, 1.4, 0.2);
  for (let i = 0; i < 1400 && blobs.length < 330; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.5;
    const o = new V3(Math.cos(th) * Math.cos(ph) * 7, 0.2 + Math.sin(ph) * 7, Math.sin(th) * Math.cos(ph) * 7);
    if (o.z < -2 && Math.random() < 0.7) continue;
    const tgt = new V3((Math.random() - 0.5) * W, Math.random() * (H + R), (Math.random() - 0.5) * D);
    rc.set(o, tgt.sub(o).normalize());
    const h = rc.intersectObjects(meshes, false)[0];
    if (!h) continue;
    blobs.push({ p: h.point.clone(), size: 0.16 + Math.random() * 0.2, s: 0, delay: 0, alive: true, house: true });
  }
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * Math.PI * 2, rr = 1 + Math.random() * 0.4;
    blobs.push({ p: new V3(Math.cos(a) * W / 2 * rr, 0.05, D / 2 * 0.4 + Math.sin(a) * D / 2 * rr + 0.3), size: 0.18 + Math.random() * 0.22, s: 0, alive: true, house: false });
  }
  const im = new THREE.InstancedMesh(foamGeo, foamMat, blobs.length); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
  rd.root.add(im);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new V3();
  const foam = {
    blobs, im, meshes,
    sync() {
      blobs.forEach((b, i) => {
        const s = b.alive ? b.size * b.s * (1 + 0.05 * Math.sin(performance.now() / 300 + i)) : 0;
        sv.set(s, s * 0.85, s); m.compose(b.p, q, sv); im.setMatrixAt(i, m);
      });
      im.instanceMatrix.needsUpdate = true;
    },
  };
  foam.sync();
  return foam;
}
// パパの泡
const dadFoam = new THREE.Group(); dad.body.add(dadFoam);
for (let i = 0; i < 22; i++) {
  const b = mesh(foamGeo, foamMat); const a = Math.random() * Math.PI * 2, y = Math.random() * (dad.torsoL + dad.headR * 1.6);
  const rr = y > dad.torsoL ? dad.headR * 1.0 : dad.torR * 1.1;
  b.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr * 0.8 + (y > dad.torsoL ? -0.04 : 0));
  if (y > dad.torsoL && b.position.z > 0.02) b.position.z = -0.03;
  b.userData.s = 0.06 + Math.random() * 0.06; b.scale.setScalar(0); dadFoam.add(b);
}
function setDadFoam(k) { dadFoam.children.forEach(b => { b.userData.k = k; b.scale.setScalar(b.userData.s * k); }); }

async function scene2() {
  state.scene = 2;
  const rd = state.round;
  let foam;
  await cut(async () => {
    setRule('wash');
    shot([-0.2, 1.15, 1.6], 3.7, 2.1, [0.12, 0.32, 1], { phw: 2.6, speed: 1.2 });
    // パパが消火器をもってくる
    dad.arms[0].hand.add(ext); ext.position.set(0, -0.12, 0.05); ext.rotation.set(0, 0, 0); ext.visible = true; ext.scale.setScalar(0.01);
    await tween(0.3, k => ext.scale.setScalar(Math.max(0.01, k)));
    sfx.pop();
    await walkTo(dad, -1.9, 3.3, 1.8);
    lookAt(dad, new V3(0, 0, 0)); dad.setFace('laugh'); sfx.giggle('dad');
    dad.st.armX = [-1.3, 0];
    await wait(0.6);
    foam = rd.foam = buildFoam(rd);
    const sprayFrom = new V3(); const loop = makeLoop('foam'); loop.start();
    const order = foam.blobs.map((b, i) => i).sort((a, b) => foam.blobs[a].p.distanceTo(dad.g.position) - foam.blobs[b].p.distanceTo(dad.g.position));
    order.forEach((idx, j) => foam.blobs[idx].delay = j / order.length * 3.0);
    let ft = 0;
    const wild = dt => {
      ft += dt;
      ext.nozzle.getWorldPosition(sprayFrom);
      const aim = new V3(Math.sin(ft * 2.3) * 2, 1.2 + Math.sin(ft * 3.1) * 1, 0).sub(sprayFrom).normalize();
      for (let i = 0; i < 4; i++) foamSpray.emit(sprayFrom, aim.clone().multiplyScalar(6 + Math.random() * 3).add(new V3((Math.random() - 0.5) * 1.5, Math.random() * 1.5, (Math.random() - 0.5) * 1.5)), 0.8, 0.05 + Math.random() * 0.06);
      foam.blobs.forEach(b => { if (ft > b.delay) b.s = Math.min(1, b.s + dt * 3); });
      foam.sync();
      dad.g.rotation.y = Math.atan2(-dad.g.position.x, -dad.g.position.z) + Math.sin(ft * 5) * 0.5;
    };
    updaters.add(wild);
    dad.setFace('wow');
    await wait(1.4);
    girl.setFace('wow'); sfx.wow('girl'); lookAt(girl, dad.g.position);
    await wait(1.0);
    // つるっと転ぶ
    dad.setFace('oops'); sfx.boing();
    const p0 = dad.g.position.clone();
    await tween(0.5, k => { dad.g.position.lerpVectors(p0, p0.clone().add(new V3(-0.4, 0, 0.5)), k); }, ease.out);
    dad.st.seatH = 0.12; dad.st.pose = 'sit'; dad.st.armX = [-2.4, -2.4];
    await tween(0.9, k => setDadFoam(k), ease.out);
    updaters.delete(wild); loop.stop();
    foam.blobs.forEach(b => b.s = 1); foam.sync();
    sfx.thud();
    dust(dad.g.position, 12, 0.2);
    await wait(0.6);
    dad.st.armX = [0, 0];
    ext.visible = false;
    girl.setFace('laugh', 1.6); sfx.giggle('girl');
    await wait(1.0);
    reel.visible = true; reel.scale.setScalar(0.01);
    sfx.pop(); await tween(0.4, k => reel.scale.setScalar(Math.max(0.01, k)), ease.back);
    sparkleAround(reel, 6, 1.4);
  });
  // ホースで流す
  let done; const clean = new Promise(r => done = r);
  const target = new V3(); let spraying = false, hasHose = false, popT = 0, sprayT = 0;
  const loop = makeLoop('water');
  const reelBob = () => { if (!hasHose) reel.scale.setScalar(1 + Math.sin(performance.now() / 250) * 0.07); };
  updaters.add(reelBob);
  async function grab() {
    if (hasHose) return; hasHose = true; reel.scale.setScalar(1);
    sfx.pick(); girl.setFace('laugh', 1);
    girl.arms[1].hand.add(nozzle); nozzle.position.set(0, -0.05, 0.04); nozzle.rotation.set(0, 0, 0);
    girl.st.armX[1] = -1.4;
  }
  function aim(x, y) {
    const r = setRay(x, y);
    const dsc = toScreen(dad.center());
    if (Math.hypot(dsc.x - x, dsc.y - y) < 70) { target.copy(dad.center()); return; }
    const h = r.intersectObjects(foam.meshes, false)[0];
    if (h) target.copy(h.point);
    else { const p = new V3(); if (r.ray.intersectPlane(new THREE.Plane(new V3(0, 1, 0), 0), p)) target.copy(p); }
  }
  const wash = dt => {
    if (hasHose) updateHoseTube();
    if (!spraying) return;
    sprayT += dt;
    const from = nozzle.tip.getWorldPosition(new V3());
    lookAt(girl, target);
    const tau = 0.32;
    for (let i = 0; i < 3; i++) {
      const v = target.clone().sub(from).divideScalar(tau).add(new V3(0, 4.9 * tau, 0)).add(new V3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4));
      water.emit(from, v, tau, 0.03 + Math.random() * 0.025);
    }
    if (Math.random() < 0.6) water.emit(target, new V3((Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 3), 0.4, 0.025);
    if (Math.random() < 0.3) sparkle(target.clone().add(new V3((Math.random() - 0.5) * 0.4, Math.random() * 0.3, 0.1)), 0.2, 0.5);
    let left = 0, total = 0;
    const ts = toScreen(target), rad = Math.max(55, Math.min(innerWidth, innerHeight) * 0.1);
    foam.blobs.forEach(b => {
      if (!b.alive) { if (b.house) total++; return; }
      const bs = toScreen(b.p);
      if (Math.hypot(bs.x - ts.x, bs.y - ts.y) < rad || b.p.distanceTo(target) < 0.62) {
        b.s -= dt * 2.6;
        if (b.s <= 0) { b.alive = false; popT -= 1; if (popT < 0) { sfx.pop(); popT = 2; } puff.emit(b.p, new V3(0, 0.8, 0), 0.4, b.size * 0.5); }
      }
      if (b.house) { total++; if (b.alive) left++; }
    });
    // パパの泡
    const dc = dad.center();
    if (dc.distanceTo(target) < 0.75) {
      dadFoam.children.forEach(b => { b.userData.k = Math.max(0, (b.userData.k ?? 1) - dt * 1.6); b.scale.setScalar(b.userData.s * b.userData.k); });
      if (Math.random() < 0.05) { dad.setFace('laugh', 0.8); sfx.giggle('dad'); }
    }
    foam.sync();
    if (left / total < 0.12) done();
  };
  updaters.add(wash);
  mode = {
    pick: () => [{ center: () => reel.position.clone(), r: 0.35, enabled: () => !hasHose, tap: grab }],
    onDown(x, y, p) { if (p) return; grab(); spraying = true; aim(x, y); loop.start(); girl.setFace('laugh'); },
    onMove(x, y) { if (spraying) aim(x, y); },
    onUp() { if (spraying) { spraying = false; loop.stop(); girl.setFace('smile'); } },
    hint: () => { if (!hasHose) return reel.position.clone(); const b = foam.blobs.find(b => b.alive && b.house); return b && b.p; },
  };
  await clean;
  mode = null; spraying = false; loop.stop();
  updaters.delete(reelBob);
  await cut(async () => {
    // のこりの泡も消えてピカピカ
    const rest = foam.blobs.filter(b => b.alive);
    await tween(0.6, k => { rest.forEach(b => b.s = Math.min(b.s, 1 - k)); foam.sync(); });
    rest.forEach(b => b.alive = false); foam.sync();
    setDadFoam(0);
    for (let i = 0; i < 3; i++) { sparkleAround(rd.house, 16, 1.15); sfx.sparkle(); await wait(0.35); }
    rd.house.traverse(o => { if (o.isMesh && o.material.envMapIntensity !== undefined) o.material.envMapIntensity = 1.6; });
    updaters.delete(wash);
    sfx.fanfare();
    dad.st.pose = 'stand'; dad.st.seatH = 0.4; dad.setFace('laugh'); dad.st.cheer = true; dad.jump(2);
    girl.st.armX[1] = -2.6; girl.setFace('laugh'); girl.jump(2.6); sfx.giggle('girl');
    await wait(2.2);
    dad.st.cheer = false; girl.st.armX[1] = 0;
    girl.arms[1].hand.remove(nozzle); updateHoseTube();
    girl.g.position.copy(GIRL_HOME); lookAt(girl, new V3(0, 0, 5));
  });
}

// ---------- 場面3：看板をたてると家族が住みはじめる ----------
const picRT = new THREE.WebGLRenderTarget(512, 384, { samples: 4 });
const sign3 = new THREE.Group();
{
  const wm = new THREE.MeshStandardMaterial({ map: tex('wood'), roughness: 0.85, color: 0xe0b98a });
  const post = mesh(rbox(0.1, 1.5, 0.1, 0.02), wm); post.position.y = 0.75; sign3.add(post);
  const fr = mesh(rbox(1.14, 0.88, 0.07, 0.025), new THREE.MeshStandardMaterial({ color: 0xff9cc0, roughness: 0.5 })); fr.position.y = 1.55; sign3.add(fr);
  const pic = mesh(new THREE.PlaneGeometry(1.0, 0.75), new THREE.MeshBasicMaterial({ map: picRT.texture }), { cast: false });
  pic.position.set(0, 1.55, 0.04); sign3.add(pic);
  sign3.visible = false; scene.add(sign3);
}
function renderHousePicture() {
  const pc = new THREE.PerspectiveCamera(36, 4 / 3, 0.1, 100);
  pc.position.set(3.2, 2.8, 8.4); pc.lookAt(0, 1.45, 0);
  const vis = people.map(p => p.g.visible);
  people.forEach(p => { if (p !== girl) p.g.visible = false; });
  const sv = sign3.visible; sign3.visible = false;
  renderer.setRenderTarget(picRT); renderer.render(scene, pc); renderer.setRenderTarget(null);
  people.forEach((p, i) => p.g.visible = vis[i]); sign3.visible = sv;
}

async function scene3() {
  state.scene = 3;
  const rd = state.round;
  await cut(async () => {
    setRule('family');
    shot([-0.6, 0.9, 2.6], 3.6, 2.0, [0.1, 0.35, 1], { phw: 2.6, speed: 1.2 });
    renderHousePicture();
    sign3.visible = true; sign3.position.set(1.4, 0.05, 3.5); sign3.rotation.set(-Math.PI / 2, 0, 0.4); sign3.scale.setScalar(1);
    rd.root.attach(sign3);
    sfx.pop(); sparkleAround(sign3, 6, 1.2);
    await wait(0.4);
  });
  let planted; const pl = new Promise(r => planted = r);
  const bobSign = () => { if (!sign3.userData.up) sign3.position.y = 0.05 + Math.abs(Math.sin(performance.now() / 300)) * 0.08; };
  updaters.add(bobSign);
  mode = {
    pick: () => [{ center: () => sign3.getWorldPosition(new V3()).add(new V3(0, 0.1, -0.6)), r: 0.6, tap: planted }],
    hint: () => sign3.getWorldPosition(new V3()).add(new V3(0, 0.1, -0.6)),
  };
  await pl;
  mode = null; updaters.delete(bobSign); sign3.userData.up = true;
  await cut(async () => {
    sfx.pick(); girl.st.armX[1] = -2; girl.setFace('wow');
    await flyTo(sign3, rd.root, new V3(-2.25, 0, 3.0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.35, 0)), new V3(1, 1, 1), 0.9, 1.0);
    sfx.thud(); dust(new V3(-2.25, 0.05, 3.0), 12, 0.15); sparkleAround(sign3, 10, 1.2); sfx.sparkle();
    girl.st.armX[1] = 0; girl.setFace('laugh', 1.5); sfx.giggle('girl'); girl.jump();
    await wait(0.6);
    // 家族がやってくる
    [mom, boy, dog].forEach((p, i) => { p.g.visible = true; p.g.position.set(-8.5 - i * 0.8, 0, 3.6 + i * 0.3); p.st.pose = 'stand'; p.st.baseY = 0; });
    dad.st.pose = 'stand';
    const spots = [[mom, -2.9, 4.3], [boy, -2.2, 4.4], [dog, -1.6, 4.2], [dad, -3.5, 3.9]];
    shot([-1.7, 0.9, 3.4], 3.0, 1.8, [0.15, 0.3, 1], { phw: 2.2, speed: 1.0 });
    await Promise.all(spots.map(([p, x, z]) => walkTo(p, x, z, 2.2)));
    spots.forEach(([p]) => lookAt(p, sign3.position));
    await wait(0.3);
    [mom, boy, dad].forEach(p => p.setFace('wow', 1.4)); sfx.wow('mom'); sfx.wow('boy');
    await wait(0.8);
    [mom, boy, dad].forEach(p => { p.st.cheer = true; p.jump(2 + Math.random()); }); dog.jump(); sfx.bark(); sfx.clap();
    [mom, boy, dad].forEach(p => p.setFace('laugh', 1.6)); sfx.giggle('boy');
    await wait(1.5);
    [mom, boy, dad].forEach(p => p.st.cheer = false);
    // ドアがあいて中へ
    shot([-0.4, 1.0, 1.8], 3.0, 1.9, [0.1, 0.35, 1], { phw: 2.2, speed: 1.0 });
    const door = rd.pieces.find(p => p.id === 'door').group;
    sfx.creak(); await tween(0.6, k => door.rotation.y = -1.7 * k);
    const doorX = DOOR_X0 + 0.45;
    const inside = [[boy, 0.75, 0.05], [mom, -0.25, 0.05], [dad, 0.15, 0.75], [dog, -0.65, 0.8]];
    await Promise.all(inside.map(async ([p, x, z], i) => {
      await wait(i * 0.5);
      await walkTo(p, doorX, 2.2, 2.0);
      await walkTo(p, doorX, 0.6, 1.6);
      p.st.baseY = BASE;
      await walkTo(p, x, z, 1.4);
      lookAt(p, new V3(x, 0, 6));
    }));
    sfx.creak(); await tween(0.5, k => door.rotation.y = -1.7 * (1 - k));
    await wait(0.3);
    // ドールハウスのように前があく
    sfx.swoosh();
    shot([0, 1.15, 0.9], 2.5, 1.85, [0, 0.2, 1], { phw: 2.0, speed: 1.0, depth: 1.5 });
    await tween(1.2, k => rd.front.rotation.x = OPEN * k, ease.io);
    sfx.thud();
    const chair = rd.pieces.find(p => p.id === 'chair');
    seatOn(boy, chair);
    [mom, dad, boy].forEach(p => p.setFace('laugh', 1.2)); sfx.giggle('mom'); dog.spin = Math.PI * 2; sfx.bark();
    confettiBurst(new V3(0, H + 0.5, 0.5), 80);
    await wait(1.0);
  });
  freePlay(rd);
}

// ----- 自由あそび -----
const tmp = new V3();
function seatOn(p, chair) {
  const c = chair.group.getWorldPosition(new V3());
  p.on = { what: 'chair', piece: chair };
  p.g.rotation.y = chair.group.rotation.y; p.st.pose = 'sit'; p.st.seatH = 0.42; p.st.baseY = BASE; p.baseFace = 'smile'; p.setFace('smile');
  p.g.position.set(c.x, BASE, c.z + 0.02);
}
function lieOn(p, bed) {
  const c = bed.group.getWorldPosition(new V3());
  p.on = { what: 'bed', piece: bed };
  if (p instanceof Dog) {
    p.st.pose = 'lie'; p.st.baseY = BASE + 0.42; p.g.position.set(c.x, BASE + 0.42, c.z + 0.35); p.g.rotation.y = 0.6;
  } else {
    p.g.rotation.y = 0; p.st.pose = 'lie'; p.st.baseY = BASE + 0.42 + p.torR * 0.75;
    p.g.position.set(c.x, p.st.baseY, c.z - 0.62 + p.height * 0.93);
    p.baseFace = 'sleep'; p.setFace('sleep');
  }
}
function followFurniture() {
  people.forEach(p => {
    if (!p.on || p.dragging) return;
    if (p.on.what === 'chair') { const c = p.on.piece.group.getWorldPosition(tmp); p.g.position.x = c.x; p.g.position.z = c.z + 0.02; }
    else { const c = p.on.piece.group.getWorldPosition(tmp); if (p instanceof Dog) { p.g.position.x = c.x; p.g.position.z = c.z + 0.35; } else { p.g.position.x = c.x; p.g.position.z = c.z - 0.62 + p.height * 0.93; } }
  });
}
updaters.add(followFurniture);
const INX = W / 2 - T - 0.28, INZ0 = -D / 2 + T + 0.3, INZ1 = D / 2 - 0.15;
function floorPoint(x, y, out) {
  if (!setRay(x, y).ray.intersectPlane(new THREE.Plane(new V3(0, 1, 0), -BASE), out)) return false;
  out.x = THREE.MathUtils.clamp(out.x, -INX, INX); out.z = THREE.MathUtils.clamp(out.z, INZ0, INZ1); return true;
}
let sleepT = 0;
function freePlay(rd) {
  state.scene = 4;
  const bed = rd.pieces.find(p => p.id === 'bed'), chair = rd.pieces.find(p => p.id === 'chair');
  const furn = rd.pieces.filter(p => p.furniture);
  const items = [];
  furn.forEach(f => {
    const h = new V3();
    items.push({
      center: () => f.group.getWorldPosition(new V3()).add(new V3(0, 0.35, 0)), r: 0.45,
      tap: () => { sfx.place(rd.kind); tween(0.4, k => f.group.rotation.z = Math.sin(k * Math.PI * 3) * 0.08 * (1 - k), ease.lin); sparkleAround(f.group, 4); },
      drag: {
        start() { f.dragging = true; sfx.pick(); girl.setFace('wow', 0.6); },
        move(x, y) { if (floorPoint(x, y, h)) { rd.house.worldToLocal(h); f.group.position.x += (h.x - f.group.position.x) * 0.6; f.group.position.z += (h.z - f.group.position.z) * 0.6; f.group.position.y = 0.12; } },
        end() { f.dragging = false; f.group.position.y = 0; sfx.place(rd.kind); dust(f.group.getWorldPosition(new V3()), 6, 0.08); girl.setFace('laugh', 0.8); },
      },
    });
  });
  const fam = [mom, dad, boy, dog];
  fam.forEach(p => {
    const h = new V3();
    const voiceOf = p === dog ? null : p.kind;
    items.push({
      center: () => p.center(), r: p === dog ? 0.3 : p.height * 0.32,
      tap: () => {
        if (p === dog) { sfx.bark(); p.spin = Math.PI * 2; p.jump(); return; }
        if (p.st.pose === 'lie') { p.setFace('laugh', 1); sfx.giggle(voiceOf); return; }
        if (p.st.pose === 'sit') { p.st.armX = [-2.6, -2.6]; setTimeout(() => p.st.armX = [0, 0], 700 / timeScale); p.setFace('laugh', 1); sfx.giggle(voiceOf); return; }
        p.jump(2.6); p.setFace('laugh', 1.1); sfx.giggle(voiceOf);
      },
      drag: {
        start() { p.dragging = true; p.on = null; p.st.pose = 'stand'; p.st.walk = 1; p.st.baseY = BASE + 0.35; p.g.rotation.set(0, 0, 0); p.baseFace = 'smile'; p.setFace('wow'); sfx.wow(voiceOf || 'boy'); },
        move(x, y) { if (floorPoint(x, y, h)) { p.g.position.x += (h.x - p.g.position.x) * 0.6; p.g.position.z += (h.z - p.g.position.z) * 0.6; } },
        end() {
          p.dragging = false; p.st.walk = 0;
          const pos = p.g.position;
          const bc = bed.group.getWorldPosition(new V3()), cc = chair.group.getWorldPosition(new V3());
          const others = (what, piece) => people.some(o => o !== p && o.on && o.on.piece === piece && (what === 'chair' || !(o instanceof Dog) === !(p instanceof Dog)));
          if (Math.abs(pos.x - bc.x) < 0.65 && Math.abs(pos.z - bc.z) < 1.0 && !others('bed', bed)) { lieOn(p, bed); sfx.drip(); }
          else if (p !== dog && Math.hypot(pos.x - cc.x, pos.z - cc.z) < 0.45 && !others('chair', chair)) { seatOn(p, chair); p.setFace('laugh', 1); sfx.giggle(voiceOf); }
          else { p.st.baseY = BASE; p.g.rotation.y = 0; p.setFace('laugh', 1); if (voiceOf) sfx.giggle(voiceOf); else sfx.bark(); }
        },
      },
    });
  });
  items.push({ center: () => girl.center(), r: 0.3, tap: () => { girl.jump(2.6); girl.setFace('laugh', 1); sfx.giggle('girl'); } });
  mode = { pick: () => items, hint: () => null };
  // ねむりの泡（寝ている人の頭の上）
  updaters.add(dt => {
    sleepT += dt;
    if (sleepT < 0.9) return; sleepT = 0;
    people.forEach(p => { if (p.st.pose === 'lie' && p !== dog && p.on) { const hp = p.head.getWorldPosition(new V3()); puff.emit(hp.add(new V3(0.1, 0.25, 0)), new V3(0.1, 0.5, 0), 1.4, 0.05); } });
  });
  setTimeout(() => document.getElementById('again').classList.add('on'), 6000 / timeScale);
}

// もういちど（ほかの素材で）
document.getElementById('again').addEventListener('click', async () => {
  audioInit();
  if (busy || state.scene !== 4) return;
  document.getElementById('again').classList.remove('on');
  mode = null;
  [mom, boy, dog, dad].forEach(p => { p.on = null; p.st.pose = 'stand'; p.st.baseY = 0; p.g.rotation.set(0, 0, 0); p.baseFace = 'smile'; p.setFace('smile'); });
  [mom, boy, dog].forEach(p => { p.g.visible = false; p.g.position.set(-9, 0, 3.5); });
  scene.attach(sign3); sign3.visible = false; sign3.userData.up = false;
  reel.visible = false;
  newRound();
  sfx.swoosh();
  await runRounds();
});

async function runRounds() {
  await scene1();
  await scene2();
  await scene3();
}

// ---------- ループ ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000) * timeScale; last = now;
  for (let i = tweens.length - 1; i >= 0; i--) {
    const t = tweens[i]; t.t += dt; const k = Math.min(1, t.t / t.dur);
    t.fn(t.e(k));
    if (k >= 1) { tweens.splice(i, 1); t.res(); }
  }
  updaters.forEach(f => f(dt));
  people.forEach(p => p.update(dt));
  const ck = 1 - Math.exp(-cam.speed * dt);
  cam.pos.lerp(cam.tPos, ck); cam.look.lerp(cam.tLook, ck);
  camera.position.copy(cam.pos); camera.lookAt(cam.look);
  updateHint(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------- デバッグ／サムネ用の自動進行 ----------
window.__gf = {
  state, get busy() { return busy; },
  async autoStep() {
    if (busy || !mode) return false;
    if (mode.pick) {
      const list = mode.pick().filter(q => !q.enabled || q.enabled());
      const p = state.scene === 1 && !state.round.kind ? list[Number(Q.get('pile') || 0)] : list[0];
      if (p) { p.tap && p.tap(); return true; }
    }
    if (mode.onDown) {
      const b = state.round.foam.blobs.find(b => b.alive && b.house);
      if (b) { const s = toScreen(b.p); mode.onDown(s.x, s.y, null); setTimeout(() => mode && mode.onUp && mode.onUp(), 900); return true; }
    }
    return false;
  },
  setSpeed(s) { timeScale = s; },
  scr(name) {
    const map = { mom, dad, boy, dog, girl };
    if (map[name]) return toScreen(map[name].center());
    const p = state.round.pieces.find(q => q.id === name);
    return p && toScreen(p.group.getWorldPosition(new V3()).add(new V3(0, 0.35, 0)));
  },
  pose(name) { const p = { mom, dad, boy, dog }[name]; return p ? p.st.pose : null; },
};

async function start() {
  resize();
  newRound();
  requestAnimationFrame(frame);
  await new Promise(r => setTimeout(r, 300));
  document.getElementById('load').classList.add('off');
  await scene0();
  await runRounds();
}
start();
