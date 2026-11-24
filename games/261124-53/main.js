import * as THREE from './lib/three.module.min.js';
import { RoomEnvironment } from './lib/RoomEnvironment.js';
import * as M from './models.js';
import { unlockAudio, sfx, playBgm } from './audio.js';

const { V, mesh, std, lerp, clamp } = M;
const Q = new URLSearchParams(location.search);
const DTCAP = +(Q.get('dtcap') || 0.05); // テスト用（遅いPCでも時間どおり進める）

// ---------- レンダラー ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfe8ef);
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex; scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 120);
const camLook = new THREE.Vector3();

// 女の子（画面左下の「わたし」）は別シーンで重ねて描く
const gScene = new THREE.Scene(); gScene.environment = envTex; gScene.environmentIntensity = 0.6;
const gCam = new THREE.PerspectiveCamera(26, 0.8, 0.1, 20);

const hemi = new THREE.HemisphereLight(0xfff6e8, 0x8a7a66, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
sun.shadow.radius = 4;
scene.add(sun); scene.add(sun.target);
function setSun(pos, target, size) {
  sun.position.copy(pos); sun.target.position.copy(target);
  const c = sun.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = 0.5; c.far = 40; c.updateProjectionMatrix();
}
gScene.add(new THREE.HemisphereLight(0xfff6e8, 0x8a7a66, 1.2));
const gSun = new THREE.DirectionalLight(0xfff1dc, 2.2); gSun.position.set(2, 3, 4); gScene.add(gSun);

// ---------- 小さな道具 ----------
const tweens = [];
const ease = { io: (k) => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, out: (k) => 1 - Math.pow(1 - k, 3), lin: (k) => k, back: (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); } };
function tween(dur, fn, e = ease.io) { return new Promise((res) => tweens.push({ t: 0, dur: Math.max(0.0001, dur), fn, e, res })); }
const wait = (s) => tween(s, () => { });
const perFrame = new Set();

function turnTo(a, ang, dur = 0.35) {
  const r = a.root.rotation; let d = ang - r.y;
  while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
  const s = r.y; return tween(dur, (k) => { r.y = s + d * k; });
}
async function walkTo(a, x, z, speed = 1.4, faceEnd = null) {
  const p = a.root.position; const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
  if (d > 0.05) {
    await turnTo(a, Math.atan2(dx, dz), 0.3);
    a.walking = true; const sx = p.x, sz = p.z;
    let stepT = 0;
    await tween(d / speed, (k) => { p.x = sx + dx * k; p.z = sz + dz * k; }, ease.lin);
    a.walking = false;
  }
  if (faceEnd !== null) await turnTo(a, faceEnd, 0.3);
}
function camYaw(a) { const p = a.root.position; return Math.atan2(camera.position.x - p.x, camera.position.z - p.z); }

// ---------- パーティクル（きらきら・ぽふん） ----------
const starTex = M.canvasTex(64, 64, (g) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,240,180,0.9)'); gr.addColorStop(1, 'rgba(255,220,120,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'white'; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 6 : 30; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.fill();
});
const puffTex = M.canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
const parts = [];
function particle(tex, pos, vel, life, size, color = 0xffffff, additive = true, grow = 0) {
  const m = new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  const s = new THREE.Sprite(m); s.position.copy(pos); s.scale.setScalar(size); scene.add(s);
  parts.push({ s, vel, life, max: life, size, grow });
}
function sparkle(pos, n = 14, spread = 0.6, color = 0xffe9a0) {
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.5).multiplyScalar(spread * 3);
    particle(starTex, pos, v, 0.6 + Math.random() * 0.5, 0.08 + Math.random() * 0.12 * spread * 2, color);
  }
}
function puff(pos, size = 1) {
  for (let i = 0; i < 16; i++) {
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).multiplyScalar(2.2 * size);
    particle(puffTex, pos.clone().add(new THREE.Vector3(0, 0.3 * size, 0)), v, 0.9, 0.5 * size, 0xffffff, false, 1.5 * size);
  }
  sparkle(pos.clone().add(new THREE.Vector3(0, 0.5 * size, 0)), 20, size);
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt;
    p.s.position.addScaledVector(p.vel, dt); p.vel.multiplyScalar(0.95); p.vel.y -= p.grow ? 0 : dt * 0.6;
    p.s.material.opacity = Math.max(0, p.life / p.max);
    p.s.scale.setScalar(p.size + (p.max - p.life) * p.grow);
    if (p.life <= 0) { scene.remove(p.s); p.s.material.dispose(); parts.splice(i, 1); }
  }
}

// ---------- 画面のふた（暗転・白フェード）と手 ----------
const veil = document.getElementById('veil');
function veilTo(op, color = '#fff', dur = 0.5) { veil.style.background = color; veil.style.transition = `opacity ${dur}s`; veil.style.opacity = op; return wait(dur); }
const handEl = document.getElementById('hand'), hintEl = document.getElementById('hint');
function showHand(x, y) {
  handEl.style.left = x + 'px'; handEl.style.top = y + 'px';
  handEl.classList.remove('go'); void handEl.offsetWidth; handEl.classList.add('go');
}
const tmpV = new THREE.Vector3();
function toScreen(obj, offY = 0) {
  if (obj.isVector3) tmpV.copy(obj); else { obj.updateMatrixWorld(); new THREE.Box3().setFromObject(obj).getCenter(tmpV); }
  tmpV.y += offY; tmpV.project(camera);
  return { x: (tmpV.x * 0.5 + 0.5) * innerWidth, y: (-tmpV.y * 0.5 + 0.5) * innerHeight, ok: tmpV.z < 1 };
}

// ---------- タップできる物 ----------
const tappables = [];
function onTap(obj, fn) { obj.userData.onTap = fn; tappables.push(obj); return obj; }
function shown(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }
function proxy(parent, r, pos, sy = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
  if (pos) m.position.copy(pos); m.scale.y = sy; parent.add(m); return m;
}

// ================================================================
//  家（リビング＋キッチン）
// ================================================================
const house = new THREE.Group(); scene.add(house);
const garden = new THREE.Group(); scene.add(garden);
const H = {}; // 家の部品
const G = {}; // 庭の部品

function rbox(w, h, d, r, mat, parent, pos) {
  const s = new THREE.Shape(); const x = -w / 2 + r, y = -h / 2 + r, ww = w - 2 * r, hh = h - 2 * r;
  s.moveTo(x, y - r + r); s.absarc(x + ww, y, r, -Math.PI / 2, 0); s.absarc(x + ww, y + hh, r, 0, Math.PI / 2); s.absarc(x, y + hh, r, Math.PI / 2, Math.PI); s.absarc(x, y, r, Math.PI, Math.PI * 1.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.9, bevelSegments: 4, curveSegments: 6 });
  g.translate(0, 0, -(d - 2 * r) / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.8, uv.getY(i) * 0.8);
  return mesh(g, mat, parent, pos);
}
function tiled(tex, rx, ry) { const t = tex.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.needsUpdate = true; t.colorSpace = THREE.SRGBColorSpace; return t; }

