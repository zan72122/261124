import * as THREE from './lib/three.module.min.js';

// ---------- 共通ユーティリティ ----------
export const TX = {}; // main.js が読み込んだ写真テクスチャを入れる
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = (c) => new THREE.Color(c);
const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function hash(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  let r = 0;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) {
    r += hash(ix + a, iy + b, iz + c) * (a ? u : 1 - u) * (b ? v : 1 - v) * (c ? w : 1 - w);
  }
  return r;
}

let _furTex = null;
export function furTex() {
  if (_furTex) return _furTex;
  _furTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * w, y = Math.random() * h, l = 4 + Math.random() * 9;
      const v = 200 + Math.random() * 55 | 0;
      g.strokeStyle = `rgba(${v},${v},${v},0.55)`; g.lineWidth = 1 + Math.random();
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 2, y + l); g.stroke();
    }
  });
  _furTex.wrapS = _furTex.wrapT = THREE.RepeatWrapping; _furTex.repeat.set(3, 3);
  return _furTex;
}

function mesh(geo, mat, parent, pos, rot, scl, part) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.copy(pos);
  if (rot) m.rotation.set(rot.x || 0, rot.y || 0, rot.z || 0);
  if (scl) m.scale.copy(scl);
  m.castShadow = true; m.receiveShadow = true;
  if (part) m.userData.part = part;
  if (parent) parent.add(m);
  return m;
}
const ell = (rx, ry, rz, seg = 32) => { const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.66)); g.scale(rx, ry, rz); return g; };
const cyl = (rt, rb, h, seg = 18) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 6); g.translate(0, -h / 2, 0); return g; };

// 頂点カラーで模様（縞・おなか）を塗る：本物用と木のおもちゃ用の2組を用意
function paintGroup(root, fnReal, fnWood) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const m = new THREE.Matrix4(), nm = new THREE.Matrix3(), p = new THREE.Vector3(), n = new THREE.Vector3();
  const col = new THREE.Color();
  root.traverse((o) => {
    if (!o.isMesh || !o.userData.paint) return;
    const g = o.geometry; const pos = g.attributes.position, nor = g.attributes.normal;
    m.multiplyMatrices(inv, o.matrixWorld); nm.getNormalMatrix(m);
    const real = new Float32Array(pos.count * 3), wood = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(m);
      n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      fnReal(p, n, o.userData.part, col); real[i * 3] = col.r; real[i * 3 + 1] = col.g; real[i * 3 + 2] = col.b;
      fnWood(p, n, o.userData.part, col); wood[i * 3] = col.r; wood[i * 3 + 1] = col.g; wood[i * 3 + 2] = col.b;
    }
    o.userData.cReal = real; o.userData.cWood = wood;
    g.setAttribute('color', new THREE.BufferAttribute(real.slice(), 3));
  });
}

function setMode(root, mode) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.paint) {
      o.geometry.attributes.color.array.set(mode === 'wood' ? o.userData.cWood : o.userData.cReal);
      o.geometry.attributes.color.needsUpdate = true;
    }
    if (o.userData.mats) o.material = o.userData.mats[mode];
  });
}

function dual(real, wood) { return { real, wood }; }
function woodMat(tint = '#ffffff', rough = 0.42) {
  return new THREE.MeshStandardMaterial({ map: TX.wood, color: C(tint), roughness: rough, metalness: 0 });
}
function attach(m, mats) { m.userData.mats = mats; m.material = mats.real; return m; }

// ---------- 目・口（表情） ----------
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.08, metalness: 0.1 });
const hiMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const mouthMat = new THREE.MeshStandardMaterial({ color: 0x3a1a14, roughness: 0.6 });
const tongueMat = new THREE.MeshStandardMaterial({ color: 0xd8676e, roughness: 0.5 });

function makeEyes(head, x, y, z, r, opt = {}) {
  const eyes = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * x, y, z); head.add(piv);
    if (opt.white) mesh(new THREE.SphereGeometry(r * 1.32, 20, 14), new THREE.MeshStandardMaterial({ color: 0xfbf7ef, roughness: 0.3 }), piv, V(0, 0, -r * 0.35));
    const e = mesh(new THREE.SphereGeometry(r, 20, 14), eyeMat, piv);
    mesh(new THREE.SphereGeometry(r * 0.3, 10, 8), hiMat, e, V(r * 0.35, r * 0.4, r * 0.78));
    if (opt.brow) {
      const b = mesh(new THREE.CapsuleGeometry(r * 0.22, r * 1.3, 4, 8), mouthMat, piv, V(0, r * 1.9, 0), { z: Math.PI / 2 });
      piv.userData.brow = b;
    }
    piv.rotation.y = s * (opt.splay || 0.25);
    eyes.push(piv);
  }
  return eyes;
}

// 口：にっこり（弧）と、あーん（楕円）
function makeMouth(parent, pos, w, opt = {}) {
  const g = new THREE.Group(); g.position.copy(pos); parent.add(g);
  const smile = mesh(new THREE.TorusGeometry(w, w * 0.16, 8, 20, Math.PI * 0.8), mouthMat, g, V(0, w * 0.6, 0), { z: Math.PI * 1.1 });
  const open = mesh(new THREE.SphereGeometry(w * 0.8, 16, 12), mouthMat, g, V(0, 0, 0), null, V(1, 0.8, 0.4));
  mesh(new THREE.SphereGeometry(w * 0.55, 12, 8), tongueMat, open, V(0, -0.45, 0.35), null, V(1, 0.6, 0.6));
  open.visible = false;
  if (opt.rot) g.rotation.x = opt.rot;
  return { g, smile, open };
}

// 表情の共通処理
function faceUpdate(a, dt, t) {
  const f = a.face;
  a.blinkT -= dt;
  if (a.blinkT < 0) { a.blinkT = 2 + Math.random() * 3; a.blink = 0.15; }
  a.blink = Math.max(0, a.blink - dt);
  let sy = a.blink > 0 ? 0.1 : 1, sx = 1, tilt = 0, l = 1, r = 1, open = 0;
  switch (f) {
    case 'happy': sy = 0.35; open = 1; break;
    case 'laugh': sy = 0.25; open = 1; break;
    case 'surprised': sx = 1.25; sy = 1.35; open = 0.7; break;
    case 'puzzled': tilt = 0.35; l = 1.2; r = 0.6; break;
    case 'sleep': sy = 0.08; break;
    case 'roar': sy = 0.6; open = 1; break;
    case 'eat': sy = 0.4; open = (Math.sin(t * 14) > 0) ? 1 : 0; break;
  }
  a.eyes.forEach((e, i) => {
    const k = i === 0 ? l : r;
    e.scale.x = lerp(e.scale.x, sx * k, 0.3); e.scale.y = lerp(e.scale.y, sy * k, 0.4);
    if (e.userData.brow) e.userData.brow.position.y = lerp(e.userData.brow.position.y, (f === 'surprised' ? 2.4 : f === 'puzzled' && i === 0 ? 2.5 : 1.9) * e.userData.brow.geometry.parameters.radius / 0.22, 0.2);
  });
  if (a.mouth) { a.mouth.smile.visible = open < 0.5; a.mouth.open.visible = open >= 0.5; }
  if (a.jaw) a.jaw.rotation.x = lerp(a.jaw.rotation.x, open * (f === 'roar' ? 0.5 : 0.25), 0.25);
  a.headTilt = lerp(a.headTilt || 0, tilt, 0.12);
}

