import * as THREE from 'three';
import { RoomEnvironment } from './RoomEnvironment.js';
import * as M from './models.js';
import { sfx, unlockAudio } from './audio.js';

const PI = Math.PI, V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const $ = (id) => document.getElementById(id);
const DEBUG = new URLSearchParams(location.search);

// ---------- 描画まわり ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: DEBUG.has('shot') });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;

const scene = new THREE.Scene();
const uiScene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 400);
const uiCam = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex; scene.environmentIntensity = 0.5;
uiScene.environment = envTex; uiScene.environmentIntensity = 0.6;
scene.background = new THREE.Color('#4696de');

const hemi = new THREE.HemisphereLight(0xdcecff, 0x9a8a6e, 1.15); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 3.2);
sun.position.set(14, 22, -8); sun.target.position.set(2, 0, 8);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 70 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const spot = new THREE.SpotLight(0xfff1dc, 60, 14, 1.05, 0.6, 1.6);
spot.position.set(0, 3.1, -3.2); spot.target.position.set(0, 0, -3.0);
spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0005; spot.shadow.normalBias = 0.01;
scene.add(spot, spot.target);
const fill = new THREE.PointLight(0xffe6c8, 8, 9, 2); fill.position.set(0, 2.4, -4.6); scene.add(fill);

uiScene.add(new THREE.HemisphereLight(0xffffff, 0xb59a85, 1.4));
const uiKey = new THREE.DirectionalLight(0xfff2e2, 2.2); uiKey.position.set(3, 5, 6); uiScene.add(uiKey);

// ---------- 小さな仕組み ----------
const tweens = new Set(), ticks = new Set();
const ease = { io: (k) => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, out: (k) => 1 - Math.pow(1 - k, 3), in: (k) => k * k * k, lin: (k) => k,
  back: (k) => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); } };
function anim(dur, fn, e = ease.io) { return new Promise((res) => { const tw = { t: 0, dur, fn, e, res }; tweens.add(tw); fn(0, 0); }); }
const wait = (s) => anim(s, () => {});
const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, k) => a + (b - a) * k;
function yawTo(dx, dz) { return Math.atan2(-dz, dx); }
function frontDir(obj) { return V(Math.cos(obj.rotation.y), 0, -Math.sin(obj.rotation.y)); }

// ---------- カメラ ----------
const cam = { pos: V(0, 1.6, -2.6), tgt: V(0, 1.7, -6), h: 34, id: 0, shake: 0 };
function shot(p, t, h, dur = 1.6) {
  const id = ++cam.id, p0 = cam.pos.clone(), t0 = cam.tgt.clone(), h0 = cam.h;
  return anim(dur, (k) => { if (id !== cam.id) return; cam.pos.lerpVectors(p0, p, k); cam.tgt.lerpVectors(t0, t, k); cam.h = lerp(h0, h, k); });
}
const SHOT = {
  costume: [V(0, 1.6, -2.4), V(0, 1.75, -6), 34],
  s1: [V(0.3, 1.4, -5.45), V(0.3, 0.3, -0.6), 40],
  s1b: [V(0, 1.7, -4.2), V(0, 1.7, 9), 38],
  s2: [V(1.0, 3.4, 0.6), V(0.2, 0.9, 12), 44],
  s3a: [V(5.0, 4.4, 0.4), V(5.0, 0, 7.6), 42],
  s3b: [V(12.0, 5.4, -0.8), V(12.4, 1.0, 8.4), 44],
  s3c: [V(8.0, 6.4, 0.2), V(7.0, 1.0, 12.5), 46],
};

// ---------- テクスチャ ----------
const loader = new THREE.TextureLoader();
function tex(url, rx = 1, ry = 1) {
  const t = loader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t;
}

// ---------- 世界 ----------
const world = new THREE.Group(); scene.add(world);
const GH = 3.2;
function buildWorld() {
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ map: tex('tex/grass.jpg', 90, 90), roughness: 1, color: 0xdfeecf }));
  grass.rotation.x = -PI / 2; grass.receiveShadow = true; world.add(grass);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 23.4), new THREE.MeshStandardMaterial({ map: tex('tex/floor.jpg', 4, 5.8), roughness: 0.75, color: 0xf0eee8 }));
  floor.rotation.x = -PI / 2; floor.position.set(0, 0.004, 5.5); floor.receiveShadow = true; world.add(floor);
  // ガレージ
  const wallM = M.matte('#ebe5da', 0.9), trim = M.matte('#cfc7b8', 0.8);
  M.box(8.4, GH, 0.2, wallM, 0, GH / 2, -6.1, world);
  M.box(0.2, GH, 6.2, wallM, -4.1, GH / 2, -3, world);
  M.box(0.2, GH, 6.2, wallM, 4.1, GH / 2, -3, world);
  M.box(1.1, GH, 0.25, trim, -3.65, GH / 2, 0.1, world);
  M.box(1.1, GH, 0.25, trim, 3.65, GH / 2, 0.1, world);
  M.box(8.4, GH - 2.7, 0.25, trim, 0, (GH + 2.7) / 2, 0.1, world);
  M.box(8.8, 0.2, 6.8, M.matte('#6b6f75', 0.7), 0, GH + 0.1, -3, world);
  const roll = M.cyl(0.2, 0.2, 6.2, M.matte('#b9bcc0', 0.4), 0, 2.88, -0.15, world, 20); roll.rotation.z = PI / 2;
  const lamp = M.box(1.4, 0.06, 0.3, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 2 }), 0, GH - 0.04, -3.2, world); lamp.castShadow = false;
  // 道具の壁（写真）
  const wallPic = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 2.81), new THREE.MeshStandardMaterial({ map: tex('tex/wall.jpg'), roughness: 0.85 }));
  wallPic.position.set(0, 0.55 + 1.405, -5.99); wallPic.receiveShadow = true; world.add(wallPic);
  const wood = M.matte('#b98a5a', 0.7);
  M.box(5.0, 0.55, 0.6, wood, 0, 0.275, -5.7, world);
  M.box(5.1, 0.06, 0.7, M.matte('#a87a4c', 0.6), 0, 0.58, -5.68, world);
  // タイヤの山・赤い道具箱・棚
  for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.14, 14, 28), M.mats.rubber); t.rotation.x = PI / 2; t.position.set(-3.35, 0.15 + i * 0.27, -5.2); t.castShadow = true; world.add(t); }
  const tb = M.rbox(0.7, 0.4, 0.4, M.paint(0xd62b2b), 3.3, 0.2, -5.3, 0.05, world); M.box(0.3, 0.05, 0.05, M.mats.chrome, 3.3, 0.44, -5.3, world);
  for (let s = 0; s < 3; s++) {
    M.box(0.5, 0.04, 2.2, wood, 3.75, 0.7 + s * 0.65, -3.6, world);
    for (let i = 0; i < 4; i++) { const c = M.cyl(0.13, 0.13, 0.28, M.paint([0x3a7bd5, 0xf2c12e, 0x4caf50, 0xe85d3a][(i + s) % 4], 0.5), 3.75, 0.86 + s * 0.65, -4.4 + i * 0.5, world, 16); }
  }
  // 床のおもちゃ道路マット
  const c = document.createElement('canvas'); c.width = 512; c.height = 300; const x = c.getContext('2d');
  x.fillStyle = '#7cc46a'; x.fillRect(0, 0, 512, 300);
  x.strokeStyle = '#5b5f66'; x.lineWidth = 62; x.beginPath(); x.roundRect(70, 60, 372, 180, 70); x.stroke();
  x.strokeStyle = '#fff'; x.lineWidth = 5; x.setLineDash([18, 16]); x.beginPath(); x.roundRect(70, 60, 372, 180, 70); x.stroke();
  x.setLineDash([]); x.fillStyle = '#4f9fe0'; x.beginPath(); x.ellipse(256, 150, 70, 32, 0, 0, PI * 2); x.fill();
  for (const [tx, ty] of [[30, 30], [480, 270], [470, 30], [40, 270]]) { x.fillStyle = '#2e7d32'; x.beginPath(); x.arc(tx, ty, 18, 0, PI * 2); x.fill(); }
  const mt = new THREE.CanvasTexture(c); mt.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.75), new THREE.MeshStandardMaterial({ map: mt, roughness: 0.95 }));
  mat.rotation.x = -PI / 2; mat.position.set(0, 0.008, -3.0); mat.receiveShadow = true; world.add(mat);
  // 柵
  const picket = new THREE.BoxGeometry(0.09, 1.1, 0.03), pm = M.matte('#fbfbf7', 0.6);
  const runs = [[-40, 27, 40, 27], [24, -8, 24, 27], [-24, -8, -24, 27]];
  let n = 0; for (const r of runs) n += Math.round(Math.hypot(r[2] - r[0], r[3] - r[1]) / 0.22);
  const im = new THREE.InstancedMesh(picket, pm, n); im.castShadow = true; im.receiveShadow = true;
  const d = new THREE.Object3D(); let k = 0;
  for (const [x0, z0, x1, z1] of runs) {
    const L = Math.hypot(x1 - x0, z1 - z0), cnt = Math.round(L / 0.22);
    for (let i = 0; i < cnt; i++) { const t = i / cnt; d.position.set(lerp(x0, x1, t), 0.55, lerp(z0, z1, t)); d.rotation.y = Math.atan2(x1 - x0, z1 - z0) + PI / 2; d.updateMatrix(); im.setMatrixAt(k++, d.matrix); }
    const rail = M.box(L, 0.07, 0.04, pm, (x0 + x1) / 2, 0.8, (z0 + z1) / 2, world); rail.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    const rail2 = rail.clone(); rail2.position.y = 0.35; world.add(rail2);
  }
  world.add(im);
  // 木と植え込み
  const leaf = M.matte('#4f8f3a', 0.9), leaf2 = M.matte('#3f7a30', 0.9), bark = M.matte('#6b4a32', 0.9);
  function tree(x, z, s) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); world.add(g);
    M.cyl(0.25, 0.35, 3, bark, 0, 1.5, 0, g, 10);
    for (let i = 0; i < 7; i++) { const b = M.sphere(rand(1.1, 1.6), i % 2 ? leaf : leaf2, rand(-1.2, 1.2), rand(3.2, 4.8), rand(-1.2, 1.2), g, 14); }
  }
  tree(-17, 22, 1.2); tree(19, 24, 1.3); tree(-21, 6, 1.0); tree(30, 14, 1.3); tree(-8, 34, 1.4); tree(10, 36, 1.2);
  for (let i = 0; i < 14; i++) { const b = M.sphere(rand(0.6, 1.0), i % 2 ? leaf : leaf2, -20 + i * 3.2 + rand(-0.5, 0.5), 0.4, 26.2, world, 12); b.scale.y = 0.8; }
  // 遠景（写真）
  const sky = tex('tex/sky.jpg'); sky.wrapS = THREE.MirroredRepeatWrapping;
  const bgMat = new THREE.MeshBasicMaterial({ map: sky, fog: false });
  const bw = 54, bh = bw * 1297 / 1536;
  for (const [px, pz, ry, rep] of [[0, 62, PI, 3], [62, 14, -PI / 2, 2]]) {
    const g = new THREE.PlaneGeometry(bw * rep, bh); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * rep);
    const m = new THREE.Mesh(g, bgMat); m.position.set(px, bh / 2 - 3.5, pz); m.rotation.y = ry; world.add(m);
  }
  // 絵の看板（ルール）
  const easel = new THREE.Group(); easel.position.set(2.75, 0, -1.7); world.add(easel);
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.86, 0.04), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: M.signTex(), roughness: 0.8 }), wood]);
  board.position.y = 1.0; board.rotation.x = -0.12; board.castShadow = true; easel.add(board);
  for (const [lx, lz, rx] of [[-0.45, 0.08, -0.12], [0.45, 0.08, -0.12], [0, -0.35, 0.35]]) { const l = M.cyl(0.025, 0.025, 1.5, wood, lx, 0.72, lz, easel, 6); l.rotation.x = rx; }
  easel.lookAt(SHOT.s1[0].x, 0, SHOT.s1[0].z);
  return { easel, board };
}
const W0 = buildWorld();