function buildHouse() {
  const T = M.TX;
  const floorM = new THREE.MeshStandardMaterial({ map: tiled(T.floor, 3, 3), roughness: 0.55 });
  const floor = mesh(new THREE.PlaneGeometry(9.4, 7.5), floorM, house, V(0.1, 0, -0.25), { x: -Math.PI / 2 }); floor.castShadow = false;
  const wallM = new THREE.MeshStandardMaterial({ map: tiled(T.wall, 3, 1.2), color: 0xfff3e2, roughness: 0.95 });
  const back = mesh(new THREE.PlaneGeometry(9.4, 3.0), wallM, house, V(0.1, 1.5, -3)); back.castShadow = false;
  const left = mesh(new THREE.PlaneGeometry(7.5, 3.0), wallM, house, V(-4.6, 1.5, -0.25), { y: Math.PI / 2 }); left.castShadow = false;
  const right = mesh(new THREE.PlaneGeometry(7.5, 3.0), wallM, house, V(4.8, 1.5, -0.25), { y: -Math.PI / 2 }); right.castShadow = false;
  const ceil = mesh(new THREE.PlaneGeometry(9.4, 7.5), std('#fbf8f2', 1, { emissive: 0x9a968e }), house, V(0.1, 3.0, -0.25), { x: Math.PI / 2 });
  const skirt = std('#f3ece0', 0.6);
  mesh(new THREE.BoxGeometry(9.4, 0.1, 0.02), skirt, house, V(0.1, 0.05, -2.99));
  mesh(new THREE.BoxGeometry(0.02, 0.1, 7.5), skirt, house, V(-4.59, 0.05, -0.25));
  // 窓（庭の写真）
  const win = mesh(new THREE.PlaneGeometry(1.9, 1.09), new THREE.MeshBasicMaterial({ map: T.window }), house, V(-2.2, 1.6, -2.985)); win.castShadow = false;
  const frameM = std('#fafafa', 0.4);
  mesh(new THREE.BoxGeometry(2.05, 0.08, 0.12), frameM, house, V(-2.2, 1.02, -2.94));
  mesh(new THREE.BoxGeometry(2.05, 0.06, 0.08), frameM, house, V(-2.2, 2.17, -2.96));
  // カーテン
  const curtM = new THREE.MeshStandardMaterial({ map: M.furTex(), color: 0xf3dcc0, roughness: 0.95, side: THREE.DoubleSide });
  const rod = mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.4, 8), std('#7a5a3a', 0.4), house, V(-2.2, 2.4, -2.9), { z: Math.PI / 2 });
  H.curtL = makeCurtain(curtM, 0.85, V(-3.35, 0, -2.88));
  H.curtR = makeCurtain(curtM, 1.15, V(-0.85, 0, -2.88));
  // ソファ
  const sofaM = new THREE.MeshStandardMaterial({ map: tiled(T.fabric, 1.5, 1.5), color: 0xb7c7a8, roughness: 1 });
  const sofa = new THREE.Group(); sofa.position.set(-2.2, 0, -1.75); house.add(sofa); H.sofa = sofa;
  rbox(2.1, 0.32, 0.95, 0.06, sofaM, sofa, V(0, 0.26, 0));
  rbox(2.1, 0.55, 0.26, 0.1, sofaM, sofa, V(0, 0.62, -0.38));
  for (const s of [-1, 1]) rbox(0.24, 0.32, 0.95, 0.09, sofaM, sofa, V(s * 1.0, 0.5, 0));
  for (const s of [-1, 1]) rbox(0.9, 0.14, 0.7, 0.06, sofaM, sofa, V(s * 0.45, 0.47, 0.08));
  for (const s of [-1, 1]) for (const z of [-0.4, 0.4]) mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.12, 8), std('#5a3c25', 0.4), sofa, V(s * 0.95, 0.06, z));
  const cush = new THREE.Group(); cush.position.set(0.62, 0.68, -0.18); cush.rotation.set(-0.3, -0.25, 0.1); sofa.add(cush); H.cushion = cush;
  rbox(0.42, 0.38, 0.13, 0.06, std('#e9a35a', 0.95, { map: tiled(T.fabric, 1, 1) }), cush);
  // ラグ・ローテーブル
  const rugT = M.canvasTex(256, 256, (g) => { g.fillStyle = '#d9c8ad'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#b48a64'; g.lineWidth = 10; g.strokeRect(16, 16, 224, 224); g.strokeStyle = '#7f9a8a'; g.lineWidth = 6; g.strokeRect(34, 34, 188, 188); for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); } });
  const rug = mesh(new THREE.PlaneGeometry(3.4, 2.4), std('#ffffff', 1, { map: rugT }), house, V(-1.2, 0.006, -0.3), { x: -Math.PI / 2 }); rug.castShadow = false;
  const woodM = M.woodMat('#d9b48a', 0.45);
  const table = new THREE.Group(); table.position.set(-2.2, 0, -0.45); house.add(table);
  mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 32), woodM, table, V(0, 0.4, 0));
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.4, 8), woodM, table, V(Math.cos(a) * 0.3, 0.2, Math.sin(a) * 0.3)); }
  const cup = mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.09, 16), std('#f4f4f0', 0.3), table, V(0.15, 0.47, 0.05));
  // 観葉植物（はずれの隠れ場所）
  const plant = new THREE.Group(); plant.position.set(-4.0, 0, -2.4); house.add(plant); H.plant = plant;
  mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.42, 20), std('#c46a44', 0.8), plant, V(0, 0.21, 0));
  const leafM = std('#3f7a3a', 0.6, { side: THREE.DoubleSide });
  H.leaves = [];
  for (let i = 0; i < 11; i++) {
    const l = new THREE.Group(); l.position.y = 0.4; l.rotation.set(0.35 + Math.random() * 0.5, i * 2.4, 0); plant.add(l);
    mesh(M.ell(0.12, 0.42, 0.02, 12), leafM, l, V(0, 0.4, 0)); H.leaves.push(l);
  }
  // フロアランプ
  const lamp = new THREE.Group(); lamp.position.set(-3.75, 0, -1.0); house.add(lamp); H.lamp = lamp;
  mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.03, 20), std('#333', 0.4), lamp, V(0, 0.015, 0));
  mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.5, 8), std('#333', 0.4), lamp, V(0, 0.75, 0));
  const shadeM = new THREE.MeshStandardMaterial({ color: 0xfff4dc, roughness: 0.9, emissive: 0xffd590, emissiveIntensity: 0, side: THREE.DoubleSide });
  mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.32, 24, 1, true), shadeM, lamp, V(0, 1.55, 0));
  const lampLight = new THREE.PointLight(0xffc880, 0, 4); lampLight.position.set(0, 1.5, 0); lamp.add(lampLight);
  H.lampOn = false; H.shadeM = shadeM; H.lampLight = lampLight;
  // 絵（文字なし）
  const pic = (x, y, w, h, draw) => {
    const t = M.canvasTex(256, Math.round(256 * h / w), draw);
    mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.04), std('#6b4a2e', 0.5), house, V(x, y, -2.98));
    mesh(new THREE.PlaneGeometry(w, h), std('#ffffff', 0.8, { map: t }), house, V(x, y, -2.955));
  };
  pic(-0.1, 2.05, 0.6, 0.45, (g, w, h) => { g.fillStyle = '#bfe3f2'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(190, 50, 26, 0, 7); g.fill(); g.fillStyle = '#7fb06a'; g.beginPath(); g.ellipse(80, h, 160, 90, 0, 0, 7); g.fill(); g.fillStyle = '#5b9a58'; g.beginPath(); g.ellipse(220, h, 120, 60, 0, 0, 7); g.fill(); });
  pic(4.795 - 9.9, 0, 0.01, 0.01, () => { }); // （ダミー）
  // 棚（木のおもちゃが乗る）
  const shelf = new THREE.Group(); shelf.position.set(0.7, 1.25, -2.84); house.add(shelf); H.shelf = shelf;
  mesh(new THREE.BoxGeometry(1.7, 0.05, 0.32), woodM, shelf);
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.04, 0.2, 0.25), woodM, shelf, V(s * 0.6, -0.12, -0.02));
  // 下のチェスト
  const chest = new THREE.Group(); chest.position.set(0.7, 0, -2.7); house.add(chest);
  rbox(1.5, 0.62, 0.55, 0.03, M.woodMat('#e8cfa8', 0.5), chest, V(0, 0.31, 0));
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.035, 12, 8), std('#8a6a44', 0.3), chest, V(s * 0.35, 0.42, 0.29));
  // 帽子かけ
  const hooks = new THREE.Group(); hooks.position.set(2.05, 1.45, -2.95); house.add(hooks); H.hooks = hooks;
  mesh(new THREE.BoxGeometry(1.15, 0.12, 0.03), woodM, hooks);
  // キッチン
  const cabM = std('#f2efe8', 0.45), topM = std('#d8d2c8', 0.25), handleM = std('#b9b9b9', 0.25, { metalness: 0.8 });
  const kb = new THREE.Group(); kb.position.set(3.65, 0, -2.68); house.add(kb);
  mesh(new THREE.BoxGeometry(2.2, 0.88, 0.6), cabM, kb, V(0, 0.44, 0));
  mesh(new THREE.BoxGeometry(2.25, 0.04, 0.64), topM, kb, V(0, 0.9, 0));
  for (let i = 0; i < 4; i++) { mesh(new THREE.BoxGeometry(0.5, 0.02, 0.01), std('#e2ddd3', 0.5), kb, V(-0.82 + i * 0.55, 0.62, 0.305)); mesh(new THREE.BoxGeometry(0.16, 0.02, 0.03), handleM, kb, V(-0.82 + i * 0.55, 0.75, 0.32)); }
  mesh(new THREE.BoxGeometry(2.2, 0.7, 0.35), cabM, kb, V(0, 2.0, -0.12));
  const kettle = mesh(new THREE.SphereGeometry(0.12, 20, 14), std('#d0453d', 0.3), kb, V(-0.5, 1.02, 0), null, V(1, 0.85, 1));
  for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(0.07, 16, 12), std(['#e8c23a', '#d64a3a', '#7cb342'][i], 0.4), kb, V(0.3 + i * 0.13, 0.98, 0.05));
  // 冷蔵庫
  const fridge = new THREE.Group(); fridge.position.set(4.25, 0, -1.6); fridge.rotation.y = -Math.PI / 2; house.add(fridge); H.fridge = fridge;
  rbox(0.78, 1.85, 0.7, 0.04, std('#e8ecef', 0.3, { metalness: 0.3 }), fridge, V(0, 0.93, 0));
  const door = new THREE.Group(); door.position.set(-0.39, 0, 0.36); fridge.add(door); H.fridgeDoor = door;
  mesh(new THREE.BoxGeometry(0.02, 1.0, 0.03), handleM, door, V(0.7, 1.25, 0.03));
  rbox(0.78, 1.15, 0.04, 0.015, std('#eef1f3', 0.3, { metalness: 0.3 }), door, V(0.39, 1.25, 0));
  // アイランド
  const isl = new THREE.Group(); isl.position.set(3.3, 0, -0.95); house.add(isl); H.island = isl;
  mesh(new THREE.BoxGeometry(1.8, 0.9, 0.8), cabM, isl, V(0, 0.45, 0));
  mesh(new THREE.BoxGeometry(1.9, 0.05, 0.9), M.woodMat('#caa47c', 0.35), isl, V(0, 0.925, 0));
  for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(0.52, 0.7, 0.01), std('#ebe7de', 0.5), isl, V(-0.6 + i * 0.6, 0.45, 0.405));
  const bowl = mesh(new THREE.SphereGeometry(0.2, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std('#5d8fb5', 0.3, { side: THREE.DoubleSide }), isl, V(-0.4, 1.15, 0));
  for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(0.07, 14, 10), std(['#f0a030', '#d83a30', '#e8d040'][i], 0.35), isl, V(-0.45 + i * 0.07, 1.02 + (i % 2) * 0.04, (i - 1) * 0.06));
  // 段ボール（はずれの隠れ場所：ボールが出てくる）
  const box = new THREE.Group(); box.position.set(1.4, 0, 0.35); box.rotation.y = 0.3; house.add(box); H.box = box;
  mesh(new THREE.BoxGeometry(0.6, 0.45, 0.5), std('#c79a62', 0.95, { map: M.furTex() }), box, V(0, 0.225, 0));
  const flapM = std('#bf9058', 0.95);
  H.flaps = [];
  for (const s of [-1, 1]) { const f = new THREE.Group(); f.position.set(s * 0.3, 0.45, 0); box.add(f); mesh(new THREE.BoxGeometry(0.3, 0.01, 0.5), flapM, f, V(-s * 0.15, 0, 0)); f.rotation.z = s * 0.5; H.flaps.push(f); }
  const ball = new THREE.Group(); box.add(ball); ball.visible = false; H.ball = ball;
  const ballT = M.canvasTex(128, 64, (g) => { const c = ['#e94b4b', '#f7c948', '#4b8de9', '#5cc46a']; for (let i = 0; i < 4; i++) { g.fillStyle = c[i]; g.fillRect(i * 32, 0, 32, 64); } });
  mesh(new THREE.SphereGeometry(0.15, 24, 16), std('#ffffff', 0.35, { map: ballT }), ball);
}