// ---------- 四つ足の動物 ----------
const SPEC = {
  lion: { L: 1.55, R: 0.36, legH: 0.62, legR: 0.1, hr: 0.27, neck: 0.25, ear: 'round', base: '#c8964f', belly: '#ead1a2', dark: '#8a5a2a', tail: 0.85 },
  tiger: { L: 1.65, R: 0.34, legH: 0.55, legR: 0.1, hr: 0.25, neck: 0.22, ear: 'round', base: '#df8a2e', belly: '#f6ede0', dark: '#1d1410', tail: 0.9 },
  zebra: { L: 1.5, R: 0.34, legH: 0.78, legR: 0.07, hr: 0.2, neck: 0.55, ear: 'long', base: '#f4f1ea', belly: '#f4f1ea', dark: '#151515', tail: 0.6, long: true },
  trike: { L: 2.6, R: 0.62, legH: 0.7, legR: 0.19, hr: 0.48, neck: 0.25, ear: 'none', base: '#8d9a6b', belly: '#cbc69a', dark: '#5d6845', tail: 1.4 },
};

function stripeFn(kind, s) {
  const base = C(s.base), belly = C(s.belly), dark = C(s.dark);
  return (p, n, part, out) => {
    const nz = vnoise(p.x * 6, p.y * 6, p.z * 6);
    out.copy(base);
    const bellyK = smooth(-0.1, -0.7, n.y) * (part === 'body' || part === 'neck' || part === 'head' ? 1 : 0.6);
    if (part === 'muzzle') out.copy(belly);
    else out.lerp(belly, bellyK);
    if (kind === 'tiger') {
      if (part === 'head' && n.z > 0.2 && Math.abs(n.x) > 0.25 && n.y < 0.3) out.copy(belly);
      const sv = Math.sin(p.z * 26 + nz * 5 + Math.abs(p.x) * 3);
      if (part !== 'muzzle' && sv > 0.72 && n.y > -0.55) out.copy(dark);
      if (part === 'tail' && Math.sin(p.z * 40 + p.y * 30) > 0.4) out.copy(dark);
    } else if (kind === 'zebra') {
      const sv = Math.sin((part === 'leg' ? p.y * 34 : part === 'head' || part === 'face' || part === 'ear' ? p.y * 40 : p.z * 22 + p.y * (p.z < -0.3 ? 14 : 4)) + nz * 3);
      if (part !== 'muzzle' && sv > (part === 'face' || part === 'head' ? 0.6 : 0.25)) out.copy(dark);
      if (part === 'muzzle') out.set('#3a3634'); if (part === 'hoof') out.copy(dark);
      if (part === 'mane') out.copy(Math.sin(p.z * 60) > 0 ? dark : base);
    } else if (kind === 'lion') {
      if (part === 'tuft' || part === 'hoof') out.copy(dark);
    } else if (kind === 'trike') {
      if (nz > 0.62 && n.y > -0.2) out.copy(dark);
      if (part === 'beak' || part === 'horn') out.set('#e6dcc0');
    }
    if (part === 'nose') out.set(kind === 'lion' ? '#5a3a30' : '#222');
    const fur = 0.92 + vnoise(p.x * 40, p.y * 40, p.z * 40) * 0.12;
    out.multiplyScalar(fur);
  };
}
function woodFn(kind, s) {
  const real = stripeFn(kind, s);
  const tmp = new THREE.Color();
  return (p, n, part, out) => {
    real(p, n, part, tmp);
    out.set('#ffffff').lerp(tmp, 0.35); // 木に薄く色を塗ったおもちゃ
    if (tmp.getHSL({}).l < 0.15) out.set('#3c2a1c'); // 黒い模様はペンキ
  };
}

