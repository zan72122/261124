// art: materials, characters, faces, icons, props
import * as THREE from 'three';
import { renderer, envTex, tween, ease, wait, time } from './core.js';

// ---------- textures ----------
const loader = new THREE.TextureLoader();
const texCache = {};
export function tex(name, rx = 1, ry = rx) {
  const key = name + rx + 'x' + ry;
  if (texCache[key]) return texCache[key];
  const t = loader.load('tex/' + name + '.jpg');
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texCache[key] = t;
  return t;
}
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.userData.canvas = c; t.userData.ctx = ctx;
  return t;
}

// ---------- materials ----------
export const M = {
  skin: new THREE.MeshStandardMaterial({ color: 0xf6c9a8, roughness: 0.6 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xd9ab4f, metalness: 1, roughness: 0.22, envMapIntensity: 1.3 }),
  brassDark: new THREE.MeshStandardMaterial({ color: 0xa87a2a, metalness: 1, roughness: 0.35 }),
  ceramic: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xcfd3d6, metalness: 1, roughness: 0.18 }),
  black: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }),
  white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
  linen: null, wood: null,
};
export function initMaterials() {
  M.linen = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex('linen', 2), roughness: 0.92 });
  M.linenCloth = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex('linen', 4, 1), roughness: 0.92, side: THREE.DoubleSide });
  M.woodDark = new THREE.MeshStandardMaterial({ color: 0x8a5a33, map: tex('woodfloor', 1), roughness: 0.55 });
  M.wood = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex('woodfloor', 1), roughness: 0.5 });
  M.marble = new THREE.MeshPhysicalMaterial({ map: tex('marble', 1), roughness: 0.12, clearcoat: 0.6 });
}
export const std = (color, rough = 0.7, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough }, extra));

export function mesh(geo, mat, x = 0, y = 0, z = 0, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast; m.receiveShadow = true;
  return m;
}
export function hitProxy(geo) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
  m.userData.hitProxy = true;
  return m;
}

