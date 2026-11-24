// 3D の部品づくり：素材キット、家のパーツ、家族の人形
import * as THREE from './three.module.min.js';

export const W = 3.4, D = 2.8, H = 2.2, T = 0.12, R = 1.15, BASE = 0.06;
const loader = new THREE.TextureLoader();
const texCache = {};
export function tex(name, rx = 0, ry = rx) {
  const mk = () => { const t = loader.load('tex/' + name + '.jpg'); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
  if (rx) { const t = mk(); t.repeat.set(rx, ry); return t; }
  return texCache[name] || (texCache[name] = mk());
}

export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

// ---------- 形 ----------
export function rbox(w, h, d, r, n = 3) {
  r = Math.max(0.002, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  const S = 2 * n + 1;
  const g = new THREE.BoxGeometry(2, 2, 2, S, S, S);
  const p = g.attributes.position, nr = g.attributes.normal;
  const half = [w / 2, h / 2, d / 2], hi = half.map(v => v - r);
  const v = new THREE.Vector3(), inner = new THREE.Vector3(), dir = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const c = [p.getX(i), p.getY(i), p.getZ(i)].map((x, k) => {
      const a = Math.abs(x), s = Math.sign(x);
      if (a <= 1 / S + 1e-6) return x * S * hi[k];
      const t = (a - 1 / S) / (1 - 1 / S);
      return s * (hi[k] + t * r);
    });
    v.set(c[0], c[1], c[2]);
    inner.set(THREE.MathUtils.clamp(v.x, -hi[0], hi[0]), THREE.MathUtils.clamp(v.y, -hi[1], hi[1]), THREE.MathUtils.clamp(v.z, -hi[2], hi[2]));
    dir.subVectors(v, inner);
    if (dir.lengthSq() < 1e-12) dir.set(nr.getX(i), nr.getY(i), nr.getZ(i));
    dir.normalize();
    v.copy(inner).addScaledVector(dir, r);
    p.setXYZ(i, v.x, v.y, v.z); nr.setXYZ(i, dir.x, dir.y, dir.z);
  }
  return g;
}

// 位置からテクスチャ座標（どの面でも模様がつながる）
export function planarUV(g, scale = 1) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else if (ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv.setXY(i, u * scale, v * scale);
  }
  uv.needsUpdate = true; return g;
}

export function mesh(geo, mat, { cast = true, recv = true } = {}) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; return m;
}

// ---------- 素材キット ----------
function brickTex(palette, seed = 1) {
  let s = seed; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  return canvasTex(512, 512, (x) => {
    x.fillStyle = '#555'; x.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 128 : 0;
      for (let col = -1; col < 3; col++) {
        const bx = col * 256 + off, by = row * 128;
        const c = palette[Math.floor(rnd() * palette.length)];
        x.fillStyle = c; x.fillRect(bx + 4, by + 4, 248, 120);
        x.fillStyle = 'rgba(255,255,255,.28)'; x.fillRect(bx + 4, by + 4, 248, 10); x.fillRect(bx + 4, by + 4, 10, 120);
        x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(bx + 4, by + 114, 248, 10); x.fillRect(bx + 242, by + 4, 10, 120);
        x.fillStyle = 'rgba(255,255,255,.12)';
        for (let k = 0; k < 4; k++) { x.beginPath(); x.ellipse(bx + 40 + k * 60, by + 40, 18, 9, 0, 0, 7); x.fill(); }
      }
    }
  });
}


// 段ボール：平らな茶色にうっすら波目と繊維
let _card = null;
function cardTex() {
  if (_card) return _card;
  _card = canvasTex(512, 512, (x) => {
    x.fillStyle = '#c4935a'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 512; i += 16) { x.fillStyle = 'rgba(90,55,20,.06)'; x.fillRect(i, 0, 7, 512); x.fillStyle = 'rgba(255,230,190,.05)'; x.fillRect(i + 8, 0, 5, 512); }
    for (let i = 0; i < 5000; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(80,50,20,.10)' : 'rgba(255,235,200,.10)'; x.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 3, 1); }
    x.fillStyle = 'rgba(70,40,15,.12)';
    for (let i = 0; i < 6; i++) { x.beginPath(); x.ellipse(Math.random() * 512, Math.random() * 512, 30 + Math.random() * 60, 12 + Math.random() * 20, Math.random() * 3, 0, 7); x.fill(); }
  });
  return _card;
}