export function makeQuad(kind) {
  const s = SPEC[kind];
  const root = new THREE.Group(); root.name = kind;
  const a = { kind, root, s, face: 'idle', blinkT: 2, blink: 0, pose: { sit: 0, lie: 0, rear: 0, walk: 0 }, target: { sit: 0, lie: 0, rear: 0 }, phase: 0, look: 0, lookY: 0, tailYaw: 0, extraUpdate: null };
  const realM = new THREE.MeshStandardMaterial({ vertexColors: true, map: furTex(), roughness: kind === 'trike' ? 0.7 : 0.92 });
  const woodM = new THREE.MeshStandardMaterial({ vertexColors: true, map: TX.wood, roughness: 0.38 });
  const pm = (geo, parent, pos, rot, scl, part) => { const m = mesh(geo, realM, parent, pos, rot, scl, part); m.userData.paint = true; m.userData.mats = { real: realM, wood: woodM }; return m; };

  const bodyY = s.legH + s.R * 0.15;
  const hip = new THREE.Group(); hip.position.set(0, bodyY, -s.L * 0.32); root.add(hip); // 腰（ここを中心に座る・立つ）
  const torso = new THREE.Group(); torso.position.set(0, 0, s.L * 0.32); hip.add(torso);
  pm(ell(s.R * 0.95, s.R, s.L / 2, 40), torso, V(0, 0, 0), null, null, 'body');
  if (kind === 'lion' || kind === 'tiger') pm(ell(s.R * 0.85, s.R * 0.92, s.L * 0.3, 28), torso, V(0, s.R * 0.08, s.L * 0.22), null, null, 'body'); // 肩
  // 首と頭
  const neck = new THREE.Group(); neck.position.set(0, s.R * 0.35, s.L * 0.4); torso.add(neck);
  neck.rotation.x = s.long ? -0.75 : -0.35;
  pm(cyl(s.R * (s.long ? 0.38 : 0.55), s.R * (s.long ? 0.55 : 0.7), s.neck + s.R * 0.4, 20), neck, V(0, s.neck + s.R * 0.2, 0), { x: 0 }, null, 'neck');
  neck.children[0].geometry.rotateX(Math.PI); // 上向きに伸ばす
  const head = new THREE.Group(); head.position.set(0, s.neck + s.R * 0.25, 0); neck.add(head);
  const headInner = new THREE.Group(); head.add(headInner); headInner.rotation.x = -neck.rotation.x; // 頭は前を向く
  a.head = headInner; a.neck = neck;
  const hr = s.hr;
  if (kind === 'zebra') {
    pm(ell(hr * 0.85, hr, hr * 1.15), headInner, V(0, 0, 0), null, null, 'head');
    pm(ell(hr * 0.62, hr * 0.62, hr * 1.1), headInner, V(0, -hr * 0.35, hr * 1.25), { x: 0.35 }, null, 'face');
    pm(ell(hr * 0.6, hr * 0.55, hr * 0.5), headInner, V(0, -hr * 0.62, hr * 2.05), null, null, 'muzzle');
    for (const sx of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(sx * hr * 0.45, hr * 0.75, -hr * 0.1); headInner.add(ear); ear.rotation.z = -sx * 0.35;
      pm(new THREE.ConeGeometry(hr * 0.22, hr * 1.0, 12).translate(0, hr * 0.5, 0), ear, V(0, 0, 0), null, V(1, 1, 0.6), 'ear');
    }
    // たてがみ
    pm(new THREE.BoxGeometry(hr * 0.22, s.neck * 0.9, hr * 0.5), neck, V(0, s.neck * 0.7, -s.R * 0.4), { x: 0.1 }, null, 'mane');
    a.eyes = makeEyes(headInner, hr * 0.7, hr * 0.15, hr * 0.55, hr * 0.17, { splay: 0.9 });
    a.mouth = makeMouth(headInner, V(0, -hr * 0.85, hr * 2.15), hr * 0.18);
  } else {
    const hx = kind === 'trike' ? 1.15 : 1;
    pm(ell(hr * 1.05 * hx, hr, hr * (kind === 'trike' ? 1.3 : 1.0)), headInner, V(0, 0, 0), null, null, 'head');
    const mz = kind === 'trike' ? hr * 1.25 : hr * 0.72;
    pm(ell(hr * 0.62, hr * 0.5, hr * 0.55), headInner, V(0, -hr * 0.22, mz), null, null, 'muzzle');
    if (kind !== 'trike') {
      pm(ell(hr * 0.2, hr * 0.13, hr * 0.12), headInner, V(0, -hr * 0.0, mz + hr * 0.5), null, null, 'nose');
      a.eyes = makeEyes(headInner, hr * 0.38, hr * 0.22, hr * 0.78, hr * 0.13);
      a.mouth = makeMouth(headInner, V(0, -hr * 0.52, mz + hr * 0.38), hr * 0.16, { rot: -0.3 });
    } else {
      a.eyes = makeEyes(headInner, hr * 0.62, hr * 0.28, hr * 0.85, hr * 0.12, { splay: 0.5 });
      a.mouth = makeMouth(headInner, V(0, -hr * 0.55, mz + hr * 0.3), hr * 0.2, { rot: -0.3 });
    }
    if (s.ear === 'round') for (const sx of [-1, 1]) {
      pm(ell(hr * 0.3, hr * 0.3, hr * 0.12), headInner, V(sx * hr * 0.68, hr * 0.72, -hr * 0.15), { z: -sx * 0.4 }, null, 'ear');
    }
    if (kind === 'lion') {
      // たてがみ（写真の毛並み）
      const mr = new THREE.MeshStandardMaterial({ map: TX.fur, color: C('#c07a35'), roughness: 1 });
      const mw = woodMat('#8a5a32');
      const mane = new THREE.Group(); headInner.add(mane); mane.position.set(0, 0.0, -hr * 0.25);
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2;
        const m = mesh(ell(hr * 0.5, hr * 0.5, hr * 0.42, 16), mr, mane, V(Math.cos(ang) * hr * 0.92, Math.sin(ang) * hr * 0.92, 0), null, null, 'mane');
        attach(m, dual(mr, mw));
      }
      const back = mesh(ell(hr * 1.35, hr * 1.35, hr * 0.55, 24), mr, mane, V(0, 0, -hr * 0.3));
      attach(back, dual(mr, mw));
      a.mane = mane;
    }
    if (kind === 'trike') {
      const hornR = new THREE.MeshStandardMaterial({ color: C('#efe3c4'), roughness: 0.5 });
      const hornW = woodMat('#f2e5cc');
      const frillR = new THREE.MeshStandardMaterial({ color: C('#b8744c'), roughness: 0.7, map: furTex() });
      const frillW = woodMat('#c98e62');
      const frill = mesh(new THREE.CircleGeometry(hr * 1.55, 28), frillR, headInner, V(0, hr * 0.7, -hr * 0.55), { x: -0.55 });
      frill.material.side = THREE.DoubleSide; attach(frill, dual(frillR, frillW)); frillW.side = THREE.DoubleSide;
      for (let i = 0; i < 9; i++) { // フリルのふち
        const ang = Math.PI * (0.05 + 0.9 * i / 8);
        const k = mesh(new THREE.SphereGeometry(hr * 0.17, 10, 8), frillR, frill, V(Math.cos(ang) * hr * 1.5, Math.sin(ang) * hr * 1.5, 0));
        attach(k, dual(new THREE.MeshStandardMaterial({ color: C('#d9a066'), roughness: 0.7 }), woodMat('#e7b98a')));
      }
      for (const sx of [-1, 1]) {
        const h = mesh(new THREE.ConeGeometry(hr * 0.14, hr * 1.3, 12).translate(0, hr * 0.65, 0), hornR, headInner, V(sx * hr * 0.45, hr * 0.6, hr * 0.35), { x: 1.05, z: -sx * 0.12 });
        attach(h, dual(hornR, hornW));
      }
      const nh = mesh(new THREE.ConeGeometry(hr * 0.12, hr * 0.5, 12).translate(0, hr * 0.25, 0), hornR, headInner, V(0, hr * 0.1, mz + hr * 0.3), { x: 0.7 });
      attach(nh, dual(hornR, hornW));
      const beak = mesh(new THREE.ConeGeometry(hr * 0.25, hr * 0.5, 12).translate(0, hr * 0.25, 0), hornR, headInner, V(0, -hr * 0.3, mz + hr * 0.42), { x: 1.9 });
      attach(beak, dual(hornR, hornW));
    }
  }
  // 足
  a.legs = [];
  const legLen = bodyY - s.R * 0.1;
  for (const [lx, lz, front] of [[-1, 1, true], [1, 1, true], [-1, -1, false], [1, -1, false]]) {
    const piv = new THREE.Group();
    const zz = front ? s.L * 0.3 : -s.L * 0.3;
    piv.position.set(lx * s.R * 0.55, -s.R * 0.1, zz);
    (front ? torso : torso).add(piv);
    pm(cyl(s.legR * 1.35, s.legR, legLen * 0.55, 16), piv, V(0, 0, 0), null, null, 'leg');
    pm(cyl(s.legR, s.legR * 0.85, legLen * 0.47, 16), piv, V(0, -legLen * 0.53, 0), null, null, 'leg');
    pm(ell(s.legR * 1.15, s.legR * 0.7, s.legR * 1.35, 14), piv, V(0, -legLen + s.legR * 0.5, s.legR * 0.35), null, null, kind === 'zebra' ? 'hoof' : 'paw');
    piv.userData.front = front; piv.userData.side = lx;
    a.legs.push(piv);
  }
  a.legLen = legLen;
  // しっぽ
  const tail = new THREE.Group(); tail.position.set(0, s.R * 0.4, -s.L * 0.48); torso.add(tail);
  a.tail = [];
  let par = tail; const segN = 7, segL = s.tail / segN;
  for (let i = 0; i < segN; i++) {
    const g = new THREE.Group(); g.position.set(0, 0, i === 0 ? 0 : -segL); par.add(g);
    const r0 = (kind === 'trike' ? s.R * 0.55 : s.legR * 0.4) * (1 - i / segN * 0.75);
    const seg = pm(new THREE.CylinderGeometry(r0 * 0.85, r0, segL * 1.15, 10).rotateX(Math.PI / 2).translate(0, 0, -segL / 2), g, V(0, 0, 0), null, null, 'tail');
    a.tail.push(g); par = g;
  }
  if (kind === 'lion' || kind === 'zebra') pm(ell(s.legR * 0.7, s.legR * 0.7, s.legR * 1.6), par, V(0, 0, -segL * 1.2), null, null, 'tuft');
  a.tailRoot = tail; tail.rotation.x = kind === 'trike' ? 0.25 : 0.9;

  a.torso = torso; a.hip = hip; a.bodyY = bodyY;
  paintGroup(root, stripeFn(kind, s), woodFn(kind, s));
  a.setMode = (m) => { a.mode = m; setMode(root, m); };
  a.update = (dt, t) => quadUpdate(a, dt, t);
  return a;
}

