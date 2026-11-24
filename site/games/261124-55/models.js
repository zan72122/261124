// 3D モデル（すべてプリミティブから組み立て）。前方は +X、原点は地面の中心。
import * as THREE from 'three';
import { RoundedBoxGeometry } from './RoundedBoxGeometry.js';

const PI = Math.PI;
export const mats = {};
export function paint(c, rough = 0.32) {
  return new THREE.MeshPhysicalMaterial({ color: c, roughness: rough, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.06 });
}
export function matte(c, rough = 0.85) { return new THREE.MeshStandardMaterial({ color: c, roughness: rough }); }
mats.glass = new THREE.MeshPhysicalMaterial({ color: 0x1a2430, roughness: 0.04, metalness: 0.3, clearcoat: 1 });
mats.rubber = matte(0x1c1c1c, 0.9);
mats.chrome = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.18, metalness: 1 });
mats.dark = matte(0x2a2a2a, 0.6);
mats.grill = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.4, metalness: 0.6 });
mats.head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4cc, emissiveIntensity: 1.4 });
mats.tail = new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0xff2222, emissiveIntensity: 0.5 });

function sh(m) { m.castShadow = true; m.receiveShadow = true; return m; }
export function rbox(w, h, d, mat, x = 0, y = 0, z = 0, r = 0.08, parent) {
  const m = sh(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.1, h / 2.1, d / 2.1)), mat));
  m.position.set(x, y, z); if (parent) parent.add(m); return m;
}
export function box(w, h, d, mat, x = 0, y = 0, z = 0, parent) {
  const m = sh(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
  m.position.set(x, y, z); if (parent) parent.add(m); return m;
}
export function sphere(r, mat, x = 0, y = 0, z = 0, parent, seg = 24) {
  const m = sh(new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)), mat));
  m.position.set(x, y, z); if (parent) parent.add(m); return m;
}
export function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, parent, seg = 24) {
  const m = sh(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat));
  m.position.set(x, y, z); if (parent) parent.add(m); return m;
}

function wheel(g, x, r, W, wd = 0.32) {
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    const t = cyl(r, r, wd, mats.rubber, 0, 0, 0, w, 28); t.rotation.x = PI / 2;
    const h = cyl(r * 0.55, r * 0.55, wd + 0.02, mats.chrome, 0, 0, 0, w, 20); h.rotation.x = PI / 2;
    const n = cyl(r * 0.18, r * 0.18, wd + 0.05, mats.dark, 0, 0, 0, w, 10); n.rotation.x = PI / 2;
    w.position.set(x, r, s * (W / 2 - wd / 2 + 0.04));
    g.add(w); g.userData.wheels.push(w);
  }
}
// 運転席（前面ガラス・横窓・ライト・グリル）
function cab(g, { x0, x1, y0, y1, W, mat }) {
  const L = x1 - x0, H = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  rbox(L, H, W, mat, cx, cy, 0, 0.14, g);
  box(0.04, H * 0.42, W * 0.84, mats.glass, x1 + 0.005, y1 - H * 0.3, 0, g);
  for (const s of [-1, 1]) box(L * 0.55, H * 0.36, 0.04, mats.glass, cx + L * 0.12, y1 - H * 0.3, s * (W / 2 + 0.003), g);
  box(0.05, H * 0.22, W * 0.5, mats.grill, x1 + 0.01, y0 + H * 0.25, 0, g);
  for (const s of [-1, 1]) box(0.06, 0.14, 0.32, mats.head, x1 + 0.01, y0 + H * 0.25, s * (W / 2 - 0.25), g);
  box(0.16, 0.22, W + 0.04, mats.dark, x1 + 0.05, y0 + 0.08, 0, g); // バンパー
  for (const s of [-1, 1]) { const m = box(0.18, 0.1, 0.04, mats.dark, x1 - 0.1, y1 - H * 0.35, s * (W / 2 + 0.12), g); } // ミラー
}
function chassis(g, x0, x1, y, W) { box(x1 - x0, 0.3, W * 0.7, mats.dark, (x0 + x1) / 2, y, 0, g); }
function tails(g, x, y, W) { for (const s of [-1, 1]) box(0.05, 0.2, 0.22, mats.tail, x - 0.01, y, s * (W / 2 - 0.2), g); }
function lightBar(g, x, y, z = 0, len = 1.2, colors = [0xff2020, 0x2050ff]) {
  const lights = [];
  colors.forEach((c, i) => {
    const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.15, roughness: 0.3 });
    rbox(0.34, 0.16, len / colors.length, m, x, y, z + (i - (colors.length - 1) / 2) * len / colors.length, 0.05, g);
    lights.push(m);
  });
  return lights;
}
function base(L) { const g = new THREE.Group(); g.userData = { wheels: [], lights: [], length: L }; return g; }

