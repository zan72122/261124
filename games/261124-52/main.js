import * as THREE from './three.module.min.js';
import { RoomEnvironment } from './RoomEnvironment.js';
import { unlockAudio, sfx, setEngine, setXray, setMusic } from './audio.js';
import * as M from './models.js';
import * as W from './world.js';

const V3 = THREE.Vector3;
const v3 = (x, y, z) => new V3(x, y, z);
const params = new URLSearchParams(location.search);
const TS = +(params.get('ts') || 1);

// ---------- レンダラ ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: params.has('shot') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 2500);
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const home = new THREE.Scene(); home.environment = envTex;
const skyS = new THREE.Scene(); skyS.environment = envTex;
let active = home;

function makeSun(scene, intensity, range) {
  const s = new THREE.DirectionalLight(0xfff0dc, intensity);
  s.castShadow = true; s.shadow.mapSize.set(2048, 2048);
  const c = s.shadow.camera; c.left = c.bottom = -range; c.right = c.top = range; c.near = 1; c.far = 80;
  s.shadow.bias = -0.0005; s.shadow.normalBias = 0.03;
  scene.add(s, s.target);
  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x7a6a4a, 0.55));
  return s;
}
const sunHome = makeSun(home, 2.6, 7);
const sunSky = makeSun(skyS, 2.8, 5);
function aimSun(sun, p, off = v3(7, 13, 8)) { sun.target.position.copy(p); sun.position.copy(p).add(off); }

const garden = W.buildGarden(home);
const sky = W.buildSky(skyS);

// ---------- 時間・トゥイーン ----------
const tweens = [], ticks = new Set();
const ease = {
  io: k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2,
  out: k => 1 - Math.pow(1 - k, 3), in: k => k * k * k, lin: k => k,
  back: k => { const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
};
function tween(dur, fn, e = ease.io) { return new Promise(res => tweens.push({ t: 0, dur, fn, e, res })); }
const wait = s => tween(s, () => {});
function until(cond) { return new Promise(res => { const f = () => { if (cond()) { ticks.delete(f); res(); } }; ticks.add(f); }); }
function lerpV(a, b, k) { return a.clone().lerp(b, k); }
function arc(obj, to, dur = 0.5, h = 0.3, rotTo = null) {
  const from = obj.position.clone(), q0 = obj.quaternion.clone(), q1 = rotTo ? new THREE.Quaternion().setFromEuler(rotTo) : null;
  return tween(dur, k => { obj.position.lerpVectors(from, to, k); obj.position.y += Math.sin(k * Math.PI) * h; if (q1) obj.quaternion.slerpQuaternions(q0, q1, k); });
}

// ---------- カメラ ----------
const cam = { pos: v3(0, 2, 8), look: v3(0, 0.5, 0), w: 6, h: 3 };
let camShake = 0;
function shot(pos, look, w, h, dur = 1.4) {
  const p0 = cam.pos.clone(), l0 = cam.look.clone(), w0 = cam.w, h0 = cam.h;
  if (dur <= 0) { cam.pos.copy(pos); cam.look.copy(look); cam.w = w; cam.h = h; return Promise.resolve(); }
  return tween(dur, k => { cam.pos.lerpVectors(p0, pos, k); cam.look.lerpVectors(l0, look, k); cam.w = w0 + (w - w0) * k; cam.h = h0 + (h - h0) * k; });
}
function applyCamera(t) {
  const aspect = innerWidth / innerHeight;
  const dir = cam.pos.clone().sub(cam.look); let d = dir.length(); dir.normalize();
  const need = (wd, hd, dd) => Math.max(2 * Math.atan(hd / 2 / dd), 2 * Math.atan(wd / 2 / (dd * aspect)));
  let f = need(cam.w, cam.h, d);
  const MAX = THREE.MathUtils.degToRad(68);
  if (f > MAX) { d = Math.max(cam.h / 2 / Math.tan(MAX / 2), cam.w / 2 / (aspect * Math.tan(MAX / 2))); f = MAX; }
  camera.fov = THREE.MathUtils.radToDeg(f); camera.aspect = aspect; camera.updateProjectionMatrix();
  camera.position.copy(cam.look).addScaledVector(dir, d);
  camera.position.x += Math.sin(t * 0.7) * 0.012 * d * 0.1; camera.position.y += Math.sin(t * 0.9) * 0.01 * d * 0.1;
  if (camShake > 0) { camera.position.x += (Math.random() - 0.5) * camShake; camera.position.y += (Math.random() - 0.5) * camShake; }
  camera.lookAt(cam.look);
}
function toScreen(v) { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight, z: p.z }; }
function worldOf(o) { return o.getWorldPosition(new V3()); }
function screenDist(a, b) { const p = toScreen(a), q = toScreen(b); return Math.hypot(p.x - q.x, p.y - q.y); }
const nearPx = () => Math.max(70, Math.min(innerWidth, innerHeight) * 0.16);

// ---------- 入力 ----------
const raycaster = new THREE.Raycaster();
let items = [], busy = false, idle = 0, bgDrag = null, bgTap = null;
function addItem(obj, o) { const it = { obj, on: () => true, ...o }; items.push(it); return it; }
function removeItem(it) { items = items.filter(x => x !== it); }
let drag = null;
function rayAt(x, y) { raycaster.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), camera); return raycaster.ray; }
function pick(x, y) {
  rayAt(x, y);
  const live = items.filter(i => i.on() && i.obj.parent);
  const hits = raycaster.intersectObjects(live.map(i => i.obj), true);
  for (const h of hits) {
    let o = h.object;
    while (o) { const it = live.find(i => i.obj === o); if (it) return { it, point: h.point }; o = o.parent; }
  }
  return null;
}
function ripple(x, y) { const d = document.createElement('div'); d.className = 'ripple'; d.style.left = x + 'px'; d.style.top = y + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 500); }
canvas.addEventListener('pointerdown', e => {
  e.preventDefault(); unlockAudio(); idle = 0; ripple(e.clientX, e.clientY);
  if (drag) return;
  const p = busy ? null : pick(e.clientX, e.clientY);
  if (p) {
    const wp = worldOf(p.it.obj);
    const n = camera.getWorldDirection(new V3()).negate();
    drag = { it: p.it, id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n, wp), off: wp.clone().sub(p.point) };
    drag.plane.setFromNormalAndCoplanarPoint(n, p.point);
    p.it.down && p.it.down();
  } else {
    drag = { bg: true, id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), moved: false };
  }
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
});
canvas.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  idle = 0;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) > 10) { drag.moved = true; if (!drag.bg && drag.it.drag && drag.it.drag.start) drag.it.drag.start(); }
  if (drag.bg) { if (bgDrag) bgDrag(e.clientX - drag.lx, e.clientY - drag.ly, dx, dy); drag.lx = e.clientX; drag.ly = e.clientY; return; }
  if (drag.moved && drag.it.drag) {
    const hit = rayAt(e.clientX, e.clientY).intersectPlane(drag.plane, new V3());
    if (hit) drag.it.drag.move(hit.add(drag.off), dx, dy);
  }
});
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  if (d.bg) { if (!d.moved && bgTap) bgTap(e.clientX, e.clientY); if (bgDrag) bgDrag(0, 0, 0, 0, true); return; }
  if (!d.moved) { if (d.it.tap) d.it.tap(); }
  else if (d.it.drag) d.it.drag.drop();
  d.it.up && d.it.up();
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

// ドラッグで動かせる物（落とした所でターゲット判定）
function draggable(obj, { start, move, drop, tap, on, getTarget }) {
  return addItem(obj, {
    on: on || (() => true), tap,
    drag: {
      start() { sfx.pick(); start && start(); },
      move(p, dx, dy) { const par = obj.parent; const lp = par.worldToLocal(p.clone()); obj.position.copy(lp); move && move(p, dx, dy); },
      drop() { drop && drop(); },
    },
  });
}

// ---------- ヒントの手 ----------
const hand = document.getElementById('hand');
let hint = null, hintT = 0;
function updateHint(dt) {
  const h = hint && hint();
  const show = h && idle > (h.delay || 4.5) && !busy && !drag;
  hand.style.opacity = show ? 1 : 0;
  if (!show) { hintT = 0; return; }
  hintT += dt;
  let x, y, s = 1;
  if (h.to) {
    const a = toScreen(h.at instanceof V3 ? h.at : worldOf(h.at)), b = toScreen(h.to instanceof V3 ? h.to : worldOf(h.to));
    const k = Math.min(1, Math.max(0, ((hintT % 2.2) - 0.4) / 1.4)), kk = ease.io(k);
    x = a.x + (b.x - a.x) * kk; y = a.y + (b.y - a.y) * kk; s = (hintT % 2.2) < 0.4 ? 0.9 : 1;
  } else if (h.wiggle) {
    const a = toScreen(h.at instanceof V3 ? h.at : worldOf(h.at));
    x = a.x + Math.sin(hintT * 4) * 50; y = a.y + Math.cos(hintT * 4) * 20;
  } else {
    const a = toScreen(h.at instanceof V3 ? h.at : worldOf(h.at));
    x = a.x; y = a.y; s = 1 - Math.max(0, Math.sin(hintT * 6)) * 0.15;
  }
  hand.style.transform = `translate(${x}px,${y}px) scale(${s})`;
}

