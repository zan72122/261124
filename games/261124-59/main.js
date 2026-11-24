// おうちに来たロボット — 文字なし・指1本の3Dごっこ遊び
import * as THREE from 'three';
import { RoomEnvironment } from './lib/RoomEnvironment.js';
import { RoundedBoxGeometry } from './lib/RoundedBoxGeometry.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SPEED = +(params.get('speed') || 1);
const MOBILE = /iPhone|iPad|iPod|Android/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
const easeOutBack = (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };

// ---------------------------------------------------------------- renderer
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('shot') });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MOBILE ? 2 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd9cbb8);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 60);
const VFOV = 42;

const hemi = new THREE.HemisphereLight(0xfff4e6, 0x8a6f55, 0.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0dc, 2.6);
sun.position.set(-3.5, 7, 6);
sun.target.position.set(0, 0, -1);
sun.castShadow = true;
sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
const sc = sun.shadow.camera; sc.left = -7; sc.right = 7; sc.top = 6; sc.bottom = -6; sc.near = 1; sc.far = 25;
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
scene.add(sun, sun.target);
const windowLight = new THREE.PointLight(0xdfefff, 4, 7, 1.6);
windowLight.position.set(-1.2, 1.8, -3.3);
scene.add(windowLight);
const kitchenLight = new THREE.PointLight(0xfff1dc, 3, 5, 1.5);
kitchenLight.position.set(3, 2.4, -2.4);
scene.add(kitchenLight);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- time / tasks
let T = 0;
const waiters = [];
const tweens = [];
const updaters = [];
function wait(s) { return new Promise((r) => waiters.push({ t: T + s, r })); }
function until(fn) { return new Promise((r) => waiters.push({ fn, r })); }
function tween(d, fn, e = ease) {
  return new Promise((r) => tweens.push({ t0: T, d, fn, e, r }));
}

// ---------------------------------------------------------------- textures
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, { srgb = true, rep = null, mirror = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = mirror ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
function speckle(g, w, h, n, colors, amin = 0.03, amax = 0.12, smin = 1, smax = 2.5) {
  for (let i = 0; i < n; i++) {
    g.globalAlpha = rnd(amin, amax);
    g.fillStyle = colors[(Math.random() * colors.length) | 0];
    const s = rnd(smin, smax);
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
  g.globalAlpha = 1;
}

// cardboard
function drawCardboardBase(g, w, h) {
  g.fillStyle = '#b8895a'; g.fillRect(0, 0, w, h);
  // large tonal variation
  for (let i = 0; i < 18; i++) {
    const x = rnd(0, w), y = rnd(0, h), r = rnd(w * 0.15, w * 0.5);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const c = Math.random() < 0.5 ? '160,112,66' : '205,160,110';
    gr.addColorStop(0, `rgba(${c},0.18)`); gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  // corrugation flutes
  for (let x = 0; x < w; x += 7) {
    g.fillStyle = 'rgba(90,60,30,0.07)'; g.fillRect(x, 0, 2, h);
    g.fillStyle = 'rgba(255,230,190,0.05)'; g.fillRect(x + 3, 0, 2, h);
  }
  speckle(g, w, h, 9000, ['#6b4a2a', '#e0c095', '#8a6038', '#3d2a18'], 0.05, 0.18, 1, 2);
  // fibres
  g.lineWidth = 1;
  for (let i = 0; i < 500; i++) {
    g.strokeStyle = Math.random() < 0.5 ? 'rgba(240,215,170,0.18)' : 'rgba(80,55,30,0.14)';
    const x = rnd(0, w), y = rnd(0, h), a = rnd(0, Math.PI * 2), l = rnd(3, 12);
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + rnd(-2, 2), y + Math.sin(a) * l * 0.5 + rnd(-2, 2), x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  // edge wear
  const eg = g.createLinearGradient(0, 0, 0, h);
  eg.addColorStop(0, 'rgba(70,45,20,0.18)'); eg.addColorStop(0.06, 'rgba(70,45,20,0)'); eg.addColorStop(0.94, 'rgba(70,45,20,0)'); eg.addColorStop(1, 'rgba(70,45,20,0.22)');
  g.fillStyle = eg; g.fillRect(0, 0, w, h);
}
function inkStyle(g, col = 'rgba(30,22,18,0.86)', lw = 10) { g.strokeStyle = col; g.fillStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round'; }
function drawGlass(g, cx, cy, s) {
  inkStyle(g, 'rgba(30,22,18,0.86)', s * 0.07);
  g.beginPath(); g.moveTo(cx - s * 0.32, cy - s * 0.5); g.lineTo(cx + s * 0.32, cy - s * 0.5);
  g.quadraticCurveTo(cx + s * 0.34, cy + s * 0.05, cx, cy + s * 0.08); g.quadraticCurveTo(cx - s * 0.34, cy + s * 0.05, cx - s * 0.32, cy - s * 0.5); g.stroke();
  g.beginPath(); g.moveTo(cx, cy + s * 0.08); g.lineTo(cx, cy + s * 0.45); g.moveTo(cx - s * 0.22, cy + s * 0.47); g.lineTo(cx + s * 0.22, cy + s * 0.47); g.stroke();
  // crack
  g.strokeStyle = 'rgba(200,40,30,0.9)'; g.lineWidth = s * 0.05;
  g.beginPath(); g.moveTo(cx - s * 0.05, cy - s * 0.5); g.lineTo(cx + s * 0.06, cy - s * 0.32); g.lineTo(cx - s * 0.06, cy - s * 0.18); g.lineTo(cx + s * 0.04, cy - s * 0.02); g.stroke();
}
function drawArrows(g, cx, cy, s) {
  inkStyle(g, 'rgba(30,22,18,0.86)', s * 0.06);
  for (const dx of [-0.2, 0.2]) {
    const x = cx + dx * s;
    g.beginPath(); g.moveTo(x, cy + s * 0.45); g.lineTo(x, cy - s * 0.25); g.stroke();
    g.beginPath(); g.moveTo(x - s * 0.15, cy - s * 0.15); g.lineTo(x, cy - s * 0.42); g.lineTo(x + s * 0.15, cy - s * 0.15); g.closePath(); g.fill();
  }
  g.beginPath(); g.moveTo(cx - s * 0.42, cy + s * 0.5); g.lineTo(cx + s * 0.42, cy + s * 0.5); g.stroke();
}
function drawUmbrella(g, cx, cy, s) {
  inkStyle(g, 'rgba(30,22,18,0.86)', s * 0.06);
  g.beginPath(); g.arc(cx, cy, s * 0.4, Math.PI, 0); g.closePath(); g.stroke();
  g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy + s * 0.42); g.arc(cx - s * 0.08, cy + s * 0.42, s * 0.08, 0, Math.PI); g.stroke();
  for (const d of [-0.15, 0.05, 0.25]) { g.beginPath(); g.moveTo(cx + d * s, cy - s * 0.75); g.lineTo(cx + d * s - s * 0.05, cy - s * 0.6); g.stroke(); }
}
function drawRobotStamp(g, cx, cy, s) {
  inkStyle(g, 'rgba(40,70,140,0.8)', s * 0.05);
  g.strokeRect(cx - s * 0.32, cy - s * 0.3, s * 0.64, s * 0.42);
  g.beginPath(); g.arc(cx - s * 0.13, cy - s * 0.1, s * 0.06, 0, 7); g.fill(); g.beginPath(); g.arc(cx + s * 0.13, cy - s * 0.1, s * 0.06, 0, 7); g.fill();
  g.beginPath(); g.moveTo(cx - s * 0.12, cy + s * 0.02); g.quadraticCurveTo(cx, cy + s * 0.1, cx + s * 0.12, cy + s * 0.02); g.stroke();
  g.beginPath(); g.moveTo(cx, cy - s * 0.3); g.lineTo(cx, cy - s * 0.45); g.stroke(); g.beginPath(); g.arc(cx, cy - s * 0.5, s * 0.05, 0, 7); g.fill();
  g.strokeRect(cx - s * 0.22, cy + s * 0.16, s * 0.44, s * 0.3);
  g.beginPath(); g.arc(cx, cy, s * 0.62, 0, 7); g.lineWidth = s * 0.035; g.stroke();
}
const cardboardCache = {};
function cardboardTex(print = 'none') {
  if (cardboardCache[print]) return cardboardCache[print];
  const c = makeCanvas(512, 512), g = c.getContext('2d');
  drawCardboardBase(g, 512, 512);
  if (print === 'front') { drawGlass(g, 170, 250, 210); drawArrows(g, 370, 260, 190); }
  if (print === 'side') { drawRobotStamp(g, 256, 256, 260); }
  if (print === 'back') { drawUmbrella(g, 160, 270, 200); drawArrows(g, 360, 260, 180); }
  const t = tex(c);
  cardboardCache[print] = t;
  return t;
}
let cardboardBump = null;
function getCardboardBump() {
  if (cardboardBump) return cardboardBump;
  const c = makeCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 3.5) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, 0, 1.5, 256); }
  speckle(g, 256, 256, 3000, ['#000', '#fff'], 0.05, 0.15, 1, 2);
  cardboardBump = tex(c, { srgb: false });
  return cardboardBump;
}
const cbMatCache = {};
function cardboardMat(print = 'none') {
  if (cbMatCache[print]) return cbMatCache[print];
  const m = new THREE.MeshStandardMaterial({ map: cardboardTex(print), bumpMap: getCardboardBump(), bumpScale: 0.6, roughness: 0.88, metalness: 0 });
  cbMatCache[print] = m;
  return m;
}
const cardboardInner = new THREE.MeshStandardMaterial({ color: 0xa98058, roughness: 0.95, bumpMap: getCardboardBump(), bumpScale: 0.4, map: cardboardTex('none') });
cardboardInner.color.setHex(0xcfb08a);

// wood floor
function woodFloorTex() {
  const W = 1024, c = makeCanvas(W, W), g = c.getContext('2d');
  const rows = 8, rh = W / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rnd(0, 400);
    while (x < W) {
      const len = rnd(320, 640);
      const l = rnd(42, 58), hue = rnd(26, 34), sat = rnd(34, 48);
      g.fillStyle = `hsl(${hue},${sat}%,${l}%)`;
      g.fillRect(x, r * rh, len, rh);
      // grain
      for (let k = 0; k < 26; k++) {
        const y0 = r * rh + rnd(2, rh - 2), amp = rnd(1, 5), fr = rnd(0.004, 0.02), ph = rnd(0, 6);
        g.strokeStyle = `hsla(${hue - 4},${sat + 10}%,${l - rnd(8, 20)}%,${rnd(0.12, 0.35)})`;
        g.lineWidth = rnd(0.6, 2);
        g.beginPath();
        for (let xx = x; xx <= x + len; xx += 8) { const yy = y0 + Math.sin(xx * fr + ph) * amp; if (xx === x) g.moveTo(xx, yy); else g.lineTo(xx, yy); }
        g.stroke();
      }
      if (Math.random() < 0.25) {
        const kx = x + rnd(40, len - 40), ky = r * rh + rnd(20, rh - 20);
        g.fillStyle = 'rgba(70,40,20,0.35)'; g.beginPath(); g.ellipse(kx, ky, rnd(5, 10), rnd(3, 6), 0, 0, 7); g.fill();
      }
      g.fillStyle = 'rgba(40,25,12,0.55)'; g.fillRect(x, r * rh, 2, rh);
      x += len;
    }
    g.fillStyle = 'rgba(40,25,12,0.5)'; g.fillRect(0, r * rh, W, 2);
  }
  speckle(g, W, W, 8000, ['#2e1c0e', '#f0d8b0'], 0.03, 0.08);
  return tex(c, { rep: [5, 5] });
}
function noiseTex(w, h, base, cols, n, rep, srgb = true) {
  const c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  speckle(g, w, h, n, cols, 0.04, 0.16, 1, 2.5);
  return tex(c, { rep, srgb });
}
function brushedTex() {
  const c = makeCanvas(512, 512), g = c.getContext('2d');
  g.fillStyle = '#6a6a6a'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1600; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
    g.fillRect(rnd(-200, 512), rnd(0, 512), rnd(80, 400), rnd(0.5, 1.5));
  }
  return tex(c, { srgb: false, rep: [2, 2] });
}
function tileTex() {
  const c = makeCanvas(512, 512), g = c.getContext('2d');
  g.fillStyle = '#cfc8bf'; g.fillRect(0, 0, 512, 512);
  const tw = 128, th = 64;
  for (let r = 0; r < 8; r++) for (let k = -1; k < 5; k++) {
    const x = k * tw + (r % 2 ? tw / 2 : 0), y = r * th;
    const gr = g.createLinearGradient(x, y, x, y + th);
    const l = rnd(93, 97);
    gr.addColorStop(0, `hsl(40,20%,${l}%)`); gr.addColorStop(1, `hsl(40,15%,${l - 5}%)`);
    g.fillStyle = gr; g.fillRect(x + 3, y + 3, tw - 6, th - 6);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x + 6, y + 5, tw - 12, 3);
  }
  return tex(c, { rep: [4, 2] });
}
function rugTex() {
  const c = makeCanvas(512, 512), g = c.getContext('2d');
  g.fillStyle = '#e9dcc6'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#c0643f'; g.lineWidth = 22; g.strokeRect(30, 30, 452, 452);
  g.strokeStyle = '#3f6c7a'; g.lineWidth = 8; g.strokeRect(62, 62, 388, 388);
  for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#d7a64a' : '#c0643f'; g.beginPath(); g.moveTo(256, 120 + i * 10); g.lineTo(392 - i * 10, 256); g.lineTo(256, 392 - i * 10); g.lineTo(120 + i * 10, 256); g.closePath(); g.globalAlpha = 0.25 + i * 0.05; g.fill(); }
  g.globalAlpha = 1;
  speckle(g, 512, 512, 20000, ['#5a4636', '#ffffff', '#a0806a'], 0.05, 0.16, 1, 2);
  return tex(c);
}
function skyTex() {
  const c = makeCanvas(256, 256), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#9fd0ff'); gr.addColorStop(0.6, '#d9efff'); gr.addColorStop(1, '#f2f7ff');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.filter = 'blur(6px)';
  for (let i = 0; i < 30; i++) { g.fillStyle = `hsl(${rnd(90, 130)},${rnd(30, 50)}%,${rnd(35, 55)}%)`; g.beginPath(); g.arc(rnd(0, 256), rnd(150, 260), rnd(20, 50), 0, 7); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(rnd(0, 256), rnd(20, 90), rnd(20, 40), rnd(8, 14), 0, 0, 7); g.fill(); }
  g.filter = 'none';
  return tex(c);
}

// ---------------------------------------------------------------- materials
const M = {
  metal: new THREE.MeshStandardMaterial({ color: 0xd9dee4, metalness: 1, roughness: 0.2 }),
  metalDark: new THREE.MeshStandardMaterial({ color: 0x8e959d, metalness: 1, roughness: 0.32 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.06 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xc4c8cc, metalness: 1, roughness: 0.3, roughnessMap: brushedTex() }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.7 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x3d7be0, roughness: 0.35, metalness: 0.1 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xff8a3d, roughness: 0.35, metalness: 0.1 }),
  screen: new THREE.MeshStandardMaterial({ color: 0x0b1116, roughness: 0.08, metalness: 0.2 }),
  wall: new THREE.MeshStandardMaterial({ color: 0xf2ebe1, roughness: 0.95, map: noiseTex(256, 256, '#f3ece2', ['#d8cfc2', '#ffffff'], 6000, [6, 3]) }),
  white: new THREE.MeshStandardMaterial({ color: 0xf6f3ee, roughness: 0.55 }),
  cabinet: new THREE.MeshStandardMaterial({ color: 0xeef0ee, roughness: 0.4 }),
  wood: new THREE.MeshStandardMaterial({ color: 0xb07d4f, roughness: 0.5, map: noiseTex(256, 256, '#a87447', ['#6b4426', '#d6a77a'], 5000, [1, 1]) }),
  sofa: new THREE.MeshStandardMaterial({ color: 0x7f99a8, roughness: 0.95, map: noiseTex(256, 256, '#8aa2b0', ['#5b7180', '#c0d0da'], 20000, [3, 3]) }),
  curtain: new THREE.MeshStandardMaterial({ color: 0xf3e3c8, roughness: 0.9, side: THREE.DoubleSide }),
  ceramic: new THREE.MeshPhysicalMaterial({ color: 0xfbfbfa, roughness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
  plant: new THREE.MeshStandardMaterial({ color: 0x4f8a3c, roughness: 0.6, side: THREE.DoubleSide }),
  pot: new THREE.MeshStandardMaterial({ color: 0xc46c45, roughness: 0.8 }),
  tape: new THREE.MeshPhysicalMaterial({ color: 0xc9a46a, roughness: 0.25, transparent: true, opacity: 0.88, clearcoat: 1, clearcoatRoughness: 0.15, emissive: 0x000000, side: THREE.DoubleSide }),
  duck: new THREE.MeshPhysicalMaterial({ color: 0xffd23a, roughness: 0.3, clearcoat: 0.6 }),
  beak: new THREE.MeshStandardMaterial({ color: 0xff8a1c, roughness: 0.4 }),
  black: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 }),
  teddy: new THREE.MeshStandardMaterial({ color: 0xa8743f, roughness: 1, map: noiseTex(128, 128, '#a8743f', ['#6a4420', '#d4a070'], 6000, [2, 2]) }),
  soap: new THREE.MeshPhysicalMaterial({ color: 0x4fd07a, roughness: 0.1, transmission: 0, transparent: true, opacity: 0.92, clearcoat: 1 }),
  water: new THREE.MeshPhysicalMaterial({ color: 0x7fb2c4, roughness: 0.05, transparent: true, opacity: 0.35, metalness: 0, envMapIntensity: 0.25, depthWrite: false }),
};
const floorMat = new THREE.MeshPhysicalMaterial({ map: woodFloorTex(), roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3 });

// ---------------------------------------------------------------- helpers
function mesh(geo, mat, x = 0, y = 0, z = 0, parent = null, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  if (parent) parent.add(m);
  return m;
}
function rbox(w, h, d, r = 0.03, seg = 3) { return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)); }
const interact = []; // {objs:[], down, move, up, on:()=>bool}
function addTouch(objs, h) { const item = { objs: Array.isArray(objs) ? objs : [objs], on: () => true, ...h }; interact.push(item); return item; }

// ---------------------------------------------------------------- room
const room = new THREE.Group(); scene.add(room);
{
  const floor = mesh(new THREE.PlaneGeometry(11, 8), floorMat, 0, 0, 0, room); floor.rotation.x = -Math.PI / 2; floor.castShadow = false;
  floorMat.map.repeat.set(5.5, 4);
  const wallGeo = new THREE.PlaneGeometry(11, 3);
  const back = mesh(wallGeo, M.wall, 0, 1.5, -4, room); back.castShadow = false;
  const left = mesh(new THREE.PlaneGeometry(8, 3), M.wall, -5.5, 1.5, 0, room); left.rotation.y = Math.PI / 2; left.castShadow = false;
  const right = mesh(new THREE.PlaneGeometry(8, 3), M.wall, 5.5, 1.5, 0, room); right.rotation.y = -Math.PI / 2; right.castShadow = false;
  // baseboards
  mesh(new THREE.BoxGeometry(11, 0.1, 0.02), M.white, 0, 0.05, -3.99, room);
  const bl = mesh(new THREE.BoxGeometry(8, 0.1, 0.02), M.white, -5.49, 0.05, 0, room); bl.rotation.y = Math.PI / 2;
  // window on back wall
  const sky = new THREE.MeshBasicMaterial({ map: skyTex(), toneMapped: false });
  mesh(new THREE.PlaneGeometry(1.5, 1.4), sky, -1.2, 1.65, -3.985, room, false);
  const frameMat = M.white;
  mesh(new THREE.BoxGeometry(1.62, 0.07, 0.08), frameMat, -1.2, 2.38, -3.96, room);
  mesh(new THREE.BoxGeometry(1.7, 0.06, 0.2), frameMat, -1.2, 0.93, -3.92, room);
  mesh(new THREE.BoxGeometry(0.07, 1.46, 0.08), frameMat, -1.98, 1.65, -3.96, room);
  mesh(new THREE.BoxGeometry(0.07, 1.46, 0.08), frameMat, -0.42, 1.65, -3.96, room);
  mesh(new THREE.BoxGeometry(0.04, 1.4, 0.05), frameMat, -1.2, 1.65, -3.96, room);
  // curtain rod
  const rod = mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.6, 8), M.metalDark, -1.2, 2.55, -3.86, room); rod.rotation.z = Math.PI / 2;
  // door on left wall (open to hallway)
  const doorFrame = new THREE.Group(); doorFrame.position.set(-5.48, 0, 0.6); room.add(doorFrame);
  mesh(new THREE.PlaneGeometry(1.0, 2.1), new THREE.MeshStandardMaterial({ color: 0x5b4a3c, roughness: 1 }), 0.005, 1.05, 0, doorFrame, false).rotation.y = Math.PI / 2;
  mesh(new THREE.BoxGeometry(0.1, 2.2, 0.08), M.white, 0.02, 1.1, -0.54, doorFrame);
  mesh(new THREE.BoxGeometry(0.1, 2.2, 0.08), M.white, 0.02, 1.1, 0.54, doorFrame);
  mesh(new THREE.BoxGeometry(0.1, 0.08, 1.16), M.white, 0.02, 2.17, 0, doorFrame);
  // rug
  const rug = mesh(new THREE.PlaneGeometry(3.2, 2.4), new THREE.MeshStandardMaterial({ map: rugTex(), roughness: 1 }), -2.4, 0.004, -1.0, room); rug.rotation.x = -Math.PI / 2; rug.castShadow = false;
  // ceiling lamp (metal)
  const lamp = new THREE.Group(); lamp.position.set(-2.2, 2.9, -1); room.add(lamp);
  mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 6), M.rubber, 0, -0.3, 0, lamp);
  mesh(new THREE.SphereGeometry(0.28, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.metal, 0, -0.62, 0, lamp).material = M.metal;
  mesh(new THREE.SphereGeometry(0.1, 16, 8), new THREE.MeshBasicMaterial({ color: 0xfff3d0 }), 0, -0.64, 0, lamp, false);
}