function quadUpdate(a, dt, t) {
  const s = a.s, P = a.pose, T = a.target;
  const k = 1 - Math.pow(0.02, dt);
  P.sit = lerp(P.sit, T.sit, k); P.lie = lerp(P.lie, T.lie, k); P.rear = lerp(P.rear, T.rear, k);
  P.walk = lerp(P.walk, a.walking ? 1 : 0, k * 1.5);
  if (a.mode === 'wood' && !a.alive) { faceUpdate(a, dt, t); return; }
  a.phase += dt * (a.walkSpeed || 7) * P.walk;
  const ph = a.phase;
  const breathe = Math.sin(t * 2.2 + a.s.L) * 0.012;
  // 腰の高さ・体の傾き
  const sitAng = -0.62 * P.sit, rearAng = -0.75 * P.rear;
  a.hip.rotation.x = sitAng + rearAng;
  const lieDrop = (a.bodyY - s.R * 0.75) * P.lie;
  const sitDrop = (a.bodyY - s.R * 0.9) * P.sit * 0.62;
  a.hip.position.y = a.bodyY - lieDrop - sitDrop + Math.abs(Math.sin(ph)) * 0.04 * P.walk + (a.hop || 0);
  a.torso.scale.y = 1 + breathe;
  // 足
  a.legs.forEach((l, i) => {
    const swing = Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.45 * P.walk;
    let rx = swing;
    if (l.userData.front) {
      rx += -(sitAng + rearAng) * (1 - P.lie) - 1.45 * P.lie;
      if (a.pedal) rx += Math.sin(t * 12 + i) * 0.5 * P.rear;
    } else {
      rx += -sitAng * 0.1 - 1.4 * P.sit + 1.3 * P.lie * 0.0 - 1.35 * P.lie - rearAng;
      l.rotation.z = l.userData.side * 0.25 * P.lie;
    }
    l.rotation.x = rx;
  });
  // しっぽ
  const wag = a.wag || 1;
  a.tailRoot.rotation.y = a.tailYaw;
  a.tail.forEach((g, i) => {
    g.rotation.y = Math.sin(t * 2.4 * wag - i * 0.6) * 0.18 * wag;
    g.rotation.x = (a.kind === 'trike' ? 0.02 : -0.12) + (a.kind !== 'trike' ? 0.1 * P.lie : 0);
  });
  // 頭（見る方向・首をかしげる）
  faceUpdate(a, dt, t);
  a.head.rotation.z = a.headTilt + (a.headBob || 0) * Math.sin(t * 8);
  a.head.rotation.y = lerp(a.head.rotation.y, a.look, 0.08);
  a.neck.rotation.x = lerp(a.neck.rotation.x, (a.s.long ? -0.75 : -0.35) + a.lookY - 0.45 * (a.hip.rotation.x) * 0.5 + (a.face === 'roar' ? -0.25 : 0), 0.1);
  a.head.rotation.x = -a.neck.rotation.x + (a.face === 'roar' ? -0.2 : 0) + (a.face === 'eat' ? 0.25 : 0);
  if (a.mane) a.mane.scale.setScalar(1 + (a.face === 'roar' ? 0.06 * Math.sin(t * 30) : 0));
  if (a.extraUpdate) a.extraUpdate(dt, t);
}

// ---------- ティラノサウルス（二本足・おどけた顔） ----------
export function makeRex() {
  const root = new THREE.Group(); root.name = 'rex';
  const a = { kind: 'rex', root, face: 'idle', blinkT: 2, blink: 0, phase: 0, look: 0, lookY: 0, pose: { walk: 0 }, target: {} };
  const realM = new THREE.MeshStandardMaterial({ vertexColors: true, map: furTex(), roughness: 0.72 });
  const woodM = new THREE.MeshStandardMaterial({ vertexColors: true, map: TX.wood, roughness: 0.38 });
  const pm = (geo, parent, pos, rot, scl, part) => { const m = mesh(geo, realM, parent, pos, rot, scl, part); m.userData.paint = true; m.userData.mats = { real: realM, wood: woodM }; return m; };
  const hipY = 1.55;
  const hip = new THREE.Group(); hip.position.y = hipY; root.add(hip);
  const torso = new THREE.Group(); hip.add(torso); torso.rotation.x = -0.35;
  pm(ell(0.62, 0.72, 1.15, 40), torso, V(0, 0.2, 0.25), null, null, 'body');
  pm(ell(0.52, 0.58, 0.7, 32), torso, V(0, 0.55, 0.95), { x: -0.5 }, null, 'body');
  const neck = new THREE.Group(); neck.position.set(0, 0.85, 1.25); torso.add(neck);
  const head = new THREE.Group(); head.position.set(0, 0.35, 0.15); neck.add(head); head.rotation.x = 0.35;
  pm(ell(0.48, 0.5, 0.62), head, V(0, 0, 0.1), null, null, 'head');
  pm(ell(0.4, 0.3, 0.55), head, V(0, -0.08, 0.55), null, null, 'snout');
  const jaw = new THREE.Group(); jaw.position.set(0, -0.22, 0.2); head.add(jaw);
  pm(ell(0.36, 0.14, 0.62), jaw, V(0, -0.04, 0.35), null, null, 'jaw');
  pm(ell(0.3, 0.06, 0.5), jaw, V(0, 0.08, 0.35), null, null, 'tongue');
  a.jaw = jaw;
  a.eyes = makeEyes(head, 0.33, 0.2, 0.32, 0.085, { white: true, brow: true, splay: 0.45 });
  a.mouth = null; a.head = head; a.neck = neck;
  for (const sx of [-1, 1]) pm(ell(0.05, 0.035, 0.05), head, V(sx * 0.15, 0.05, 1.03), null, null, 'nostril');
  // 小さな腕
  a.arms = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(sx * 0.42, 0.25, 1.05); torso.add(arm);
    pm(cyl(0.08, 0.06, 0.38, 12), arm, V(0, 0, 0), null, null, 'arm');
    pm(ell(0.07, 0.05, 0.09), arm, V(0, -0.4, 0.04), null, null, 'arm');
    arm.rotation.x = -0.9; a.arms.push(arm);
  }
  // 脚
  a.legs = [];
  for (const sx of [-1, 1]) {
    const l = new THREE.Group(); l.position.set(sx * 0.5, 0, 0.1); hip.add(l);
    pm(ell(0.34, 0.62, 0.42), l, V(0, -0.3, 0.05), null, null, 'thigh');
    pm(cyl(0.16, 0.13, 1.05), l, V(0, -0.65, -0.05), { x: 0.28 }, null, 'shin');
    pm(ell(0.2, 0.1, 0.36), l, V(0, -1.48, 0.1), null, null, 'foot');
    a.legs.push(l);
  }
  // しっぽ
  a.tail = [];
  let par = new THREE.Group(); par.position.set(0, 0.15, -0.8); torso.add(par); par.rotation.x = 0.35;
  const N = 8;
  for (let i = 0; i < N; i++) {
    const g = new THREE.Group(); g.position.z = i === 0 ? 0 : -0.36; par.add(g);
    const r0 = 0.5 * (1 - i / N) + 0.04;
    pm(new THREE.CylinderGeometry(r0 * 0.82, r0, 0.42, 16).rotateX(Math.PI / 2).translate(0, 0, -0.18), g, null, null, null, 'tail');
    a.tail.push(g); par = g;
  }
  const base = C('#6f8a4e'), belly = C('#e2cf9a'), dark = C('#4a5e35');
  paintGroup(root, (p, n, part, out) => {
    out.copy(base);
    if (part === 'tongue') { out.set('#d0606a'); return; }
    if (part === 'nostril') { out.set('#2a2a22'); return; }
    out.lerp(belly, smooth(-0.05, -0.6, n.y));
    if (part === 'jaw') out.copy(belly);
    if (n.y > 0.2 && Math.sin(p.z * 9 + vnoise(p.x * 3, p.y * 3, p.z * 3) * 4) > 0.55) out.copy(dark);
    out.multiplyScalar(0.92 + vnoise(p.x * 30, p.y * 30, p.z * 30) * 0.12);
  }, (p, n, part, out) => { out.set('#ffffff').lerp(base, 0.32); if (part === 'jaw' || n.y < -0.4) out.set('#fff8e8'); });
  a.torso = torso; a.hip = hip; a.hipY = hipY;
  a.setMode = (m) => { a.mode = m; setMode(root, m); };
  a.update = (dt, t) => {
    const k = 1 - Math.pow(0.02, dt);
    a.pose.walk = lerp(a.pose.walk, a.walking ? 1 : 0, k * 1.5);
    faceUpdate(a, dt, t);
    if (a.mode === 'wood' && !a.alive) return;
    a.phase += dt * 4.5 * a.pose.walk;
    const ph = a.phase, w = a.pose.walk;
    a.legs[0].rotation.x = Math.sin(ph) * 0.45 * w; a.legs[1].rotation.x = -Math.sin(ph) * 0.45 * w;
    hip.position.y = hipY + Math.abs(Math.cos(ph)) * 0.08 * w + (a.hop || 0) + Math.sin(t * 2) * 0.015;
    hip.rotation.z = Math.sin(ph) * 0.06 * w + (a.sway ? Math.sin(t * 6) * 0.08 : 0);
    const clap = a.clap ? Math.sin(t * 18) * 0.35 : 0;
    a.arms[0].rotation.z = 0.2 + clap; a.arms[1].rotation.z = -0.2 - clap;
    a.arms[0].rotation.x = a.arms[1].rotation.x = -0.9 + (a.clap ? -0.5 : Math.sin(t * 3) * 0.1);
    a.tail.forEach((g, i) => { g.rotation.y = Math.sin(t * 1.8 - i * 0.5) * 0.08 + Math.sin(ph) * 0.06 * w; g.rotation.x = -0.04; });
    head.rotation.z = a.headTilt;
    head.rotation.y = lerp(head.rotation.y, a.look, 0.08);
    head.rotation.x = lerp(head.rotation.x, 0.35 + a.lookY + (a.face === 'eat' ? 0.25 : 0), 0.1);
    if (a.extraUpdate) a.extraUpdate(dt, t);
  };
  return a;
}