// ---------- パーティクル（きらきら） ----------
function spriteTex(color) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, color); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 9 : 32, a = i * PI / 4; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const sparkMats = ['rgba(255,240,150,1)', 'rgba(255,170,210,1)', 'rgba(160,220,255,1)', 'rgba(190,255,170,1)'].map((c) => new THREE.SpriteMaterial({ map: spriteTex(c), depthWrite: false, blending: THREE.AdditiveBlending, transparent: true }));
const confMats = [0xff5d5d, 0xffd23a, 0x4aa8ff, 0x5fd36b, 0xff8ad8].map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
const parts = [];
function burst(pos, n = 24, size = 0.35, speed = 3) {
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(sparkMats[i % 4]); s.position.copy(pos);
    const v = V(rand(-1, 1), rand(0.2, 1.4), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.4, 1));
    s.userData = { v, life: rand(0.6, 1.1), age: 0, size: size * rand(0.6, 1.3), g: 2.5 }; s.scale.setScalar(size); scene.add(s); parts.push(s);
  }
}
const confGeo = new THREE.PlaneGeometry(0.16, 0.24);
function confetti(center, n = 80, spread = 8) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(confGeo, confMats[i % confMats.length]);
    m.position.set(center.x + rand(-spread, spread), center.y + rand(4, 9), center.z + rand(-spread, spread));
    m.userData = { v: V(rand(-0.5, 0.5), rand(-1.6, -0.8), rand(-0.5, 0.5)), life: 6, age: 0, spin: V(rand(-6, 6), rand(-6, 6), rand(-6, 6)), conf: true, size: 1 };
    scene.add(m); parts.push(m);
  }
}
function tickParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i], u = p.userData; u.age += dt;
    if (u.conf) { p.position.addScaledVector(u.v, dt); p.rotation.x += u.spin.x * dt; p.rotation.y += u.spin.y * dt; p.position.x += Math.sin(u.age * 3 + i) * dt * 0.6; if (p.position.y < 0.02) { p.position.y = 0.02; u.v.set(0, 0, 0); u.spin.set(0, 0, 0); } }
    else { u.v.y -= u.g * dt; p.position.addScaledVector(u.v, dt); p.scale.setScalar(u.size * Math.max(0, 1 - u.age / u.life)); }
    if (u.age > u.life) { scene.remove(p); parts.splice(i, 1); }
  }
}

// ---------- 女の子（画面の角に出る） ----------
const girl = M.makePerson({ skin: '#ffdcc6', hair: 0x3b2417, top: 0xfdfdfd, pants: 0x7fb2ff, shoe: 0xff6f91, legLen: 0.55, torsoLen: 0.45, armLen: 0.45, pigtails: true, bib: true });
uiScene.add(girl.g);
const wand = M.makeWand(); wand.scale.setScalar(0); wand.position.set(0, -0.62, 0.05); wand.rotation.x = 1.1; girl.arms[1].add(wand);
const bubble = new THREE.Mesh(new THREE.CircleGeometry(1.75, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
bubble.position.set(0, 2.05, -1.2); uiScene.add(bubble);
const ring = new THREE.Mesh(new THREE.RingGeometry(1.72, 1.86, 48), new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0, depthWrite: false }));
ring.position.copy(bubble.position); uiScene.add(ring);
const ui = { t: 0 }; // 0=全面(衣装えらび) 1=左下
function uiRect() {
  const W = innerWidth, H = innerHeight, s = Math.min(W, H) * (W < H ? 0.4 : 0.36), m = 6;
  const full = { x: 0, y: 0, w: W, h: H }, cor = { x: m, y: m, w: s, h: s };
  const k = ease.io(ui.t);
  return { x: lerp(full.x, cor.x, k), y: lerp(full.y, cor.y, k), w: lerp(full.w, cor.w, k), h: lerp(full.h, cor.h, k) };
}
function placeUiCam(r) {
  const k = ease.io(ui.t);
  uiCam.aspect = r.w / r.h;
  const dist = lerp(10.5, 6.2, k), ty = lerp(2.0, 2.05, k);
  const need = lerp(2.8, 1.75, k);
  uiCam.fov = Math.max(30, THREE.MathUtils.radToDeg(2 * Math.atan(need / dist / uiCam.aspect)));
  uiCam.position.set(0, ty + 0.1, dist); uiCam.lookAt(0, ty, 0); uiCam.updateProjectionMatrix();
  bubble.material.opacity = k * 0.72; ring.material.opacity = k;
}
let girlArmT = 0;
function girlTap() {
  girlArmT = 0.0001;
}
function tickGirl(dt) {
  girl.tick(dt);
  const t = performance.now() / 1000;
  girl.body.rotation.z = Math.sin(t * 1.3) * 0.03;
  girl.headG.rotation.z = Math.sin(t * 0.9) * 0.05 + (girl.expr === 'are' ? 0.25 : 0);
  girl.body.position.y = girl.expr === 'happy' || girl.expr === 'giggle' ? Math.abs(Math.sin(t * 9)) * 0.12 : 0;
  const a = girl.arms[1];
  if (girlArmT > 0) {
    girlArmT += dt; const k = girlArmT / 0.55;
    a.rotation.x = -1.3 - Math.abs(Math.sin(k * PI * 2)) * 0.5 * (k < 1 ? 1 : 0);
    if (k > 1.4) girlArmT = 0;
  } else a.rotation.x += ((wand.scale.x > 0.5 ? -0.5 : 0) - a.rotation.x) * Math.min(1, dt * 6);
  girl.arms[0].rotation.x = girl.expr === 'happy' ? -2.6 + Math.sin(t * 12) * 0.3 : girl.arms[0].rotation.x * 0.9;
}

