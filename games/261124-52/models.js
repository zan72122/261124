import * as THREE from './three.module.min.js';

// ---------- テクスチャ ----------
const loader = new THREE.TextureLoader();
function repeatTex(t, srgb = true) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const cbMap = repeatTex(loader.load('cardboard.jpg'));
const cbBump = repeatTex(loader.load('cardboard_bump.jpg'), false);

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function rnd(a, b) { return a + Math.random() * (b - a); }

export const tex = {
  grass: repeatTex(canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#5d8a3a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      const x = rnd(0, w), y = rnd(0, h), r = rnd(6, 26);
      g.fillStyle = `hsla(${rnd(80, 110)},${rnd(35, 55)}%,${rnd(26, 44)}%,0.25)`;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    for (let i = 0; i < 9000; i++) {
      const x = rnd(0, w), y = rnd(0, h);
      g.strokeStyle = `hsla(${rnd(75, 115)},${rnd(35, 65)}%,${rnd(25, 55)}%,0.7)`;
      g.lineWidth = rnd(0.6, 1.6); g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-3, 3), y - rnd(3, 9)); g.stroke();
    }
  })),
  deck: repeatTex(canvasTex(512, 512, (g, w, h) => {
    const n = 6, bh = h / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = `hsl(${rnd(26, 32)},${rnd(35, 45)}%,${rnd(52, 60)}%)`; g.fillRect(0, i * bh, w, bh);
      for (let k = 0; k < 60; k++) {
        g.strokeStyle = `rgba(90,55,25,${rnd(0.05, 0.18)})`; g.lineWidth = rnd(0.5, 2);
        const y = i * bh + rnd(3, bh - 3); g.beginPath(); g.moveTo(0, y);
        g.bezierCurveTo(w * 0.3, y + rnd(-4, 4), w * 0.6, y + rnd(-4, 4), w, y + rnd(-3, 3)); g.stroke();
      }
      g.fillStyle = 'rgba(40,25,10,0.55)'; g.fillRect(0, i * bh, w, 3);
      g.fillStyle = 'rgba(60,40,20,0.6)'; g.beginPath(); g.arc(rnd(20, w - 20), i * bh + bh / 2, 2.5, 0, 7); g.fill();
    }
  })),
  siding: repeatTex(canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#efe6d6'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) {
      const gr = g.createLinearGradient(0, y, 0, y + 32);
      gr.addColorStop(0, 'rgba(0,0,0,0.12)'); gr.addColorStop(0.15, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.03)');
      g.fillStyle = gr; g.fillRect(0, y, w, 32);
    }
    for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(0,0,0,${rnd(0, 0.04)})`; g.fillRect(rnd(0, w), rnd(0, h), 1, 1); }
  })),
  fence: repeatTex(canvasTex(256, 256, (g, w, h) => {
    const n = 4, bw = w / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = `hsl(${rnd(25, 32)},${rnd(25, 35)}%,${rnd(45, 55)}%)`; g.fillRect(i * bw, 0, bw, h);
      for (let k = 0; k < 30; k++) { g.strokeStyle = `rgba(70,45,20,${rnd(0.05, 0.2)})`; const x = i * bw + rnd(2, bw - 2); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + rnd(-3, 3), h); g.stroke(); }
      g.fillStyle = 'rgba(30,20,10,0.5)'; g.fillRect(i * bw, 0, 3, h);
    }
  })),
  sand: repeatTex(canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#eedbb0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { g.fillStyle = `hsla(${rnd(35, 45)},${rnd(30, 60)}%,${rnd(55, 90)}%,0.5)`; g.fillRect(rnd(0, w), rnd(0, h), 1.5, 1.5); }
  })),
  sea: repeatTex(canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#1f7fa8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = rnd(0, w), y = rnd(0, h);
      g.strokeStyle = `rgba(${rnd(150, 255)},${rnd(220, 255)},255,${rnd(0.08, 0.3)})`; g.lineWidth = rnd(1, 3);
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 4, x + rnd(15, 35), y); g.stroke();
    }
    for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(10,60,100,0.15)`; g.beginPath(); g.ellipse(rnd(0, w), rnd(0, h), rnd(10, 40), rnd(4, 10), 0, 0, 7); g.fill(); }
  })),
  belt: repeatTex(canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#2b2b2e'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { g.fillStyle = '#18181a'; g.fillRect(x, 0, 4, h); }
  })),
};

// ---------- 段ボール ----------
const cbCache = new Map();
export function cbMat(tint = 0xffffff) {
  if (!cbCache.has(tint)) cbCache.set(tint, new THREE.MeshStandardMaterial({ map: cbMap, bumpMap: cbBump, bumpScale: 1.5, color: tint, roughness: 0.93 }));
  return cbCache.get(tint);
}
const TILE = 0.55;
function scaleBoxUV(geo, w, h, d) {
  const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const ox = Math.random(), oy = Math.random();
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / TILE + ox, uv.getY(k) * dims[f][1] / TILE + oy);
  }
}
export function shadow(o, cast = true, recv = true) { o.traverse(m => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = recv; } }); return o; }
export function cbBox(w, h, d, tint) {
  const g = new THREE.BoxGeometry(w, h, d); scaleBoxUV(g, w, h, d);
  return shadow(new THREE.Mesh(g, cbMat(tint)));
}
export const tapeMat = new THREE.MeshStandardMaterial({ color: 0xf3ead6, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.72 });
export const colorTape = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35 });
export function mat(color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o }); }
export function fabric(color, o = {}) { return new THREE.MeshPhysicalMaterial({ color, roughness: 0.85, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.35), ...o }); }

