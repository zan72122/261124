// scene 3b: a world made only of square blocks — dig & stack forever
import { THREE, RoundedBoxGeometry, canvasTex, fluffMat, mat, shadowy, tween, wait, ease, arcTo, scaleTo, squash, setShot, tappable, untappable,
  SFX, FX, setHint, pulse, isPortrait, onUpdate, T, fade, shake, aimSun, scene, burst, SPR, drawFace, input, rand, pick } from './core.js';
import { sets, showSets, girl, dad, waffleMat } from './world.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const geo = new RoundedBoxGeometry(0.98, 0.98, 0.98, 2, 0.07);

export async function runBlocks() {
  const S = sets.blocks;
  showSets('blocks');
  scene.background = new THREE.Color(0xaee0ff);
  aimSun(0, 0);
  SFX.birdsOn = true;
  girl.root.visible = false; dad.root.visible = false;
  const stripe = canvasTex(64, 64, c => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#ff6fb1'; c.fillRect(i * 8, 0, 8, 64); } });
  const M = {
    stone: mat(0xa6a3ad, { roughness: 0.9 }),
    dirt: mat(0xa8744a, { roughness: 0.95 }),
    grass: mat(0x86d35e, { roughness: 0.85 }),
    pink: fluffMat(0xffffff, 0.35),
    sand: mat(0xf5dea2, { roughness: 0.95 }),
    cream: mat(0xfff4da, { roughness: 0.7 }),
    choco: mat(0x7a4a2e, { roughness: 0.6 }),
    mint: mat(0x9fe8c8, { roughness: 0.7 }),
    water: new THREE.MeshPhysicalMaterial({ color: 0x55c6ff, transparent: true, opacity: 0.72, roughness: 0.05, clearcoat: 1 }),
    wheel: mat(0x34343a, { roughness: 0.8 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85 }),
    cone: waffleMat(),
    window: new THREE.MeshStandardMaterial({ map: stripe, roughness: 0.7 }),
    leaf: mat(0x5fbf4a, { roughness: 0.9 }),
    trunk: mat(0x8a5a3a, { roughness: 0.9 }),
    cherry: new THREE.MeshPhysicalMaterial({ color: 0xd8102e, roughness: 0.2, clearcoat: 1 }),
  };
  const CSS = { pink: null, grass: '#86d35e', sand: '#f5dea2', cream: '#fff4da', choco: '#7a4a2e', mint: '#9fe8c8', water: '#55c6ff' };
  const grid = new Map();
  const key = (x, y, z) => x + ',' + y + ',' + z;
  const world = new THREE.Group(); S.add(world);
  const MIN = -6, MAX = 5, YMAX = 9;
  function put(x, y, z, type, anim = false) {
    const k = key(x, y, z); if (grid.has(k)) return null;
    const m = new THREE.Mesh(geo, M[type]); m.position.set(x, y + 0.5, z); m.castShadow = type !== 'water'; m.receiveShadow = true;
    m.userData.cell = { x, y, z }; m.userData.type = type;
    world.add(m); grid.set(k, m);
    if (anim) {
      m.position.y = y + 3.5; m.scale.setScalar(0.6);
      tween(0.35, t => { m.position.y = y + 0.5 + 3 * (1 - t); m.scale.setScalar(0.6 + 0.4 * t); }, ease.in).then(() => { SFX.block(); squash(m, 0.2, 0.35); FX.puff(V(x, y + 0.1, z), 4, 0xffffff, 0.3); });
    }
    return m;
  }
  // island
  for (let x = -5; x <= 4; x++) for (let z = -4; z <= 4; z++) {
    put(x, 0, z, 'stone'); put(x, 1, z, 'dirt');
    const water = x >= 2 && x <= 4 && z >= 1 && z <= 3;
    put(x, 2, z, water ? 'water' : (x <= -4 && z >= 2 ? 'sand' : 'grass'));
  }
  // the blocky pink truck
  for (const z of [-3, -2]) {
    put(-4, 3, z, 'wheel'); put(-3, 3, z, 'pink'); put(-2, 3, z, 'wheel'); put(-1, 3, z, 'pink');
    put(-4, 4, z, 'pink'); put(-2, 4, z, 'pink'); put(-1, 4, z, 'glass');
  }
  put(-3, 4, -3, 'pink');
  const winBlock = put(-3, 4, -2, 'window');
  put(-3, 5, -3, 'cone'); put(-3, 6, -3, 'pink');
  // a tree
  put(3, 3, -3, 'trunk'); put(3, 4, -3, 'trunk');
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) put(3 + dx, 5, -3 + dz, 'leaf');
  put(3, 6, -3, 'leaf');
  // block sea + clouds
  const seaTex = canvasTex(64, 64, c => { c.fillStyle = '#7fd0f5'; c.fillRect(0, 0, 64, 64); c.strokeStyle = '#a8e2ff'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, 61, 61); });
  seaTex.wrapS = seaTex.wrapT = THREE.RepeatWrapping; seaTex.repeat.set(80, 80);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: seaTex, roughness: 0.3 })); sea.rotation.x = -Math.PI / 2; sea.position.y = 1.2; sea.receiveShadow = true; S.add(sea);
  const clouds = [];
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Group();
    for (let j = 0; j < 4; j++) { const b = new THREE.Mesh(geo, mat(0xffffff, { roughness: 1 })); b.position.set(j * 0.9 - 1.3, (j % 2) * 0.5, (j % 3) * 0.4); b.scale.set(1.2, 0.8, 1); c.add(b); }
    c.position.set(rand(-18, 18), rand(9, 13), rand(-16, -6)); c.scale.setScalar(rand(0.8, 1.4)); S.add(c); clouds.push(c);
  }
  const offC = onUpdate(dt => clouds.forEach(c => { c.position.x += dt * 0.3; if (c.position.x > 22) c.position.x = -22; }));

  // ---------- blocky people ----------
  function blockPerson(o) {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const skin = mat(0xf6c9a8, { roughness: 0.8 }), shirt = o.shirtMat || mat(o.shirt), pants = mat(o.pants), hair = mat(o.hair);
    const box = (w, h, d, m, x, y, z, parent = body) => { const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.025), m); b.position.set(x, y, z); parent.add(b); return b; };
    const legs = [-1, 1].map(s => { const p = new THREE.Group(); p.position.set(s * 0.1, 0.42, 0); box(0.17, 0.42, 0.18, pants, 0, -0.21, 0, p); body.add(p); return p; });
    box(0.44, 0.46, 0.26, shirt, 0, 0.65, 0);
    if (o.apron) box(0.36, 0.34, 0.02, M.window, 0, 0.6, 0.14);
    const arms = [-1, 1].map(s => { const p = new THREE.Group(); p.position.set(s * 0.3, 0.86, 0); box(0.14, 0.42, 0.15, shirt, 0, -0.18, 0, p); box(0.13, 0.1, 0.13, skin, 0, -0.42, 0, p); body.add(p); return p; });
    const head = new THREE.Group(); head.position.y = 1.1; body.add(head);
    const ft = canvasTex(256, 256, () => {});
    const faceM = new THREE.MeshStandardMaterial({ map: ft, roughness: 0.8 });
    const hb = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.44, 0.42, 2, 0.03), [skin, skin, hair, skin, faceM, hair]); head.add(hb);
    box(0.47, 0.12, 0.45, hair, 0, 0.21, -0.01, head);
    box(0.47, 0.3, 0.1, hair, 0, 0.05, -0.19, head);
    if (o.pigtails) for (const s of [-1, 1]) { box(0.1, 0.18, 0.1, hair, s * 0.28, -0.02, -0.12, head); box(0.08, 0.06, 0.08, M.pink, s * 0.28, 0.08, -0.12, head); }
    if (o.hat) { box(0.36, 0.14, 0.36, M.pink, 0, 0.32, 0, head); box(0.08, 0.1, 0.08, M.cone, 0, 0.44, 0, head); box(0.1, 0.1, 0.1, M.pink, 0, 0.52, 0, head); }
    const paint = e => { drawFace(ft.userData.g, e, { fill: '#f6c9a8', glasses: o.glasses, eyeY: 120, eyeX: 44 }); ft.needsUpdate = true; };
    paint('smile');
    root.scale.setScalar(o.size || 1);
    shadowy(root);
    const st = { t: rand(0, 5), walking: false, jumpT: 0, until: 0 };
    const api = {
      root, st,
      face(e, d) { paint(e); st.until = T.now + (d || 0); st.temp = !!d; },
      jump() { st.jumpT = 0.55; },
      update(dt) {
        st.t += dt;
        if (st.temp && T.now > st.until) { st.temp = false; paint('smile'); }
        const sw = st.walking ? Math.sin(st.t * 10) * 0.6 : 0;
        legs[0].rotation.x = sw; legs[1].rotation.x = -sw;
        let aL = st.walking ? -sw : 0, aR = st.walking ? sw : 0, zL = 0.05, zR = -0.05;
        let jy = 0;
        if (st.jumpT > 0) { st.jumpT -= dt; const k = 1 - st.jumpT / 0.55; jy = Math.sin(k * Math.PI) * 0.45; zL = 2.6; zR = -2.6; }
        arms[0].rotation.x = aL; arms[1].rotation.x = aR; arms[0].rotation.z = lerp(arms[0].rotation.z, zL, 0.3); arms[1].rotation.z = lerp(arms[1].rotation.z, zR, 0.3);
        body.position.y = jy + (st.walking ? Math.abs(Math.sin(st.t * 10)) * 0.04 : Math.sin(st.t * 2) * 0.01);
      },
    };
    onUpdate(dt => api.update(dt));
    return api;
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const bGirl = blockPerson({ shirt: 0xfff3b0, pants: 0x8fd3ff, hair: 0x6a3b22, pigtails: true, hat: true, apron: true, size: 1 });
  const bDad = blockPerson({ shirt: 0x5aa6de, pants: 0xcdb48a, hair: 0x3a2a20, glasses: true, size: 1.3 });
  const folks = [bGirl, bDad];
  S.add(bGirl.root); S.add(bDad.root);
  const top = (x, z) => { for (let y = YMAX; y >= 0; y--) if (grid.has(key(x, y, z))) return y + 1; return 1.2; };
  bGirl.root.position.set(0, top(0, 1), 1); bDad.root.position.set(1, top(1, -1), -1);
  bGirl.root.rotation.y = 0.3; bDad.root.rotation.y = -0.3;
  for (const f of folks) {
    tappable(f.root, () => { f.jump(); f.face('laugh', 1.2); SFX.giggle(f === bDad ? 0.8 : 1.3); FX.hearts(f.root.position.clone().add(V(0, 1.6, 0)), 4); });
    // keep feet on the ground & wander
    f.st.next = T.now + rand(2, 5);
    onUpdate(dt => {
      const p = f.root.position;
      const cx = Math.round(p.x), cz = Math.round(p.z);
      const gy = top(cx, cz);
      p.y = lerp(p.y, gy, Math.min(1, dt * 10));
      if (!f.st.walking && T.now > f.st.next) {
        f.st.next = T.now + rand(3, 7);
        const tx = Math.max(-5, Math.min(4, cx + pick([-2, -1, 1, 2]))), tz = Math.max(-4, Math.min(4, cz + pick([-1, 0, 1, 2])));
        if (Math.abs(top(tx, tz) - gy) > 2.5) return;
        f.st.walking = true;
        const from = p.clone(); f.root.rotation.y = Math.atan2(tx - from.x, tz - from.z);
        const d = Math.hypot(tx - from.x, tz - from.z);
        tween(d / 1.3, t => { p.x = lerp(from.x, tx, t); p.z = lerp(from.z, tz, t); }, ease.lin).then(() => { f.st.walking = false; tween(0.3, t => f.root.rotation.y = lerp(f.root.rotation.y, 0.2, t)); });
      }
    });
  }

  // ---------- palette ----------
  const pal = document.getElementById('pal');
  pal.innerHTML = '';
  const tools = ['pink', 'shovel', 'grass', 'sand', 'cream', 'choco', 'mint', 'water'];
  let tool = 'pink';
  const btns = {};
  for (const t of tools) {
    const b = document.createElement('div'); b.className = 'b';
    if (t === 'shovel') { b.style.background = '#fff7d6'; b.innerHTML = '<svg viewBox="0 0 48 48" width="80%" height="80%"><path d="M30 6l12 12-4 4-3-3-9 9 2 2c2 2 2 5 0 7l-7 7c-3 3-9 3-12 0s-3-9 0-12l7-7c2-2 5-2 7 0l2 2 9-9-3-3z" fill="#9aa3ad" stroke="#5b6470" stroke-width="2.5" stroke-linejoin="round"/><path d="M33 9l6 6" stroke="#c98a4a" stroke-width="5" stroke-linecap="round"/></svg>'; }
    else if (t === 'pink') b.style.backgroundImage = 'url(img/fluff.jpg)';
    else b.style.background = CSS[t];
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); tool = t; for (const k in btns) btns[k].classList.toggle('on', k === t); SFX.tap(); input.lastAct = T.now; });
    pal.appendChild(b); btns[t] = b;
  }
  btns[tool].classList.add('on');
  pal.style.display = 'flex';

  // ---------- dig & stack ----------
  const fx = (x, y, z, color) => burst(V(x, y + 0.5, z), { n: 10, map: SPR.soft, color, size: 0.25, speed: 3, gravity: 6, life: 0.7 });
  const colorOf = { stone: 0xa6a3ad, dirt: 0xa8744a, grass: 0x86d35e, pink: 0xff7fbf, sand: 0xf5dea2, cream: 0xfff4da, choco: 0x7a4a2e, mint: 0x9fe8c8, water: 0x55c6ff, wheel: 0x34343a, glass: 0xbfe8ff, cone: 0xe2a65a, window: 0xff6fb1, leaf: 0x5fbf4a, trunk: 0x8a5a3a };
  const react = () => { const f = pick(folks); f.jump(); f.face(pick(['happy', 'laugh', 'wow']), 1); };
  let first = true;
  tappable(world, async (h) => {
    first = false; setHint(null);
    const m = h.object; const c = m.userData.cell; if (!c) return;
    if (m === winBlock) { // the truck window serves a block ice cream
      SFX.jingle(); squash(m, 0.2);
      const ice = new THREE.Group();
      const a = new THREE.Mesh(geo, M.cone); a.scale.setScalar(0.4); ice.add(a);
      const b = new THREE.Mesh(geo, pick([M.pink, M.cream, M.choco, M.mint])); b.scale.setScalar(0.45); b.position.y = 0.42; ice.add(b);
      const ch = new THREE.Mesh(geo, M.cherry); ch.scale.setScalar(0.15); ch.position.y = 0.72; ice.add(ch);
      shadowy(ice); ice.position.set(-3, 4.5, -1.3); S.add(ice);
      const tx = rand(-2, 1.5), tz = rand(0, 3.5);
      await arcTo(ice, V(tx, top(Math.round(tx), Math.round(tz)) + 0.2, tz), 0.8, 1.5, ease.io, 6);
      SFX.plop(); FX.sparkle(ice.position.clone(), 10); bGirl.jump(); bGirl.face('laugh', 1.2); SFX.yay(1.3);
      tappable(ice, () => { untappable(ice); SFX.yay(1.2); FX.hearts(ice.position.clone(), 5); scaleTo(ice, 0.01, 0.3).then(() => S.remove(ice)); bDad.jump(); bDad.face('yum', 1.4); });
      return;
    }
    if (tool === 'shovel') {
      if (c.y === 0) { SFX.thud(); squash(m, 0.15, 0.3); return; }
      grid.delete(key(c.x, c.y, c.z)); untappable(m);
      SFX.dig(); fx(c.x, c.y, c.z, colorOf[m.userData.type]);
      await tween(0.15, t => m.scale.setScalar(1 - t * 0.9));
      world.remove(m);
      if (Math.random() < 0.4) react();
    } else {
      const n = h.face.normal;
      const x = c.x + Math.round(n.x), y = c.y + Math.round(n.y), z = c.z + Math.round(n.z);
      if (x < MIN || x > MAX || z < MIN || z > MAX || y < 1 || y > YMAX || grid.has(key(x, y, z))) { SFX.boing(); squash(m, 0.12, 0.3); return; }
      put(x, y, z, tool, true);
      if (Math.random() < 0.4) react();
    }
  });
  await setShot({ look: V(-0.4, 2.2, 0.2), dir: V(0.5, 0.78, 1), w: isPortrait() ? 11 : 13, h: 9.5 }, 0);
  await fade(0, 0.8);
  bGirl.jump(); bGirl.face('laugh', 1.5); SFX.fanfare();
  setHint(() => first ? grid.get(key(0, 2, 2)) : null);
}
