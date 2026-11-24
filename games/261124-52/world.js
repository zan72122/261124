import * as THREE from './three.module.min.js';
import { tex, cbBox, cbMat, carton, cbPanel, shadow, mat, fabric, colorTape, tapeMat, drawNoSign, drawCandy } from './models.js';

function ctex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function decal(w, h, t, o = {}) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, ...o }));
}

// ---------- 空のドーム ----------
export function skyDome(top = 0x3f86d6, horizon = 0xd8ecff, r = 900) {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, hor: { value: new THREE.Color(horizon) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float h = clamp(vP.y,-0.2,1.0); vec3 c = mix(hor, top, pow(max(h,0.0),0.55)); if(h<0.0) c = hor; gl_FragColor = vec4(c,1.0); }',
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), m); s.renderOrder = -10; return s;
}
const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xc8d6e6, emissiveIntensity: 0.45 });
export function cloud(size = 1) {
  const g = new THREE.Group();
  const n = 6 + Math.floor(Math.random() * 5);
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), cloudMat);
    const r = (0.6 + Math.random() * 0.7) * size;
    s.scale.set(r, r * 0.75, r);
    s.position.set((Math.random() - 0.5) * 3 * size, (Math.random() - 0.3) * 0.6 * size, (Math.random() - 0.5) * 1.6 * size);
    g.add(s);
  }
  return g;
}

// ---------- 庭 ----------
export function buildGarden(scene) {
  const G = new THREE.Group(); scene.add(G);
  scene.add(skyDome());
  const grass = tex.grass.clone(); grass.needsUpdate = true; grass.repeat.set(30, 30);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95, color: 0xdfe8d0 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; G.add(ground);
  // 家の壁とデッキ
  const sid = tex.siding.clone(); sid.needsUpdate = true; sid.repeat.set(12, 8);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(34, 7, 0.4), new THREE.MeshStandardMaterial({ map: sid, roughness: 0.85 }));
  wall.position.set(-2, 3.5, -10.2); shadow(wall); G.add(wall);
  const glass = new THREE.MeshStandardMaterial({ color: 0x1d2b36, roughness: 0.05, metalness: 0.8 });
  const frameM = mat(0xffffff, { roughness: 0.5 });
  for (const x of [-12, -7, 3, 8]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 0.12), frameM); f.position.set(x, 3.6, -9.98); G.add(f);
    const gl = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.9, 0.13), glass); gl.position.set(x, 3.6, -9.97); G.add(gl);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.9, 0.15), frameM); bar.position.set(x, 3.6, -9.96); G.add(bar);
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.6, 0.12), glass); door.position.set(-2, 1.65, -9.97); G.add(door);
  const df = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.8, 0.1), frameM); df.position.set(-2, 1.65, -10.0); G.add(df);
  const deckT = tex.deck.clone(); deckT.needsUpdate = true; deckT.repeat.set(8, 2);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(30, 0.3, 3.2), new THREE.MeshStandardMaterial({ map: deckT, roughness: 0.8 }));
  deck.position.set(-2, 0.15, -8.4); shadow(deck); G.add(deck);
  // フェンス
  const fT = tex.fence.clone(); fT.needsUpdate = true; fT.repeat.set(16, 1);
  const fm = new THREE.MeshStandardMaterial({ map: fT, roughness: 0.9 });
  for (const [x, z, w, ry] of [[-2, 16, 40, 0], [18, 3, 26, Math.PI / 2], [-22, 3, 26, Math.PI / 2]]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, 1.5, 0.08), fm); f.position.set(x, 0.75, z); f.rotation.y = ry; shadow(f); G.add(f);
  }
  // 木
  const trunkM = mat(0x6b4a2e, { roughness: 0.95 }), leafM = new THREE.MeshStandardMaterial({ color: 0x4c7f35, roughness: 0.9 });
  for (const [x, z, s] of [[-17, -5, 1.2], [14, -6, 1.4], [15, 11, 1.1], [-18, 12, 1.0], [11, -8.5, 0.8]]) {
    const t = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.28 * s, 3 * s, 10), trunkM); tr.position.y = 1.5 * s; t.add(tr);
    for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry((1 + Math.random() * 0.6) * s, 14, 10), leafM); l.position.set((Math.random() - 0.5) * 2 * s, (3.2 + Math.random() * 1.5) * s, (Math.random() - 0.5) * 2 * s); t.add(l); }
    t.position.set(x, 0, z); shadow(t); G.add(t);
  }
  // 段ボールの滑走路
  for (let i = 0; i < 9; i++) {
    const sh = cbBox(1.3, 0.012, 2.0, i % 2 ? 0xffffff : 0xeeddcc); sh.position.set(-1 + i * 1.32, 0.006, 0); sh.rotation.y = (Math.random() - 0.5) * 0.04; sh.receiveShadow = true; sh.castShadow = false; G.add(sh);
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.003, 0.08), colorTape(0xffffff)); dash.position.set(-1 + i * 1.32, 0.014, 0); G.add(dash);
  }
  // 段ボールの管制塔
  const tower = new THREE.Group();
  const t1 = carton(0.8, 0.8, 0.8, 0xffffff); tower.add(t1);
  const t2 = carton(0.7, 0.7, 0.7, 0xf0e0d0); t2.position.y = 0.8; t2.rotation.y = 0.2; tower.add(t2);
  const t3 = cbBox(0.9, 0.5, 0.9, 0xffffff); t3.position.y = 1.75; tower.add(t3);
  for (let i = 0; i < 4; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshStandardMaterial({ color: 0x6fb6e8, roughness: 0.1, metalness: 0.3 })); w.position.set(Math.sin(i * Math.PI / 2) * 0.452, 1.78, Math.cos(i * Math.PI / 2) * 0.452); w.rotation.y = i * Math.PI / 2; tower.add(w); }
  const t4 = cbBox(1.05, 0.04, 1.05, 0xddccbb); t4.position.y = 2.02; tower.add(t4);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5), mat(0xdddddd)); ant.position.y = 2.3; tower.add(ant);
  const antB = new THREE.Mesh(new THREE.SphereGeometry(0.05), mat(0xff3030, { emissive: 0xff2020, emissiveIntensity: 0.8 })); antB.position.y = 2.55; tower.add(antB);
  tower.position.set(-4.6, 0, -3.2); shadow(tower); G.add(tower);
  // 段ボールの山
  const piles = [[-9.5, -6.5], [-11, -5.2], [6, -7], [7.2, -6.2], [-3.5, -7.3], [9, 4], [-8.8, 5.6], [4.6, -4.2]];
  for (const [x, z] of piles) {
    const n = 1 + Math.floor(Math.random() * 3);
    let y = 0;
    for (let i = 0; i < n; i++) {
      const w = 0.5 + Math.random() * 0.5, h = 0.35 + Math.random() * 0.35, d = 0.4 + Math.random() * 0.4;
      const c = carton(w, h, d, [0xffffff, 0xf2e4d4, 0xe8d8c8][i % 3]);
      c.position.set(x + (Math.random() - 0.5) * 0.2, y, z + (Math.random() - 0.5) * 0.2); c.rotation.y = Math.random() * 0.6 - 0.3; G.add(c); y += h;
    }
  }
  // 遠くの雲
  for (let i = 0; i < 9; i++) { const c = cloud(6 + Math.random() * 5); c.position.set(-200 + i * 50, 60 + Math.random() * 40, -380 + Math.random() * 60); G.add(c); }
  return G;
}