export function makeKit(kind) {
  if (kind === 'card') {
    const map = cardTex();
    const wall = new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 0.6, roughness: 0.92, color: 0xffffff });
    const roof = new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 0.6, roughness: 0.92, color: 0xd8b088 });
    const accent = new THREE.MeshStandardMaterial({ map, roughness: 0.9, color: 0xf2dcc0 });
    const tape = new THREE.MeshStandardMaterial({ color: 0xc9a05e, roughness: 0.3, transparent: true, opacity: 0.85 });
    const soft = new THREE.MeshStandardMaterial({ color: 0xf6f1e6, roughness: 0.95 });
    return { kind, wall, roof, accent, tape, soft, r: 0.012, roofT: 0.1, uv: 0.8, studs: false };
  }
  if (kind === 'fluff') {
    const map = tex('fur');
    const mk = (c) => new THREE.MeshPhysicalMaterial({ map, bumpMap: map, bumpScale: 3, color: c, roughness: 1, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xffd6e6) });
    return { kind, wall: mk(0xffd3e2), roof: mk(0xff9fc4), accent: mk(0xffffff), tape: null, soft: mk(0xfff0f6), r: 0.09, roofT: 0.22, uv: 0.9, studs: false };
  }
  const wallT = brickTex(['#e53935', '#fdd835', '#1e88e5', '#43a047', '#fb8c00', '#ffffff'], 7);
  const roofT = brickTex(['#e53935', '#d32f2f', '#f4511e', '#c62828'], 3);
  const plastic = (o) => new THREE.MeshPhysicalMaterial({ roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25, ...o });
  return {
    kind, wall: plastic({ map: wallT }), roof: plastic({ map: roofT }), accent: plastic({ color: 0xfdd835 }),
    tape: null, soft: plastic({ color: 0x1e88e5 }), studCols: [0xe53935, 0xfdd835, 0x1e88e5, 0x43a047],
    r: 0.025, roofT: 0.14, uv: 1, studs: true,
  };
}

function kbox(kit, mat, w, h, d, x, y, z, r = kit.r) {
  const g = rbox(w, h, d, r); g.translate(x, y, z); planarUV(g, kit.uv);
  return mesh(g, mat);
}

// 突起（ブロック用）
const studGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.05, 16);
function studs(kit, grp, x0, x1, y, z, axis = 'x') {
  if (!kit.studs) return;
  const n = Math.max(1, Math.round((x1 - x0) / 0.25));
  for (let i = 0; i < n; i++) {
    const a = x0 + (i + 0.5) * (x1 - x0) / n;
    const m = mesh(studGeo, kit.studMats[i % kit.studMats.length], { cast: false });
    if (axis === 'x') m.position.set(a, y + 0.025, z); else m.position.set(z, y + 0.025, a);
    grp.add(m);
  }
}

// 穴あき壁：x0..x1, 0..h（ローカル）、厚みは z 方向中心
function wallWithHoles(kit, x0, x1, y0, h, holes, mat = kit.wall) {
  const g = new THREE.Group();
  const xs = new Set([x0, x1]);
  holes.forEach(o => { xs.add(o[0]); xs.add(o[1]); });
  const cols = [...xs].sort((a, b) => a - b);
  for (let i = 0; i < cols.length - 1; i++) {
    const a = cols[i], b = cols[i + 1], mid = (a + b) / 2;
    const cut = holes.filter(o => mid > o[0] && mid < o[1]).map(o => [o[2], o[3]]).sort((p, q) => p[0] - q[0]);
    let y = y0;
    const spans = [];
    cut.forEach(([c0, c1]) => { if (c0 > y + 0.01) spans.push([y, c0]); y = Math.max(y, c1); });
    if (y0 + h > y + 0.01) spans.push([y, y0 + h]);
    spans.forEach(([s0, s1]) => g.add(kbox(kit, mat, b - a, s1 - s0, T, (a + b) / 2, (s0 + s1) / 2, 0)));
  }
  if (kit.tape) {
    g.add(mesh(new THREE.BoxGeometry(x1 - x0 + 0.01, 0.07, T + 0.02).translate((x0 + x1) / 2, y0 + h - 0.03, 0), kit.tape, { cast: false }));
  }
  studs(kit, g, x0, x1, y0 + h, 0);
  return g;
}

function windowPiece(kit, w, h) {
  const g = new THREE.Group(), f = 0.08, dpt = T + 0.07;
  g.add(kbox(kit, kit.accent, w, f, dpt, 0, -h / 2 + f / 2, 0, Math.min(kit.r, 0.035)));
  g.add(kbox(kit, kit.accent, w, f, dpt, 0, h / 2 - f / 2, 0, Math.min(kit.r, 0.035)));
  g.add(kbox(kit, kit.accent, f, h, dpt, -w / 2 + f / 2, 0, 0, Math.min(kit.r, 0.035)));
  g.add(kbox(kit, kit.accent, f, h, dpt, w / 2 - f / 2, 0, 0, Math.min(kit.r, 0.035)));
  g.add(kbox(kit, kit.accent, 0.05, h, 0.05, 0, 0, 0, 0.02));
  g.add(kbox(kit, kit.accent, w, 0.05, 0.05, 0, 0, 0, 0.02));
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xd8f0ff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.28, envMapIntensity: 1.5 });
  const gl = mesh(new THREE.PlaneGeometry(w - f, h - f), glass, { cast: false });
  g.add(gl);
  // 小さな植木鉢
  const pot = mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.09, 14), new THREE.MeshStandardMaterial({ color: 0xc8653c, roughness: 0.8 }));
  pot.position.set(w * 0.25, -h / 2 + f + 0.045, dpt / 2 - 0.02); g.add(pot);
  const fl = mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshStandardMaterial({ color: 0xff5f8f, roughness: 0.6 }));
  fl.position.set(w * 0.25, -h / 2 + f + 0.13, dpt / 2 - 0.02); g.add(fl);
  return g;
}