// ---------- 演出：紙吹雪・キラキラ ----------
const confetti = (() => {
  const N = 260, geo = new THREE.PlaneGeometry(0.05, 0.03), m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: false });
  const mesh = new THREE.InstancedMesh(geo, m, N); mesh.frustumCulled = false;
  const cols = [0xff5a8a, 0xffd23f, 0x2f7de1, 0x5fd06b, 0xff9a1a, 0xffffff];
  const ps = [];
  for (let i = 0; i < N; i++) { ps.push({ p: v3(0, -999, 0), v: v3(), r: v3(), life: 0 }); mesh.setColorAt(i, new THREE.Color(cols[i % cols.length])); }
  const dummy = new THREE.Object3D(); let cursor = 0;
  return {
    mesh,
    burst(at, n = 60, power = 2.2, scale = 1) {
      if (mesh.parent !== active) active.add(mesh);
      for (let i = 0; i < n; i++) { const q = ps[cursor++ % N]; q.p.copy(at); q.v.set((Math.random() - 0.5) * power, Math.random() * power + power * 0.6, (Math.random() - 0.5) * power).multiplyScalar(scale); q.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); q.life = 2.5; q.s = scale; }
    },
    update(dt) {
      for (let i = 0; i < N; i++) {
        const q = ps[i];
        if (q.life > 0) { q.life -= dt; q.v.y -= 4.5 * dt * (q.s || 1); q.v.multiplyScalar(1 - 1.6 * dt); q.p.addScaledVector(q.v, dt); q.r.x += dt * 8; q.r.y += dt * 6; }
        dummy.position.copy(q.life > 0 ? q.p : v3(0, -999, 0)); dummy.rotation.set(q.r.x, q.r.y, q.r.z); dummy.scale.setScalar(q.life > 0 ? (q.s || 1) : 0.0001); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
})();
const sparkTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,240,150,0.9)'); gr.addColorStop(1, 'rgba(255,220,100,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(32, 0); g.lineTo(36, 28); g.lineTo(64, 32); g.lineTo(36, 36); g.lineTo(32, 64); g.lineTo(28, 36); g.lineTo(0, 32); g.lineTo(28, 28); g.fill(); const t = new THREE.CanvasTexture(c); return t; })();
function sparkle(at, n = 8, size = 0.12, spread = 0.3) {
  sfx.sparkle();
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.copy(at).add(v3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread)); active.add(s);
    const sz = size * (0.6 + Math.random() * 0.8), dl = Math.random() * 0.2;
    tween(0.7 + dl, k => { const kk = Math.max(0, (k * (0.7 + dl) - dl) / 0.7); s.scale.setScalar(sz * Math.sin(kk * Math.PI)); s.position.y += 0.003; }).then(() => { s.parent && s.parent.remove(s); s.material.dispose(); });
  }
}
// 光るリング（ゴースト・ターゲット表示）
const ringTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 10; g.setLineDash([16, 12]); g.beginPath(); g.arc(64, 64, 52, 0, 7); g.stroke(); return new THREE.CanvasTexture(c); })();
function ringSprite(size) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, transparent: true, depthTest: false, depthWrite: false })); s.renderOrder = 10; s.scale.setScalar(size); return s; }
const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false });
function ghostOf(obj) { const g = obj.clone(true); g.traverse(m => { if (m.isMesh) { m.material = ghostMat; m.castShadow = false; m.receiveShadow = false; } }); return g; }
// くるくる星（パパが目を回す）
function makeStars() {
  const g = new THREE.Group();
  const st = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#ffd23f'; x.strokeStyle = '#c98a00'; x.lineWidth = 3; x.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 28, a = i / 10 * Math.PI * 2 - Math.PI / 2; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.closePath(); x.fill(); x.stroke(); return new THREE.CanvasTexture(c); })();
  for (let i = 0; i < 4; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, transparent: true, depthWrite: false })); s.scale.setScalar(0.1); s.userData.a = i / 4 * Math.PI * 2; g.add(s); }
  g.update = t => g.children.forEach(s => { const a = s.userData.a + t * 4; s.position.set(Math.cos(a) * 0.16, Math.sin(t * 8 + s.userData.a) * 0.02, Math.sin(a) * 0.16); });
  return g;
}

// ---------- 登場人物 ----------
const girl = M.makeGirl();
const papa = M.makePapa();
const pax = [M.makePlush('bear'), M.makePlush('bunny'), M.makePlush('dog')];
const people = [girl, papa, ...pax];
const plane = W.buildPlane();
home.add(plane.group);
for (const k in plane.parts) plane.body.add(plane.parts[k].obj);

// ---------- 画面遷移 ----------
const fadeEl = document.getElementById('fade');
async function fade(on, dur = 0.6, color = '#fff') { fadeEl.style.background = color; fadeEl.style.transitionDuration = dur + 's'; fadeEl.style.opacity = on ? 1 : 0; await wait(dur); }

function walk(H, to, dur = 1.0, faceY = null) {
  const from = H.root.position.clone(); H.bounceAmp = 1;
  const r0 = H.root.rotation.y;
  if (faceY === null) faceY = Math.atan2(to.x - from.x, to.z - from.z);
  return tween(dur, k => { H.root.position.lerpVectors(from, to, k); H.bounce = k * dur * 9; H.root.rotation.y = r0 + (faceY - r0) * Math.min(1, k * 3); }, ease.lin).then(() => { H.bounceAmp = 0; });
}
function hop(P, to, dur = 1.0, faceY = null) {
  const from = P.root.position.clone(), r0 = P.root.rotation.y;
  if (faceY === null) faceY = Math.atan2(to.x - from.x, to.z - from.z);
  const hops = Math.max(2, Math.round(from.distanceTo(to) / 0.35));
  return tween(dur, k => { P.root.position.lerpVectors(from, to, k); P.root.position.y = from.y + (to.y - from.y) * k + Math.abs(Math.sin(k * hops * Math.PI)) * 0.1; P.root.rotation.y = r0 + (faceY - r0) * Math.min(1, k * 3); }, ease.lin);
}
function jump(H, n = 2, h = 0.15) { const y0 = H.root.position.y; return tween(0.45 * n, k => { H.root.position.y = y0 + Math.abs(Math.sin(k * n * Math.PI)) * h; }, ease.lin); }

// 敬礼のポーズ（右手）
const saluteQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.2, 0.1, -2.3));
function salute(on) { const a = girl.arms.R; a.pose = on ? () => saluteQ : null; a.elbowT = on ? -0.0 : 0; a.el.rotation.z = 0; a.elFix = on; }
const waveQ = new THREE.Quaternion();
function waveArm(H, side, on) { const a = H.arms[side]; a.pose = on ? (t => waveQ.setFromEuler(new THREE.Euler(0, 0, (side === 'R' ? -1 : 1) * (2.6 + Math.sin(t * 10) * 0.35)))) : null; }