// 上面にテープが貼られた段ボール箱
export function carton(w, h, d, tint) {
  const g = new THREE.Group();
  const b = cbBox(w, h, d, tint); b.position.y = h / 2; g.add(b);
  const seam = new THREE.Mesh(new THREE.BoxGeometry(w + 0.002, 0.002, 0.004), mat(0x5a4020)); seam.position.set(0, h + 0.001, 0); g.add(seam);
  const t1 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.006, 0.003, 0.07), tapeMat); t1.position.set(0, h + 0.002, 0); g.add(t1);
  for (const s of [-1, 1]) {
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.003, Math.min(0.12, h * 0.4), 0.07), tapeMat);
    t2.position.set(s * (w / 2 + 0.002), h - Math.min(0.06, h * 0.2), 0); g.add(t2);
  }
  return shadow(g);
}
// 穴のあいた段ボール板（ExtrudeGeometry）
export function cbPanel(shape, depth = 0.014, tint) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / TILE, uv.getY(i) / TILE);
  return shadow(new THREE.Mesh(geo, cbMat(tint)));
}

// ---------- 顔（キャンバス） ----------
function drawEye(g, x, y, kind, s = 1, lx = 0, ly = 0) {
  g.lineCap = 'round';
  if (kind === 'happy') { g.strokeStyle = '#2a1a12'; g.lineWidth = 7 * s; g.beginPath(); g.arc(x, y + 6 * s, 12 * s, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); return; }
  if (kind === 'closed') { g.strokeStyle = '#2a1a12'; g.lineWidth = 6 * s; g.beginPath(); g.arc(x, y - 4 * s, 12 * s, Math.PI * 0.2, Math.PI * 0.8); g.stroke(); return; }
  if (kind === 'dizzy') {
    g.strokeStyle = '#2a1a12'; g.lineWidth = 3.5 * s; g.beginPath();
    for (let a = 0; a < 14; a += 0.2) { const r = a * 1.1 * s; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    g.stroke(); return;
  }
  const big = kind === 'big' ? 1.25 : 1;
  const rx = 12 * s * big, ry = 16 * s * big;
  g.fillStyle = '#1c120c'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill();
  g.fillStyle = '#4a2c1a'; g.beginPath(); g.ellipse(x + lx * 4 * s, y + 3 * s + ly * 3 * s, rx * 0.62, ry * 0.6, 0, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 4 * s + lx * 3 * s, y - 6 * s + ly * 2 * s, 4.5 * s * big, 0, 7); g.fill();
  g.beginPath(); g.arc(x - 4 * s + lx * 2 * s, y + 6 * s, 2 * s, 0, 7); g.fill();
}
function drawMouth(g, x, y, kind, s = 1) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'smile') { g.strokeStyle = '#8a2e2e'; g.lineWidth = 5 * s; g.beginPath(); g.arc(x, y - 8 * s, 14 * s, Math.PI * 0.2, Math.PI * 0.8); g.stroke(); }
  else if (kind === 'open' || kind === 'wide') {
    const w = (kind === 'wide' ? 22 : 17) * s, hh = (kind === 'wide' ? 20 : 15) * s;
    g.fillStyle = '#7a1f28'; g.beginPath(); g.moveTo(x - w, y - 4 * s); g.quadraticCurveTo(x, y - 8 * s, x + w, y - 4 * s); g.quadraticCurveTo(x + w * 0.8, y + hh, x, y + hh); g.quadraticCurveTo(x - w * 0.8, y + hh, x - w, y - 4 * s); g.fill();
    g.fillStyle = '#ef7b8a'; g.beginPath(); g.ellipse(x, y + hh * 0.7, w * 0.5, hh * 0.32, 0, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.fillRect(x - w * 0.6, y - 5 * s, w * 1.2, 4 * s);
  }
  else if (kind === 'o') { g.fillStyle = '#7a1f28'; g.beginPath(); g.ellipse(x, y, 7 * s, 9 * s, 0, 0, 7); g.fill(); }
  else if (kind === 'O') { g.fillStyle = '#7a1f28'; g.beginPath(); g.ellipse(x, y + 2 * s, 11 * s, 14 * s, 0, 0, 7); g.fill(); }
  else if (kind === 'flat') { g.strokeStyle = '#8a2e2e'; g.lineWidth = 5 * s; g.beginPath(); g.moveTo(x - 9 * s, y); g.lineTo(x + 9 * s, y); g.stroke(); g.fillStyle = '#ef7b8a'; g.beginPath(); g.ellipse(x + 8 * s, y + 4 * s, 5 * s, 6 * s, 0, 0, 7); g.fill(); }
  else if (kind === 'wavy') { g.strokeStyle = '#8a2e2e'; g.lineWidth = 4 * s; g.beginPath(); for (let i = -14; i <= 14; i += 2) g.lineTo(x + i * s, y + Math.sin(i * 0.6) * 3 * s); g.stroke(); }
}
// 球の前面にかぶせる顔シェル
export function makeFace(radius, style) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
  const W = 2.3, H = 2.0;
  const geo = new THREE.SphereGeometry(radius * 1.004, 40, 30, Math.PI / 2 - W / 2, W, Math.PI / 2 - H / 2, H);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tx, transparent: true, roughness: 0.5, depthWrite: false }));
  m.renderOrder = 2;
  const st = { expr: 'smile', blink: false, lx: 0, ly: 0 };
  function draw() {
    g.clearRect(0, 0, 256, 256);
    const e = st.expr;
    // ほっぺ
    g.fillStyle = 'rgba(255,120,130,0.33)';
    g.beginPath(); g.ellipse(128 - 52, 158, 18, 11, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(128 + 52, 158, 18, 11, 0, 0, 7); g.fill();
    let eye = 'open', mouth = 'smile', lx = st.lx, ly = st.ly, brow = 0;
    if (e === 'joy') { eye = 'happy'; mouth = 'open'; }
    else if (e === 'laugh') { eye = 'happy'; mouth = 'wide'; }
    else if (e === 'oops') { mouth = 'o'; lx = 1; ly = -0.5; brow = 1; }
    else if (e === 'wow') { eye = 'big'; mouth = 'O'; brow = 2; }
    else if (e === 'focus') { mouth = 'flat'; ly = 0.8; }
    else if (e === 'dizzy') { eye = 'dizzy'; mouth = 'wavy'; }
    else if (e === 'wink') { mouth = 'open'; }
    if (st.blink && (eye === 'open' || eye === 'big')) eye = 'closed';
    const ey = 128 + style.eyeY;
    drawEye(g, 128 - style.eyeX, ey, e === 'wink' ? 'happy' : eye, style.s, lx, ly);
    drawEye(g, 128 + style.eyeX, ey, eye, style.s, lx, ly);
    // まゆ
    g.strokeStyle = style.brow; g.lineWidth = style.browW; g.lineCap = 'round';
    for (const sd of [-1, 1]) {
      const bx = 128 + sd * style.eyeX, by = ey - 30 * style.s - (brow === 2 ? 8 : (brow === 1 && sd === 1 ? 10 : 0));
      g.beginPath(); g.moveTo(bx - 12 * style.s, by + (brow === 1 && sd === 1 ? 4 : 2)); g.quadraticCurveTo(bx, by - 5, bx + 12 * style.s, by + 2); g.stroke();
    }
    drawMouth(g, 128, 128 + style.mouthY, mouth, style.s);
    if (style.extra) style.extra(g, e);
    tx.needsUpdate = true;
  }
  draw();
  return {
    mesh: m, st,
    set(expr) { if (st.expr !== expr) { st.expr = expr; draw(); } },
    setBlink(b) { if (st.blink !== b) { st.blink = b; draw(); } },
  };
}