// ---------- 翼竜 ----------
export function makePtera() {
  const root = new THREE.Group(); root.name = 'ptera';
  const a = { kind: 'ptera', root, face: 'idle', blinkT: 2, blink: 0, flap: 0, look: 0, lookY: 0, fold: 1 };
  const realM = new THREE.MeshStandardMaterial({ vertexColors: true, map: furTex(), roughness: 0.75 });
  const woodM = new THREE.MeshStandardMaterial({ vertexColors: true, map: TX.wood, roughness: 0.38 });
  const pm = (geo, parent, pos, rot, scl, part) => { const m = mesh(geo, realM, parent, pos, rot, scl, part); m.userData.paint = true; m.userData.mats = { real: realM, wood: woodM }; return m; };
  const body = new THREE.Group(); body.position.y = 0.75; root.add(body);
  pm(ell(0.22, 0.24, 0.48, 28), body, V(0, 0, 0), null, null, 'body');
  const head = new THREE.Group(); head.position.set(0, 0.28, 0.45); body.add(head);
  pm(ell(0.17, 0.17, 0.2), head, V(0, 0, 0), null, null, 'head');
  pm(new THREE.ConeGeometry(0.1, 0.75, 16).rotateX(Math.PI / 2).translate(0, 0, 0.5), head, V(0, -0.04, 0), null, V(1, 0.6, 1), 'beak');
  pm(new THREE.ConeGeometry(0.08, 0.55, 12).rotateX(-Math.PI / 2).translate(0, 0, -0.3), head, V(0, 0.08, -0.05), { x: -0.35 }, V(0.4, 1.4, 1), 'crest');
  a.eyes = makeEyes(head, 0.12, 0.05, 0.1, 0.045, { white: true, splay: 0.9 });
  a.head = head;
  // 翼（膜）
  a.wings = [];
  for (const sx of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(sx * 0.15, 0.08, 0.15); body.add(w);
    const sh = new THREE.Shape();
    sh.moveTo(0, 0.12); sh.quadraticCurveTo(0.9, 0.18, 1.55, 0.02); sh.quadraticCurveTo(0.9, -0.08, 0.6, -0.35); sh.quadraticCurveTo(0.25, -0.45, 0, -0.3); sh.lineTo(0, 0.12);
    const geo = new THREE.ShapeGeometry(sh, 16); geo.rotateX(-Math.PI / 2); if (sx < 0) geo.scale(-1, 1, 1);
    const wm = pm(geo, w, null, null, null, 'wing');
    wm.material = realM;
    const bone = pm(new THREE.CylinderGeometry(0.03, 0.025, 1.5, 8).rotateZ(Math.PI / 2).translate(sx * 0.75, 0, 0), w, V(0, 0.01, -0.12), null, null, 'bone');
    a.wings.push(w);
  }
  for (const sx of [-1, 1]) pm(cyl(0.035, 0.03, 0.42, 8), body, V(sx * 0.1, -0.15, -0.2), { x: 0.3 }, null, 'leg');
  const base = C('#b4643e'), belly = C('#f0d9b0'), dark = C('#6e3a25');
  paintGroup(root, (p, n, part, out) => {
    out.copy(base);
    if (part === 'beak') out.set('#e3c48c');
    else if (part === 'crest') out.set('#d0482f');
    else if (part === 'wing') out.set('#c98a5c').lerp(dark, smooth(0.4, 1.5, Math.abs(p.x)));
    else out.lerp(belly, smooth(-0.1, -0.6, n.y));
    out.multiplyScalar(0.93 + vnoise(p.x * 30, p.y * 30, p.z * 30) * 0.1);
  }, (p, n, part, out) => { out.set('#ffffff').lerp(part === 'crest' ? C('#d0482f') : base, 0.3); });
  root.traverse((o) => { if (o.isMesh && o.userData.part === 'wing') { o.userData.mats = { real: realM.clone(), wood: woodM.clone() }; o.userData.mats.real.side = o.userData.mats.wood.side = THREE.DoubleSide; o.material = o.userData.mats.real; } });
  a.body = body;
  a.setMode = (m) => { a.mode = m; setMode(root, m); };
  a.update = (dt, t) => {
    faceUpdate(a, dt, t);
    if (a.mode === 'wood' && !a.alive) { a.wings[0].rotation.z = a.wings[1].rotation.z = 0; return; }
    const fold = a.fold; // 1=とまる 0=飛ぶ
    const fl = a.flying ? Math.sin(t * 7) * 0.65 : 0;
    a.wings[0].rotation.z = -fl * (1 - fold) - 1.2 * fold; a.wings[1].rotation.z = fl * (1 - fold) + 1.2 * fold;
    a.wings[0].rotation.y = 0.7 * fold; a.wings[1].rotation.y = -0.7 * fold;
    a.wings.forEach((w) => w.scale.setScalar(1 - 0.45 * fold));
    body.position.y = 0.75 + (a.flying ? -Math.sin(t * 7) * 0.08 : Math.sin(t * 2) * 0.01);
    head.rotation.z = a.headTilt;
    head.rotation.y = lerp(head.rotation.y, a.look, 0.1);
    head.rotation.x = lerp(head.rotation.x, a.lookY, 0.1);
  };
  return a;
}