export function makeAmbulance() {
  const g = base(6.2), W = 2.2, white = paint(0xf7f7f5), red = paint(0xd42828);
  chassis(g, -2.9, 2.9, 0.6, W);
  rbox(4.3, 2.4, W, white, -0.95, 1.95, 0, 0.12, g);
  cab(g, { x0: 1.15, x1: 3.05, y0: 0.75, y1: 2.6, W: W - 0.08, mat: white });
  box(4.32, 0.26, W + 0.02, red, -0.95, 1.45, 0, g);
  box(1.92, 0.26, W - 0.06, red, 2.1, 1.45, 0, g);
  // 横の十字の代わりに赤い丸と白い星（どこの団体でもない印）
  for (const s of [-1, 1]) {
    const c = cyl(0.42, 0.42, 0.02, red, -1.0, 2.35, s * (W / 2 + 0.01), g, 32); c.rotation.x = PI / 2;
    const c2 = cyl(0.26, 0.26, 0.03, white, -1.0, 2.35, s * (W / 2 + 0.01), g, 6); c2.rotation.x = PI / 2;
  }
  box(0.04, 0.8, 0.8, mats.glass, -3.11, 2.3, 0, g);
  tails(g, -3.1, 1.0, W);
  g.userData.lights = lightBar(g, 2.0, 2.7, 0, 1.4);
  wheel(g, 2.1, 0.45, W); wheel(g, -1.9, 0.45, W);
  g.userData.kind = 'ambulance';
  return g;
}

export function makeBus() {
  const g = base(10), W = 2.5, yellow = paint(0xf5b416), black = matte(0x151515, 0.5);
  chassis(g, -4.8, 4.6, 0.65, W);
  rbox(8.6, 2.6, W, yellow, -0.7, 1.95, 0, 0.16, g);
  rbox(1.5, 1.15, W - 0.2, yellow, 4.3, 1.25, 0, 0.18, g);
  box(0.05, 0.25, 1.2, mats.grill, 5.06, 1.1, 0, g);
  for (const s of [-1, 1]) box(0.06, 0.16, 0.3, mats.head, 5.05, 1.4, s * 0.85, g);
  box(0.16, 0.25, W - 0.1, black, 5.1, 0.75, 0, g);
  box(7.7, 0.85, W + 0.02, mats.glass, -0.85, 2.5, 0, g);
  for (let i = 0; i < 9; i++) box(0.12, 0.87, W + 0.04, yellow, -4.6 + i * 0.95, 2.5, 0, g);
  box(8.62, 0.07, W + 0.03, black, -0.7, 1.8, 0, g);
  box(8.62, 0.07, W + 0.03, black, -0.7, 1.45, 0, g);
  box(0.05, 1.0, W - 0.3, mats.glass, 3.61, 2.45, 0, g);
  rbox(8.4, 0.12, W - 0.1, matte(0xf2f2ee, 0.5), -0.7, 3.27, 0, 0.05, g);
  for (const x of [3.4, -4.8]) for (const s of [-1, 1]) {
    const m = new THREE.MeshStandardMaterial({ color: 0xff3020, emissive: 0xff3020, emissiveIntensity: 0.2 });
    sphere(0.1, m, x, 3.15, s * 0.9, g, 12); g.userData.lights.push(m);
  }
  // ドア（タップで開く）
  const door = box(0.7, 2.0, 0.05, mats.glass, 3.1, 1.6, W / 2 + 0.03, g); g.userData.door = door;
  // 赤い八角形の止まれ板（文字なし）
  const arm = new THREE.Group(); arm.position.set(2.5, 1.9, -(W / 2 + 0.05)); g.add(arm);
  const oct = cyl(0.3, 0.3, 0.03, paint(0xd01818), 0, 0, -0.32, arm, 8); oct.rotation.x = PI / 2; oct.rotation.y = PI / 8;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.02, 6, 8), matte(0xffffff, 0.4)); ring.position.z = -0.32; ring.rotation.z = PI / 8; arm.add(ring);
  arm.rotation.y = -PI / 2; g.userData.arm = arm;
  tails(g, -5.0, 1.1, W);
  wheel(g, 3.9, 0.5, W, 0.36); wheel(g, -2.8, 0.5, W, 0.36);
  g.userData.kind = 'bus';
  return g;
}

export function makePolice() {
  const g = base(4.8), W = 1.9, black = paint(0x141414, 0.25), white = paint(0xf8f8f8);
  rbox(4.8, 0.5, W, black, 0, 0.62, 0, 0.14, g);
  rbox(4.78, 0.28, W - 0.02, white, 0, 0.98, 0, 0.1, g);
  rbox(1.2, 0.2, W - 0.12, black, 1.75, 1.15, 0, 0.08, g); // ボンネット
  rbox(2.4, 0.62, W - 0.2, white, -0.35, 1.4, 0, 0.18, g);
  box(2.2, 0.42, W - 0.16, mats.glass, -0.35, 1.42, 0, g);
  const ws = box(0.05, 0.62, W - 0.3, mats.glass, 0.95, 1.36, 0, g); ws.rotation.z = -0.75;
  box(0.08, 0.44, 0.06, white, -0.35, 1.42, W / 2 - 0.08, g); box(0.08, 0.44, 0.06, white, -0.35, 1.42, -W / 2 + 0.08, g);
  for (const s of [-1, 1]) box(0.06, 0.12, 0.34, mats.head, 2.4, 0.78, s * 0.62, g);
  box(0.05, 0.14, 0.7, mats.grill, 2.41, 0.6, 0, g);
  tails(g, -2.41, 0.85, W);
  g.userData.lights = lightBar(g, -0.35, 1.82, 0, 1.2, [0xff2020, 0xff2020]);
  wheel(g, 1.5, 0.36, W, 0.26); wheel(g, -1.5, 0.36, W, 0.26);
  g.userData.kind = 'police';
  return g;
}