// ---------- 人（女の子・パパ） ----------
export function makeHuman(p) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const skin = mat(p.skin, { roughness: 0.55 });
  // 足
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * p.hipX, p.legH + p.shoeH, 0); body.add(hip);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(p.legR, p.legR * 0.9, p.legH, 16), p.legMat || skin);
    leg.position.y = -p.legH / 2; hip.add(leg);
    if (p.sock) { const sk = new THREE.Mesh(new THREE.CylinderGeometry(p.legR * 1.05, p.legR * 1.05, p.legH * 0.25, 16), p.sock); sk.position.y = -p.legH + p.legH * 0.12; hip.add(sk); }
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), p.shoeMat);
    shoe.scale.set(p.legR * 1.5, p.shoeH, p.legR * 2.6); shoe.position.set(0, -p.legH - p.shoeH * 0.2, p.legR * 0.9); hip.add(shoe);
    legs.push(hip);
  }
  const hipY = p.legH + p.shoeH;
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(p.waistR, p.lowerR, p.lowerH, 24), p.lowerMat);
  lower.position.y = hipY + p.lowerH / 2 - 0.02; body.add(lower);
  const torsoY = hipY + p.lowerH - 0.02;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(p.chestR, p.waistR, p.torsoH, 24), p.topMat);
  torso.scale.z = 0.8; torso.position.y = torsoY + p.torsoH / 2; body.add(torso);
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(p.chestR, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), p.topMat);
  shoulders.scale.set(1, 0.35, 0.8); shoulders.position.y = torsoY + p.torsoH; body.add(shoulders);
  const neckY = torsoY + p.torsoH;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(p.headR * 0.28, p.headR * 0.3, p.headR * 0.5, 12), skin);
  neck.position.y = neckY + p.headR * 0.15; body.add(neck);
  // 頭
  const headPivot = new THREE.Group(); headPivot.position.y = neckY + p.headR * 0.3; body.add(headPivot);
  const head = new THREE.Group(); head.position.y = p.headR * 0.85; headPivot.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(p.headR, 32, 24), skin); skull.scale.set(1, 1.02, 0.96); head.add(skull);
  const face = makeFace(p.headR * 1.004, p.face); face.mesh.scale.copy(skull.scale); head.add(face.mesh);
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(p.headR * 0.18, 12, 8), skin); ear.scale.set(0.6, 1, 0.8); ear.position.set(s * p.headR * 0.97, -p.headR * 0.05, -p.headR * 0.05); head.add(ear); }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(p.headR * 0.09, 12, 8), skin); nose.position.set(0, -p.headR * 0.12, p.headR * 0.95); head.add(nose);
  if (p.hair) p.hair(head, p.headR);
  // 腕
  const arms = {};
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * (p.chestR + p.armR * 0.6), neckY - p.armR * 1.2, 0); body.add(sh);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(p.armR, p.armR * 0.95, p.armU, 14), p.sleeveMat); up.position.y = -p.armU / 2; sh.add(up);
    const shCap = new THREE.Mesh(new THREE.SphereGeometry(p.armR * 1.05, 14, 10), p.sleeveMat); sh.add(shCap);
    const el = new THREE.Group(); el.position.y = -p.armU; sh.add(el);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(p.armR * 0.9, p.armR * 0.8, p.armL, 14), p.foreMat || skin); fore.position.y = -p.armL / 2; el.add(fore);
    const elCap = new THREE.Mesh(new THREE.SphereGeometry(p.armR * 0.92, 12, 8), p.foreMat || skin); el.add(elCap);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(p.armR * 1.15, 14, 10), skin); hand.scale.set(0.85, 1.1, 0.7); hand.position.y = -p.armL - p.armR * 0.7; el.add(hand);
    arms[s < 0 ? 'R' : 'L'] = { sh, el, up, fore, hand, shCap, elCap, rest: new THREE.Quaternion(), target: null, elbow: 0, pose: null };
    sh.rotation.z = s * 0.12; arms[s < 0 ? 'R' : 'L'].rest.copy(sh.quaternion);
  }
  shadow(root);
  face.mesh.castShadow = false;
  const H = {
    root, body, head, headPivot, face, arms, legs, torso, shoulders, lower, p,
    height: neckY + p.headR * 2.2,
    look: null, lookYaw: 0, lookPitch: 0, headTilt: 0, blinkT: 2, breathe: 0, bounce: 0, exprTimer: 0, baseExpr: 'smile',
    setMats(top, sleeve) { torso.material = top; shoulders.material = top; for (const k in arms) { arms[k].up.material = sleeve; arms[k].shCap.material = sleeve; } },
    say(expr, dur = 1.5) { face.set(expr); H.exprTimer = dur; },
    sit() { for (const l of legs) l.rotation.x = -1.45; },
    stand() { for (const l of legs) l.rotation.x = 0; },
    update(dt, t) {
      H.blinkT -= dt;
      if (H.blinkT < 0) { face.setBlink(true); if (H.blinkT < -0.12) { face.setBlink(false); H.blinkT = rnd(1.8, 4.5); } }
      if (H.exprTimer > 0) { H.exprTimer -= dt; if (H.exprTimer <= 0) face.set(H.baseExpr); }
      body.scale.y = 1 + Math.sin(t * 2.2 + p.headR * 40) * 0.008;
      body.position.y = Math.abs(Math.sin(H.bounce)) * 0.08 * (H.bounceAmp || 0);
      // 視線
      let yaw = 0, pitch = 0;
      if (H.look) {
        const v = H.look.clone(); headPivot.parent.worldToLocal(v); v.sub(headPivot.position); v.y -= p.headR;
        yaw = Math.atan2(v.x, v.z); pitch = -Math.atan2(v.y, Math.hypot(v.x, v.z));
        yaw = THREE.MathUtils.clamp(yaw, -1.1, 1.1); pitch = THREE.MathUtils.clamp(pitch, -0.5, 0.45);
      }
      H.lookYaw += (yaw - H.lookYaw) * Math.min(1, dt * 6); H.lookPitch += (pitch - H.lookPitch) * Math.min(1, dt * 6);
      headPivot.rotation.set(H.lookPitch, H.lookYaw, H.headTilt + Math.sin(t * 1.3) * 0.03, 'YXZ');
      // 腕
      for (const k in arms) {
        const a = arms[k]; let q;
        if (a.pose) { q = a.pose(t); }
        else if (a.target) {
          const v = a.target.clone(); a.sh.parent.worldToLocal(v); v.sub(a.sh.position);
          if (v.lengthSq() < 1e-6) v.set(0, -1, 0);
          q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), v.normalize());
        } else q = a.rest;
        a.sh.quaternion.slerp(q, Math.min(1, dt * 8));
        a.el.rotation.x += ((a.elbowT || 0) - a.el.rotation.x) * Math.min(1, dt * 8);
      }
    },
  };
  return H;
}