// ---------- 段ボール飛行機 ----------
const WINX = [-2.1, -1.4, -0.7, 0.0];
export function buildPlane() {
  const P = new THREE.Group();
  const body = new THREE.Group(); P.add(body);
  // 側面
  const outline = () => {
    const s = new THREE.Shape();
    s.moveTo(-2.3, 0.12); s.lineTo(1.8, 0.12); s.lineTo(1.8, 0.78); s.lineTo(0.9, 0.78); s.lineTo(0.75, 1.24); s.lineTo(-2.3, 1.24); s.lineTo(-2.3, 0.12);
    for (const x of WINX) { const h = new THREE.Path(); h.absarc(x, 1.0, 0.15, 0, Math.PI * 2, true); s.holes.push(h); }
    return s;
  };
  const near = new THREE.Group(); body.add(near);
  const farWall = cbPanel(outline(), 0.014); farWall.position.z = -0.6; body.add(farWall);
  const nearWall = cbPanel(outline(), 0.014); nearWall.position.z = 0.586; near.add(nearWall);
  // 窓のふち（白い紙）
  const rimM = mat(0xffffff, { roughness: 0.7 });
  for (const z of [-0.607, 0.607]) for (const x of WINX) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 8, 28), rimM); r.position.set(x, 1.0, z); (z > 0 ? near : body).add(r);
  }
  const floor = cbBox(4.1, 0.014, 1.2); floor.position.set(-0.25, 0.12, 0); body.add(floor);
  const roof = cbBox(3.05, 0.014, 1.214); roof.position.set(-0.775, 1.245, 0); body.add(roof);
  const back = cbBox(0.014, 1.13, 1.2); back.position.set(-2.3, 0.68, 0); body.add(back);
  const front = cbBox(0.014, 0.66, 1.2); front.position.set(1.8, 0.45, 0); body.add(front);
  const div = cbBox(0.014, 1.12, 1.2, 0xeeddcc); div.position.set(0.76, 0.68, 0); body.add(div);
  // 鼻先
  const ng = new THREE.CylinderGeometry(0.3, 0.55, 0.42, 4, 1); ng.rotateY(Math.PI / 4); ng.rotateZ(-Math.PI / 2);
  const nose = new THREE.Mesh(ng, cbMat(0xf4e6d6)); nose.scale.set(1, 0.66 / 0.78, 1.2 / 0.78); nose.position.set(2.01, 0.45, 0); shadow(nose); body.add(nose);
  // 青いテープの線
  const blue = colorTape(0x2f7de1);
  for (const z of [-0.609, 0.609]) { const st = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.07, 0.004), blue); st.position.set(-0.25, 0.6, z); (z > 0 ? near : body).add(st); }
  // 紙皿のタイヤ
  const plate = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const wheels = [];
  for (const [x, z] of [[1.3, 0.45], [1.3, -0.45], [-1.6, 0.45], [-1.6, -0.45]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 24), plate); w.rotation.x = Math.PI / 2; w.position.set(x, 0.12, z + Math.sign(z) * 0.18); shadow(w); (z > 0 ? near : body).add(w); wheels.push(w);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 12), mat(0x333333)); hub.rotation.x = Math.PI / 2; hub.position.copy(w.position); (z > 0 ? near : body).add(hub);
  }
  // 操縦席
  const seat = carton(0.34, 0.28, 0.46, 0xeeddcc); seat.position.set(1.05, 0.127, 0); body.add(seat);
  const backrest = cbBox(0.05, 0.42, 0.46); backrest.position.set(0.86, 0.62, 0); body.add(backrest);
  const dash = carton(0.2, 0.48, 1.0, 0xf2e4d4); dash.position.set(1.66, 0.127, 0); body.add(dash);
  const panel = cbBox(0.34, 0.02, 1.0, 0xffffff); panel.position.set(1.6, 0.66, 0); panel.rotation.z = 0.75; body.add(panel);
  const gaugeT = ctex(128, 128, (g) => { g.fillStyle = '#fafafa'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); g.lineWidth = 8; g.strokeStyle = '#222'; g.stroke(); g.lineWidth = 10; g.strokeStyle = '#3ac46b'; g.beginPath(); g.arc(64, 64, 44, Math.PI * 0.8, Math.PI * 1.5); g.stroke(); g.strokeStyle = '#f0b020'; g.beginPath(); g.arc(64, 64, 44, Math.PI * 1.5, Math.PI * 1.9); g.stroke(); g.strokeStyle = '#e03030'; g.beginPath(); g.arc(64, 64, 44, Math.PI * 1.9, Math.PI * 2.2); g.stroke(); });
  const gauges = [];
  const panelGroup = new THREE.Group(); panelGroup.position.copy(panel.position); panelGroup.rotation.copy(panel.rotation); body.add(panelGroup);
  for (const z of [-0.28, 0.28]) {
    const gd = decal(0.17, 0.17, gaugeT); gd.rotation.x = -Math.PI / 2; gd.rotation.z = Math.PI / 2; gd.position.set(0, 0.012, z); panelGroup.add(gd);
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.006, 0.008), mat(0xe02020)); needle.geometry.translate(0.03, 0, 0); needle.position.set(0, 0.018, z); panelGroup.add(needle); gauges.push(needle);
  }
  const buttons = [];
  [[0xe8423a, -0.08], [0xf5c518, 0.0], [0x37b34a, 0.08]].forEach(([c, z], i) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.025, 20), mat(c, { roughness: 0.3, emissive: c, emissiveIntensity: 0 }));
    b.position.set(0.04, 0.02, z); panelGroup.add(b); buttons.push(b);
  });
  // 風よけ（ペットボトルのシート）
  const shield = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.9), new THREE.MeshPhysicalMaterial({ color: 0xddeeff, transparent: true, opacity: 0.25, roughness: 0.05, side: THREE.DoubleSide }));
  shield.position.set(1.77, 0.92, 0); shield.rotation.set(0, Math.PI / 2, 0); shield.rotation.order = 'YXZ'; shield.rotation.x = -0.35; body.add(shield);
  // 操縦かん（キッチンペーパーの芯）
  const stick = new THREE.Group(); stick.position.set(1.4, 0.14, 0); body.add(stick);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 18, 1, true), cbMat(0xf6e0c4)); tube.material.side = THREE.DoubleSide; tube.position.y = 0.25; stick.add(tube);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 14), mat(0xe8423a, { roughness: 0.3 })); knob.position.y = 0.52; stick.add(knob);
  const stickHit = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); stickHit.position.y = 0.45; stick.add(stickHit);
  shadow(stick);
  // 客席
  const seats = [];
  for (const x of [-1.75, -1.05, -0.35]) {
    const s = carton(0.4, 0.24, 0.44, 0xf2e4d4); s.position.set(x, 0.127, -0.25); body.add(s);
    const br = cbBox(0.04, 0.36, 0.44); br.position.set(x - 0.2, 0.55, -0.25); body.add(br);
    seats.push(new THREE.Vector3(x + 0.02, 0.37, -0.25));
  }
  // 部品（翼・尾翼・プロペラ）
  const parts = {};
  const roundel = ctex(128, 128, (g) => { g.fillStyle = '#e8423a'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 42, 0, 7); g.fill(); g.fillStyle = '#2f7de1'; g.beginPath(); g.arc(64, 64, 24, 0, 7); g.fill(); });
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    const wb = cbBox(0.75, 0.045, 1.9, 0xfaf0e4); w.add(wb);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.046, 0.12), colorTape(0xe8423a)); tip.position.z = s * 0.92; w.add(tip);
    const rd = decal(0.42, 0.42, roundel); rd.rotation.x = -Math.PI / 2; rd.position.set(0, 0.025, s * 0.45); w.add(rd);
    const k = s < 0 ? 'wingL' : 'wingR';
    parts[k] = { obj: w, home: { pos: new THREE.Vector3(-0.1, 0.5, s * 1.55), rot: new THREE.Euler(0, 0, 0) } };
  }
  {
    const t = new THREE.Group();
    const fs = new THREE.Shape(); fs.moveTo(-0.4, 0); fs.lineTo(0.35, 0); fs.lineTo(-0.15, 0.62); fs.lineTo(-0.42, 0.62); fs.lineTo(-0.4, 0);
    const fin = cbPanel(fs, 0.03, 0xfaf0e4); fin.position.z = -0.015; t.add(fin);
    const fstripe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.034), colorTape(0x2f7de1)); fstripe.position.set(-0.27, 0.5, 0); fstripe.rotation.z = 0; t.add(fstripe);
    const stab = cbBox(0.45, 0.03, 1.5, 0xfaf0e4); stab.position.set(-0.15, 0.02, 0); t.add(stab);
    for (const s of [-1, 1]) { const tt = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.032, 0.08), colorTape(0xe8423a)); tt.position.set(-0.15, 0.02, s * 0.71); t.add(tt); }
    parts.tail = { obj: t, home: { pos: new THREE.Vector3(-1.9, 1.25, 0), rot: new THREE.Euler(0, 0, 0) } };
  }
  {
    const pr = new THREE.Group();
    const spin = new THREE.Group(); pr.add(spin);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 24), mat(0xe8423a, { roughness: 0.3 })); hub.rotation.z = Math.PI / 2; spin.add(hub);
    for (const a of [0, Math.PI / 2]) { const bl = cbBox(0.02, 0.8, 0.1, 0xfaf0e4); bl.rotation.x = a; bl.position.x = -0.02; spin.add(bl); }
    parts.prop = { obj: pr, spin, home: { pos: new THREE.Vector3(2.27, 0.45, 0), rot: new THREE.Euler(0, 0, 0) } };
  }
  for (const k in parts) shadow(parts[k].obj);
  // テープ（貼ると現れる）
  const tapes = {};
  const tc = { wingL: 0xffd23f, wingR: 0xffd23f, tail: 0xff7ab0, prop: 0x5fd06b };
  const mk = (k, list) => {
    const g = new THREE.Group(); g.visible = false;
    for (const [sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0] of list) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), colorTape(tc[k])); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.userData.full = m.scale.clone(); g.add(m);
    }
    body.add(g); tapes[k] = g;
  };
  for (const s of [-1, 1]) {
    mk(s < 0 ? 'wingL' : 'wingR', [[0.13, 0.006, 0.34, -0.3, 0.525, s * 0.75], [0.13, 0.006, 0.34, 0.1, 0.525, s * 0.75], [0.13, 0.2, 0.006, -0.3, 0.62, s * 0.611], [0.13, 0.2, 0.006, 0.1, 0.62, s * 0.611]]);
  }
  mk('tail', [[0.6, 0.006, 0.13, -1.9, 1.256, 0.09], [0.6, 0.006, 0.13, -1.9, 1.256, -0.09], [0.13, 0.26, 0.04, -2.0, 1.36, 0]]);
  mk('prop', [[0.006, 0.34, 0.08, 2.32, 0.45, 0, 0.7], [0.006, 0.34, 0.08, 2.32, 0.45, 0, -0.7]]);
  shadow(body);
  return { group: P, body, parts, tapes, farWall, nearWall: near, stick, stickHit, buttons, gauges, seats, wheels, nose, roof };
}