// ---------- パパ ----------
const dad = M.makePerson({ skin: '#f3cba9', hair: 0x2a1c12, top: 0xd9463b, pants: 0x34507a, shoe: 0x3a3a3a, legLen: 1.1, torsoLen: 0.75, armLen: 0.75, thickBrow: true, nose: true });
dad.g.scale.setScalar(0.5); world.add(dad.g);
const hammer = M.makeHammer(); hammer.position.set(0, -0.95, 0.05); hammer.rotation.x = PI / 2; dad.arms[1].add(hammer);
const dadStars = new THREE.Group(); for (let i = 0; i < 3; i++) { const s = M.makeStar(0.14, 0xffd23a, 0.04); s.position.set(Math.cos(i * 2.1) * 0.75, 0, Math.sin(i * 2.1) * 0.75); dadStars.add(s); }
dadStars.position.y = 0.55; dadStars.visible = false; dad.headG.add(dadStars);
let dadWalk = 0, dadDance = 0;
function tickDad(dt) {
  dad.tick(dt);
  const t = performance.now() / 1000;
  if (dadWalk > 0) { dad.body.position.y = Math.abs(Math.sin(t * 10)) * 0.12; dad.body.rotation.z = Math.sin(t * 10) * 0.06; }
  if (dadStars.visible) dadStars.rotation.y += dt * 5;
  if (dadDance > 0) { dadDance -= dt; dad.body.position.y = Math.abs(Math.sin(t * 8)) * 0.4; dad.arms[0].rotation.z = -2.4 + Math.sin(t * 10) * 0.3; dad.arms[1].rotation.z = 2.4 - Math.sin(t * 10) * 0.3; if (dadDance <= 0) { dad.body.position.y = 0; dad.arms[0].rotation.z = -0.18; dad.arms[1].rotation.z = 0.18; } }
}
function walkDad(to, dur, faceAfter = null) {
  const from = dad.g.position.clone(); dad.g.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
  dadWalk++;
  return anim(dur, (k) => dad.g.position.lerpVectors(from, to, k), ease.lin).then(() => { dadWalk--; dad.body.position.y = 0; dad.body.rotation.z = 0; if (faceAfter != null) dad.g.rotation.y = faceAfter; });
}
function faceCam(obj) { return Math.atan2(camera.position.x - obj.position.x, camera.position.z - obj.position.z); }
function cheerDad(s = 1.4) { dad.set('happy', s + 0.4); dadDance = s; }

// ---------- 乗り物 ----------
const TOY = 1 / 18;
const vehicles = {
  ambulance: M.makeAmbulance(), bus: M.makeBus(), police: M.makePolice(),
  dump: M.makeDump(), garbage: M.makeGarbage(), mixer: M.makeMixer(),
};
const toyPlace = {
  police: [-0.85, -3.5, 1, -0.7], ambulance: [0.05, -3.55, 1, -0.55], dump: [0.95, -3.45, -1, -0.8],
  bus: [-0.95, -2.6, 1, -0.35], garbage: [0.15, -2.55, 1, -0.6], mixer: [1.05, -2.6, -1, -0.5],
};
for (const [k, v] of Object.entries(vehicles)) {
  const p = toyPlace[k]; v.position.set(p[0], 0.002, p[1]); v.rotation.y = yawTo(p[2], p[3]); v.scale.setScalar(TOY); world.add(v);
  v.userData.flash = 0; v.userData.spin = 0.4;
}
function tickVehicles(dt) {
  const t = performance.now() / 1000;
  for (const v of Object.values(vehicles)) {
    const u = v.userData;
    if (u.flash > 0) { u.flash -= dt; u.lights.forEach((m, i) => m.emissiveIntensity = (Math.floor(t * 6 + i) % 2) ? 3 : 0.1); if (u.flash <= 0) u.lights.forEach((m) => m.emissiveIntensity = 0.15); }
    if (u.drum) u.drum.rotation.y += u.spin * dt;
    if (u.spinBoost > 0) { u.spinBoost -= dt; u.spin = 6; } else if (u.drum) u.spin += (0.6 - u.spin) * dt;
  }
}
async function signature(v, big = true) {
  const u = v.userData;
  if (u.sigBusy) return; u.sigBusy = true;
  try { await signature2(v, u); } finally { u.sigBusy = false; }
}
async function signature2(v, u) {
  switch (u.kind) {
    case 'ambulance': sfx.pipo(); u.flash = 2.4; break;
    case 'police': sfx.siren(); u.flash = 2.2; break;
    case 'bus': {
      sfx.busHorn(); u.flash = 1.2;
      await anim(0.4, (k) => { u.door.position.x = 3.1 - k * 0.65; u.arm.rotation.y = -PI / 2 + k * PI / 2; });
      await wait(0.9);
      await anim(0.4, (k) => { u.door.position.x = 2.45 + k * 0.65; u.arm.rotation.y = -k * PI / 2; });
      break;
    }
    case 'dump': sfx.truckHorn(); await anim(0.5, (k) => u.bed.rotation.z = Math.sin(k * PI) * 0.35); break;
    case 'garbage': sfx.melody(); u.flash = 1.3; await munchAnim(v); break;
    case 'mixer': sfx.truckHorn(); sfx.rumble(1.2); u.spinBoost = 1.4; break;
  }
}
async function munchAnim(v) {
  const p = v.userData.plate; p.visible = true;
  await anim(0.7, (k) => { p.position.y = 1.75 - Math.abs(Math.sin(k * PI * 3)) * 0.55; v.position.y = Math.abs(Math.sin(k * PI * 3)) * 0.05; });
  p.visible = false; v.position.y = 0;
}