export function makeGirl() {
  const pink = fabric(0xf27aa0), navy = fabric(0x1f2f5c);
  const hairMat = new THREE.MeshPhysicalMaterial({ color: 0x3a2416, roughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color(0x8a5a3a) });
  const g = makeHuman({
    skin: 0xf3c2a0, legH: 0.36, legR: 0.036, hipX: 0.055, shoeH: 0.04, shoeMat: mat(0xe8505b, { roughness: 0.4 }), sock: mat(0xffffff),
    lowerMat: fabric(0x2b3f78), waistR: 0.1, lowerR: 0.165, lowerH: 0.17,
    chestR: 0.105, torsoH: 0.24, topMat: pink, sleeveMat: pink, armR: 0.031, armU: 0.16, armL: 0.15, headR: 0.145,
    face: { eyeX: 42, eyeY: 10, mouthY: 50, s: 1.45, brow: '#3a2416', browW: 6 },
    hair(head, r) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 1.07, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
      cap.position.set(0, r * 0.04, -r * 0.06); cap.rotation.x = -0.32; head.add(cap);
      const back = new THREE.Mesh(new THREE.SphereGeometry(r * 1.06, 24, 16), hairMat); back.scale.set(1, 0.95, 0.9); back.position.set(0, -r * 0.05, -r * 0.18); head.add(back);
      const bang = new THREE.Mesh(new THREE.SphereGeometry(r * 0.75, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat);
      bang.scale.set(1.25, 0.55, 0.7); bang.position.set(0, r * 0.58, r * 0.42); bang.rotation.x = 0.55; head.add(bang);
      for (const s of [-1, 1]) {
        const tie = new THREE.Mesh(new THREE.TorusGeometry(r * 0.13, r * 0.06, 8, 16), mat(0xffd23f)); tie.position.set(s * r * 0.95, r * 0.25, -r * 0.25); tie.rotation.y = Math.PI / 2; head.add(tie);
        const tail = new THREE.Mesh(new THREE.SphereGeometry(r * 0.3, 16, 12), hairMat); tail.scale.set(0.8, 1.5, 0.8); tail.position.set(s * r * 1.12, r * 0.0, -r * 0.3); tail.rotation.z = s * 0.4; head.add(tail);
      }
    },
  });
  // 機長の帽子
  const hat = new THREE.Group();
  const r = 0.145;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.25, r * 1.02, r * 0.5, 32), fabric(0xffffff)); crown.position.y = r * 0.25; hat.add(crown);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.27, r * 1.27, r * 0.08, 32), fabric(0xffffff)); top.position.y = r * 0.52; hat.add(top);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.04, r * 1.03, r * 0.2, 32), fabric(0x14203f)); band.position.y = r * 0.1; hat.add(band);
  const visor = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.15, r * 1.15, r * 0.04, 32, 1, false, -Math.PI * 0.5, Math.PI), mat(0x111111, { roughness: 0.2 }));
  visor.position.set(0, 0.0, r * 0.25); visor.rotation.x = 0.18; visor.rotation.y = Math.PI; hat.add(visor);
  const gold = mat(0xe3b341, { metalness: 0.9, roughness: 0.3 });
  const badge = new THREE.Group(); badge.position.set(0, r * 0.3, r * 1.12);
  const bc = new THREE.Mesh(new THREE.SphereGeometry(r * 0.12, 12, 8), gold); bc.scale.z = 0.4; badge.add(bc);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(r * 0.38, r * 0.06, r * 0.03), gold); w.position.x = s * r * 0.24; w.rotation.z = s * 0.15; badge.add(w); }
  hat.add(badge);
  const cord = new THREE.Mesh(new THREE.BoxGeometry(r * 1.6, r * 0.04, r * 0.02), gold); cord.position.set(0, r * 0.05, r * 1.04); hat.add(cord);
  shadow(hat);
  g.hat = hat; g.hatSeat = new THREE.Vector3(0, r * 0.78, -r * 0.02); g.hatRot = new THREE.Euler(-0.18, 0, 0);
  // 制服（ジャケット）
  const jacket = new THREE.Group();
  const jt = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.125, 0.26, 24), navy); jt.scale.z = 0.8; jt.position.y = 0.13; jacket.add(jt);
  const collar = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.09, 3), fabric(0xffffff)); collar.rotation.x = Math.PI; collar.position.set(0, 0.22, 0.09); collar.scale.z = 0.3; jacket.add(collar);
  const tie2 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.08, 0.01), fabric(0x14203f)); tie2.position.set(0, 0.19, 0.105); jacket.add(tie2);
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), gold); b.position.set(s * 0.04, 0.15 - i * 0.055, 0.098 - i * 0.002); jacket.add(b); }
  for (const s of [-1, 1]) { const ep = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.045), gold); ep.position.set(s * 0.1, 0.255, 0); jacket.add(ep); }
  shadow(jacket);
  g.jacket = jacket; g.navy = navy; g.pink = pink;
  g.wearJacket = () => {
    g.setMats(navy, navy);
    for (const k in g.arms) {
      const a = g.arms[k];
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.06, 14), navy); cuff.position.y = -0.03; a.el.add(cuff);
      const st = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.005, 6, 16), gold); st.rotation.x = Math.PI / 2; st.position.y = -0.05; a.el.add(st);
    }
  };
  return g;
}

