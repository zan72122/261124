// world: sets, backdrops, cast, shared props (ice cream pieces)
import { THREE, RoundedBoxGeometry, scene, TEX, canvasTex, fluffMat, mat, shadowy, makePerson } from './core.js';

export const sets = {};
function set(name) { const g = new THREE.Group(); g.name = name; g.visible = false; scene.add(g); sets[name] = g; return g; }
export function showSets(...names) { for (const k in sets) sets[k].visible = names.includes(k); }

// cylinder backdrop facing inward, mirrored-tiled image
function backdrop(tex, R, theta, tiles, y0, aspect) {
  const t = tex.clone(); t.needsUpdate = true;
  t.wrapS = THREE.MirroredRepeatWrapping; t.repeat.set(tiles, 1);
  const arc = R * theta; const h = arc / tiles / aspect;
  const g = new THREE.CylinderGeometry(R, R, h, 64, 1, true, Math.PI - theta / 2, theta);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide, fog: false, toneMapped: false }));
  m.scale.x = -1; m.position.y = y0 + h / 2;
  return m;
}

// ---------- yard ----------
const yard = set('yard');
{
  const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshStandardMaterial({ map: TEX.grass, roughness: 1, color: 0xd8f0b0 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; yard.add(ground);
  const bd = backdrop(TEX.yard, 34, 3.1, 2, -0.6, 2048 / 682);
  bd.position.z = 2; yard.add(bd);
  // a few real-ish flowers near the camera area
  const stemM = mat(0x4f8a35);
  const cols = [0xff8fc4, 0xffffff, 0xffe066, 0xff6f91];
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 6;
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.6 - 2;
    if (z > 4) continue;
    const f = new THREE.Group();
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3), stemM); st.position.y = 0.15; f.add(st);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(cols[i % 4], { roughness: 0.8 })); b.position.y = 0.32; b.scale.y = 0.6; f.add(b);
    f.position.set(x, 0, z); yard.add(f);
  }
}

// ---------- pool ----------
const pool = set('pool');
export const POOL = { x0: -2.4, x1: 2.4, z0: -1.8, z1: 0.8, water: -0.18, floor: -1.7 };
{
  const tile = canvasTex(256, 256, (g) => {
    g.fillStyle = '#efe6d8'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const v = 228 + Math.random() * 14; g.fillStyle = `rgb(${v},${v - 6},${v - 18})`; g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
    }
  });
  tile.wrapS = tile.wrapT = THREE.RepeatWrapping;
  const deckM = new THREE.MeshStandardMaterial({ map: tile, roughness: 0.75 });
  const P = POOL;
  const deck = (x0, x1, z0, z1) => {
    const w = x1 - x0, d = z1 - z0;
    const t = tile.clone(); t.needsUpdate = true; t.repeat.set(w / 1.2, d / 1.2);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 }));
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); m.receiveShadow = true; pool.add(m);
  };
  deck(-26, 26, P.z1, 26); deck(-26, 26, -26, P.z0); deck(-26, P.x0, P.z0, P.z1); deck(P.x1, 26, P.z0, P.z1);
  // coping edge
  const copM = mat(0xfaf6ee, { roughness: 0.5 });
  const cop = (w, d, x, z) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, 0.08, d, 2, 0.03), copM); m.position.set(x, 0.02, z); m.receiveShadow = true; pool.add(m); };
  cop(P.x1 - P.x0 + 0.4, 0.2, 0, P.z1 + 0.1); cop(P.x1 - P.x0 + 0.4, 0.2, 0, P.z0 - 0.1);
  cop(0.2, P.z1 - P.z0, P.x0 - 0.1, (P.z0 + P.z1) / 2); cop(0.2, P.z1 - P.z0, P.x1 + 0.1, (P.z0 + P.z1) / 2);
  // basin
  const blueTile = canvasTex(128, 128, g => {
    g.fillStyle = '#5ec8ec'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#d7f4ff'; g.lineWidth = 3;
    for (let i = 0; i <= 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  });
  blueTile.wrapS = blueTile.wrapT = THREE.RepeatWrapping; blueTile.repeat.set(6, 2);
  const basin = new THREE.Mesh(new THREE.BoxGeometry(P.x1 - P.x0, -P.floor, P.z1 - P.z0), new THREE.MeshStandardMaterial({ map: blueTile, side: THREE.BackSide, roughness: 0.4 }));
  basin.position.set((P.x0 + P.x1) / 2, P.floor / 2, (P.z0 + P.z1) / 2); basin.receiveShadow = true; pool.add(basin);
  // water
  const cau = canvasTex(256, 256, g => {
    g.fillStyle = '#3fb7e6'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 3;
    for (let i = 0; i < 40; i++) { g.beginPath(); const x = Math.random() * 256, y = Math.random() * 256; g.ellipse(x, y, 14 + Math.random() * 20, 8 + Math.random() * 10, Math.random() * 3, 0, Math.PI * 1.3); g.stroke(); }
  });
  cau.wrapS = cau.wrapT = THREE.RepeatWrapping; cau.repeat.set(3, 1.6);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(P.x1 - P.x0, P.z1 - P.z0), new THREE.MeshPhysicalMaterial({ map: cau, color: 0xbfefff, transparent: true, opacity: 0.78, roughness: 0.05, metalness: 0, clearcoat: 1, envMapIntensity: 1.2 }));
  water.rotation.x = -Math.PI / 2; water.position.set((P.x0 + P.x1) / 2, P.water, (P.z0 + P.z1) / 2); water.renderOrder = 2;
  pool.add(water); POOL.waterMesh = water; POOL.cau = cau;
  const bd = backdrop(TEX.pool, 26, 3.0, 2, -0.3, 2048 / 486);
  bd.position.z = 0; pool.add(bd);
  // loungers & plants for realism
  const wood = mat(0xc89a6a, { roughness: 0.7 }), cushion = fluffMat(0xffffff, 0.5);
  for (const x of [-4.6, 4.4]) {
    const l = new THREE.Group();
    const fr = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.12, 1.9, 2, 0.04), wood); fr.position.y = 0.32; l.add(fr);
    const cu = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.1, 1.3, 2, 0.04), cushion); cu.position.set(0, 0.42, 0.3); l.add(cu);
    const bk = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.1, 0.65, 2, 0.04), cushion); bk.position.set(0, 0.62, -0.55); bk.rotation.x = 0.7; l.add(bk);
    for (const sx of [-0.3, 0.3]) for (const sz of [-0.8, 0.8]) { const lg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.05), wood); lg.position.set(sx, 0.15, sz); l.add(lg); }
    l.position.set(x, 0, -0.8); l.rotation.y = x < 0 ? 0.3 : -0.3; shadowy(l); pool.add(l);
  }
}