// ---------- 空港の検査場 ----------
export function buildSecurity() {
  const S = new THREE.Group();
  const desk = carton(0.9, 0.5, 0.55, 0xf2e4d4); desk.position.set(-1.5, 0, 0); S.add(desk);
  const deskTop = 0.505;
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.1), mat(0x7a1a28, { roughness: 0.6 })); pad.position.set(-1.82, deskTop + 0.01, 0.12); S.add(pad);
  const stamp = new THREE.Group();
  const sb = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.07), mat(0x333333)); sb.position.y = 0.018; stamp.add(sb);
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.09, 14), mat(0xb5814a, { roughness: 0.5 })); sh.position.y = 0.08; stamp.add(sh);
  const sk = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), mat(0xb5814a, { roughness: 0.5 })); sk.position.y = 0.135; stamp.add(sk);
  const stampHit = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); stampHit.position.y = 0.08; stamp.add(stampHit);
  stamp.position.set(-1.82, deskTop + 0.02, 0.12); shadow(stamp); S.add(stamp);
  // コンベア
  const table = carton(2.5, 0.52, 0.52, 0xeeddcc); table.position.set(0.72, 0, 0); S.add(table);
  const beltT = tex.belt.clone(); beltT.needsUpdate = true; beltT.repeat.set(10, 1);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.012, 0.44), new THREE.MeshStandardMaterial({ map: beltT, roughness: 0.6 })); belt.position.set(0.72, 0.53, 0); belt.receiveShadow = true; S.add(belt);
  // トンネル（検査機）
  const tun = new THREE.Group(); tun.position.set(0.72, 0.536, 0); S.add(tun);
  const th = 0.56, tw = 1.0;
  const tb = cbBox(tw, th, 0.02, 0xf4e6d6); tb.position.set(0, th / 2, -0.25); tun.add(tb);
  const tt = cbBox(tw + 0.04, 0.025, 0.54, 0xf4e6d6); tt.position.set(0, th, 0); tun.add(tt);
  for (const x of [-tw / 2, tw / 2]) {
    const post = cbBox(0.06, th, 0.03, 0xf4e6d6); post.position.set(x, th / 2, 0.255); tun.add(post);
    // ビニールのれん
    for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.004, th * 0.72, 0.07), new THREE.MeshStandardMaterial({ color: 0x223040, transparent: true, opacity: 0.55, roughness: 0.3 })); c.geometry.translate(0, -th * 0.36, 0); c.position.set(x, th - 0.01, -0.2 + i * 0.077); tun.add(c); c.userData.curtain = true; }
  }
  const lowFront = cbBox(tw, 0.06, 0.03, 0xf4e6d6); lowFront.position.set(0, 0.03, 0.255); tun.add(lowFront);
  const upFront = cbBox(tw, 0.09, 0.03, 0xf4e6d6); upFront.position.set(0, th - 0.045, 0.255); tun.add(upFront);
  const screenBack = new THREE.Mesh(new THREE.PlaneGeometry(tw - 0.04, th - 0.04), new THREE.MeshBasicMaterial({ color: 0x0c2240 })); screenBack.position.set(0, th / 2, -0.235); tun.add(screenBack);
  const gridT = ctex(256, 128, (g) => { g.strokeStyle = 'rgba(120,200,255,0.25)'; g.lineWidth = 2; for (let x = 0; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); } for (let y = 0; y < 128; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); } });
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(tw - 0.04, th - 0.04), new THREE.MeshBasicMaterial({ map: gridT, transparent: true })); grid.position.set(0, th / 2, -0.233); tun.add(grid);
  const windowGlass = new THREE.Mesh(new THREE.PlaneGeometry(tw - 0.06, th - 0.15), new THREE.MeshStandardMaterial({ color: 0x6ab8ff, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.2, depthWrite: false })); windowGlass.position.set(0, th / 2 - 0.015, 0.265); tun.add(windowGlass);
  const xlight = new THREE.PointLight(0x66ccff, 0, 1.2); xlight.position.set(0, th / 2, 0.1); tun.add(xlight);
  shadow(tun);
  // ボタンとランプ
  const btnBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.04, 24), mat(0x333333)); btnBase.position.set(1.08, 0.536 + th + 0.03, 0.12); S.add(btnBase);
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 24), mat(0x34c24a, { roughness: 0.3, emissive: 0x1a8a2a, emissiveIntensity: 0.4 })); button.position.set(1.08, 0.536 + th + 0.07, 0.12); S.add(button);
  const btnHit = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); btnHit.position.copy(button.position); S.add(btnHit);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xff3030, { roughness: 0.2, emissive: 0xff0000, emissiveIntensity: 0.05, transparent: true, opacity: 0.9 })); lamp.position.set(0.38, 0.536 + th + 0.012, 0.1); S.add(lamp);
  const lampLight = new THREE.PointLight(0xff2020, 0, 3); lampLight.position.set(0.38, 1.25, 0.3); S.add(lampLight);
  // 看板：お菓子に禁止マーク
  const signT = ctex(256, 256, (g) => { g.fillStyle = '#fffdf6'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#c9a77a'; g.lineWidth = 10; g.strokeRect(5, 5, 246, 246); drawCandy(g, 96, 128, 50, 'lolly'); drawCandy(g, 168, 140, 40, 'donut'); drawNoSign(g, 128, 128, 92); });
  const sign = new THREE.Group();
  const board = cbBox(0.46, 0.46, 0.015, 0xffffff); sign.add(board);
  const sd = decal(0.4, 0.4, signT); sd.position.z = 0.009; sign.add(sd);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25), cbMat(0xf6e0c4)); pole.position.y = -0.33; sign.add(pole);
  sign.position.set(0.55, 0.536 + th + 0.48, -0.05); shadow(sign); S.add(sign);
  // 没収ボックス
  const bin = new THREE.Group();
  const bb = cbBox(0.36, 0.22, 0.3, 0xeeddcc); bb.position.y = 0.11; bin.add(bb);
  const binT = ctex(128, 128, (g) => { drawCandy(g, 64, 64, 34, 'lolly'); drawNoSign(g, 64, 64, 50); });
  const bd = decal(0.17, 0.17, binT); bd.position.set(0, 0.12, 0.152); bin.add(bd);
  bin.position.set(-0.32, 0, 0.62); shadow(bin); S.add(bin);
  return { group: S, desk, deskTop, stamp, stampHit, pad, belt, beltT, tun, th, tw, button, btnHit, lamp, lampLight, sign, bin, xlight, screenBack };
}