function doorPiece(kit) {
  const g = new THREE.Group(), w = 0.86, h = 1.86;
  g.add(kbox(kit, kit.accent, w, h, 0.07, w / 2, h / 2, 0, Math.min(kit.r, 0.03)));
  const knob = mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf0c040, metalness: 0.8, roughness: 0.25 }));
  knob.position.set(w - 0.12, 0.95, 0.07); g.add(knob);
  const win = mesh(new THREE.CircleGeometry(0.14, 24), new THREE.MeshPhysicalMaterial({ color: 0xd8f0ff, roughness: 0.05, transparent: true, opacity: 0.5 }), { cast: false });
  win.position.set(w / 2, 1.45, 0.04); g.add(win);
  return g;
}

function roofPiece(kit) {
  const g = new THREE.Group();
  const a = Math.atan2(R, D / 2), over = 0.35, rt = kit.roofT;
  const L = (D / 2 + over) / Math.cos(a);
  for (const s of [1, -1]) {
    const geo = rbox(W + 0.5, rt, L, kit.r);
    planarUV(geo, kit.uv);
    const m = mesh(geo, kit.roof);
    m.rotation.x = s * a;
    m.position.set(0, H + R - (L / 2) * Math.sin(a) + rt / 2, s * (L / 2) * Math.cos(a));
    g.add(m);
    if (kit.studs) {
      for (let i = 0; i < 12; i++) {
        const st = mesh(studGeo, kit.studMats[i % 4], { cast: false });
        st.position.set(-W / 2 + 0.1 + i * (W + 0.3) / 12, rt / 2 + 0.02, L * 0.25);
        m.add(st);
      }
    }
    if (kit.tape) {
      const tp = mesh(new THREE.BoxGeometry(W + 0.52, rt + 0.02, 0.08), kit.tape, { cast: false });
      tp.position.set(0, 0, -L / 2 + 0.03); m.add(tp);
    }
  }
  // 妻壁（三角）
  const sh = new THREE.Shape(); sh.moveTo(-D / 2, 0); sh.lineTo(D / 2, 0); sh.lineTo(0, R); sh.closePath();
  for (const s of [1, -1]) {
    const geo = new THREE.ExtrudeGeometry(sh, { depth: T, bevelEnabled: false });
    geo.rotateY(Math.PI / 2); geo.translate(s > 0 ? W / 2 - T : -W / 2, H, 0);
    planarUV(geo, kit.uv);
    g.add(mesh(geo, kit.wall));
  }
  // 丸窓（妻壁の飾り）
  const ring = mesh(new THREE.TorusGeometry(0.17, 0.04, 10, 28), kit.accent);
  ring.rotation.y = Math.PI / 2; ring.position.set(W / 2 + 0.01, H + 0.42, 0); g.add(ring);
  // 煙突
  const ch = kbox(kit, kit.roof, 0.34, 0.75, 0.34, 0.9, H + R - 0.05, -0.45, Math.min(kit.r, 0.06));
  g.add(ch);
  return g;
}

function bedPiece(kit) {
  const g = new THREE.Group();
  g.add(kbox(kit, kit.wall, 0.9, 0.28, 1.6, 0, 0.14, 0));
  g.add(kbox(kit, kit.wall, 0.9, 0.75, 0.1, 0, 0.375, -0.78));
  g.add(kbox(kit, kit.soft, 0.84, 0.13, 1.5, 0, 0.34, 0.02, Math.max(kit.r, 0.05)));
  g.add(kbox(kit, kit.accent, 0.55, 0.12, 0.28, 0, 0.45, -0.55, 0.06));
  g.add(kbox(kit, kit.roof, 0.88, 0.06, 0.85, 0, 0.43, 0.32, Math.max(kit.r, 0.03)));
  return g;
}
function tablePiece(kit) {
  const g = new THREE.Group();
  g.add(kbox(kit, kit.accent, 0.95, 0.08, 0.65, 0, 0.6, 0));
  for (const [x, z] of [[-0.38, -0.25], [0.38, -0.25], [-0.38, 0.25], [0.38, 0.25]]) g.add(kbox(kit, kit.wall, 0.1, 0.58, 0.1, x, 0.29, z, Math.min(kit.r, 0.045)));
  // コップとお皿
  const cup = mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 16), new THREE.MeshStandardMaterial({ color: 0x64b5f6, roughness: 0.4 }));
  cup.position.set(0.2, 0.69, 0.05); g.add(cup);
  const plate = mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.02, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
  plate.position.set(-0.15, 0.65, 0); g.add(plate);
  const ap = mesh(new THREE.SphereGeometry(0.05, 14, 10), new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.4 }));
  ap.position.set(-0.15, 0.7, 0); g.add(ap);
  return g;
}
function chairPiece(kit) {
  const g = new THREE.Group();
  g.add(kbox(kit, kit.accent, 0.48, 0.08, 0.46, 0, 0.38, 0));
  g.add(kbox(kit, kit.accent, 0.48, 0.5, 0.08, 0, 0.66, -0.2));
  for (const [x, z] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) g.add(kbox(kit, kit.wall, 0.07, 0.36, 0.07, x, 0.18, z, Math.min(kit.r, 0.03)));
  return g;
}