function makeCurtain(mat, w, pos) {
  const h = 2.38;
  const geo = new THREE.PlaneGeometry(w, h, 40, 30);
  const base = geo.attributes.position.array.slice();
  const m = mesh(geo, mat, house, V(pos.x, pos.y + h / 2, pos.z));
  const c = { m, geo, base, w, h, bulge: 0, open: 0, wig: 0 };
  c.apply = (t = 0) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = base[i * 3], y = base[i * 3 + 1];
      const xs = x * (1 - c.open * 0.6) - c.open * w * 0.3;
      let z = Math.sin((x + w / 2) * 22) * 0.035 * (1 + c.open);
      const by = (y + h / 2), dx = x / (w * 0.44), dy = (by - 0.85) / 0.85;
      const r = dx * dx + dy * dy;
      if (r < 1) z += c.bulge * Math.pow(1 - r, 0.6) * (1 + Math.sin(t * 9) * 0.06 * c.wig);
      p.setXYZ(i, xs, y, z);
    }
    p.needsUpdate = true; geo.computeVertexNormals();
  };
  c.apply();
  return c;
}

// ================================================================
//  庭
// ================================================================
function buildGarden() {
  const T = M.TX;
  const lawn = mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: tiled(T.grass, 24, 24), color: 0xb9d79a, roughness: 1 }), garden, V(0, 0, -10), { x: -Math.PI / 2 });
  lawn.castShadow = false;
  // 奥の景色（写真）
  const bg = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 22, 64, 1, true, Math.PI * 0.62, Math.PI * 0.76), new THREE.MeshBasicMaterial({ map: T.garden, side: THREE.BackSide, fog: false }));
  bg.position.set(0, 7.0, 6); garden.add(bg); G.bg = bg;
  T.garden.wrapS = THREE.ClampToEdgeWrapping;
  // テラスの石だたみ（手前）
  const patioT = M.canvasTex(256, 256, (g) => { g.fillStyle = '#b9afa2'; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const v = 170 + Math.random() * 40 | 0; g.fillStyle = `rgb(${v},${v - 8},${v - 18})`; g.fillRect(x * 64 + 3, y * 64 + 3, 58, 58); } });
  const patio = mesh(new THREE.PlaneGeometry(16, 3), std('#ffffff', 0.9, { map: tiled(patioT, 6, 1.2) }), garden, V(0, 0.005, 5.2), { x: -Math.PI / 2 }); patio.castShadow = false;
  // 植え込み・花
  const bushM = new THREE.MeshStandardMaterial({ map: tiled(T.grass, 2, 2), color: 0x6f9a52, roughness: 1 });
  [[-6.5, -4.5, 1.3], [-5.2, -5.5, 1.0], [6.2, -4.8, 1.4], [7.4, -3, 1.0], [-7.2, -1.5, 1.1]].forEach(([x, z, s]) => {
    for (let i = 0; i < 4; i++) mesh(new THREE.SphereGeometry(0.6 * s, 20, 14), bushM, garden, V(x + (i - 1.5) * 0.5 * s, 0.45 * s + (i % 2) * 0.2, z + (i % 2) * 0.3), null, V(1, 0.85, 1));
  });
  const flowerC = ['#f05a7e', '#ffd23f', '#ffffff', '#b06ef0', '#ff8a3d'];
  for (let i = 0; i < 70; i++) {
    const x = -6 + Math.random() * 12, z = -6.5 + Math.random() * 1.2;
    const f = mesh(new THREE.SphereGeometry(0.06, 8, 6), std(flowerC[i % 5], 0.6), garden, V(x, 0.25 + Math.random() * 0.15, z));
    mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4), std('#3f7a3a'), garden, V(x, 0.12, z));
  }
  // 木の切り株（翼竜のとまり木）
  const stump = new THREE.Group(); stump.position.set(3.9, 0, -0.9); garden.add(stump); G.stump = stump;
  mesh(new THREE.CylinderGeometry(0.38, 0.45, 0.5, 20), std('#7a5a3c', 0.9, { map: M.furTex() }), stump, V(0, 0.25, 0));
  mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.02, 20), M.woodMat('#e2c08c', 0.7), stump, V(0, 0.505, 0));
  // ジオラマのテーブル
  const tb = new THREE.Group(); tb.position.set(-2.9, 0, 2.3); garden.add(tb); G.table = tb;
  const tw = M.woodMat('#c79a6a', 0.5);
  mesh(new THREE.BoxGeometry(1.5, 0.06, 0.95), tw, tb, V(0, 0.72, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(new THREE.BoxGeometry(0.06, 0.72, 0.06), tw, tb, V(sx * 0.68, 0.36, sz * 0.4));
  const dio = new THREE.Group(); dio.position.y = 0.75; tb.add(dio); G.dio = dio;
  mesh(new THREE.BoxGeometry(1.25, 0.06, 0.78), M.woodMat('#e6c79a', 0.5), dio, V(0, 0.03, 0));
  mesh(new THREE.BoxGeometry(1.2, 0.02, 0.73), std('#7fa860', 1, { map: tiled(T.grass, 1, 1) }), dio, V(0, 0.07, 0));
  mesh(new THREE.CircleGeometry(0.16, 24), std('#6fb0d8', 0.15), dio, V(0.38, 0.082, 0.18), { x: -Math.PI / 2 });
  for (let i = 0; i < 5; i++) { // 小さな木と石
    const x = -0.5 + i * 0.25, z = -0.28 + (i % 2) * 0.05;
    mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.12, 6), M.woodMat('#7a5a3c'), dio, V(x, 0.14, z));
    mesh(new THREE.ConeGeometry(0.06, 0.16, 10), std('#4f8a45', 0.8), dio, V(x, 0.26, z));
  }
  for (let i = 0; i < 4; i++) mesh(new THREE.DodecahedronGeometry(0.04 + i * 0.008), std('#9a948a', 0.9), dio, V(-0.45 + i * 0.3, 0.09, 0.3));
  // ピクニックシート
  const matT = M.canvasTex(256, 256, (g) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#d94545' : '#fbf4ea'; g.fillRect(x * 32, y * 32, 32, 32); } g.fillStyle = 'rgba(217,69,69,0.4)'; for (let i = 0; i < 8; i++) { g.fillRect(i * 32, 0, 32, 256); } });
  const mat = mesh(new THREE.PlaneGeometry(2.4, 1.7), std('#ffffff', 0.95, { map: matT }), garden, V(0.7, 0.012, 0.9), { x: -Math.PI / 2, z: 0.05 }); mat.castShadow = false; G.mat = mat;
  // 看板（絵だけでルールを見せる）
  const sign = new THREE.Group(); sign.position.set(2.75, -2, 1.5); sign.rotation.y = -0.35; garden.add(sign); G.sign = sign;
  mesh(new THREE.BoxGeometry(1.12, 0.86, 0.05), M.woodMat('#b0835a', 0.6), sign, V(0, 1.15, 0));
  mesh(new THREE.PlaneGeometry(1.02, 0.765), std('#ffffff', 0.85, { map: M.signTex() }), sign, V(0, 1.15, 0.03));
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.07, 1.2, 0.07), M.woodMat('#9a7048', 0.6), sign, V(s * 0.4, 0.4, -0.03));
  sign.visible = false;
  // ホース（パパがつまずく）
  const pts = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 3.5; pts.push(V(1.9 + Math.cos(a) * (0.12 + i * 0.006) + i * 0.02, 0.03, 2.9 + Math.sin(a) * (0.12 + i * 0.006))); }
  pts.push(V(4.2, 0.03, 3.4), V(6.5, 0.03, 3.0));
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.025, 8), std('#3ba55c', 0.4), garden, null);
  // 大皿
  const plate = new THREE.Group(); plate.position.set(0.7, 0.012, 0.95); garden.add(plate); G.plate = plate; plate.visible = false;
  mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.04, 40), std('#f7f5f0', 0.2), plate, V(0, 0.02, 0));
}

// ================================================================
//  キャラクター
// ================================================================
let girl, dad, lion, zebra, tiger, trike, rex, ptera;
const animals = [];
const toyScale = { lion: 0.19, zebra: 0.2, tiger: 0.18, trike: 0.11, rex: 0.085, ptera: 0.14 };

function setupCharacters() {
  girl = M.makeHuman('girl'); gScene.add(girl.root); girl.root.rotation.y = 0.25;
  dad = M.makeHuman('dad'); garden.add(dad.root); dad.root.visible = false;
  lion = M.makeQuad('lion'); zebra = M.makeQuad('zebra'); tiger = M.makeQuad('tiger');
  trike = M.makeQuad('trike'); rex = M.makeRex(); ptera = M.makePtera();
  [lion, zebra, tiger, trike, rex, ptera].forEach((a) => { scene.add(a.root); a.setMode('wood'); a.alive = false; animals.push(a); a.headTilt = 0; });
  // 棚のおもちゃ
  const sh = H.shelf.position;
  place(lion, sh.x - 0.5, sh.y + 0.025, sh.z, 0.5, toyScale.lion);
  place(zebra, sh.x + 0.02, sh.y + 0.025, sh.z, 0.2, toyScale.zebra);
  place(tiger, sh.x + 0.52, sh.y + 0.025, sh.z, -0.4, toyScale.tiger);
  // ジオラマの恐竜
  const d = new THREE.Vector3(); G.dio.getWorldPosition(d);
  place(trike, d.x - 0.35, d.y + 0.08, d.z + 0.05, 0.6, toyScale.trike);
  place(rex, d.x + 0.05, d.y + 0.08, d.z - 0.05, 0.3, toyScale.rex);
  place(ptera, d.x + 0.4, d.y + 0.08, d.z + 0.12, -0.3, toyScale.ptera);
  [trike, rex, ptera].forEach((a) => a.root.visible = false);
}
function place(a, x, y, z, ry, s) { a.root.position.set(x, y, z); a.root.rotation.set(0, ry, 0); a.root.scale.setScalar(s); }