// sofa
const sofa = new THREE.Group(); sofa.position.set(-3.4, 0, -3.0); room.add(sofa);
{
  mesh(rbox(2.1, 0.42, 0.9, 0.08), M.sofa, 0, 0.3, 0, sofa);
  mesh(rbox(2.1, 0.55, 0.25, 0.1), M.sofa, 0, 0.72, -0.34, sofa);
  mesh(rbox(0.22, 0.6, 0.9, 0.09), M.sofa, -1.0, 0.45, 0, sofa);
  mesh(rbox(0.22, 0.6, 0.9, 0.09), M.sofa, 1.0, 0.45, 0, sofa);
  for (const x of [-0.45, 0.45]) mesh(rbox(0.86, 0.16, 0.66, 0.07), M.sofa, x, 0.58, 0.08, sofa);
  const pillow = new THREE.MeshStandardMaterial({ color: 0xe6a04f, roughness: 0.95 });
  const p = mesh(rbox(0.42, 0.38, 0.13, 0.06), pillow, -0.62, 0.84, -0.15, sofa); p.rotation.z = 0.15;
  for (const x of [-0.95, 0.95]) for (const z of [-0.35, 0.35]) mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.09, 8), M.wood, x, 0.045, z, sofa);
}
// coffee table
{
  const t = new THREE.Group(); t.position.set(-3.3, 0, -1.75); room.add(t);
  mesh(rbox(1.0, 0.05, 0.55, 0.02), M.wood, 0, 0.42, 0, t);
  for (const x of [-0.44, 0.44]) for (const z of [-0.22, 0.22]) mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8), M.metalDark, x, 0.2, z, t);
  const mug = mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 16), M.ceramic, 0.25, 0.5, 0.05, t);
}
// plant
{
  const p = new THREE.Group(); p.position.set(-5.0, 0, -3.5); room.add(p);
  mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.42, 20), M.pot, 0, 0.21, 0, p);
  for (let i = 0; i < 14; i++) {
    const leaf = mesh(new THREE.SphereGeometry(0.16, 10, 6), M.plant, 0, 0, 0, p);
    leaf.scale.set(0.35, 0.08, 1);
    const a = i / 14 * Math.PI * 2, h = rnd(0.55, 1.15);
    leaf.position.set(Math.cos(a) * 0.15, h, Math.sin(a) * 0.15);
    leaf.rotation.set(rnd(-0.6, -0.2), -a + Math.PI / 2, rnd(-0.3, 0.3));
    const st = mesh(new THREE.CylinderGeometry(0.006, 0.008, h - 0.4, 4), M.plant, Math.cos(a) * 0.07, 0.4 + (h - 0.4) / 2, Math.sin(a) * 0.07, p);
  }
}
// curtains
function makeCurtain(x, w, h) {
  const geo = new THREE.PlaneGeometry(w, h, 40, 12);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const px = pos.getX(i); pos.setZ(i, Math.sin(px / w * Math.PI * 9) * 0.04); }
  geo.computeVertexNormals();
  const m = mesh(geo, M.curtain, x, h / 2 + 0.02, -3.82, room);
  return m;
}
const curtainL = makeCurtain(-2.25, 0.62, 2.5);
const curtainR = makeCurtain(-0.15, 0.62, 2.5);

// kitchen
const sinkPos = new THREE.Vector3(3.0, 0.92, -3.62);
{
  const k = new THREE.Group(); room.add(k);
  const backsplash = mesh(new THREE.PlaneGeometry(4.3, 0.6), new THREE.MeshStandardMaterial({ map: tileTex(), roughness: 0.25 }), 3.35, 1.22, -3.995, k, false);
  // lower cabinets x 1.2..4.5
  for (let i = 0; i < 5; i++) {
    const x = 1.53 + i * 0.66;
    mesh(rbox(0.64, 0.6, 0.6, 0.01), M.cabinet, x, 0.36, -3.68, k);
    mesh(rbox(0.64, 0.19, 0.03, 0.008), M.cabinet, x, 0.78, -3.39, k);
    mesh(new THREE.BoxGeometry(0.3, 0.018, 0.025), M.chrome, x, 0.8, -3.36, k);
    mesh(new THREE.BoxGeometry(0.018, 0.2, 0.025), M.chrome, x + 0.26, 0.5, -3.37, k);
  }
  mesh(new THREE.BoxGeometry(3.4, 0.06, 0.6), M.rubber, 2.85, 0.03, -3.7, k);
  // stainless counter top with sink hole (4 pieces)
  const top = 0.92, x0 = 1.2, x1 = 4.5, z0 = -4, z1 = -3.32;
  const sw = 0.74, sd = 0.46;
  const sx0 = sinkPos.x - sw / 2, sx1 = sinkPos.x + sw / 2, sz0 = sinkPos.z - sd / 2, sz1 = sinkPos.z + sd / 2;
  const ct = 0.04;
  mesh(new THREE.BoxGeometry(sx0 - x0, ct, z1 - z0), M.steel, (x0 + sx0) / 2, top - ct / 2, (z0 + z1) / 2, k);
  mesh(new THREE.BoxGeometry(x1 - sx1, ct, z1 - z0), M.steel, (sx1 + x1) / 2, top - ct / 2, (z0 + z1) / 2, k);
  mesh(new THREE.BoxGeometry(sw, ct, sz0 - z0), M.steel, sinkPos.x, top - ct / 2, (z0 + sz0) / 2, k);
  mesh(new THREE.BoxGeometry(sw, ct, z1 - sz1), M.steel, sinkPos.x, top - ct / 2, (sz1 + z1) / 2, k);
  // sink basin
  const depth = 0.22;
  const basin = new THREE.Group(); basin.position.set(sinkPos.x, top - depth, sinkPos.z); k.add(basin);
  mesh(new THREE.BoxGeometry(sw, 0.01, sd), M.steel, 0, 0, 0, basin);
  mesh(new THREE.BoxGeometry(0.01, depth, sd), M.steel, -sw / 2, depth / 2, 0, basin);
  mesh(new THREE.BoxGeometry(0.01, depth, sd), M.steel, sw / 2, depth / 2, 0, basin);
  mesh(new THREE.BoxGeometry(sw, depth, 0.01), M.steel, 0, depth / 2, -sd / 2, basin);
  mesh(new THREE.BoxGeometry(sw, depth, 0.01), M.steel, 0, depth / 2, sd / 2, basin);
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 16), M.chrome, 0.2, 0.008, 0, basin);
  // faucet
  const f = new THREE.Group(); f.position.set(sinkPos.x, top, -3.93); k.add(f);
  mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.3, 16), M.chrome, 0, 0.15, 0, f);
  const arc = mesh(new THREE.TorusGeometry(0.12, 0.022, 10, 24, Math.PI), M.chrome, 0, 0.3, 0.12, f); arc.rotation.y = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.06, 12), M.chrome, 0, 0.27, 0.24, f);
  // upper cabinets
  for (let i = 0; i < 4; i++) mesh(rbox(0.7, 0.7, 0.35, 0.01), M.cabinet, 1.6 + i * 0.72, 1.92, -3.82, k);
  // fridge
  const fr = new THREE.Group(); fr.position.set(5.0, 0, -3.55); k.add(fr);
  mesh(rbox(0.86, 1.95, 0.76, 0.04), M.steel, 0, 0.975, 0, fr);
  mesh(new THREE.BoxGeometry(0.84, 0.008, 0.01), M.rubber, 0, 1.25, 0.381, fr);
  mesh(new THREE.BoxGeometry(0.03, 0.5, 0.04), M.chrome, -0.33, 1.55, 0.41, fr);
  mesh(new THREE.BoxGeometry(0.03, 0.4, 0.04), M.chrome, -0.33, 0.95, 0.41, fr);
  // dish rack
  const rack = new THREE.Group(); rack.position.set(1.75, top, -3.62); k.add(rack);
  for (let i = 0; i < 9; i++) mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 5), M.chrome, -0.2 + i * 0.05, 0.08, 0.1, rack);
  for (let i = 0; i < 9; i++) mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 5), M.chrome, -0.2 + i * 0.05, 0.08, -0.1, rack);
  const rb = mesh(new THREE.BoxGeometry(0.44, 0.01, 0.26), M.chrome, 0, 0.005, 0, rack);
  // kettle (silver)
  const kt = new THREE.Group(); kt.position.set(4.15, top, -3.75); k.add(kt);
  mesh(new THREE.SphereGeometry(0.13, 24, 16), M.chrome, 0, 0.11, 0, kt).scale.set(1, 0.85, 1);
  mesh(new THREE.TorusGeometry(0.08, 0.012, 8, 20, Math.PI), M.rubber, 0, 0.22, 0, kt);
}
window.__rack = new THREE.Vector3(1.75, 0.92, -3.62);

// stacks of cardboard boxes (the house is full of them)
const staticBoxes = [];
function plainBox(w, h, d, x, y, z, ry = 0, print = 'none', parent = room) {
  const mats = [cardboardMat('side'), cardboardMat('side'), cardboardMat('none'), cardboardMat('none'), cardboardMat(print), cardboardMat('back')];
  const b = mesh(new THREE.BoxGeometry(w, h, d), mats, x, y + h / 2, z, parent);
  b.rotation.y = ry;
  // seam tape
  const tp = mesh(new THREE.PlaneGeometry(w * 1.0, 0.07), M.tape, 0, h / 2 + 0.002, 0, b, false); tp.rotation.x = -Math.PI / 2;
  staticBoxes.push(b);
  return b;
}
plainBox(0.7, 0.55, 0.55, 0.55, 0, -3.25, 0.1, 'front');
plainBox(0.6, 0.45, 0.5, 0.5, 0.55, -3.25, -0.12, 'none');
plainBox(0.5, 0.4, 0.45, 1.05, 0, -2.7, 0.5, 'front');
plainBox(0.55, 0.5, 0.5, -5.0, 0, 2.6, 0.3, 'front');
plainBox(0.45, 0.4, 0.4, -5.05, 0.5, 2.55, -0.2, 'none');
plainBox(0.6, 0.45, 0.5, 4.9, 0, 0.5, -0.4, 'front');
plainBox(0.5, 0.35, 0.45, 4.95, 0.45, 0.45, 0.2, 'back');
// hiding big box (open top flaps up)
const hideBox = new THREE.Group(); hideBox.position.set(-4.75, 0, -1.3); hideBox.rotation.y = 0.35; room.add(hideBox);
{
  const w = 0.85, h = 0.72, d = 0.75;
  mesh(new THREE.BoxGeometry(w, 0.01, d), cardboardInner, 0, 0.005, 0, hideBox);
  const fm = mesh(new THREE.BoxGeometry(w, h, 0.01), cardboardMat('front'), 0, h / 2, d / 2, hideBox);
  mesh(new THREE.BoxGeometry(w, h, 0.01), cardboardMat('back'), 0, h / 2, -d / 2, hideBox);
  mesh(new THREE.BoxGeometry(0.01, h, d), cardboardMat('side'), -w / 2, h / 2, 0, hideBox);
  mesh(new THREE.BoxGeometry(0.01, h, d), cardboardMat('side'), w / 2, h / 2, 0, hideBox);
  const fl = [[0, d / 2, w, d / 2, 'x', 1], [0, -d / 2, w, d / 2, 'x', -1]];
  for (const [x, z, fw, fd, ax, s] of fl) {
    const pv = new THREE.Group(); pv.position.set(x, h, z); hideBox.add(pv);
    mesh(new THREE.BoxGeometry(fw, 0.008, fd), cardboardMat('none'), 0, 0, -s * fd / 2, pv);
    pv.rotation.x = s * -0.25;
  }
  for (const s of [-1, 1]) {
    const pv = new THREE.Group(); pv.position.set(s * w / 2, h, 0); hideBox.add(pv);
    mesh(new THREE.BoxGeometry(d * 0.45, 0.008, d * 0.98), cardboardMat('none'), -s * d * 0.22, 0, 0, pv);
    pv.rotation.z = s * 0.25;
  }
}
// laundry basket
const basket = new THREE.Group(); basket.position.set(-0.4, 0, -2.3); room.add(basket);
{
  const bm = new THREE.MeshStandardMaterial({ color: 0xd8c39a, roughness: 0.9, map: noiseTex(128, 128, '#d8c39a', ['#8a7450', '#fff0d0'], 5000, [4, 2]) });
  const b = mesh(new THREE.CylinderGeometry(0.33, 0.27, 0.46, 24, 1, true), bm, 0, 0.23, 0, basket); b.material.side = THREE.DoubleSide;
  mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.01, 24), bm, 0, 0.005, 0, basket);
  mesh(new THREE.TorusGeometry(0.33, 0.02, 8, 30), bm, 0, 0.46, 0, basket).rotation.x = Math.PI / 2;
  const cloth = mesh(new THREE.SphereGeometry(0.3, 16, 10), new THREE.MeshStandardMaterial({ color: 0x9fc3e6, roughness: 1 }), 0, 0.38, 0, basket); cloth.scale.set(1, 0.35, 1);
}
// radio (silver) for the party
const radio = new THREE.Group(); radio.position.set(-2.95, 0.445, -1.8); room.add(radio);
{
  mesh(rbox(0.36, 0.2, 0.12, 0.03), M.metal, 0, 0.1, 0, radio);
  const sp = new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.6 });
  for (const x of [-0.1, 0.1]) { const s = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 24), sp, x, 0.1, 0.061, radio); s.rotation.x = Math.PI / 2; }
  const h = mesh(new THREE.TorusGeometry(0.12, 0.012, 8, 24, Math.PI), M.metalDark, 0, 0.2, 0, radio);
  radio.userData.ant = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.25, 4), M.chrome, 0.14, 0.32, 0, radio);
}

// ---------------------------------------------------------------- faces
const faceCache = new Map();
function drawPersonFace(g, W, H, expr, blink, o) {
  g.fillStyle = o.skin; g.fillRect(0, 0, W, H);
  const cx = W * 0.25, ey = H * 0.47, my = H * 0.6, ex = W * 0.066, er = W * 0.019;
  g.save();
  // blush
  g.fillStyle = 'rgba(255,120,120,0.28)';
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * W * 0.1, H * 0.555, W * 0.024, H * 0.03, 0, 0, 7); g.fill(); }
  g.strokeStyle = '#2a1a14'; g.fillStyle = '#2a1a14'; g.lineCap = 'round'; g.lineJoin = 'round';
  const closed = blink || expr === 'laugh' || expr === 'cover' || expr === 'proud';
  const eye = (x) => {
    if (closed) {
      g.lineWidth = W * 0.009; g.beginPath();
      if (expr === 'laugh' || expr === 'proud') { g.arc(x, ey + er * 0.6, er * 1.1, Math.PI * 1.15, Math.PI * 1.85); }
      else { g.arc(x, ey - er * 0.2, er * 1.0, Math.PI * 0.15, Math.PI * 0.85); }
      g.stroke(); return;
    }
    if (expr === 'dizzy') {
      g.lineWidth = W * 0.006; g.beginPath();
      for (let a = 0; a < 12; a += 0.3) { const r = a * er * 0.1; const px = x + Math.cos(a) * r, py = ey + Math.sin(a) * r; if (a === 0) g.moveTo(px, py); else g.lineTo(px, py); }
      g.stroke(); return;
    }
    const big = expr === 'wow' ? 1.3 : 1;
    g.fillStyle = '#2a1a14';
    g.beginPath(); g.ellipse(x, ey, er * big, er * 1.25 * big, 0, 0, 7); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(x + er * 0.35, ey - er * 0.45, er * 0.38 * big, 0, 7); g.fill();
    g.beginPath(); g.arc(x - er * 0.3, ey + er * 0.35, er * 0.16, 0, 7); g.fill();
  };
  eye(cx - ex); eye(cx + ex);
  // brows
  g.strokeStyle = o.brow; g.lineWidth = W * 0.008;
  const by = ey - H * 0.075;
  for (const s of [-1, 1]) {
    g.beginPath();
    let lift = 0, tilt = 0;
    if (expr === 'wow') lift = -H * 0.02;
    if (expr === 'huh') { lift = s > 0 ? -H * 0.03 : H * 0.005; tilt = s > 0 ? -0.1 : 0.1; }
    if (expr === 'oops' || expr === 'sad') tilt = s * 0.25;
    if (expr === 'determined') tilt = -s * 0.25;
    g.moveTo(cx + s * ex - W * 0.025, by + lift + tilt * W * 0.02 * -1);
    g.lineTo(cx + s * ex + W * 0.025, by + lift + tilt * W * 0.02);
    g.stroke();
  }
  // mouth
  g.lineWidth = W * 0.009; g.strokeStyle = '#7a2a22'; g.fillStyle = '#8a2c2a';
  const mw = W * 0.04;
  g.beginPath();
  switch (expr) {
    case 'happy': case 'laugh': case 'cheer':
      g.moveTo(cx - mw, my - H * 0.01); g.quadraticCurveTo(cx, my + H * 0.11, cx + mw, my - H * 0.01); g.closePath(); g.fill();
      g.fillStyle = '#ff8c8c'; g.beginPath(); g.ellipse(cx, my + H * 0.04, mw * 0.45, H * 0.02, 0, 0, 7); g.fill(); break;
    case 'wow': g.ellipse(cx, my + H * 0.015, mw * 0.4, H * 0.04, 0, 0, 7); g.fill(); break;
    case 'huh': g.moveTo(cx - mw * 0.5, my + H * 0.01); g.quadraticCurveTo(cx, my - H * 0.01, cx + mw * 0.6, my - H * 0.015); g.stroke(); break;
    case 'oops': g.moveTo(cx - mw * 0.8, my); for (let i = 1; i <= 4; i++) g.lineTo(cx - mw * 0.8 + i * mw * 0.4, my + (i % 2 ? -1 : 1) * H * 0.012); g.stroke();
      g.fillStyle = 'rgba(140,200,255,0.9)'; g.beginPath(); g.ellipse(cx + W * 0.11, ey - H * 0.06, W * 0.008, H * 0.03, 0.2, 0, 7); g.fill(); break;
    case 'determined': g.moveTo(cx - mw * 0.6, my); g.lineTo(cx + mw * 0.6, my); g.stroke(); break;
    case 'cover': g.moveTo(cx - mw * 0.6, my); g.quadraticCurveTo(cx, my + H * 0.05, cx + mw * 0.6, my); g.stroke(); break;
    case 'dizzy': g.ellipse(cx, my + H * 0.01, mw * 0.3, H * 0.025, 0, 0, 7); g.fill(); break;
    default: g.moveTo(cx - mw * 0.75, my); g.quadraticCurveTo(cx, my + H * 0.06, cx + mw * 0.75, my); g.stroke();
  }
  g.restore();
}
function drawRobotFace(g, W, H, expr, blink, col) {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.save();
  g.shadowColor = col; g.shadowBlur = 14;
  g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
  const L = W * 0.3, R = W * 0.7, ey = H * 0.45, lw = H * 0.11;
  g.lineWidth = lw;
  const rr = (x, y, w, h) => { g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, Math.min(w, h) / 2); g.fill(); };
  const heart = (x, y, s) => { g.beginPath(); g.moveTo(x, y + s * 0.6); g.bezierCurveTo(x - s * 1.2, y - s * 0.2, x - s * 0.5, y - s * 1.1, x, y - s * 0.35); g.bezierCurveTo(x + s * 0.5, y - s * 1.1, x + s * 1.2, y - s * 0.2, x, y + s * 0.6); g.fill(); };
  if (expr === 'off') { g.restore(); return; }
  if (blink && ['open', 'happy2', 'look'].includes(expr)) { for (const x of [L, R]) { g.beginPath(); g.moveTo(x - W * 0.08, ey); g.lineTo(x + W * 0.08, ey); g.stroke(); } g.restore(); return; }
  switch (expr) {
    case 'boot': {
      const n = Math.floor(T * 4) % 4;
      for (let i = 0; i < 3; i++) { g.globalAlpha = i < n ? 1 : 0.25; g.beginPath(); g.arc(W * (0.35 + i * 0.15), H * 0.5, H * 0.07, 0, 7); g.fill(); }
      g.globalAlpha = 1; break;
    }
    case 'happy': for (const x of [L, R]) { g.beginPath(); g.arc(x, ey + H * 0.12, W * 0.09, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); } break;
    case 'love': heart(L, ey, H * 0.2); heart(R, ey, H * 0.2); break;
    case 'huh': rr(L, ey, W * 0.12, H * 0.34); rr(R, ey + H * 0.04, W * 0.14, H * 0.12);
      g.beginPath(); g.moveTo(L - W * 0.08, ey - H * 0.32); g.lineTo(L + W * 0.07, ey - H * 0.28); g.lineWidth = H * 0.06; g.stroke(); break;
    case 'error': {
      g.lineWidth = H * 0.05;
      for (const x of [L, R]) { g.beginPath(); for (let a = 0; a < 14; a += 0.25) { const r = a * H * 0.022; const ang = a + T * 8 * (x === L ? 1 : -1); const px = x + Math.cos(ang) * r, py = ey + Math.sin(ang) * r; if (a === 0) g.moveTo(px, py); else g.lineTo(px, py); } g.stroke(); }
      break;
    }
    case 'scan': { rr(W * 0.5, ey, W * 0.6, H * 0.12); g.globalAlpha = 0.9; const x = W * (0.25 + 0.5 * (0.5 + 0.5 * Math.sin(T * 5))); g.fillStyle = '#fff'; rr(x, ey, W * 0.08, H * 0.14); g.globalAlpha = 1; break; }
    case 'cover': for (const x of [L, R]) { g.beginPath(); g.moveTo(x - W * 0.08, ey); g.lineTo(x + W * 0.08, ey); g.stroke(); } break;
    case 'sleep': for (const x of [L, R]) { g.beginPath(); g.arc(x, ey - H * 0.05, W * 0.07, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); } break;
    case 'look': rr(L + W * 0.04, ey, W * 0.12, H * 0.32); rr(R + W * 0.04, ey, W * 0.12, H * 0.32); break;
    default: rr(L, ey, W * 0.12, H * 0.32); rr(R, ey, W * 0.12, H * 0.32);
  }
  // mouth
  if (['happy', 'love', 'open', 'look'].includes(expr)) { g.lineWidth = H * 0.06; g.beginPath(); g.arc(W * 0.5, H * 0.68, W * 0.07, Math.PI * 0.2, Math.PI * 0.8); g.stroke(); }
  if (expr === 'error') { g.lineWidth = H * 0.05; g.beginPath(); g.moveTo(W * 0.42, H * 0.8); for (let i = 1; i <= 4; i++) g.lineTo(W * 0.42 + i * W * 0.04, H * (i % 2 ? 0.74 : 0.8)); g.stroke(); }
  g.restore();
}