export function makePapa() {
  const vest = fabric(0xf6c21c), shirt = fabric(0x8fb8e0);
  const p = makeHuman({
    skin: 0xe9bd9c, legH: 0.82, legR: 0.068, hipX: 0.1, shoeH: 0.06, shoeMat: mat(0x3b2b22, { roughness: 0.5 }),
    legMat: fabric(0x3c5a86), lowerMat: fabric(0x3c5a86), waistR: 0.18, lowerR: 0.19, lowerH: 0.14,
    chestR: 0.21, torsoH: 0.52, topMat: vest, sleeveMat: shirt, foreMat: shirt, armR: 0.052, armU: 0.3, armL: 0.27, headR: 0.13,
    face: { eyeX: 36, eyeY: 8, mouthY: 50, s: 0.85, brow: '#2a1a10', browW: 8, extra(g, e) { g.fillStyle = 'rgba(60,40,30,0.12)'; g.beginPath(); g.ellipse(128, 190, 46, 30, 0, 0, 7); g.fill(); } },
    hair(head, r) {
      const hm = mat(0x2a1c14, { roughness: 0.6 });
      const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 1.05, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), hm); cap.position.set(0, r * 0.06, -r * 0.08); cap.rotation.x = -0.25; head.add(cap);
      const gl = mat(0x222222, { metalness: 0.6, roughness: 0.3 });
      for (const s of [-1, 1]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.24, r * 0.03, 8, 24), gl); ring.position.set(s * r * 0.3, -r * 0.02, r * 0.97); head.add(ring); }
      const br = new THREE.Mesh(new THREE.BoxGeometry(r * 0.15, r * 0.03, r * 0.03), gl); br.position.set(0, 0, r * 1.0); head.add(br);
      // 帽子
      const ch = new THREE.Mesh(new THREE.SphereGeometry(r * 1.08, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), fabric(0x1f3d7a)); ch.position.set(0, r * 0.12, 0); head.add(ch);
      const bill = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r * 0.75, r * 0.05, 24, 1, false, -Math.PI / 2, Math.PI), fabric(0x1f3d7a)); bill.position.set(0, r * 0.45, r * 0.75); bill.rotation.y = Math.PI; bill.rotation.x = 0.15; head.add(bill);
    },
  });
  // ベストの反射帯
  for (const y of [0.45, 0.65]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.212, 0.21, 0.035, 24), mat(0xdddddd, { metalness: 0.5, roughness: 0.3 })); b.scale.z = 0.8; b.position.y = p.torso.position.y - 0.26 + y * 0.52; p.body.add(b); }
  return p;
}