// ================================================================
//  カメラ
// ================================================================
const SHOTS = {
  hooks: [V(2.0, 1.5, -1.05), V(2.0, 1.25, -2.95)],
  shelf: [V(0.75, 1.55, -0.85), V(0.75, 1.2, -2.9)],
  room: [V(0.0, 2.15, 4.1), V(0.0, 0.85, -1.4)],
  seek: [V(0.3, 2.5, 4.6), V(0.3, 0.8, -1.3)],
  dio: [V(-2.9, 1.55, 3.55), V(-2.9, 0.85, 1.9)],
  garden: [V(0.4, 3.0, 8.6), V(0.6, 0.9, -0.6)],
  picnic: [V(0.6, 2.6, 6.6), V(0.7, 0.9, -0.2)],
};
let camBase = SHOTS.hooks[0].clone();
function shot(name, dur = 1.2) {
  const [p, l] = SHOTS[name]; const p0 = camBase.clone(), l0 = camLook.clone();
  if (dur <= 0) { camBase.copy(p); camLook.copy(l); return Promise.resolve(); }
  return tween(dur, (k) => { camBase.lerpVectors(p0, p, k); camLook.lerpVectors(l0, l, k); });
}
let shake = 0;

// ================================================================
//  画面と描画
// ================================================================
let W = 1, Hh = 1, gRect = { x: 0, y: 0, w: 1, h: 1 };
function resize() {
  W = innerWidth; Hh = innerHeight;
  renderer.setSize(W, Hh, false);
  const asp = W / Hh;
  camera.aspect = asp;
  const hfov = 68 * Math.PI / 180;
  camera.fov = clamp(2 * Math.atan(Math.tan(hfov / 2) / asp) * 180 / Math.PI, 38, 80);
  camera.updateProjectionMatrix();
  const gw = Math.round(Math.min(W * 0.3, Hh * 0.44)), gh = Math.round(gw * 1.3);
  gRect = { x: 0, y: 0, w: gw, h: gh };
  gCam.aspect = gw / gh; gCam.updateProjectionMatrix();
}
addEventListener('resize', resize);

let last = performance.now(), T = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(DTCAP, (now - last) / 1000); last = now; T += dt;
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i]; tw.t += dt; const k = Math.min(1, tw.t / tw.dur);
    tw.fn(tw.e(k)); if (k >= 1) { tweens.splice(i, 1); tw.res(); }
  }
  perFrame.forEach((f) => f(dt, T));
  animals.forEach((a) => { if (a.root.visible) { if (a.watchCam && a.alive && !a.walking) a.look = clamp(camYaw(a) - a.root.rotation.y, -0.9, 0.9) * 0.8; a.update(dt, T); } });
  if (dad.root.visible) dad.update(dt, T);
  girl.update(dt, T);
  updateParts(dt);
  // カメラ（少しだけ呼吸するように揺れる）
  shake = Math.max(0, shake - dt * 2);
  camera.position.copy(camBase).add(V(Math.sin(T * 0.5) * 0.03 + (Math.random() - 0.5) * shake * 0.1, Math.sin(T * 0.7) * 0.02 + (Math.random() - 0.5) * shake * 0.1, 0));
  camera.lookAt(camLook);
  hintTick(dt);
  renderer.setViewport(0, 0, W, Hh); renderer.setScissorTest(false);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.setScissorTest(true);
  renderer.setScissor(gRect.x, gRect.y, gRect.w, gRect.h); renderer.setViewport(gRect.x, gRect.y, gRect.w, gRect.h);
  renderer.render(gScene, gCam);
  renderer.setScissorTest(false);
}

// ================================================================
//  入力（指＝女の子の手）
// ================================================================
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let busy = 0, idle = 0;
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  unlockAudio();
  idle = 0; hintEl.classList.remove('on');
  const x = e.clientX, y = e.clientY;
  showHand(x, y);
  girlReach(x / W, y / Hh);
  // 女の子をタップ
  const gy = Hh - y;
  if (x < gRect.w && gy < gRect.h) {
    ndc.set((x / gRect.w) * 2 - 1, (gy / gRect.h) * 2 - 1);
    ray.setFromCamera(ndc, gCam);
    if (ray.intersectObject(girl.root, true).length) { girlGiggle(); return; }
  }
  ndc.set((x / W) * 2 - 1, -(y / Hh) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(tappables.filter(shown), true);
  for (const h of hits) {
    let o = h.object; while (o && !o.userData.onTap) o = o.parent;
    if (o && shown(h.object.isMesh && h.object.material.visible === false ? h.object.parent : h.object)) {
      if (busy && !o.userData.always) { sfx('tap'); return; }
      o.userData.onTap(h.point); return;
    }
  }
  sfx('tap');
  const p = h0(hits); if (p) sparkle(p, 6, 0.25);
}, { passive: false });
function h0(hits) { return hits.length ? hits[0].point : null; }
['touchstart', 'touchmove', 'gesturestart', 'dblclick', 'contextmenu'].forEach((ev) => document.addEventListener(ev, (e) => { if (e.touches && e.touches.length > 1 || ev !== 'touchstart') e.preventDefault(); }, { passive: false }));

let reachT = 0;
function girlReach(nx, ny) {
  girl.look = clamp((nx - 0.25) * 1.1, -0.3, 0.8); girl.lookY = clamp((ny - 0.6) * 0.6, -0.35, 0.25);
  girl.armT[1] = { x: -0.6 - (1 - ny) * 0.8, z: 0.5 + nx * 0.6, fx: -0.3 };
  clearTimeout(reachT); reachT = setTimeout(() => { girl.armT[1] = { x: 0, z: 0, fx: 0 }; girl.look = 0.15; girl.lookY = 0; }, 700);
}
let faceT = 0;
function girlFace(e, dur = 1.6) { girl.setFace(e); clearTimeout(faceT); if (dur) faceT = setTimeout(() => girl.setFace(state === 'hat' ? 'idle' : 'idle'), dur * 1000); }
async function girlHop() { await tween(0.18, (k) => { girl.hop = Math.sin(k * Math.PI) * 0.06; }); girl.hop = 0; }
function girlGiggle() { sfx('giggle'); girlFace('happy', 1.2); girl.wiggle = true; setTimeout(() => girl.wiggle = false, 700); }
function cheer(dur = 1.4) { girlFace('happy', dur); girl.armT[0] = { x: -2.6, z: -0.3 }; girl.armT[1] = { x: -2.6, z: 0.3 }; girlHop(); setTimeout(() => { girl.armT[0] = { x: 0, z: 0 }; girl.armT[1] = { x: 0, z: 0 }; girlHop(); }, 400); setTimeout(() => { girl.armT[0] = { x: 0, z: 0 }; girl.armT[1] = { x: 0, z: 0 }; }, dur * 1000); }

// ---------- ヒント（しばらく触らないと指さす） ----------
let hintTargets = () => [];
function hintTick(dt) {
  idle += dt;
  if (idle > 5 && !busy) {
    const list = hintTargets().filter((o) => o && shown(o));
    if (list.length) {
      const s = toScreen(list[0]);
      if (s.ok) { hintEl.style.left = s.x + 'px'; hintEl.style.top = s.y + 'px'; hintEl.classList.add('on'); }
    }
  } else if (idle <= 5) hintEl.classList.remove('on');
}

// ================================================================
//  動物たちのしぐさ
// ================================================================
async function act(a) {
  if (a.acting) return; a.acting = true;
  const kind = a.kind;
  if (kind === 'lion') {
    a.target.sit = 1; a.face = 'roar'; sfx('roar'); shake = 0.3; await wait(1.0); a.face = 'happy'; await wait(0.6);
  } else if (kind === 'zebra') {
    a.target.rear = 1; a.pedal = true; a.face = 'happy'; sfx('whinny');
    const r0 = a.root.rotation.y;
    await tween(1.4, (k) => { a.root.rotation.y = r0 + Math.sin(k * Math.PI * 2) * 0.8; a.hop = Math.abs(Math.sin(k * Math.PI * 4)) * 0.15; });
    a.target.rear = 0; a.pedal = false; a.hop = 0;
  } else if (kind === 'tiger') {
    a.target.lie = 1; a.face = 'happy'; sfx('purr'); await wait(0.5);
    const p0 = a.root.position.y;
    await tween(1.0, (k) => { a.root.rotation.z = k * Math.PI * 2; a.root.position.y = p0 + Math.sin(k * Math.PI) * 0.25; });
    a.root.rotation.z = 0; a.face = 'roar'; sfx('yawn'); await wait(0.9); a.face = 'happy';
  } else if (kind === 'trike') {
    a.face = 'happy'; sfx('honk');
    for (let i = 0; i < 3; i++) { await tween(0.22, (k) => { a.hop = Math.sin(k * Math.PI) * 0.25; }); sfx('stomp'); }
    a.hop = 0;
  } else if (kind === 'rex') {
    a.face = 'roar'; a.clap = true; a.sway = true; sfx('rumble'); await wait(0.8); a.face = 'happy';
    for (let i = 0; i < 2; i++) { await tween(0.3, (k) => { a.hop = Math.sin(k * Math.PI) * 0.2; }); sfx('stomp'); shake = 0.25; }
    a.hop = 0; a.clap = false; a.sway = false;
  } else if (kind === 'ptera') {
    await pteraLoop();
  }
  a.face = 'idle'; a.acting = false;
}

async function pteraLoop() {
  const a = ptera; const home = a.root.position.clone(), homeR = a.root.rotation.y;
  a.face = 'happy'; sfx('squawk'); a.flying = true;
  await tween(0.4, (k) => { a.fold = 1 - k; a.root.position.y = home.y + k * 0.6; });
  const c = V(home.x - 1.6, 0, home.z - 0.5);
  sfx('flap');
  await tween(3.2, (k) => {
    const ang = k * Math.PI * 2;
    const x = c.x + Math.cos(ang) * 1.9, z = c.z + Math.sin(ang) * 1.6;
    a.root.position.set(x, home.y + 0.6 + Math.sin(k * Math.PI) * 2.2, z);
    a.root.rotation.y = -ang; a.root.rotation.z = 0.35;
    if (Math.random() < 0.02) sfx('flap');
  }, ease.lin);
  a.root.rotation.z = 0;
  await tween(0.5, (k) => { a.fold = k; a.root.position.lerp(home, k); });
  a.flying = false; a.root.position.copy(home); a.root.rotation.y = homeR; a.face = 'idle';
}