// ---------- 人（女の子・パパ） ----------
function faceCanvas(kind) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const draw = (expr, look = 0) => {
    const g = c.getContext('2d'); g.clearRect(0, 0, 256, 256);
    const ex = 128, ey = kind === 'dad' ? 118 : 122, sep = kind === 'dad' ? 44 : 50;
    const lx = look * 6;
    g.lineCap = 'round'; g.strokeStyle = '#2b1a14'; g.fillStyle = '#2b1a14';
    // ほっぺ
    g.fillStyle = 'rgba(255,120,120,0.35)';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(ex + s * 70, ey + 40, 20, 12, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#2b1a14';
    const eye = (x, y, r, closed, arc) => {
      if (closed) { g.lineWidth = 7; g.beginPath(); if (arc === 'up') g.arc(x, y + 6, r, Math.PI * 1.15, Math.PI * 1.85); else g.arc(x, y - 6, r, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); return; }
      g.fillStyle = '#2b1a14'; g.beginPath(); g.ellipse(x + lx, y, r * 0.82, r, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x + lx + r * 0.3, y - r * 0.35, r * 0.32, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x + lx - r * 0.25, y + r * 0.35, r * 0.14, 0, Math.PI * 2); g.fill();
    };
    const r = kind === 'dad' ? 13 : 19;
    const brow = (dy, tiltL, tiltR) => {
      g.lineWidth = 6; g.strokeStyle = '#4a2c1c';
      for (const s of [-1, 1]) { const t = s < 0 ? tiltL : tiltR; g.beginPath(); g.moveTo(ex + s * sep - 16, ey - 34 + dy - t * s * 6); g.lineTo(ex + s * sep + 16, ey - 34 + dy + t * s * 6); g.stroke(); }
      g.strokeStyle = '#2b1a14';
    };
    const mouth = (type) => {
      const my = ey + 58; g.lineWidth = 6;
      if (type === 'smile') { g.beginPath(); g.arc(ex, my - 12, 20, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
      if (type === 'open') { g.fillStyle = '#7a2a2a'; g.beginPath(); g.arc(ex, my - 6, 22, 0, Math.PI); g.closePath(); g.fill(); g.fillStyle = '#e0707a'; g.beginPath(); g.ellipse(ex, my + 8, 11, 6, 0, 0, Math.PI * 2); g.fill(); }
      if (type === 'o') { g.fillStyle = '#7a2a2a'; g.beginPath(); g.ellipse(ex, my, 11, 14, 0, 0, Math.PI * 2); g.fill(); }
      if (type === 'wavy') { g.beginPath(); g.moveTo(ex - 20, my); g.quadraticCurveTo(ex - 10, my - 8, ex, my); g.quadraticCurveTo(ex + 10, my + 8, ex + 20, my); g.stroke(); }
      if (type === 'flat') { g.beginPath(); g.moveTo(ex - 14, my); g.lineTo(ex + 14, my); g.stroke(); }
      if (type === 'grin') { g.fillStyle = '#fff'; g.strokeStyle = '#2b1a14'; g.beginPath(); g.moveTo(ex - 24, my - 8); g.quadraticCurveTo(ex, my + 22, ex + 24, my - 8); g.closePath(); g.fill(); g.stroke(); }
    };
    switch (expr) {
      case 'happy': eye(ex - sep, ey, r, true, 'up'); eye(ex + sep, ey, r, true, 'up'); brow(-4, 0, 0); mouth('open'); break;
      case 'surprised': eye(ex - sep, ey, r * 1.2); eye(ex + sep, ey, r * 1.2); brow(-12, 0, 0); mouth('o'); break;
      case 'puzzled': eye(ex - sep, ey, r); eye(ex + sep, ey, r * 0.8); brow(-2, -1, 1); mouth('wavy'); break;
      case 'closed': eye(ex - sep, ey, r, true, 'down'); eye(ex + sep, ey, r, true, 'down'); brow(0, 0, 0); mouth('smile'); break;
      case 'dizzy': g.lineWidth = 5; for (const s of [-1, 1]) { g.beginPath(); for (let i = 0; i < 30; i++) { const a = i * 0.5, rr = i * 0.6; g.lineTo(ex + s * sep + Math.cos(a) * rr, ey + Math.sin(a) * rr); } g.stroke(); } mouth('wavy'); break;
      case 'determined': eye(ex - sep, ey, r); eye(ex + sep, ey, r); brow(-2, 1, -1); mouth('grin'); break;
      case 'sheepish': eye(ex - sep, ey, r, true, 'up'); eye(ex + sep, ey, r, true, 'up'); brow(-6, -1, 1); mouth('grin'); break;
      default: eye(ex - sep, ey, r); eye(ex + sep, ey, r); brow(0, 0, 0); mouth('smile');
    }
    tex.needsUpdate = true;
  };
  draw('idle');
  return { tex, draw };
}

const HATS = {
  explorer(scale = 1) { // サファリ帽
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: 0xd9c08a, roughness: 0.85, map: furTex() });
    const pts = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * 0.17, Math.sin(a) * 0.15)); }
    mesh(new THREE.LatheGeometry(pts, 32), m, g);
    const brim = mesh(new THREE.CylinderGeometry(0.29, 0.3, 0.015, 40), m, g, V(0, 0.01, 0));
    mesh(new THREE.CylinderGeometry(0.172, 0.172, 0.04, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.7, side: THREE.DoubleSide }), g, V(0, 0.04, 0));
    mesh(new THREE.SphereGeometry(0.025, 10, 8), m, g, V(0, 0.155, 0));
    g.scale.setScalar(scale); return g;
  },
  keeper(scale = 1) { // 飼育員さんのキャップ
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: 0x3f7a4a, roughness: 0.8, map: furTex() });
    mesh(new THREE.SphereGeometry(0.17, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), m, g);
    const v = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.012, 28, 1, false, -Math.PI / 2, Math.PI), m, g, V(0, 0.005, 0.1));
    v.scale.set(1, 1, 0.9);
    mesh(new THREE.SphereGeometry(0.06, 16, 10), new THREE.MeshStandardMaterial({ color: 0xf3c64a, roughness: 0.6 }), g, V(0, 0.1, 0.13), null, V(1, 1, 0.3));
    g.scale.setScalar(scale); return g;
  },
  bucket(scale = 1) { // 赤いバケットハット
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: 0xd8453c, roughness: 0.9, map: furTex() });
    const pts = [V(0.27, 0, 0), V(0.2, 0.03, 0), V(0.17, 0.05, 0), V(0.155, 0.13, 0), V(0.12, 0.155, 0), V(0, 0.16, 0)].map((v) => new THREE.Vector2(v.x, v.y));
    const geo = new THREE.LatheGeometry(pts, 32); const mm = mesh(geo, m, g); m.side = THREE.DoubleSide;
    mesh(new THREE.TorusGeometry(0.162, 0.012, 8, 32), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), g, V(0, 0.07, 0), { x: Math.PI / 2 });
    g.scale.setScalar(scale); return g;
  },
};
export function makeHat(type, scale) { return HATS[type](scale); }