// ---------- faces ----------
// expressions: smile happy laugh puzzled surprised oops yum sad wow sleep
export function drawFace(ctx, expr, blink, o = {}) {
  const W = 256;
  ctx.clearRect(0, 0, W, W);
  const ex = [W * 0.37, W * 0.63], ey = W * 0.5, my = W * 0.69;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // cheeks
  const blush = expr === 'oops' ? 0.55 : 0.28;
  ctx.fillStyle = `rgba(255,110,120,${blush})`;
  for (const x of [W * 0.27, W * 0.73]) { ctx.beginPath(); ctx.ellipse(x, W * 0.62, 17, 11, 0, 0, Math.PI * 2); ctx.fill(); }
  const ink = '#3a2418';
  ctx.strokeStyle = ink; ctx.fillStyle = ink;
  // eyes
  const closedHappy = ['happy', 'laugh', 'yum'].includes(expr);
  for (let i = 0; i < 2; i++) {
    const x = ex[i];
    if (closedHappy) {
      ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(x, ey + 6, 13, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    } else if (blink || expr === 'sleep') {
      ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x - 12, ey + 2); ctx.quadraticCurveTo(x, ey + 9, x + 12, ey + 2); ctx.stroke();
    } else {
      const big = (expr === 'surprised' || expr === 'wow') ? 1.3 : 1;
      ctx.fillStyle = ink;
      ctx.beginPath(); ctx.ellipse(x, ey, 11 * big, 15 * big, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x + 4 * big, ey - 6 * big, 4.5 * big, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x - 4 * big, ey + 5 * big, 2 * big, 0, Math.PI * 2); ctx.fill();
      if (expr === 'wow') { // star sparkles in eyes
        ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.arc(x, ey, 3, 0, 7); ctx.fill();
      }
      if (o.lashes) {
        ctx.strokeStyle = ink; ctx.lineWidth = 3;
        const s = i ? 1 : -1;
        ctx.beginPath(); ctx.moveTo(x + s * 9, ey - 11 * big); ctx.lineTo(x + s * 16, ey - 16 * big); ctx.stroke();
      }
    }
  }
  // brows
  ctx.strokeStyle = o.brow || '#5a3a22'; ctx.lineWidth = 5;
  const by = ey - 30;
  const browSets = {
    puzzled: [[-6, 4], [-14, -4]], surprised: [[-10, -10], [-10, -10]], wow: [[-10, -10], [-10, -10]],
    oops: [[6, -4], [-4, 6]], sad: [[6, -4], [-4, 6]],
  };
  const bs = browSets[expr] || [[0, 0], [0, 0]];
  for (let i = 0; i < 2; i++) {
    const x = ex[i], [a, b] = bs[i];
    ctx.beginPath(); ctx.moveTo(x - 13, by + (i ? b : a)); ctx.quadraticCurveTo(x, by - 6 + (a + b) / 2, x + 13, by + (i ? a : b)); ctx.stroke();
  }
  // mouth
  ctx.strokeStyle = '#7a2e22'; ctx.fillStyle = '#9b2f2f'; ctx.lineWidth = 6;
  const cx = W / 2;
  switch (expr) {
    case 'happy': case 'laugh': case 'wow': {
      const r = expr === 'laugh' ? 26 : 20;
      ctx.beginPath(); ctx.moveTo(cx - r, my - 6); ctx.quadraticCurveTo(cx, my + r * 1.5, cx + r, my - 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff8a8a'; ctx.beginPath(); ctx.ellipse(cx, my + r * 0.45, r * 0.5, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(cx - r * 0.6, my - 6, r * 1.2, 5);
      break;
    }
    case 'yum':
      ctx.beginPath(); ctx.arc(cx, my - 6, 16, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      ctx.fillStyle = '#ff7f8f'; ctx.beginPath(); ctx.ellipse(cx + 8, my + 8, 8, 7, 0.3, 0, Math.PI * 2); ctx.fill();
      break;
    case 'surprised':
      ctx.beginPath(); ctx.ellipse(cx, my + 2, 10, 14, 0, 0, Math.PI * 2); ctx.fill(); break;
    case 'puzzled':
      ctx.beginPath(); ctx.moveTo(cx - 14, my + 4); ctx.quadraticCurveTo(cx - 3, my - 4, cx + 4, my + 3); ctx.quadraticCurveTo(cx + 10, my + 8, cx + 16, my - 2); ctx.stroke(); break;
    case 'oops':
      ctx.beginPath(); ctx.moveTo(cx - 18, my + 4);
      for (let i = 1; i <= 6; i++) ctx.lineTo(cx - 18 + i * 6, my + 4 + (i % 2 ? -5 : 4));
      ctx.stroke();
      // sweat drop
      ctx.fillStyle = 'rgba(120,190,255,0.9)';
      ctx.beginPath(); ctx.moveTo(W * 0.84, W * 0.3); ctx.quadraticCurveTo(W * 0.9, W * 0.42, W * 0.84, W * 0.44); ctx.quadraticCurveTo(W * 0.78, W * 0.42, W * 0.84, W * 0.3); ctx.fill();
      break;
    case 'sad':
      ctx.beginPath(); ctx.arc(cx, my + 14, 14, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke(); break;
    case 'sleep':
      ctx.beginPath(); ctx.ellipse(cx, my, 6, 5, 0, 0, 7); ctx.fill(); break;
    default:
      ctx.beginPath(); ctx.arc(cx, my - 10, 18, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  }
}

// ---------- characters ----------
const capsule = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 16);
export function makeChar(o) {
  const s = o.size || 1; // 1 = adult
  const legL = 0.62 * s * (o.legs || 1), torsoL = 0.36 * s, torsoR = 0.2 * s * (o.wide || 1), headR = 0.2 * (0.75 + 0.25 * s);
  const g = new THREE.Group(); g.name = o.name;
  const rig = new THREE.Group(); g.add(rig);
  const shirtM = std(o.shirt, 0.85), pantsM = std(o.pants || 0x445577, 0.85), hairM = std(o.hair || 0x4a2d1a, 0.6);
  const shoeM = std(o.shoes || 0x332222, 0.5);
  // legs
  const hips = new THREE.Group(); hips.position.y = legL; rig.add(hips);
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.x = sx * torsoR * 0.48; hips.add(leg);
    const lm = mesh(capsule(0.075 * s + 0.02, legL - 0.15), o.skirt ? M.skin : pantsM, 0, -legL / 2 + 0.02, 0);
    leg.add(lm);
    const shoe = mesh(new THREE.SphereGeometry(0.085 * s + 0.02, 16, 10), shoeM, 0, -legL + 0.05, 0.04);
    shoe.scale.set(1, 0.6, 1.5); leg.add(shoe);
    legs.push(leg);
  }
  // torso
  const torso = mesh(capsule(torsoR, torsoL), shirtM, 0, legL + torsoL / 2 + torsoR * 0.6, 0);
  torso.scale.z = 0.8;
  rig.add(torso);
  if (o.skirt) {
    const sk = mesh(new THREE.CylinderGeometry(torsoR * 0.95, torsoR * 1.7, 0.32 * s + 0.08, 24, 1, true), std(o.skirt, 0.8, { side: THREE.DoubleSide }), 0, legL + 0.04, 0);
    rig.add(sk);
  }
  const neckY = legL + torsoL + torsoR * 1.3;
  // head
  const head = new THREE.Group(); head.position.y = neckY + headR * 0.95; rig.add(head);
  const headMesh = mesh(new THREE.SphereGeometry(headR, 32, 24), M.skin); head.add(headMesh);
  for (const sx of [-1, 1]) { const ear = mesh(new THREE.SphereGeometry(headR * 0.22, 12, 8), M.skin, sx * headR * 0.97, 0, 0); ear.scale.z = 0.6; head.add(ear); }
  const nose = mesh(new THREE.SphereGeometry(headR * 0.1, 12, 8), M.skin, 0, -headR * 0.12, headR * 0.98, false); head.add(nose);
  // face (canvas on front sphere patch)
  const fc = document.createElement('canvas'); fc.width = fc.height = 256;
  const fctx = fc.getContext('2d');
  const ftex = new THREE.CanvasTexture(fc); ftex.colorSpace = THREE.SRGBColorSpace; ftex.anisotropy = 4;
  const face = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.006, 32, 24, Math.PI / 2 - 0.9, 1.8, Math.PI / 2 - 0.8, 1.6),
    new THREE.MeshStandardMaterial({ map: ftex, transparent: true, roughness: 0.6, depthWrite: false }));
  head.add(face);
  // hair
  addHair(head, headR, o.hairStyle || 'short', hairM, o);
  if (o.glasses) {
    for (const sx of [-1, 1]) {
      const ring = mesh(new THREE.TorusGeometry(headR * 0.2, headR * 0.025, 8, 24), M.brassDark, sx * headR * 0.27, headR * 0.02, headR * 0.93, false);
      head.add(ring);
    }
  }
  if (o.mustache) {
    for (const sx of [-1, 1]) {
      const m = mesh(new THREE.SphereGeometry(headR * 0.2, 12, 8), std(0xf2f2f2, 0.9), sx * headR * 0.17, -headR * 0.3, headR * 0.9, false);
      m.scale.set(1.3, 0.55, 0.6); m.rotation.z = sx * -0.3; head.add(m);
    }
  }
  // arms
  const arms = [];
  const armLen = 0.5 * s + 0.06;
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sx * (torsoR + 0.05), neckY - 0.08 * s, 0); rig.add(sh);
    const a = mesh(capsule(0.06 * s + 0.015, armLen - 0.1), shirtM, 0, -armLen / 2, 0); sh.add(a);
    const hand = mesh(new THREE.SphereGeometry(0.06 * s + 0.02, 12, 10), M.skin, 0, -armLen, 0); sh.add(hand);
    sh.rotation.z = sx * 0.12;
    arms.push(sh);
  }
  const c = {
    g, rig, head, face, legs, arms, hips, torso, headR, legL, neckY, s, armLen,
    expr: 'smile', baseExpr: 'smile', blink: false, nextBlink: 2 + Math.random() * 3, tmpUntil: 0,
    o, pose: 'stand', bob: Math.random() * 6, anim: null, walking: 0, lookY: 0,
    draw() { drawFace(fctx, this.expr, this.blink, o); ftex.needsUpdate = true; },
    setExpr(e, dur) { this.expr = e; if (dur) this.tmpUntil = time + dur; else { this.baseExpr = e; this.tmpUntil = 0; } this.draw(); },
    headTop() { const v = new THREE.Vector3(0, headR * 1.15, 0); head.localToWorld(v); return v; },
    handPos(i = 1) { const v = new THREE.Vector3(0, -armLen, 0); arms[i].localToWorld(v); return v; },
    center() { const v = new THREE.Vector3(); torso.getWorldPosition(v); v.y += 0.15; return v; },
  };
  c.draw();
  return c;
}
function addHair(head, r, style, mat, o) {
  const cap = mesh(new THREE.SphereGeometry(r * 1.06, 32, 20), mat, 0, r * 0.12, -r * 0.16);
  head.add(cap);
  // bangs
  const bang = mesh(new THREE.SphereGeometry(r * 1.03, 32, 12, Math.PI / 2 - 1.1, 2.2, 0.35, 0.5), mat, 0, 0.0, 0.0);
  head.add(bang);
  if (style === 'bald') { cap.visible = false; bang.visible = false;
    for (const sx of [-1, 1]) { const t = mesh(new THREE.SphereGeometry(r * 0.38, 12, 10), mat, sx * r * 0.85, -r * 0.05, -r * 0.25); t.scale.set(0.6, 0.9, 1); head.add(t); }
  }
  if (style === 'long') {
    const back = mesh(new THREE.CylinderGeometry(r * 0.95, r * 1.1, r * 2.2, 24, 1, false, Math.PI * 0.6, Math.PI * 1.8), mat, 0, -r * 0.8, -r * 0.18);
    head.add(back);
  }
  if (style === 'pigtails') {
    for (const sx of [-1, 1]) {
      const p = mesh(new THREE.SphereGeometry(r * 0.42, 16, 12), mat, sx * r * 1.12, -r * 0.15, -r * 0.2); p.scale.set(0.8, 1.25, 0.8); head.add(p);
      const tie = mesh(new THREE.TorusGeometry(r * 0.16, r * 0.06, 8, 16), std(o.tie || 0xff5c8a, 0.5), sx * r * 0.98, r * 0.12, -r * 0.2);
      tie.rotation.y = Math.PI / 2; head.add(tie);
    }
  }
  if (style === 'bun') { const b = mesh(new THREE.SphereGeometry(r * 0.45, 16, 12), mat, 0, r * 1.05, -r * 0.35); head.add(b); }
  if (style === 'curly') {
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2;
      const b = mesh(new THREE.SphereGeometry(r * 0.32, 12, 8), mat, Math.cos(a) * r * 0.95, r * 0.25 + Math.sin(i * 2.1) * r * 0.25, Math.sin(a) * r * 0.85 - r * 0.25);
      if (b.position.z > r * 0.3 && b.position.y < r * 0.4) continue;
      head.add(b);
    }
  }
}
// per-frame character animation
export function animChar(c, dt, t) {
  // blink
  if (!c.tmpUntil || t < c.tmpUntil) {
    c.nextBlink -= dt;
    if (c.nextBlink < 0 && !c.blink) { c.blink = true; c.draw(); c.nextBlink = 0.13; }
    else if (c.nextBlink < 0 && c.blink) { c.blink = false; c.draw(); c.nextBlink = 2 + Math.random() * 3.5; }
  }
  if (c.tmpUntil && t > c.tmpUntil) { c.tmpUntil = 0; c.expr = c.baseExpr; c.draw(); }
  // idle breathing
  c.bob += dt;
  const br = Math.sin(c.bob * 2.2) * 0.012;
  c.rig.scale.y = 1 + br; c.head.rotation.z = Math.sin(c.bob * 1.1) * 0.04;
  // walking legs
  if (c.walking > 0) {
    const w = Math.sin(t * 11) * 0.5;
    c.legs[0].rotation.x = w; c.legs[1].rotation.x = -w;
    if (!c.anim) { c.arms[0].rotation.x = -w * 0.7; c.arms[1].rotation.x = w * 0.7; }
    c.rig.position.y = Math.abs(Math.sin(t * 11)) * 0.04;
  } else if (c.pose === 'stand') {
    c.legs[0].rotation.x *= 0.8; c.legs[1].rotation.x *= 0.8; c.rig.position.y *= 0.8;
  }
  if (c.anim) c.anim(dt, t);
}
export function setPose(c, pose) {
  c.pose = pose;
  if (pose === 'sit') { c.legs.forEach(l => { l.rotation.x = -1.15; }); c.rig.position.y = 0; }
  else { c.legs.forEach(l => { l.rotation.x = 0; }); }
}
export function armsTo(c, l, r, dur = 0.3) { // l/r = [rx, rz]
  const a0 = c.arms.map(a => [a.rotation.x, a.rotation.z]);
  const tgt = [l, r];
  return tween(dur, k => c.arms.forEach((a, i) => { if (!tgt[i]) return; a.rotation.x = a0[i][0] + (tgt[i][0] - a0[i][0]) * k; a.rotation.z = a0[i][1] + (tgt[i][1] - a0[i][1]) * k; }));
}
export const ARMS_DOWN = [[0, -0.12], [0, 0.12]];
export async function cheer(c, dur = 1.2) {
  await armsTo(c, [0, -2.6], [0, 2.6], 0.2);
  const t0 = time;
  c.anim = (dt, t) => { c.arms[0].rotation.z = -2.5 + Math.sin((t - t0) * 12) * 0.25; c.arms[1].rotation.z = 2.5 - Math.sin((t - t0) * 12) * 0.25; };
  await wait(dur);
  c.anim = null;
  await armsTo(c, ARMS_DOWN[0], ARMS_DOWN[1], 0.25);
}
export async function clap(c, dur = 1.5) {
  await armsTo(c, [-1.25, -0.1], [-1.25, 0.1], 0.2);
  const t0 = time;
  c.anim = (dt, t) => { const k = Math.abs(Math.sin((t - t0) * 10)) * 0.45; c.arms[0].rotation.z = -0.05 - k; c.arms[1].rotation.z = 0.05 + k; };
  await wait(dur);
  c.anim = null;
  await armsTo(c, ARMS_DOWN[0], ARMS_DOWN[1], 0.25);
}
export async function hop(c, h = 0.25, dur = 0.35) {
  const y0 = c.g.position.y;
  await tween(dur, k => { c.g.position.y = y0 + Math.sin(k * Math.PI) * h; }, ease.linear);
  c.g.position.y = y0;
}
export async function walkTo(c, x, z, speed = 1.6, faceAfter) {
  const p = c.g.position; const dx = x - p.x, dz = z - p.z;
  const d = Math.hypot(dx, dz);
  if (d > 0.01) {
    const ang = Math.atan2(dx, dz);
    const r0 = c.g.rotation.y;
    let da = ang - r0; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    tween(0.25, k => { c.g.rotation.y = r0 + da * k; });
    c.walking++;
    const x0 = p.x, z0 = p.z;
    await tween(d / speed, k => { p.x = x0 + dx * k; p.z = z0 + dz * k; }, ease.linear);
    c.walking--;
  }
  if (faceAfter !== undefined) await turnTo(c, faceAfter);
}
export function turnTo(c, ang, dur = 0.3) {
  const r0 = c.g.rotation.y;
  let da = ang - r0; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
  return tween(dur, k => { c.g.rotation.y = r0 + da * k; });
}