export function makeDump() {
  const g = base(7), W = 2.4, orange = paint(0xf07a14), bedMat = paint(0xe39a12, 0.45);
  chassis(g, -3.4, 3.2, 0.95, W);
  cab(g, { x0: 1.5, x1: 3.35, y0: 1.0, y1: 3.0, W, mat: orange });
  box(0.2, 1.6, 2.0, mats.dark, 1.35, 1.9, 0, g);
  const bed = new THREE.Group(); bed.position.set(-3.45, 1.25, 0); g.add(bed);
  box(4.6, 0.15, W, bedMat, 2.3, 0.08, 0, bed);
  for (const s of [-1, 1]) box(4.6, 1.15, 0.12, bedMat, 2.3, 0.65, s * (W / 2 - 0.06), bed);
  box(0.12, 1.45, W, bedMat, 4.55, 0.8, 0, bed);
  box(0.5, 0.12, W, bedMat, 4.8, 1.45, 0, bed);
  const sand = sh(new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, PI * 2, 0, PI / 2), matte(0xd3b072, 1)));
  sand.scale.set(2.2, 0.75, 1.05); sand.position.set(2.4, 0.55, 0); bed.add(sand);
  g.userData.bed = bed; g.userData.sand = sand;
  tails(g, -3.45, 1.0, W);
  wheel(g, 2.4, 0.55, W, 0.4); wheel(g, -1.5, 0.55, W, 0.4); wheel(g, -2.7, 0.55, W, 0.4);
  g.userData.kind = 'dump';
  return g;
}

export function makeGarbage() {
  const g = base(7.5), W = 2.4, green = paint(0x2f9e4a), body = paint(0xe8f2e8, 0.4);
  chassis(g, -3.4, 3.4, 0.95, W);
  cab(g, { x0: 1.85, x1: 3.65, y0: 1.0, y1: 3.0, W, mat: green });
  rbox(3.9, 2.35, W, body, -0.15, 2.2, 0, 0.14, g);
  box(3.92, 0.3, W + 0.02, green, -0.15, 1.5, 0, g);
  rbox(1.45, 2.5, W + 0.05, green, -2.8, 2.0, 0, 0.16, g);
  const mouth = box(0.08, 1.0, 1.9, matte(0x0d0d0d, 0.9), -3.5, 1.45, 0, g);
  const plate = box(0.06, 0.85, 1.8, mats.grill, -3.47, 1.75, 0, g); plate.visible = false;
  g.userData.mouth = mouth; g.userData.plate = plate;
  g.userData.mouthPos = new THREE.Vector3(-3.6, 1.5, 0);
  tails(g, -3.55, 0.95, W);
  const lm = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 0.2 });
  sphere(0.12, lm, -3.3, 3.3, 0, g, 12); g.userData.lights = [lm];
  wheel(g, 2.75, 0.55, W, 0.4); wheel(g, -1.9, 0.55, W, 0.4);
  g.userData.kind = 'garbage';
  return g;
}

function stripeTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d'); x.fillStyle = '#f4f4f0'; x.fillRect(0, 0, 256, 256);
  x.fillStyle = '#e0352b';
  for (let i = -2; i < 4; i++) { x.beginPath(); x.moveTo(i * 128, 0); x.lineTo(i * 128 + 60, 0); x.lineTo(i * 128 + 60 + 256, 256); x.lineTo(i * 128 + 256, 256); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1);
  return t;
}
export function makeMixer() {
  const g = base(8), W = 2.4, blue = paint(0x2a66cc);
  chassis(g, -3.6, 3.5, 0.95, W);
  cab(g, { x0: 2.0, x1: 3.8, y0: 1.0, y1: 3.0, W, mat: blue });
  box(4.8, 0.3, 1.9, mats.dark, -0.9, 1.25, 0, g);
  const drumG = new THREE.Group(); drumG.position.set(-0.8, 2.55, 0); drumG.rotation.z = PI / 2 - 0.22; g.add(drumG);
  const pts = [[0.05, -2.45], [0.7, -2.3], [1.2, -1.4], [1.28, -0.4], [1.2, 0.6], [0.85, 1.7], [0.45, 2.35], [0.42, 2.5], [0.3, 2.5]].map(([r, y]) => new THREE.Vector2(r, y));
  const drumMat = new THREE.MeshPhysicalMaterial({ map: stripeTex(), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide });
  const drum = sh(new THREE.Mesh(new THREE.LatheGeometry(pts, 40), drumMat)); drumG.add(drum);
  for (const s of [-1, 1]) box(0.25, 1.3, 0.2, mats.dark, -1.9 + (s > 0 ? 2.6 : 0), 1.85, s * 0.6, g);
  // シュート
  const chute = new THREE.Group(); chute.position.set(-3.35, 2.75, 0); chute.rotation.z = 0.0; g.add(chute);
  const half = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.8, 16, 1, true, 0, PI), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide })));
  half.rotation.z = PI / 2; half.rotation.y = PI / 2; half.rotation.order = 'ZYX'; half.position.x = -0.9;
  const ch2 = new THREE.Group(); ch2.rotation.z = 0.55; chute.add(ch2); ch2.add(half);
  const hopper = cyl(0.45, 0.2, 0.5, mats.grill, 0.05, 0.3, 0, chute, 16);
  g.userData.drum = drum; g.userData.chuteEnd = new THREE.Object3D(); g.userData.chuteEnd.position.set(-1.6, -0.95, 0); ch2.add(g.userData.chuteEnd);
  tails(g, -3.65, 1.0, W);
  wheel(g, 3.05, 0.55, W, 0.4); wheel(g, -1.6, 0.55, W, 0.4); wheel(g, -2.8, 0.55, W, 0.4);
  g.userData.kind = 'mixer';
  return g;
}