export function makeHuman(kind) {
  const isDad = kind === 'dad';
  const root = new THREE.Group(); root.name = kind;
  const H = isDad ? 1.78 : 1.12;
  const a = { kind, root, H, face: 'idle', expr: 'idle', look: 0, lookY: 0, arm: [0, 0], armT: [{ x: 0, z: 0 }, { x: 0, z: 0 }], walking: false, phase: 0 };
  const skin = new THREE.MeshStandardMaterial({ color: isDad ? 0xe9b892 : 0xf4c9a8, roughness: 0.62 });
  const hair = new THREE.MeshStandardMaterial({ color: isDad ? 0x2e221b : 0x3b2618, roughness: 0.55, map: furTex() });
  const shirt = new THREE.MeshStandardMaterial({ color: isDad ? 0x4a78b5 : 0xf3e6c4, roughness: 0.85, map: furTex() });
  const pants = new THREE.MeshStandardMaterial({ color: isDad ? 0x5d5245 : 0x9b6a3c, roughness: 0.85, map: furTex() });
  const shoe = new THREE.MeshStandardMaterial({ color: isDad ? 0x3a3a3a : 0xc84a3c, roughness: 0.6 });
  const legH = H * (isDad ? 0.47 : 0.42);
  const hips = new THREE.Group(); hips.position.y = legH; root.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  const tw = H * (isDad ? 0.13 : 0.15), th = H * (isDad ? 0.32 : 0.3);
  mesh(new THREE.CapsuleGeometry(tw, th - tw, 8, 24), shirt, torso, V(0, th * 0.5, 0), null, V(1, 1, 0.72));
  if (!isDad) { // サファリベスト
    const vest = new THREE.MeshStandardMaterial({ color: 0x8c7a4c, roughness: 0.9, map: furTex() });
    mesh(new THREE.CapsuleGeometry(tw * 1.05, th * 0.62, 8, 24), vest, torso, V(0, th * 0.52, -0.005), null, V(1.02, 1, 0.74));
    for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.06, 0.05, 0.02), vest, torso, V(s * 0.07, th * 0.45, tw * 0.75));
    // スカート
    mesh(new THREE.CylinderGeometry(tw * 1.05, tw * 1.5, 0.16, 24), pants, hips, V(0, -0.04, 0));
  }
  const headR = H * (isDad ? 0.075 : 0.105);
  const neck = new THREE.Group(); neck.position.y = th + 0.02; torso.add(neck);
  mesh(new THREE.CylinderGeometry(headR * 0.35, headR * 0.4, headR * 0.6, 12), skin, neck, V(0, headR * 0.2, 0));
  const head = new THREE.Group(); head.position.y = headR * 1.2; neck.add(head);
  mesh(new THREE.SphereGeometry(headR, 32, 24), skin, head, null, null, V(1, isDad ? 1.12 : 1, 1));
  // 顔（表情を描く）
  const fc = faceCanvas(kind);
  const faceM = new THREE.MeshStandardMaterial({ map: fc.tex, transparent: true, roughness: 0.6, depthWrite: false });
  const fg = new THREE.SphereGeometry(headR * 1.005, 32, 20, Math.PI / 2 - 1.0, 2.0, 0.55, 1.6);
  const face = mesh(fg, faceM, head, null, null, V(1, isDad ? 1.12 : 1, 1)); face.castShadow = false;
  mesh(new THREE.SphereGeometry(headR * 0.12, 10, 8), skin, head, V(0, -headR * 0.05, headR * 0.98));
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(headR * 0.18, 10, 8), skin, head, V(s * headR * 0.98, 0, 0), null, V(0.5, 1, 1));
  // 髪
  if (isDad) {
    mesh(new THREE.SphereGeometry(headR * 1.06, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), hair, head, V(0, headR * 0.12, -headR * 0.05), { x: -0.25 }, V(1, 1.1, 1));
  } else {
    mesh(new THREE.SphereGeometry(headR * 1.08, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.4), hair, head, V(0, headR * 0.04, -headR * 0.06), { x: -0.55 });
    mesh(new THREE.SphereGeometry(headR * 1.04, 24, 16), hair, head, V(0, -headR * 0.05, -headR * 0.22), null, V(1, 1, 0.85));
    for (const s of [-1, 1]) { // おさげ
      const p = new THREE.Group(); p.position.set(s * headR * 0.85, -headR * 0.15, -headR * 0.3); head.add(p);
      mesh(new THREE.SphereGeometry(headR * 0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8566b, roughness: 0.6 }), p);
      mesh(new THREE.CapsuleGeometry(headR * 0.2, headR * 0.6, 6, 12), hair, p, V(s * headR * 0.08, -headR * 0.45, 0), { z: s * 0.2 });
      a['tail' + s] = p;
    }
  }
  a.hatSlot = new THREE.Group(); a.hatSlot.position.set(0, headR * 0.62, -headR * 0.02); a.hatSlot.rotation.x = -0.12; head.add(a.hatSlot);
  a.hatSlot.scale.setScalar(headR / 0.118);
  // 腕
  a.arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * tw * 1.15, th * 0.85, 0); torso.add(sh);
    const al = H * 0.36;
    mesh(new THREE.CapsuleGeometry(tw * 0.32, al * 0.42, 6, 12), shirt, sh, V(0, -al * 0.25, 0));
    const fore = new THREE.Group(); fore.position.y = -al * 0.5; sh.add(fore);
    mesh(new THREE.CapsuleGeometry(tw * 0.27, al * 0.38, 6, 12), skin, fore, V(0, -al * 0.22, 0));
    mesh(new THREE.SphereGeometry(tw * 0.36, 14, 10), skin, fore, V(0, -al * 0.48, 0));
    sh.rotation.z = s * 0.12;
    sh.userData.fore = fore;
    a.arms.push(sh);
  }
  // 脚
  a.legs = [];
  for (const s of [-1, 1]) {
    const l = new THREE.Group(); l.position.set(s * tw * 0.5, 0, 0); hips.add(l);
    mesh(new THREE.CapsuleGeometry(tw * 0.38, legH * 0.8, 6, 12), isDad ? pants : skin, l, V(0, -legH * 0.48, 0));
    mesh(new THREE.SphereGeometry(tw * 0.45, 14, 10), shoe, l, V(0, -legH + tw * 0.2, tw * 0.25), null, V(1, 0.6, 1.5));
    a.legs.push(l);
  }
  a.head = head; a.torso = torso; a.hips = hips; a.legH = legH; a.neck = neck;
  a.setFace = (e) => { if (a.expr !== e) { a.expr = e; fc.draw(e, a.eyeLook || 0); } };
  a.update = (dt, t) => {
    const k = 1 - Math.pow(0.001, dt);
    a.phase += dt * 8 * (a.walking ? 1 : 0);
    const w = a.walking ? 1 : 0;
    a.legs[0].rotation.x = Math.sin(a.phase) * 0.5 * w; a.legs[1].rotation.x = -Math.sin(a.phase) * 0.5 * w;
    if (!a.sitting) hips.position.y = legH + Math.abs(Math.sin(a.phase)) * 0.03 * w + (a.hop || 0);
    a.arms.forEach((sh, i) => {
      const tg = a.armT[i];
      const swing = a.walking && !a.carry ? -Math.sin(a.phase) * 0.4 * (i ? -1 : 1) : 0;
      sh.rotation.x = lerp(sh.rotation.x, tg.x + swing, k);
      sh.rotation.z = lerp(sh.rotation.z, (i ? 1 : -1) * -0.12 + tg.z, k);
      sh.userData.fore.rotation.x = lerp(sh.userData.fore.rotation.x, tg.fx || 0, k);
    });
    head.rotation.y = lerp(head.rotation.y, a.look, 0.1);
    head.rotation.x = lerp(head.rotation.x, a.lookY, 0.1);
    head.rotation.z = lerp(head.rotation.z, a.expr === 'puzzled' ? 0.2 : 0, 0.1);
    torso.rotation.z = Math.sin(t * 1.6) * 0.015 + (a.wiggle ? Math.sin(t * 10) * 0.08 : 0);
    if (a.tail1) { a.tail1.rotation.z = Math.sin(t * 3) * 0.08 + (a.wiggle ? Math.sin(t * 12) * 0.3 : 0); a['tail-1'].rotation.z = -a.tail1.rotation.z; }
  };
  return a;
}