// ---------------------------------------------------------------- rigs
const rigs = [];
class Rig {
  constructor() {
    this.root = new THREE.Group();
    this.act = 'idle'; this.actT = 0; this.expr = 'smile'; this.exprBase = 'smile';
    this.target = null; this.speed = 1; this.faceY = 0; this.blinkT = rnd(1, 4); this.blinking = false;
    this.cur = {}; this.extraSpin = 0; this.lookAt = null;
    rigs.push(this);
  }
  play(name, dur = 0) {
    this.act = name; this.actT = 0;
    if (dur > 0) { const token = {}; this._tok = token; return wait(dur).then(() => { if (this._tok === token) { this.act = this.walking ? 'walk' : 'idle'; } }); }
    return Promise.resolve();
  }
  say(expr, dur = 0) {
    this.setExpr(expr);
    if (dur > 0) { const tok = {}; this._etok = tok; wait(dur).then(() => { if (this._etok === tok) this.setExpr(this.exprBase); }); }
  }
  walkTo(x, z, speed = 1.2, faceY = null) {
    this.target = new THREE.Vector3(x, 0, z); this.speed = speed; this.walking = true;
    this.afterFace = faceY;
    if (this.act === 'idle' || this.act === 'walk') this.act = 'walk';
    return until(() => !this.walking);
  }
  turnTo(y) { this.faceY = y; }
  face(vec) { const d = vec.clone().sub(this.root.position); this.faceY = Math.atan2(d.x, d.z); }
  baseUpdate(dt) {
    this.actT += dt;
    if (this.target) {
      const p = this.root.position, d = this.target.clone().sub(p); d.y = 0;
      const dist = d.length();
      if (dist < 0.03) { this.target = null; this.walking = false; if (this.act === 'walk') this.act = 'idle'; if (this.afterFace != null) this.faceY = this.afterFace; }
      else { const step = Math.min(dist, this.speed * dt); p.addScaledVector(d.normalize(), step); this.faceY = Math.atan2(d.x, d.z); }
    }
    // rotate toward faceY
    let a = this.faceY - this.root.rotation.y;
    while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2;
    this.root.rotation.y += a * Math.min(1, dt * 7);
    // blink
    this.blinkT -= dt;
    if (this.blinkT < 0) { if (!this.blinking) { this.blinking = true; this.blinkT = 0.12; } else { this.blinking = false; this.blinkT = rnd(2, 5); } this.drawFace(); }
  }
  setExpr(e) { this.expr = e; this.drawFace(); }
  applyPose(P, dt) {
    const k = Math.min(1, dt * 14);
    for (const key in P) { const c = this.cur[key] ?? 0; this.cur[key] = c + (P[key] - c) * k; }
  }
}

const SKIN = '#f6cfb0';
class Person extends Rig {
  constructor(o) {
    super();
    this.o = Object.assign({ skin: SKIN, hair: '#5a3622', brow: '#4a2a18', shirt: '#ffd23f', pants: '#3f6fb5', shoes: '#ffffff', kid: true, height: 1.1, girl: false, sleeve: null }, o);
    const k = this.o.kid;
    const dims = k ? { leg: 0.36, tor: 0.30, torR: 0.15, head: 0.165, arm: 0.30, armR: 0.045, legR: 0.06 }
      : { leg: 0.82, tor: 0.52, torR: 0.2, head: 0.135, arm: 0.6, armR: 0.055, legR: 0.075 };
    const s = this.o.height / (k ? 1.1 : 1.8);
    this.d = dims; this.s = s;
    const skinM = new THREE.MeshStandardMaterial({ color: this.o.skin, roughness: 0.6 });
    const shirtM = new THREE.MeshStandardMaterial({ color: this.o.shirt, roughness: 0.85 });
    const pantsM = new THREE.MeshStandardMaterial({ color: this.o.pants, roughness: 0.9, map: noiseTex(64, 64, '#ffffff', ['#cccccc', '#999999'], 800, [3, 3]) });
    const shoeM = new THREE.MeshStandardMaterial({ color: this.o.shoes, roughness: 0.5 });
    const hairM = new THREE.MeshStandardMaterial({ color: this.o.hair, roughness: 0.55 });
    this.mats = { skinM, shirtM, pantsM, hairM };
    const body = new THREE.Group(); this.root.add(body); this.body = body; body.scale.setScalar(s);
    const hips = new THREE.Group(); hips.position.y = dims.leg; body.add(hips); this.hips = hips;
    this.legs = [];
    for (const sx of [-1, 1]) {
      const pv = new THREE.Group(); pv.position.set(sx * dims.torR * 0.5, 0, 0); hips.add(pv);
      mesh(new THREE.CapsuleGeometry(dims.legR, dims.leg - dims.legR * 2 - 0.04, 6, 12), pantsM, 0, -dims.leg / 2 + 0.02, 0, pv);
      mesh(rbox(dims.legR * 2.1, 0.06, dims.legR * 3.4, 0.025), shoeM, 0, -dims.leg + 0.03, dims.legR * 0.6, pv);
      this.legs.push(pv);
    }
    const torso = mesh(new THREE.CapsuleGeometry(dims.torR, dims.tor - dims.torR, 8, 16), this.o.girl ? pantsM : shirtM, 0, dims.tor / 2, 0, hips);
    torso.scale.set(1, 1, 0.78);
    if (this.o.girl) {
      // overalls over shirt: shirt shoulders
      const sh = mesh(new THREE.SphereGeometry(dims.torR * 1.02, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), shirtM, 0, dims.tor - dims.torR * 0.55, 0, hips); sh.scale.set(1, 1, 0.8);
      for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(0.012, 8, 6), M.chrome, sx * 0.06, dims.tor * 0.75, dims.torR * 0.78, hips);
      const pocket = mesh(rbox(0.1, 0.07, 0.02, 0.01), pantsM, 0, dims.tor * 0.55, dims.torR * 0.76, hips);
    } else if (!k) {
      // dad: belt
      mesh(new THREE.CylinderGeometry(dims.torR * 1.0, dims.torR * 1.0, 0.04, 20), new THREE.MeshStandardMaterial({ color: 0x4a3324, roughness: 0.6 }), 0, 0.04, 0, hips).scale.z = 0.8;
      const pantsTop = mesh(new THREE.CylinderGeometry(dims.torR * 0.98, dims.torR * 0.9, 0.12, 20), pantsM, 0, -0.02, 0, hips); pantsTop.scale.z = 0.8;
    }
    const chest = new THREE.Group(); chest.position.y = dims.tor * 0.92; hips.add(chest); this.chest = chest;
    this.arms = [];
    for (const sx of [-1, 1]) {
      const pv = new THREE.Group(); pv.position.set(sx * (dims.torR + dims.armR * 0.6), 0, 0); chest.add(pv);
      mesh(new THREE.CapsuleGeometry(dims.armR * 1.05, dims.arm * 0.35, 6, 10), shirtM, 0, -dims.arm * 0.2, 0, pv);
      mesh(new THREE.CapsuleGeometry(dims.armR * 0.85, dims.arm * 0.6, 6, 10), skinM, 0, -dims.arm * 0.55, 0, pv);
      const hand = mesh(new THREE.SphereGeometry(dims.armR * 1.3, 12, 10), skinM, 0, -dims.arm, 0, pv);
      pv.userData.hand = hand;
      this.arms.push(pv);
    }
    const head = new THREE.Group(); head.position.y = dims.head * 1.0 + 0.03; chest.add(head); this.head = head;
    mesh(new THREE.CylinderGeometry(dims.armR, dims.armR, 0.08, 10), skinM, 0, -dims.head * 0.9, 0, head);
    // face
    this.fc = makeCanvas(512, 256); this.fg = this.fc.getContext('2d'); this.ft = tex(this.fc);
    const faceM = new THREE.MeshStandardMaterial({ map: this.ft, roughness: 0.55 });
    const hm = mesh(new THREE.SphereGeometry(dims.head, 40, 24), faceM, 0, 0, 0, head);
    hm.scale.set(1, k ? 0.98 : 1.12, 0.96);
    this.headMesh = hm;
    // ears
    for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(dims.head * 0.2, 10, 8), skinM, sx * dims.head * 0.98, -dims.head * 0.05, 0, head).scale.set(0.5, 1, 0.8);
    // nose
    mesh(new THREE.SphereGeometry(dims.head * 0.1, 10, 8), skinM, 0, -dims.head * 0.08, dims.head * 0.95, head);
    // hair
    const hy = k ? 0.98 : 1.12;
    const cap = mesh(new THREE.SphereGeometry(dims.head * 1.06, 32, 16, 0, Math.PI * 2, 0, Math.PI * (this.o.girl ? 0.36 : 0.3)), hairM, 0, dims.head * 0.04, 0, head);
    cap.scale.set(1, hy, 1);
    const backHair = mesh(new THREE.SphereGeometry(dims.head * 1.07, 32, 16, Math.PI * 1.05, Math.PI * 0.9, 0, Math.PI * (this.o.girl ? 0.75 : 0.6)), hairM, 0, 0, 0, head);
    backHair.scale.set(1, hy, 1);
    if (this.o.girl) {
      for (const sx of [-1, 1]) {
        const tail = new THREE.Group(); tail.position.set(sx * dims.head * 1.0, dims.head * 0.15, -dims.head * 0.2); head.add(tail);
        mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff5f8f, roughness: 0.5 }), 0, 0, 0, tail);
        const pt = mesh(new THREE.SphereGeometry(0.07, 14, 10), hairM, sx * 0.05, -0.08, 0, tail); pt.scale.set(0.8, 1.35, 0.8);
        this['tail' + sx] = tail;
      }
      // bangs
      const bang = mesh(new THREE.SphereGeometry(dims.head * 1.08, 24, 8, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.2, Math.PI * 0.12), hairM, 0, 0, 0, head);
      bang.scale.set(1, hy, 1); bang.rotation.y = Math.PI;
    }
    if (this.o.glasses) {
      const gm = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3 });
      for (const sx of [-1, 1]) { const r = mesh(new THREE.TorusGeometry(dims.head * 0.22, 0.006, 6, 20), gm, sx * dims.head * 0.34, dims.head * 0.06, dims.head * 0.95, head); }
      mesh(new THREE.CylinderGeometry(0.004, 0.004, dims.head * 0.24, 4), gm, 0, dims.head * 0.08, dims.head * 1.0, head).rotation.z = Math.PI / 2;
    }
    this.hatSlot = new THREE.Group(); this.hatSlot.position.y = dims.head * (k ? 0.82 : 1.0); head.add(this.hatSlot);
    this.drawFace();
  }
  drawFace() {
    drawPersonFace(this.fg, 512, 256, this.expr, this.blinking && !['laugh', 'cover', 'dizzy', 'proud'].includes(this.expr), this.o);
    this.ft.needsUpdate = true;
  }
  handWorld(i = 1) { const v = new THREE.Vector3(); this.arms[i].userData.hand.getWorldPosition(v); return v; }
  update(dt) {
    this.baseUpdate(dt);
    const t = this.actT, P = { legA: 0, legB: 0, aAx: 0, aAz: -0.12, aBx: 0, aBz: 0.12, hx: 0, hy: 0, hz: 0, lean: 0, tilt: 0, lift: 0, sit: 0 };
    const br = Math.sin(T * 2.2 + this.root.id) * 0.02;
    P.hz = Math.sin(T * 0.9 + this.root.id) * 0.05; P.lean = br;
    const walk = this.walking;
    if (walk) { const w = Math.sin(T * 10 * Math.min(1.4, this.speed)); P.legA = w * 0.6; P.legB = -w * 0.6; P.aAx = -w * 0.5; P.aBx = w * 0.5; P.lift = Math.abs(w) * 0.03; }
    switch (this.act) {
      case 'wave': P.aBz = 2.7 + Math.sin(t * 12) * 0.35; P.hz = 0.15; break;
      case 'clap': P.aAx = P.aBx = -1.35; P.aAz = 0.35 + Math.sin(t * 16) * 0.3; P.aBz = -P.aAz; break;
      case 'cheer': P.aAz = -2.6; P.aBz = 2.6; P.lift = Math.abs(Math.sin(t * 8)) * 0.14; P.hx = -0.15; break;
      case 'jump': P.lift = Math.abs(Math.sin(t * 7)) * 0.18; P.aAz = -1.2; P.aBz = 1.2; break;
      case 'cover': P.aAx = P.aBx = -2.75; P.aAz = 0.45; P.aBz = -0.45; P.hx = 0.2; break;
      case 'laugh': P.lean = -0.12 + Math.sin(t * 20) * 0.04; P.aAx = P.aBx = -0.7; P.aAz = 0.5; P.aBz = -0.5; P.hx = -0.25; break;
      case 'tug': P.lean = -0.35 + Math.sin(t * 25) * 0.05; P.aAx = P.aBx = -1.2; P.aAz = 0.2; P.aBz = -0.2; P.legA = -0.4; P.legB = 0.3; break;
      case 'carry': P.aAx = P.aBx = -1.2; P.aAz = 0.25; P.aBz = -0.25; P.lean = -0.08 + Math.sin(t * 6) * 0.04; P.tilt = Math.sin(t * 3) * 0.08; break;
      case 'sit': P.sit = 1; P.legA = P.legB = -1.45; P.aAx = P.aBx = 0.4; P.lean = -0.1; break;
      case 'slip': { const k = clamp(t / 0.7, 0, 1); P.lift = Math.sin(k * Math.PI) * 0.35 + 0; P.legA = P.legB = -1.5 * k; P.lean = -0.9 * Math.sin(k * Math.PI); P.aAz = -2.2; P.aBz = 2.2; P.sit = k; break; }
      case 'point': P.aBx = -1.5; P.aBz = 0.1; break;
      case 'reach': P.aBx = -1.3; P.aBz = 0.05; P.lean = 0.08; break;
      case 'squeeze': P.aAx = P.aBx = -1.5 + Math.sin(t * 14) * 0.15; P.aAz = 0.35; P.aBz = -0.35; P.lean = 0.12; break;
      case 'dance': P.aAz = -1.5 + Math.sin(t * 8) * 1.0; P.aBz = 1.5 + Math.sin(t * 8) * 1.0; P.tilt = Math.sin(t * 4) * 0.15; P.lift = Math.abs(Math.sin(t * 8)) * 0.08; P.hz = Math.sin(t * 4) * 0.2; P.legA = Math.sin(t * 8) * 0.25; P.legB = -P.legA; break;
      case 'crouch': P.sit = 1; P.legA = P.legB = -1.5; P.aAx = P.aBx = -1.2; P.aAz = 0.3; P.aBz = -0.3; P.hx = 0.3; P.lean = 0.25; break;
      case 'think': P.aBx = -2.3; P.aBz = -0.4; P.hz = 0.2; break;
      case 'scoop': P.aAx = P.aBx = -1.0 + Math.sin(t * 6) * 0.4; P.aAz = 0.3; P.aBz = -0.3; P.lean = 0.25; break;
      case 'thumbs': P.aBx = -1.3; P.aBz = 0.4; P.hz = 0.15; break;
      case 'stand': break;
    }
    this.applyPose(P, dt);
    const c = this.cur, d = this.d;
    this.legs[0].rotation.x = c.legA; this.legs[1].rotation.x = c.legB;
    this.arms[0].rotation.x = c.aAx; this.arms[0].rotation.z = c.aAz;
    this.arms[1].rotation.x = c.aBx; this.arms[1].rotation.z = c.aBz;
    this.head.rotation.set(c.hx, c.hy, c.hz);
    this.hips.rotation.x = c.lean; this.hips.rotation.z = c.tilt;
    this.hips.position.y = d.leg * (1 - c.sit * 0.82) + c.lift;
    if (this.tail1) { this.tail1.rotation.z = Math.sin(T * 3) * 0.1 + c.lift * 2; this['tail-1'].rotation.z = -Math.sin(T * 3) * 0.1 - c.lift * 2; }
  }
}