// パスポート
export function makePassport(faceColor, kind) {
  const g = new THREE.Group();
  const s = 2.0;
  const page = new THREE.Mesh(new THREE.BoxGeometry(0.14 * s, 0.01, 0.1 * s), mat(0xfaf6ea)); page.position.set(0.07 * s, 0.005, 0); g.add(page);
  const pageLines = ctex(128, 96, (x) => { x.fillStyle = '#f6f0dc'; x.fillRect(0, 0, 128, 96); x.strokeStyle = 'rgba(80,140,200,0.25)'; x.lineWidth = 2; for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(64, 48, 10 + i * 7, 0, 7); x.stroke(); } });
  const pd = decal(0.135 * s, 0.095 * s, pageLines); pd.rotation.x = -Math.PI / 2; pd.position.set(0.07 * s, 0.0105, 0); g.add(pd);
  const hinge = new THREE.Group(); g.add(hinge);
  const coverT = ctex(128, 96, (x) => { x.fillStyle = '#7a1f2b'; x.fillRect(0, 0, 128, 96); x.fillStyle = '#e3b341'; x.beginPath(); x.ellipse(64, 46, 12, 12, 0, 0, 7); x.fill(); x.fillRect(34, 43, 60, 6); x.fillRect(54, 60, 20, 5); });
  const cover = new THREE.Mesh(new THREE.BoxGeometry(0.142 * s, 0.006, 0.102 * s), [mat(0x7a1f2b), mat(0x7a1f2b), mat(0xffffff, { map: coverT, roughness: 0.6 }), mat(0xfaf6ea), mat(0x7a1f2b), mat(0x7a1f2b)]);
  cover.position.set(0.071 * s, 0.013, 0); hinge.add(cover);
  const photoT = ctex(128, 96, (x) => {
    x.fillStyle = '#f6f0dc'; x.fillRect(0, 0, 128, 96); x.fillStyle = '#cfe6f5'; x.fillRect(10, 14, 50, 64);
    const c = '#' + faceColor.toString(16).padStart(6, '0'); x.fillStyle = c;
    if (kind === 'bunny') { x.beginPath(); x.ellipse(28, 28, 6, 16, 0, 0, 7); x.ellipse(42, 28, 6, 16, 0, 0, 7); x.fill(); }
    else if (kind === 'bear') { x.beginPath(); x.arc(22, 36, 8, 0, 7); x.arc(48, 36, 8, 0, 7); x.fill(); }
    x.beginPath(); x.arc(35, 52, 19, 0, 7); x.fill();
    if (kind === 'dog') { x.fillStyle = '#8a5a36'; x.beginPath(); x.ellipse(17, 52, 6, 13, 0.3, 0, 7); x.ellipse(53, 52, 6, 13, -0.3, 0, 7); x.fill(); }
    x.fillStyle = '#111'; x.beginPath(); x.arc(29, 50, 3, 0, 7); x.arc(41, 50, 3, 0, 7); x.fill(); x.beginPath(); x.arc(35, 57, 3, 0, 7); x.fill();
    x.fillStyle = 'rgba(80,80,80,0.35)'; for (let i = 0; i < 4; i++) x.fillRect(70, 22 + i * 14, 46 - i * 6, 5);
  });
  const photo = decal(0.135 * s, 0.095 * s, photoT); photo.rotation.x = Math.PI / 2; photo.position.set(0.071 * s, 0.0095, 0); hinge.add(photo);
  const mark = decal(0.08 * s, 0.08 * s, ctex(128, 128, (x) => { x.strokeStyle = 'rgba(210,30,50,0.9)'; x.lineWidth = 9; x.beginPath(); x.arc(64, 64, 54, 0, 7); x.stroke(); x.lineWidth = 4; x.beginPath(); x.arc(64, 64, 44, 0, 7); x.stroke(); x.fillStyle = 'rgba(210,30,50,0.9)'; x.save(); x.translate(64, 66); x.rotate(-0.5); x.fillRect(-30, -5, 60, 10); x.beginPath(); x.moveTo(-6, -4); x.lineTo(6, -4); x.lineTo(-4, -26); x.lineTo(-14, -26); x.fill(); x.beginPath(); x.moveTo(-6, 4); x.lineTo(6, 4); x.lineTo(-4, 26); x.lineTo(-14, 26); x.fill(); x.fillRect(-30, -12, 6, 24); x.restore(); }));
  mark.rotation.x = -Math.PI / 2; mark.rotation.z = 0.3; mark.position.set(0.075 * s, 0.012, 0); mark.visible = false; g.add(mark);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.32 * s, 0.1, 0.18 * s), new THREE.MeshBasicMaterial({ visible: false })); hit.position.x = 0.07 * s; g.add(hit);
  shadow(g);
  return { group: g, hinge, mark, hit, open: false, stamped: false };
}