// ---------- outfit for the player girl ----------
export function makeApron(c) {
  const r = c.torso.geometry.parameters.radius;
  const g = new THREE.Group();
  const front = mesh(new THREE.CylinderGeometry(r * 1.08, r * 1.5, 0.62 * c.s + 0.12, 24, 1, true, -0.95, 1.9), std(0xffffff, 0.85, { side: THREE.DoubleSide, map: tex('linen', 1) }), 0, 0, 0);
  g.add(front);
  const pocket = mesh(new THREE.BoxGeometry(0.16, 0.08, 0.01), std(0xff8fab, 0.8), 0, -0.12, r * 1.38); pocket.rotation.x = -0.12; g.add(pocket);
  const frill = mesh(new THREE.TorusGeometry(r * 1.45, 0.018, 6, 24, 1.9), std(0xff8fab, 0.7), 0, -0.3 * c.s - 0.03, 0);
  frill.rotation.x = Math.PI / 2; frill.rotation.z = -Math.PI / 2 - 0.95; g.add(frill);
  return g;
}
export function makeChefHat() {
  const g = new THREE.Group();
  const band = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 24), std(0xffffff, 0.8, { map: tex('linen', 2, 1) }), 0, 0.05, 0); g.add(band);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2;
    const p = mesh(new THREE.SphereGeometry(0.1, 16, 12), std(0xffffff, 0.85), Math.cos(a) * 0.11, 0.17, Math.sin(a) * 0.11); g.add(p);
  }
  g.add(mesh(new THREE.SphereGeometry(0.13, 16, 12), std(0xffffff, 0.85), 0, 0.22, 0));
  const ribbon = mesh(new THREE.TorusGeometry(0.172, 0.012, 6, 32), std(0xff8fab, 0.6), 0, 0.03, 0); ribbon.rotation.x = Math.PI / 2; g.add(ribbon);
  return g;
}

