// core: renderer, camera framing, tweens, input, particles helpers
import * as THREE from 'three';
import { RoomEnvironment } from '../lib/RoomEnvironment.js';

export const canvas = document.getElementById('c');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const pmrem = new THREE.PMREMGenerator(renderer);
export const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

export const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
// view: where the camera is, what it looks at, and how much world (w x h) must fit
export const view = { pos: new THREE.Vector3(0, 3, 8), target: new THREE.Vector3(0, 1, 0), w: 10, h: 6 };

export function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
}
window.addEventListener('resize', resize);
resize();

function applyView() {
  camera.position.copy(view.pos);
  camera.lookAt(view.target);
  const d = view.pos.distanceTo(view.target);
  const fh = 2 * Math.atan(view.h / 2 / d);
  const fw = 2 * Math.atan(view.w / 2 / d / camera.aspect);
  camera.fov = THREE.MathUtils.radToDeg(Math.max(fh, fw));
  camera.updateProjectionMatrix();
}

// ---------- time / tweens ----------
export const ease = {
  linear: k => k,
  inOut: k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2,
  out: k => 1 - Math.pow(1 - k, 3),
  in: k => k * k * k,
  back: k => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
  elastic: k => k === 0 ? 0 : k === 1 ? 1 : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * (2 * Math.PI) / 3) + 1,
};
let tweens = [];
let updaters = [];
window.__tw = () => tweens.map(t => [+t.t.toFixed(2), t.dur]);
export function tween(dur, fn, e = ease.inOut) {
  return new Promise(res => { tweens.push({ t: 0, dur: Math.max(0.0001, dur), fn, e, res }); });
}
export const wait = s => tween(s, () => {});
export function moveTo(obj, to, dur, e = ease.inOut) {
  const from = obj.clone();
  return tween(dur, k => obj.lerpVectors(from, to, k), e);
}
export function camTo(pos, target, w, h, dur = 1.4) {
  const p0 = view.pos.clone(), t0 = view.target.clone(), w0 = view.w, h0 = view.h;
  return tween(dur, k => {
    view.pos.lerpVectors(p0, pos, k); view.target.lerpVectors(t0, target, k);
    view.w = w0 + (w - w0) * k; view.h = h0 + (h - h0) * k;
  });
}
export function setCam(pos, target, w, h) { view.pos.copy(pos); view.target.copy(target); view.w = w; view.h = h; }
export function onUpdate(fn) { updaters.push(fn); return fn; }
export function offUpdate(fn) { updaters = updaters.filter(f => f !== fn); }
export function resetScene() { tweens = []; updaters = []; taps = []; drag = null; }

// ---------- input ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let taps = [];
let drag = null;
export let lastInput = performance.now();
export let current = { scene: null };

// register a tap target. objs: Object3D or array. fn(hitPoint, info) ; on() -> enabled
export function onTap(objs, fn, on = () => true) {
  const t = { objs: Array.isArray(objs) ? objs : [objs], fn, on };
  taps.push(t);
  return t;
}
export function removeTap(t) { taps = taps.filter(x => x !== t); }

export function setRay(sx, sy) {
  ndc.set((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray;
}
export function rayPlaneY(sx, sy, y) {
  setRay(sx, sy);
  const p = new THREE.Vector3();
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p) ? p : null;
}
export function toScreen(v3) {
  const p = v3.clone().project(camera);
  return { x: (p.x + 1) / 2 * window.innerWidth, y: (1 - p.y) / 2 * window.innerHeight, behind: p.z > 1 };
}
// find nearest of items ({pos:()=>Vector3}) to screen point within px
export function nearestOnScreen(items, sx, sy, px) {
  let best = null, bd = px;
  for (const it of items) {
    const s = toScreen(it.pos());
    const d = Math.hypot(s.x - sx, s.y - sy);
    if (d < bd) { bd = d; best = it; }
  }
  return best;
}
export function hitTest(sx, sy) {
  setRay(sx, sy);
  const list = [];
  for (const t of taps) if (t.on()) for (const o of t.objs) list.push([o, t]);
  let best = null;
  for (const [o, t] of list) {
    if (!o.visible && o.userData.hitProxy !== true) continue;
    const hits = ray.intersectObject(o, true);
    if (hits.length && (!best || hits[0].distance < best.d)) best = { d: hits[0].distance, t, p: hits[0].point };
  }
  if (best) return best;
  // forgiving fallback: nearest registered object center within 48px
  const minDim = Math.min(window.innerWidth, window.innerHeight);
  let bd = Math.max(36, minDim * 0.06), bt = null, bp = null;
  for (const [o, t] of list) {
    const c = new THREE.Vector3(); o.getWorldPosition(c);
    const s = toScreen(c);
    const d = Math.hypot(s.x - sx, s.y - sy);
    if (d < bd) { bd = d; bt = t; bp = c; }
  }
  return bt ? { t: bt, p: bp } : null;
}
// drag API: handler {move(sx,sy), up(sx,sy,info)}
export function beginDrag(h) { drag = Object.assign({ sx0: downX, sy0: downY, t0: performance.now(), moved: false }, h); }
let downX = 0, downY = 0, activeId = null;
let unlockFn = null;
export function onFirstTouch(fn) { unlockFn = fn; }
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (unlockFn) unlockFn();
  lastInput = performance.now();
  if (activeId !== null && drag) return;
  activeId = e.pointerId;
  downX = e.clientX; downY = e.clientY;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  if (current.scene && current.scene.preTap && current.scene.preTap(e.clientX, e.clientY)) return;
  const h = hitTest(e.clientX, e.clientY);
  if (h) h.t.fn(h.p, { sx: e.clientX, sy: e.clientY });
  else if (current.scene && current.scene.onMiss) current.scene.onMiss(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId !== activeId) return;
  lastInput = performance.now();
  if (drag) {
    if (Math.hypot(e.clientX - drag.sx0, e.clientY - drag.sy0) > 12) drag.moved = true;
    drag.move && drag.move(e.clientX, e.clientY);
  } else if (current.scene && current.scene.onRub) current.scene.onRub(e.clientX, e.clientY);
});
function endPointer(e) {
  if (e.pointerId !== activeId) return;
  activeId = null;
  const d = drag; drag = null;
  if (d && d.up) d.up(e.clientX, e.clientY, { moved: d.moved, dt: performance.now() - d.t0 });
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

// ---------- loop ----------
const clock = new THREE.Clock();
const DTMAX = parseFloat(new URLSearchParams(location.search).get('dtmax') || '0.05');
export let time = 0;
export function startLoop() {
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), DTMAX); window.__f = (window.__f || 0) + 1;
    time += dt;
    const list = tweens.slice();
    for (const tw of list) {
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(tw.e(k));
      if (k >= 1) { tweens = tweens.filter(x => x !== tw); tw.res(); }
    }
    for (const u of updaters.slice()) u(dt, time);
    applyView();
    if (current.scene) renderer.render(current.scene.root, camera);
  });
}

// fade overlay
const fade = document.getElementById('fade');
export function fadeTo(op, dur = 0.5) {
  const s = parseFloat(fade.style.opacity || '0');
  return tween(dur, k => { fade.style.opacity = String(s + (op - s) * k); });
}
export { THREE };