// =====================================================================
// 場面0：制服を着る
// =====================================================================
const G0 = v3(3.3, 0, 1.5);
async function scene0() {
  setMusic(0);
  girl.root.position.copy(G0); girl.root.rotation.y = -0.35; home.add(girl.root);
  girl.look = null; girl.baseExpr = 'smile';
  const box = M.carton(0.5, 0.42, 0.4, 0xf2e4d4); box.position.set(2.55, 0, 1.85); box.rotation.y = 0.25; home.add(box);
  const hat = girl.hat; hat.position.set(2.48, 0.43, 1.95); hat.rotation.set(0, 0.6, 0); home.add(hat);
  const folded = new THREE.Group();
  const fj = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.22), girl.navy); fj.position.y = 0.035; folded.add(fj);
  const fc = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.075, 0.08), M.fabric(0xffffff)); fc.position.set(0, 0.036, -0.06); folded.add(fc);
  const goldM = M.mat(0xe3b341, { metalness: 0.9, roughness: 0.3 });
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), goldM); b.position.set(0, 0.072, -0.01 + i * 0.05); folded.add(b); }
  for (const s of [-1, 1]) { const ep = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.04), goldM); ep.position.set(s * 0.11, 0.075, -0.08); folded.add(ep); }
  M.shadow(folded); folded.position.set(2.66, 0.42, 1.72); folded.rotation.y = 0.25; home.add(folded);
  const hatHome = hat.position.clone(), jHome = folded.position.clone();
  aimSun(sunHome, G0);
  await shot(v3(2.75, 1.05, 3.75), v3(3.0, 0.68, 1.6), 1.7, 1.25, 0);
  await fade(false, 0.8);
  let wearHat = false, wearJacket = false;
  const headPos = () => girl.head.localToWorld(girl.hatSeat.clone());
  const chestPos = () => girl.torso.localToWorld(v3(0, 0, 0.1));
  async function putHat() {
    wearHat = true; removeItem(hatIt);
    const to = headPos(); await arc(hat, home.worldToLocal(to), 0.45, 0.25, new THREE.Euler(0, girl.root.rotation.y, 0));
    girl.head.add(hat); hat.position.copy(girl.hatSeat); hat.rotation.copy(girl.hatRot);
    sfx.pop(); sparkle(to, 10, 0.15); girl.say('joy', 1.8); jump(girl, 1, 0.08);
  }
  async function putJacket() {
    wearJacket = true; removeItem(jIt);
    await arc(folded, home.worldToLocal(chestPos()), 0.45, 0.25);
    home.remove(folded); girl.wearJacket(); girl.body.add(girl.jacket); girl.jacket.position.y = girl.torso.position.y - 0.13;
    sfx.zip(); sparkle(chestPos(), 12, 0.15, 0.4); girl.say('joy', 1.8); jump(girl, 1, 0.08);
  }
  async function wrong(obj, homeP) { sfx.boing(); girl.say('oops', 1.2); await arc(obj, homeP, 0.5, 0.2); }
  const hatIt = draggable(hat, {
    tap: () => putHat(),
    start: () => { girl.look = null; },
    move: (p) => { girl.look = p; },
    drop: () => { girl.look = null; if (screenDist(worldOf(hat), headPos()) < nearPx() * 1.3) putHat(); else wrong(hat, hatHome); },
  });
  const jIt = draggable(folded, {
    tap: () => putJacket(),
    move: (p) => { girl.look = p; },
    drop: () => { girl.look = null; if (screenDist(worldOf(folded), chestPos()) < nearPx() * 1.4 || screenDist(worldOf(folded), headPos()) < nearPx()) putJacket(); else wrong(folded, jHome); },
  });
  addItem(girl.root, { tap: () => { girl.say('laugh', 1); sfx.squeak(); jump(girl, 1, 0.06); } });
  hint = () => !wearHat ? { at: hat, to: headPos() } : !wearJacket ? { at: folded, to: chestPos() } : null;
  await until(() => wearHat && wearJacket);
  hint = null; items = [];
  await wait(0.9);
  busy = true;
  salute(true); girl.say('joy', 2.5); sfx.fanfare(); confetti.burst(headPos().add(v3(0, 0.3, 0)), 80, 2.0, 0.8);
  await wait(2.2);
  salute(false);
  home.remove(box);
  busy = false;
}

// =====================================================================
// 場面1：段ボール飛行機をつくる
// =====================================================================
async function scene1() {
  setMusic(1);
  const layout = {
    wingR: { pos: v3(-0.9, 0.025, 3.0), rot: new THREE.Euler(0, -0.3, 0) },
    wingL: { pos: v3(-3.3, 0.025, 2.1), rot: new THREE.Euler(0, 0.5, 0) },
    tail: { pos: v3(1.0, 0.03, 3.1), rot: new THREE.Euler(0, 0.4, 0) },
    prop: { pos: v3(2.3, 0.05, 2.8), rot: new THREE.Euler(0, 0, Math.PI / 2) },
  };
  const state = {};
  const ghosts = {}, rings = {};
  const jointOf = { wingL: v3(-0.1, 0.55, -0.65), wingR: v3(-0.1, 0.55, 0.65), tail: v3(-1.95, 1.3, 0), prop: v3(2.3, 0.45, 0) };
  // テープの小道具
  const tapeRoll = new THREE.Group();
  const tr = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.035, 12, 24), M.colorTape(0xffd23f)); tapeRoll.add(tr);
  const trc = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 20, 1, true), M.cbMat()); trc.rotation.x = Math.PI / 2; tapeRoll.add(trc);
  M.shadow(tapeRoll);
  for (const k in plane.parts) {
    const P = plane.parts[k];
    P.obj.position.copy(layout[k].pos); P.obj.rotation.copy(layout[k].rot);
    state[k] = 'ground';
    const g = ghostOf(P.obj); g.position.copy(P.home.pos); g.rotation.copy(P.home.rot); plane.body.add(g); ghosts[k] = g;
  }
  girl.look = null;
  await shot(v3(0.4, 4.4, 8.4), v3(-0.2, 0.35, 1.1), 8.6, 3.8, 2.0);
  aimSun(sunHome, v3(0, 0, 1));
  await walk(girl, v3(3.35, 0, 1.6), 0.8, -0.8);
  const loose = {};
  async function snap(k) {
    const P = plane.parts[k]; state[k] = 'loose';
    await arc(P.obj, P.home.pos, 0.35, 0.1, P.home.rot);
    sfx.snap(); plane.body.remove(ghosts[k]); girl.say('wow', 0.8);
    const r = ringSprite(0.45); r.position.copy(jointOf[k]); plane.body.add(r); rings[k] = r;
    loose[k] = true;
  }
  async function doTape(k) {
    if (state[k] !== 'loose' || busy) return;
    state[k] = 'taping'; busy = true;
    const P = plane.parts[k], tg = plane.tapes[k], at = plane.body.localToWorld(jointOf[k].clone());
    plane.body.remove(rings[k]);
    girl.look = at; girl.arms.R.target = at; girl.say('focus', 2);
    tapeRoll.position.copy(at).add(v3(0, 0.3, 0.2)); home.add(tapeRoll);
    tg.visible = true;
    for (const m of tg.children) m.scale.setScalar(0.001);
    for (const m of tg.children) {
      sfx.tape();
      const mp = plane.body.localToWorld(m.position.clone());
      await tween(0.38, kk => { m.scale.set(Math.max(0.001, kk), 1, 1); m.scale.set(kk < 0.05 ? 0.001 : 1, 1, 1).multiplyScalar(1); m.scale.setScalar(Math.max(0.001, kk)); tapeRoll.position.lerpVectors(tapeRoll.position, mp.clone().add(v3(0, 0.12, 0.05)), 0.25); tapeRoll.rotation.z += 0.3; });
    }
    home.remove(tapeRoll);
    loose[k] = false; P.obj.rotation.copy(P.home.rot); P.obj.position.copy(P.home.pos);
    state[k] = 'done'; girl.arms.R.target = null; girl.look = null;
    girl.say('joy', 1.5); sparkle(at, 10, 0.2, 0.5); sfx.ding();
    busy = false;
  }
  for (const k in plane.parts) {
    const P = plane.parts[k];
    draggable(P.obj, {
      on: () => state[k] === 'ground' || state[k] === 'loose',
      tap: () => {
        if (state[k] === 'loose') doTape(k);
        else if (state[k] === 'ground') { snap(k); }
      },
      start: () => { if (state[k] === 'loose') return; P.obj.rotation.copy(P.home.rot); girl.say('smile'); },
      move: (p) => { if (state[k] !== 'ground') return; girl.look = p; P.obj.position.y = Math.max(P.obj.position.y, 0.05); },
      drop: () => {
        girl.look = null;
        if (state[k] === 'loose') { P.obj.position.copy(P.home.pos); return; }
        const here = worldOf(P.obj);
        if (screenDist(here, plane.body.localToWorld(P.home.pos.clone())) < nearPx() * 1.3) snap(k);
        else {
          const other = Object.keys(plane.parts).find(o => o !== k && state[o] === 'ground' && screenDist(here, plane.body.localToWorld(plane.parts[o].home.pos.clone())) < nearPx());
          sfx.boing(); girl.say('oops', 1.3);
          arc(P.obj, layout[k].pos, 0.6, 0.3, layout[k].rot);
        }
      },
    });
  }
  // 女の子をタップすると喜ぶ
  addItem(girl.root, { tap: () => { girl.say('laugh', 1); sfx.squeak(); jump(girl, 1, 0.06); } });
  const wob = (dt, t) => {
    for (const k in loose) if (loose[k]) { const P = plane.parts[k]; P.obj.rotation.set(P.home.rot.x + Math.sin(t * 9) * 0.04, P.home.rot.y, P.home.rot.z + Math.sin(t * 7) * 0.05); }
    for (const k in ghosts) ghosts[k].traverse(m => { if (m.isMesh) m.material.opacity = 0.18 + Math.sin(t * 4) * 0.1; });
    for (const k in rings) { rings[k].material.rotation = t; rings[k].scale.setScalar(0.42 + Math.sin(t * 5) * 0.05); }
  };
  ticks.add(wob);
  const order = ['wingR', 'wingL', 'tail', 'prop'];
  hint = () => {
    const l = order.find(k => state[k] === 'loose');
    if (l) return { at: plane.body.localToWorld(jointOf[l].clone()) };
    const g = order.find(k => state[k] === 'ground');
    if (g) return { at: plane.parts[g].obj, to: plane.body.localToWorld(plane.parts[g].home.pos.clone()) };
    return null;
  };
  await until(() => order.every(k => state[k] === 'done'));
  ticks.delete(wob); hint = null; items = [];
  busy = true;
  await wait(0.5);
  sfx.fanfare(); girl.say('laugh', 3); waveArm(girl, 'R', true); waveArm(girl, 'L', true);
  confetti.burst(v3(0, 1.6, 0), 140, 3.2, 1.2);
  const spinT = (dt) => { plane.parts.prop.spin.rotation.x += dt * 14; };
  ticks.add(spinT);
  jump(girl, 3, 0.15);
  await shot(v3(4.5, 2.2, 6.2), v3(0, 0.7, 0), 6.0, 2.8, 2.6);
  ticks.delete(spinT);
  waveArm(girl, 'R', false); waveArm(girl, 'L', false);
  busy = false;
}