// ---------- 2D icons for bubbles & signs ----------
export function drawIcon(ctx, key, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const bowl = (col) => {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#b9c2cc'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-40, 0); ctx.quadraticCurveTo(-38, 36, 0, 38); ctx.quadraticCurveTo(38, 36, 40, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, 40, 9, 0, 0, Math.PI * 2); ctx.fill();
  };
  switch (key) {
    case 'soup':
      bowl('#e5562f');
      ctx.fillStyle = '#5cb85c'; [[-12, -1], [8, 2], [18, -2]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 3.5, 0, 7); ctx.fill(); });
      ctx.strokeStyle = 'rgba(150,150,150,0.7)'; ctx.lineWidth = 4;
      for (const sx of [-14, 0, 14]) { ctx.beginPath(); ctx.moveTo(sx, -14); ctx.bezierCurveTo(sx - 8, -24, sx + 8, -30, sx, -42); ctx.stroke(); }
      break;
    case 'salad':
      bowl('#6cbf4a');
      ctx.fillStyle = '#5aa83a';
      [[-24, -6], [-8, -12], [10, -10], [24, -5], [0, -4]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 12, 0, 7); ctx.fill(); });
      ctx.fillStyle = '#e8332e'; [[-14, -8], [14, -12], [2, -18]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 7, 0, 7); ctx.fill(); });
      ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(24, -14, 5, 0, 7); ctx.fill();
      break;
    case 'pancake':
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 30, 46, 10, 0, 0, 7); ctx.fill();
      for (let i = 0; i < 3; i++) {
        const yy = 20 - i * 15;
        ctx.fillStyle = '#c9823c'; ctx.beginPath(); ctx.ellipse(0, yy + 4, 36, 10, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#e8b064'; ctx.beginPath(); ctx.ellipse(0, yy, 36, 9, 0, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#a0521d'; ctx.beginPath(); ctx.ellipse(0, -10, 28, 7, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(18, -8); ctx.quadraticCurveTo(24, 4, 20, 10); ctx.quadraticCurveTo(16, 4, 14, -6); ctx.fill();
      ctx.fillStyle = '#ffe36e'; ctx.fillRect(-8, -22, 16, 11);
      break;
    case 'cake':
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 32, 46, 10, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#f5d9a6'; ctx.fillRect(-32, -6, 64, 34);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-32, 6, 64, 6);
      ctx.fillStyle = '#ffb6c8'; ctx.beginPath(); ctx.ellipse(0, -6, 32, 9, 0, 0, 7); ctx.fill(); ctx.fillRect(-32, -8, 64, 6);
      ctx.fillStyle = '#fff'; for (const sx of [-20, 0, 20]) { ctx.beginPath(); ctx.arc(sx, -14, 8, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#e8283a'; for (const sx of [-20, 0, 20]) { ctx.beginPath(); ctx.moveTo(sx - 6, -20); ctx.quadraticCurveTo(sx, -36, sx + 6, -20); ctx.quadraticCurveTo(sx, -12, sx - 6, -20); ctx.fill(); }
      break;
    case 'duck': case 'flower': case 'star': {
      // brass key with a round tag
      ctx.fillStyle = '#d9ab4f'; ctx.strokeStyle = '#9a6f22'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(-22, 10, 14, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-22, 10, 6, 0, 7); ctx.fill();
      ctx.fillStyle = '#d9ab4f'; ctx.fillRect(-10, 6, 46, 8); ctx.fillRect(26, 14, 6, 10); ctx.fillRect(16, 14, 6, 7);
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-22, -4); ctx.lineTo(-22, -16); ctx.stroke();
      drawTag(ctx, key, -22, -30, 22);
      break;
    }
    case 'rubberduck': drawDuck(ctx, 0, 0, 1.2); break;
    case 'heart':
      ctx.fillStyle = '#ff4f7b';
      ctx.beginPath(); ctx.moveTo(0, 30); ctx.bezierCurveTo(-60, -10, -25, -50, 0, -18); ctx.bezierCurveTo(25, -50, 60, -10, 0, 30); ctx.fill();
      break;
    case 'smile':
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(0, 0, 40, 0, 7); ctx.fill();
      ctx.fillStyle = '#4a3020'; ctx.beginPath(); ctx.arc(-13, -8, 5, 0, 7); ctx.arc(13, -8, 5, 0, 7); ctx.fill();
      ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 2, 20, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      break;
  }
  ctx.restore();
}
export function drawTag(ctx, key, x, y, r) {
  const col = { duck: '#4fb3ff', flower: '#ff7fb0', star: '#7ed36a' }[key];
  ctx.fillStyle = col; ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.15;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
  if (key === 'duck') drawDuck(ctx, x, y + r * 0.05, r / 42);
  if (key === 'flower') {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.38, y + Math.sin(a) * r * 0.38, r * 0.27, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(x, y, r * 0.22, 0, 7); ctx.fill();
  }
  if (key === 'star') {
    ctx.fillStyle = '#ffe14d'; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.3 : r * 0.68; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.fill();
  }
}
function drawDuck(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#ffd21f';
  ctx.beginPath(); ctx.ellipse(4, 10, 30, 18, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(-12, -12, 16, 0, 7); ctx.fill();
  ctx.fillStyle = '#ff8a1f'; ctx.beginPath(); ctx.ellipse(-30, -9, 10, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-15, -15, 3.5, 0, 7); ctx.fill();
  ctx.restore();
}

// thought bubble sprite
export function makeBubble(key) {
  const t = canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.ellipse(128, 110, 108, 92, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(70, 218, 16, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(48, 244, 9, 0, 7); ctx.fill(); ctx.stroke();
    drawIcon(ctx, key, 128, 112, 150);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  sp.renderOrder = 10;
  sp.userData.key = key;
  return sp;
}
export function iconSprite(key, size = 0.4, card = false) {
  const t = canvasTex(128, 128, ctx => {
    if (card) {
      ctx.fillStyle = '#d9ab4f'; ctx.beginPath(); ctx.arc(64, 64, 62, 0, 7); ctx.fill();
      ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(64, 64, 55, 0, 7); ctx.fill();
      drawIcon(ctx, key, 64, 68, 80);
    } else drawIcon(ctx, key, 64, 64, 110);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  sp.scale.setScalar(size);
  return sp;
}

// ---------- props ----------
export function bowlGeo(r = 0.11, h = 0.07) {
  const pts = [];
  for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * r * 0.98 + 0.001, h - Math.cos(a) * h)); }
  for (let i = 10; i >= 0; i--) { const a = i / 10 * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * r * 0.88 + 0.001, h - Math.cos(a) * h * 0.85 + 0.008)); }
  return new THREE.LatheGeometry(pts, 32);
}
export function plate(r = 0.15) {
  const pts = [new THREE.Vector2(0, 0.005), new THREE.Vector2(r * 0.6, 0.004), new THREE.Vector2(r * 0.65, 0.0), new THREE.Vector2(r, 0.022), new THREE.Vector2(r * 0.97, 0.026), new THREE.Vector2(r * 0.62, 0.01), new THREE.Vector2(0, 0.012)];
  return mesh(new THREE.LatheGeometry(pts, 40), M.ceramic);
}
export function makeDish(kind) {
  const g = new THREE.Group(); g.userData.kind = kind;
  g.add(plate(0.17));
  if (kind === 'soup') {
    const b = mesh(bowlGeo(0.12, 0.08), M.ceramic, 0, 0.012, 0); g.add(b);
    const s = mesh(new THREE.CircleGeometry(0.105, 32), std(0xe2552d, 0.3), 0, 0.075, 0, false); s.rotation.x = -Math.PI / 2; g.add(s);
    g.userData.soup = s;
    for (let i = 0; i < 4; i++) { const h = mesh(new THREE.SphereGeometry(0.012, 8, 6), std(0x58b04a, 0.6), Math.cos(i * 1.7) * 0.05, 0.078, Math.sin(i * 1.7) * 0.05, false); g.add(h); }
  } else if (kind === 'salad') {
    const b = mesh(bowlGeo(0.13, 0.07), std(0xb07a45, 0.5, { map: tex('woodfloor', 0.3) }), 0, 0.012, 0); g.add(b);
    for (let i = 0; i < 11; i++) {
      const l = mesh(new THREE.IcosahedronGeometry(0.045, 0), std(i % 2 ? 0x6cbf4a : 0x4f9c38, 0.6), Math.cos(i * 2.4) * 0.06, 0.075 + (i % 3) * 0.012, Math.sin(i * 2.4) * 0.06);
      l.rotation.set(i, i * 2, 0); l.scale.y = 0.6; g.add(l);
    }
    for (let i = 0; i < 4; i++) g.add(mesh(new THREE.SphereGeometry(0.022, 12, 8), std(0xe8332e, 0.3), Math.cos(i * 1.6 + 0.5) * 0.06, 0.1, Math.sin(i * 1.6 + 0.5) * 0.06));
  } else if (kind === 'pancake') {
    for (let i = 0; i < 3; i++) g.add(mesh(new THREE.CylinderGeometry(0.11, 0.115, 0.03, 32), std(0xd89a52, 0.6), 0, 0.03 + i * 0.032, 0));
    const syrup = mesh(new THREE.CylinderGeometry(0.095, 0.1, 0.008, 32), std(0x8a3f12, 0.15), 0, 0.125, 0); g.add(syrup);
    g.add(mesh(new THREE.BoxGeometry(0.045, 0.025, 0.045), std(0xffe58a, 0.4), 0, 0.14, 0));
  } else if (kind === 'cakeSlice') {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.13, -0.05); sh.lineTo(0.13, 0.05); sh.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.09, bevelEnabled: false });
    const sl = mesh(geo, std(0xf5d9a6, 0.7), -0.06, 0.1, 0); sl.rotation.x = Math.PI / 2; g.add(sl);
    const top = mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.015, bevelEnabled: false }), std(0xffb6c8, 0.5), -0.06, 0.115, 0); top.rotation.x = Math.PI / 2; g.add(top);
    g.add(mesh(new THREE.SphereGeometry(0.022, 12, 8), std(0xe8283a, 0.3), 0.03, 0.135, 0));
    g.add(mesh(new THREE.SphereGeometry(0.02, 12, 8), std(0xffffff, 0.8), 0.0, 0.125, 0.02));
  }
  return g;
}
export function makeChair(col = 0x8a5a33) {
  const g = new THREE.Group();
  const m = std(col, 0.55, { map: tex('woodfloor', 0.4) });
  g.add(mesh(new THREE.BoxGeometry(0.46, 0.05, 0.46), m, 0, 0.45, 0));
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) g.add(mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.45, 8), m, x, 0.225, z));
  g.add(mesh(new THREE.BoxGeometry(0.46, 0.5, 0.04), m, 0, 0.72, -0.22));
  return g;
}
// round table with long white tablecloth
export function makeTable(r = 0.6) {
  const g = new THREE.Group();
  const top = mesh(new THREE.CylinderGeometry(r, r, 0.03, 48), M.linen, 0, 0.75, 0); g.add(top);
  const drape = mesh(new THREE.CylinderGeometry(r + 0.005, r + 0.12, 0.6, 48, 1, true), M.linenCloth, 0, 0.47, 0); g.add(drape);
  // little brass vase with flower
  const vase = mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.12, 16), M.brass, 0, 0.83, 0); g.add(vase);
  const fl = mesh(new THREE.SphereGeometry(0.035, 12, 8), std(0xff6f91, 0.6), 0, 0.93, 0); g.add(fl);
  return g;
}
export function makeBell(scale = 1) {
  const g = new THREE.Group();
  const base = mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.025, 32), std(0x3b2414, 0.4), 0, 0.0125, 0); g.add(base);
  const pts = [];
  for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * 0.08 + 0.001, 0.025 + Math.cos(a) * 0.07)); }
  const dome = mesh(new THREE.LatheGeometry(pts.reverse(), 40), M.brass, 0, 0, 0); g.add(dome);
  const plunger = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.035, 8), M.brass, 0, 0.11, 0); g.add(plunger);
  const knob = mesh(new THREE.SphereGeometry(0.016, 12, 8), M.brass, 0, 0.13, 0); g.add(knob);
  g.userData.dome = dome; g.userData.knob = knob;
  g.scale.setScalar(scale);
  return g;
}
export async function ringBell(bell) {
  const k = bell.userData.knob, d = bell.userData.dome;
  k.position.y = 0.115; await wait(0.06); k.position.y = 0.13;
  tween(0.6, e => { d.rotation.z = Math.sin(e * 30) * 0.06 * (1 - e); d.scale.setScalar(1 + Math.sin(e * 40) * 0.03 * (1 - e)); }, ease.linear);
}
export function makeLamp(len = 1.2) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, len, 6), M.black, 0, -len / 2, 0, false));
  const shade = mesh(new THREE.ConeGeometry(0.22, 0.2, 32, 1, true), M.brass, 0, -len - 0.05, 0, false);
  shade.material = M.brass; g.add(shade);
  const bulb = mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshStandardMaterial({ color: 0xfff1cc, emissive: 0xffd58a, emissiveIntensity: 2.5 }), 0, -len - 0.12, 0, false);
  g.add(bulb);
  return g;
}
export function makeFrame(w, h, picTex, frameMat = M.brass) {
  const g = new THREE.Group();
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: picTex, roughness: 0.6 }));
  pic.position.z = 0.012; g.add(pic);
  const t = 0.05;
  g.add(mesh(new THREE.BoxGeometry(w + t * 2, t, 0.04), frameMat, 0, h / 2 + t / 2, 0));
  g.add(mesh(new THREE.BoxGeometry(w + t * 2, t, 0.04), frameMat, 0, -h / 2 - t / 2, 0));
  g.add(mesh(new THREE.BoxGeometry(t, h, 0.04), frameMat, -w / 2 - t / 2, 0, 0));
  g.add(mesh(new THREE.BoxGeometry(t, h, 0.04), frameMat, w / 2 + t / 2, 0, 0));
  g.userData.pic = pic;
  return g;
}
// room shell: floor, 3 walls, optional ceiling
export function makeRoom(o) {
  const g = new THREE.Group();
  const { w, d, h } = o;
  const floor = mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: tex(o.floor || 'woodfloor', w / 2.5, d / 2.5), roughness: o.floorRough || 0.45 }), 0, 0, 0, false);
  floor.rotation.x = -Math.PI / 2; floor.position.z = o.z0 !== undefined ? o.z0 : 0; g.add(floor);
  const wallM = new THREE.MeshStandardMaterial({ map: tex(o.wall || 'wallpaper', w / 2, h / 2), roughness: 0.9, color: o.wallTint || 0xffffff });
  const back = mesh(new THREE.PlaneGeometry(w, h), wallM, 0, h / 2, floor.position.z - d / 2, false); g.add(back);
  const sideM = new THREE.MeshStandardMaterial({ map: tex(o.wall || 'wallpaper', d / 2, h / 2), roughness: 0.9, color: o.wallTint || 0xffffff });
  const l = mesh(new THREE.PlaneGeometry(d, h), sideM, -w / 2, h / 2, floor.position.z, false); l.rotation.y = Math.PI / 2; g.add(l);
  const r = mesh(new THREE.PlaneGeometry(d, h), sideM, w / 2, h / 2, floor.position.z, false); r.rotation.y = -Math.PI / 2; g.add(r);
  // wainscot & skirting
  const skM = std(o.trim || 0xf4efe6, 0.5);
  g.add(mesh(new THREE.BoxGeometry(w, 0.9, 0.04), skM, 0, 0.45, floor.position.z - d / 2 + 0.02, false));
  const sl = mesh(new THREE.BoxGeometry(d, 0.9, 0.04), skM, -w / 2 + 0.02, 0.45, floor.position.z, false); sl.rotation.y = Math.PI / 2; g.add(sl);
  const sr = sl.clone(); sr.position.x = w / 2 - 0.02; g.add(sr);
  g.add(mesh(new THREE.BoxGeometry(w, 0.06, 0.07), M.brass, 0, 0.92, floor.position.z - d / 2 + 0.04, false));
  const ceil = mesh(new THREE.PlaneGeometry(w, d), std(0xfbf6ee, 0.9), 0, h, floor.position.z, false);
  ceil.rotation.x = Math.PI / 2; g.add(ceil);
  g.add(mesh(new THREE.BoxGeometry(w, 0.12, 0.12), std(0xfbf6ee, 0.6), 0, h - 0.06, floor.position.z - d / 2 + 0.06, false));
  g.userData.backZ = floor.position.z - d / 2;
  return g;
}
export function makeWindow(w, h, viewTex) {
  const g = new THREE.Group();
  const v = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: viewTex, toneMapped: false, color: 0xe8e8e8 }));
  g.add(v);
  const fm = std(0xfafafa, 0.4);
  const t = 0.08;
  g.add(mesh(new THREE.BoxGeometry(w + t * 2, t, 0.1), fm, 0, h / 2 + t / 2, 0.02, false));
  g.add(mesh(new THREE.BoxGeometry(w + t * 2, t * 1.5, 0.18), fm, 0, -h / 2 - t / 2, 0.06, false));
  g.add(mesh(new THREE.BoxGeometry(t, h, 0.1), fm, -w / 2 - t / 2, 0, 0.02, false));
  g.add(mesh(new THREE.BoxGeometry(t, h, 0.1), fm, w / 2 + t / 2, 0, 0.02, false));
  g.add(mesh(new THREE.BoxGeometry(0.04, h, 0.05), fm, 0, 0, 0.02, false));
  g.add(mesh(new THREE.BoxGeometry(w, 0.04, 0.05), fm, 0, h * 0.1, 0.02, false));
  // curtains
  const cm = std(0xf3e2c7, 0.95, { side: THREE.DoubleSide });
  for (const sx of [-1, 1]) {
    const c = mesh(new THREE.CylinderGeometry(0.22, 0.28, h + 0.5, 12, 1, true, 0, Math.PI), cm, sx * (w / 2 + 0.25), 0.05, 0.12, false);
    c.rotation.y = Math.PI; c.scale.z = 0.4; g.add(c);
  }
  return g;
}
export function lights(root, o = {}) {
  root.environment = envTex;
  root.environmentIntensity = o.env !== undefined ? o.env : 0.55;
  const hemi = new THREE.HemisphereLight(o.sky || 0xfff6e8, o.ground || 0x8a6a50, o.hemi || 0.9); root.add(hemi);
  const sun = new THREE.DirectionalLight(o.sunCol || 0xfff0dc, o.sun || 2.2);
  sun.position.set(...(o.sunPos || [4, 9, 6]));
  sun.target.position.set(...(o.sunTarget || [0, 0, 0]));
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; const e = o.shadowExt || 8;
  sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.near = 0.5; sc.far = 40;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
  root.add(sun); root.add(sun.target);
  return sun;
}