// カバン（透ける）
export function makeBag(color, items) {
  const g = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color, roughness: 0.55, transparent: true, opacity: 1 });
  const w = 0.42, h = 0.26, d = 0.2;
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), shell); box.position.y = h / 2; box.castShadow = true; g.add(box);
  const trimM = new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.5, transparent: true, opacity: 1 });
  for (const x of [-0.12, 0.12]) { const strap = new THREE.Mesh(new THREE.BoxGeometry(0.03, h + 0.004, d + 0.004), trimM); strap.position.set(x, h / 2, 0); g.add(strap); }
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 20, Math.PI), trimM); handle.position.y = h; g.add(handle);
  const inside = new THREE.Group(); g.add(inside);
  const content = [];
  items.forEach((it, i) => {
    it.obj.position.set(-0.13 + i * 0.13, h * 0.5 + (i % 2 ? 0.03 : -0.02), 0); it.obj.scale.setScalar(1.2);
    inside.add(it.obj); content.push(it);
    it.obj.traverse(m => { if (m.isMesh) { m.userData.realMat = m.material; } });
  });
  const hit = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, h + 0.1, d + 0.1), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = h / 2; g.add(hit);
  return { group: g, shell, trimM, content, hit, w, h, xray: 0 };
}

// ---------- ワゴンとジュース ----------
export const DRINKS = [
  { key: 'orange', color: 0xff9a1a }, { key: 'apple', color: 0xc8e04a }, { key: 'berry', color: 0xff5c8a }, { key: 'milk', color: 0xfafafa },
];
export function makeCup(color) {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.12, 24, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, roughness: 0.05, side: THREE.DoubleSide }));
  glass.position.y = 0.06; g.add(glass);
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.034, 0.095, 24), mat(color, { roughness: 0.2 })); liquid.position.y = 0.05; g.add(liquid);
  const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.17, 8), mat(0xff4f7a)); straw.position.set(0.012, 0.11, 0); straw.rotation.z = -0.25; g.add(straw);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.06; g.add(hit);
  shadow(g);
  return { group: g, liquid, hit };
}
export function makeWagon() {
  const g = new THREE.Group();
  const b = carton(0.5, 0.42, 0.34, 0xf2e4d4); b.position.y = 0.06; g.add(b);
  const top = cbBox(0.56, 0.02, 0.4, 0xffffff); top.position.y = 0.49; g.add(top);
  for (const [x, z] of [[-0.2, -0.14], [0.2, -0.14], [-0.2, 0.14], [0.2, 0.14]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 16), mat(0x333333)); w.rotation.x = Math.PI / 2; w.position.set(x, 0.04, z); g.add(w); }
  const hd = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 8, 20, Math.PI), mat(0xdddddd, { metalness: 0.7, roughness: 0.3 })); hd.position.set(0.29, 0.5, 0); hd.rotation.set(0, Math.PI / 2, -Math.PI / 2); g.add(hd);
  shadow(g);
  return g;
}