// =====================================================================
// 場面2：空港の検査
// =====================================================================
const SEC = v3(-7.6, 0, -4.0);
const sec = W.buildSecurity();
sec.group.position.copy(SEC); home.add(sec.group);
const stars = makeStars();
const DESIRE = ['orange', 'berry', 'milk'];
const BAGS = [
  { color: 0xd8453c, items: ['shirt', 'lolly', 'duck'] },
  { color: 0xf0b72f, items: ['donut', 'brush', 'sock'] },
  { color: 0x3a9a6a, items: ['ball', 'book', 'choco'] },
];
function papaFall() {
  papa.down = true; papa.say('wow', 0.4); sfx.slip();
  const r0 = papa.root.rotation.z;
  return tween(0.55, k => { papa.root.rotation.x = -1.35 * k; papa.root.position.y = Math.sin(k * Math.PI) * 0.25; for (const l of papa.legs) l.rotation.x = -Math.sin(k * Math.PI) * 1.4 - k * 0.4; papa.arms.L.elbowT = papa.arms.R.elbowT = -1.2 * k; }, ease.in).then(() => {
    sfx.thud(); camShake = 0.05; setTimeout(() => camShake = 0, 250);
    papa.face.set('dizzy'); papa.baseExpr = 'dizzy'; papa.exprTimer = 0;
    papa.head.add(stars); stars.position.set(0, 0.2, 0); stars.visible = true;
  });
}
function papaUp() {
  papa.down = false; stars.visible = false; papa.baseExpr = 'smile';
  sfx.boing(); papa.say('joy', 1.5);
  const r0 = papa.root.rotation.x;
  return tween(0.6, k => { papa.root.rotation.x = r0 * (1 - k); papa.root.position.y = Math.sin(k * Math.PI) * 0.2; for (const l of papa.legs) l.rotation.x = -0.4 * (1 - k); papa.arms.L.elbowT = papa.arms.R.elbowT = -1.2 * (1 - k); }, ease.back);
}
async function scene2() {
  setMusic(1);
  await fade(true, 0.5);
  girl.root.position.copy(SEC).add(v3(-1.6, 0, -0.45)); girl.root.rotation.y = 0.35; girl.look = null;
  papa.root.position.copy(SEC).add(v3(2.2, 0, -0.25)); papa.root.rotation.set(0, -0.55, 0); home.add(papa.root);
  papa.look = null; papa.baseExpr = 'smile';
  const C = SEC.clone();
  aimSun(sunHome, C.clone().add(v3(0, 0, 0)));
  await shot(C.clone().add(v3(0.25, 2.0, 3.8)), C.clone().add(v3(0.25, 0.78, 0.05)), 4.9, 2.35, 0);
  for (const p of pax) { p.stand(); p.root.position.copy(C).add(v3(-4.2, 0, 0.9)); p.root.rotation.y = Math.PI / 2; home.add(p.root); p.root.visible = false; }
  await fade(false, 0.6);
  const sTop = sec.deskTop;
  const L = (x, y, z) => C.clone().add(v3(x, y, z));
  const tunX = 0.72, entX = -0.32, exitX = 1.78, beltY = 0.536;
  const stampHome = sec.stamp.position.clone();
  let gagDone = false, current = null;
  // パパをタップ：倒れていたら起こしてあげる
  addItem(papa.root, {
    tap: async () => {
      if (papa.down) { girl.say('joy', 1.2); girl.look = worldOf(papa.head); await papaUp(); girl.look = null; papa.look = null; signWiggle(); }
      else { papa.say('joy', 1); sfx.squeak(); jump(papa, 1, 0.08); }
    },
  });
  addItem(girl.root, { tap: () => { girl.say('laugh', 1); sfx.squeak(); } });
  function signWiggle() {
    sfx.wiggle();
    const s0 = sec.sign.scale.clone();
    tween(1.0, k => { sec.sign.scale.copy(s0).multiplyScalar(1 + Math.sin(k * Math.PI) * 0.35); sec.sign.rotation.z = Math.sin(k * Math.PI * 4) * 0.12 * (1 - k); }, ease.lin);
  }
  addItem(sec.sign, { tap: signWiggle });
  // 緑のボタン
  addItem(sec.btnHit, {
    tap: async () => {
      sec.button.position.y -= 0.02; setTimeout(() => sec.button.position.y += 0.02, 150);
      sfx.beep(2);
      if (!current || current.bagState !== 'scan') return;
      if (current.candyIn) await alarm(true);
      else passBag(current);
    },
  });
  // 女の子の見る先
  async function alarm(byPapa) {
    busy = true;
    const c = current, b = c.bag;
    c.bagState = 'moving';
    if (byPapa) { papa.arms.R.target = worldOf(sec.button); await wait(0.35); sec.button.position.y -= 0.02; sfx.beep(2); await wait(0.15); sec.button.position.y += 0.02; papa.arms.R.target = null; }
    papa.say('joy', 1);
    const x0 = b.group.position.x;
    await tween(0.6, k => { b.group.position.x = x0 + (L(1.12, 0, 0).x - x0) * k; }, ease.lin);
    sfx.buzzer(); girl.say('wow', 1.5);
    const flash = (dt, t) => { const on = Math.sin(t * 20) > 0; sec.lamp.material.emissiveIntensity = on ? 3 : 0.1; sec.lampLight.intensity = on ? 3 : 0; };
    ticks.add(flash);
    await wait(0.3);
    if (!papa.down) await papaFall();
    await wait(0.4);
    girl.say('laugh', 1.6); sfx.cheer();
    const x1 = b.group.position.x;
    await tween(0.6, k => { b.group.position.x = x1 + (L(tunX, 0, 0).x - x1) * k; }, ease.io);
    ticks.delete(flash); sec.lamp.material.emissiveIntensity = 0.05; sec.lampLight.intensity = 0;
    c.bagState = 'scan';
    busy = false;
  }
  function passBag(c) {
    c.bagState = 'moving';
    sfx.ding(); sparkle(worldOf(c.bag.group).add(v3(0, 0.3, 0)), 8, 0.15, 0.4);
    const b = c.bag, x0 = b.group.position.x;
    tween(1.1, k => { b.group.position.x = x0 + (L(exitX, 0, 0).x - x0) * k; }, ease.io).then(() => { c.bagState = 'out'; });
  }
  // X線：カバンが透ける
  const xrayMat = new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.9 });
  const xr = (dt, t) => {
    sec.beltT.offset.x -= dt * (current && current.bagState === 'moving' ? 1.2 : 0);
    if (!current || !current.bag) return;
    const b = current.bag, lx = b.group.position.x - C.x;
    const inside = lx > tunX - 0.4 && lx < tunX + 0.4;
    const target = inside ? 1 : 0;
    b.xray += (target - b.xray) * Math.min(1, dt * 6);
    const x = b.xray;
    b.shell.opacity = 1 - 0.85 * x; b.trimM.opacity = 1 - 0.8 * x;
    b.shell.depthWrite = b.trimM.depthWrite = x < 0.5;
    b.shell.emissive.setHex(0x2288cc).multiplyScalar(x * 0.8);
    for (const it of b.content) it.obj.traverse(m => { if (m.isMesh) m.material = x > 0.4 ? (it.bad ? m.userData.glowMat : xrayMat) : m.userData.realMat; });
    sec.xlight.intensity = x * 1.5;
    setXray(x > 0.5);
    if (current.noRing) { current.noRing.visible = x > 0.6 && current.candyIn; current.noRing.scale.setScalar(0.2 + Math.sin(t * 6) * 0.02); }
    // のれんが揺れる
    sec.tun.children.forEach(ch => { if (ch.userData.curtain) { const dx = Math.abs((ch.position.x + sec.tun.position.x) - lx); ch.rotation.z = dx < 0.25 ? -0.5 * (1 - dx / 0.25) : ch.rotation.z * 0.9; } });
  };
  ticks.add(xr);
  const noTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; M.drawNoSign(c.getContext('2d'), 64, 64, 54); return new THREE.CanvasTexture(c); })();

  for (let i = 0; i < 3; i++) {
    const P = pax[i];
    const c = { P, stamped: false, bagState: 'carry', candyIn: true };
    current = c; window.__cur = c;
    // カバン
    const items3 = BAGS[i].items.map(k => {
      const bad = ['lolly', 'donut', 'choco'].includes(k);
      const obj = bad ? M.makeCandy3D(k) : M.makeItem(k);
      return { obj, bad, key: k };
    });
    const bag = W.makeBag(BAGS[i].color, items3); c.bag = bag;
    for (const it of items3) it.obj.traverse(m => { if (m.isMesh) m.userData.glowMat = new THREE.MeshBasicMaterial({ color: (Array.isArray(m.material) ? m.material[0] : m.material).color.clone().multiplyScalar(1.15) }); });
    P.root.visible = true; P.root.position.copy(L(-4.2, 0, 0.9));
    P.body.add(bag.group); bag.group.position.set(0.2, 0.12, 0.05); bag.group.scale.setScalar(0.8);
    // 入場
    await hop(P, L(-0.92, 0, 0.5), 1.6, -0.55);
    P.look = worldOf(girl.head); girl.look = worldOf(P.head); P.wave = 1.2; sfx.yay();
    // パスポートを置く
    const pp = W.makePassport(P.color, P.kind); c.pp = pp;
    pp.group.position.copy(L(-1.35, sTop + 0.002, 0.05)); pp.group.rotation.y = 0.05; home.add(pp.group);
    pp.group.scale.setScalar(0.01); tween(0.35, k => pp.group.scale.setScalar(Math.max(0.01, k)), ease.back); sfx.pop();
    // カバンをベルトの入口へ
    await wait(0.4);
    home.attach(bag.group); bag.group.scale.setScalar(1);
    await arc(bag.group, L(entX, beltY, 0), 0.6, 0.3, new THREE.Euler(0, 0, 0));
    sfx.thump(); c.bagState = 'start';
    girl.look = null; P.look = null;
    // 禁止リング
    const bad = items3.find(t => t.bad);
    const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: noTex, transparent: true, depthTest: false })); ring.renderOrder = 12; ring.visible = false;
    bad.obj.add(ring); c.noRing = ring;
    // パスポート：タップで開く、ハンコでポン
    const openPP = () => { if (pp.open) return Promise.resolve(); pp.open = true; sfx.pick(); return tween(0.45, k => { pp.hinge.rotation.z = Math.PI * k; }); };
    const stampPos = () => pp.group.localToWorld(v3(0.12, 0.02, 0));
    async function doStamp() {
      if (c.stamped || c.stamping) return; c.stamping = true; busy = true;
      await openPP();
      girl.arms.R.target = stampPos(); girl.say('focus', 1.2);
      const above = home.worldToLocal(stampPos().add(v3(0, 0.18, 0)));
      await arc(sec.stamp, sec.group.worldToLocal(stampPos().add(v3(0, 0.18, 0))), 0.35, 0.1);
      const sp = sec.stamp.position.clone();
      await tween(0.12, k => { sec.stamp.position.y = sp.y - 0.17 * k; }, ease.in);
      sfx.stamp(); pp.mark.visible = true; pp.mark.scale.setScalar(1.3); tween(0.2, k => pp.mark.scale.setScalar(1.3 - 0.3 * k));
      camShake = 0.015; setTimeout(() => camShake = 0, 120);
      await tween(0.15, k => { sec.stamp.position.y = sp.y - 0.17 * (1 - k); });
      girl.arms.R.target = null;
      c.stamped = true; P.say('joy', 1.6); girl.say('joy', 1.4); sparkle(stampPos(), 8, 0.12, 0.2); P.wave = 1;
      busy = false;
      await arc(sec.stamp, stampHome, 0.45, 0.15);
      await wait(0.5);
      await tween(0.35, k => { pp.hinge.rotation.z = Math.PI * (1 - k); });
      await arc(pp.group, home.worldToLocal(worldOf(P.body).add(v3(0, 0.25, 0))), 0.5, 0.25);
      home.remove(pp.group); sfx.pop();
    }
    const ppIt = addItem(pp.hit, { tap: () => { if (!pp.open) openPP(); else doStamp(); } });
    const stIt = draggable(sec.stamp, {
      on: () => !c.stamped && !c.stamping,
      tap: () => doStamp(),
      move: (p) => { girl.arms.R.target = p; girl.look = p; },
      drop: () => {
        girl.arms.R.target = null; girl.look = null;
        if (screenDist(worldOf(sec.stamp), stampPos()) < nearPx() * 1.2) doStamp();
        else { sfx.boing(); arc(sec.stamp, stampHome, 0.4, 0.1); }
      },
    });
    // カバン：タップかドラッグで検査機へ
    async function sendIn() {
      if (c.bagState !== 'start') return;
      c.bagState = 'moving'; sfx.thump();
      const x0 = bag.group.position.x;
      await tween(1.3, k => { bag.group.position.x = x0 + (L(tunX, 0, 0).x - x0) * k; bag.group.position.y = L(0, beltY, 0).y; bag.group.position.z = C.z; }, ease.io);
      c.bagState = 'scan';
      if (!gagDone) { gagDone = true; await wait(1.0); await alarm(true); }
    }
    const bagIt = draggable(bag.group, {
      on: () => c.bagState === 'start',
      tap: () => sendIn(),
      move: (p) => { bag.group.position.y = Math.max(bag.group.position.y, L(0, beltY, 0).y); },
      drop: () => { sendIn(); },
    });
    // 中身をタップ
    const contentIts = items3.map(it => addItem(it.obj, {
      on: () => c.bagState === 'scan' && bag.xray > 0.5 && (!it.bad || c.candyIn),
      tap: async () => {
        if (!it.bad) {
          sfx.wiggle(); const r0 = it.obj.rotation.z;
          tween(0.5, k => { it.obj.rotation.z = r0 + Math.sin(k * Math.PI * 4) * 0.4 * (1 - k); }, ease.lin);
          girl.say('smile', 0.6);
          return;
        }
        // 禁止のお菓子を取り出す
        c.candyIn = false; c.noRing.visible = false;
        girl.arms.R.target = worldOf(it.obj); girl.say('focus', 0.8);
        const wp = worldOf(it.obj); home.attach(it.obj);
        it.obj.traverse(m => { if (m.isMesh) m.material = m.userData.realMat; });
        sfx.pick();
        await arc(it.obj, L(-0.32, 0.25, 0.62), 0.6, 0.6);
        girl.arms.R.target = null;
        sfx.pop(); sparkle(L(-0.32, 0.3, 0.62), 6, 0.12, 0.2);
        it.obj.visible = false;
        girl.say('joy', 1.5); P.say('oops', 0.8); setTimeout(() => P.say('joy', 1.2), 800);
        await wait(0.5);
        if (!papa.down) { papa.say('joy', 1.2); papa.arms.L.pose = () => new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.2, 0, 0.6)); setTimeout(() => papa.arms.L.pose = null, 1200); }
        passBag(c);
      },
    }));
    hint = () => {
      if (papa.down) return { at: worldOf(papa.head).add(v3(0, -0.1, 0)) };
      if (c.bagState === 'scan' && c.candyIn && bag.xray > 0.5) return { at: worldOf(bad.obj) };
      if (c.bagState === 'start') return { at: bag.group, to: L(tunX, beltY + 0.1, 0) };
      if (!c.stamped && !c.stamping) return pp.open ? { at: sec.stamp, to: stampPos() } : { at: pp.group };
      return null;
    };
    await until(() => c.stamped && c.bagState === 'out' && !busy && !papa.down);
    // 出口でカバンを受け取り、飛行機へ
    removeItem(ppIt); removeItem(stIt); removeItem(bagIt); contentIts.forEach(removeItem);
    hint = null;
    await hop(P, L(exitX + 0.15, 0, 0.55), 1.4, Math.PI * 0.6);
    P.body.attach(bag.group); await arc(bag.group, v3(0.2, 0.12, 0.05), 0.35, 0.1);
    bag.group.scale.setScalar(0.8);
    P.say('joy', 1.5); P.wave = 1; sfx.yay();
    papa.look = worldOf(P.head);
    await hop(P, L(4.6, 0, 1.6), 1.2, Math.PI / 2);
    papa.look = null;
    P.root.visible = false; P.body.remove(bag.group);
    c.noRing.parent && c.noRing.parent.remove(c.noRing);
  }
  ticks.delete(xr); setXray(false);
  items = []; hint = null;
  busy = true;
  sfx.fanfare(); girl.say('laugh', 2.5); papa.say('joy', 2.5); waveArm(papa, 'R', true); jump(girl, 2, 0.12);
  confetti.burst(L(0, 1.5, 0.3), 100, 2.8, 1);
  await wait(2.4);
  waveArm(papa, 'R', false);
  busy = false;
}