// ---------- タップ判定 ----------
const targets = [];
function addTarget(obj, onTap, opt = {}) {
  if (opt.kind) obj.userData.kind = opt.kind;
  const t = Object.assign({ obj, onTap, active: true, wand: false, ui: false, r: null, busy: false }, opt);
  obj.traverse((o) => { o.userData.tgt = t; });
  targets.push(t); return t;
}
function removeTarget(t) { const i = targets.indexOf(t); if (i >= 0) targets.splice(i, 1); }
const _box = new THREE.Box3(), _sph = new THREE.Sphere();
function tgtCenter(t) {
  if (t.center) return t.center();
  _box.setFromObject(t.obj); _box.getBoundingSphere(_sph); return _sph.center.clone();
}
function tgtRadius(t) { if (t.r) return t.r; _box.setFromObject(t.obj); _box.getBoundingSphere(_sph); return _sph.radius; }
function toScreen(p, ui = false) {
  if (ui) { const r = uiRect(); const v = p.clone().project(uiCam); return { x: r.x + (v.x + 1) / 2 * r.w, y: innerHeight - (r.y + (v.y + 1) / 2 * r.h), z: v.z }; }
  const v = p.clone().project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, z: v.z };
}
const ray = new THREE.Raycaster();
function pick(cx, cy) {
  const act = targets.filter((t) => t.active && t.obj.visible !== false);
  // 1) 左下の女の子
  const r = uiRect(), ux = (cx - r.x) / r.w, uy = (innerHeight - cy - r.y) / r.h;
  if (ux >= 0 && ux <= 1 && uy >= 0 && uy <= 1) {
    ray.setFromCamera(new THREE.Vector2(ux * 2 - 1, uy * 2 - 1), uiCam);
    const objs = act.filter((t) => t.ui).map((t) => t.obj);
    const h = ray.intersectObjects(objs, true)[0];
    if (h) return { t: h.object.userData.tgt, p: h.point };
    if (ui.t > 0.5) { const g = act.find((t) => t.ui && t.obj === girl.g); return g ? { t: g, p: V() } : null; }
  }
  // 2) 画面内の物
  ray.setFromCamera(new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1), camera);
  const hits = ray.intersectObjects(act.filter((t) => !t.ui).map((t) => t.obj), true);
  if (hits.length) return { t: hits[0].object.userData.tgt, p: hits[0].point };
  // 3) 指が少しずれても近い物をひろう
  let best = null, bd = 1e9;
  for (const t of act) {
    const c = tgtCenter(t), s = toScreen(c, t.ui); if (s.z > 1) continue;
    const edge = toScreen(c.clone().add(t.ui ? V(tgtRadius(t), 0, 0) : camera.up.clone().multiplyScalar(tgtRadius(t))), t.ui);
    const rad = Math.max(50, Math.hypot(edge.x - s.x, edge.y - s.y) * 1.15);
    const d = Math.hypot(s.x - cx, s.y - cy);
    if (d < rad && d / rad < bd) { bd = d / rad; best = { t, p: c }; }
  }
  return best;
}
const fx = $('fx');
const WAND_SVG = '<svg viewBox="0 0 110 110"><line x1="20" y1="98" x2="84" y2="26" stroke="#ff6fa8" stroke-width="9" stroke-linecap="round"/><path d="M90 2l6 12 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2z" fill="#ffd23a" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><circle cx="20" cy="97" r="13" fill="#ffdcc6" stroke="#b37c63" stroke-width="3"/></svg>';
function domFx(x, y, wandOn) {
  const e = document.createElement('div');
  if (wandOn) { e.className = 'wand'; e.innerHTML = WAND_SVG; e.style.transformOrigin = '18% 88%'; }
  else e.className = 'ripple';
  e.style.left = x + 'px'; e.style.top = y + 'px'; fx.appendChild(e);
  setTimeout(() => e.remove(), 700);
  for (let i = 0; i < (wandOn ? 7 : 3); i++) {
    const s = document.createElement('div'); s.className = 'spark';
    s.style.left = x + 'px'; s.style.top = y + 'px'; s.style.setProperty('--dx', rand(-70, 70) + 'px'); s.style.setProperty('--dy', rand(-80, 30) + 'px');
    s.style.animationDelay = (wandOn ? 0.25 : 0) + i * 0.03 + 's';
    fx.appendChild(s); setTimeout(() => s.remove(), 1300);
  }
}
let lastTap = performance.now(), started = false;
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault(); unlockAudio(); if (!started) return;
  lastTap = performance.now(); $('hint').classList.remove('on');
  const h = pick(e.clientX, e.clientY);
  if (!h || h.t.busy) { domFx(e.clientX, e.clientY, false); return; }
  domFx(e.clientX, e.clientY, h.t.wand);
  if (!h.t.ui) girlTap();
  h.t.onTap(h.p, h.t);
}, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// ヒント（しばらく触らないと次に触る物が光る）
let hintFn = null;
function tickHint() {
  const el = $('hint');
  if (!hintFn || performance.now() - lastTap < 6500) { el.classList.remove('on'); return; }
  const t = hintFn(); if (!t) { el.classList.remove('on'); return; }
  const s = toScreen(tgtCenter(t), t.ui);
  el.style.left = s.x + 'px'; el.style.top = s.y + 'px'; el.classList.add('on');
}

// 星（進みぐあい）
function setStars(n) { const s = $('stars'); s.innerHTML = ''; for (let i = 0; i < n; i++) s.appendChild(document.createElement('i')); }
function fillStar() { const e = $('stars').querySelector('i:not(.on)'); if (e) { e.classList.add('on'); sfx.star(); } }
function fade(to, dur = 0.5) { const el = $('fade'), from = +el.style.opacity || 0; return anim(dur, (k) => el.style.opacity = lerp(from, to, k)); }

// ---------- ループ ----------
let last = performance.now();
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
}
addEventListener('resize', resize); resize();
function frame(now) {
  const dt = Math.min(DEBUG.has('fast') ? 0.4 : 0.05, (now - last) / 1000); last = now;
  for (const tw of [...tweens]) { tw.t += dt; const k = Math.min(1, tw.t / tw.dur); tw.fn(tw.e(k), k); if (k >= 1) { tweens.delete(tw); tw.res(); } }
  for (const f of ticks) f(dt, now / 1000);
  tickParts(dt); tickVehicles(dt); tickGirl(dt); tickDad(dt); tickHint();
  // カメラ
  const a = innerWidth / innerHeight, h = THREE.MathUtils.degToRad(cam.h);
  camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(Math.max(2 * Math.atan(Math.tan(h) / a), 2 * Math.atan(Math.tan(h) / 1.75))), 30, 100);
  camera.aspect = a; camera.updateProjectionMatrix();
  cam.shake = Math.max(0, cam.shake - dt * 1.5);
  camera.position.copy(cam.pos).add(V(rand(-1, 1), rand(-1, 1), 0).multiplyScalar(cam.shake * 0.12));
  camera.lookAt(cam.tgt);
  renderer.setViewport(0, 0, innerWidth, innerHeight); renderer.setScissorTest(false);
  renderer.clear();
  renderer.render(scene, camera);
  const r = uiRect(); placeUiCam(r);
  renderer.setScissorTest(true); renderer.setViewport(r.x, r.y, r.w, r.h); renderer.setScissor(r.x, r.y, r.w, r.h);
  renderer.clearDepth(); renderer.render(uiScene, uiCam); renderer.setScissorTest(false);
  requestAnimationFrame(frame);
}
cam.pos.copy(SHOT.costume[0]); cam.tgt.copy(SHOT.costume[1]); cam.h = SHOT.costume[2];
requestAnimationFrame(frame);

// =====================================================================
// 場面0：帽子をえらぶ
// =====================================================================
const HATS = [
  { kind: 'cap', pants: 0x2f6fd8, top: 0xfdfdfd, pos: V(-1.75, 3.05, 0.6) },
  { kind: 'helmet', pants: 0xff8a2a, top: 0xfff3c4, pos: V(0, 3.85, 0.3) },
  { kind: 'driver', pants: 0x26345c, top: 0xd8ecff, pos: V(1.75, 3.05, 0.6) },
];
async function sceneCostume() {
  girl.set('happy', 1.2); sfx.sparkle();
  const hatObjs = HATS.map((h, i) => {
    const g = M.makeHat(h.kind); g.position.copy(h.pos); g.rotation.x = 0.5; g.scale.setScalar(0); uiScene.add(g);
    const glow = new THREE.Sprite(sparkMats[i % 4]); glow.scale.setScalar(1.6); glow.position.set(0, 0.15, -0.4); g.add(glow);
    anim(0.6, (k) => g.scale.setScalar(ease.back(k) * 1.1)).then(() => {});
    return g;
  });
  const bob = (dt, t) => hatObjs.forEach((g, i) => { if (!g.userData.chosen) { g.position.y = HATS[i].pos.y + Math.sin(t * 2.2 + i) * 0.1; g.rotation.z = Math.sin(t * 1.5 + i) * 0.2; } });
  ticks.add(bob);
  const chosen = await new Promise((res) => {
    hatObjs.forEach((g, i) => addTarget(g, () => res(i), { ui: true, r: 0.8, kind: 'hat' }));
    hintFn = () => targets.find((t) => t.obj === hatObjs[1]);
  });
  hintFn = null;
  ticks.delete(bob);
  for (const g of hatObjs) removeTarget(targets.find((t) => t.obj === g));
  const g = hatObjs[chosen]; g.userData.chosen = true; g.children.filter((c) => c.isSprite).forEach((c) => g.remove(c));
  hatObjs.forEach((o, i) => { if (i !== chosen) anim(0.4, (k) => o.scale.setScalar(1.1 * (1 - k))).then(() => uiScene.remove(o)); });
  sfx.whoosh();
  girl.headG.updateMatrixWorld(true);
  const start = g.position.clone(), end = girl.hatSlot.getWorldPosition(V());
  await anim(0.7, (k) => { g.position.lerpVectors(start, end, k); g.position.y += Math.sin(k * PI) * 0.6; g.rotation.y = k * PI * 2; g.scale.setScalar(lerp(1.1, 1, k)); });
  girl.hatSlot.attach(g); g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.scale.setScalar(1);
  girl.mats.pants.color.setHex(HATS[chosen].pants); girl.mats.top.color.setHex(HATS[chosen].top);
  sfx.pop(0, 79); sfx.sparkle(0.1);
  girl.set('happy', 1.5);
  await wait(0.3);
  sfx.sparkle(); await anim(0.5, (k) => wand.scale.setScalar(ease.back(k)));
  await wait(0.7);
  addTarget(girl.g, () => { girl.set('giggle', 1.2); sfx.giggle(); }, { ui: true, r: 1.5, kind: 'girl' });
}