// ---------- スイカ ----------
export function makeMelon(r) {
  const g = new THREE.SphereGeometry(r, 40, 28); g.scale(1, 0.9, 1.08);
  const pos = g.attributes.position, cols = new Float32Array(pos.count * 3), c = new THREE.Color();
  const light = C('#6aa33f'), dark = C('#1f4a1d');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ang = Math.atan2(x, y), lat = z / r;
    const st = Math.sin(ang * 8 + Math.sin(lat * 14) * 0.5);
    c.copy(st > 0.1 ? dark : light).multiplyScalar(0.9 + vnoise(x * 30 / r, y * 30 / r, z * 30 / r) * 0.15);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const m = mesh(g, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.4 }));
  m.rotation.z = Math.PI / 2;
  const grp = new THREE.Group(); grp.add(m); m.position.y = r * 0.9;
  mesh(new THREE.CylinderGeometry(r * 0.04, r * 0.06, r * 0.18, 8), new THREE.MeshStandardMaterial({ color: 0x6b5a2a }), grp, V(r * 1.08, r * 0.9, 0), { z: -Math.PI / 2 });
  grp.userData.r = r;
  return grp;
}

let _sliceTex = null;
export function makeSlice() {
  const r = 0.16;
  if (!_sliceTex) {
    _sliceTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#2f6b25'; g.beginPath(); g.arc(128, 128, 128, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d9efb8'; g.beginPath(); g.arc(128, 128, 116, 0, Math.PI * 2); g.fill();
      const gr = g.createRadialGradient(128, 128, 20, 128, 128, 110); gr.addColorStop(0, '#f2445a'); gr.addColorStop(1, '#e33a4a');
      g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 108, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2a1a12';
      for (let i = 0; i < 9; i++) { const a = Math.PI * (0.15 + 0.7 * i / 8); g.beginPath(); g.ellipse(128 + Math.cos(a) * 62, 128 + Math.sin(a) * 62, 4, 7, a + Math.PI / 2, 0, Math.PI * 2); g.fill(); }
    });
    _sliceTex.wrapS = _sliceTex.wrapT = THREE.RepeatWrapping;
    _sliceTex.repeat.set(1 / (2 * r), -1 / (2 * r)); _sliceTex.offset.set(0.5, 0.5);
  }
  const sh = new THREE.Shape(); sh.absarc(0, 0, r, Math.PI, 2 * Math.PI, false); sh.lineTo(-r, 0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 24 });
  geo.translate(0, 0, -0.0175);
  const m = new THREE.Mesh(geo, [new THREE.MeshStandardMaterial({ map: _sliceTex, roughness: 0.35 }), new THREE.MeshStandardMaterial({ color: 0x3a7a2c, roughness: 0.5 })]);
  m.castShadow = true;
  const g = new THREE.Group(); g.add(m); m.position.y = r;
  return g;
}

// ---------- 家具・小物 ----------
export function std(color, rough = 0.7, extra = {}) { return new THREE.MeshStandardMaterial({ color: C(color), roughness: rough, ...extra }); }
export { mesh, ell, cyl, V, C, lerp, smooth, woodMat };

// ルール看板：大きい恐竜には大きいスイカ、小さい恐竜には小さいスイカ（絵だけ）
export function signTex() {
  return canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#f7efd8'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a6440'; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
    const melon = (x, y, r) => {
      g.fillStyle = '#5c9a38'; g.beginPath(); g.ellipse(x, y, r * 1.1, r, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#1f4a1d'; g.lineWidth = Math.max(2, r * 0.18);
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(x, y, r * 1.1 * Math.abs(i) / 2.5 + 1, r, 0, -Math.PI / 2, Math.PI / 2, i < 0); g.stroke(); }
    };
    const col = ['#6f8a4e', '#8d9a6b', '#b4643e'];
    // ティラノ
    g.fillStyle = col[0];
    g.beginPath(); g.ellipse(95, 150, 50, 38, -0.3, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(140, 92, 36, 24, 0.1, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(55, 160); g.lineTo(18, 200); g.lineTo(60, 180); g.fill();
    g.fillRect(78, 175, 16, 40); g.fillRect(104, 175, 16, 40);
    g.fillStyle = '#111'; g.beginPath(); g.arc(150, 84, 5, 0, Math.PI * 2); g.fill();
    // トリケラ
    g.fillStyle = col[1];
    g.beginPath(); g.ellipse(262, 175, 46, 28, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(310, 160, 22, 20, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#b8744c'; g.beginPath(); g.ellipse(296, 146, 14, 28, -0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = col[1]; g.beginPath(); g.ellipse(312, 162, 20, 17, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#efe3c4'; g.beginPath(); g.moveTo(318, 150); g.lineTo(345, 138); g.lineTo(322, 158); g.fill();
    g.fillStyle = col[1]; g.fillRect(232, 192, 12, 22); g.fillRect(278, 192, 12, 22);
    g.fillStyle = '#111'; g.beginPath(); g.arc(318, 160, 4, 0, Math.PI * 2); g.fill();
    // 翼竜
    g.fillStyle = col[2];
    g.beginPath(); g.moveTo(400, 180); g.lineTo(440, 160); g.lineTo(480, 180); g.lineTo(440, 172); g.fill();
    g.beginPath(); g.ellipse(440, 170, 10, 7, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(446, 164); g.lineTo(470, 160); g.lineTo(446, 168); g.fill();
    // 点線とスイカ
    g.setLineDash([8, 8]); g.strokeStyle = '#8a6440'; g.lineWidth = 4;
    [[100, 220, 100, 280], [262, 220, 262, 300], [440, 190, 440, 315]].forEach(([x1, y1, x2, y2]) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); });
    g.setLineDash([]);
    melon(100, 318, 42); melon(262, 330, 28); melon(440, 336, 15);
  });
}