class Robot extends Rig {
  constructor(o = {}) {
    super();
    this.o = Object.assign({ accent: M.blue, eye: '#6ef0ff', scale: 1 }, o);
    this.fold = 0;
    const body = new THREE.Group(); this.root.add(body); this.body = body; body.scale.setScalar(this.o.scale);
    const acc = this.o.accent;
    // legs
    this.legs = [];
    for (const sx of [-1, 1]) {
      const pv = new THREE.Group(); pv.position.set(sx * 0.12, 0.33, 0); body.add(pv);
      const seg = mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.22, 16), M.metal, 0, -0.12, 0, pv);
      mesh(new THREE.SphereGeometry(0.06, 14, 10), M.rubber, 0, 0, 0, pv);
      mesh(new THREE.TorusGeometry(0.055, 0.012, 8, 20), acc, 0, -0.16, 0, pv).rotation.x = Math.PI / 2;
      const foot = mesh(rbox(0.13, 0.07, 0.2, 0.03), M.metal, 0, -0.28, 0.03, pv);
      this.legs.push(pv);
    }
    const torso = new THREE.Group(); torso.position.y = 0.36; body.add(torso); this.torso = torso;
    mesh(rbox(0.46, 0.44, 0.34, 0.08, 4), M.metal, 0, 0.24, 0, torso);
    mesh(rbox(0.3, 0.2, 0.02, 0.03), M.screen, 0, 0.27, 0.17, torso);
    this.leds = [];
    const ledCols = [0xff5a5a, 0xffd23a, 0x5aff8a];
    for (let i = 0; i < 3; i++) {
      const lm = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: ledCols[i], emissiveIntensity: 1.5 });
      const l = mesh(new THREE.SphereGeometry(0.022, 12, 8), lm, -0.08 + i * 0.08, 0.3, 0.18, torso); this.leds.push(lm);
    }
    const dial = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16), acc, 0.0, 0.21, 0.185, torso); dial.rotation.x = Math.PI / 2;
    // vents
    for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(0.02, 0.12, 0.01), M.metalDark, -0.24, 0.24 + (i - 1) * 0.0, 0.05 * (i - 1), torso).rotation.y = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.06, 20), M.metalDark, 0, 0.01, 0, torso);
    // arms
    this.arms = [];
    for (const sx of [-1, 1]) {
      const pv = new THREE.Group(); pv.position.set(sx * 0.27, 0.38, 0); torso.add(pv);
      mesh(new THREE.SphereGeometry(0.065, 16, 12), acc, 0, 0, 0, pv);
      mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 14), M.metal, 0, -0.1, 0, pv);
      const el = new THREE.Group(); el.position.y = -0.2; pv.add(el);
      mesh(new THREE.SphereGeometry(0.045, 12, 10), M.rubber, 0, 0, 0, el);
      mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.14, 14), M.metal, 0, -0.08, 0, el);
      const hand = new THREE.Group(); hand.position.y = -0.18; el.add(hand);
      mesh(new THREE.SphereGeometry(0.055, 14, 10), M.metal, 0, 0, 0, hand).scale.set(1, 0.85, 0.75);
      mesh(new THREE.CapsuleGeometry(0.016, 0.04, 4, 8), acc, sx * -0.045, 0.005, 0.02, hand).rotation.z = sx * 0.6;
      pv.userData.el = el; pv.userData.hand = hand;
      this.arms.push(pv);
    }
    // neck & head
    const neck = new THREE.Group(); neck.position.y = 0.46; torso.add(neck); this.neck = neck;
    for (let i = 0; i < 3; i++) mesh(new THREE.TorusGeometry(0.05, 0.015, 8, 16), M.rubber, 0, 0.01 + i * 0.022, 0, neck).rotation.x = Math.PI / 2;
    const head = new THREE.Group(); head.position.y = 0.24; neck.add(head); this.head = head;
    mesh(rbox(0.44, 0.34, 0.34, 0.09, 4), M.metal, 0, 0, 0, head);
    mesh(rbox(0.36, 0.24, 0.03, 0.06), M.screen, 0, -0.005, 0.163, head);
    this.fc = makeCanvas(256, 160); this.fg = this.fc.getContext('2d'); this.ft = tex(this.fc);
    const fm = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: this.ft, emissiveIntensity: 1.4, roughness: 0.1, metalness: 0.0 });
    const face = mesh(new THREE.PlaneGeometry(0.31, 0.2), fm, 0, -0.005, 0.18, head, false);
    this.faceMat = fm;
    for (const sx of [-1, 1]) {
      const ear = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 20), acc, sx * 0.235, 0, 0, head); ear.rotation.z = Math.PI / 2;
      mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 16), M.chrome, sx * 0.25, 0, 0, head).rotation.z = Math.PI / 2;
    }
    mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 6), M.chrome, 0, 0.23, 0, head);
    this.antM = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff6b4a, emissiveIntensity: 1.5 });
    this.ant = mesh(new THREE.SphereGeometry(0.03, 14, 10), this.antM, 0, 0.31, 0, head);
    this.hatSlot = new THREE.Group(); this.hatSlot.position.y = 0.17; head.add(this.hatSlot);
    this.expr = 'off'; this.drawFace();
  }
  drawFace() { drawRobotFace(this.fg, 256, 160, this.expr, this.blinking, this.o.eye); this.ft.needsUpdate = true; }
  handWorld(i = 1) { const v = new THREE.Vector3(); this.arms[i].userData.hand.getWorldPosition(v); return v; }
  update(dt) {
    this.baseUpdate(dt);
    if (['boot', 'error', 'scan'].includes(this.expr)) this.drawFace();
    const t = this.actT;
    const P = { legA: 0, legB: 0, aAx: 0, aAz: -0.15, aBx: 0, aBz: 0.15, eA: -0.2, eB: -0.2, hx: 0, hy: 0, hz: 0, lift: 0, tilt: 0, lean: 0, jx: 0, jz: 0 };
    P.lift = Math.sin(T * 2.4 + this.root.id) * 0.008; P.hz = Math.sin(T * 0.8) * 0.04;
    if (this.walking) { const w = Math.sin(T * 12); P.legA = w * 0.5; P.legB = -w * 0.5; P.aAx = -w * 0.4; P.aBx = w * 0.4; P.tilt = w * 0.05; }
    switch (this.act) {
      case 'wave': P.aBz = 2.6; P.eB = -0.6 + Math.sin(t * 12) * 0.5; P.hz = -0.15; break;
      case 'dance': P.aAz = -1.2 + Math.sin(t * 9) * 0.9; P.aBz = 1.2 + Math.sin(t * 9) * 0.9; P.eA = P.eB = -1.2; P.tilt = Math.sin(t * 4.5) * 0.18; P.lift = Math.abs(Math.sin(t * 9)) * 0.06; P.hz = Math.sin(t * 4.5) * 0.25; break;
      case 'robot': { const s = Math.floor(t * 4) % 4; P.aAx = s === 0 ? -1.5 : 0; P.aBx = s === 2 ? -1.5 : 0; P.eA = s === 1 ? -1.5 : -0.2; P.eB = s === 3 ? -1.5 : -0.2; P.hy = [0.4, 0, -0.4, 0][s]; P.lift = s % 2 ? 0.03 : 0; break; }
      case 'jump': P.lift = Math.abs(Math.sin(t * 8)) * 0.16; P.aAz = -2.5; P.aBz = 2.5; P.eA = P.eB = -0.3; break;
      case 'huh': P.hz = 0.38; P.aBx = -1.0; P.aBz = 0.5; P.eB = -2.0; break;
      case 'take': P.aBx = -1.25; P.eB = -0.35; P.aAx = -1.0; P.eA = -0.6; P.aAz = 0.2; break;
      case 'dry': P.aAx = P.aBx = -1.1; P.eA = -1.0 + Math.sin(t * 14) * 0.3; P.eB = -1.0 - Math.sin(t * 14) * 0.3; P.aAz = 0.35; P.aBz = -0.35; break;
      case 'error': P.jx = rnd(-1, 1) * 0.02; P.jz = rnd(-1, 1) * 0.02; P.aAz = -1.5 + Math.sin(t * 17) * 1.2; P.aBz = 1.5 + Math.cos(t * 15) * 1.2; P.hz = Math.sin(t * 13) * 0.3; P.hy = Math.sin(t * 7) * 0.5; P.lift = Math.abs(Math.sin(t * 11)) * 0.04; break;
      case 'dizzy': P.hz = Math.sin(t * 3) * 0.25; P.hx = Math.cos(t * 3) * 0.15; P.aAz = -0.4; P.aBz = 0.4; P.tilt = Math.sin(t * 3) * 0.06; break;
      case 'cover': P.aAx = P.aBx = -2.3; P.eA = P.eB = -1.6; P.aAz = 0.35; P.aBz = -0.35; P.hx = 0.25; break;
      case 'scan': P.hx = -0.1; P.hy = Math.sin(t * 1.2) * 0.4; P.aAx = P.aBx = 0.3; break;
      case 'clap': P.aAx = P.aBx = -1.3; P.eA = P.eB = -0.4; P.aAz = 0.45 + Math.sin(t * 16) * 0.25; P.aBz = -P.aAz; break;
      case 'happy': P.lift = Math.abs(Math.sin(t * 8)) * 0.08; P.aAz = -0.9 + Math.sin(t * 8) * 0.3; P.aBz = 0.9 - Math.sin(t * 8) * 0.3; P.eA = P.eB = -0.8; P.hz = Math.sin(t * 8) * 0.12; break;
      case 'look': P.hy = Math.sin(t * 1.5) * 0.6; P.hx = -0.1; break;
      case 'shake': P.hy = Math.sin(t * 30) * 0.3; P.tilt = Math.sin(t * 30) * 0.08; P.aAz = -0.6; P.aBz = 0.6; break;
      case 'blow': P.hx = -0.25; P.aAz = -0.4; P.aBz = 0.4; break;
    }
    this.applyPose(P, dt);
    const c = this.cur, f = this.fold;
    this.legs[0].rotation.x = c.legA; this.legs[1].rotation.x = c.legB;
    this.legs[0].scale.y = this.legs[1].scale.y = 1 - f * 0.55;
    this.arms[0].rotation.x = c.aAx * (1 - f) + f * -0.5; this.arms[0].rotation.z = c.aAz * (1 - f) + f * 0.9;
    this.arms[1].rotation.x = c.aBx * (1 - f) + f * -0.5; this.arms[1].rotation.z = c.aBz * (1 - f) + f * -0.9;
    this.arms[0].userData.el.rotation.x = c.eA * (1 - f) + f * -2.2; this.arms[1].userData.el.rotation.x = c.eB * (1 - f) + f * -2.2;
    this.head.rotation.set(c.hx + f * 0.35, c.hy, c.hz);
    this.neck.scale.y = 1 - f * 0.7; this.head.position.y = 0.24 - f * 0.12;
    this.torso.position.set(c.jx, 0.36 - f * 0.17 + c.lift, c.jz);
    this.torso.rotation.z = c.tilt;
    // leds
    for (let i = 0; i < 3; i++) this.leds[i].emissiveIntensity = this.expr === 'off' ? 0 : (Math.sin(T * 4 + i * 2) > 0 ? 2 : 0.3);
    this.antM.emissiveIntensity = this.expr === 'off' ? 0 : 1 + Math.sin(T * 6) * 0.8;
  }
}

// ---------------------------------------------------------------- characters
const girl = new Person({ girl: true, shirt: '#ffd23f', pants: '#4a78c2', hair: '#4a2c1a', height: 1.1 });
const brother = new Person({ kid: true, shirt: '#58c28a', pants: '#6b5a4a', hair: '#3a2416', height: 0.95, shoes: '#ff6a4a' });
const dad = new Person({ kid: false, shirt: '#7ab0d8', pants: '#3b4f6e', hair: '#2e2018', brow: '#2e2018', height: 1.8, glasses: true, shoes: '#5a4030' });
dad.mats.shirtM.map = noiseTex(64, 64, '#ffffff', ['#bbbbbb'], 600, [2, 2]);
const robot = new Robot();
const robot2 = new Robot({ accent: M.orange, eye: '#ffd36e', scale: 0.72 });
for (const r of [girl, brother, dad, robot, robot2]) scene.add(r.root);
brother.root.visible = false; dad.root.visible = false; robot2.root.visible = false;

// hats
function makeHats() {
  const h1 = new THREE.Group(); // silver helmet with antenna
  { const d = mesh(new THREE.SphereGeometry(0.185, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), M.metal, 0, -0.03, 0, h1); d.scale.set(1, 0.75, 1);
    mesh(new THREE.TorusGeometry(0.183, 0.015, 8, 30), M.blue, 0, -0.03, 0, h1).rotation.x = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 6), M.chrome, 0, 0.18, 0, h1);
    mesh(new THREE.SphereGeometry(0.025, 12, 8), new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff5040, emissiveIntensity: 1.6 }), 0, 0.27, 0, h1);
    for (const sx of [-1, 1]) mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 14), M.blue, sx * 0.18, -0.06, 0, h1).rotation.z = Math.PI / 2; }
  const h2 = new THREE.Group(); // cardboard box hat
  { mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), [cardboardMat('side'), cardboardMat('side'), cardboardMat('none'), cardboardMat('none'), cardboardMat('front'), cardboardMat('none')], 0, 0.06, 0, h2);
    mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.14, 4), M.chrome, 0.08, 0.22, 0, h2);
    mesh(new THREE.SphereGeometry(0.022, 10, 8), M.orange, 0.08, 0.3, 0, h2); }
  const h3 = new THREE.Group(); // orange mechanic cap
  { const capM = new THREE.MeshStandardMaterial({ color: 0xff7f2a, roughness: 0.8 });
    const d = mesh(new THREE.SphereGeometry(0.18, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), capM, 0, -0.03, 0, h3); d.scale.set(1, 0.72, 1);
    const bill = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.015, 24, 1, false, -Math.PI / 2, Math.PI), capM, 0, -0.03, 0.12, h3); bill.scale.set(1, 1, 0.9);
    const badge = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 6), M.metal, 0, 0.04, 0.155, h3); badge.rotation.x = Math.PI / 2 - 0.5; }
  return [h1, h2, h3];
}
const hats = makeHats();

// small toys / props
function makeTeddy() {
  const g = new THREE.Group();
  mesh(new THREE.SphereGeometry(0.12, 16, 12), M.teddy, 0, 0.12, 0, g).scale.set(1, 1.1, 0.9);
  mesh(new THREE.SphereGeometry(0.09, 16, 12), M.teddy, 0, 0.3, 0, g);
  for (const sx of [-1, 1]) { mesh(new THREE.SphereGeometry(0.035, 10, 8), M.teddy, sx * 0.07, 0.38, 0, g); mesh(new THREE.SphereGeometry(0.045, 10, 8), M.teddy, sx * 0.12, 0.15, 0.03, g); }
  mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8c9a0, roughness: 1 }), 0, 0.28, 0.075, g);
  for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(0.012, 8, 6), M.black, sx * 0.035, 0.32, 0.075, g);
  return g;
}
function makeBall() {
  const g = new THREE.Group();
  const c = makeCanvas(256, 128), x = c.getContext('2d');
  const cols = ['#ff4a4a', '#ffffff', '#3d7be0', '#ffd23a', '#ffffff', '#4ac46a'];
  for (let i = 0; i < 6; i++) { x.fillStyle = cols[i]; x.fillRect(i * 256 / 6, 0, 256 / 6 + 1, 128); }
  mesh(new THREE.SphereGeometry(0.16, 24, 16), new THREE.MeshPhysicalMaterial({ map: tex(c), roughness: 0.3, clearcoat: 0.8 }), 0, 0.16, 0, g);
  return g;
}
function makeDuck() {
  const g = new THREE.Group();
  mesh(new THREE.SphereGeometry(0.06, 16, 12), M.duck, 0, 0.045, 0, g).scale.set(1.15, 0.8, 0.9);
  mesh(new THREE.SphereGeometry(0.038, 14, 10), M.duck, 0.04, 0.1, 0, g);
  const b = mesh(new THREE.ConeGeometry(0.018, 0.04, 10), M.beak, 0.085, 0.095, 0, g); b.rotation.z = -Math.PI / 2;
  for (const sz of [-1, 1]) mesh(new THREE.SphereGeometry(0.007, 6, 6), M.black, 0.065, 0.11, sz * 0.022, g);
  return g;
}

// ---------------------------------------------------------------- the delivery box
function makeDeliveryBox(w = 0.95, h = 0.85, d = 0.8) {
  const g = new THREE.Group();
  const th = 0.012;
  const walls = [];
  walls.push(mesh(new THREE.BoxGeometry(w, h, th), [cardboardInner, cardboardInner, cardboardInner, cardboardInner, cardboardMat('front'), cardboardInner], 0, h / 2, d / 2, g));
  walls.push(mesh(new THREE.BoxGeometry(w, h, th), [cardboardInner, cardboardInner, cardboardInner, cardboardInner, cardboardInner, cardboardMat('back')], 0, h / 2, -d / 2, g));
  walls.push(mesh(new THREE.BoxGeometry(th, h, d), [cardboardMat('side'), cardboardInner, cardboardInner, cardboardInner, cardboardInner, cardboardInner], w / 2, h / 2, 0, g));
  walls.push(mesh(new THREE.BoxGeometry(th, h, d), [cardboardInner, cardboardMat('side'), cardboardInner, cardboardInner, cardboardInner, cardboardInner], -w / 2, h / 2, 0, g));
  mesh(new THREE.BoxGeometry(w, th, d), cardboardInner, 0, th / 2, 0, g);
  // flaps: front/back long flaps (on top), left/right short (below)
  const flaps = [];
  const mk = (px, pz, fw, fd, axis, sign, y) => {
    const pv = new THREE.Group(); pv.position.set(px, h + y, pz); g.add(pv);
    const m = mesh(new THREE.BoxGeometry(fw, th, fd), [cardboardInner, cardboardInner, cardboardMat('none'), cardboardInner, cardboardInner, cardboardInner], axis === 'x' ? 0 : -sign * fw / 2, 0, axis === 'x' ? -sign * fd / 2 : 0, pv);
    const f = { pv, m, axis, sign, open: 0, target: 0, jig: 0 };
    flaps.push(f); return f;
  };
  mk(-w / 2, 0, w * 0.49, d * 0.98, 'z', -1, 0.0);
  mk(w / 2, 0, w * 0.49, d * 0.98, 'z', 1, 0.0);
  mk(0, d / 2, w, d / 2, 'x', 1, th);
  mk(0, -d / 2, w, d / 2, 'x', -1, th);
  // tapes: seam (x) + two cross straps (z)
  const tapes = [];
  const mkTape = (x, z, len, alongX) => {
    const pv = new THREE.Group(); pv.position.set(x, h + th * 2 + 0.003, z); g.add(pv);
    if (!alongX) pv.rotation.y = Math.PI / 2;
    const geo = new THREE.PlaneGeometry(1, 0.075); geo.translate(0.5, 0, 0);
    const laid = mesh(geo, M.tape.clone(), -len / 2, 0, 0, pv, false); laid.rotation.x = -Math.PI / 2; laid.scale.x = len;
    const curlGroup = new THREE.Group(); curlGroup.position.x = -len / 2; pv.add(curlGroup);
    const geo2 = new THREE.PlaneGeometry(1, 0.075); geo2.translate(-0.5, 0, 0);
    const curl = mesh(geo2, laid.material, 0, 0, 0, curlGroup, false); curl.rotation.x = -Math.PI / 2; curl.scale.x = 0.001;
    // overhang down the sides
    const hangGeo = new THREE.PlaneGeometry(0.12, 0.075);
    const hang1 = mesh(hangGeo, laid.material, -len / 2 - 0.004, -0.06, 0, pv, false); hang1.rotation.set(0, Math.PI / 2, Math.PI / 2);
    const hang2 = mesh(hangGeo, laid.material, len / 2 + 0.004, -0.06, 0, pv, false); hang2.rotation.set(0, Math.PI / 2, Math.PI / 2);
    // invisible fat hit area
    const hit = mesh(new THREE.BoxGeometry(len + 0.1, 0.16, 0.26), new THREE.MeshBasicMaterial({ visible: false }), 0, 0.03, 0, pv, false);
    const tp = { pv, laid, curlGroup, curl, hang1, hang2, hit, len, p: 0, done: false };
    tapes.push(tp); return tp;
  };
  mkTape(0, 0, w + 0.02, true);
  mkTape(-w * 0.3, 0, d + 0.02, false);
  mkTape(w * 0.3, 0, d + 0.02, false);
  const box = { g, flaps, tapes, w, h, d, walls };
  box.setTape = (tp, p) => {
    tp.p = p;
    const L = tp.len;
    tp.laid.position.x = -L / 2 + p * L; tp.laid.scale.x = Math.max(0.001, L * (1 - p));
    tp.curlGroup.position.x = -L / 2 + p * L; tp.curlGroup.position.y = 0.002;
    tp.curl.scale.x = Math.max(0.001, p * L * 0.6); tp.curlGroup.rotation.z = -0.9 - p * 0.6;
    tp.hang1.visible = p < 0.05;
  };
  box.updateFlaps = (dt) => {
    for (const f of flaps) {
      f.open += (f.target - f.open) * Math.min(1, dt * 6);
      f.jig = Math.max(0, f.jig - dt);
      const j = Math.sin(f.jig * 40) * f.jig * 0.4;
      const a = f.open * (Math.PI * 1.15) + j;
      if (f.axis === 'x') f.pv.rotation.x = f.sign * a; else f.pv.rotation.z = -f.sign * a * -1;
    }
  };
  return box;
}