// ---------- 人物 ----------
export function drawFace(cv, expr, o) {
  const x = cv.getContext('2d'), W = cv.width, H = cv.height;
  x.fillStyle = o.skin; x.fillRect(0, 0, W, H);
  const cx = W * 0.25, ey = H * 0.47, my = H * 0.62, dx = W * 0.058;
  x.fillStyle = 'rgba(255,120,130,0.45)';
  for (const s of [-1, 1]) { x.beginPath(); x.ellipse(cx + s * dx * 1.55, my - 6, 14, 9, 0, 0, PI * 2); x.fill(); }
  x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#2a1a14'; x.fillStyle = '#2a1a14';
  const eye = (ex, sz = 1) => {
    x.fillStyle = '#2a1a14'; x.beginPath(); x.ellipse(ex, ey, 7.5 * sz, 10.5 * sz, 0, 0, PI * 2); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(ex + 2.5 * sz, ey - 3.5 * sz, 2.8 * sz, 0, PI * 2); x.fill();
  };
  const brow = (ex, tilt, lift = 0) => { x.lineWidth = o.thickBrow ? 5 : 3.5; x.beginPath(); x.moveTo(ex - 9, ey - 18 - lift + tilt); x.lineTo(ex + 9, ey - 18 - lift - tilt); x.stroke(); };
  const L = cx - dx, R = cx + dx;
  x.lineWidth = 5;
  switch (expr) {
    case 'blink': for (const e of [L, R]) { x.beginPath(); x.moveTo(e - 8, ey + 1); x.quadraticCurveTo(e, ey + 5, e + 8, ey + 1); x.stroke(); } break;
    case 'happy': case 'giggle': for (const e of [L, R]) { x.beginPath(); x.moveTo(e - 9, ey + 3); x.quadraticCurveTo(e, ey - 10, e + 9, ey + 3); x.stroke(); } break;
    case 'wow': eye(L, 1.3); eye(R, 1.3); brow(L, 0, 6); brow(R, 0, 6); break;
    case 'are': eye(L, 1.05); eye(R, 0.85); brow(L, -2, 4); brow(R, 3, -2);
      x.fillStyle = '#7fc8ff'; x.beginPath(); x.moveTo(R + 26, ey - 26); x.quadraticCurveTo(R + 34, ey - 10, R + 26, ey - 8); x.quadraticCurveTo(R + 18, ey - 10, R + 26, ey - 26); x.fill(); break;
    case 'sad': eye(L); eye(R); brow(L, 4); brow(R, -4); break;
    case 'determined': eye(L); eye(R); brow(L, -4, -2); brow(R, 4, -2); break;
    case 'dizzy': for (const e of [L, R]) { x.lineWidth = 3; x.beginPath(); for (let a = 0; a < 12; a += 0.3) { const r = a * 0.9; x.lineTo(e + Math.cos(a) * r, ey + Math.sin(a) * r); } x.stroke(); } break;
    default: eye(L); eye(R); if (o.thickBrow) { brow(L, 0); brow(R, 0); }
  }
  x.lineWidth = 4; x.strokeStyle = '#7a2a22';
  switch (expr) {
    case 'happy': case 'giggle': case 'wow-open':
      x.fillStyle = '#8a2a2a'; x.beginPath(); x.moveTo(cx - 16, my - 4); x.quadraticCurveTo(cx, my + 22, cx + 16, my - 4); x.closePath(); x.fill();
      x.fillStyle = '#ff8c8c'; x.beginPath(); x.ellipse(cx, my + 6, 7, 4, 0, 0, PI * 2); x.fill(); break;
    case 'wow': x.fillStyle = '#8a2a2a'; x.beginPath(); x.ellipse(cx, my + 2, 7, 9, 0, 0, PI * 2); x.fill(); break;
    case 'are': x.beginPath(); x.moveTo(cx - 9, my + 2); x.quadraticCurveTo(cx - 4, my - 3, cx, my + 2); x.quadraticCurveTo(cx + 4, my + 6, cx + 9, my); x.stroke(); break;
    case 'sad': x.beginPath(); x.moveTo(cx - 10, my + 6); x.quadraticCurveTo(cx, my - 4, cx + 10, my + 6); x.stroke(); break;
    case 'dizzy': x.beginPath(); for (let i = 0; i <= 6; i++) x.lineTo(cx - 12 + i * 4, my + (i % 2 ? 4 : -2)); x.stroke(); break;
    case 'determined': x.beginPath(); x.moveTo(cx - 10, my); x.quadraticCurveTo(cx, my + 5, cx + 10, my); x.stroke(); break;
    default: x.beginPath(); x.moveTo(cx - 11, my - 1); x.quadraticCurveTo(cx, my + 10, cx + 11, my - 1); x.stroke();
  }
  if (o.nose) { x.fillStyle = 'rgba(180,100,80,0.5)'; x.beginPath(); x.ellipse(cx, (ey + my) / 2 + 3, 4, 3, 0, 0, PI * 2); x.fill(); }
}