// =====================================================================
// 場面1：ミニカーを杖でとんとん → 本物の大きさに
// =====================================================================
async function scene1() {
  hemi.intensity = 1.15;
  await Promise.all([shot(...SHOT.s1, 2.0), anim(1.4, (k) => ui.t = k)]);
  setStars(6);
  await dadGag();
  let done = 0;
  await new Promise((res) => {
    for (const v of Object.values(vehicles)) {
      const t = addTarget(v, async () => {
        t.active = false; await growCar(v); done++; if (done === 6) res();
      }, { wand: true, r: 0.32, center: () => v.position.clone().add(V(0, 0.1, 0)) });
      v.userData.tgt1 = t;
    }
    hintFn = () => Object.values(vehicles).map((v) => v.userData.tgt1).find((t) => t.active && !busy1);
  });
  hintFn = null;
  for (const v of Object.values(vehicles)) removeTarget(v.userData.tgt1);
  girl.set('happy', 2); sfx.fanfare(); cheerDad(2);
  await wait(1.6);
}
async function dadGag() {
  const toy = vehicles.police;
  dad.g.position.set(-3.0, 0, -1.7); dad.g.visible = true; dad.set('normal');
  await walkDad(V(-1.62, 0, -3.5), 1.3, PI / 2);
  // しゃがむ
  await anim(0.4, (k) => { dad.body.position.y = -k * 0.9; dad.body.rotation.x = k * 0.35; });
  const arm = dad.arms[1];
  for (let n = 0; n < 2; n++) {
    await anim(0.35, (k) => arm.rotation.x = -k * 2.6);
    await anim(0.12, (k) => arm.rotation.x = -2.6 + k * 1.8, ease.in);
    sfx.knock(); sfx.boing(0.05);
    const y0 = toy.position.y;
    if (n === 0) {
      await anim(0.5, (k) => { toy.position.y = y0 + Math.sin(k * PI) * 0.25; toy.rotation.z = Math.sin(k * PI * 2) * 0.3; });
      toy.rotation.z = 0; dad.set('are', 1.2); sfx.are(); await wait(0.9);
    } else {
      // はね返ってパパの頭にこつん
      anim(0.45, (k) => { toy.position.y = y0 + Math.sin(k * PI) * 0.18; });
      await anim(0.22, (k) => arm.rotation.x = -0.8 - k * 2.5, ease.out);
      sfx.bonk(); dad.set('dizzy', 2.6); dadStars.visible = true;
      await anim(0.5, (k) => { dad.body.position.y = -0.9 - k * 0.5; dad.body.rotation.x = 0.35 - k * 0.6; arm.rotation.x = -3.3 + k * 3.3; });
      girl.set('giggle', 1.6); sfx.giggle();
    }
  }
  await wait(1.4);
  dadStars.visible = false;
  await anim(0.5, (k) => { dad.body.position.y = -1.4 * (1 - k); dad.body.rotation.x = -0.25 * (1 - k); });
  hammer.visible = false;
  dad.set('normal');
  await walkDad(V(-2.75, 0, -2.0), 1.0);
  dad.g.rotation.y = 2.6;
  // 看板がぴょこん（杖ならできるよ）
  sfx.sparkle(); const b = W0.board;
  burst(b.getWorldPosition(V()), 18, 0.25, 1.5);
  await anim(0.7, (k) => b.scale.setScalar(1 + Math.sin(k * PI * 2) * 0.12));
  girl.set('determined', 1.5);
}
let busy1 = false;
async function growCar(v) {
  busy1 = true;
  for (const o of Object.values(vehicles)) if (o.userData.tgt1) o.userData.tgt1.busy = true;
  girl.set('wow', 1.5); sfx.tonton();
  const p0 = v.position.clone(), y0 = v.rotation.y;
  burst(p0.clone().add(V(0, 0.15, 0)), 20, 0.12, 1);
  await anim(0.5, (k) => { v.scale.setScalar(TOY * (1 + Math.sin(k * PI * 4) * 0.12)); });
  sfx.grow(); sfx.whoosh();
  const land = V(0, 0, 9.5), yaw1 = yawTo(1, -0.75) + PI * 2;
  shot(...SHOT.s1b, 1.4);
  await anim(1.5, (k) => {
    v.position.lerpVectors(p0, land, k); v.position.y = Math.sin(k * PI) * 2.0;
    v.scale.setScalar(lerp(TOY, 1, Math.pow(k, 2.2)));
    v.rotation.y = lerp(y0, yaw1, k);
    if (Math.random() < 0.5) burst(v.position.clone().add(V(0, 0.5 * v.scale.x, 0)), 1, 0.3 + 0.5 * k, 1);
  });
  v.rotation.y = yawTo(1, -0.75);
  sfx.thump(); cam.shake = 0.6;
  burst(V(0, 1.5, 9.5), 40, 0.55, 5);
  await anim(0.4, (k) => v.scale.set(1 + Math.sin(k * PI) * 0.06, 1 - Math.sin(k * PI) * 0.08, 1 + Math.sin(k * PI) * 0.06));
  girl.set('happy', 2.2); cheerDad(1.6); fillStar();
  await signature(v); await wait(1.0);
  // 出発！
  sfx.engine(1.3);
  const d = frontDir(v), from = v.position.clone();
  shot(...SHOT.s1, 1.4);
  await anim(1.4, (k) => { v.position.copy(from).addScaledVector(d, k * 26); v.userData.wheels.forEach((w) => w.rotation.z -= 0.3); }, ease.in);
  v.visible = false; v.position.copy(from);
  busy1 = false;
  for (const o of Object.values(vehicles)) if (o.userData.tgt1) o.userData.tgt1.busy = false;
}