// =====================================================================
// 場面3：離陸・ジュース・着陸、そして自由に飛ぶ
// =====================================================================
const cups = [];
async function scene3() {
  setMusic(2);
  await fade(true, 0.5);
  // 搭乗
  plane.group.position.set(0, 0, 0); plane.group.rotation.set(0, 0, 0);
  pax.forEach((p, i) => { p.sit(); p.root.visible = true; plane.body.add(p.root); p.root.position.copy(plane.seats[i]); p.root.rotation.set(0, Math.PI / 2, 0); p.look = null; });
  plane.body.add(girl.root); girl.sit(); girl.root.position.set(1.03, 0.01, 0); girl.root.rotation.set(0, Math.PI / 2, 0); girl.look = null;
  papa.root.position.set(-0.5, 0, 3.4); papa.root.rotation.set(0, 0.3, 0); papa.baseExpr = 'smile'; papa.face.set('smile');
  aimSun(sunHome, v3(1, 0, 0));
  const cpPos = () => plane.body.localToWorld(v3(3.0, 1.7, 1.55)), cpLook = () => plane.body.localToWorld(v3(1.2, 0.72, 0));
  await shot(cpPos(), cpLook(), 1.9, 1.35, 0);
  await fade(false, 0.6);
  // コックピット：操縦かん
  let tilt = 0, armed = false, launched = false, engineOn = false, propSpeed = 0;
  const knob = () => plane.stick.localToWorld(v3(0, 0.52, 0));
  girl.arms.R.target = knob();
  const cock = (dt) => {
    plane.parts.prop.spin.rotation.x += propSpeed * dt;
    girl.arms.R.target = knob();
    plane.gauges.forEach((g, i) => g.rotation.y = -0.6 + Math.sin(performance.now() / 600 + i) * 0.3 + propSpeed * 0.02);
  };
  ticks.add(cock);
  const stickIt = addItem(plane.stickHit, {
    down: () => { if (!engineOn) { engineOn = true; setEngine(1); propSpeed = 10; sfx.zip(); girl.say('wow', 0.8); } },
    drag: {
      start() {},
      move(p, dx, dy) {
        const tx = THREE.MathUtils.clamp(dy / 120, -1, 1), tz = THREE.MathUtils.clamp(-dx / 120, -1, 1);
        plane.stick.rotation.set(tz * 0.5, 0, tx * 0.5);
        tilt = Math.min(1, Math.hypot(tx, tz));
        propSpeed = 10 + tilt * 30; setEngine(1 + tilt);
        girl.say(tilt > 0.6 ? 'joy' : 'focus', 0.5);
        if (tilt > 0.9) armed = true;
      },
      drop() { tween(0.3, k => plane.stick.rotation.set(plane.stick.rotation.x * (1 - k), 0, plane.stick.rotation.z * (1 - k))); if (armed) launched = true; },
    },
    tap: () => { const r0 = plane.stick.rotation.z; tween(0.5, k => plane.stick.rotation.z = Math.sin(k * Math.PI * 3) * 0.3 * (1 - k)); sfx.pick(); },
  });
  plane.buttons.forEach((b, i) => addItem(b, {
    tap: () => {
      if (i === 1) { sfx.horn(); pax.forEach(p => p.say('joy', 1)); } else sfx.beep(i);
      b.material.emissiveIntensity = 1.5; setTimeout(() => b.material.emissiveIntensity = 0, 400);
      girl.say('joy', 0.8);
    },
  }));
  hint = () => ({ at: knob(), to: knob().add(v3(0, -0.25, 0)), delay: 3 });
  await until(() => launched || (armed && tilt > 0.95 && idle > 0.6));
  hint = null; items = []; busy = true; ticks.delete(cock); girl.arms.R.target = null;
  // 離陸（外から）
  sfx.whoosh(); setEngine(2); propSpeed = 50; girl.say('laugh', 6);
  waveArm(papa, 'R', true); papa.say('joy', 6);
  await shot(v3(-0.8, 1.2, 7.2), v3(1.5, 0.8, 0), 7, 3, 0);
  const lookFollow = () => { cam.look.lerp(worldOf(plane.body).add(v3(0, 0.8, 0)), 0.08); };
  ticks.add(lookFollow);
  pax.forEach(p => p.cheer = 3);
  await tween(5.2, k => {
    const x = 16 * k * k; plane.group.position.x = x;
    const y = x > 5 ? Math.pow(x - 5, 1.5) * 0.26 : 0;
    plane.group.position.y = y; plane.group.rotation.z = x > 5 ? Math.min(0.28, (x - 5) * 0.06) : 0;
    plane.wheels.forEach(w => w.rotation.y += x * 0.05);
  }, ease.lin);
  ticks.delete(lookFollow);
  waveArm(papa, 'R', false);
  await fade(true, 0.6);
  // 空の世界へ
  active = skyS;
  plane.group.position.set(0, 0, 0); plane.group.rotation.set(0, 0, 0); skyS.add(plane.group);
  aimSun(sunSky, v3(0, 0, 0), v3(6, 14, 6));
  // 客室
  plane.nearWall.visible = false; plane.parts.wingR.obj.visible = false; plane.tapes.wingR.visible = false;
  plane.body.add(girl.root); girl.stand(); girl.root.position.set(0.42, 0.127, 0.22); girl.root.rotation.set(0, -0.75, 0); girl.arms.R.target = null;
  const wagon = W.makeWagon(); wagon.position.set(-0.02, 0.127, 0.27); wagon.rotation.y = 0; plane.body.add(wagon);
  pax.forEach(p => { p.root.rotation.y = 0.95; });
  cups.length = 0;
  W.DRINKS.forEach((d, i) => { const c = W.makeCup(d.color); c.key = d.key; c.group.position.set(-0.19 + i * 0.125, 0.127 + 0.5, 0.27 + (i % 2 ? 0.06 : -0.04)); plane.body.add(c.group); c.home = c.group.position.clone(); cups.push(c); });
  const cabCam = v3(-0.55, 1.0, 3.25), cabLook = v3(-0.62, 0.78, -0.2);
  await shot(cabCam, cabLook, 3.5, 1.55, 0);
  setEngine(1.2);
  flight.speed = 22; flight.mode = 0; startFlight();
  await fade(false, 0.8);
  // 吹き出し
  const bubbles = pax.map((p, i) => {
    const d = W.DRINKS.find(x => x.key === DESIRE[i]);
    const s = M.spriteFromCanvas(128, 128, (g) => {
      g.fillStyle = '#fff'; g.strokeStyle = '#9ab'; g.lineWidth = 4;
      g.beginPath(); g.ellipse(64, 56, 54, 46, 0, 0, 7); g.fill(); g.stroke();
      g.beginPath(); g.arc(30, 112, 9, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.arc(16, 124, 4, 0, 7); g.fill();
      const col = '#' + d.color.toString(16).padStart(6, '0');
      g.fillStyle = 'rgba(200,225,240,0.8)'; g.beginPath(); g.moveTo(44, 26); g.lineTo(84, 26); g.lineTo(78, 88); g.lineTo(50, 88); g.closePath(); g.fill();
      g.fillStyle = col; g.beginPath(); g.moveTo(46, 40); g.lineTo(82, 40); g.lineTo(78, 86); g.lineTo(50, 86); g.closePath(); g.fill();
      g.strokeStyle = '#ff4f7a'; g.lineWidth = 5; g.beginPath(); g.moveTo(68, 44); g.lineTo(80, 10); g.stroke();
      if (d.key === 'milk') { g.strokeStyle = '#bbb'; g.lineWidth = 2; g.beginPath(); g.moveTo(46, 40); g.lineTo(82, 40); g.lineTo(78, 86); g.lineTo(50, 86); g.closePath(); g.stroke(); }
    }, 0.26);
    s.material.depthTest = false; s.renderOrder = 20;
    s.position.copy(plane.seats[i]).add(v3(0.2, 0.62, 0.32)); plane.body.add(s);
    return s;
  });
  const served = [false, false, false];
  let stage = 0;
  async function serve(cup, i) {
    busy = true;
    const P = pax[i], ok = cup.key === DESIRE[i];
    const hold = P.body.worldToLocal(worldOf(P.body).add(v3(0, 0, 0)));
    P.body.attach(cup.group);
    await arc(cup.group, v3(0, 0.27, 0.2), 0.4, 0.1, new THREE.Euler(0, 0, 0));
    bubbles[i].visible = false; served[i] = true;
    if (!ok) { P.say('oops', 1.2); sfx.oops(); await wait(1.2); }
    P.say('joy', 2); sfx.slurp(); sparkle(worldOf(P.head), 8, 0.12, 0.3); P.cheer = 1.2;
    const l0 = cup.liquid.scale.y;
    tween(1.2, k => { cup.liquid.scale.y = Math.max(0.15, 1 - k * 0.7); cup.liquid.position.y = 0.05 * cup.liquid.scale.y; });
    girl.say('joy', 1.5);
    await wait(1.2);
    stage++;
    if (stage < 3) { flight.setMode(stage); sfx.whoosh(); }
    busy = false;
  }
  cups.forEach(cup => {
    draggable(cup.group, {
      on: () => !cup.used,
      start: () => { girl.say('focus', 0.6); },
      move: (p) => { girl.look = p; girl.arms.L.target = p; },
      tap: () => { // タップなら次に待っている乗客へ
        const i = served.findIndex(s => !s); if (i < 0) return;
        cup.used = true; removeCup(cup); serve(cup, i);
      },
      drop: () => {
        girl.look = null; girl.arms.L.target = null;
        const here = worldOf(cup.group);
        let best = -1, bd = 1e9;
        pax.forEach((p, i) => { if (served[i]) return; const d = screenDist(here, worldOf(p.body).add(v3(0, 0.25, 0))); if (d < bd) { bd = d; best = i; } });
        if (best >= 0 && bd < nearPx() * 1.5) { cup.used = true; removeCup(cup); serve(cup, best); }
        else { sfx.boing(); arc(cup.group, cup.home, 0.4, 0.1); }
      },
    });
  });
  function removeCup(cup) { items = items.filter(it => it.obj !== cup.group); }
  pax.forEach((p, i) => addItem(p.root, { tap: () => { p.say('joy', 1); sfx.squeak(); } }));
  addItem(girl.root, { tap: () => { girl.say('laugh', 1); sfx.squeak(); } });
  hint = () => {
    const i = served.findIndex(s => !s); if (i < 0) return null;
    const cup = cups.find(c => !c.used && c.key === DESIRE[i]) || cups.find(c => !c.used);
    return cup ? { at: cup.group, to: worldOf(pax[i].body).add(v3(0, 0.25, 0)) } : null;
  };
  await until(() => stage >= 3);
  hint = null; items = []; busy = true;
  await wait(0.6);
  // 着陸
  await fade(true, 0.5);
  bubbles.forEach(b => b.parent && b.parent.remove(b));
  plane.body.remove(wagon); cups.forEach(c => c.group.parent && c.group.parent.remove(c.group));
  pax.forEach(p => { p.root.rotation.y = Math.PI / 2; });
  plane.nearWall.visible = true; plane.parts.wingR.obj.visible = true; plane.tapes.wingR.visible = true;
  girl.sit(); girl.root.position.set(1.03, 0.01, 0); girl.root.rotation.set(0, Math.PI / 2, 0);
  girl.look = null;
  flight.setMode(3);
  const isl = flight.landing;
  isl.position.set(0, flight.seaY, 0); skyS.add(isl);
  plane.group.position.set(-70, 0, -3.5); plane.group.rotation.set(0, 0, 0);
  flight.speed = 0;
  const chase = () => { cam.look.copy(plane.group.position).add(v3(1, 0.8, 0)); cam.pos.copy(plane.group.position).add(v3(-3.5, 2.2, 8.5)); };
  ticks.add(chase); chase();
  await fade(false, 0.5);
  setEngine(1.4);
  const groundY = flight.seaY + 0.33;
  await tween(6.5, k => {
    plane.group.position.x = -70 + 72 * ease.out(k);
    const kk = Math.min(1, k / 0.75);
    plane.group.position.y = groundY * ease.io(kk) + (1 - kk) * 0;
    plane.group.rotation.z = -Math.sin(kk * Math.PI) * 0.1;
    if (k > 0.75) plane.wheels.forEach(w => w.rotation.y += 0.2 * (1 - k));
  }, ease.lin);
  ticks.delete(chase);
  setEngine(0.5); sfx.thump();
  propSlow = true;
  sfx.fanfare(); sfx.cheer(); pax.forEach(p => { p.cheer = 3; p.say('joy', 3); }); girl.say('laugh', 3);
  confetti.burst(worldOf(plane.body).add(v3(0, 2, 0)), 160, 4, 1.6);
  await shot(plane.group.position.clone().add(v3(-2, 2.4, 9)), plane.group.position.clone().add(v3(0.5, 0.6, 0)), 7, 3, 2.5);
  busy = false;
}
let propSlow = false;

// ---------- 空の世界：雲・海・島 ----------
const flight = {
  speed: 0, mode: 0, seaY: -12, clouds: [], islands: [], balloons: [], dolphins: [],
  landing: W.island(1.2, true),
  setMode(m) { flight.mode = m; },
};
sky.sea.position.y = flight.seaY;
// 雲の海（最初は下が雲で見えない）
const cloudSea = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 300; i++) { const x = Math.random() * 256, y = Math.random() * 256, r = 10 + Math.random() * 30; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(200,215,235,0.35)'); gr.addColorStop(1, 'rgba(200,215,235,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 40); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ map: t, color: 0xffffff, emissive: 0xdde6f2, emissiveIntensity: 0.5, roughness: 1, transparent: true, opacity: 1, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = -5; skyS.add(m); return m;
})();
function startFlight() {
  if (flight.clouds.length) return;
  for (let i = 0; i < 46; i++) { const c = W.cloud(2 + Math.random() * 3); skyS.add(c); flight.clouds.push(c); placeCloud(c, true); }
  for (let i = 0; i < 4; i++) { const s = W.island(0.6 + Math.random() * 0.8); s.visible = false; skyS.add(s); flight.islands.push(s); }
}
function cloudBand() { return flight.mode === 0 ? [-10, 6] : [16, 45]; }
function placeCloud(c, initial) {
  const [a, b] = cloudBand();
  c.userData.ty = a + Math.random() * (b - a);
  let z; do { z = (Math.random() - 0.5) * 160; } while (Math.abs(z) < 4);
  if (flight.mode === 0 && Math.random() < 0.5) { z = -6 - Math.random() * 25; c.userData.ty = -2.5 + Math.random() * 4; }
  c.position.set(initial ? -120 + Math.random() * 300 : 180 + Math.random() * 40, c.userData.ty, z);
}
function updateFlight(dt, t) {
  if (active !== skyS) return;
  const v = flight.speed;
  sky.seaT.offset.x += v * dt / (3000 / 80);
  cloudSea.material.map.offset.x += v * dt / (3000 / 40);
  const csT = flight.mode === 0 ? 1 : 0; cloudSea.material.opacity += (csT - cloudSea.material.opacity) * Math.min(1, dt * 0.8); cloudSea.visible = cloudSea.material.opacity > 0.01;
  const [a, b] = cloudBand();
  for (const c of flight.clouds) {
    c.position.x -= v * dt * (1 + c.position.z * 0.0);
    if (c.userData.ty < a || c.userData.ty > b) c.userData.ty = a + Math.random() * (b - a);
    c.position.y += (c.userData.ty - c.position.y) * Math.min(1, dt * 0.5);
    if (c.position.x < -140) placeCloud(c, false);
  }
  // 島（ステージ2以降）
  flight.islands.forEach((s, i) => {
    if (flight.mode >= 2 || flight.mode === 1 && i < 1) {
      if (!s.visible) { s.visible = true; s.position.set(80 + i * 90, flight.seaY, -(i === 0 ? 45 : 70 + Math.random() * 120)); }
      s.position.x -= v * dt;
      if (s.position.x < -200) s.position.set(220 + Math.random() * 100, flight.seaY, -(50 + Math.random() * 150) * (Math.random() < 0.3 ? -1 : 1));
    }
  });
  // 飛行中のゆれ
  if (v > 0 && !freeFly) { plane.body.position.y = Math.sin(t * 1.4) * 0.03; plane.body.rotation.x = Math.sin(t * 0.9) * 0.012; }
  plane.parts.prop.spin.rotation.x += dt * (propSlow ? 6 : 45);
}