// ================================================================
//  場面0〜1：帽子をかぶって、おもちゃが本物に
// ================================================================
let state = 'hat';
const hats = [];
function setupHats() {
  const types = ['explorer', 'keeper', 'bucket'];
  types.forEach((ty, i) => {
    const h = M.makeHat(ty, 1.0);
    h.position.set(1.7 + i * 0.36, 1.43, -2.78); h.rotation.set(0.85, 0, 0);
    house.add(h); hats.push(h);
    const peg = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 8), std('#7a5a3a', 0.4), M.TX && H.hooks, V(-0.35 + i * 0.36, 0.02, 0.06), { x: Math.PI / 2 });
    proxy(h, 0.2, V(0, 0.05, 0));
    onTap(h, () => pickHat(h, ty));
  });
}
async function pickHat(h, ty) {
  if (state !== 'hat') return;
  state = 'hat-wait'; busy++;
  sfx('hat'); sparkle(h.getWorldPosition(new THREE.Vector3()), 16, 0.4);
  const p0 = h.position.clone(), r0 = h.rotation.clone();
  // 帽子が画面左下の女の子へ飛んでいく
  const camP = new THREE.Vector3(-0.85, -0.35, 0.6).unproject(camera); house.worldToLocal(camP);
  await tween(0.55, (k) => { h.position.lerpVectors(p0, camP, k); h.position.y += Math.sin(k * Math.PI) * 0.3; h.rotation.x = r0.x * (1 - k); h.rotation.y = k * 6; });
  h.visible = false;
  const mine = M.makeHat(ty, 1.0); girl.hatSlot.add(mine);
  mine.position.y = 0.6;
  await tween(0.35, (k) => { mine.position.y = 0.6 * (1 - k); }, ease.out);
  sfx('pop'); girl.myHat = ty;
  cheer(1.6); sfx('happy');
  await wait(1.0);
  hats.forEach((o) => { if (o !== h) tween(0.4, (k) => o.scale.setScalar(1 - k)).then(() => o.visible = false); });
  busy--;
  startToys();
}

let alive1 = 0;
const s1Spots = {
  lion: { x: -0.5, z: 0.4, ry: 0.1 },
  zebra: { x: 1.65, z: -0.4, ry: -1.0 },
  tiger: { x: -1.2, z: -0.6, ry: 0 },
};
async function startToys() {
  state = 'toys';
  playBgm('home');
  await shot('shelf', 1.6);
  [lion, zebra, tiger].forEach((a) => {
    const pr = proxy(a.root, 1.0, V(0, 0.7, 0), 1);
    onTap(a.root, () => toyTap(a));
    a.toyGlow = true;
  });
  hintTargets = () => [lion, zebra, tiger].filter((a) => !a.alive && !a.waking).map((a) => a.root);
}
perFrame.add((dt, t) => { // おもちゃがきらっと光る
  if (Math.random() < dt * 1.2) {
    const list = animals.filter((a) => a.toyGlow && !a.alive && !a.waking && a.root.visible);
    if (list.length) { const a = list[Math.floor(Math.random() * list.length)]; sparkle(a.root.getWorldPosition(new THREE.Vector3()).add(V(0, 0.15, 0)), 3, 0.15); }
  }
});

async function toyTap(a) {
  if (state === 'toys' && !a.alive && !a.waking) return wake1(a);
  if (a.alive && (state === 'toys' || state === 'picnic' || state === 'seek-done')) return act(a);
  if (a.alive) return act(a);
}

async function grow(a, dest, ry, hopH = 0.8) {
  a.waking = true;
  const p0 = a.root.position.clone(), s0 = a.root.scale.x, r0 = a.root.rotation.y;
  sfx('boing'); sparkle(p0, 10, 0.3);
  await tween(0.9, (k) => {
    a.root.position.lerpVectors(p0, dest, k); a.root.position.y += Math.sin(k * Math.PI) * hopH;
    a.root.rotation.y = r0 + (ry - r0) * k + k * Math.PI * 2;
  }, ease.io);
  a.root.rotation.y = ry;
  puff(dest, 1.1); sfx('grow');
  await tween(1.1, (k) => {
    a.root.scale.setScalar(s0 + (1 - s0) * ease.back(k));
    if (k > 0.3 && !a.alive) { a.setMode('real'); a.alive = true; }
  }, ease.lin);
  a.root.scale.setScalar(1); a.waking = false; a.watchCam = true;
}

async function wake1(a) {
  busy++;
  girlFace('surprised', 1.5);
  const sp = s1Spots[a.kind];
  const camP = shot('room', 1.1);
  await grow(a, V(sp.x, 0, sp.z), sp.ry);
  await camP;
  cheer(1.4);
  if (a.kind === 'lion') { a.target.sit = 1; a.face = 'roar'; sfx('roar'); shake = 0.25; await wait(1.1); a.face = 'happy'; await wait(0.5); }
  if (a.kind === 'zebra') { await act(a); await act(a); }
  if (a.kind === 'tiger') {
    a.watchCam = false;
    await walkTo(a, -2.2, -0.95, 1.4);
    await turnTo(a, Math.PI, 0.3);
    a.walking = true; await tween(0.5, (k) => { a.root.position.y = Math.sin(k * Math.PI) * 0.5 + k * 0.42; a.root.position.z = -0.95 - k * 0.6; }); a.walking = false;
    await turnTo(a, -Math.PI / 2 + 0.25, 0.4);
    a.target.lie = 1; a.face = 'roar'; sfx('yawn'); await wait(1.0); a.face = 'sleep'; a.watchCam = true;
  }
  a.face = a.kind === 'tiger' ? 'sleep' : 'idle';
  alive1++;
  busy--;
  if (alive1 < 3) { await wait(0.4); if (state === 'toys') shot('shelf', 1.2); }
  else endToys();
}

async function endToys() {
  state = 'toys-done'; busy++;
  await wait(0.6);
  // みんなで勢ぞろい
  tiger.face = 'surprised'; tiger.target.lie = 0; await wait(0.3);
  tiger.walking = true; await tween(0.5, (k) => { tiger.root.position.y = 0.42 * (1 - k) + Math.sin(k * Math.PI) * 0.4; tiger.root.position.z = -1.55 + k * 0.6; }); tiger.walking = false;
  lion.target.sit = 0;
  await Promise.all([walkTo(lion, -1.0, 0.6, 1.4, 0.2), walkTo(tiger, 0.4, 0.4, 1.4, 0), walkTo(zebra, 1.7, 0.2, 1.4, -0.3)]);
  [lion, zebra, tiger].forEach((a) => a.face = 'happy');
  sfx('fanfare'); cheer(2); sparkle(V(0.3, 1.8, 0.2), 30, 1.2);
  sfx('roar'); setTimeout(() => sfx('whinny'), 500); setTimeout(() => sfx('purr'), 1000);
  zebra.target.rear = 1; await wait(1.2); zebra.target.rear = 0;
  await wait(0.8);
  // かくれんぼ：女の子が目をつむって数える
  girl.setFace('closed'); girl.armT[0] = { x: -2.2, z: 0.5, fx: -1.2 }; girl.armT[1] = { x: -2.2, z: -0.5, fx: -1.2 };
  clearTimeout(faceT);
  await veilTo(0.82, '#1b1a2a', 0.7);
  playBgm('seek');
  for (let i = 0; i < 5; i++) { sfx('count', i); if (i === 1) sfx('giggle'); if (i === 3) sfx('step'); await wait(0.55); }
  hideAnimals();
  await shot('seek', 0);
  await veilTo(0, '#1b1a2a', 0.6);
  girl.armT[0] = { x: 0, z: 0 }; girl.armT[1] = { x: 0, z: 0 };
  girl.setFace('determined');
  busy--;
  startSeek();
}

// ================================================================
//  場面2：かくれんぼ
// ================================================================
const hideSpots = {};
function hideAnimals() {
  [lion, zebra, tiger].forEach((a) => { a.target = { sit: 0, lie: 0, rear: 0 }; a.pose.sit = a.pose.lie = a.pose.rear = 0; a.face = 'idle'; a.watchCam = false; a.look = 0; });
  // ライオン：右のカーテンのふくらみ（しっぽが出ている）
  place(lion, -0.85, 0, -3.25, 0, 1); lion.target.sit = 1; lion.pose.sit = 1; lion.tailYaw = 1.2;
  H.curtR.bulge = 0.7; H.curtR.apply();
  // トラ：ソファのうしろ（耳としっぽが見える）
  place(tiger, -2.2, 0, -2.55, Math.PI / 2, 1); tiger.lookY = 0.1;
  // シマウマ：キッチンのアイランドのかげ
  place(zebra, 3.2, 0, -1.75, Math.PI / 2 + 0.1, 1); zebra.target.lie = 1; zebra.pose.lie = 1; zebra.lookY = 0.55;
  [lion, zebra, tiger].forEach((a) => a.hidden = true);
}