// ---------------------------------------------------------------- particles (sprites)
function spriteTex(draw, s = 128) { const c = makeCanvas(s, s); draw(c.getContext('2d'), s); return tex(c); }
const sparkleTex = spriteTex((g, s) => {
  const c = s / 2;
  const gr = g.createRadialGradient(c, c, 0, c, c, c); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,250,220,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(c, 0); g.lineTo(c + 6, c - 6); g.lineTo(s, c); g.lineTo(c + 6, c + 6); g.lineTo(c, s); g.lineTo(c - 6, c + 6); g.lineTo(0, c); g.lineTo(c - 6, c - 6); g.closePath(); g.fill();
});
const starTex = spriteTex((g, s) => {
  g.fillStyle = '#ffd84a'; g.strokeStyle = '#ffb000'; g.lineWidth = 4; g.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.2 : s * 0.45, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r); }
  g.closePath(); g.fill(); g.stroke();
});
const heartTex = spriteTex((g, s) => {
  g.fillStyle = '#ff5f8f'; const x = s / 2, y = s / 2, k = s * 0.32;
  g.beginPath(); g.moveTo(x, y + k * 0.9); g.bezierCurveTo(x - k * 1.6, y - k * 0.2, x - k * 0.6, y - k * 1.4, x, y - k * 0.45); g.bezierCurveTo(x + k * 0.6, y - k * 1.4, x + k * 1.6, y - k * 0.2, x, y + k * 0.9); g.fill();
});
const noteTex = spriteTex((g, s) => {
  g.fillStyle = '#3d7be0'; g.beginPath(); g.ellipse(s * 0.38, s * 0.72, s * 0.16, s * 0.12, -0.4, 0, 7); g.fill();
  g.fillRect(s * 0.5, s * 0.18, s * 0.07, s * 0.55); g.beginPath(); g.moveTo(s * 0.5, s * 0.18); g.quadraticCurveTo(s * 0.8, s * 0.25, s * 0.75, s * 0.5); g.lineTo(s * 0.68, s * 0.45); g.quadraticCurveTo(s * 0.7, s * 0.32, s * 0.55, s * 0.3); g.fill();
});
const dropTex = spriteTex((g, s) => {
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.5, 'rgba(220,240,255,0.5)'); gr.addColorStop(1, 'rgba(220,240,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
});
const parts = [];
function burst(pos, texr, n = 8, o = {}) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.SpriteMaterial({ map: texr, transparent: true, depthWrite: false, opacity: 1 });
    const s = new THREE.Sprite(m); s.position.copy(pos);
    const sz = (o.size ?? 0.12) * rnd(0.7, 1.3); s.scale.setScalar(sz);
    const sp = o.speed ?? 1.2;
    const v = new THREE.Vector3(rnd(-1, 1), rnd(0.3, 1.2) * (o.up ?? 1), rnd(-1, 1)).normalize().multiplyScalar(sp * rnd(0.5, 1));
    scene.add(s);
    parts.push({ s, v, life: o.life ?? 1, t: 0, sz, g: o.g ?? 1.5, spin: rnd(-3, 3) });
  }
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt;
    p.v.y -= p.g * dt; p.s.position.addScaledVector(p.v, dt);
    p.s.material.rotation += p.spin * dt;
    const k = p.t / p.life; p.s.material.opacity = 1 - k * k;
    if (k >= 1) { scene.remove(p.s); p.s.material.dispose(); parts.splice(i, 1); }
  }
}

// ---------------------------------------------------------------- audio
let ac = null, master = null, noiseBuf = null, musicGain = null;
function initAudio() {
  if (ac) { if (ac.state !== 'running') ac.resume(); return; }
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = 0.9;
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ac.destination);
  musicGain = ac.createGain(); musicGain.gain.value = 0.0; musicGain.connect(master);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.5, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // unlock
  const o = ac.createOscillator(), gg = ac.createGain(); gg.gain.value = 0; o.connect(gg); gg.connect(master); o.start(); o.stop(ac.currentTime + 0.05);
}
function tone({ f = 440, f2 = null, d = 0.2, type = 'sine', v = 0.2, a = 0.006, at = 0, vib = 0, vibF = 6, dest = null, q = null }) {
  if (!ac) return;
  const t0 = ac.currentTime + at;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
  if (vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = vibF; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + d + 0.05); }
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  let node = o;
  if (q) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = q; o.connect(fl); node = fl; }
  node.connect(g); g.connect(dest || master);
  o.start(t0); o.stop(t0 + d + 0.05);
}
function noise({ d = 0.2, v = 0.2, f = 1200, f2 = null, type = 'bandpass', Q = 1, at = 0, a = 0.005 }) {
  if (!ac) return null;
  const t0 = ac.currentTime + at;
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = Q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + d);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  s.connect(fl); fl.connect(g); g.connect(master); s.start(t0, Math.random()); s.stop(t0 + d + 0.05);
  return { s, g, fl };
}
const SFX = {
  tap() { tone({ f: 660, f2: 990, d: 0.08, v: 0.08 }); },
  pop() { tone({ f: rnd(700, 1300), f2: rnd(200, 400), d: 0.06, v: 0.14 }); noise({ d: 0.03, v: 0.05, f: 3000 }); },
  doorbell() { tone({ f: 784, d: 1.2, v: 0.25, type: 'triangle' }); tone({ f: 1568, d: 0.8, v: 0.05 }); tone({ f: 622, d: 1.5, v: 0.25, type: 'triangle', at: 0.55 }); tone({ f: 1244, d: 1, v: 0.05, at: 0.55 }); },
  flap() { noise({ d: 0.18, v: 0.3, f: 400, f2: 150, type: 'lowpass' }); tone({ f: 120, f2: 70, d: 0.15, v: 0.2 }); },
  thud() { tone({ f: 90, f2: 45, d: 0.3, v: 0.4 }); noise({ d: 0.15, v: 0.2, f: 300, type: 'lowpass' }); },
  boing() { tone({ f: 220, f2: 600, d: 0.5, v: 0.22, vib: 40, vibF: 14, type: 'triangle' }); },
  strain() { for (let i = 0; i < 3; i++) tone({ f: 160 + i * 20, f2: 210 + i * 25, d: 0.25, v: 0.12, type: 'sawtooth', q: 900, at: i * 0.3, vib: 8, vibF: 20 }); },
  boot() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ f, d: 0.25, v: 0.13, type: 'square', q: 2500, at: i * 0.09 })); tone({ f: 200, f2: 1200, d: 0.6, v: 0.06, type: 'sine' }); },
  beepHappy(p = 1) { [0, 4, 7, 12].forEach((s, i) => tone({ f: 660 * p * Math.pow(2, s / 12), d: 0.09, v: 0.1, type: 'square', q: 2200, at: i * 0.07 })); },
  beepTalk(p = 1) { for (let i = 0; i < 4; i++) { const f = rnd(500, 1100) * p; tone({ f, f2: f * rnd(0.7, 1.4), d: 0.08, v: 0.08, type: 'square', q: 2000, at: i * 0.09 }); } },
  huh(p = 1) { tone({ f: 420 * p, d: 0.14, v: 0.12, type: 'square', q: 1600 }); tone({ f: 420 * p, f2: 900 * p, d: 0.25, v: 0.12, type: 'square', q: 1600, at: 0.18 }); },
  error() { for (let i = 0; i < 4; i++) tone({ f: 520 - i * 60, f2: 300 - i * 40, d: 0.22, v: 0.12, type: 'square', q: 1500, at: i * 0.26 }); },
  giggle(p = 1) { for (let i = 0; i < 5; i++) tone({ f: (900 - i * 40) * p, f2: (700 - i * 40) * p, d: 0.09, v: 0.07, type: 'triangle', at: i * 0.11, vib: 30, vibF: 25 }); },
  laughAdult() { for (let i = 0; i < 4; i++) tone({ f: 260 - i * 10, f2: 200, d: 0.12, v: 0.12, type: 'triangle', at: i * 0.14, q: 1200 }); },
  rip(v) { noise({ d: 0.09, v: 0.12 * v, f: rnd(1800, 3200), Q: 0.8 }); },
  peelDone() { noise({ d: 0.25, v: 0.25, f: 2500, f2: 6000, Q: 0.6 }); tone({ f: 880, f2: 1760, d: 0.2, v: 0.08, at: 0.1 }); },
  sparkle() { [1568, 2093, 2637, 3136].forEach((f, i) => tone({ f, d: 0.4, v: 0.05, at: i * 0.06 })); },
  squeak() { tone({ f: rnd(1300, 1700), f2: rnd(1800, 2400), d: 0.08, v: 0.035, type: 'sine' }); },
  whoosh() { noise({ d: 0.45, v: 0.15, f: 400, f2: 2500, Q: 0.7 }); },
  glug() { for (let i = 0; i < 5; i++) tone({ f: rnd(140, 220), f2: rnd(300, 500), d: 0.12, v: 0.18, at: i * 0.16 }); },
  blorp() { tone({ f: 90, f2: 400, d: 0.35, v: 0.3, vib: 30, vibF: 18 }); },
  fizz(d = 2) { noise({ d, v: 0.12, f: 5000, Q: 0.4, a: 0.4 }); },
  fanfare() { [[523, 0], [659, 0.15], [784, 0.3], [1046, 0.45], [784, 0.62], [1046, 0.75]].forEach(([f, at]) => { tone({ f, d: 0.3, v: 0.1, type: 'triangle', at }); tone({ f: f / 2, d: 0.3, v: 0.06, type: 'sine', at }); }); },
  drain() { tone({ f: 600, f2: 80, d: 1.2, v: 0.12, vib: 25, vibF: 9 }); noise({ d: 1.2, v: 0.1, f: 800, f2: 200 }); },
  shimmer() { for (let i = 0; i < 10; i++) tone({ f: 1200 + i * 230, d: 0.5, v: 0.035, at: i * 0.06 }); },
  drum(at = 0) { tone({ f: 150, f2: 50, d: 0.2, v: 0.25, at }); },
  hat(at = 0) { noise({ d: 0.05, v: 0.05, f: 8000, type: 'highpass', at }); },
  note(f, at = 0, d = 0.25, v = 0.06) { tone({ f, d, v, type: 'triangle', at, dest: musicGain }); },
};
// background music: soft marimba loop; party mode in the finale
const scaleNotes = [523, 587, 659, 784, 880, 1046, 1175, 1318];
let musicStep = 0, musicNext = 0, party = false;
const melody = [0, 2, 4, 2, 3, 4, 5, 4, 2, 4, 3, 1, 0, 1, 2, -1];
function musicTick() {
  if (!ac || !musicGain) return;
  const bpmStep = party ? 0.18 : 0.3;
  while (musicNext < ac.currentTime + 0.2) {
    const at = Math.max(0, musicNext - ac.currentTime);
    const n = melody[musicStep % melody.length];
    if (n >= 0) {
      const f = scaleNotes[n] * (party ? 1 : 0.5);
      tone({ f, d: 0.35, v: 0.08, type: 'sine', at, dest: musicGain });
      tone({ f: f * 4, d: 0.08, v: 0.012, type: 'sine', at, dest: musicGain });
    }
    if (musicStep % 4 === 0) tone({ f: [131, 175, 196, 131][(musicStep / 4 | 0) % 4], d: 0.5, v: 0.06, type: 'triangle', at, dest: musicGain });
    if (party) { if (musicStep % 2 === 0) { tone({ f: 120, f2: 45, d: 0.18, v: 0.3, at, dest: musicGain }); } else { noise({ d: 0.04, v: 0.04, f: 9000, type: 'highpass', at }); } }
    musicStep++; musicNext += bpmStep;
  }
}
function setMusic(v, ramp = 1) { if (!musicGain) return; musicGain.gain.cancelScheduledValues(ac.currentTime); musicGain.gain.setTargetAtTime(v, ac.currentTime, ramp / 3); if (musicNext < ac.currentTime) musicNext = ac.currentTime + 0.05; }

// ---------------------------------------------------------------- camera director
const cam = { pos: new THREE.Vector3(0, 2, 6), look: new THREE.Vector3(0, 1, 0), tPos: new THREE.Vector3(0, 2, 6), tLook: new THREE.Vector3(0, 1, 0), speed: 2.5, shake: 0 };
let curShot = null;
function shotPos(s) {
  const dir = new THREE.Vector3(...s.dir).normalize();
  const vf = THREE.MathUtils.degToRad(VFOV);
  const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  const f = Math.min(vf, hf);
  const fitW = s.fitW ?? s.fit, fitH = s.fitH ?? s.fit;
  const dist = Math.max(fitH / Math.tan(vf / 2), fitW / Math.tan(hf / 2));
  return new THREE.Vector3(...s.look).addScaledVector(dir, dist);
}
function shot(s, speed = 2.2, instant = false) {
  curShot = s; cam.speed = speed;
  cam.tLook.set(...s.look); cam.tPos.copy(shotPos(s));
  if (instant) { cam.pos.copy(cam.tPos); cam.look.copy(cam.tLook); }
}
window.addEventListener('resize', () => { if (curShot) { cam.tPos.copy(shotPos(curShot)); } });
function updateCam(dt) {
  const k = 1 - Math.exp(-dt * cam.speed);
  cam.pos.lerp(cam.tPos, k); cam.look.lerp(cam.tLook, k);
  camera.position.copy(cam.pos);
  if (cam.shake > 0) { cam.shake = Math.max(0, cam.shake - dt); camera.position.x += rnd(-1, 1) * cam.shake * 0.05; camera.position.y += rnd(-1, 1) * cam.shake * 0.05; }
  camera.lookAt(cam.look);
}
const SHOTS = {
  dress: { look: [-1.08, 0.66, 0.9], dir: [0.05, 0.3, 1], fitW: 0.78, fitH: 0.55 },
  boxWide: { look: [-2.4, 0.8, 0.5], dir: [0.12, 0.3, 1], fitW: 2.3, fitH: 1.2 },
  box: { look: [-1.9, 0.75, 0.55], dir: [0.06, 0.75, 1], fitW: 1.05, fitH: 0.72 },
  boxRise: { look: [-1.75, 0.95, 0.6], dir: [0.1, 0.25, 1], fitW: 1.2, fitH: 0.85 },
  living: { look: [-2.35, 0.7, -1.7], dir: [0.0, 0.34, 1], fitW: 3.0, fitH: 1.45 },
  kitchen: { look: [3.0, 0.88, -3.38], dir: [0.0, 1.45, 1], fitW: 0.9, fitH: 0.52 },
  kitchenMid: { look: [2.9, 0.95, -3.0], dir: [0.0, 0.45, 1], fitW: 1.6, fitH: 0.95 },
  foam: { look: [2.7, 0.55, -2.4], dir: [0.0, 0.85, 1], fitW: 2.3, fitH: 1.35 },
  finale: { look: [-1.1, 0.68, -1.4], dir: [0.0, 0.3, 1], fitW: 1.95, fitH: 1.0 },
};

// ---------------------------------------------------------------- input
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const handEl = $('hand'), hintEl = $('hint');
const HAND_SVG = (sponge) => `
  <g transform="translate(6,2)">
  ${sponge ? '<rect x="8" y="2" width="44" height="30" rx="8" fill="#ffd43b" stroke="#e0a800" stroke-width="3"/><rect x="8" y="2" width="44" height="10" rx="5" fill="#52b35a"/><circle cx="22" cy="20" r="2.5" fill="#e0a800"/><circle cx="36" cy="24" r="2" fill="#e0a800"/>' : ''}
  <path d="M24 8 C24 2 34 2 34 8 L34 38 L38 38 C38 32 47 32 47 38 L47 42 C47 36 56 36 56 42 L56 46 C56 40 65 40 65 46 L65 66 C65 82 54 92 42 92 C30 92 22 84 18 74 L10 56 C7 50 14 45 19 50 L24 58 Z"
    fill="#f6cfb0" stroke="#c98d6a" stroke-width="3" stroke-linejoin="round"/>
  <rect x="24" y="84" width="40" height="16" rx="5" fill="#ffd23f" stroke="#d9a400" stroke-width="3"/>
  </g>`;
handEl.innerHTML = HAND_SVG(false);
hintEl.innerHTML = HAND_SVG(false);
let handMode = 'hand';
function setHandMode(m) { if (m === handMode) return; handMode = m; handEl.innerHTML = HAND_SVG(m === 'sponge'); }
let ptr = { x: 0, y: 0, down: false, id: null }, active = null, lastInput = 0;
let globalDrag = null, globalTap = null;
function pick(x, y) {
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const objs = [], map = new Map();
  const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  for (const it of interact) { if (!it.on()) continue; for (const o of it.objs) { if (!shown(o)) continue; o.traverse((c) => { if (c.isMesh && c.visible) { objs.push(c); map.set(c, it); } }); } }
  const hits = raycaster.intersectObjects(objs, false);
  for (const h of hits) { const it = map.get(h.object); if (it) return { it, hit: h }; }
  return null;
}
function rayToPlane(x, y, plane) {
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const v = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, v) ? v : null;
}
function toScreen(v) { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * window.innerWidth, y: (1 - p.y) / 2 * window.innerHeight, z: p.z }; }
function ring(x, y) { const d = document.createElement('div'); d.className = 'ring'; d.style.left = x + 'px'; d.style.top = y + 'px'; $('fx').appendChild(d); setTimeout(() => d.remove(), 600); }
let inputEnabled = false;
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  initAudio();
  if (ptr.down && e.pointerId !== ptr.id) return;
  ptr = { x: e.clientX, y: e.clientY, down: true, id: e.pointerId, sx: e.clientX, sy: e.clientY, t: T, moved: 0 };
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  handEl.classList.add('on'); moveHand(e.clientX, e.clientY, true);
  lastInput = T; hideHint();
  if (!inputEnabled) return;
  const p = pick(e.clientX, e.clientY);
  if (p) { active = p.it; active.down?.(p.hit, ptr); }
  else { ring(e.clientX, e.clientY); globalTap?.(ptr); }
  globalDrag?.(ptr, 0);
});
canvas.addEventListener('pointermove', (e) => {
  if (!ptr.down || e.pointerId !== ptr.id) return;
  const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y, dist = Math.hypot(dx, dy);
  ptr.x = e.clientX; ptr.y = e.clientY; ptr.moved += dist; lastInput = T;
  moveHand(e.clientX, e.clientY, true);
  if (!inputEnabled) return;
  if (active) active.move?.(ptr, dist);
  globalDrag?.(ptr, dist);
});
function endPtr(e) {
  if (e.pointerId !== ptr.id) return;
  ptr.down = false; handEl.classList.remove('on');
  if (active) active.up?.(ptr);
  active = null;
}
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
function moveHand(x, y, pressed) {
  handEl.style.transform = `translate(${x}px,${y}px) scale(${pressed ? 0.92 : 1}) rotate(-8deg)`;
}

// hint ghost hand
let hintState = null;
function showHint(fromFn, toFn = null) { hintState = { fromFn, toFn, t0: T }; hintEl.classList.add('on'); }
function hideHint() { hintState = null; hintEl.classList.remove('on'); }
function updateHint() {
  if (!hintState) return;
  const a = hintState.fromFn(); if (!a) return;
  let p = toScreen(a);
  const k = ((T - hintState.t0) % 1.6) / 1.6;
  if (hintState.toFn) { const b = toScreen(hintState.toFn()); const kk = ease(clamp(k * 1.4, 0, 1)); p = { x: lerp(p.x, b.x, kk), y: lerp(p.y, b.y, kk) }; }
  const press = hintState.toFn ? 1 : (k < 0.3 ? 1 - k : 0.7 + Math.abs(Math.sin(k * Math.PI)) * 0.3);
  hintEl.style.transform = `translate(${p.x}px,${p.y}px) scale(${press})`;
}
// idle helper: shows a hint when nothing happens for a while
let idleHint = null; // {after, from, to}
function setIdleHint(from, to = null, after = 5) { idleHint = { from, to, after }; lastInput = T; }
function clearIdleHint() { idleHint = null; hideHint(); }