// ---------- block world ----------
set('blocks');
// ---------- shop ----------
set('shop');
// ---------- truck & dress ----------
set('truck');
set('dress');

// ---------- cast ----------
export const girl = makePerson({ hairStyle: 'pigtails', hair: 0x6a3b22, shirt: 0xfff3b0, skirt: 0x8fd3ff, bareLegs: true, shoe: 0xff7eb6, size: 1 });
export const dad = makePerson({ hairStyle: 'short', hair: 0x3a2a20, shirt: 0x5aa6de, pants: 0xcdb48a, shoe: 0x6b4a3a, glasses: true, size: 1.55, headR: 0.15, legLen: 0.42, torsoLen: 0.32, torsoR: 0.14 });
export const customers = [
  makePerson({ hairStyle: 'bun', hair: 0xdedede, shirt: 0xc9b6f2, skirt: 0x8a6fbf, bareLegs: true, glasses: true, shoe: 0x8a5a44, size: 1.4, headR: 0.15, legLen: 0.4, torsoLen: 0.3 }),
  makePerson({ hairStyle: 'short', hair: 0x2b1d14, capColor: 0xff5a4f, shirt: 0x7fd17f, pants: 0x3b5b8c, shoe: 0xffffff, size: 1.18 }),
  makePerson({ hairStyle: 'long', hair: 0x1f1612, shirt: 0xff9a8a, skirt: 0xfff0f5, bareLegs: true, shoe: 0xffffff, size: 1.42, headR: 0.15, legLen: 0.4, torsoLen: 0.3 }),
];
for (const p of [girl, dad, ...customers]) { scene.add(p.root); p.root.visible = false; }