// =====================================================================
// 場面2：はたらく車のおしごと
// =====================================================================
const S2 = {
  garbage: [-5.2, 12.8, -0.75, 1],
  mixer: [0.6, 15.2, 0.15, 1],
  dump: [5.6, 13.6, 0.5, 1],
  ambulance: [-13, 21, 1, -0.15],
  bus: [-3, 24.5, 1, 0],
  police: [10, 21.5, -1, -0.2],
};
let bags = [], ball, slab, slabFrame, pile, stream, sandStream;
async function scene2() {
  setStars(3);
  for (const [k, v] of Object.entries(vehicles)) {
    const p = S2[k]; v.rotation.y = yawTo(p[2], p[3]); v.position.set(p[0], 0, p[1]); v.scale.setScalar(1); v.visible = true;
  }
  scene.updateMatrixWorld(true);
  buildS2Props();
  // 車が後ろ向きにバックで入ってくる
  const finals = {};
  for (const [k, v] of Object.entries(vehicles)) { finals[k] = v.position.clone(); v.position.addScaledVector(frontDir(v), 22); }
  dad.g.position.set(-11, 0, 5.2); dad.set('normal'); hammer.visible = false;
  const camP = shot(...SHOT.s2, 2.4);
  sfx.beep(); sfx.engine(2.4);
  const keys = Object.keys(vehicles);
  await Promise.all(keys.map((k, i) => wait(i * 0.18).then(() => { const v = vehicles[k], s = v.position.clone(); return anim(2.0, (q) => { v.position.lerpVectors(s, finals[k], q); v.userData.wheels.forEach((w) => w.rotation.z += 0.12 * (1 - q)); }, ease.out); })));
  await camP;
  await dadSpill();
  // おしごと
  let jobs = 0;
  await new Promise((res) => {
    const finish = () => { jobs++; fillStar(); if (jobs === 3) res(); };
    setupGarbage(finish); setupMixer(finish); setupDump(finish);
    for (const k of ['ambulance', 'bus', 'police']) addTarget(vehicles[k], () => playVehicle(k), { r: 2.5 });
    hintFn = () => {
      const b = bags.find((b) => b.userData.tgt.active);
      if (b) return b.userData.tgt;
      return [vehicles.mixer, vehicles.dump].map((v) => v.userData.job).find((t) => t && !t.done);
    };
  });
  hintFn = null;
  await wait(1.2);
  sfx.fanfare(); confetti(V(0, 0, 9), 90, 7); girl.set('happy', 2.5); cheerDad(2.5);
  setTimeout(() => sfx.busHorn(), 600); setTimeout(() => sfx.truckHorn(), 1100);
  await wait(2.8);
}
function playVehicle(k) {
  const v = vehicles[k], t = v.userData.playT;
  girl.set('happy', 1.2);
  if (t && t.busy) return;
  signature(v);
}
function buildS2Props() {
  // こぼれたゴミ袋とボール（最初はパパが持っている）
  for (let i = 0; i < 5; i++) { const b = M.makeBag(); b.scale.setScalar(0.9 + Math.random() * 0.2); world.add(b); bags.push(b); }
  ball = M.makeBall(); world.add(ball);
  // コンクリートの型枠
  const ce = vehicles.mixer.userData.chuteEnd.getWorldPosition(V());
  slabFrame = new THREE.Group(); slabFrame.position.set(ce.x, 0, ce.z - 0.6); world.add(slabFrame);
  const wd = M.matte('#c08a50', 0.8);
  for (const [w, d, x, z] of [[2.6, 0.12, 0, -1.25], [2.6, 0.12, 0, 1.25], [0.12, 2.6, -1.25, 0], [0.12, 2.6, 1.25, 0]]) M.box(w, 0.22, d, wd, x, 0.11, z, slabFrame);
  slab = M.box(2.38, 1, 2.38, new THREE.MeshPhysicalMaterial({ color: 0x8a877f, roughness: 0.6, clearcoat: 0.2 }), 0, 0, 0, slabFrame);
  slab.scale.y = 0.001; slab.position.y = 0;
  stream = M.cyl(0.13, 0.17, 1, slab.material, 0, 0, 0, world, 12); stream.visible = false;
  // 砂山
  const dmp = vehicles.dump, back = frontDir(dmp).multiplyScalar(-5.0).add(dmp.position);
  const pg = new THREE.ConeGeometry(1.3, 1.05, 40, 6); const pp = pg.attributes.position;
  for (let i = 0; i < pp.count; i++) { const y = pp.getY(i); if (y < 0.64 && y > -0.64) { const k = 1 + rand(-0.05, 0.05); pp.setX(i, pp.getX(i) * k); pp.setZ(i, pp.getZ(i) * k); } }
  pg.computeVertexNormals(); pg.translate(0, 0.52, 0);
  pile = new THREE.Mesh(pg, M.matte('#d9b878', 1)); pile.castShadow = pile.receiveShadow = true; pile.position.set(back.x, 0, back.z); pile.scale.setScalar(0.001); world.add(pile);
  sandStream = M.cyl(0.25, 0.6, 1, pile.material, 0, 0, 0, world, 12); sandStream.visible = false;
}
async function dadSpill() {
  // パパがゴミ袋を山ほど運んで…つまずく
  const held = [...bags, ball];
  held.forEach((b, i) => { dad.g.add(b); b.scale.setScalar(2 * (b === ball ? 1 : 0.95)); b.position.set(i % 2 ? 0.3 : -0.3, 2.2 + Math.floor(i / 2) * 0.9 + (b === ball ? 0.3 : 0), 0.9); });
  dad.arms.forEach((a) => a.rotation.x = -1.4);
  await walkDad(V(-3.6, 0, 5.4), 2.3);
  sfx.oops(); dad.set('wow', 1);
  await anim(0.35, (k) => { dad.body.rotation.x = k * 0.7; });
  const spots = [V(-3.1, 0, 8.8), V(-2.0, 0, 9.9), V(-0.6, 0, 7.8), V(-2.4, 0, 7.2), V(-1.0, 0, 10.5), V(0.8, 0, 8.4)];
  scene.updateMatrixWorld(true);
  held.forEach((b, i) => {
    world.attach(b); const s = b.position.clone(), e = spots[i]; b.scale.setScalar(b === ball ? 1 : rand(0.9, 1.05));
    const y1 = b === ball ? 0.3 : 0;
    anim(0.9 + i * 0.05, (k) => { b.position.lerpVectors(s, e, k); b.position.y = lerp(s.y, y1, k) + Math.sin(k * PI) * 1.6; b.rotation.z = k * 4; }, ease.lin).then(() => { b.rotation.set(0, rand(0, 6), b === ball ? 0 : rand(-0.2, 0.2)); sfx.pop(0, 60 + i * 2); });
  });
  await anim(0.4, (k) => { dad.body.rotation.x = 0.7 - k * 0.95; dad.body.position.y = -k * 1.4; });
  sfx.thump(); cam.shake = 0.3; dad.set('sad', 2.5);
  dad.arms.forEach((a) => a.rotation.x = 0);
  await wait(1.0);
  girl.set('determined', 2.2);
  await wait(1.2);
  await anim(0.5, (k) => { dad.body.rotation.x = -0.25 * (1 - k); dad.body.position.y = -1.4 * (1 - k); });
  await walkDad(V(-3.9, 0, 10.6), 1.4);
  dad.g.rotation.y = faceCam(dad.g); dad.set('normal');
}
function setupGarbage(finish) {
  const gt = vehicles.garbage; let eaten = 0;
  const mouthW = () => gt.localToWorld(gt.userData.mouthPos.clone());
  const busyT = { busy: false };
  for (const b of bags) {
    const t = addTarget(b, async () => {
      t.active = false; sfx.whoosh(); girl.set('happy', 1);
      const s = b.position.clone(), e = mouthW();
      await anim(0.8, (k) => { b.position.lerpVectors(s, e, k); b.position.y += Math.sin(k * PI) * 1.8; b.rotation.y += 0.2; b.scale.setScalar(lerp(1, 0.7, k)); });
      b.visible = false; sfx.munch(); munchAnim(gt);
      eaten++;
      if (eaten === bags.length) { await wait(0.8); sfx.melody(); gt.userData.flash = 2; addStarBadge(gt); finish(); addTarget(gt, () => playVehicle('garbage'), { r: 3 }); }
    }, { r: 0.6, kind: 'bag' });
  }
  // ちがう物：ボール → ぺっ → パパ「あれ？」→ にっこり
  let withDad = false;
  const bt = addTarget(ball, async () => {
    if (bt.busy) return; bt.busy = true;
    if (!withDad) {
      sfx.whoosh(); const s = ball.position.clone(), e = mouthW();
      await anim(0.8, (k) => { ball.position.lerpVectors(s, e, k); ball.position.y += Math.sin(k * PI) * 1.8; });
      sfx.munch(); await munchAnim(gt); sfx.spit(); girl.set('are', 1.4); sfx.are();
      const hand = () => dad.g.localToWorld(V(0, 2.3, 0.9));
      const s2 = ball.position.clone();
      dad.arms.forEach((a) => a.rotation.x = -1.3);
      await anim(1.0, (k) => { ball.position.lerpVectors(s2, hand(), k); ball.position.y += Math.sin(k * PI) * 2.6; }, ease.lin);
      sfx.boing(); dad.set('are', 1.3); sfx.are();
      withDad = true; ticks.add(() => { if (withDad && !ball.userData.toss) ball.position.copy(hand()); });
      await wait(1.3);
      dad.set('happy', 1.6); girl.set('happy', 1.6); sfx.giggle();
    } else {
      ball.userData.toss = true; sfx.boing(); dad.set('happy', 1.2);
      const s = ball.position.clone();
      await anim(0.9, (k) => { ball.position.copy(s); ball.position.y += Math.sin(k * PI) * 2.2; ball.rotation.x += 0.2; });
      ball.userData.toss = false;
    }
    bt.busy = false;
  }, { r: 0.5, kind: 'ball' });
  addTarget(dad.g, () => { if (withDad) bt.onTap(); else { cheerDad(1.2); sfx.giggle(); } }, { r: 1, kind: 'dad' });
}
function addStarBadge(v) {
  const s = M.makeStar(0.55); s.position.set(0, 4.3, 0); v.add(s); s.scale.setScalar(0);
  anim(0.6, (k) => s.scale.setScalar(ease.back(k)));
  ticks.add((dt) => s.rotation.y += dt * 2);
  burst(v.localToWorld(V(0, 4.3, 0)), 30, 0.5, 4);
}
function setupMixer(finish) {
  const mx = vehicles.mixer; let fills = 0;
  const t = addTarget(mx, async () => {
    if (t.busy) return;
    if (t.done) { playVehicle('mixer'); return; }
    t.busy = true; girl.set('wow', 1);
    sfx.rumble(2.2); mx.userData.spinBoost = 2.4;
    await wait(0.4);
    const ce = mx.userData.chuteEnd.getWorldPosition(V());
    const top0 = slab.scale.y, top1 = (fills + 1) / 3 * 0.2;
    stream.visible = true; sfx.pour(1.5);
    await anim(1.5, (k) => {
      const top = lerp(top0, top1, k); slab.scale.y = Math.max(0.001, top); slab.position.y = top / 2;
      const bot = top, h = ce.y - bot; stream.scale.set(1, h, 1); stream.position.set(ce.x, bot + h / 2, ce.z);
      stream.position.z += -0.3 * Math.sin(k * 20) * 0; slabFrame.position.y = 0;
    }, ease.lin);
    stream.visible = false; fills++;
    burst(slabFrame.position.clone().add(V(0, 0.3, 0)), 12, 0.3, 2);
    girl.set('happy', 1.2);
    if (fills === 3) {
      t.done = true; slab.material.roughness = 0.25; sfx.sparkle(); addStarBadge(mx); finish();
      addTarget(slab, (p) => handprint(p), { r: 1.4, kind: 'slab' });
    }
    t.busy = false;
  }, { r: 3.2 });
  mx.userData.job = t;
}
const handTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = 'rgba(90,88,82,0.75)';
  x.beginPath(); x.ellipse(64, 78, 26, 30, 0, 0, PI * 2); x.fill();
  for (const [a, l] of [[-0.9, 20], [-0.35, 30], [0, 34], [0.35, 30], [0.75, 24]]) { x.save(); x.translate(64, 64); x.rotate(a); x.beginPath(); x.ellipse(0, -34 - l / 2 + 10, 8, l / 2 + 4, 0, 0, PI * 2); x.fill(); x.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
function handprint(p) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshStandardMaterial({ map: handTex, transparent: true, depthWrite: false, roughness: 0.8 }));
  m.rotation.x = -PI / 2; m.rotation.z = rand(-0.5, 0.5);
  const top = slab.scale.y + 0.006;
  const lp = slabFrame.worldToLocal(p.clone()); lp.x = THREE.MathUtils.clamp(lp.x, -1, 1); lp.z = THREE.MathUtils.clamp(lp.z, -1, 1);
  m.position.set(lp.x, top, lp.z); slabFrame.add(m); sfx.pop(0, 70 + Math.floor(rand(0, 8))); girl.set('giggle', 1); m.scale.setScalar(0.1);
  anim(0.25, (k) => m.scale.setScalar(lerp(0.1, 1, k)));
}
function setupDump(finish) {
  const dp = vehicles.dump, u = dp.userData;
  const t = addTarget(dp, async () => {
    if (t.busy) return;
    if (t.done) { playVehicle('dump'); return; }
    t.busy = true; girl.set('wow', 1);
    sfx.beep(); await wait(0.6);
    sfx.sand(2.0);
    const lip = () => dp.localToWorld(V(-3.6, 1.3, 0));
    await anim(2.0, (k) => {
      u.bed.rotation.z = ease.io(Math.min(1, k * 1.4)) * 0.9;
      const f = Math.max(0, (k - 0.25) / 0.75);
      u.sand.scale.set(2.2 * (1 - f * 0.9), 0.75 * (1 - f * 0.8), 1.05); u.sand.position.x = 2.4 - f * 1.6;
      pile.scale.setScalar(Math.max(0.001, ease.out(f)));
      sandStream.visible = f > 0 && f < 1;
      const lp = lip(), h = Math.max(0.1, lp.y - pile.scale.y * 1.0);
      sandStream.scale.set(1, h, 1); sandStream.position.set(lp.x, lp.y - h / 2, lp.z);
    }, ease.lin);
    sandStream.visible = false; u.sand.visible = false;
    burst(pile.position.clone().add(V(0, 1.2, 0)), 20, 0.4, 3);
    girl.set('happy', 1.5);
    await anim(1.2, (k) => u.bed.rotation.z = 0.9 * (1 - k));
    t.done = true; addStarBadge(dp); finish(); t.busy = false;
    addTarget(pile, (p) => { burst(p.clone(), 14, 0.3, 2); sfx.pop(0, 72); girl.set('giggle', 1); }, { r: 1.6, kind: 'pile' });
  }, { r: 3 });
  u.job = t;
}