// ---------- ぬいぐるみの乗客 ----------
export function makePlush(kind) {
  const C = { bear: [0xa8714a, 0xe6c49e], bunny: [0xf3efe8, 0xffc4d0], dog: [0xe0c08c, 0x8a5a36] }[kind];
  const fur = fabric(C[0], { roughness: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xfff2e0) });
  const fur2 = fabric(C[1], { roughness: 1 });
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const S = 1.25;
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.14 * S, 24, 18), fur); torso.scale.set(1, 1.1, 0.9); torso.position.y = 0.2 * S; body.add(torso);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.1 * S, 20, 14), fur2); belly.scale.set(1, 1.1, 0.5); belly.position.set(0, 0.19 * S, 0.08 * S); body.add(belly);
  const headPivot = new THREE.Group(); headPivot.position.y = 0.33 * S; body.add(headPivot);
  const head = new THREE.Group(); head.position.y = 0.1 * S; headPivot.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13 * S, 28, 20), fur); head.add(skull);
  const muz = new THREE.Mesh(new THREE.SphereGeometry(0.055 * S, 16, 12), kind === 'dog' ? fabric(0xf2e2c4) : fur2); muz.scale.set(1.2, 0.85, 0.9); muz.position.set(0, -0.03 * S, 0.11 * S); head.add(muz);
  const black = mat(0x111111, { roughness: 0.15 });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018 * S, 12, 8), kind === 'bunny' ? mat(0xff8aa0, { roughness: 0.3 }) : black); nose.scale.set(1.3, 0.9, 1); nose.position.set(0, -0.01 * S, 0.16 * S); head.add(nose);
  const eyes = [];
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.018 * S, 12, 10), black); e.position.set(s * 0.05 * S, 0.03 * S, 0.118 * S); head.add(e); eyes.push(e); }
  const mouthSmile = new THREE.Mesh(new THREE.TorusGeometry(0.022 * S, 0.004 * S, 6, 16, Math.PI), mat(0x3a1a1a)); mouthSmile.rotation.z = Math.PI; mouthSmile.position.set(0, -0.045 * S, 0.155 * S); head.add(mouthSmile);
  const mouthOpen = new THREE.Mesh(new THREE.SphereGeometry(0.022 * S, 14, 10), mat(0x8a2a3a)); mouthOpen.scale.set(1.1, 0.9, 0.4); mouthOpen.position.set(0, -0.055 * S, 0.15 * S); head.add(mouthOpen);
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.022 * S, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff8090, transparent: true, opacity: 0.5 })); b.scale.z = 0.3; b.position.set(s * 0.085 * S, -0.025 * S, 0.1 * S); b.lookAt(b.position.clone().multiplyScalar(3)); head.add(b); }
  // 耳
  if (kind === 'bear') for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.045 * S, 14, 10), fur); e.scale.z = 0.6; e.position.set(s * 0.1 * S, 0.1 * S, 0); head.add(e); const ei = new THREE.Mesh(new THREE.SphereGeometry(0.028 * S, 12, 8), fur2); ei.scale.z = 0.4; ei.position.set(s * 0.1 * S, 0.1 * S, 0.02 * S); head.add(ei); }
  if (kind === 'bunny') for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.04 * S, 14, 12), fur); e.scale.set(0.8, 3, 0.45); e.position.set(s * 0.05 * S, 0.2 * S, -0.01); e.rotation.z = -s * 0.15; head.add(e); const ei = new THREE.Mesh(new THREE.SphereGeometry(0.026 * S, 12, 8), fur2); ei.scale.set(0.8, 3.4, 0.3); ei.position.set(s * 0.05 * S, 0.2 * S, 0.012 * S); ei.rotation.z = -s * 0.15; head.add(ei); }
  if (kind === 'dog') for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05 * S, 14, 10), fur2); e.scale.set(0.55, 1.5, 0.8); e.position.set(s * 0.125 * S, -0.0 * S, -0.01); e.rotation.z = s * 0.35; head.add(e); }
  // 手足
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const ap = new THREE.Group(); ap.position.set(s * 0.12 * S, 0.27 * S, 0); body.add(ap);
    const a = new THREE.Mesh(new THREE.SphereGeometry(0.045 * S, 14, 10), fur); a.scale.set(0.8, 1.7, 0.8); a.position.y = -0.06 * S; ap.add(a);
    ap.rotation.z = s * 0.5; arms.push(ap);
    const lp = new THREE.Group(); lp.position.set(s * 0.07 * S, 0.1 * S, 0.02); body.add(lp);
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.055 * S, 14, 10), fur); l.scale.set(0.9, 1.5, 0.9); l.position.y = -0.05 * S; lp.add(l);
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.04 * S, 12, 8), fur2); pad.scale.set(1, 1, 0.3); pad.position.set(0, -0.1 * S, 0.035 * S); pad.rotation.x = -1.2; lp.add(pad);
    legs.push(lp);
  }
  body.position.y = 0.06 * S;
  shadow(root);
  const P = {
    root, body, head, headPivot, arms, legs, kind, color: C[0],
    expr: 'smile', exprTimer: 0, hop: 0, tilt: 0, sweat: null, look: null, wave: 0,
    set(e) {
      P.expr = e;
      mouthSmile.visible = e === 'smile' || e === 'oops';
      mouthOpen.visible = e === 'joy' || e === 'wow';
      mouthOpen.scale.y = e === 'wow' ? 1.3 : 0.9;
      for (const ey of eyes) ey.scale.set(1, e === 'joy' ? 0.35 : 1, 1);
      if (e === 'oops') { mouthSmile.visible = false; mouthOpen.visible = true; mouthOpen.scale.set(0.6, 0.6, 0.4); } else mouthOpen.scale.x = 1.1;
      P.tilt = e === 'oops' ? 0.35 : 0;
    },
    say(e, d = 1.4) { P.set(e); P.exprTimer = d; },
    sit() { for (const l of legs) l.rotation.x = -1.45; body.position.y = 0.0; },
    stand() { for (const l of legs) l.rotation.x = 0; body.position.y = 0.06 * S; },
    update(dt, t) {
      if (P.exprTimer > 0) { P.exprTimer -= dt; if (P.exprTimer <= 0) P.set('smile'); }
      headPivot.rotation.z += (P.tilt - headPivot.rotation.z) * Math.min(1, dt * 6);
      let yaw = 0;
      if (P.look) { const v = P.look.clone(); headPivot.parent.worldToLocal(v); v.sub(headPivot.position); yaw = THREE.MathUtils.clamp(Math.atan2(v.x, v.z), -1, 1); }
      headPivot.rotation.y += (yaw - headPivot.rotation.y) * Math.min(1, dt * 5);
      body.scale.y = 1 + Math.sin(t * 2 + C[0]) * 0.01;
      if (P.wave > 0) { P.wave -= dt; arms[1].rotation.z = 2.4 + Math.sin(t * 14) * 0.4; } else arms[1].rotation.z += (0.5 - arms[1].rotation.z) * Math.min(1, dt * 6);
      if (P.cheer > 0) { P.cheer -= dt; arms[0].rotation.z = -2.4 - Math.sin(t * 12) * 0.3; arms[1].rotation.z = 2.4 + Math.sin(t * 12) * 0.3; }
      else if (P.wave <= 0) arms[0].rotation.z += (-0.5 - arms[0].rotation.z) * Math.min(1, dt * 6);
    },
  };
  P.set('smile');
  return P;
}