// ---------- 空の世界 ----------
export function buildSky(scene) {
  scene.add(skyDome(0x2f7fd8, 0xcfe7fb));
  scene.fog = new THREE.Fog(0xcfe7fb, 120, 650);
  const seaT = tex.sea.clone(); seaT.needsUpdate = true; seaT.repeat.set(80, 80);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ map: seaT, roughness: 0.22, metalness: 0.1, color: 0xbfe6ff }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -30; sea.receiveShadow = true; scene.add(sea);
  return { sea, seaT };
}
export function island(size = 1, withStrip = false) {
  const g = new THREE.Group();
  const sandT = tex.sand.clone(); sandT.needsUpdate = true; sandT.repeat.set(6, 6);
  const beach = new THREE.Mesh(new THREE.CylinderGeometry(9 * size, 11 * size, 1.4, 40), new THREE.MeshStandardMaterial({ map: sandT, roughness: 0.95, color: 0xcdb48a }));
  beach.position.y = -0.4; g.add(beach);
  const shallow = new THREE.Mesh(new THREE.CylinderGeometry(13 * size, 13 * size, 0.1, 40), new THREE.MeshStandardMaterial({ color: 0x5fd6d0, transparent: true, opacity: 0.55, roughness: 0.2 }));
  shallow.position.y = -0.05; g.add(shallow);
  const hill = new THREE.Mesh(new THREE.SphereGeometry(5 * size, 24, 16), new THREE.MeshStandardMaterial({ color: 0x4f9a3c, roughness: 0.9 }));
  hill.scale.set(1, 0.5, 0.8); hill.position.set(-2 * size, 0.3, (withStrip ? -4 : -2) * size); g.add(hill);
  const trunkM = mat(0x8a6a44, { roughness: 0.9 }), leafM = new THREE.MeshStandardMaterial({ color: 0x3f9a3a, roughness: 0.8, side: THREE.DoubleSide });
  const n = Math.round(4 * size + 2);
  for (let i = 0; i < n; i++) {
    const a = withStrip ? Math.PI * (1.1 + Math.random() * 0.8) : Math.random() * Math.PI * 2, r = (4 + Math.random() * 3.5) * size;
    const p = new THREE.Group(); p.position.set(Math.cos(a) * r, 0.3, Math.sin(a) * r);
    const hgt = 3 + Math.random() * 2;
    for (let k = 0; k < 6; k++) { const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, hgt / 6 + 0.05, 8), trunkM); seg.position.set(k * k * 0.02, (k + 0.5) * hgt / 6, 0); seg.rotation.z = -k * 0.04; p.add(seg); }
    for (let k = 0; k < 7; k++) { const lf = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.4, 4, 1, true), leafM); lf.scale.z = 0.25; lf.position.set(0.5, hgt, 0); lf.rotation.set(0, k / 7 * Math.PI * 2, 1.9); const lg = new THREE.Group(); lg.add(lf); lg.position.set(0, 0, 0); lg.rotation.y = k / 7 * Math.PI * 2; lf.position.set(1.0, hgt - 0.2, 0); p.add(lg); }
    const coco = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), mat(0x5a3a1a)); coco.position.set(0.2, hgt - 0.3, 0.1); p.add(coco);
    p.rotation.y = Math.random() * 6; g.add(p);
  }
  if (withStrip) {
    for (let i = 0; i < 6; i++) { const sh = cbBox(1.6, 0.02, 2.2, 0xffffff); sh.position.set(-5 + i * 1.7, 0.32, 3.5); g.add(sh); }
  }
  shadow(g);
  return g;
}
export function makeBalloon(color) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 18), new THREE.MeshPhysicalMaterial({ color, roughness: 0.15, clearcoat: 1, emissive: color, emissiveIntensity: 0.15 }));
  b.scale.y = 1.2; g.add(b);
  const k = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.15, 8), b.material); k.position.y = -0.75; k.rotation.x = Math.PI; g.add(k);
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.4), mat(0xffffff)); s.position.y = -1.5; g.add(s);
  return g;
}
export function makeDolphin() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0x6f8fb0, roughness: 0.35 });
  const belly = new THREE.MeshStandardMaterial({ color: 0xe6eef5, roughness: 0.4 });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), m); b.scale.set(2.2, 0.75, 0.75); g.add(b);
  const bl = new THREE.Mesh(new THREE.SphereGeometry(0.45, 18, 12), belly); bl.scale.set(1.9, 0.55, 0.6); bl.position.y = -0.12; g.add(bl);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), m); snout.scale.set(1.8, 0.7, 0.8); snout.position.set(1.15, -0.08, 0); g.add(snout);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 4), m); fin.position.set(-0.1, 0.45, 0); fin.rotation.z = 0.4; fin.scale.z = 0.3; g.add(fin);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.2, 4), m); tail.position.set(-1.15, 0, 0); tail.rotation.z = Math.PI / 2; tail.scale.set(1, 1, 0.25); g.add(tail);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat(0x111111, { roughness: 0.1 })); e.position.set(0.8, 0.05, s * 0.3); g.add(e); }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 6, 12, Math.PI), mat(0x223344)); smile.position.set(1.15, -0.15, 0); smile.rotation.z = Math.PI; g.add(smile);
  return g;
}
