import * as THREE from 'three';
import { RoomEnvironment } from '../lib/RoomEnvironment.js';
import { clock, tween, lerp, clamp, rand, canvasTex, noiseTex, woodFloorTex, woodTex, roundedBox, symbolTex, star } from './util.js';

export const V3 = THREE.Vector3;

// ---------------- renderer / scene ----------------
export const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
document.getElementById('app').appendChild(renderer.domElement);

export const scene = new THREE.Scene();
scene.background = new THREE.Color('#efe4d2');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.38;

export const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 80);
const hemi = new THREE.HemisphereLight('#fff4e2', '#8a6a4a', 0.5);
scene.add(hemi);
export const sun = new THREE.DirectionalLight('#ffeacc', 2.7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 30 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.025;
sun.shadow.radius = 3;
scene.add(sun, sun.target);
export function lightAt(base) {
  sun.position.copy(base).add(new V3(-5, 7.5, 5));
  sun.target.position.copy(base).add(new V3(0, 0, -0.5));
}

// ---------------- camera shots ----------------
export const cam = { pos: new V3(0, 1.1, 3.6), tgt: new V3(0, 0.7, 0), hw: 1.2, hh: 0.8, sway: 1 };
export function shot(pos, tgt, hw, hh, dur = 1.6) {
  const p0 = cam.pos.clone(), t0 = cam.tgt.clone(), hw0 = cam.hw, hh0 = cam.hh;
  if (dur <= 0) { cam.pos.copy(pos); cam.tgt.copy(tgt); cam.hw = hw; cam.hh = hh; return Promise.resolve(); }
  return tween(dur, k => {
    cam.pos.lerpVectors(p0, pos, k); cam.tgt.lerpVectors(t0, tgt, k);
    cam.hw = lerp(hw0, hw, k); cam.hh = lerp(hh0, hh, k);
  });
}
const tmpDir = new V3();
export function updateCamera() {
  const a = innerWidth / innerHeight;
  camera.aspect = a;
  tmpDir.subVectors(cam.pos, cam.tgt);
  let dist = tmpDir.length();
  tmpDir.normalize();
  const need = Math.max(cam.hh, cam.hw / a);
  let fov = 2 * Math.atan(need / dist);
  const maxF = THREE.MathUtils.degToRad(68);
  if (fov > maxF) { fov = maxF; dist = need / Math.tan(fov / 2); }
  const t = clock.time;
  camera.position.copy(cam.tgt).addScaledVector(tmpDir, dist);
  camera.position.x += Math.sin(t * 0.37) * 0.015 * cam.sway;
  camera.position.y += Math.sin(t * 0.51) * 0.01 * cam.sway;
  camera.lookAt(cam.tgt);
  camera.fov = THREE.MathUtils.radToDeg(fov);
  camera.updateProjectionMatrix();
}

export function resize() {
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);

// ---------------- fade ----------------
const fadeEl = document.getElementById('fade');
export function fade(to, dur = 0.6, color = '#ffffff') {
  fadeEl.style.background = color;
  const from = parseFloat(fadeEl.style.opacity || '1');
  return tween(dur, k => { fadeEl.style.opacity = String(lerp(from, to, k)); });
}

// ---------------- materials ----------------
export function stdMat(color, rough = 0.6, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra }); }
export function mesh(geo, mat, cast = true, recv = true) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; return m;
}
export const woodMat = new THREE.MeshStandardMaterial({ map: woodTex(34, 70, [1, 1]), roughness: 0.55 });
export const whitePaint = stdMat('#fbf7f0', 0.5);