export function makePerson(o) {
  const g = new THREE.Group();
  const skin = matte(o.skin, 0.6), hair = matte(o.hair, 0.55), top = matte(o.top, 0.8), pants = matte(o.pants, 0.85), shoe = matte(o.shoe || 0x5a3a2a, 0.6);
  const legL = o.legLen, torsoY = legL + 0.55;
  const body = new THREE.Group(); g.add(body);
  for (const s of [-1, 1]) {
    const leg = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.17, legL, 6, 12), pants)); leg.position.set(s * 0.19, legL / 2 + 0.17, 0); body.add(leg);
    rbox(0.3, 0.16, 0.44, shoe, s * 0.19, 0.08, 0.06, 0.06, body);
  }
  const torso = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.38, o.torsoLen, 8, 18), top)); torso.position.y = torsoY + o.torsoLen / 2; body.add(torso);
  const overall = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.395, o.torsoLen * 0.55, 8, 18), pants)); overall.position.y = torsoY + o.torsoLen * 0.2; body.add(overall);
  if (o.bib) { rbox(0.42, 0.34, 0.1, pants, 0, torsoY + o.torsoLen * 0.62, 0.33, 0.04, body); for (const s of [-1, 1]) { const st = box(0.08, 0.5, 0.06, pants, s * 0.2, torsoY + o.torsoLen * 0.85, 0.3, body); st.rotation.x = -0.15; } }
  const neckY = torsoY + o.torsoLen + 0.38;
  const headG = new THREE.Group(); headG.position.y = neckY + 0.45; body.add(headG);
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const head = sh(new THREE.Mesh(new THREE.SphereGeometry(0.5, 40, 28), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })));
  headG.add(head);
  for (const s of [-1, 1]) sphere(0.09, skin, s * 0.49, -0.02, 0, headG, 12); // 耳
  const hairCap = sh(new THREE.Mesh(new THREE.SphereGeometry(0.535, 32, 20, 0, PI * 2, 0, PI * 0.62), hair));
  hairCap.rotation.x = -0.55; hairCap.position.set(0, 0.03, -0.05); headG.add(hairCap);
  const bang = sh(new THREE.Mesh(new THREE.SphereGeometry(0.52, 28, 12, PI * 0.15, PI * 0.7, 0, PI * 0.28), hair)); bang.position.y = 0.02; headG.add(bang);
  if (o.pigtails) for (const s of [-1, 1]) {
    const p = sphere(0.2, hair, s * 0.56, -0.12, -0.12, headG, 18); p.scale.set(0.8, 1.25, 0.8);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 8, 16), matte(0xff5d8f, 0.4)); tie.position.set(s * 0.5, 0.05, -0.1); tie.rotation.y = PI / 2; headG.add(tie);
  }
  const arms = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * 0.47, torsoY + o.torsoLen + 0.12, 0); body.add(a);
    const up = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.12, o.armLen, 6, 10), top)); up.position.y = -o.armLen / 2 - 0.05; a.add(up);
    const hand = sphere(0.14, skin, 0, -o.armLen - 0.18, 0, a, 14);
    a.rotation.z = s * 0.18; a.userData.hand = hand;
    arms.push(a);
  }
  const P = { g, body, headG, head, arms, cv, tex, o, expr: 'normal', hold: 0, blinkT: 2 + Math.random() * 3, mats: { top, pants }, hatSlot: new THREE.Group() };
  P.hatSlot.position.y = 0.32; headG.add(P.hatSlot);
  P.set = (e, hold = 1.6) => { P.expr = e; P.hold = hold; drawFace(cv, e, o); tex.needsUpdate = true; };
  P.tick = (dt) => {
    if (P.hold > 0) { P.hold -= dt; if (P.hold <= 0 && P.expr !== 'normal') { P.expr = 'normal'; drawFace(cv, 'normal', o); tex.needsUpdate = true; } }
    if (P.expr === 'normal') {
      P.blinkT -= dt;
      if (P.blinkT < 0) { drawFace(cv, 'blink', o); tex.needsUpdate = true; if (P.blinkT < -0.13) { P.blinkT = 2 + Math.random() * 3.5; drawFace(cv, 'normal', o); tex.needsUpdate = true; } }
    }
  };
  P.set('normal', 0);
  return P;
}