// ---------------------------------------------------------------- scan (x-ray) rendering
const xrayMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uT: { value: 0 } },
  vertexShader: `varying vec3 vN; varying vec3 vW; varying vec3 vV;
    void main(){ vec4 p = vec4(position,1.0);
      #ifdef USE_INSTANCING
      p = instanceMatrix * p;
      #endif
      vec4 w = modelMatrix * p; vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz);
      gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform float uT; varying vec3 vN; varying vec3 vW; varying vec3 vV;
    void main(){ float f = 1.0 - abs(dot(normalize(vN), vV)); f = pow(f, 2.2);
      vec3 g = abs(fract(vW * 5.0) - 0.5); float line = smoothstep(0.47, 0.5, max(g.x, max(g.y, g.z)));
      float a = f * 0.55 + line * 0.05 + 0.012;
      gl_FragColor = vec4(vec3(0.35, 0.9, 1.0) * a, a); }`,
});
const heatMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  uniforms: { uT: { value: 0 } },
  vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform float uT; varying vec3 vN; varying vec3 vV; void main(){ float f = abs(dot(normalize(vN), vV)); vec3 c = mix(vec3(1.0,0.35,0.1), vec3(1.0,0.95,0.4), f); float p = 0.75 + 0.25*sin(uT*5.0); gl_FragColor = vec4(c * p * 0.9, 1.0); }`,
});
let scanMode = 0; // 0..1
function setLayer(obj, on) { obj.traverse((c) => { if (on) c.layers.enable(1); else c.layers.disable(1); }); }

// ---------------------------------------------------------------- render loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000) * SPEED; last = now; T += dt;
  for (let i = waiters.length - 1; i >= 0; i--) { const w = waiters[i]; if (w.fn ? w.fn() : T >= w.t) { waiters.splice(i, 1); w.r(); } }
  for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i]; const k = clamp((T - tw.t0) / tw.d, 0, 1); tw.fn(tw.e(k), k); if (k >= 1) { tweens.splice(i, 1); tw.r(); } }
  for (const u of updaters) u(dt);
  for (const r of rigs) if (r.root.visible) r.update(dt);
  updateParts(dt);
  updateCam(dt);
  if (idleHint && !hintState && T - lastInput > idleHint.after && !ptr.down) showHint(idleHint.from, idleHint.to);
  updateHint();
  musicTick();
  xrayMat.uniforms.uT.value = T; heatMat.uniforms.uT.value = T;
  if (scanMode > 0.5) {
    renderer.setClearColor(0x02121c, 1);
    scene.background = new THREE.Color(0x02121c);
    scene.overrideMaterial = xrayMat;
    camera.layers.set(0);
    renderer.autoClear = true;
    renderer.render(scene, camera);
    scene.overrideMaterial = heatMat;
    camera.layers.set(1);
    renderer.autoClear = false;
    const bg = scene.background; scene.background = null;
    renderer.render(scene, camera);
    scene.background = bg;
    scene.overrideMaterial = null; camera.layers.set(0); renderer.autoClear = true;
    scene.background = bgColor;
  } else {
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}
const bgColor = scene.background;

// ---------------------------------------------------------------- game flow
const box = makeDeliveryBox();
box.g.position.set(-1.9, 0, 0.5);
box.g.visible = false;
scene.add(box.g);
updaters.push((dt) => box.updateFlaps(dt));

function iris(closeIt) {
  const el = $('iris');
  if (closeIt) el.classList.remove('open'); else el.classList.add('open');
  return wait(0.75);
}
function celebrate(pos, n = 14) { burst(pos, starTex, n, { size: 0.12, speed: 2, life: 1.2 }); burst(pos, sparkleTex, 8, { size: 0.2, speed: 1, life: 1, g: 0 }); }

// --- Scene 0: dress up
async function sceneDress() {
  girl.root.position.set(-1.45, 0, 0.85); girl.faceY = 0.15; girl.root.rotation.y = 0.15;
  robot.root.visible = false;
  shot(SHOTS.dress, 3, true);
  await iris(false);
  // three hats on a cardboard box (hat stand)
  const stand = plainBox(0.5, 0.35, 0.4, -1.0, 0, 0.75, -0.2, 'front', scene);
  const spots = [new THREE.Vector3(-1.13, 0.36, 0.75), new THREE.Vector3(-0.96, 0.36, 0.95), new THREE.Vector3(-0.82, 0.36, 0.72)];
  const holders = [];
  hats.forEach((h, i) => {
    const holder = new THREE.Group(); holder.position.copy(spots[i]); scene.add(holder); holder.add(h); h.scale.setScalar(0.55); h.position.y = 0.05;
    holders.push(holder);
  });
  stand.scale.set(1.7, 1.15, 1.1); stand.position.set(-0.86, 0.2, 0.85);
  holders[0].position.set(-1.12, 0.43, 0.9); holders[1].position.set(-0.86, 0.43, 0.98); holders[2].position.set(-0.6, 0.43, 0.9);
  holders.forEach((h) => { h.children[0].scale.setScalar(0.62); mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ visible: false }), 0, 0.08, 0, h, false); });
  girl.setExpr('smile');
  inputEnabled = true;
  let worn = null, firstAt = -1;
  const bob = (dt) => holders.forEach((h, i) => { const ht = hats[i]; if (ht.parent === h) { ht.position.y = 0.06 + Math.sin(T * 2 + i) * 0.015; ht.rotation.y += dt * 0.6; } });
  updaters.push(bob);
  const wear = async (i) => {
    if (worn === i) { girl.play('jump', 0.6); SFX.giggle(1.2); return; }
    const h = hats[i];
    if (worn != null) { // return old hat
      const old = hats[worn]; holders[worn].add(old); old.position.set(0, 0.06, 0); old.rotation.set(0, 0, 0); old.scale.setScalar(0.62);
    }
    worn = i;
    const from = new THREE.Vector3(); h.getWorldPosition(from);
    scene.add(h); h.position.copy(from);
    const to = new THREE.Vector3(); SFX.whoosh();
    await tween(0.5, (k) => { girl.hatSlot.getWorldPosition(to); h.position.lerpVectors(from, to, k); h.position.y += Math.sin(k * Math.PI) * 0.25; h.scale.setScalar(lerp(0.62, 1, k) * girl.s); h.rotation.y = (1 - k) * 4; });
    if (worn !== i) return;
    girl.hatSlot.add(h); h.position.set(0, 0, 0); h.rotation.set(0, 0, 0); h.scale.setScalar(1);
    SFX.sparkle(); SFX.giggle(1.1);
    girl.say('happy', 1.5); girl.play('cheer', 1.0);
    const hp = new THREE.Vector3(); girl.hatSlot.getWorldPosition(hp); burst(hp, sparkleTex, 10, { size: 0.12, speed: 0.8, g: 0 });
    if (firstAt < 0) firstAt = T;
  };
  const items = hats.map((h, i) => addTouch([holders[i]], { down: () => { SFX.tap(); wear(i); } }));
  const girlTouch = addTouch([girl.root], { down: () => { SFX.giggle(1.2); girl.play('jump', 0.6); girl.say('laugh', 0.8); } });
  setIdleHint(() => { const v = new THREE.Vector3(); holders[1].getWorldPosition(v); return v; }, null, 3);
  await until(() => firstAt >= 0 && T - firstAt > 3.2);
  clearIdleHint();
  inputEnabled = false;
  for (const it of [...items, girlTouch]) it.on = () => false;
  updaters.splice(updaters.indexOf(bob), 1);
  // move hat stand away later
  return { stand, holders };
}

// --- Scene 1: the delivery box
async function sceneBox(dressStuff) {
  // dad arrives with the box
  if (dressStuff) { dressStuff.holders.forEach((h) => scene.remove(h)); scene.remove(dressStuff.stand); }
  girl.walkTo(-1.08, 0.62, 1.0, -0.9);
  shot(SHOTS.boxWide, 1.6);
  SFX.doorbell();
  girl.say('wow', 1.5);
  await wait(1.2);
  dad.root.visible = true; dad.root.position.set(-5.8, 0, 0.6); dad.faceY = Math.PI / 2;
  // dad carries the box
  box.g.visible = true;
  dad.play('carry');
  const carry = (dt) => { const hp = new THREE.Vector3(); dad.chest.getWorldPosition(hp); const fwd = new THREE.Vector3(Math.sin(dad.root.rotation.y), 0, Math.cos(dad.root.rotation.y)); box.g.position.set(hp.x + fwd.x * 0.55, 0.62 + Math.sin(T * 6) * 0.03, hp.z + fwd.z * 0.55); box.g.rotation.y = dad.root.rotation.y + Math.sin(T * 3) * 0.06; box.g.rotation.z = Math.sin(T * 4) * 0.05; };
  updaters.push(carry);
  dad.setExpr('smile');
  await dad.walkTo(-2.9, 0.55, 0.9, Math.PI / 2);
  dad.play('carry');
  // wobble! (fragile)
  dad.say('wow', 1.2); SFX.huh(0.6);
  await tween(0.8, (k) => { box.g.rotation.z = Math.sin(k * 20) * 0.18 * (1 - k); });
  updaters.splice(updaters.indexOf(carry), 1);
  await tween(0.6, (k) => { box.g.position.y = lerp(0.62, 0, k); box.g.position.x = lerp(box.g.position.x, -1.9, k); box.g.position.z = lerp(box.g.position.z, 0.5, k); box.g.rotation.set(0, lerp(box.g.rotation.y, 0, k), 0); });
  SFX.thud(); cam.shake = 0.3;
  dad.play('idle');
  shot(SHOTS.boxWide, 1.6);
  await wait(0.5);
  // dad tries to yank the flaps open (taped!) -> falls on bum
  dad.walkTo(-2.55, 0.55, 0.8, Math.PI / 2);
  await wait(0.5);
  dad.play('tug'); dad.say('determined'); SFX.strain();
  const jig = (dt) => { box.flaps[3].jig = 0.3; box.g.position.x = -1.9 + Math.sin(T * 40) * 0.01; };
  updaters.push(jig);
  await wait(1.0);
  updaters.splice(updaters.indexOf(jig), 1); box.g.position.x = -1.9;
  dad.play('slip'); SFX.boing();
  await wait(0.7);
  dad.play('sit'); dad.say('oops'); SFX.thud(); cam.shake = 0.25;
  burst(dad.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.25, 0)), starTex, 5, { size: 0.09, speed: 0.5, g: 0, life: 1.5 });
  await wait(0.4);
  girl.play('laugh', 1.5); girl.say('laugh', 1.5); SFX.giggle(1.1); SFX.laughAdult();
  await wait(1.2);
  // glint the tapes & go close
  shot(SHOTS.box, 2);
  girl.face(box.g.position);
  inputEnabled = true;
  setHandMode('hand');
  const glint = (dt) => { for (const tp of box.tapes) if (!tp.done) tp.laid.material.emissive.setRGB(0.25 + Math.sin(T * 5) * 0.2, 0.18 + Math.sin(T * 5) * 0.15, 0.05); };
  updaters.push(glint);
  const tapeWorldEnds = (tp) => { const a = new THREE.Vector3(-tp.len / 2, 0, 0), b = new THREE.Vector3(tp.len / 2, 0, 0); tp.pv.localToWorld(a); tp.pv.localToWorld(b); return [a, b]; };
  let tapesDone = 0;
  const tapeItems = box.tapes.map((tp) => addTouch([tp.hit], {
    on: () => !tp.done,
    down: () => { if (tp.done) return; SFX.rip(0.8); girl.say('determined'); const np = Math.min(1, tp.p + 0.12); box.setTape(tp, np); if (np >= 1) finishTape(tp); },
    move: (p, d) => {
      if (tp.done) return;
      const np = Math.min(1, tp.p + d / (Math.min(window.innerWidth, window.innerHeight) * 0.55));
      box.setTape(tp, np);
      if (d > 2 && Math.random() < 0.7) SFX.rip(clamp(d / 15, 0.3, 1.2));
      if (np >= 1) finishTape(tp);
    },
    up: () => { girl.say(girl.exprBase); },
  }));
  async function finishTape(tp) {
    tp.done = true; tapesDone++;
    SFX.peelDone();
    const w = new THREE.Vector3(); tp.curlGroup.getWorldPosition(w);
    tp.laid.visible = false; tp.hang1.visible = false; tp.hang2.visible = false;
    // crumple ball flies away
    const ball = mesh(new THREE.IcosahedronGeometry(0.04, 1), tp.laid.material, 0, 0, 0, scene);
    ball.position.copy(w);
    tp.curl.visible = false;
    const vx = rnd(-1, 1), vz = rnd(0.5, 1);
    tween(0.9, (k) => { ball.position.set(w.x + vx * k * 0.8, w.y + Math.sin(k * Math.PI) * 0.4 - k * 0.6, w.z + vz * k * 0.6); ball.rotation.x += 0.3; }).then(() => scene.remove(ball));
    burst(w, sparkleTex, 6, { size: 0.12, g: 0, speed: 0.6 });
    girl.say('happy', 1.2); girl.play('jump', 0.5); SFX.giggle(1.15);
    tp.laid.material.emissive.setRGB(0, 0, 0);
  }
  setIdleHint(() => { const tp = box.tapes.find((t) => !t.done); return tp ? tapeWorldEnds(tp)[0] : null; }, () => { const tp = box.tapes.find((t) => !t.done); return tp ? tapeWorldEnds(tp)[1] : new THREE.Vector3(); }, 3);
  // flaps (locked until tapes gone; jiggle if tapped)
  let opened = 0;
  const flapItems = box.flaps.map((f, i) => addTouch([f.m], {
    on: () => f.target === 0,
    down: () => {
      const order = [2, 3, 0, 1];
      const blockedByTape = box.tapes.some((t) => !t.done);
      const blockedByFlap = (i === 0 || i === 1) && (box.flaps[2].target === 0 || box.flaps[3].target === 0);
      if (blockedByTape || blockedByFlap) { f.jig = 0.35; if (blockedByFlap && !blockedByTape) box.flaps[box.flaps[2].target === 0 ? 2 : 3].jig = 0.35; SFX.flap(); girl.say('huh', 0.8); return; }
      f.target = 1; opened++; SFX.flap(); SFX.whoosh();
      girl.say('wow', 0.8);
    },
  }));
  await until(() => tapesDone >= 3);
  updaters.splice(updaters.indexOf(glint), 1);
  clearIdleHint();
  await wait(0.5);
  // flaps glow
  const fglint = (dt) => { for (const f of box.flaps) { const m = f.m.material[2]; } };
  setIdleHint(() => { const f = box.flaps.find((ff, i) => ff.target === 0 && (i >= 2 || (box.flaps[2].target && box.flaps[3].target))); if (!f) return null; const v = new THREE.Vector3(); f.m.getWorldPosition(v); return v; }, null, 3);
  await until(() => opened >= 4);
  clearIdleHint();
  inputEnabled = false;
  // robot rises
  await wait(0.5);
  shot(SHOTS.boxRise, 1.8);
  girl.say('wow'); girl.play('stand');
  // packing peanuts burst
  const peanutTex = spriteTex((g, s) => { g.fillStyle = '#fbf6ea'; g.beginPath(); g.ellipse(s / 2, s / 2, s * 0.4, s * 0.22, 0.4, 0, 7); g.fill(); g.strokeStyle = '#d8d0bd'; g.lineWidth = 4; g.stroke(); }, 64);
  burst(new THREE.Vector3(-1.9, 0.9, 0.5), peanutTex, 30, { size: 0.07, speed: 2.2, life: 1.6, g: 4 });
  SFX.whoosh();
  await wait(0.6);
  SFX.boot();
  robot.setExpr('boot');
  await wait(1.6);
  SFX.fizz(1.4);
  await tween(1.4, (k) => { robot.fold = 1 - k; robot.root.position.y = lerp(0.02, 0.25, Math.sin(k * Math.PI * 0.5)); });
  robot.setExpr('look'); robot.play('look', 1.6);
  SFX.beepTalk();
  await wait(1.6);
  // hop out of the box
  SFX.whoosh();
  const from = robot.root.position.clone(), to = new THREE.Vector3(-1.75, 0, 1.15);
  robot.faceY = 0.3;
  await tween(0.7, (k) => { robot.root.position.lerpVectors(from, to, k); robot.root.position.y = lerp(from.y, 0, k) + Math.sin(k * Math.PI) * 0.45; });
  SFX.thud(); cam.shake = 0.2;
  robot.face(girl.root.position);
  girl.face(robot.root.position);
  await wait(0.3);
  robot.setExpr('love'); SFX.beepHappy(); robot.play('wave', 2);
  burst(robot.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.3, 0)), heartTex, 6, { size: 0.12, speed: 0.6, g: -0.3, life: 1.6 });
  girl.say('happy'); girl.play('cheer', 2); SFX.giggle();
  dad.play('clap'); dad.say('happy'); dad.root.position.set(dad.root.position.x, 0, dad.root.position.z);
  celebrate(new THREE.Vector3(-1.75, 1.3, 1.15));
  SFX.fanfare();
  await wait(2.4);
  robot.setExpr('open');
  for (const it of [...tapeItems, ...flapItems]) it.on = () => false;
}

// --- Scene 2: hide & seek with x-ray scan
async function sceneSeek() {
  await iris(true);
  // setup living room
  dad.root.visible = false; dad.play('idle');
  box.g.position.set(-4.95, 0, 1.6); box.g.rotation.y = 0.4;
  robot.root.position.set(-2.2, 0, -0.45); robot.faceY = 0.3; robot.root.rotation.y = 0.3;
  girl.root.position.set(-1.35, 0, -0.25); girl.faceY = -0.5; girl.root.rotation.y = -0.5; girl.walking = false; girl.target = null;
  brother.root.visible = true; brother.root.position.set(-3.0, 0, -0.6); brother.faceY = 0.4;
  shot(SHOTS.living, 3, true);
  await iris(false);
  brother.say('happy'); brother.play('wave', 1.2); SFX.giggle(1.35);
  robot.face(brother.root.position); robot.setExpr('happy');
  await wait(1.3);
  // spots: where things hide. Each spot: position to hide, crouch rotation, touch volume
  const mkHit = (w, h, d, x, y, z) => { const m = mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }), x, y, z, scene, false); return m; };
  const spots = [
    { name: 'sofa', hide: new THREE.Vector3(-3.4, 0, -3.68), rot: 0, hit: mkHit(2.2, 1.1, 1.1, -3.4, 0.5, -3.2), wob: sofa },
    { name: 'curtain', hide: new THREE.Vector3(-0.15, 0, -3.62), rot: 0, hit: mkHit(0.8, 2.4, 0.6, -0.15, 1.2, -3.7), wob: curtainR, standing: true },
    { name: 'box', hide: new THREE.Vector3(-4.75, 0, -1.3), rot: 0.35, hit: mkHit(1.0, 1.0, 1.0, -4.75, 0.5, -1.3), wob: hideBox },
    { name: 'stack', hide: new THREE.Vector3(0.55, 0, -3.72), rot: 0, hit: mkHit(1.1, 1.2, 0.9, 0.6, 0.55, -3.1), wob: staticBoxes[0] },
    { name: 'basket', hide: new THREE.Vector3(-0.4, 0.12, -2.3), rot: 0, hit: mkHit(0.8, 0.8, 0.8, -0.4, 0.35, -2.3), wob: basket },
  ];
  const teddy = makeTeddy(), ball = makeBall();
  scene.add(teddy, ball); teddy.visible = ball.visible = false;
  setLayer(teddy, true); setLayer(ball, true);
  const rounds = [
    { kid: 'sofa', teddy: 'basket', ball: 'box' },
    { kid: 'box', teddy: 'curtain', ball: 'stack' },
    { kid: 'curtain', teddy: 'sofa', ball: 'box' },
  ];
  for (let r = 0; r < rounds.length; r++) {
    const R = rounds[r];
    // cover eyes
    girl.play('cover'); girl.setExpr('cover'); robot.play('cover'); robot.setExpr('cover');
    await wait(0.6);
    $('cover').classList.add('on');
    SFX.giggle(1.4);
    await wait(0.5);
    // tiptoe sounds
    for (let i = 0; i < 4; i++) tone({ f: 200, f2: 120, d: 0.06, v: 0.06, at: i * 0.25 });
    // hide everything
    const ks = spots.find((s) => s.name === R.kid);
    brother.root.position.copy(ks.hide); brother.root.position.y = 0; brother.faceY = ks.rot + Math.PI * (ks.name === 'curtain' ? 0 : 0); brother.root.rotation.y = brother.faceY;
    brother.play(ks.standing ? 'stand' : 'crouch'); brother.say('happy');
    if (ks.name === 'basket') brother.root.position.y = 0.1;
    if (ks.name === 'box') brother.root.position.y = 0.02;
    const ts = spots.find((s) => s.name === R.teddy), bs = spots.find((s) => s.name === R.ball);
    const place = (obj, s) => { obj.visible = true; obj.position.copy(s.hide); obj.position.y = s.name === 'basket' ? 0.15 : (s.name === 'curtain' ? 0 : 0.02); obj.rotation.set(0, rnd(-0.5, 0.5), 0); obj.scale.setScalar(1); };
    place(teddy, ts); place(ball, bs);
    setLayer(brother.root, true);
    await wait(1.6);
    girl.play('idle'); girl.setExpr('smile');
    $('cover').classList.remove('on');
    await wait(0.4);
    robot.play('scan'); robot.setExpr('scan'); SFX.shimmer();
    robot.face(new THREE.Vector3(-2.2, 0, -3));
    await wait(0.4);
    // turn on scan view
    $('scan').classList.add('on'); scanMode = 1; robot.root.visible = false; girl.root.visible = false;
    const scanHum = setInterval(() => tone({ f: 220, d: 0.6, v: 0.015, type: 'sine' }), 900);
    inputEnabled = true;
    let found = false;
    const items = spots.map((s) => addTouch([s.hit], {
      down: async () => {
        if (found) return;
        // wobble the spot
        const o = s.wob, base = o.rotation.z;
        tween(0.4, (k) => { o.rotation.z = base + Math.sin(k * Math.PI * 4) * 0.03 * (1 - k); }).then(() => (o.rotation.z = base));
        if (s.name === R.kid) {
          found = true;
        } else {
          // wrong: robot "huh?" then happy with the toy
          const toy = s.name === R.teddy ? teddy : s.name === R.ball ? ball : null;
          robot.play('huh', 1.0); robot.setExpr('huh'); SFX.huh();
          girl.say('huh', 1.0);
          if (toy && toy.userData.popped !== r) {
            toy.userData.popped = r;
            const p0 = toy.position.clone();
            tween(0.5, (k) => { toy.position.y = p0.y + Math.sin(k * Math.PI) * 0.6; toy.rotation.y += 0.2; }).then(() => (toy.position.y = p0.y));
            SFX.boing();
          }
          await wait(1.0);
          if (!found) { robot.setExpr('happy'); robot.play('happy', 0.8); SFX.beepHappy(0.9); girl.say('laugh', 0.8); await wait(0.8); if (!found) { robot.setExpr('scan'); robot.play('scan'); } }
        }
      },
    }));
    setIdleHint(() => ks.hit.position, null, 6);
    await until(() => found);
    clearIdleHint();
    clearInterval(scanHum);
    for (const it of items) it.on = () => false;
    inputEnabled = false;
    $('scan').classList.remove('on'); scanMode = 0; robot.root.visible = true; girl.root.visible = true;
    setLayer(brother.root, false);
    SFX.whoosh();
    // brother pops out!
    const out = new THREE.Vector3(ks.hide.x + (ks.name === 'curtain' ? 0 : 0), 0, ks.name === 'sofa' ? -2.25 : ks.hide.z + 0.75);
    if (ks.name === 'box') out.set(-4.0, 0, -0.7);
    if (ks.name === 'curtain') out.set(-0.3, 0, -2.9);
    const st = brother.root.position.clone();
    brother.play('cheer'); brother.setExpr('laugh'); SFX.giggle(1.35);
    await tween(0.6, (k) => { brother.root.position.lerpVectors(st, out, k); brother.root.position.y = Math.sin(k * Math.PI) * 0.6 + lerp(st.y, 0, k); });
    brother.faceY = 0.3;
    celebrate(brother.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.2, 0)));
    robot.setExpr('love'); robot.play('jump', 1.2); robot.face(brother.root.position); SFX.beepHappy(1.1);
    girl.play('cheer', 1.4); girl.say('happy', 1.4);
    teddy.visible = false; ball.visible = false;
    await wait(1.8);
    brother.play('idle'); brother.say('smile');
    robot.play('idle'); robot.setExpr('open');
    if (r < rounds.length - 1) { await brother.walkTo(-3.0, -0.6, 1.6, 0.4); }
  }
  // done: high five
  SFX.fanfare();
  brother.walkTo(-2.7, -0.3, 1.4, 0.6);
  robot.play('dance', 2); girl.play('dance', 2); robot.setExpr('happy');
  await wait(2.2);
  spots.forEach((s) => scene.remove(s.hit));
  scene.remove(teddy, ball);
}

// --- Scene 3: kitchen — dishes, foam flood, sparkle, new robot
const plates = [];
function makePlate(i) {
  const g = new THREE.Group();
  const prof = [[0, 0], [0.07, 0], [0.085, 0.008], [0.12, 0.022], [0.125, 0.026], [0.122, 0.028], [0.08, 0.014], [0, 0.012]].map(([x, y]) => new THREE.Vector2(x, y));
  const pm = mesh(new THREE.LatheGeometry(prof, 40), M.ceramic, 0, 0, 0, g);
  const rimC = new THREE.MeshStandardMaterial({ color: [0x4f8fe6, 0xff8a3d, 0x52b35a][i % 3], roughness: 0.3 });
  const rim = mesh(new THREE.TorusGeometry(0.115, 0.004, 6, 40), rimC, 0, 0.024, 0, g); rim.rotation.x = Math.PI / 2;
  // dirt decal
  const c = makeCanvas(256, 256), x = c.getContext('2d');
  for (let k = 0; k < 9; k++) { x.fillStyle = ['rgba(150,60,20,0.85)', 'rgba(190,110,30,0.8)', 'rgba(120,80,40,0.8)'][k % 3]; x.beginPath(); const cx = rnd(60, 196), cy = rnd(60, 196); for (let a = 0; a < 7; a += 0.6) { const r = rnd(12, 34); x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.fill(); }
  for (let k = 0; k < 40; k++) { x.fillStyle = 'rgba(110,70,30,0.9)'; x.beginPath(); x.arc(rnd(40, 216), rnd(40, 216), rnd(2, 5), 0, 7); x.fill(); }
  const dm = new THREE.MeshStandardMaterial({ map: tex(c), transparent: true, roughness: 0.6, depthWrite: false });
  const dirt = mesh(new THREE.CircleGeometry(0.1, 32), dm, 0, 0.0135, 0, g, false); dirt.rotation.x = -Math.PI / 2;
  const hit = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 16), new THREE.MeshBasicMaterial({ visible: false }), 0, 0.02, 0, g, false);
  return { g, dirt, dm, hit, clean: 0, state: 'dirty' };
}
let foam = null;
function makeFoam(n) {
  const geo = new THREE.SphereGeometry(1, 14, 10);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.78, iridescence: 1, iridescenceIOR: 1.3, iridescenceThicknessRange: [200, 600], clearcoat: 1, envMapIntensity: 1.6 });
  const im = new THREE.InstancedMesh(geo, mat, n); im.castShadow = false; im.receiveShadow = false;
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const B = [];
  const mounds = [];
  // foam mounds over the kitchen floor + counter + spilling
  for (let i = 0; i < 16; i++) mounds.push({ c: new THREE.Vector3(rnd(0.9, 4.9), 0, rnd(-3.2, -1.0)), r: rnd(0.35, 0.65) });
  mounds.push({ c: new THREE.Vector3(3.0, 0.92, -3.62), r: 0.45 }, { c: new THREE.Vector3(2.4, 0.92, -3.6), r: 0.3 }, { c: new THREE.Vector3(3.6, 0.92, -3.6), r: 0.3 });
  for (let i = 0; i < n; i++) {
    const m = mounds[i % mounds.length];
    const a = rnd(0, Math.PI * 2), rr = Math.sqrt(Math.random()) * m.r;
    const h = Math.sqrt(Math.max(0, 1 - (rr / m.r) ** 2)) * m.r * 0.9;
    const pos = new THREE.Vector3(m.c.x + Math.cos(a) * rr, m.c.y + rnd(0, h), m.c.z + Math.sin(a) * rr);
    B.push({ pos, r: rnd(0.04, 0.11), s: 0, alive: true, delay: rnd(0, 2.4) + (m.c.y > 0.5 ? 0 : pos.distanceTo(sinkPos) * 0.5), popT: -1, ph: rnd(0, 6) });
  }
  const dummy = new THREE.Object3D();
  const f = { im, B, alive: n, total: n, grow: false, t0: 0 };
  f.update = (dt) => {
    let changed = false;
    for (let i = 0; i < B.length; i++) {
      const b = B[i];
      let s = b.s;
      if (b.popT >= 0) { b.popT += dt; s = b.r * Math.max(0, 1 - b.popT * 8) * (1 + b.popT * 4); }
      else if (f.grow) { const k = clamp((T - f.t0 - b.delay) / 0.6, 0, 1); s = b.r * easeOutBack(k); }
      b.cur = s;
      dummy.position.set(b.pos.x, b.pos.y + Math.sin(T * 2 + b.ph) * 0.005, b.pos.z);
      dummy.scale.setScalar(Math.max(0.0001, s));
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  };
  f.popNear = (sx, sy, rad) => {
    let n = 0;
    const v = new THREE.Vector3();
    for (const b of B) {
      if (!b.alive || b.cur < 0.01) continue;
      v.copy(b.pos).project(camera);
      const px = (v.x + 1) / 2 * window.innerWidth, py = (1 - v.y) / 2 * window.innerHeight;
      if (Math.hypot(px - sx, py - sy) < rad) { b.alive = false; b.popT = 0; f.alive--; n++; if (n < 4) burst(b.pos, dropTex, 1, { size: 0.08, speed: 0.6, life: 0.4 }); }
    }
    return n;
  };
  return f;
}

async function sceneKitchen() {
  await iris(true);
  brother.root.visible = true; brother.root.position.set(0.9, 0, -1.4); brother.faceY = -0.6; brother.play('idle');
  robot.root.position.set(2.3, 0, -3.05); robot.faceY = 0.55; robot.root.rotation.y = 0.55; robot.play('idle'); robot.setExpr('open');
  // step stool for girl
  const stool = new THREE.Group(); stool.position.set(3.72, 0, -3.0); scene.add(stool);
  mesh(rbox(0.42, 0.06, 0.32, 0.02), M.wood, 0, 0.27, 0, stool);
  for (const sx of [-1, 1]) mesh(rbox(0.05, 0.27, 0.3, 0.01), M.wood, sx * 0.17, 0.135, 0, stool);
  girl.root.position.set(3.72, 0.3, -3.0); girl.faceY = -0.35; girl.root.rotation.y = -0.35; girl.target = null; girl.walking = false; girl.play('idle');
  // plates + duck in the sink
  const water = mesh(new THREE.PlaneGeometry(0.72, 0.44), M.water, sinkPos.x, 0.79, sinkPos.z, scene, false); water.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 3; i++) {
    const p = makePlate(i); p.g.scale.setScalar(1.2); p.g.position.set(sinkPos.x - 0.225 + i * 0.225, 0.8, sinkPos.z + (i === 1 ? -0.05 : 0.04)); p.g.rotation.set(rnd(-0.08, 0.08), 0, rnd(-0.08, 0.08));
    scene.add(p.g); plates.push(p); p.home = p.g.position.clone();
  }
  const duck = makeDuck(); duck.scale.setScalar(1.3); duck.position.set(sinkPos.x + 0.5, 0.93, sinkPos.z + 0.05); duck.rotation.y = -2.2; scene.add(duck);
  const duckHit = mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ visible: false }), 0, 0.06, 0, duck, false);
  // small suds in sink
  const suds = new THREE.Group(); scene.add(suds);
  const sudM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.7, iridescence: 1, clearcoat: 1 });
  for (let i = 0; i < 26; i++) mesh(new THREE.SphereGeometry(rnd(0.012, 0.03), 10, 8), sudM, sinkPos.x + rnd(-0.33, 0.33), 0.8, sinkPos.z + rnd(-0.2, 0.2), suds, false);
  shot(SHOTS.kitchenMid, 3, true);
  await iris(false);
  robot.setExpr('happy'); SFX.beepTalk(); robot.play('wave', 1.2);
  await wait(1.0);
  shot(SHOTS.kitchen, 2);
  girl.say('smile');
  setHandMode('sponge');
  inputEnabled = true;
  let handed = 0, duckDone = false, busy = false;
  const robotHandPos = () => robot.handWorld(1);
  async function handTo(obj, isDuck = false, plate = null) {
    if (busy) return false;
    busy = true;
    robot.play('take'); robot.setExpr('open');
    await wait(0.25);
    const from = obj.position.clone();
    SFX.whoosh();
    girl.play('reach', 0.6);
    await tween(0.55, (k) => { const to = robotHandPos(); obj.position.lerpVectors(from, to, k); obj.position.y += Math.sin(k * Math.PI) * 0.2; });
    if (isDuck) {
      robot.play('huh', 1.2); robot.setExpr('huh'); SFX.huh();
      const hold = (dt) => obj.position.copy(robotHandPos());
      updaters.push(hold);
      await wait(1.3);
      updaters.splice(updaters.indexOf(hold), 1);
      robot.setExpr('happy'); SFX.beepHappy(1.2); SFX.giggle(1.2); girl.say('laugh', 1.2);
      // wear duck as a hat
      const p0 = obj.position.clone();
      await tween(0.5, (k) => { const to = robot.hatSlot.getWorldPosition(new THREE.Vector3()); obj.position.lerpVectors(p0, to, k); obj.position.y += Math.sin(k * Math.PI) * 0.15; });
      robot.hatSlot.add(obj); obj.position.set(0, 0, 0); obj.rotation.set(0, Math.PI / 2, 0); obj.scale.setScalar(1.2);
      robot.play('happy', 1);
      burst(robot.hatSlot.getWorldPosition(new THREE.Vector3()), heartTex, 4, { size: 0.08, g: -0.3, speed: 0.4 });
    } else {
      // dry & stack
      const hold = (dt) => obj.position.copy(robotHandPos()).add(new THREE.Vector3(0, 0.05, 0));
      updaters.push(hold);
      robot.play('dry'); SFX.squeak();
      for (let i = 0; i < 5; i++) { SFX.squeak(); await wait(0.18); }
      updaters.splice(updaters.indexOf(hold), 1);
      const p0 = obj.position.clone();
      const slot = new THREE.Vector3(1.62 + handed * 0.08, 1.07, -3.62);
      await tween(0.5, (k) => { obj.position.lerpVectors(p0, slot, k); obj.position.y += Math.sin(k * Math.PI) * 0.1; obj.rotation.set(0, 0, k * Math.PI / 2); });
      SFX.sparkle();
      burst(slot, sparkleTex, 6, { size: 0.08, g: 0, speed: 0.4 });
      robot.setExpr('love'); robot.play('happy', 0.8); SFX.beepHappy();
      girl.say('happy', 1); girl.play('cheer', 0.8);
      handed++;
    }
    await wait(0.6);
    robot.setExpr('open'); robot.play('idle');
    busy = false;
    return true;
  }
  const plateItems = plates.map((p) => addTouch([p.hit], {
    on: () => p.state !== 'gone',
    down: () => { if (p.state === 'clean') { p.state = 'gone'; handTo(p.g, false, p).then((ok) => { if (!ok) p.state = 'clean'; }); } else { SFX.squeak(); girl.say('determined'); } },
    move: (ptr, d) => {
      if (p.state !== 'dirty') return;
      p.clean = Math.min(1, p.clean + d / 900);
      p.dm.opacity = 1 - p.clean;
      if (d > 3 && Math.random() < 0.35) { SFX.squeak(); const w = p.g.position.clone(); w.y += 0.04; burst(w, dropTex, 1, { size: 0.06, speed: 0.4, life: 0.6, g: -0.2 }); }
      if (p.clean >= 1) {
        p.state = 'clean'; p.dirt.visible = false;
        SFX.sparkle(); girl.say('happy', 1);
        burst(p.g.position.clone().add(new THREE.Vector3(0, 0.05, 0)), sparkleTex, 8, { size: 0.08, g: 0, speed: 0.5 });
        tween(0.4, (k) => { p.g.position.y = lerp(0.8, 0.86, k); p.g.rotation.set(0, 0, 0); });
        robot.play('take'); robot.setExpr('look'); SFX.beepTalk(1.2);
      }
    },
    up: () => girl.say('smile'),
  }));
  const duckItem = addTouch([duckHit], {
    on: () => !duckDone,
    down: () => { if (busy) return; duckDone = true; SFX.tap(); tone({ f: 900, f2: 1400, d: 0.15, v: 0.15, type: 'square', q: 1500 }); handTo(duck, true).then((ok) => { if (!ok) duckDone = false; }); },
  });
  const plateCenter = () => { const p = plates.find((pp) => pp.state !== 'gone'); return p ? p.g.position : null; };
  setIdleHint(() => { const p = plates.find((pp) => pp.state === 'dirty'); return p ? p.g.position.clone().add(new THREE.Vector3(-0.06, 0, 0)) : (plates.find((pp) => pp.state === 'clean')?.g.position || null); },
    () => { const p = plates.find((pp) => pp.state === 'dirty'); return p ? p.g.position.clone().add(new THREE.Vector3(0.06, 0, 0.03)) : (plates.find((pp) => pp.state === 'clean')?.g.position || new THREE.Vector3()); }, 4);
  await until(() => (handed >= 2 || (params.has('fastdish') && T > 8)) && !busy);
  clearIdleHint();
  inputEnabled = false;
  for (const it of [...plateItems, duckItem]) it.on = () => false;
  // ---------- Dad "helps" with a giant soap bottle
  dad.root.visible = true; dad.root.position.set(-0.5, 0, -1.6); dad.play('idle'); dad.setExpr('happy');
  const bottle = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.3, 20), M.soap, 0, 0, 0, bottle);
  mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.06, 16), M.white, 0, 0.18, 0, bottle);
  mesh(new THREE.CylinderGeometry(0.01, 0.02, 0.05, 8), M.white, 0, 0.23, 0, bottle);
  scene.add(bottle);
  const holdB = (dt) => { const hp = dad.handWorld(1); bottle.position.copy(hp).add(new THREE.Vector3(0, 0.1, 0)); };
  updaters.push(holdB);
  shot(SHOTS.kitchenMid, 1.8);
  dad.say('happy'); SFX.laughAdult();
  await dad.walkTo(2.75, -2.75, 1.0, Math.PI);
  dad.faceY = Math.PI;
  dad.play('squeeze');
  updaters.splice(updaters.indexOf(holdB), 1);
  await tween(0.4, (k) => { bottle.position.set(lerp(bottle.position.x, 3.0, k), lerp(bottle.position.y, 1.25, k), lerp(bottle.position.z, -3.45, k)); bottle.rotation.z = k * 2.4; });
  // goo stream
  const goo = mesh(new THREE.CylinderGeometry(0.012, 0.02, 1, 8), M.soap, 0, 0, 0, scene, false);
  goo.position.set(3.08, 1.05, -3.45); goo.scale.y = 0.001;
  SFX.glug();
  girl.say('wow');
  await tween(0.4, (k) => { goo.scale.y = k * 0.4; goo.position.y = 1.15 - k * 0.2; });
  await wait(0.4); SFX.glug(); dad.say('happy');
  await wait(0.5); SFX.blorp();
  await tween(0.3, (k) => { goo.scale.y = (1 - k) * 0.4; });
  scene.remove(goo);
  // suds grow!
  SFX.fizz(2.5);
  await tween(1.2, (k) => { suds.children.forEach((s, i) => { s.scale.setScalar(1 + k * 3 + Math.sin(i) * k); s.position.y = 0.8 + k * 0.1 * ((i % 4) + 1); }); });
  dad.play('idle'); dad.say('oops');
  dad.walkTo(2.2, -2.3, 0.6, Math.PI * 0.8);
  bottle.position.set(3.75, 0.95, -3.7); bottle.rotation.set(0, 0, 0);
  // robot is overloaded by suds -> error!
  shot(SHOTS.kitchenMid, 2);
  robot.setExpr('error'); robot.play('error'); SFX.error();
  robot.antM.emissive.setHex(0xffa020);
  cam.shake = 0.6;
  await wait(1.0);
  SFX.error();
  // foam flood
  foam = makeFoam(MOBILE ? 520 : 760); scene.add(foam.im); foam.grow = true; foam.t0 = T;
  updaters.push(foam.update);
  plates.forEach((p) => { if (p.state !== 'gone') p.g.visible = false; });
  duck.visible = duck.parent === robot.hatSlot;
  water.visible = false; suds.visible = false;
  SFX.fizz(3);
  shot(SHOTS.foam, 1.4);
  const spray = setInterval(() => { const h = robot.head.getWorldPosition(new THREE.Vector3()); burst(h.add(new THREE.Vector3(0, 0.25, 0)), dropTex, 3, { size: 0.12, speed: 1.6, life: 1.2, g: 1 }); SFX.pop(); }, 120);
  await wait(1.0);
  // dad slips in the foam
  dad.play('slip'); dad.say('wow'); SFX.boing();
  await wait(0.7);
  dad.play('sit'); dad.say('oops'); SFX.thud();
  const foamHat = mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, iridescence: 0.8 }), 0, 0.05, 0, dad.hatSlot, false);
  foamHat.scale.set(1.2, 0.8, 1.2);
  girl.say('wow', 1.4); girl.play('jump', 0.5);
  await wait(1.6);
  clearInterval(spray);
  robot.play('dizzy'); robot.setExpr('error');
  brother.root.position.set(1.2, 0, -1.6); brother.play('laugh', 1.5); brother.say('laugh', 1.5); SFX.giggle(1.35);
  await wait(0.6);
  // ---------- player scoops the foam
  girl.say('determined'); girl.play('scoop');
  setHandMode('hand');
  inputEnabled = true;
  let popSound = 0;
  // bubbles outside the view don't count (they will go down the drain at the end)
  { const v = new THREE.Vector3(); let vis = 0;
    for (const b of foam.B) { v.copy(b.pos).project(camera); const on = Math.abs(v.x) < 0.92 && Math.abs(v.y) < 0.92 && v.z < 1; b.counted = on; if (on) vis++; }
    foam.visTotal = vis; }
  const foamLeft = () => foam.B.reduce((n, b) => n + (b.alive && b.counted ? 1 : 0), 0);
  globalDrag = (p, d) => {
    const n = foam.popNear(p.x, p.y, Math.max(55, Math.min(window.innerWidth, window.innerHeight) * 0.11));
    if (n > 0 && T - popSound > 0.045) { popSound = T; SFX.pop(); if (n > 3) SFX.pop(); }
    if (n > 0) { girl.say('happy', 0.6); }
  };
  setIdleHint(() => { const b = foam.B.find((bb) => bb.alive && bb.pos.y < 0.5); return b ? b.pos.clone().add(new THREE.Vector3(-0.3, 0, 0)) : null; }, () => { const b = foam.B.find((bb) => bb.alive && bb.pos.y < 0.5); return b ? b.pos.clone().add(new THREE.Vector3(0.3, 0, 0)) : new THREE.Vector3(); }, 3.5);
  // also tapping robot/dad during foam = funny reaction
  const robotFoamTouch = addTouch([robot.root], { down: () => { SFX.error(); robot.play('error', 0.6); } });
  await until(() => foamLeft() < foam.visTotal * 0.22);
  globalDrag = null; clearIdleHint();
  robotFoamTouch.on = () => false;
  inputEnabled = false;
  // last bubbles go down the drain
  SFX.drain();
  const rest = foam.B.filter((b) => b.alive);
  const starts = rest.map((b) => b.pos.clone());
  const drainP = new THREE.Vector3(sinkPos.x + 0.2, 0.72, sinkPos.z);
  shot(SHOTS.foam, 1.5);
  await tween(1.6, (k) => { rest.forEach((b, i) => { const kk = clamp(k * 1.4 - (i % 7) * 0.05, 0, 1); const a = kk * 9 + i; const r = (1 - kk) * 0.35; b.pos.lerpVectors(starts[i], drainP, ease(kk)); b.pos.x += Math.cos(a) * r * kk; b.pos.z += Math.sin(a) * r * kk; b.pos.y += Math.sin(kk * Math.PI) * 0.4; }); }, (k) => k);
  rest.forEach((b) => { b.alive = false; b.popT = 0; });
  await wait(0.6);
  scene.remove(foam.im); updaters.splice(updaters.indexOf(foam.update), 1);
  // ---------- sparkle: room becomes shiny
  SFX.shimmer(); SFX.fanfare();
  floorMat.roughness = 0.12; floorMat.clearcoat = 1; floorMat.clearcoatRoughness = 0.04; floorMat.needsUpdate = true;
  M.steel.roughness = 0.12;
  scene.environmentIntensity = 0.8;
  startTwinkles();
  scene.remove(foamHat);
  dad.play('idle'); dad.say('happy');
  dad.target = null; dad.walking = false;
  dad.root.position.y = 0;
  shineSweep();
  dad.walkTo(1.3, -1.7, 1.2, 0.3);
  { const g0 = girl.root.position.clone(); tween(0.5, (k) => { girl.root.position.set(lerp(g0.x, 3.55, k), Math.max(0, lerp(0.3, 0, k)) + Math.sin(k * Math.PI) * 0.25, lerp(g0.z, -2.5, k)); }).then(() => { scene.remove(stool); }); girl.faceY = -0.2; }
  robot.play('shake', 0.8); SFX.fizz(0.8);
  await wait(0.8);
  robot.antM.emissive.setHex(0xff6b4a);
  robot.setExpr('boot'); SFX.boot();
  await wait(1.2);
  robot.setExpr('love'); robot.play('happy', 1.5); SFX.beepHappy();
  girl.play('cheer', 1.6); girl.say('happy', 2); SFX.giggle();
  brother.play('cheer', 1.6); brother.say('laugh', 1.6);
  dad.play('thumbs', 1.6);
  shot(SHOTS.foam, 1.2);
  await wait(2.2);
  plates.forEach((p, i) => { p.g.visible = true; p.dirt.visible = false; if (p.state !== 'gone') { p.g.position.set(1.62 + (2 + i) * 0.08, 1.07, -3.62); p.g.rotation.set(0, 0, Math.PI / 2); } });
  scene.remove(water); scene.remove(suds); scene.remove(bottle);
}

function shineSweep() {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;pointer-events:none;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.85) 45%,rgba(255,255,255,0) 60%);background-size:300% 100%;background-position:120% 0;transition:background-position 1.1s ease-in-out';
  $('fx').appendChild(d);
  requestAnimationFrame(() => requestAnimationFrame(() => (d.style.backgroundPosition = '-60% 0')));
  setTimeout(() => d.remove(), 1300);
}
// twinkles across the shiny room
let twinkles = null;
function startTwinkles() {
  if (twinkles) return;
  const group = new THREE.Group(); scene.add(group);
  const list = [];
  for (let i = 0; i < 40; i++) {
    const m = new THREE.SpriteMaterial({ map: sparkleTex, transparent: true, depthWrite: false, opacity: 0 });
    const s = new THREE.Sprite(m);
    const onCounter = Math.random() < 0.3;
    s.position.set(onCounter ? rnd(1.3, 4.4) : rnd(-4.8, 4.8), onCounter ? 0.94 : 0.02, onCounter ? rnd(-3.9, -3.4) : rnd(-3.4, 2));
    group.add(s); list.push({ s, ph: rnd(0, 10), sp: rnd(0.6, 1.4) });
  }
  twinkles = (dt) => { for (const t of list) { const k = Math.max(0, Math.sin(T * t.sp * 2 + t.ph)); t.s.material.opacity = Math.pow(k, 6); t.s.scale.setScalar(0.06 + Math.pow(k, 6) * 0.26); } };
  updaters.push(twinkles);
}

// --- Finale: a new robot box arrives; then free play
async function sceneFinale() {
  SFX.doorbell();
  robot.face(new THREE.Vector3(-5, 0, 0.6)); girl.say('wow', 1.2); brother.say('wow', 1.2);
  await wait(1.5);
  await iris(true);
  girl.root.position.set(-1.05, 0, -0.85); girl.faceY = 0.1; girl.root.rotation.y = 0.1; girl.play('idle'); girl.setExpr('smile'); girl.target = null;
  brother.root.position.set(-2.65, 0, -1.15); brother.faceY = 0.4; brother.play('idle');
  robot.root.position.set(-1.9, 0, -1.25); robot.faceY = 0.3; robot.play('idle'); robot.setExpr('open');
  dad.root.position.set(0.45, 0, -1.7); dad.faceY = -0.4; dad.play('idle'); dad.setExpr('smile'); dad.target = null; dad.walking = false;
  // the new box: smaller, sitting in the middle
  const nb = makeDeliveryBox(0.7, 0.62, 0.6);
  nb.g.position.set(-0.35, 0, -1.75); nb.g.rotation.y = -0.15; scene.add(nb.g);
  updaters.push((dt) => nb.updateFlaps(dt));
  nb.tapes.forEach((t) => (t.pv.visible = false));
  robot2.root.visible = true; robot2.fold = 1; robot2.root.position.set(-0.35, 0.02, -1.75); robot2.setExpr('off'); robot2.root.rotation.y = -0.15; robot2.faceY = -0.15;
  radio.position.set(-0.05, 0, -1.2); radio.rotation.y = -0.3; radio.scale.setScalar(1.5);
  // move old box aside
  box.g.position.set(-4.9, 0, 1.4);
  shot(SHOTS.finale, 3, true);
  await iris(false);
  setMusic(1, 2);
  inputEnabled = true;
  // tap the new box: it bulges, then bursts open
  let knocks = 0;
  const boxTouch = addTouch(nb.walls.concat(nb.flaps.map((f) => f.m)), {
    on: () => knocks < 3,
    down: () => {
      knocks++;
      SFX.flap(); SFX.beepTalk(1.5);
      const s0 = 1;
      tween(0.3, (k) => { nb.g.scale.set(1 + Math.sin(k * Math.PI) * 0.08, 1 - Math.sin(k * Math.PI) * 0.06, 1 + Math.sin(k * Math.PI) * 0.08); });
      nb.flaps.forEach((f) => (f.jig = 0.3));
      girl.say('wow', 0.8);
    },
  });
  setIdleHint(() => nb.g.position.clone().add(new THREE.Vector3(0, 0.45, 0)), null, 3);
  await until(() => knocks >= 3);
  clearIdleHint();
  inputEnabled = false;
  await wait(0.3);
  nb.flaps.forEach((f) => (f.target = 1));
  SFX.whoosh(); SFX.boot();
  const peanutTex = spriteTex((g, s) => { g.fillStyle = '#fbf6ea'; g.beginPath(); g.ellipse(s / 2, s / 2, s * 0.4, s * 0.22, 0.4, 0, 7); g.fill(); }, 64);
  burst(nb.g.position.clone().add(new THREE.Vector3(0, 0.6, 0)), peanutTex, 24, { size: 0.06, speed: 2, life: 1.4, g: 4 });
  robot2.setExpr('boot');
  await wait(0.9);
  await tween(1.0, (k) => { robot2.fold = 1 - k; });
  const f0 = robot2.root.position.clone(), t0 = new THREE.Vector3(-0.35, 0, -1.0);
  await tween(0.6, (k) => { robot2.root.position.lerpVectors(f0, t0, k); robot2.root.position.y = Math.sin(k * Math.PI) * 0.4; });
  SFX.thud();
  robot2.setExpr('love'); robot2.play('jump', 1.2); SFX.beepHappy(1.4);
  robot.setExpr('love'); robot.play('happy', 1.2); SFX.beepHappy(1);
  celebrate(robot2.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.2, 0)));
  girl.play('cheer', 1.5); girl.say('happy', 1.5); brother.play('cheer', 1.5); dad.play('clap', 1.5);
  await wait(1.6);
  robot2.setExpr('open'); robot.setExpr('open');
  freePlay(nb);
}

function freePlay(nb) {
  inputEnabled = true;
  $('home').classList.add('show');
  let partyOn = false;
  const dances = ['dance', 'robot', 'jump', 'wave', 'happy'];
  const robotTap = (r, pitch) => () => {
    const d = dances[(Math.random() * dances.length) | 0];
    r.play(d, 1.6); r.setExpr(Math.random() < 0.5 ? 'love' : 'happy');
    SFX.beepHappy(pitch); SFX.note(scaleNotes[(Math.random() * 8) | 0] * pitch, 0, 0.4, 0.1);
    burst(r.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.25, 0)), Math.random() < 0.5 ? heartTex : noteTex, 4, { size: 0.1, speed: 0.6, g: -0.4, life: 1.4 });
    if (Math.random() < 0.3) { r.extraSpin = 1; tween(0.8, (k) => { r.root.rotation.y = r.faceY + k * Math.PI * 2; }); }
    wait(1.7).then(() => { if (r.act === 'idle' || !partyOn) r.setExpr('open'); });
  };
  addTouch([robot.root], { down: robotTap(robot, 1) });
  addTouch([robot2.root], { down: robotTap(robot2, 1.5) });
  const personTap = (p, pitch, adult = false) => () => {
    const a = ['jump', 'cheer', 'laugh', 'dance', 'wave'][(Math.random() * 5) | 0];
    p.play(a, 1.2); p.say(a === 'laugh' ? 'laugh' : 'happy', 1.2);
    if (adult) SFX.laughAdult(); else SFX.giggle(pitch);
  };
  addTouch([girl.root], { down: personTap(girl, 1.15) });
  addTouch([brother.root], { down: personTap(brother, 1.35) });
  addTouch([dad.root], { down: () => { dad.play(Math.random() < 0.5 ? 'dance' : 'slip', 1.2); dad.say(Math.random() < 0.5 ? 'happy' : 'oops', 1.2); SFX.boing(); SFX.laughAdult(); } });
  // radio: party mode
  addTouch([radio], {
    down: () => {
      partyOn = !partyOn; party = partyOn;
      tween(0.3, (k) => radio.scale.setScalar(1.5 + Math.sin(k * Math.PI) * 0.4));
      SFX.tap();
      burst(radio.position.clone().add(new THREE.Vector3(0, 0.3, 0)), noteTex, 6, { size: 0.1, speed: 0.8, g: -0.5, life: 1.5 });
      for (const r of [robot, robot2]) { r.play(partyOn ? 'dance' : 'idle'); r.setExpr(partyOn ? 'happy' : 'open'); }
      for (const p of [girl, brother, dad]) { p.play(partyOn ? 'dance' : 'idle'); p.say(partyOn ? 'happy' : 'smile'); }
    },
  });
  // boxes bounce
  const allBoxes = [...staticBoxes, ...box.walls, ...nb.walls];
  addTouch(allBoxes, {
    down: (hit) => {
      let o = hit.object; if (box.walls.includes(o)) o = box.g; else if (nb.walls.includes(o)) o = nb.g;
      const y0 = o.userData.y0 ?? (o.userData.y0 = o.position.y);
      SFX.flap(); SFX.boing();
      tween(0.5, (k) => { o.position.y = y0 + Math.sin(k * Math.PI) * 0.25; o.rotation.z = Math.sin(k * Math.PI * 2) * 0.1; }).then(() => { o.position.y = y0; o.rotation.z = 0; });
      const w = new THREE.Vector3(); o.getWorldPosition(w);
      burst(w.add(new THREE.Vector3(0, 0.4, 0)), starTex, 5, { size: 0.08, speed: 1, life: 0.9 });
    },
  });
  // floating bubbles from the little robot (pop them)
  const bubM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, transparent: true, opacity: 0.35, iridescence: 1, iridescenceThicknessRange: [200, 700], clearcoat: 1, envMapIntensity: 2 });
  const bubs = [];
  const bubGeo = new THREE.SphereGeometry(1, 20, 14);
  let nextBub = T + 1;
  updaters.push((dt) => {
    if (T > nextBub && bubs.length < 14) {
      nextBub = T + rnd(0.5, 1.4);
      const b = mesh(bubGeo, bubM, 0, 0, 0, scene, false);
      const h = robot2.head.getWorldPosition(new THREE.Vector3());
      b.position.copy(h).add(new THREE.Vector3(rnd(-0.1, 0.1), 0.2, 0.1));
      const r = rnd(0.05, 0.11); b.scale.setScalar(r);
      b.userData = { v: new THREE.Vector3(rnd(-0.25, 0.25), rnd(0.15, 0.3), rnd(0.05, 0.3)), born: T, r };
      bubs.push(b);
      bubItem.objs = bubs;
    }
    for (let i = bubs.length - 1; i >= 0; i--) {
      const b = bubs[i]; b.position.addScaledVector(b.userData.v, dt); b.position.x += Math.sin(T * 2 + i) * 0.002;
      if (T - b.userData.born > 9 || b.position.y > 2.7) { scene.remove(b); bubs.splice(i, 1); bubItem.objs = bubs; }
    }
  });
  const bubItem = addTouch([], {
    down: (hit) => {
      const b = hit.object; const i = bubs.indexOf(b); if (i < 0) return;
      SFX.pop(); burst(b.position, dropTex, 4, { size: 0.08, speed: 0.6, life: 0.4 });
      scene.remove(b); bubs.splice(i, 1); bubItem.objs = bubs;
    },
  });
  // occasional idle life
  updaters.push((dt) => {
    if (Math.random() < dt * 0.15 && !partyOn) { const r = Math.random() < 0.5 ? robot : robot2; r.play('look', 1.5); }
  });
  // restart (long press)
  const home = $('home'); let holdStart = -1;
  home.addEventListener('pointerdown', (e) => { e.preventDefault(); holdStart = T; });
  const endHold = () => { holdStart = -1; $('homeRing').setAttribute('stroke-dashoffset', '126'); };
  home.addEventListener('pointerup', endHold); home.addEventListener('pointerleave', endHold); home.addEventListener('pointercancel', endHold);
  updaters.push(() => { if (holdStart >= 0) { const k = clamp((T - holdStart) / 1.2, 0, 1); $('homeRing').setAttribute('stroke-dashoffset', String(126 * (1 - k))); if (k >= 1) location.reload(); } });
}

// ---------------------------------------------------------------- boot
async function run() {
  const jump = params.get('scene');
  if (jump && jump !== 'dress') iris(false);
  robot.root.position.set(-1.9, 0.02, 0.5); robot.fold = 1; robot.setExpr('off'); robot.root.rotation.y = 0.0; robot.faceY = 0.0;
  if (!jump) {
    const d = await sceneDress();
    await sceneBox(d);
    await sceneSeek();
    await sceneKitchen();
    await sceneFinale();
    return;
  }
  // debug / screenshot jumps
  const fast = async () => {};
  if (jump === 'box') { hats[2].scale.setScalar(1); girl.hatSlot.add(hats[2]); robot.root.visible = true; await sceneBox(null); }
  if (jump === 'seek') { girl.hatSlot.add(hats[0]); robot.fold = 0; robot.root.position.y = 0; robot.setExpr('open'); box.g.visible = true; await sceneSeek(); }
  if (jump === 'kitchen') { girl.hatSlot.add(hats[0]); robot.fold = 0; robot.root.position.y = 0; robot.setExpr('open'); box.g.visible = true; await sceneKitchen(); }
  if (jump === 'finale') { girl.hatSlot.add(hats[0]); robot.fold = 0; robot.root.position.y = 0; robot.setExpr('open'); box.g.visible = true; dad.root.visible = true; brother.root.visible = true; startTwinkles(); floorMat.roughness = 0.12; floorMat.clearcoat = 1; await sceneFinale(); }
  if (jump === 'dress') { await sceneDress(); }
}

// expose for testing
window.__g = { shot, SHOTS, interact, scr: (o) => { const v = new THREE.Vector3(); if (o.isVector3) v.copy(o); else o.getWorldPosition(v); return toScreen(v); }, active: () => interact.filter((i) => i.on()).length, T: () => T, girl, robot, robot2, dad, brother, box, plates: () => plates, foam: () => foam, camera, scene, setInput: (v) => (inputEnabled = v) };

// warm up the GPU then show the start button
function boot() {
  shot(SHOTS.dress, 3, true);
  girl.root.position.set(-1.45, 0, 0.85);
  renderer.compile(scene, camera);
  requestAnimationFrame(frame);
  $('loading').style.display = 'none';
  const start = () => {
    initAudio();
    setMusic(0.6, 2);
    $('start').classList.add('gone');
    setTimeout(() => ($('start').style.display = 'none'), 700);
    run();
  };
  $('playBtn').addEventListener('click', start, { once: true });
  if (params.has('auto')) start();
}
$('loading').firstElementChild.style.width = '60%';
setTimeout(boot, 30);