// ピース定義：target は house グループ（front 系は frontHinge）のローカル
export const DOOR_X0 = -1.25, WIN_X = [0.35, 1.25], WIN_Y = [0.95, 1.75];
export function makePieces(kit) {
  kit.studMats = (kit.studCols || [0xffffff]).map(c => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 0.6 }));
  if (kit.kind === 'blocks') kit.accent = kit.studMats[1];
  const P = [];
  const add = (id, group, parent, pos, rotY = 0, extra = {}) => P.push({ id, group, parent, pos: new THREE.Vector3(...pos), rotY, ...extra });
  add('back', wallWithHoles(kit, -W / 2, W / 2, 0, H, []), 'house', [0, 0, -D / 2 + T / 2]);
  add('left', wallWithHoles(kit, -D / 2 + T, D / 2 - T, 0, H, []), 'house', [-W / 2 + T / 2, 0, 0], Math.PI / 2);
  add('right', wallWithHoles(kit, -D / 2 + T, D / 2 - T, 0, H, [[-0.45, 0.45, WIN_Y[0], WIN_Y[1]]]), 'house', [W / 2 - T / 2, 0, 0], -Math.PI / 2);
  add('front', wallWithHoles(kit, -W / 2, W / 2, -T / 2, H, [[DOOR_X0, DOOR_X0 + 0.9, -T / 2, 1.9 - T / 2], [WIN_X[0], WIN_X[1], WIN_Y[0] - T / 2, WIN_Y[1] - T / 2]]), 'front', [0, 0, 0]);
  add('roof', roofPiece(kit), 'house', [0, 0, 0]);
  add('win1', windowPiece(kit, 0.9, 0.8), 'front', [(WIN_X[0] + WIN_X[1]) / 2, (WIN_Y[0] + WIN_Y[1]) / 2 - T / 2, 0]);
  add('win2', windowPiece(kit, 0.9, 0.8), 'house', [W / 2 - T / 2, (WIN_Y[0] + WIN_Y[1]) / 2, 0], Math.PI / 2);
  add('door', doorPiece(kit), 'front', [DOOR_X0 + 0.02, -T / 2 + 0.02, 0]);
  add('bed', bedPiece(kit), 'house', [-0.75, 0, -0.76], Math.PI / 2, { furniture: true });
  add('table', tablePiece(kit), 'house', [0.8, 0, -0.2], 0, { furniture: true });
  add('chair', chairPiece(kit), 'house', [0.8, 0, -0.85], 0, { furniture: true });
  return P;
}

// 素材の山
export function makePile(kind) {
  const g = new THREE.Group();
  let s = kind.length * 17; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  if (kind === 'card') {
    const kit = makeKit('card');
    const spots = [[-0.3, 0, 0.1, 0.55, 0.42, 0.5], [0.32, 0, -0.05, 0.6, 0.5, 0.48], [0.0, 0.46, 0.0, 0.5, 0.36, 0.42], [-0.05, 0, 0.45, 0.4, 0.3, 0.35], [0.5, 0, 0.4, 0.35, 0.25, 0.3], [0.02, 0.82, 0.05, 0.32, 0.26, 0.3]];
    spots.forEach(([x, y, z, w, h, d]) => {
      const b = kbox(kit, kit.wall, w, h, d, 0, 0, 0); b.position.set(x, y + h / 2, z); b.rotation.y = (rnd() - 0.5) * 0.6; g.add(b);
      const tp = mesh(new THREE.BoxGeometry(w + 0.01, 0.012, 0.08), kit.tape, { cast: false }); tp.position.y = h / 2; b.add(tp);
    });
  } else if (kind === 'fluff') {
    const kit = makeKit('fluff');
    const mats = [kit.wall, kit.roof, kit.accent, kit.soft];
    const spots = [[-0.3, 0.22, 0.1, 0.3], [0.3, 0.22, 0, 0.32], [0, 0.22, 0.4, 0.26], [0, 0.55, 0.05, 0.28], [-0.4, 0.18, -0.3, 0.22], [0.42, 0.2, 0.42, 0.2], [0.15, 0.82, 0.05, 0.2]];
    spots.forEach(([x, y, z, r], i) => {
      const b = mesh(new THREE.SphereGeometry(r, 28, 18), mats[i % 4]); b.scale.set(1.25, 0.8, 1.1);
      planarUV(b.geometry, 2.5); b.position.set(x, y, z); g.add(b);
    });
  } else {
    const cols = [0xe53935, 0xfdd835, 0x1e88e5, 0x43a047, 0xfb8c00];
    const spots = [[-0.3, 0, 0.1], [0.27, 0, 0.1], [0, 0, 0.45], [-0.05, 0.27, 0.15], [0.2, 0.27, 0.2], [0.05, 0.54, 0.15], [0.5, 0, 0.5], [-0.5, 0, -0.25]];
    spots.forEach(([x, y, z], i) => {
      const m = new THREE.MeshPhysicalMaterial({ color: cols[i % 5], roughness: 0.3, clearcoat: 0.6 });
      const b = mesh(rbox(0.5, 0.25, 0.25, 0.025), m); b.position.set(x, y + 0.125, z); b.rotation.y = (rnd() - 0.5) * 1.2; g.add(b);
      for (const sx of [-0.125, 0.125]) { const st = mesh(studGeo, m, { cast: false }); st.position.set(sx, 0.15, 0); b.add(st); }
    });
  }
  return g;
}