export function makeHat(kind) {
  const g = new THREE.Group();
  if (kind === 'cap') { // 整備士の帽子
    const m = matte(0x2f6fd8, 0.7);
    const d = sh(new THREE.Mesh(new THREE.SphereGeometry(0.56, 32, 16, 0, PI * 2, 0, PI / 2), m)); d.scale.y = 0.75; g.add(d);
    const b = cyl(0.36, 0.36, 0.04, m, 0, 0.02, 0.5, g, 24); b.scale.z = 0.7;
    sphere(0.06, m, 0, 0.42, 0, g, 10);
    const patch = cyl(0.13, 0.13, 0.02, matte(0xffd23a, 0.5), 0, 0.22, 0.5, g, 5); patch.rotation.x = PI / 2 - 0.5;
  } else if (kind === 'helmet') { // 工事のヘルメット
    const m = paint(0xffc81e, 0.3);
    const d = sh(new THREE.Mesh(new THREE.SphereGeometry(0.58, 32, 16, 0, PI * 2, 0, PI / 2), m)); d.scale.y = 0.85; g.add(d);
    const b = cyl(0.7, 0.72, 0.05, m, 0, 0.0, 0.05, g, 32);
    rbox(0.14, 0.12, 1.0, m, 0, 0.48, 0, 0.05, g).scale.set(1, 1, 1);
  } else { // 運転手の帽子
    const m = matte(0x1f2b4a, 0.6);
    cyl(0.6, 0.5, 0.36, m, 0, 0.16, 0, g, 32);
    cyl(0.505, 0.505, 0.1, matte(0xe8b923, 0.3), 0, 0.06, 0, g, 32);
    const v = cyl(0.34, 0.34, 0.04, matte(0x111111, 0.2), 0, -0.02, 0.45, g, 24); v.scale.z = 0.6; v.rotation.x = 0.2;
    const em = cyl(0.08, 0.08, 0.03, paint(0xe8b923), 0, 0.22, 0.56, g, 5); em.rotation.x = PI / 2 - 0.15;
  }
  return g;
}

function starShape(r1 = 1, r2 = 0.45) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? r2 : r1, a = PI / 2 + i * PI / 5; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  s.closePath(); return s;
}
export function makeStar(r = 0.5, color = 0xffd23a, depth = 0.15) {
  const geo = new THREE.ExtrudeGeometry(starShape(r, r * 0.45), { depth, bevelEnabled: true, bevelSize: r * 0.08, bevelThickness: r * 0.08, bevelSegments: 2 });
  geo.center();
  return sh(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.4 })));
}
export function makeWand() {
  const g = new THREE.Group();
  cyl(0.035, 0.035, 0.9, matte(0xff6fa8, 0.4), 0, 0.45, 0, g, 10);
  const s = makeStar(0.2, 0xffd23a, 0.06); s.position.y = 0.98; g.add(s);
  return g;
}
export function makeHammer() {
  const g = new THREE.Group();
  cyl(0.05, 0.05, 0.9, matte(0xb07a45, 0.6), 0, 0.45, 0, g, 10);
  rbox(0.4, 0.16, 0.16, mats.chrome, 0, 0.92, 0, 0.03, g);
  return g;
}

// ---------- 小物 ----------
export function makeBag() {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x3f6f4a, roughness: 0.35, clearcoat: 0.6 });
  const geo = new THREE.SphereGeometry(0.38, 24, 16);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = 1 + 0.06 * Math.sin(p.getX(i) * 17) * Math.cos(p.getZ(i) * 13) - (y > 0 ? y * 0.35 : 0); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
  geo.computeVertexNormals();
  const b = sh(new THREE.Mesh(geo, mat)); b.position.y = 0.38; b.scale.y = 1.05; g.add(b);
  sphere(0.07, mat, 0, 0.8, 0, g, 10);
  for (const s of [-1, 1]) { const e = cyl(0.01, 0.06, 0.2, mat, s * 0.07, 0.88, 0, g, 8); e.rotation.z = -s * 0.7; }
  return g;
}
export function makeBall() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const x = c.getContext('2d'); const cols = ['#ff4b4b', '#ffd23a', '#3aa0ff', '#ffffff', '#4bd36b', '#ffffff'];
  cols.forEach((cl, i) => { x.fillStyle = cl; x.fillRect(i * 256 / 6, 0, 256 / 6 + 1, 128); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = sh(new THREE.Mesh(new THREE.SphereGeometry(0.3, 28, 18), new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.25, clearcoat: 1 })));
  return m;
}