let found = 0;
function startSeek() {
  state = 'seek';
  const C = H.curtR;
  // カーテン
  onTap(C.m, () => { if (lion.hidden) reveal(lion); else { sfx('swish'); wiggleCurtain(); } });
  onTap(H.sofa, () => { if (tiger.hidden) reveal(tiger); else boing(H.sofa); });
  onTap(H.island, () => { if (zebra.hidden) reveal(zebra); else boing(H.island, 0.05); });
  // しっぽ等をタップしても見つかる
  [lion, zebra, tiger].forEach((a) => { a.root.userData.onTap = null; });
  onTap(lion.root, () => lion.hidden ? reveal(lion) : act(lion));
  onTap(tiger.root, () => tiger.hidden ? reveal(tiger) : act(tiger));
  onTap(zebra.root, () => zebra.hidden ? reveal(zebra) : act(zebra));
  // はずれの場所（それぞれ小さなおまけ）
  onTap(H.box, () => boxSurprise());
  onTap(H.plant, async () => { sfx('rustle'); await tween(0.6, (k) => H.leaves.forEach((l, i) => l.rotation.z = Math.sin(k * Math.PI * 6 + i) * 0.2 * (1 - k))); });
  onTap(H.lamp, () => { H.lampOn = !H.lampOn; sfx('tap'); H.shadeM.emissiveIntensity = H.lampOn ? 0.8 : 0; H.lampLight.intensity = H.lampOn ? 3 : 0; });
  onTap(H.fridge, () => fridgeOpen());
  onTap(H.cushion, () => boing(H.cushion, 0.1));
  hintTargets = () => {
    const l = [];
    if (idle > 9) { if (lion.hidden) l.push(C.m); if (tiger.hidden) l.push(H.sofa); if (zebra.hidden) l.push(H.island); }
    return l;
  };
  // 時々隠れ場所がもぞもぞ動く（ヒント）
  let wig = 0;
  perFrame.add(function seekWiggle(dt, t) {
    if (state !== 'seek') { perFrame.delete(seekWiggle); return; }
    wig += dt;
    if (lion.hidden) { C.wig = (Math.sin(t * 0.9) > 0.85) ? 1 : 0.15; C.apply(t); }
    tiger.tailYaw = Math.sin(t * 1.3) * 0.3;
    if (tiger.hidden) tiger.hop = Math.max(0, Math.sin(t * 1.1)) > 0.97 ? 0.08 : 0;
    if (zebra.hidden) zebra.look = Math.sin(t * 0.8) * 0.4;
  });
}
async function boing(obj, amt = 0.08) { sfx('boing'); const s = obj.scale.clone(); await tween(0.4, (k) => { const v = 1 + Math.sin(k * Math.PI * 3) * amt * (1 - k); obj.scale.set(s.x * (2 - v), s.y * v, s.z * (2 - v)); }); obj.scale.copy(s); }
async function wiggleCurtain() { const C = H.curtR; await tween(0.6, (k) => { C.open = Math.sin(k * Math.PI) * 0.3; C.apply(T); }); }
let boxBusy = false;
async function boxSurprise() {
  if (boxBusy) return; boxBusy = true;
  sfx('boing');
  const b = H.ball; b.visible = true; b.position.set(0, 0.2, 0);
  H.flaps.forEach((f, i) => tween(0.2, (k) => f.rotation.z = (i ? 1 : -1) * (0.5 + k * 1.4)));
  await tween(0.9, (k) => { b.position.y = 0.2 + Math.sin(k * Math.PI) * 1.0; b.rotation.x = k * 8; });
  sfx('pop'); girlFace('happy', 1);
  await tween(0.5, (k) => { b.position.y = 0.2 + Math.sin(k * Math.PI) * 0.3; });
  b.visible = false;
  H.flaps.forEach((f, i) => tween(0.3, (k) => f.rotation.z = (i ? 1 : -1) * (1.9 - k * 1.4)));
  boxBusy = false;
}
let fridgeBusy = false;
async function fridgeOpen() {
  if (fridgeBusy) return; fridgeBusy = true;
  sfx('door'); const d = H.fridgeDoor;
  await tween(0.4, (k) => d.rotation.y = -k * 1.6);
  const p = new THREE.Vector3(); H.fridge.getWorldPosition(p);
  for (let i = 0; i < 10; i++) particle(puffTex, p.clone().add(V(-0.3, 1.2, 0)), V(-Math.random() * 0.8, Math.random() * 0.2, Math.random() * 0.6 - 0.3), 1.2, 0.3, 0xe8f6ff, false, 0.4);
  girlFace('surprised', 1);
  await wait(0.8);
  await tween(0.4, (k) => d.rotation.y = -(1 - k) * 1.6);
  fridgeBusy = false;
}

const lineup = { lion: [-1.1, 0.7, 0.25], tiger: [0.35, 0.95, 0], zebra: [1.8, 0.6, -0.35] };
async function reveal(a) {
  if (!a.hidden || a.revealing) return;
  a.revealing = true; busy++;
  girlFace('surprised', 1.4); sfx('pop');
  if (a === lion) {
    sfx('swish');
    await tween(0.5, (k) => { H.curtR.bulge = 0.7 * (1 - k); lion.root.position.z = -3.25 + k * 0.8; H.curtR.open = k; H.curtR.apply(T); });
    a.tailYaw = 0;
    a.face = 'surprised'; await tween(0.3, (k) => a.hop = Math.sin(k * Math.PI) * 0.3); a.hop = 0;
    a.root.rotation.y = 0; a.face = 'roar'; sfx('roar'); await wait(0.9);
  } else if (a === tiger) {
    a.face = 'surprised'; sfx('purr');
    const p0 = a.root.position.clone();
    await turnTo(a, 0, 0.25);
    a.walking = true;
    await tween(0.8, (k) => { a.root.position.set(p0.x, Math.sin(k * Math.PI) * 1.25, p0.z + k * 1.75); });
    a.walking = false; sfx('stomp');
    a.face = 'roar'; sfx('yawn'); await wait(0.8);
  } else if (a === zebra) {
    a.target.lie = 0; a.lookY = 0; a.face = 'surprised'; await wait(0.5);
    sfx('whinny'); a.face = 'happy';
    await walkTo(a, 2.0, -1.75, 1.6);
    await walkTo(a, 2.0, -0.1, 1.6);
  }
  a.face = 'happy';
  a.hidden = false;
  sparkle(a.root.position.clone().add(V(0, 1.2, 0)), 24, 0.8);
  cheer(1.2); sfx('happy');
  const [x, z, ry] = lineup[a.kind];
  await walkTo(a, x, z, 1.6, ry);
  a.watchCam = true; a.face = 'idle';
  if (a === lion) { a.target.sit = 1; }
  found++;
  busy--;
  a.revealing = false;
  if (found === 3) endSeek();
}

async function endSeek() {
  state = 'seek-done'; busy++;
  await wait(0.5);
  [lion, zebra, tiger].forEach((a) => a.face = 'happy');
  sfx('fanfare'); cheer(2);
  for (let i = 0; i < 3; i++) sparkle(V(-1 + i * 1.4, 1.5, 0.6), 20, 0.8);
  zebra.target.rear = 1; zebra.pedal = true; await wait(1.4); zebra.target.rear = 0; zebra.pedal = false;
  // みんなで庭へ
  await Promise.all([walkTo(lion, 4.5, 1.5, 1.8), walkTo(tiger, 4.5, 2.0, 1.8), walkTo(zebra, 4.5, 1.0, 1.8)]);
  sfx('door');
  await veilTo(1, '#fff', 0.6);
  goGarden();
  await veilTo(0, '#fff', 0.8);
  busy--;
}

// ================================================================
//  場面3：庭のジオラマの恐竜とスイカ
// ================================================================
const gSpots = { trike: { x: -1.3, z: -2.2, ry: 0.5 }, rex: { x: 2.4, z: -3.0, ry: -0.35 }, ptera: { x: 3.9, z: -0.9, ry: -0.6 } };
let dinosAlive = 0;
function goGarden() {
  state = 'dinos';
  house.visible = false; garden.visible = true;
  scene.background = new THREE.Color(0xbfdcf2);
  scene.fog = new THREE.Fog(0xcfe3f0, 22, 45);
  setSun(V(6, 12, 8), V(0, 0, -1), 9); sun.intensity = 2.8; hemi.intensity = 1.0;
  [lion, zebra, tiger].forEach((a) => { a.root.visible = false; a.watchCam = false; });
  [trike, rex, ptera].forEach((a) => { a.root.visible = true; a.toyGlow = true; });
  playBgm('garden');
  shot('dio', 0);
  [trike, rex, ptera].forEach((a) => {
    proxy(a.root, a === rex ? 1.4 : 1.3, V(0, a === rex ? 2.0 : 0.9, 0));
    onTap(a.root, () => dinoTap(a));
  });
  hintTargets = () => [trike, rex, ptera].filter((a) => !a.alive && !a.waking).map((a) => a.root);
}

async function dinoTap(a) {
  if (!a.alive && !a.waking && state === 'dinos') return wakeDino(a);
  if (!a.alive) return;
  if (state === 'melons') return giveTo(a);
  if (state === 'picnic') return feedOrAct(a);
  return act(a);
}

async function wakeDino(a) {
  busy++;
  girlFace('surprised', 1.5);
  const sp = gSpots[a.kind];
  const cam = shot('garden', 1.2);
  if (a === ptera) {
    await grow(a, V(0.2, 0, 0.8), 0, 1.0);
    await cam; cheer(1.2);
    a.watchCam = false;
    a.flying = true; sfx('squawk');
    const p0 = a.root.position.clone();
    await tween(0.5, (k) => { a.fold = 1 - k; a.root.position.y = k * 1.2; });
    await tween(2.6, (k) => {
      const ang = k * Math.PI * 2;
      a.root.position.set(p0.x + Math.sin(ang) * 2.5 + (sp.x - p0.x) * k, 1.2 + Math.sin(k * Math.PI) * 2.4 + (0.5 - 1.2) * k, p0.z - (1 - Math.cos(ang)) * 1.4 + (sp.z - p0.z) * k);
      a.root.rotation.y = Math.PI / 2 - ang; a.root.rotation.z = 0.3 * Math.sin(k * Math.PI);
      if (Math.random() < 0.03) sfx('flap');
    }, ease.lin);
    a.root.position.set(sp.x, 0.5, sp.z); a.root.rotation.set(0, sp.ry, 0);
    await tween(0.4, (k) => a.fold = k); a.flying = false; sfx('squawk');
  } else {
    await grow(a, V(sp.x, 0, sp.z), sp.ry, a === rex ? 2.2 : 1.2);
    await cam; cheer(1.2);
    if (a === rex) { a.face = 'surprised'; await wait(0.3); sfx('stomp'); shake = 0.3; await act(a); }
    else await act(a);
  }
  a.watchCam = true; a.face = 'idle';
  dinosAlive++;
  busy--;
  if (dinosAlive < 3) { await wait(0.3); if (state === 'dinos') shot('dio', 1.2); }
  else dadScene();
}