// sparkles / particles
const sparkTex = canvasTex(64, 64, (ctx) => {
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,240,180,0.9)'); g.addColorStop(1, 'rgba(255,220,120,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(32, 0); ctx.lineTo(36, 28); ctx.lineTo(64, 32); ctx.lineTo(36, 36); ctx.lineTo(32, 64); ctx.lineTo(28, 36); ctx.lineTo(0, 32); ctx.lineTo(28, 28); ctx.fill();
});
export function sparkle(root, pos, n = 10, spread = 0.5, col = 0xffffff, size = 1) {
  for (let i = 0; i < n; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.position.copy(pos); root.add(sp);
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(spread * (0.5 + Math.random()));
    const s0 = (0.12 + Math.random() * 0.15) * size;
    tween(0.7 + Math.random() * 0.4, k => {
      sp.position.set(pos.x + dir.x * k, pos.y + dir.y * k, pos.z + dir.z * k);
      sp.scale.setScalar(s0 * (1 - k * 0.7)); sp.material.opacity = 1 - k; sp.material.rotation = k * 3;
    }, ease.out).then(() => { root.remove(sp); sp.material.dispose(); });
  }
}
export function floatIcon(root, key, pos, size = 0.35, rise = 0.7) {
  const sp = iconSprite(key, size);
  sp.position.copy(pos); root.add(sp);
  const x0 = pos.x;
  return tween(1.4, k => { sp.position.y = pos.y + rise * k; sp.position.x = x0 + Math.sin(k * 8) * 0.06; sp.material.opacity = k < 0.7 ? 1 : (1 - k) / 0.3; }, ease.out).then(() => root.remove(sp));
}
export { THREE };