// ---------- 自由に飛ぶ ----------
let freeFly = false;
async function freePlay() {
  setMusic(2);
  const again = document.getElementById('again');
  again.style.display = 'block';
  // 島から：タップで再離陸
  let flying = false;
  hint = () => !flying ? { at: worldOf(plane.body).add(v3(0, 0.7, 0)), delay: 3 } : { at: v3(0, 0, 0), wiggle: true, delay: 5, at2: null };
  const takeOff = async () => {
    if (flying || busy) return; busy = true;
    propSlow = false; setEngine(2); sfx.whoosh(); girl.say('laugh', 3);
    const p0 = plane.group.position.clone();
    const chase = () => { cam.look.copy(plane.group.position).add(v3(2.5, 0.4, 0)); cam.pos.copy(plane.group.position).add(v3(-3, 2.2, 8.5)); };
    await shot(p0.clone().add(v3(-3, 2.2, 8.5)), p0.clone().add(v3(2.5, 0.4, 0)), 6.5, 3.2, 0.8);
    ticks.add(chase);
    await tween(3, k => { plane.group.position.x = p0.x + 30 * k * k; plane.group.position.y = p0.y + Math.max(0, k - 0.35) * 18; plane.group.rotation.z = k > 0.35 && k < 0.9 ? 0.2 : 0; }, ease.lin);
    ticks.delete(chase);
    // 世界を流す方式に戻す
    const dx = plane.group.position.x;
    flight.landing.position.x -= dx; flight.clouds.forEach(c => c.position.x -= dx); flight.islands.forEach(s => s.position.x -= dx);
    plane.group.position.x = 0;
    flight.mode = 2; flight.speed = 18; flying = true; freeFly = true; busy = false;
    hint = () => ({ at: worldOf(plane.body).add(v3(0, 0.5, 0)), wiggle: true, delay: 6 });
  };
  addItem(plane.body, { tap: () => { if (!flying) takeOff(); else loop(); } });
  bgTap = () => { if (!flying) takeOff(); };
  let alt = plane.group.position.y, targetAlt = alt;
  bgDrag = (dx, dy) => { if (!flying) return; targetAlt = THREE.MathUtils.clamp(targetAlt - dy * 0.035, flight.seaY + 2.5, 9); };
  let looping = false;
  async function loop() {
    if (looping) return; looping = true; sfx.zip(); girl.say('laugh', 2); pax.forEach(p => p.cheer = 1.5);
    const y0 = plane.group.position.y;
    await tween(1.6, k => { const a = k * Math.PI * 2; plane.group.rotation.z = a; plane.group.position.y = y0 + Math.sin(a - Math.PI / 2) * 2.5 + 2.5; }, ease.io);
    plane.group.rotation.z = 0; looping = false;
  }
  // 風船・イルカ
  const bColors = [0xff4f7a, 0xffd23f, 0x2f7de1, 0x5fd06b, 0xff9a1a, 0xb070ff];
  let bt = 2, dtm = 4;
  const fly = (dt, t) => {
    if (!flying) return;
    const P = plane.group;
    if (!looping) {
      alt = P.position.y; const d = targetAlt - alt;
      P.position.y += d * Math.min(1, dt * 2.5);
      P.rotation.z += (THREE.MathUtils.clamp(d * 0.12, -0.35, 0.35) - P.rotation.z) * Math.min(1, dt * 4);
    } else targetAlt = P.position.y;
    P.rotation.x = Math.sin(t * 0.8) * 0.05;
    cam.look.lerp(P.position.clone().add(v3(3, 0.2, 0)), Math.min(1, dt * 3));
    cam.pos.lerp(P.position.clone().multiply(v3(1, 0.6, 1)).add(v3(-3.2, 2.4, 9.5)), Math.min(1, dt * 2));
    cam.w = 9; cam.h = 5;
    aimSun(sunSky, P.position, v3(6, 14, 6));
    girl.look = camera.position;
    flight.landing.position.x -= flight.speed * dt;
    if (flight.landing.position.x < -200) flight.landing.position.x = 400;
    // 風船
    bt -= dt;
    if (bt < 0) {
      bt = 1.6 + Math.random() * 1.6;
      const b = W.makeBalloon(bColors[Math.floor(Math.random() * bColors.length)]);
      b.position.set(70, THREE.MathUtils.clamp(alt + (Math.random() - 0.5) * 12, flight.seaY + 3, 9), (Math.random() - 0.5) * 1.5); skyS.add(b); flight.balloons.push(b);
    }
    for (const b of flight.balloons.slice()) {
      b.position.x -= flight.speed * dt; b.position.y += Math.sin(t * 2 + b.id) * 0.004;
      const near = Math.abs(b.position.x - P.position.x) < 1.6 && Math.abs(b.position.y - (P.position.y + 0.8)) < 1.4;
      if (near || b.position.x < -40) {
        if (near) { sfx.balloon(); confetti.burst(b.position.clone(), 40, 3, 1.4); girl.say('joy', 1.2); pax[Math.floor(Math.random() * 3)].cheer = 1; }
        skyS.remove(b); flight.balloons.splice(flight.balloons.indexOf(b), 1);
      }
    }
    // イルカ
    dtm -= dt;
    if (dtm < 0) {
      dtm = 3 + Math.random() * 4;
      const d = W.makeDolphin(); d.userData = { t: 0, x: 60, z: -6 - Math.random() * 10 }; skyS.add(d); flight.dolphins.push(d);
      addItem(d, { tap: () => { sfx.splash(); d.userData.t = 0; d.userData.big = 1.6; girl.say('wow', 1); confetti.burst(d.position.clone(), 30, 3, 1.6); } });
    }
    for (const d of flight.dolphins.slice()) {
      const u = d.userData; u.t += dt; u.x -= flight.speed * dt * 0.8;
      const jump = (u.t % 2.4) / 2.4, h = (u.big || 1) * 5;
      d.position.set(u.x, flight.seaY - 1 + Math.sin(jump * Math.PI) * h, u.z);
      d.rotation.z = Math.cos(jump * Math.PI) * 0.9;
      if (jump < 0.02 && u.t > 0.5) { u.big = 1; }
      if (u.x < -60) { skyS.remove(d); flight.dolphins.splice(flight.dolphins.indexOf(d), 1); items = items.filter(i => i.obj !== d); }
    }
  };
  ticks.add(fly);
  // もういちど（長押し）
  let holdT = null; const ring = document.getElementById('againRing');
  again.addEventListener('pointerdown', e => { e.preventDefault(); const t0 = performance.now(); holdT = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / 1000); ring.style.strokeDashoffset = 170 * (1 - k); if (k >= 1) { clearInterval(holdT); location.reload(); } }, 30); });
  const cancel = () => { clearInterval(holdT); ring.style.strokeDashoffset = 170; };
  again.addEventListener('pointerup', cancel); again.addEventListener('pointerleave', cancel); again.addEventListener('pointercancel', cancel);
}