// ---------- 小物 ----------
export function spriteFromCanvas(w, h, draw, scale = 1) {
  const t = canvasTex(w, h, draw);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: true }));
  s.scale.set(scale * w / h, scale, 1);
  return s;
}
export function drawNoSign(g, cx, cy, r) {
  g.lineWidth = r * 0.2; g.strokeStyle = '#e02424';
  g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
  g.beginPath(); g.moveTo(cx - r * 0.7, cy - r * 0.7); g.lineTo(cx + r * 0.7, cy + r * 0.7); g.stroke();
}
export function drawCandy(g, cx, cy, r, kind) {
  if (kind === 'lolly') {
    g.fillStyle = '#f4f4f4'; g.fillRect(cx - r * 0.08, cy, r * 0.16, r * 1.3);
    g.fillStyle = '#ff5a8a'; g.beginPath(); g.arc(cx, cy - r * 0.2, r * 0.6, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = r * 0.12; g.beginPath(); for (let a = 0; a < 12; a += 0.2) g.lineTo(cx + Math.cos(a) * a * r * 0.045, cy - r * 0.2 + Math.sin(a) * a * r * 0.045); g.stroke();
  } else if (kind === 'donut') {
    g.fillStyle = '#d9a35a'; g.beginPath(); g.arc(cx, cy, r * 0.7, 0, 7); g.fill();
    g.fillStyle = '#ff8fc0'; g.beginPath(); g.arc(cx, cy, r * 0.6, 0, 7); g.fill();
    g.fillStyle = '#fff8ec'; g.beginPath(); g.arc(cx, cy, r * 0.22, 0, 7); g.fill();
  } else {
    g.fillStyle = '#5a3018'; g.fillRect(cx - r * 0.7, cy - r * 0.4, r * 1.4, r * 0.8);
    g.strokeStyle = '#3a1a08'; g.lineWidth = r * 0.06; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(cx + i * r * 0.46, cy - r * 0.4); g.lineTo(cx + i * r * 0.46, cy + r * 0.4); g.stroke(); }
  }
}