// ---------------- room shell ----------------
export function makeRoom({ w, back, front, h = 3, wall = '#f4ebdb' }) {
  const g = new THREE.Group();
  const d = front - back, cz = (front + back) / 2;
  const ft = woodFloorTex(); ft.repeat.set(w / 3.2, d / 3.2);
  const floorMat = new THREE.MeshStandardMaterial({ map: ft, roughness: 0.42, metalness: 0 });
  const floor = mesh(new THREE.PlaneGeometry(w, d), floorMat, false, true);
  floor.rotation.x = -Math.PI / 2; floor.position.z = cz; g.add(floor);
  const wallTex = noiseTex('#ffffff', 9, 256, [5, 2]);
  const wallMat = new THREE.MeshPhysicalMaterial({ color: wall, map: wallTex, roughness: 0.92, clearcoat: 0, clearcoatRoughness: 0.08 });
  const backW = mesh(new THREE.PlaneGeometry(w, h), wallMat, false, true); backW.position.set(0, h / 2, back); g.add(backW);
  const left = mesh(new THREE.PlaneGeometry(d, h), wallMat, false, true); left.rotation.y = Math.PI / 2; left.position.set(-w / 2, h / 2, cz); g.add(left);
  const right = mesh(new THREE.PlaneGeometry(d, h), wallMat, false, true); right.rotation.y = -Math.PI / 2; right.position.set(w / 2, h / 2, cz); g.add(right);
  const ceil = mesh(new THREE.PlaneGeometry(w, d), stdMat('#fffaf2', 0.9, { emissive: '#e9e1d4', emissiveIntensity: 0.75 }), false, false); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, h, cz); g.add(ceil);
  // wainscot panels + rail
  const wm = new THREE.MeshStandardMaterial({ map: woodTex(30, 72, [3, 1]), roughness: 0.5 });
  const ph = 0.85;
  const bp = mesh(new THREE.BoxGeometry(w, ph, 0.025), wm, false, true); bp.position.set(0, ph / 2, back + 0.0125); g.add(bp);
  [-1, 1].forEach(s => {
    const sp = mesh(new THREE.BoxGeometry(0.025, ph, d), wm, false, true); sp.position.set(s * (w / 2 - 0.0125), ph / 2, cz); g.add(sp);
    const sr = mesh(new THREE.BoxGeometry(0.05, 0.04, d), wm, false, true); sr.position.set(s * (w / 2 - 0.025), ph + 0.02, cz); g.add(sr);
  });
  const rail = mesh(new THREE.BoxGeometry(w, 0.04, 0.05), wm, false, true); rail.position.set(0, ph + 0.02, back + 0.025); g.add(rail);
  return { group: g, wallMat, wallTex, floorMat, backW, left, right, panelMat: wm, w, back, front, h };
}

export function skyTex() {
  return canvasTex(256, 256, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#9fd4ff'); gr.addColorStop(0.65, '#e8f6ff'); gr.addColorStop(0.66, '#a9d98a'); gr.addColorStop(1, '#7cc265');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    [[60, 50], [180, 80]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 18, 0, 7); c.arc(x + 20, y - 8, 22, 0, 7); c.arc(x + 42, y, 16, 0, 7); c.fill(); });
    c.fillStyle = '#5aa84a';
    for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(20 + i * 45, 170, 26, 0, 7); c.fill(); }
  });
}
export function makeWindow(w = 1.2, h = 1.1) {
  const g = new THREE.Group();
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: skyTex(), toneMapped: false }));
  pane.material.color.setScalar(1.05);
  g.add(pane);
  const fm = stdMat('#ffffff', 0.4);
  const t = 0.06;
  [[w + t, t, 0, h / 2], [w + t, t, 0, -h / 2], [t, h, -w / 2, 0], [t, h, w / 2, 0], [t * 0.6, h, 0, 0], [w, t * 0.6, 0, 0.05]].forEach(([bw, bh, x, y]) => {
    const b = mesh(new THREE.BoxGeometry(bw, bh, 0.06), fm, false, true); b.position.set(x, y, 0.03); g.add(b);
  });
  const sill = mesh(new THREE.BoxGeometry(w + 0.2, 0.04, 0.16), fm, true, true); sill.position.set(0, -h / 2 - 0.04, 0.08); g.add(sill);
  return g;
}
export function makeDoor() {
  const g = new THREE.Group();
  const fm = stdMat('#ffffff', 0.45);
  [[0.08, 2.1, -0.5, 1.05], [0.08, 2.1, 0.5, 1.05], [1.08, 0.08, 0, 2.1]].forEach(([bw, bh, x, y]) => {
    const b = mesh(new THREE.BoxGeometry(bw, bh, 0.08), fm, false, true); b.position.set(x, y, 0.04); g.add(b);
  });
  const hinge = new THREE.Group(); hinge.position.set(-0.46, 0, 0.03); g.add(hinge);
  const panel = mesh(new THREE.BoxGeometry(0.92, 2.04, 0.04), new THREE.MeshStandardMaterial({ map: woodTex(28, 58, [1, 2]), roughness: 0.5 }), true, true);
  panel.position.set(0.46, 1.02, 0); hinge.add(panel);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.6), new THREE.MeshBasicMaterial({ map: skyTex(), toneMapped: false }));
  glass.position.set(0.46, 1.45, 0.021); hinge.add(glass);
  const knob = mesh(new THREE.SphereGeometry(0.035, 16, 12), stdMat('#d8b04a', 0.25, { metalness: 0.8 }));
  knob.position.set(0.82, 0.95, 0.04); hinge.add(knob);
  g.userData.hinge = hinge;
  return g;
}