// ---------- メインループ ----------
const clock = new THREE.Clock();
let time = 0;
function frame() {
  const dt = Math.min(0.05, clock.getDelta()) * TS; time += dt; idle += dt;
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i]; tw.t += dt; const k = Math.min(1, tw.t / tw.dur);
    tw.fn(tw.e(k));
    if (k >= 1) { tweens.splice(i, 1); tw.res(); }
  }
  for (const f of [...ticks]) f(dt, time);
  for (const p of people) p.update(dt, time);
  if (stars.visible) stars.update(time);
  updateFlight(dt, time);
  confetti.update(dt);
  applyCamera(time);
  updateHint(dt);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.render(active, camera);
  requestAnimationFrame(frame);
}

async function run() {
  const skip = params.get('scene');
  // 開始前の画面：女の子が手を振る
  if (!skip) {
    const started = new Promise(res => document.getElementById('go').addEventListener('click', res, { once: true }));
    girl.root.position.copy(G0); girl.root.rotation.y = -0.35; home.add(girl.root); waveArm(girl, 'L', true);
    await shot(v3(2.4, 1.6, 6.2), v3(1.6, 0.6, 1.0), 4.8, 2.4, 0);
    fade(false, 0.8);
    await started;
    unlockAudio(); sfx.pop();
    document.getElementById('start').remove();
    waveArm(girl, 'L', false);
    await fade(true, 0.4);
  } else document.getElementById('start').remove();
  const s = skip ? +skip : 0;
  if (s > 0) { // デバッグ用：途中から
    home.add(girl.root); girl.root.position.copy(G0); girl.head.add(girl.hat); girl.hat.position.copy(girl.hatSeat); girl.hat.rotation.copy(girl.hatRot); girl.wearJacket(); girl.body.add(girl.jacket); girl.jacket.position.y = girl.torso.position.y - 0.13;
    if (s > 1) for (const k in plane.parts) { const P = plane.parts[k]; P.obj.position.copy(P.home.pos); P.obj.rotation.copy(P.home.rot); plane.tapes[k].visible = true; }
  }
  if (s > 0) fade(false, 0.3);
  if (s <= 0) await scene0();
  if (s <= 1) await scene1();
  if (s <= 2) await scene2();
  if (s <= 3) await scene3();
  await freePlay();
}
window.__dbg = { cups, scr: o => toScreen(o.isVector3 ? o : worldOf(o)), v3, girl, papa, pax, plane, sec, cam, flight, THREE, get items() { return items; }, set busy(b) { busy = b; } };
frame();
run();