// ---------- パパのやらかし ----------
const melons = [];
const melonSpots = [V(3.5, 0, 2.55), V(-1.55, 0, -0.2), V(1.3, 0, 3.4)]; // 大・中・小 が転がっていく先
const matSlots = [V(0.15, 0.012, 0.75), V(0.85, 0.012, 1.15), V(1.35, 0.012, 0.65)];
async function dadScene() {
  state = 'dad'; busy++;
  await wait(0.4);
  // スイカ3つを抱えたパパ
  const sizes = [0.42, 0.3, 0.17];
  sizes.forEach((r, i) => { const m = M.makeMelon(r); m.userData.size = i; m.userData.r = r; garden.add(m); melons.push(m); });
  dad.root.visible = true; dad.root.position.set(6.5, 0, 2.2); dad.root.rotation.y = -Math.PI / 2;
  dad.carry = true; dad.armT[0] = { x: -1.3, z: 0.25, fx: -0.5 }; dad.armT[1] = { x: -1.3, z: -0.25, fx: -0.5 };
  const carryF = () => {
    const p = dad.root.position, ry = dad.root.rotation.y;
    const fx = Math.sin(ry), fz = Math.cos(ry);
    let y = 0.75;
    melons.forEach((m, i) => { if (m.userData.held) return; m.position.set(p.x + fx * 0.45, y - 0.42 + (dad.hop || 0), p.z + fz * 0.45); m.rotation.y = ry; y += m.userData.r * 1.8; m.position.y = y - m.userData.r * 1.8 + (i ? Math.sin(T * 8 + i) * 0.03 : 0) - 0.42 + 0.4; });
  };
  perFrame.add(carryF);
  dad.setFace('happy'); sfx('laughLow');
  await walkTo(dad, 3.3, 0.2, 1.3);
  // 大人の失敗ギャグ：大きいティラノに小さいスイカ
  await turnTo(dad, Math.atan2(rex.root.position.x - 3.3, rex.root.position.z - 0.2), 0.3);
  const small = melons[2]; small.userData.held = true;
  const sp0 = small.position.clone(), rexMouth = () => rex.head.getWorldPosition(new THREE.Vector3()).add(V(0, -0.3, 0.6));
  dad.armT[0] = { x: -2.2, z: 0.2 };
  rex.watchCam = false; rex.look = 0; rex.lookY = 0.35;
  await tween(0.7, (k) => { small.position.lerpVectors(sp0, rexMouth(), k); small.position.y += Math.sin(k * Math.PI) * 0.8; });
  rex.face = 'puzzled'; sfx('hmm'); rex.headTilt = 0.4;
  await wait(1.3);
  dad.setFace('sheepish'); sfx('laughLow'); girlFace('puzzled', 1.2);
  // ちっちゃすぎて返される
  const sp1 = small.position.clone();
  await tween(0.6, (k) => { small.position.lerpVectors(sp1, sp0, k); small.position.y += Math.sin(k * Math.PI) * 0.6; });
  small.userData.held = false; rex.face = 'idle'; rex.lookY = 0; rex.watchCam = true;
  dad.armT[0] = { x: -1.3, z: 0.25, fx: -0.5 };
  await wait(0.3);
  // やらかし：ホースにつまずいて全部転がる
  dad.setFace('happy');
  await walkTo(dad, 2.15, 2.75, 1.4);
  dad.setFace('surprised'); sfx('oops');
  perFrame.delete(carryF);
  const r0 = dad.root.rotation.clone();
  dad.walking = false;
  await tween(0.35, (k) => { dad.root.rotation.x = -k * 0.5; dad.hop = Math.sin(k * Math.PI) * 0.2; });
  dad.armT[0] = { x: -2.8, z: 0.8 }; dad.armT[1] = { x: -2.8, z: -0.8 };
  // スイカが転がる
  melons.forEach((m, i) => {
    const from = m.position.clone(), to = melonSpots[i].clone();
    const d = from.distanceTo(to);
    tween(1.1 + i * 0.2, (k) => { m.position.lerpVectors(from, to, k); m.position.y = Math.max(0, (from.y) * (1 - k) * (1 - k)) + Math.abs(Math.sin(k * Math.PI * 2)) * 0.25 * (1 - k); m.rotation.x = k * d / m.userData.r; }, ease.out).then(() => { m.position.y = 0; });
  });
  sfx('roll');
  // しりもち
  await tween(0.4, (k) => { dad.hips.position.y = dad.legH * (1 - k * 0.72); dad.root.rotation.x = -0.5 + k * 0.5; dad.legs.forEach((l) => l.rotation.x = -k * 1.4); });
  dad.sitting = true; sfx('thud'); shake = 0.5;
  dad.setFace('dizzy');
  girlFace('surprised', 1.4);
  [trike, rex, ptera].forEach((a) => { a.face = 'surprised'; });
  await wait(1.4);
  [trike, rex, ptera].forEach((a) => { a.face = 'idle'; });
  dad.armT[0] = { x: -0.3, z: 0.5 }; dad.armT[1] = { x: -0.3, z: -0.5 };
  dad.setFace('sheepish'); sfx('laughLow');
  // 看板が出てくる
  G.sign.visible = true; sfx('boing');
  await tween(0.7, (k) => G.sign.position.y = -2 + 2 * k, ease.back);
  sparkle(V(2.75, 1.4, 1.5), 16, 0.6);
  girl.setFace('determined');
  dad.carry = false;
  busy--;
  startMelons();
}

// ---------- スイカを恐竜に手わたす ----------
let selMelon = null, delivered = 0;
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.85 }));
ring.rotation.x = -Math.PI / 2; ring.visible = false;
const rightDino = [rex, trike, ptera];
function startMelons() {
  state = 'melons';
  garden.add(ring);
  melons.forEach((m) => { proxy(m, m.userData.r * 1.6 + 0.15, V(0, m.userData.r, 0)); onTap(m, () => selectMelon(m)); });
  onTap(dad.root, () => dadLaugh());
  hintTargets = () => {
    if (selMelon) return idle > 7 ? [rightDino[selMelon.userData.size].root] : [];
    return melons.filter((m) => !m.userData.done);
  };
  perFrame.add(function melonBob(dt, t) {
    if (state !== 'melons') { ring.visible = false; perFrame.delete(melonBob); return; }
    if (selMelon) {
      ring.visible = true; ring.position.set(selMelon.position.x, 0.03, selMelon.position.z);
      ring.scale.setScalar(selMelon.userData.r * 1.8 + Math.sin(t * 6) * 0.06);
      if (!selMelon.userData.moving) selMelon.children[0].position.y = selMelon.userData.r * 0.9 + 0.12 + Math.sin(t * 5) * 0.06;
    } else ring.visible = false;
  });
}
function selectMelon(m) {
  if (m.userData.done || m.userData.moving) return;
  if (selMelon && selMelon !== m) selMelon.children[0].position.y = selMelon.userData.r * 0.9;
  selMelon = m; sfx('pop'); sparkle(m.position.clone().add(V(0, m.userData.r, 0)), 8, 0.3);
  girlFace('happy', 0.8);
}
let dadBusy = false;
async function dadLaugh() {
  if (dadBusy) return; dadBusy = true;
  dad.setFace('happy'); sfx('laughLow'); dad.armT[0] = { x: -2.6, z: 0.4 };
  await wait(0.9); dad.armT[0] = { x: -0.3, z: 0.5 }; dad.setFace(state === 'picnic' ? 'happy' : 'sheepish'); dadBusy = false;
}

function anchorOf(a) {
  const v = new THREE.Vector3();
  if (a === rex) return a.head.localToWorld(v.set(0, -0.25, 0.85));
  if (a === trike) return a.head.localToWorld(v.set(0, 0.55, -0.1));
  if (a === ptera) return a.body.localToWorld(v.set(0, -0.3, 0));
  return a.head.localToWorld(v.set(0, -0.1, 0.4));
}

async function giveTo(a) {
  if (!selMelon) return act(a);
  if (a.busyGive) return;
  const m = selMelon; selMelon = null;
  m.userData.moving = true; a.busyGive = true;
  const from = m.position.clone(); m.children[0].position.y = m.userData.r * 0.9;
  const correct = rightDino[m.userData.size] === a;
  a.watchCam = false; a.look = 0;
  const target = () => anchorOf(a).sub(V(0, m.userData.r * 0.9, 0));
  await tween(0.7, (k) => { m.position.lerpVectors(from, target(), k); m.position.y += Math.sin(k * Math.PI) * 1.0; m.rotation.x += 0.1; });
  if (!correct) {
    // 「あれ？」の顔 → でもうれしそうに返してくれる
    a.face = 'puzzled'; sfx('hmm'); girlFace('puzzled', 1.2);
    const hold = () => m.position.copy(target());
    perFrame.add(hold);
    if (a === ptera) { a.fold = 0.6; }
    await wait(1.2);
    perFrame.delete(hold);
    a.face = 'happy'; sfx('giggle'); a.headTilt = 0;
    if (a === ptera) a.fold = 1;
    const p1 = m.position.clone();
    tween(0.25, (k) => a.hop = Math.sin(k * Math.PI) * 0.2);
    await tween(0.7, (k) => { m.position.lerpVectors(p1, from, k); m.position.y = Math.max(0, m.position.y) + Math.sin(k * Math.PI) * 0.8; });
    m.position.copy(from); m.position.y = 0;
    a.face = 'idle'; a.watchCam = true; m.userData.moving = false; a.busyGive = false;
    return;
  }
  // 正解：恐竜がシートまで運ぶ
  busy++;
  a.face = 'happy'; sfx('happy'); cheer(1.2);
  if (a === rex) { a.clap = false; sfx('rumble'); }
  if (a === trike) sfx('honk');
  if (a === ptera) sfx('squawk');
  const hold = () => m.position.copy(target());
  perFrame.add(hold);
  const slot = matSlots[m.userData.size];
  const home = a.root.position.clone(), homeR = a.root.rotation.y;
  if (a === ptera) {
    a.flying = true;
    await tween(0.4, (k) => { a.fold = 1 - k; a.root.position.y = 0.5 + k * 1.0; });
    const p0 = a.root.position.clone(), p1 = V(slot.x + 0.3, 1.4, slot.z - 0.2);
    await turnTo(a, Math.atan2(p1.x - p0.x, p1.z - p0.z), 0.2);
    await tween(1.4, (k) => { a.root.position.lerpVectors(p0, p1, k); a.root.position.y += Math.sin(k * Math.PI) * 0.8; if (Math.random() < 0.05) sfx('flap'); });
    perFrame.delete(hold);
    const mp = m.position.clone();
    await tween(0.45, (k) => { m.position.lerpVectors(mp, slot, k); }, ease.io);
    sfx('pop');
    await tween(1.2, (k) => { a.root.position.lerpVectors(p1, home, k); a.root.position.y += Math.sin(k * Math.PI) * 0.8; });
    await turnTo(a, homeR, 0.2);
    await tween(0.3, (k) => a.fold = k); a.flying = false;
  } else {
    const stand = V(slot.x + (a === rex ? 0.6 : -0.6), 0, slot.z - (a === rex ? 1.9 : 1.2));
    await walkTo(a, stand.x, stand.z, a === rex ? 1.5 : 1.3);
    await turnTo(a, Math.atan2(slot.x - stand.x, slot.z - stand.z), 0.3);
    a.lookY = 0.4; await wait(0.4);
    perFrame.delete(hold);
    const mp = m.position.clone();
    await tween(0.5, (k) => { m.position.lerpVectors(mp, slot, k); });
    sfx('pop'); a.lookY = 0;
    await walkTo(a, home.x, home.z, a === rex ? 1.5 : 1.3, homeR);
  }
  m.position.copy(slot); m.userData.done = true; m.userData.moving = false;
  sparkle(slot.clone().add(V(0, 0.4, 0)), 16, 0.5);
  a.face = 'idle'; a.watchCam = true; a.busyGive = false;
  delivered++;
  busy--;
  if (delivered === 3) picnic();
}