// 恐竜（首の長いやさしい恐竜）
function chain(g, pts, r0, r1, mat) {
  const n = pts.length; const ms = [];
  for (let i = 0; i < n; i++) { const k = i / (n - 1); ms.push(sphere(r0 + (r1 - r0) * k, mat, pts[i].x, pts[i].y, pts[i].z || 0, g, 20)); }
  return ms;
}
function curvePts(a, b, c, n) { const q = new THREE.QuadraticBezierCurve3(a, b, c); return q.getPoints(n - 1); }
function cuteEyes(parent, x, y, z, r, spread) {
  const w = matte(0xffffff, 0.3), k = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.15 });
  for (const s of [-1, 1]) {
    sphere(r, w, x, y, z + s * spread, parent, 16);
    sphere(r * 0.62, k, x + r * 0.55, y + r * 0.1, z + s * (spread + r * 0.25), parent, 14);
    sphere(r * 0.2, w, x + r * 0.95, y + r * 0.35, z + s * (spread + r * 0.35), parent, 8);
  }
}
export function makeDino() {
  const g = new THREE.Group(); g.userData.length = 7.6;
  const skin = new THREE.MeshPhysicalMaterial({ color: 0x86c96a, roughness: 0.45, clearcoat: 0.5 });
  const belly = matte(0xe8f2a6, 0.6), spot = matte(0x5ea64a, 0.5);
  const bodyM = sphere(1, skin, 0, 2.5, 0, g, 32); bodyM.scale.set(1.7, 1.15, 1.05);
  const bel = sphere(1, belly, 0.1, 2.2, 0, g, 28); bel.scale.set(1.5, 0.95, 0.95);
  for (const [x, y, z, r] of [[-0.4, 3.4, 0.5, 0.28], [0.5, 3.45, -0.4, 0.24], [-0.9, 3.0, -0.75, 0.22], [0.9, 3.0, 0.75, 0.2], [0, 3.6, 0, 0.22]]) { const s = sphere(r, spot, x, y, z, g, 12); s.scale.y = 0.5; }
  for (const [x, z] of [[0.9, 0.55], [0.9, -0.55], [-0.9, 0.55], [-0.9, -0.55]]) {
    cyl(0.38, 0.42, 1.8, skin, x, 0.9, z, g, 18);
    const f = sphere(0.45, skin, x + 0.08, 0.15, z, g, 16); f.scale.set(1.1, 0.4, 1);
  }
  const neck = new THREE.Group(); neck.position.set(1.4, 3.0, 0); g.add(neck);
  chain(neck, curvePts(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.0, 1.0, 0), new THREE.Vector3(1.3, 2.4, 0), 12), 0.62, 0.36, skin);
  const head = new THREE.Group(); head.position.set(1.4, 2.6, 0); neck.add(head);
  const hm = sphere(0.55, skin, 0.15, 0, 0, head, 24); hm.scale.set(1.35, 0.9, 0.95);
  cuteEyes(head, 0.25, 0.22, 0, 0.17, 0.32);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 8, 20, PI * 0.8), matte(0x2a3a20, 0.5)); smile.position.set(0.8, -0.12, 0); smile.rotation.set(0, PI / 2, PI + PI * 0.1); head.add(smile);
  for (const s of [-1, 1]) { const ch = sphere(0.1, matte(0xff9aa8, 0.6), 0.55, -0.12, s * 0.42, head, 10); ch.scale.set(0.6, 0.6, 0.3); }
  const tail = new THREE.Group(); tail.position.set(-1.5, 2.6, 0); g.add(tail);
  chain(tail, curvePts(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-1.6, -0.2, 0), new THREE.Vector3(-3.2, -1.6, 0), 14), 0.7, 0.14, skin);
  g.userData.neck = neck; g.userData.head = head; g.userData.tail = tail;
  // 原点を「しっぽの先」に合わせる（巻き尺の始まり）
  const inner = new THREE.Group(); inner.add(...g.children.slice()); inner.position.x = 4.7; g.add(inner);
  return g;
}
export function makeCroc() {
  const g = new THREE.Group(); g.userData.length = 4.8;
  const skin = new THREE.MeshPhysicalMaterial({ color: 0x5e9e3e, roughness: 0.5, clearcoat: 0.4 });
  const belly = matte(0xd9e59a, 0.6), bump = matte(0x4a8a30, 0.6);
  const inner = new THREE.Group(); g.add(inner);
  const b = sphere(1, skin, 0, 0.6, 0, inner, 28); b.scale.set(1.25, 0.45, 0.62);
  const bb = sphere(1, belly, 0, 0.5, 0, inner, 24); bb.scale.set(1.15, 0.36, 0.56);
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) sphere(0.09, bump, -1.1 + i * 0.42, 0.95, s * 0.22, inner, 8);
  const tail = new THREE.Group(); tail.position.set(-1.1, 0.6, 0); inner.add(tail);
  const tp = chain(tail, curvePts(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.8, -0.05, 0), new THREE.Vector3(-1.9, -0.3, 0), 10), 0.42, 0.1, skin);
  tp.forEach(m => m.scale.y = 0.7);
  for (const [x, z] of [[0.7, 0.6], [0.7, -0.6], [-0.6, 0.6], [-0.6, -0.6]]) { const l = rbox(0.3, 0.45, 0.25, skin, x, 0.22, z * 1.05, 0.1, inner); l.rotation.x = z > 0 ? -0.4 : 0.4; }
  const headG = new THREE.Group(); headG.position.set(1.15, 0.62, 0); inner.add(headG);
  const upper = new THREE.Group(); headG.add(upper);
  const u = rbox(1.6, 0.34, 0.78, skin, 0.75, 0.1, 0, 0.16, upper);
  const snout = sphere(0.28, skin, 1.5, 0.12, 0, upper, 16); snout.scale.set(1, 0.6, 1.3);
  for (const s of [-1, 1]) sphere(0.05, matte(0x223322, 0.5), 1.62, 0.25, s * 0.13, upper, 8);
  for (const s of [-1, 1]) { const bm = sphere(0.2, skin, 0.25, 0.35, s * 0.24, upper, 14); }
  cuteEyes(upper, 0.28, 0.45, 0, 0.13, 0.24);
  const lower = new THREE.Group(); headG.add(lower);
  rbox(1.55, 0.2, 0.72, belly, 0.75, -0.12, 0, 0.09, lower);
  const mouthIn = rbox(1.4, 0.06, 0.6, matte(0xe36d7d, 0.6), 0.75, -0.02, 0, 0.03, lower);
  g.userData.jaw = lower; g.userData.headG = headG; g.userData.tail = tail;
  inner.position.x = 3.0;
  return g;
}