// =====================================================================
// 場面3：恐竜の足あと → おもちゃが大きく → 巻き尺でくらべっこ
// =====================================================================
async function scene3() {
  setStars(2);
  // どすん、どすん
  for (let i = 0; i < 3; i++) { sfx.thump(); cam.shake = 0.7; await wait(0.55); }
  girl.set('wow', 1.6); sfx.wow();
  const blanket = makeBlanket(); blanket.position.set(10.3, 0.01, 7.1); world.add(blanket);
  const dino = M.makeDino(), croc = M.makeCroc();
  for (const [a, x, z, s] of [[dino, 10.3, 7.4, 1 / 13], [croc, 9.9, 6.6, 1 / 11]]) { a.position.set(x, 0, z); a.rotation.y = 0.5; a.scale.setScalar(s); world.add(a); a.userData.s0 = s; }
  for (const a of [dino, croc]) { const b = new THREE.Box3().setFromObject(a); a.userData.length = (b.max.x - b.min.x) / a.scale.x; }
  // 足あと
  const ce = slabFrame.position;
  const curve = new THREE.QuadraticBezierCurve3(V(ce.x + 0.6, 0, ce.z - 1.6), V(5.0, 0, 4.6), V(9.3, 0, 6.6));
  const ft = M.footprintTex(), prints = [];
  const N = 8;
  for (let i = 0; i < N; i++) {
    const k = (i + 0.5) / N, p = curve.getPoint(k), tg = curve.getTangent(k);
    const side = V(-tg.z, 0, tg.x).multiplyScalar(i % 2 ? 0.22 : -0.22);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75), new THREE.MeshStandardMaterial({ map: ft, transparent: true, depthWrite: false, roughness: 0.9 }));
    m.rotation.x = -PI / 2; m.rotation.z = Math.atan2(tg.x, tg.z) + PI; m.position.copy(p).add(side); m.position.y = 0.012; m.scale.setScalar(0.001);
    world.add(m); prints.push(m);
  }
  await shot(...SHOT.s3a, 1.8);
  for (const m of prints) { sfx.pop(0, 55); anim(0.3, (k) => m.scale.setScalar(ease.back(k))); await wait(0.18); }
  const glow = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.45, 32), new THREE.MeshBasicMaterial({ color: 0xffe46b, transparent: true, opacity: 0.9, depthWrite: false }));
  glow.rotation.x = -PI / 2; world.add(glow);
  let next = 0;
  const glowTick = (dt, t) => { glow.scale.setScalar(1 + Math.sin(t * 6) * 0.15); if (prints[next]) glow.position.set(prints[next].position.x, 0.02, prints[next].position.z); };
  ticks.add(glowTick);
  await new Promise((res) => {
    prints.forEach((m, i) => addTarget(m, () => {
      if (i < next) { sfx.note(i); return; }
      for (let j = next; j <= i; j++) { const q = prints[j]; sfx.note(j); burst(q.position.clone().add(V(0, 0.1, 0)), 8, 0.2, 1.5); anim(0.3, (k) => q.scale.setScalar(1 + Math.sin(k * PI) * 0.4)); }
      next = i + 1; girl.set('happy', 0.8);
      const fp = prints[Math.min(next, N - 1)].position;
      shot(V(lerp(5.0, fp.x, 0.5), 3.8, fp.z - 6.0), V(lerp(5.0, fp.x, 0.6), 0, fp.z + 0.8), 42, 1.0);
      if (next >= N) res();
    }, { r: 0.4, kind: 'print' }));
    hintFn = () => targets.find((t) => t.obj === prints[next]);
  });
  ticks.delete(glowTick); world.remove(glow);
  sfx.wow(); girl.set('wow', 1.5);
  await shot(V(9.4, 1.6, 3.6), V(10.1, 0.2, 7.1), 32, 1.2);
  // おもちゃを大きく
  let grown = 0;
  const lanes = { dino: [V(8.4, 0, 11.2), 9.0], croc: [V(8.4, 0, 6.2), 4.9] };
  await new Promise((res) => {
    for (const [a, key] of [[dino, 'dino'], [croc, 'croc']]) {
      const t = addTarget(a, async () => {
        t.active = false; t2.forEach((q) => q.busy = true);
        await growAnimal(a, key, lanes[key][0], grown === 0);
        grown++; t2.forEach((q) => q.busy = false);
        if (grown === 2) res();
      }, { wand: true, r: 0.3, kind: 'toy' });
      a.userData.t = t;
    }
    var t2 = [dino.userData.t, croc.userData.t];
    hintFn = () => t2.find((t) => t.active);
  });
  // 巻き尺
  await shot(...SHOT.s3b, 1.2);
  const tapes = {};
  for (const key of ['croc', 'dino']) {
    const tm = M.makeTapeMeasure(); tm.position.set(8.1, 0, lanes[key][1]); tm.scale.setScalar(0); world.add(tm); tapes[key] = tm;
    sfx.pop(0, 72); await anim(0.5, (k) => tm.scale.setScalar(ease.back(k) * 1.2));
  }
  let measured = 0;
  const animals = { dino, croc };
  await new Promise((res) => {
    for (const key of ['croc', 'dino']) {
      const tm = tapes[key], L = animals[key].userData.length + 0.05;
      const t = addTarget(tm, async () => {
        if (t.busy) return; t.busy = true;
        if (!tm.userData.done) {
          girl.set('wow', 1.4); sfx.zip(1.4);
          await anim(1.4, (k) => tm.userData.setLen(L * k), ease.out);
          sfx.pop(0, 84); burst(tm.userData.tip.getWorldPosition(V()).add(V(0, 0.3, 0)), 20, 0.4, 3);
          tm.userData.done = true; fillStar(); reactAnimal(animals[key], key); measured++;
          if (measured === 2) res();
        } else {
          // しまう⇔のばす
          const open = tm.userData.len > 0.1; sfx.zip(0.8);
          await anim(0.8, (k) => tm.userData.setLen(open ? L * (1 - k) : L * k), ease.io);
          if (!open) reactAnimal(animals[key], key);
        }
        t.busy = false;
      }, { r: 0.7, kind: 'tape', center: () => tm.position.clone().add(V(0.3, 0.4, 0)) });
      tm.userData.t = t;
    }
    hintFn = () => Object.values(tapes).map((tm) => tm.userData.t).find((t) => !t.obj.userData.done);
  });
  hintFn = null;
  await wait(1.0);
  // くらべっこ：長いのはどっち？
  girl.set('wow', 2); sfx.wow();
  for (const key of ['croc', 'dino']) { burst(tapes[key].userData.tip.getWorldPosition(V()).add(V(0, 0.5, 0)), 30, 0.6, 4); await wait(0.5); }
  reactAnimal(dino, 'dino');
  await wait(1.0);
  sfx.fanfare(); confetti(V(8, 0, 9), 120, 10); girl.set('happy', 3); cheerDad(3);
  // ここからはずっと自由に遊べる
  for (const [a, key] of [[dino, 'dino'], [croc, 'croc']]) { removeTarget(a.userData.t); addTarget(a, () => reactAnimal(a, key), { r: 2.5 }); }
  dad.g.position.set(4.2, 0, 6.2); dad.g.rotation.y = 0.3;
  await shot(...SHOT.s3c, 2.4);
  $('again').classList.add('on');
}
function makeBlanket() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#e8473f'; x.fillRect(0, 0, 128, 128); x.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 128; i += 32) { x.fillRect(i, 0, 12, 128); x.fillRect(0, i, 128, 12); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
  m.rotation.x = -PI / 2; m.rotation.z = 0.3; m.receiveShadow = true; return m;
}
async function growAnimal(a, key, to, first) {
  girl.set('wow', 1.4); sfx.tonton();
  const s0 = a.userData.s0, p0 = a.position.clone(), r0 = a.rotation.y;
  burst(p0.clone().add(V(0, 0.15, 0)), 16, 0.12, 1);
  await anim(0.5, (k) => a.scale.setScalar(s0 * (1 + Math.sin(k * PI * 4) * 0.15)));
  sfx.grow();
  if (first) shot(...SHOT.s3b, 1.6);
  await anim(1.6, (k) => {
    a.position.lerpVectors(p0, to, k); a.position.y = Math.sin(k * PI) * 2.5;
    a.scale.setScalar(lerp(s0, 1, Math.pow(k, 2))); a.rotation.y = lerp(r0, PI * 2, k);
    if (Math.random() < 0.5) burst(a.position.clone().add(V(2, 1.5 * k, 0)), 1, 0.4, 1);
  });
  a.rotation.y = 0;
  sfx.thump(); cam.shake = 0.8; burst(to.clone().add(V(3, 1, 0)), 40, 0.6, 5);
  girl.set('happy', 2); fillStarNo();
  reactAnimal(a, key);
}
function fillStarNo() {}
async function reactAnimal(a, key) {
  const u = a.userData;
  if (u.reacting) return; u.reacting = true;
  if (key === 'dino') {
    sfx.gao();
    await anim(1.3, (k) => { u.neck.rotation.z = Math.sin(k * PI * 2) * 0.18; u.head.rotation.z = Math.sin(k * PI * 3) * 0.25; u.tail.rotation.y = Math.sin(k * PI * 4) * 0.35; });
  } else {
    sfx.snap();
    await anim(1.0, (k) => { u.jaw.rotation.z = -Math.abs(Math.sin(k * PI * 2)) * 0.5; u.tail.rotation.y = Math.sin(k * PI * 4) * 0.4; });
  }
  u.reacting = false;
}