// ================================================================
//  最後：みんなでスイカのピクニック（好きなだけ遊べる）
// ================================================================
const slices = [];
let selSlice = null;
async function picnic() {
  state = 'picnic-start'; busy++;
  await wait(0.4);
  sfx('fanfare'); cheer(2);
  [trike, rex, ptera].forEach((a) => a.face = 'happy');
  // パパが立ち上がってスイカを切る
  dad.sitting = false; dad.setFace('happy');
  await tween(0.5, (k) => { dad.hips.position.y = dad.legH * (0.28 + 0.72 * k); dad.legs.forEach((l) => l.rotation.x = -(1 - k) * 1.4); });
  dad.armT[0] = { x: 0, z: 0 }; dad.armT[1] = { x: 0, z: 0 };
  await walkTo(dad, 0.7, 2.25, 1.4, Math.PI);
  shot('picnic', 1.2);
  for (let i = 0; i < 4; i++) { dad.armT[1] = { x: -1.8, z: 0 }; await wait(0.14); dad.armT[1] = { x: -0.6, z: 0 }; sfx('chop'); await wait(0.16); }
  puff(V(0.7, 0, 0.9), 0.8);
  melons.forEach((m) => m.visible = false);
  G.plate.visible = true;
  for (let i = 0; i < 6; i++) addSlice(i);
  sfx('happy');
  dad.armT[1] = { x: 0, z: 0 };
  await walkTo(dad, 2.0, 2.4, 1.2, -0.3 + Math.PI);
  dad.setFace('happy');
  // 家の動物たちもやってくる
  const come = [[lion, -2.0, 1.0, 0.6], [zebra, -1.6, -1.0, 0.7], [tiger, 2.2, 0.0, -0.6]];
  come.forEach(([a, x, z], i) => { a.root.visible = true; a.root.position.set(-7 - i, 0, 1.5 - i); a.target = { sit: 0, lie: 0, rear: 0 }; });
  await Promise.all(come.map(([a, x, z, ry]) => walkTo(a, x, z, 2.2, ry)));
  sfx('roar'); setTimeout(() => sfx('whinny'), 400); setTimeout(() => sfx('purr'), 800);
  [lion, zebra, tiger].forEach((a) => { a.face = 'happy'; a.watchCam = true; });
  lion.target.sit = 1; tiger.target.sit = 1;
  [lion, zebra, tiger].forEach((a) => { a.root.userData.onTap = null; onTap(a.root, () => feedOrAct(a)); });
  state = 'picnic'; busy--;
  hintTargets = () => idle > 8 ? (selSlice ? [lion.root] : slices.filter((s) => !s.userData.used).slice(0, 1)) : [];
  onTap(G.stump, () => act(ptera));
  // 空をタップすると翼竜が飛ぶ
}
const sliceSlots = [];
for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; sliceSlots.push(V(0.7 + Math.cos(a) * 0.3, 0.06, 0.95 + Math.sin(a) * 0.3)); }
function addSlice(i) {
  const s = M.makeSlice(); s.position.copy(sliceSlots[i]); s.rotation.y = -i / 6 * Math.PI * 2 + Math.PI / 2; s.rotation.x = 0;
  s.children[0].rotation.x = -Math.PI / 2 + 0.25;
  s.children[0].position.y = 0.04;
  s.userData.slot = i;
  garden.add(s); slices.push(s);
  proxy(s, 0.22, V(0, 0.05, 0));
  onTap(s, () => { if (s.userData.used) return; if (selSlice) selSlice.position.y = 0.06; selSlice = s; s.position.y = 0.3; sfx('pop'); sparkle(s.position, 6, 0.2); girlFace('happy', 0.8); });
  s.scale.setScalar(0.01); tween(0.4, (k) => s.scale.setScalar(Math.max(0.01, k)), ease.back);
}
perFrame.add((dt, t) => { if (selSlice) { selSlice.position.y = 0.3 + Math.sin(t * 5) * 0.05; selSlice.rotation.y += dt * 2; } });

async function feedOrAct(a) {
  if (state !== 'picnic') return act(a);
  if (!selSlice) return act(a);
  if (a.eating) return;
  const s = selSlice; selSlice = null; s.userData.used = true; a.eating = true;
  const from = s.position.clone();
  const target = () => anchorOf(a);
  await tween(0.6, (k) => { s.position.lerpVectors(from, target(), k); s.position.y += Math.sin(k * Math.PI) * 0.7; });
  const hold = () => s.position.copy(target());
  perFrame.add(hold);
  a.face = 'eat'; sfx('munch');
  for (let i = 0; i < 5; i++) { await wait(0.22); s.scale.setScalar(1 - (i + 1) / 6); if (i % 2) { sfx('seed'); particle(starTex, target(), V(Math.random() - 0.5, 1, Math.random() - 0.5), 0.6, 0.06, 0x332211, false); } }
  perFrame.delete(hold);
  garden.remove(s); slices.splice(slices.indexOf(s), 1);
  a.face = 'happy'; sfx('happy'); sparkle(target(), 10, 0.4);
  tween(0.3, (k) => a.hop = Math.sin(k * Math.PI) * 0.15).then(() => a.hop = 0);
  await wait(0.8); a.face = 'idle'; a.eating = false;
  setTimeout(() => addSlice(s.userData.slot), 600);
}

// ================================================================
//  起動
// ================================================================
async function loadTextures() {
  const L = new THREE.TextureLoader();
  const names = ['wood', 'floor', 'wall', 'fabric', 'grass', 'fur', 'garden', 'window'];
  await Promise.all(names.map((n) => new Promise((res) => L.load(`tex/${n}.jpg`, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (n === 'wood' || n === 'fur') { t.wrapS = t.wrapT = THREE.RepeatWrapping; } M.TX[n] = t; res(); }, undefined, () => { M.TX[n] = new THREE.Texture(); res(); }))));
}

async function main() {
  await loadTextures();
  buildHouse(); buildGarden(); garden.visible = false;
  setSun(V(3.5, 6.5, 4.5), V(-0.3, 0, -1.2), 6);
  setupCharacters();
  setupHats();
  // 女の子を画面に収める
  gCam.position.set(0.1, 0.9, 2.6); gCam.lookAt(0.1, 0.74, 0);
  resize();
  shot('hooks', 0);
  hintTargets = () => state === 'hat' ? [hats[0]] : [];
  girl.setFace('idle'); girl.look = 0.2;
  requestAnimationFrame((t) => { last = t; frame(t); });
  document.getElementById('load').style.display = 'none';
  // テスト・サムネイル用のジャンプ
  const j = Q.get('jump');
  if (j) await jump(j);
}

async function jump(j) {
  const h = hats[0]; girl.hatSlot.add(M.makeHat('explorer', 1)); hats.forEach((o) => o.visible = false); state = 'toys';
  const fast = (a, x, z, ry) => { a.setMode('real'); a.alive = true; a.watchCam = true; place(a, x, 0, z, ry, 1); };
  if (j === 'room') {
    fast(lion, -0.5, 0.4, 0.1); lion.target.sit = 1; fast(zebra, 1.65, -0.4, -1.0);
    fast(tiger, -2.2, -1.55, -Math.PI / 2 + 0.25); tiger.root.position.y = 0.42; tiger.target.lie = 1; tiger.face = 'sleep';
    shot('room', 0); state = 'toys-done'; return;
  }
  if (j === 'seek') { [lion, zebra, tiger].forEach((a) => fast(a, 0, 0, 0)); hideAnimals(); shot('seek', 0); startSeek(); return; }
  [lion, zebra, tiger].forEach((a) => fast(a, 0, 0, 0));
  goGarden();
  if (j === 'garden') return;
  [trike, rex, ptera].forEach((a) => { const s = gSpots[a.kind]; fast(a, s.x, s.z, s.ry); });
  ptera.root.position.y = 0.5; dinosAlive = 3; shot('garden', 0);
  if (j === 'dad') { await dadScene(); return; }
  if (j === 'melons' || j === 'picnic') {
    const sizes = [0.42, 0.3, 0.17];
    sizes.forEach((r, i) => { const m = M.makeMelon(r); m.userData.size = i; m.userData.r = r; m.position.copy(melonSpots[i]); garden.add(m); melons.push(m); });
    dad.root.visible = true; dad.root.position.set(2.15, 0, 2.75); dad.root.rotation.y = -0.4; dad.hips.position.y = dad.legH * 0.28; dad.legs.forEach((l) => l.rotation.x = -1.4); dad.sitting = true; dad.setFace('sheepish');
    G.sign.visible = true; G.sign.position.y = 0;
    if (j === 'melons') { startMelons(); return; }
    melons.forEach((m, i) => { m.position.copy(matSlots[i]); m.userData.done = true; });
    delivered = 3; await picnic();
  }
}

window.__game = { get state() { return state; }, toScreen, animals: () => ({ lion, zebra, tiger, trike, rex, ptera }), H, G, hats, melons, slices: () => slices, dad: () => dad, camera };
main();