// 3Dのお菓子
export function makeCandy3D(kind) {
  const g = new THREE.Group();
  if (kind === 'lolly') {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 8), mat(0xffffff)); stick.position.y = -0.05; g.add(stick);
    const c = canvasTex(128, 128, (x) => { x.fillStyle = '#ff5a8a'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#fff'; x.lineWidth = 10; x.beginPath(); for (let a = 0; a < 16; a += 0.15) x.lineTo(64 + Math.cos(a) * a * 3.8, 64 + Math.sin(a) * a * 3.8); x.stroke(); });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.018, 24), [mat(0xff5a8a), mat(0xffffff, { map: c, roughness: 0.2 }), mat(0xffffff, { map: c, roughness: 0.2 })]);
    disc.rotation.x = Math.PI / 2; disc.position.y = 0.03; g.add(disc);
  } else if (kind === 'donut') {
    const d = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.02, 12, 24), mat(0xd9a35a)); g.add(d);
    const ic = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.021, 12, 24, Math.PI * 2), mat(0xff8fc0, { roughness: 0.3 })); ic.scale.z = 0.6; ic.position.z = 0.006; g.add(ic);
  } else {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.015), mat(0x5a3018, { roughness: 0.4 })); g.add(b);
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.052, 0.017), mat(0xd63b3b, { roughness: 0.3 })); w.position.x = 0.025; g.add(w);
  }
  return g;
}

// 汎用の小物（カバンの中身）
export function makeItem(kind) {
  const g = new THREE.Group();
  if (kind === 'shirt') { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.02), fabric(0x58b0e8)); g.add(b); for (const s of [-1, 1]) { const sl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.02), fabric(0x58b0e8)); sl.position.set(s * 0.06, 0.02, 0); sl.rotation.z = s * -0.5; g.add(sl); } }
  if (kind === 'brush') { const h = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.012, 0.012), mat(0x44c08a)); g.add(h); const br = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.02, 0.012), mat(0xffffff)); br.position.set(0.045, 0.014, 0); g.add(br); g.rotation.z = 0.3; }
  if (kind === 'ball') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), mat(0xffb020)); g.add(b); }
  if (kind === 'duck') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), mat(0xffd800, { roughness: 0.3 })); b.scale.x = 1.3; g.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), mat(0xffd800, { roughness: 0.3 })); h.position.set(0.025, 0.03, 0); g.add(h); const bk = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.02, 8), mat(0xff7a00)); bk.rotation.z = -Math.PI / 2; bk.position.set(0.048, 0.028, 0); g.add(bk); }
  if (kind === 'book') { const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.015), mat(0x8a5ad0)); g.add(b); }
  if (kind === 'sock') { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.06, 4, 8), fabric(0xff6f6f)); b.rotation.z = 1.2; g.add(b); }
  return g;
}