export function makeTapeMeasure() {
  const g = new THREE.Group();
  const caseG = new THREE.Group(); g.add(caseG);
  rbox(0.55, 0.55, 0.22, paint(0xffc81e, 0.35), 0, 0.3, 0, 0.12, caseG);
  for (const s of [-1, 1]) { const c = cyl(0.17, 0.17, 0.03, matte(0x222222, 0.5), 0, 0.3, s * 0.115, caseG, 24); c.rotation.x = PI / 2; }
  box(0.14, 0.1, 0.24, matte(0x222222, 0.5), -0.05, 0.6, 0, caseG);
  // 目盛り（数字なしの線だけ）
  const c = document.createElement('canvas'); c.width = 256; c.height = 32;
  const x = c.getContext('2d'); x.fillStyle = '#ffd21e'; x.fillRect(0, 0, 256, 32); x.fillStyle = '#222';
  for (let i = 0; i < 20; i++) { const h = i % 10 === 0 ? 22 : i % 5 === 0 ? 15 : 9; x.fillRect(i * 12.8, 0, 2, h); }
  x.fillStyle = '#e02828'; x.fillRect(0, 0, 4, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
  const tapeMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, metalness: 0.3 });
  const tape = new THREE.Mesh(new THREE.BoxGeometry(1, 0.012, 0.3), tapeMat); tape.receiveShadow = true;
  tape.geometry.translate(0.5, 0, 0);
  tape.position.set(0.28, 0.02, 0); g.add(tape);
  const tip = box(0.06, 0.16, 0.34, mats.chrome, 0.28, 0.08, 0, g);
  g.userData = { tape, tip, tex: t, caseG, len: 0 };
  g.userData.setLen = (L) => { g.userData.len = L; tape.scale.x = Math.max(0.001, L); t.repeat.x = L; tip.position.x = 0.28 + L; };
  g.userData.setLen(0);
  return g;
}

export function footprintTex() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const x = c.getContext('2d'); x.fillStyle = 'rgba(70,50,35,0.85)';
  x.beginPath(); x.ellipse(64, 80, 26, 30, 0, 0, PI * 2); x.fill();
  for (const a of [-0.55, 0, 0.55]) { x.save(); x.translate(64, 62); x.rotate(a); x.beginPath(); x.ellipse(0, -36, 11, 24, 0, 0, PI * 2); x.fill(); x.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ルールの絵看板：小さい車 + 杖 → 大きい車
export function signTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 384;
  const x = c.getContext('2d');
  x.fillStyle = '#fffaf0'; x.fillRect(0, 0, 512, 384);
  x.strokeStyle = '#c98a4a'; x.lineWidth = 16; x.strokeRect(8, 8, 496, 368);
  const car = (cx, cy, s, col) => {
    x.save(); x.translate(cx, cy); x.scale(s, s);
    x.fillStyle = col; x.beginPath(); x.roundRect(-60, -40, 120, 50, 10); x.fill(); x.beginPath(); x.roundRect(10, -70, 50, 40, 8); x.fill();
    x.fillStyle = '#9fd3ff'; x.fillRect(22, -62, 30, 22);
    x.fillStyle = '#222'; for (const wx of [-35, 35]) { x.beginPath(); x.arc(wx, 12, 16, 0, PI * 2); x.fill(); }
    x.fillStyle = '#ccc'; for (const wx of [-35, 35]) { x.beginPath(); x.arc(wx, 12, 6, 0, PI * 2); x.fill(); }
    x.restore();
  };
  const star = (cx, cy, r, col) => { x.fillStyle = col; x.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r, a = -PI / 2 + i * PI / 5; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.fill(); };
  car(95, 270, 0.55, '#f5b416');
  x.strokeStyle = '#ff6fa8'; x.lineWidth = 10; x.lineCap = 'round'; x.beginPath(); x.moveTo(60, 150); x.lineTo(110, 215); x.stroke();
  star(55, 140, 26, '#ffcc22');
  for (const [sx, sy] of [[140, 200], [150, 150], [40, 210]]) star(sx, sy, 9, '#ffb3d1');
  x.fillStyle = '#ff8a3d'; x.beginPath(); x.moveTo(190, 230); x.lineTo(250, 230); x.lineTo(250, 205); x.lineTo(295, 250); x.lineTo(250, 295); x.lineTo(250, 270); x.lineTo(190, 270); x.fill();
  car(400, 250, 1.35, '#f5b416');
  for (const [sx, sy] of [[330, 110], [470, 90], [400, 70]]) star(sx, sy, 14, '#ffcc22');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