// =====================================================================
// 進行
// =====================================================================
$('again').addEventListener('click', () => location.reload());
async function main() {
  await sceneCostume();
  await scene1();
  await scene2();
  await scene3();
}
async function start() {
  if (started) return; started = true; unlockAudio();
  $('title').style.display = 'none';
  if (DEBUG.has('skip')) await debugSkip(DEBUG.get('skip'));
  else main();
}
$('play').addEventListener('pointerdown', (e) => { e.preventDefault(); start(); });
$('play').addEventListener('click', start);

// 確認用（?skip=1|2|3 で途中から）
async function debugSkip(n) {
  ui.t = 1; wand.scale.setScalar(1);
  const h = M.makeHat('cap'); girl.hatSlot.add(h);
  if (n === '1') { cam.pos.copy(SHOT.s1[0]); cam.tgt.copy(SHOT.s1[1]); cam.h = SHOT.s1[2]; await scene1(); await scene2(); await scene3(); return; }
  for (const v of Object.values(vehicles)) v.visible = false;
  dad.g.position.set(0, 0, -20);
  if (n === '2') { cam.pos.copy(SHOT.s1[0]); cam.tgt.copy(SHOT.s1[1]); await scene2(); await scene3(); return; }
  // 3: 場面2を終えた状態をつくる
  for (const [k, v] of Object.entries(vehicles)) { const p = S2[k]; v.rotation.y = yawTo(p[2], p[3]); v.position.set(p[0], 0, p[1]); v.scale.setScalar(1); v.visible = true; }
  scene.updateMatrixWorld(true); buildS2Props(); slab.scale.y = 0.2; slab.position.y = 0.1; pile.scale.setScalar(1); vehicles.dump.userData.sand.visible = false;
  bags.forEach((b) => b.visible = false); ball.visible = false; dad.g.position.set(-3.9, 0, 10.6);
  cam.pos.copy(SHOT.s2[0]); cam.tgt.copy(SHOT.s2[1]); cam.h = SHOT.s2[2];
  await scene3();
}
window.__game = { vehicles, shot, SHOT, cam, start, targets, girl, dad, ui,
  list: () => targets.filter((t) => t.active && !t.busy && t.obj.visible !== false).map((t, i) => Object.assign({ k: t.obj.userData.kind || t.obj.type, ui: t.ui }, toScreen(tgtCenter(t), t.ui))) };