// ---------- 顔 ----------
const faceCache = {};
export function faceTex(expr, kind = 'kid') {
  const key = expr + kind;
  if (faceCache[key]) return faceCache[key];
  const t = canvasTex(256, 256, (x) => {
    x.lineCap = 'round'; x.lineJoin = 'round';
    const eyeY = 112, ex = 44, my = 172;
    const dark = '#2a1d17';
    // ほっぺ
    x.fillStyle = 'rgba(255,110,120,.32)';
    for (const s of [-1, 1]) { x.beginPath(); x.ellipse(128 + s * 66, 156, 22, 14, 0, 0, 7); x.fill(); }
    const eye = (cx, sc = 1) => {
      x.fillStyle = dark; x.beginPath(); x.ellipse(cx, eyeY, 13 * sc, 17 * sc, 0, 0, 7); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(cx + 4 * sc, eyeY - 6 * sc, 4.5 * sc, 0, 7); x.fill();
      if (kind === 'kid') { x.strokeStyle = dark; x.lineWidth = 3; x.beginPath(); x.moveTo(cx - 14 * sc, eyeY - 12 * sc); x.lineTo(cx - 20 * sc, eyeY - 18 * sc); x.moveTo(cx + 14 * sc, eyeY - 12 * sc); x.lineTo(cx + 20 * sc, eyeY - 18 * sc); x.stroke(); }
    };
    const happyEye = (cx) => { x.strokeStyle = dark; x.lineWidth = 7; x.beginPath(); x.arc(cx, eyeY + 8, 14, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); };
    const brow = (cx, dy = 0, tilt = 0) => { x.strokeStyle = kind === 'kid' ? '#5a3a28' : '#3a2a20'; x.lineWidth = kind === 'kid' ? 5 : 8; x.beginPath(); x.moveTo(cx - 14, eyeY - 32 + dy - tilt); x.lineTo(cx + 14, eyeY - 32 + dy + tilt); x.stroke(); };
    x.strokeStyle = '#6a2a24'; x.fillStyle = '#7a2626';
    if (expr === 'smile') {
      eye(128 - ex); eye(128 + ex); brow(128 - ex); brow(128 + ex);
      x.lineWidth = 6; x.strokeStyle = '#7a2a24'; x.beginPath(); x.arc(128, my - 14, 22, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke();
    } else if (expr === 'laugh') {
      happyEye(128 - ex); happyEye(128 + ex); brow(128 - ex, -4); brow(128 + ex, -4);
      x.beginPath(); x.moveTo(100, my - 8); x.quadraticCurveTo(128, my + 40, 156, my - 8); x.closePath(); x.fill();
      x.fillStyle = '#ff8a95'; x.beginPath(); x.ellipse(128, my + 10, 13, 7, 0, 0, 7); x.fill();
    } else if (expr === 'are') {
      eye(128 - ex, 0.9); eye(128 + ex, 1.1); brow(128 - ex, 4, 3); brow(128 + ex, -10, -3);
      x.lineWidth = 6; x.strokeStyle = '#7a2a24'; x.beginPath(); x.moveTo(114, my); x.quadraticCurveTo(124, my - 6, 132, my); x.quadraticCurveTo(140, my + 6, 146, my - 2); x.stroke();
    } else if (expr === 'wow') {
      eye(128 - ex, 1.25); eye(128 + ex, 1.25); brow(128 - ex, -10); brow(128 + ex, -10);
      x.beginPath(); x.ellipse(128, my, 14, 18, 0, 0, 7); x.fill();
    } else if (expr === 'sleep') {
      x.strokeStyle = dark; x.lineWidth = 6;
      for (const s of [-1, 1]) { x.beginPath(); x.arc(128 + s * ex, eyeY - 4, 13, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke(); }
      x.fillStyle = '#7a2626'; x.beginPath(); x.ellipse(128, my - 2, 7, 8, 0, 0, 7); x.fill();
    } else if (expr === 'oops') {
      x.strokeStyle = dark; x.lineWidth = 7;
      for (const s of [-1, 1]) { const cx = 128 + s * ex; x.beginPath(); x.moveTo(cx - 12 * s, eyeY - 12); x.lineTo(cx + 10 * s, eyeY); x.lineTo(cx - 12 * s, eyeY + 12); x.stroke(); }
      x.lineWidth = 6; x.strokeStyle = '#7a2a24'; x.beginPath(); x.moveTo(104, my - 2);
      for (let i = 0; i < 4; i++) x.quadraticCurveTo(110 + i * 12, my + (i % 2 ? 8 : -8), 116 + i * 12, my - 2);
      x.stroke();
      x.fillStyle = '#7fd0ff'; x.beginPath(); x.moveTo(206, 70); x.quadraticCurveTo(190, 100, 206, 106); x.quadraticCurveTo(222, 100, 206, 70); x.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  faceCache[key] = t; return t;
}

// ---------- 人 ----------
const SKIN = 0xf3c9a8;
function std(c, r = 0.75) { return new THREE.MeshStandardMaterial({ color: c, roughness: r }); }

export class Person {
  constructor(o) {
    this.o = o; this.kind = o.kind;
    const kid = o.kid, Ht = o.height;
    this.height = Ht;
    const legL = Ht * (kid ? 0.4 : 0.47), torsoL = Ht * (kid ? 0.3 : 0.32), headR = Ht * (kid ? 0.118 : 0.076);
    const legR = Ht * (kid ? 0.045 : 0.04), torR = Ht * (kid ? 0.1 : 0.085), armR = Ht * (kid ? 0.033 : 0.03);
    const armL = Ht * (kid ? 0.32 : 0.36);
    Object.assign(this, { legL, torsoL, headR, legR, torR, armR, armL });
    const skin = std(SKIN, 0.6), shirt = std(o.shirt), pants = std(o.pants), shoe = std(o.shoe || 0x333333, 0.5);
    this.mats = { shirt };
    const g = this.g = new THREE.Group();
    const hips = this.hips = new THREE.Group(); hips.position.y = legL; g.add(hips);
    this.legs = [];
    for (const s of [-1, 1]) {
      const p = new THREE.Group(); p.position.x = s * torR * 0.5; hips.add(p);
      const l = mesh(new THREE.CapsuleGeometry(legR, legL - legR * 2, 4, 10), o.dress ? skin : pants); l.position.y = -legL / 2 + legR * 0.3; p.add(l);
      const sh = mesh(rbox(legR * 2.4, legR * 1.6, legR * 3.6, legR * 0.7), shoe); sh.position.set(0, -legL + legR * 0.8, legR * 0.7); p.add(sh);
      this.legs.push(p);
    }
    const body = this.body = new THREE.Group(); hips.add(body);
    const tor = mesh(new THREE.CapsuleGeometry(torR, torsoL - torR, 6, 14), shirt); tor.scale.set(1.15, 1, 0.8); tor.position.y = torsoL / 2; body.add(tor);
    if (o.dress || o.skirt) {
      const len = o.dress ? legL * 0.75 : legL * 0.42;
      const sk = mesh(new THREE.CylinderGeometry(torR * 1.05, torR * 1.9, len, 20, 1, true), std(o.dress || o.skirt));
      sk.material.side = THREE.DoubleSide; sk.position.y = -len / 2 + torR * 0.6; body.add(sk);
    } else {
      const pv = mesh(new THREE.SphereGeometry(torR * 1.02, 16, 10), pants); pv.scale.set(1.15, 0.6, 0.82); pv.position.y = torR * 0.15; body.add(pv);
    }
    const neck = mesh(new THREE.CylinderGeometry(headR * 0.35, headR * 0.4, headR * 0.6, 10), skin); neck.position.y = torsoL + headR * 0.05; body.add(neck);
    const head = this.head = new THREE.Group(); head.position.y = torsoL + headR * 0.95; body.add(head);
    head.add(mesh(new THREE.SphereGeometry(headR, 32, 20), skin));
    // 鼻と耳
    const nose = mesh(new THREE.SphereGeometry(headR * 0.1, 10, 8), skin); nose.position.set(0, -headR * 0.12, headR * 0.98); head.add(nose);
    for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(headR * 0.2, 10, 8), skin); e.scale.set(0.5, 1, 0.8); e.position.set(s * headR * 0.98, -headR * 0.05, 0); head.add(e); }
    const faceGeo = new THREE.SphereGeometry(headR * 1.012, 24, 16, Math.PI / 2 - 0.8, 1.6, Math.PI / 2 - 0.8, 1.6);
    this.faceMat = new THREE.MeshStandardMaterial({ map: faceTex('smile', kid ? 'kid' : 'adult'), transparent: true, roughness: 0.6, depthWrite: false });
    const face = new THREE.Mesh(faceGeo, this.faceMat); face.renderOrder = 2; head.add(face);
    this.addHair(o, headR);
    this.arms = [];
    for (const s of [-1, 1]) {
      const p = new THREE.Group(); p.position.set(s * (torR * 1.15 + armR * 0.6), torsoL - armR * 0.5, 0); body.add(p);
      const a = mesh(new THREE.CapsuleGeometry(armR, armL - armR * 2, 4, 10), o.longSleeve ? shirt : skin); a.position.y = -armL / 2 + armR; p.add(a);
      const sl = mesh(new THREE.CapsuleGeometry(armR * 1.25, armL * 0.25, 4, 10), shirt); sl.position.y = -armL * 0.18; p.add(sl);
      const hand = new THREE.Group(); hand.position.y = -armL + armR * 0.5; p.add(hand);
      hand.add(mesh(new THREE.SphereGeometry(armR * 1.35, 12, 10), skin));
      p.hand = hand; p.side = s; p.rotation.z = s * 0.12;
      this.arms.push(p);
    }
    this.st = { walk: 0, armX: [0, 0], armZ: [0, 0], cheer: false, pose: 'stand', look: 0 };
    this.wa = 0; this.phase = 0; this.t = Math.random() * 10; this.jy = 0; this.jv = 0; this.sitK = 0; this.lieK = 0;
    this.baseFace = 'smile'; this.faceTimer = 0; this.tilt = 0;
  }
  addHair(o, r) {
    const hm = new THREE.MeshStandardMaterial({ color: o.hair, roughness: 0.55 });
    const cap = (tStart, tLen, pStart = 0, pLen = Math.PI * 2, sc = 1.07) => {
      const m = mesh(new THREE.SphereGeometry(r * sc, 28, 16, pStart, pLen, tStart, tLen), hm); m.material.side = THREE.DoubleSide; this.head.add(m); return m;
    };
    const back = Math.PI * 1.5;
    if (o.hairStyle === 'pigtails' || o.hairStyle === 'long') {
      cap(0, Math.PI * 0.32);
      cap(0, Math.PI * 0.72, back - 1.75, 3.5, 1.06);
      if (o.hairStyle === 'pigtails') {
        for (const s of [-1, 1]) {
          const pt = mesh(new THREE.SphereGeometry(r * 0.42, 16, 12), hm); pt.scale.set(0.75, 1.25, 0.75); pt.position.set(s * r * 1.08, -r * 0.35, -r * 0.35); this.head.add(pt);
          const tie = mesh(new THREE.TorusGeometry(r * 0.2, r * 0.07, 8, 16), std(0xff4f8b, 0.4)); tie.rotation.x = Math.PI / 2; tie.position.set(s * r * 1.0, r * 0.05, -r * 0.3); this.head.add(tie);
        }
      } else {
        const lh = mesh(new THREE.CapsuleGeometry(r * 0.75, r * 1.3, 6, 14), hm); lh.scale.set(1.25, 1, 0.55); lh.position.set(0, -r * 0.95, -r * 0.45); this.head.add(lh);
      }
      // 前髪
      const bang = mesh(new THREE.SphereGeometry(r * 1.08, 24, 10, Math.PI / 2 - 0.9, 1.8, 0.18 * Math.PI, 0.17 * Math.PI), hm); bang.material.side = THREE.DoubleSide; this.head.add(bang);
    } else {
      cap(0, Math.PI * 0.3, 0, Math.PI * 2, 1.06);
      cap(0, Math.PI * 0.58, back - 1.6, 3.2, 1.05);
    }
  }
  setFace(expr, dur = 0) {
    this.faceMat.map = faceTex(expr, this.o.kid ? 'kid' : 'adult'); this.faceMat.needsUpdate = true;
    this.curFace = expr; this.faceTimer = dur;
  }
  jump(v = 2.6) { if (this.jy <= 0.001) this.jv = v; }
  worldTop(out = new THREE.Vector3()) { return this.head.getWorldPosition(out); }
  center(out = new THREE.Vector3()) { this.body.getWorldPosition(out); out.y += this.torsoL * 0.4; return out; }
  update(dt) {
    this.t += dt; const s = this.st;
    if (this.faceTimer > 0) { this.faceTimer -= dt; if (this.faceTimer <= 0) this.setFace(this.baseFace); }
    this.wa += ((s.walk ? 1 : 0) - this.wa) * Math.min(1, dt * 8);
    this.phase += dt * 10 * this.wa;
    const sitT = s.pose === 'sit' ? 1 : 0, lieT = s.pose === 'lie' ? 1 : 0;
    this.sitK += (sitT - this.sitK) * Math.min(1, dt * 8);
    this.lieK += (lieT - this.lieK) * Math.min(1, dt * 8);
    const sw = Math.sin(this.phase) * 0.65 * this.wa;
    const legSit = -1.45 * Math.max(this.sitK, this.lieK * 0);
    this.legs[0].rotation.x = sw + legSit; this.legs[1].rotation.x = -sw + legSit;
    this.hips.position.y = this.legL - (this.legL - (s.seatH || 0.4)) * this.sitK;
    this.g.rotation.z = Math.PI / 2 * this.lieK;
    for (let i = 0; i < 2; i++) {
      const a = this.arms[i];
      let tx = s.armX[i] - (i ? sw : -sw) * 0.8, tz = a.side * 0.12 + s.armZ[i] * a.side;
      if (s.cheer) { tx = -2.7 + Math.sin(this.t * 12 + i) * 0.25; tz = a.side * 0.35; }
      if (this.sitK > 0.5 && !s.cheer && !s.armX[i]) tx = -0.5;
      a.rotation.x += (tx - a.rotation.x) * Math.min(1, dt * 12);
      a.rotation.z += (tz - a.rotation.z) * Math.min(1, dt * 12);
    }
    this.tilt += ((this.curFace === 'are' ? 0.28 : 0) - this.tilt) * Math.min(1, dt * 8);
    this.head.rotation.z = this.tilt + Math.sin(this.t * 1.3) * 0.03;
    this.head.rotation.y = s.look || 0;
    this.body.scale.y = 1 + Math.sin(this.t * 2.2) * 0.012;
    if (this.jv !== 0 || this.jy > 0) {
      this.jy += this.jv * dt; this.jv -= 9.8 * dt;
      if (this.jy <= 0) { this.jy = 0; this.jv = 0; }
    }
    this.g.position.y = (s.baseY || 0) + this.jy;
  }
}

// 子犬
export class Dog {
  constructor() {
    const g = this.g = new THREE.Group();
    const fur = std(0xe9c48e, 0.85), dark = std(0x8a5a32, 0.8), blk = std(0x161616, 0.3);
    const body = this.body = new THREE.Group(); g.add(body);
    const tor = mesh(new THREE.CapsuleGeometry(0.13, 0.28, 6, 14), fur); tor.rotation.x = Math.PI / 2; tor.position.y = 0.28; body.add(tor);
    const head = this.head = new THREE.Group(); head.position.set(0, 0.46, 0.22); body.add(head);
    head.add(mesh(new THREE.SphereGeometry(0.12, 20, 14), fur));
    const sn = mesh(new THREE.SphereGeometry(0.065, 14, 10), std(0xf6e2c2)); sn.scale.set(1, 0.8, 1.2); sn.position.set(0, -0.03, 0.1); head.add(sn);
    const nose = mesh(new THREE.SphereGeometry(0.025, 10, 8), blk); nose.position.set(0, -0.01, 0.18); head.add(nose);
    for (const s of [-1, 1]) {
      const e = mesh(new THREE.SphereGeometry(0.022, 10, 8), blk); e.position.set(s * 0.05, 0.03, 0.105); head.add(e);
      const ear = mesh(new THREE.SphereGeometry(0.06, 12, 8), dark); ear.scale.set(0.5, 1.2, 0.9); ear.position.set(s * 0.11, 0.0, -0.01); ear.rotation.z = s * 0.3; head.add(ear);
    }
    this.legs = [];
    for (const [x, z] of [[-0.08, 0.14], [0.08, 0.14], [-0.08, -0.14], [0.08, -0.14]]) {
      const p = new THREE.Group(); p.position.set(x, 0.22, z); body.add(p);
      const l = mesh(new THREE.CapsuleGeometry(0.035, 0.14, 4, 8), fur); l.position.y = -0.11; p.add(l);
      this.legs.push(p);
    }
    const tail = this.tail = new THREE.Group(); tail.position.set(0, 0.34, -0.2); body.add(tail);
    const tl = mesh(new THREE.CapsuleGeometry(0.025, 0.12, 4, 8), dark); tl.position.y = 0.07; tail.add(tl); tail.rotation.x = -0.6;
    this.st = { walk: 0, pose: 'stand' }; this.t = 0; this.wa = 0; this.jy = 0; this.jv = 0; this.wag = 1; this.spin = 0; this.height = 0.6;
  }
  setFace() {}
  jump(v = 2.4) { if (this.jy <= 0.001) this.jv = v; }
  center(out = new THREE.Vector3()) { return this.body.getWorldPosition(out).add(new THREE.Vector3(0, 0.3, 0)); }
  update(dt) {
    this.t += dt;
    this.wa += ((this.st.walk ? 1 : 0) - this.wa) * Math.min(1, dt * 8);
    const sw = Math.sin(this.t * 14) * 0.6 * this.wa;
    this.legs.forEach((l, i) => l.rotation.x = (i === 0 || i === 3 ? sw : -sw));
    this.tail.rotation.z = Math.sin(this.t * (10 + this.wag * 8)) * 0.6;
    const lie = this.st.pose === 'lie' || this.st.pose === 'sit';
    this.body.position.y += ((lie ? -0.12 : 0) - this.body.position.y) * Math.min(1, dt * 8);
    this.head.rotation.x = Math.sin(this.t * 1.7) * 0.08;
    if (this.spin > 0) { const d = Math.min(this.spin, dt * 9); this.spin -= d; this.g.rotation.y += d; }
    if (this.jv !== 0 || this.jy > 0) { this.jy += this.jv * dt; this.jv -= 9.8 * dt; if (this.jy <= 0) { this.jy = 0; this.jv = 0; } }
    this.g.position.y = (this.st.baseY || 0) + this.jy;
  }
}