// child-like drawings for the walls (pictures only)
export function drawingTex(kind) {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#fffdf6'; c.fillRect(0, 0, w, h);
    c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 9;
    if (kind === 'sun') {
      c.strokeStyle = '#ffb300'; c.fillStyle = '#ffd54a';
      c.beginPath(); c.arc(128, 120, 50, 0, 7); c.fill(); c.stroke();
      for (let i = 0; i < 10; i++) { const a = i / 10 * 7; c.beginPath(); c.moveTo(128 + Math.cos(a) * 66, 120 + Math.sin(a) * 66); c.lineTo(128 + Math.cos(a) * 95, 120 + Math.sin(a) * 95); c.stroke(); }
      c.strokeStyle = '#333'; c.lineWidth = 6; c.beginPath(); c.arc(110, 112, 4, 0, 7); c.arc(146, 112, 4, 0, 7); c.stroke();
      c.beginPath(); c.arc(128, 128, 20, 0.3, 2.8); c.stroke();
    } else if (kind === 'house') {
      c.fillStyle = '#ff8a65'; c.fillRect(60, 120, 136, 100);
      c.fillStyle = '#7e57c2'; c.beginPath(); c.moveTo(45, 125); c.lineTo(128, 50); c.lineTo(211, 125); c.fill();
      c.fillStyle = '#4fc3f7'; c.fillRect(80, 145, 36, 32); c.fillStyle = '#8d6e63'; c.fillRect(140, 160, 34, 60);
      c.fillStyle = '#66bb6a'; c.fillRect(0, 220, 256, 36);
    } else if (kind === 'flower') {
      c.strokeStyle = '#43a047'; c.beginPath(); c.moveTo(128, 230); c.quadraticCurveTo(110, 170, 128, 120); c.stroke();
      c.fillStyle = '#ec407a'; for (let i = 0; i < 6; i++) { const a = i / 6 * 7; c.beginPath(); c.arc(128 + Math.cos(a) * 34, 95 + Math.sin(a) * 34, 26, 0, 7); c.fill(); }
      c.fillStyle = '#ffee58'; c.beginPath(); c.arc(128, 95, 24, 0, 7); c.fill();
    } else if (kind === 'rainbow') {
      ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'].forEach((col, i) => { c.strokeStyle = col; c.lineWidth = 14; c.beginPath(); c.arc(128, 200, 110 - i * 14, Math.PI, 0); c.stroke(); });
    } else if (kind === 'fish') {
      c.fillStyle = '#b3e5fc'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ff7043'; c.beginPath(); c.ellipse(120, 128, 70, 42, 0, 0, 7); c.fill();
      c.beginPath(); c.moveTo(180, 128); c.lineTo(235, 90); c.lineTo(235, 166); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(85, 118, 12, 0, 7); c.fill(); c.fillStyle = '#222'; c.beginPath(); c.arc(85, 118, 6, 0, 7); c.fill();
    } else if (kind === 'family') {
      const fig = (x, col, s) => { c.fillStyle = '#ffcc99'; c.beginPath(); c.arc(x, 110 - s * 20, 22 * s, 0, 7); c.fill(); c.fillStyle = col; c.beginPath(); c.moveTo(x, 130 - s * 20); c.lineTo(x - 30 * s, 220); c.lineTo(x + 30 * s, 220); c.fill(); };
      fig(70, '#42a5f5', 1.2); fig(186, '#ef5350', 1.15); fig(128, '#ffca28', 0.85);
    }
  });
}
export function framedPicture(kind, w = 0.5, h = 0.5) {
  const g = new THREE.Group();
  const pic = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: drawingTex(kind), roughness: 0.9 }), false, true);
  pic.position.z = 0.012; g.add(pic);
  const fr = mesh(new THREE.BoxGeometry(w + 0.06, h + 0.06, 0.02), woodMat, true, true); g.add(fr);
  return g;
}