// ---------- costume ----------
export function makeHat() {
  const g = new THREE.Group();
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.18, 0.07, 28, 1, true), mat(0xffffff, { side: THREE.DoubleSide, roughness: 0.8 }));
  band.position.y = 0.0; g.add(band);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.18, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), fluffMat(0xffffff, 0.4));
  dome.scale.y = 0.75; dome.position.y = 0.03; g.add(dome);
  const ic = makeMiniIce(0.6); ic.position.y = 0.17; g.add(ic);
  return shadowy(g);
}
export function makeMiniIce(s = 1) {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.1, 16), waffleMat()); cone.rotation.x = Math.PI; cone.position.y = 0.05; g.add(cone);
  const sc = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), fluffMat(0xffffff, 0.15)); sc.position.y = 0.12; g.add(sc);
  const ch = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 8), mat(0xe01e3c, { roughness: 0.2 })); ch.position.y = 0.175; g.add(ch);
  g.scale.setScalar(s); return g;
}
export function makeApron() {
  const tex = canvasTex(128, 160, g => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#ff7fbf'; g.fillRect(i * 16, 0, 16, 160); }
    g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(34, 92, 60, 40, 10); g.fill();
    g.fillStyle = '#ff4f9a'; g.beginPath(); g.moveTo(64, 124); g.bezierCurveTo(44, 108, 52, 94, 64, 104); g.bezierCurveTo(76, 94, 84, 108, 64, 124); g.fill();
  });
  const g = new THREE.Group();
  const front = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.36, 20, 1, true, -1.0, 2.0), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.85 }));
  front.position.y = -0.04; g.add(front);
  const frill = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 6, 24, 2.0), fluffMat(0xffffff, 0.2)); frill.rotation.x = Math.PI / 2; frill.rotation.z = -Math.PI / 2 - 1.0 + Math.PI; frill.position.y = -0.22;
  frill.rotation.set(Math.PI / 2, 0, Math.PI / 2 - 1.0); g.add(frill);
  return shadowy(g);
}

// ---------- ice cream pieces ----------
let _waffle;
export function waffleMat() {
  if (_waffle) return _waffle;
  const t = canvasTex(128, 128, g => {
    g.fillStyle = '#e2a65a'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#b87634'; g.lineWidth = 5;
    for (let i = -128; i < 256; i += 22) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke(); g.beginPath(); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke(); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1);
  _waffle = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, bumpMap: t, bumpScale: 1.5 });
  return _waffle;
}
export const FLAVORS = {
  straw: { color: 0xff9ec8, css: '#ff9ec8' },
  vanilla: { color: 0xfff1cf, css: '#fff4da' },
  choco: { color: 0x8a5232, css: '#8a5232' },
  mint: { color: 0x9fe8c8, css: '#9fe8c8' },
};
export const SAUCES = { choco: { color: 0x4a2414, css: '#4a2414' }, straw: { color: 0xe0284f, css: '#e0284f' } };
const scoopGeo = (() => {
  const g = new THREE.SphereGeometry(0.085, 28, 20);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 1 + 0.06 * Math.sin(v.x * 90) * Math.sin(v.y * 80 + 1) * Math.sin(v.z * 70 + 2) + (v.y < -0.03 ? 0.06 * Math.sin(Math.atan2(v.z, v.x) * 9) : 0);
    v.multiplyScalar(n); p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
})();
const scoopMats = {};
export function makeScoop(fl) {
  const m = scoopMats[fl] || (scoopMats[fl] = new THREE.MeshPhysicalMaterial({ color: FLAVORS[fl].color, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.6, sheen: 0.5, sheenColor: new THREE.Color(0xffffff) }));
  const s = new THREE.Mesh(scoopGeo, m); s.castShadow = true; return s;
}
export function makeCone() {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.072, 0.22, 24, 1, true), waffleMat()); c.rotation.x = Math.PI; c.position.y = -0.11; c.material.side = THREE.DoubleSide; g.add(c);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 8, 24), waffleMat()); rim.rotation.x = Math.PI / 2; g.add(rim);
  shadowy(g); return g;
}
export function makeSauce(kind) {
  const g = new THREE.Group();
  const m = new THREE.MeshPhysicalMaterial({ color: SAUCES[kind].color, roughness: 0.15, clearcoat: 1 });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), m); g.add(cap);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + 0.3;
    const d = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.03 + (i % 3) * 0.02, 4, 8), m);
    d.position.set(Math.cos(a) * 0.072, 0.02 - (i % 3) * 0.012, Math.sin(a) * 0.072); g.add(d);
  }
  return g;
}
export function makeSprinkles() {
  const g = new THREE.Group();
  const cols = [0xff4f8b, 0xffe14d, 0x4fc3ff, 0x7be07b, 0xffffff, 0xb07bff];
  const geo = new THREE.CapsuleGeometry(0.006, 0.018, 2, 6);
  for (let i = 0; i < 26; i++) {
    const th = Math.random() * Math.PI * 0.4, ph = Math.random() * Math.PI * 2, r = 0.092;
    const s = new THREE.Mesh(geo, mat(cols[i % cols.length], { roughness: 0.4 }));
    s.position.set(Math.sin(th) * Math.cos(ph) * r, Math.cos(th) * r - 0.01, Math.sin(th) * Math.sin(ph) * r);
    s.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); g.add(s);
  }
  return g;
}
export function makeCherry() {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), new THREE.MeshPhysicalMaterial({ color: 0xd8102e, roughness: 0.15, clearcoat: 1 })); c.position.y = 0.105; g.add(c);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.06), mat(0x5a7a2a)); st.position.set(0.01, 0.15, 0); st.rotation.z = -0.3; g.add(st);
  return shadowy(g);
}
// draw the wanted ice cream in a speech-bubble canvas
export function drawOrder(g, order, W = 256, H = 256) {
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#ffffff'; g.strokeStyle = '#ffb3d6'; g.lineWidth = 6;
  g.beginPath();
  const blobs = [[128, 110, 92], [70, 120, 56], [186, 120, 56], [100, 60, 50], [160, 62, 50], [128, 160, 60]];
  for (const [x, y, r] of blobs) { g.moveTo(x + r, y); g.arc(x, y, r, 0, 7); }
  g.fill();
  g.beginPath(); g.arc(40, 222, 13, 0, 7); g.fill(); g.stroke();
  g.beginPath(); g.arc(22, 246, 8, 0, 7); g.fill(); g.stroke();
  // cone
  const cx = 128, base = 150, n = order.scoops.length;
  const r = n >= 3 ? 25 : 30;
  g.fillStyle = '#e2a65a'; g.beginPath(); g.moveTo(cx - 26, base); g.lineTo(cx + 26, base); g.lineTo(cx, base + 72); g.closePath(); g.fill();
  g.strokeStyle = '#b87634'; g.lineWidth = 3; g.save(); g.clip();
  for (let i = -60; i < 80; i += 12) { g.beginPath(); g.moveTo(cx + i, base); g.lineTo(cx + i + 60, base + 80); g.stroke(); g.beginPath(); g.moveTo(cx + i, base); g.lineTo(cx + i - 60, base + 80); g.stroke(); }
  g.restore();
  let y = base - r * 0.55;
  order.scoops.forEach((f, i) => {
    g.fillStyle = FLAVORS[f].css; g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 3;
    g.beginPath(); g.arc(cx, y, r, 0, 7); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(cx - r * 0.35, y - r * 0.35, r * 0.25, r * 0.15, -0.6, 0, 7); g.fill();
    if (i < n - 1) y -= r * 1.25;
  });
  const topY = y;
  if (order.sauce) {
    g.fillStyle = SAUCES[order.sauce].css;
    g.beginPath(); g.arc(cx, topY, r * 1.02, Math.PI, 0); g.lineTo(cx + r, topY + 4);
    for (let i = 4; i >= 0; i--) { const x = cx - r + i * r / 2; g.quadraticCurveTo(x + r / 4, topY + 6, x, topY + (i % 2 ? 20 : 10)); }
    g.closePath(); g.fill();
  }
  if (order.toppings.includes('sprinkles')) {
    const cs = ['#ff4f8b', '#ffe14d', '#4fc3ff', '#7be07b', '#b07bff'];
    for (let i = 0; i < 14; i++) { g.save(); g.translate(cx + (Math.random() - .5) * r * 1.5, topY - Math.random() * r * 0.8); g.rotate(Math.random() * 3); g.fillStyle = cs[i % 5]; g.fillRect(-5, -2, 10, 4); g.restore(); }
  }
  if (order.toppings.includes('cherry')) {
    g.fillStyle = '#d8102e'; g.beginPath(); g.arc(cx, topY - r - 6, 11, 0, 7); g.fill();
    g.strokeStyle = '#5a7a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + 2, topY - r - 14); g.quadraticCurveTo(cx + 6, topY - r - 30, cx + 16, topY - r - 32); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(cx - 4, topY - r - 10, 3, 0, 7); g.fill();
  }
}