// ---------------- kindergarten hat & bag ----------------
export function makeHat() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: noiseTex('#ffd02a', 22, 128, [6, 6]), roughness: 0.85, side: THREE.DoubleSide });
  const crown = mesh(new THREE.SphereGeometry(0.19, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), mat);
  crown.scale.y = 0.85; g.add(crown);
  const brim = mesh(new THREE.LatheGeometry([new THREE.Vector2(0.185, 0.0), new THREE.Vector2(0.23, -0.03), new THREE.Vector2(0.265, -0.065), new THREE.Vector2(0.26, -0.075), new THREE.Vector2(0.18, -0.01)], 40), mat);
  g.add(brim);
  const band = mesh(new THREE.CylinderGeometry(0.192, 0.192, 0.03, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#ff7f50', roughness: 0.7, side: THREE.DoubleSide }));
  band.position.y = 0.015; g.add(band);
  g.userData.kind = 'hat';
  return g;
}
export function makeBag(symbol) {
  const g = new THREE.Group();
  const body = mesh(roundedBox(0.22, 0.17, 0.075, 0.025, 2), new THREE.MeshStandardMaterial({ color: '#ffffff', map: noiseTex('#2f56a8', 18, 128, [3, 3]), roughness: 0.75 }));
  g.add(body);
  const flap = mesh(roundedBox(0.226, 0.09, 0.08, 0.025, 2), new THREE.MeshStandardMaterial({ color: '#ffffff', map: noiseTex('#ffcc33', 18, 128, [3, 3]), roughness: 0.75 }));
  flap.position.set(0, 0.045, 0.004); g.add(flap);
  const tag = new THREE.Mesh(new THREE.CircleGeometry(0.035, 24), new THREE.MeshStandardMaterial({ map: symbolTex(symbol), roughness: 0.6 }));
  tag.position.set(0, 0.03, 0.046); g.add(tag);
  const loop = mesh(new THREE.TorusGeometry(0.12, 0.009, 6, 24, Math.PI), new THREE.MeshStandardMaterial({ color: '#2f56a8', roughness: 0.7 }));
  loop.position.y = 0.08; g.add(loop);
  g.scale.setScalar(1.3);
  g.userData.kind = 'bag';
  g.userData.loop = loop;
  return g;
}
export function makeStrap() {
  const s = mesh(new THREE.TorusGeometry(0.17, 0.011, 6, 40), new THREE.MeshStandardMaterial({ color: '#2f56a8', roughness: 0.7 }));
  s.rotation.set(Math.PI / 2, 0.55, 0);
  s.scale.set(1, 0.9, 1);
  return s;
}

// ---------------- particles (sparkles / confetti / juice drops) ----------------
const PMAX = 700;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3), pSize = new Float32Array(PMAX);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
pGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
const spriteTex = canvasTex(64, 64, (c) => {
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
}, { srgb: false });
const pMat = new THREE.ShaderMaterial({
  uniforms: { map: { value: spriteTex }, scale: { value: 600 } },
  vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; uniform float scale;
    void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform sampler2D map; varying vec3 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); if(t.a<0.05) discard; gl_FragColor = vec4(vC, t.a); }`,
  transparent: true, depthWrite: false,
});
const points = new THREE.Points(pGeo, pMat);
points.frustumCulled = false;
scene.add(points);
const parts = [];
for (let i = 0; i < PMAX; i++) parts.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, s: 0, drag: 1 });
let pNext = 0;
const tmpC = new THREE.Color();
export function burst(pos, { n = 20, colors = ['#ffffff', '#ffe066'], speed = 1.5, up = 1, g = -3, size = 0.06, life = 1.0, spread = 1, drag = 0.98 } = {}) {
  for (let k = 0; k < n; k++) {
    const p = parts[pNext]; const i = pNext; pNext = (pNext + 1) % PMAX;
    p.life = p.max = life * rand(0.7, 1.2);
    p.x = pos.x; p.y = pos.y; p.z = pos.z;
    const a = Math.random() * Math.PI * 2, e = rand(-0.2, 1) * spread;
    const sp = speed * rand(0.4, 1);
    p.vx = Math.cos(a) * sp * (1 - Math.abs(e) * 0.3); p.vz = Math.sin(a) * sp * (1 - Math.abs(e) * 0.3); p.vy = up * sp * (0.6 + e);
    p.g = g; p.s = size * rand(0.7, 1.3); p.drag = drag;
    tmpC.set(colors[(Math.random() * colors.length) | 0]);
    pCol[i * 3] = tmpC.r; pCol[i * 3 + 1] = tmpC.g; pCol[i * 3 + 2] = tmpC.b;
  }
}
export function updateParticles(dt) {
  for (let i = 0; i < PMAX; i++) {
    const p = parts[i];
    if (p.life > 0) {
      p.life -= dt;
      p.vy += p.g * dt; p.vx *= p.drag; p.vz *= p.drag;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.01) { p.y = 0.01; p.vy *= -0.2; p.vx *= 0.5; p.vz *= 0.5; }
      pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
      pSize[i] = p.s * Math.min(1, p.life / (p.max * 0.4));
    } else pSize[i] = 0;
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.size.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;
  pMat.uniforms.scale.value = innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}
export const CONFETTI = ['#ff5c8a', '#ffd23f', '#3bceac', '#4d9de0', '#b388eb', '#ff9f1c'];

// ---------------- input ----------------
export const input = { active: null, last: 0, down: false, id: null, x: 0, y: 0, sx: 0, sy: 0, moved: 0, unlocked: false };
export const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
export function setRay(x, y) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray;
}
export function hits(objs) { return raycaster.intersectObjects(objs, true); }
export function rayPlane(normal, point, out = new V3()) {
  const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
  return raycaster.ray.intersectPlane(pl, out);
}
export function toScreen(v) {
  const p = v.clone().project(camera);
  return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight, behind: p.z > 1 };
}
export function isUnder(obj, root) { while (obj) { if (obj === root) return true; obj = obj.parent; } return false; }

const cv = renderer.domElement;
cv.addEventListener('pointerdown', e => {
  if (input.id !== null) return;
  input.id = e.pointerId; input.down = true;
  input.x = input.sx = e.clientX; input.y = input.sy = e.clientY; input.moved = 0; input.last = clock.time;
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  setRay(e.clientX, e.clientY);
  input.active?.down?.(e.clientX, e.clientY);
});
cv.addEventListener('pointermove', e => {
  if (e.pointerId !== input.id) return;
  input.moved += Math.hypot(e.clientX - input.x, e.clientY - input.y);
  input.x = e.clientX; input.y = e.clientY; input.last = clock.time;
  setRay(e.clientX, e.clientY);
  input.active?.move?.(e.clientX, e.clientY);
});
const endPtr = e => {
  if (e.pointerId !== input.id) return;
  input.id = null; input.down = false; input.last = clock.time;
  setRay(e.clientX, e.clientY);
  input.active?.up?.(e.clientX, e.clientY, input.moved < 14);
};
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', endPtr);
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

// ---------------- hint ----------------
const hintEl = document.getElementById('hint');
const hintDot = hintEl.querySelector('.dot');
let hintOn = false;
export function updateHint() {
  const a = input.active;
  let h = null;
  if (a && a.hint && !input.down && clock.time - input.last > 4.5) h = a.hint();
  if (!h) { if (hintOn) { hintEl.style.opacity = '0'; hintOn = false; } return; }
  const s = toScreen(h.from);
  let x = s.x, y = s.y;
  let dx = 0, dy = 0;
  if (h.to) {
    const e = toScreen(h.to);
    const k = ((clock.time * 0.6) % 1);
    const kk = Math.min(1, k * 1.4);
    dx = (e.x - s.x) * kk; dy = (e.y - s.y) * kk;
  } else if (h.circle) {
    const a2 = clock.time * 4;
    dx = Math.cos(a2) * 60; dy = Math.sin(a2) * 30;
  } else {
    dy = Math.abs(Math.sin(clock.time * 5)) * -14;
  }
  hintEl.style.transform = `translate(${x}px, ${y}px)`;
  hintDot.style.transform = `translate(${dx}px, ${dy}px)`;
  if (!hintOn) { hintEl.style.opacity = '1'; hintOn = true; }
}

// ---------------- helpers ----------------
// Move obj under newParent to local pos (with arc), keeping a smooth path.
export function flyTo(obj, newParent, pos, { dur = 0.6, arc = 0.25, quat = null, scale = null, e } = {}) {
  newParent.attach(obj);
  const p0 = obj.position.clone();
  const q0 = obj.quaternion.clone();
  const q1 = quat || new THREE.Quaternion();
  const s0 = obj.scale.clone();
  const s1 = scale || s0.clone();
  return tween(dur, k => {
    obj.position.lerpVectors(p0, pos, k);
    obj.position.y += Math.sin(k * Math.PI) * arc;
    obj.quaternion.slerpQuaternions(q0, q1, k);
    obj.scale.lerpVectors(s0, s1, k);
  }, e);
}
export function popIn(obj, dur = 0.45, to = 1) {
  obj.visible = true;
  const base = obj.userData.baseScale || (obj.userData.baseScale = obj.scale.x < 0.01 ? new V3(1, 1, 1) : obj.scale.clone());
  return tween(dur, k => { obj.scale.copy(base).multiplyScalar(Math.max(0.0001, k * to)); }, (k) => { const c = 1.70158 * 1.4, c3 = c + 1; return 1 + c3 * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); });
}
export function popOut(obj, dur = 0.3) {
  const s0 = obj.scale.clone();
  return tween(dur, k => { obj.scale.copy(s0).multiplyScalar(Math.max(0.0001, 1 - k)); }).then(() => { obj.visible = false; obj.scale.copy(s0); });
}

export function signTex() {
  return canvasTex(1024, 512, (c, w, h) => {
    c.fillStyle = '#fffaf0'; c.fillRect(0, 0, w, h);
    c.lineCap = 'round'; c.lineJoin = 'round';
    // three green fruits
    c.fillStyle = '#8fd14f'; c.beginPath(); c.arc(120, 200, 62, 0, 7); c.fill();
    c.fillStyle = '#6b3d1c'; c.fillRect(115, 120, 10, 30);
    c.fillStyle = '#3e9b2f'; c.beginPath(); c.ellipse(150, 130, 28, 12, -0.5, 0, 7); c.fill();
    c.fillStyle = '#8b6a3c'; c.beginPath(); c.arc(120, 350, 58, 0, 7); c.fill();
    c.fillStyle = '#7ccf3a'; c.beginPath(); c.arc(120, 350, 46, 0, 7); c.fill();
    c.fillStyle = '#f4ffe0'; c.beginPath(); c.arc(120, 350, 12, 0, 7); c.fill();
    c.fillStyle = '#222'; for (let i = 0; i < 10; i++) { const a = i / 10 * 7; c.beginPath(); c.arc(120 + Math.cos(a) * 26, 350 + Math.sin(a) * 26, 3.5, 0, 7); c.fill(); }
    c.fillStyle = '#b8e06a';
    [[230, 230], [262, 230], [246, 258], [214, 258], [278, 258], [230, 286], [262, 286], [246, 314]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 18, 0, 7); c.fill(); });
    // arrow
    const arrow = (x) => { c.strokeStyle = '#ff8a3d'; c.lineWidth = 20; c.beginPath(); c.moveTo(x, 256); c.lineTo(x + 80, 256); c.stroke(); c.fillStyle = '#ff8a3d'; c.beginPath(); c.moveTo(x + 110, 256); c.lineTo(x + 70, 220); c.lineTo(x + 70, 292); c.fill(); };
    arrow(330);
    // pitcher with green juice + swirl
    c.fillStyle = '#e8f6ff'; c.strokeStyle = '#7aaecf'; c.lineWidth = 10;
    c.beginPath(); c.moveTo(500, 130); c.lineTo(640, 130); c.lineTo(625, 400); c.lineTo(515, 400); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#5fd14a'; c.beginPath(); c.moveTo(508, 220); c.lineTo(632, 220); c.lineTo(625, 395); c.lineTo(515, 395); c.closePath(); c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = 8; c.beginPath(); c.ellipse(570, 300, 36, 18, 0, 0.5, 5.5); c.stroke();
    c.strokeStyle = '#7aaecf'; c.lineWidth = 10; c.beginPath(); c.arc(650, 260, 50, -1.2, 1.2); c.stroke();
    arrow(700);
    // two cups clinking
    const cup = (x, rot) => {
      c.save(); c.translate(x, 290); c.rotate(rot);
      c.fillStyle = '#e8f6ff'; c.strokeStyle = '#7aaecf'; c.lineWidth = 8;
      c.beginPath(); c.moveTo(-40, -80); c.lineTo(40, -80); c.lineTo(32, 70); c.lineTo(-32, 70); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#5fd14a'; c.beginPath(); c.moveTo(-36, -40); c.lineTo(36, -40); c.lineTo(31, 66); c.lineTo(-31, 66); c.closePath(); c.fill();
      c.restore();
    };
    cup(860, 0.3); cup(960, -0.3);
    c.fillStyle = '#ffc928';
    star(c, 910, 150, 34, 14); c.fill();
    star(c, 850, 110, 18, 7); c.fill();
    star(c, 980, 115, 20, 8); c.fill();
  });
}
