// scene 2: the ice cream shop (inside the pink truck)
import { THREE, RoundedBoxGeometry, canvasTex, fluffMat, mat, shadowy, tween, wait, ease, arcTo, scaleTo, squash, setShot, tappable, untappable,
  SFX, FX, setHint, pulse, isPortrait, onUpdate, T, fade, shake, aimSun, input, pickAt, camera, SPR } from './core.js';
import { sets, showSets, girl, dad, customers, FLAVORS, SAUCES, makeScoop, makeCone, makeSauce, makeSprinkles, makeCherry, drawOrder } from './world.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const LEDGE = 1.23, ROW = 0.86;

export async function runShop() {
  const S = sets.shop;
  showSets('yard', 'shop');
  aimSun(0, 1.5);
  const P = isPortrait();
  // ---------- shell ----------
  const wallM = fluffMat(0xffffff, 1.2);
  const wallM2 = fluffMat(0xfff2f8, 1.2);
  const box = (w, h, d, x, y, z, m, round = 0.02) => { const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, round), m); b.position.set(x, y, z); b.receiveShadow = true; S.add(b); return b; };
  // front wall around the window (x -1.2..1.0, y 1.23..2.45)
  box(3.6, LEDGE - 0.45, 0.1, -0.3, (0.45 + LEDGE) / 2, 1.0, wallM);
  box(3.6, 0.3, 0.1, -0.3, 2.6, 1.0, wallM);
  box(0.9, 1.25, 0.1, -1.65, 1.85, 1.0, wallM);
  box(0.5, 1.25, 0.1, 1.25, 1.85, 1.0, wallM);
  // side walls & floor & ceiling (one-sided so we can peek in from behind)
  const plane = (w, h, m, pos, rot) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.copy(pos); p.rotation.copy(rot); p.receiveShadow = true; S.add(p); return p; };
  const floorTex = canvasTex(128, 128, g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#ffc2df'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64); });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(6, 8);
  plane(3.6, 7, new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.35 }), V(-0.3, 0.45, -2.5), new THREE.Euler(-Math.PI / 2, 0, 0));
  plane(7, 2.2, wallM2, V(-2.1, 1.55, -2.5), new THREE.Euler(0, Math.PI / 2, 0));
  plane(7, 2.2, wallM2, V(1.5, 1.55, -2.5), new THREE.Euler(0, -Math.PI / 2, 0));
  plane(3.6, 7, mat(0xfff6fa), V(-0.3, 2.65, -2.5), new THREE.Euler(Math.PI / 2, 0, 0));
  // awning outside (flap opened)
  const flapTex = canvasTex(256, 128, c => { for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#ff6fb1'; c.fillRect(i * 22, 0, 22, 128); } });
  const aw = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.9), new THREE.MeshStandardMaterial({ map: flapTex, side: THREE.DoubleSide })); aw.position.set(-0.1, 2.62, 1.42); aw.rotation.x = -1.1; S.add(aw);
  // fairy lights along window top
  const bulbs = [];
  for (let i = 0; i < 11; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: [0xff6fb5, 0xfff07a, 0x7fd8ff][i % 3], emissiveIntensity: 1.2 }));
    b.position.set(-1.15 + i * 0.21, 2.4 - Math.sin(i / 10 * Math.PI) * 0.06, 0.93); S.add(b); bulbs.push(b);
  }
  const offB = onUpdate(() => bulbs.forEach((b, i) => b.material.emissiveIntensity = 0.6 + 0.6 * Math.sin(T.now * 3 + i)));
  // interior light
  const lamp = new THREE.PointLight(0xfff0e6, 6, 6, 1.5); lamp.position.set(-0.3, 2.4, 0.1); S.add(lamp);
  // counter ledge
  const ledge = box(2.75, 0.06, 0.56, 0.05, LEDGE - 0.03, 0.88, new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 0.6 }), 0.02);
  // step outside for customers
  const step = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.3, 0.7, 3, 0.08), fluffMat(0xffffff, 0.7)); step.position.set(-0.15, 0.15, 1.65); shadowy(step); S.add(step);
  // ---------- showcase ----------
  const sc = new THREE.Group(); S.add(sc);
  const scBody = new THREE.Mesh(new RoundedBoxGeometry(1.9, 0.55, 0.6, 3, 0.05), mat(0xffffff, { roughness: 0.3 })); scBody.position.set(-0.2, 0.72, 0.3); sc.add(scBody);
  const trim = new THREE.Mesh(new RoundedBoxGeometry(1.94, 0.1, 0.64, 2, 0.04), fluffMat(0xffffff, 0.8)); trim.position.set(-0.2, 0.52, 0.3); sc.add(trim);
  const inside = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.02, 0.5), mat(0xdff3ff)); inside.position.set(-0.2, 0.995, 0.3); sc.add(inside);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.86, 0.62), new THREE.MeshPhysicalMaterial({ color: 0xe8f8ff, transparent: true, opacity: 0.18, roughness: 0.02, clearcoat: 1, depthWrite: false }));
  glass.position.set(-0.2, 1.12, 0.3); glass.rotation.x = -Math.PI / 2 + 0.25; sc.add(glass);
  shadowy(sc, false, true);
  const flavors = ['straw', 'vanilla', 'choco', 'mint'];
  const tubs = flavors.map((f, i) => {
    const g = new THREE.Group(); g.position.set(-0.83 + i * 0.42, 1.0, 0.3);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.16, 0.1, 24), mat(0xffffff, { roughness: 0.3 })); t.position.y = 0.04; g.add(t);
    const ic = new THREE.Mesh(new THREE.SphereGeometry(0.165, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), makeScoop(f).material); ic.scale.y = 0.35; ic.position.y = 0.085; g.add(ic);
    for (let k = 0; k < 3; k++) { const b = makeScoop(f); b.scale.setScalar(0.7); b.position.set(Math.cos(k * 2.1) * 0.07, 0.11, Math.sin(k * 2.1) * 0.07); g.add(b); }
    g.userData.flavor = f; sc.add(g); return g;
  });
  // ---------- ledge items ----------
  const coneStack = new THREE.Group(); coneStack.position.set(-1.07, LEDGE, ROW); S.add(coneStack);
  const csBase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.12, 20), fluffMat(0xffffff, 0.3)); csBase.position.y = 0.06; coneStack.add(csBase);
  const stackCones = [];
  for (let i = 0; i < 3; i++) { const c = makeCone(); c.position.y = 0.2 + i * 0.045; coneStack.add(c); stackCones.push(c); }
  const holder = new THREE.Group(); holder.position.set(-0.58, LEDGE, ROW); S.add(holder);
  const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.03, 20), mat(0xffffff)); hb.position.y = 0.015; holder.add(hb);
  const hs = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2), mat(0xdedede, { metalness: 0.8, roughness: 0.3 })); hs.position.y = 0.11; holder.add(hs);
  const hr = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.01, 8, 20), mat(0xff8fc4)); hr.rotation.x = Math.PI / 2; hr.position.y = 0.17; holder.add(hr);
  const CONE_AT = V(-0.58, LEDGE + 0.24, ROW);
  const bottle = (kind, x) => {
    const g = new THREE.Group(); g.position.set(x, LEDGE, ROW + 0.02);
    const m = new THREE.MeshPhysicalMaterial({ color: SAUCES[kind].color, roughness: 0.3, clearcoat: 0.8 });
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.19, 20), m); b.position.y = 0.095; g.add(b);
    const n = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 16), mat(0xffffff)); n.position.y = 0.225; g.add(n);
    const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.07, 20, 1, true, -0.8, 1.6), mat(kind === 'choco' ? 0xf0d0b0 : 0xffd0dc)); lab.position.y = 0.09; g.add(lab);
    g.userData.kind = kind; shadowy(g); S.add(g); return g;
  };
  const sauces = [bottle('choco', -0.18), bottle('straw', 0.04)];
  const jar = new THREE.Group(); jar.position.set(0.32, LEDGE, ROW); S.add(jar);
  { const j = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.13, 20), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.05 })); j.position.y = 0.065; jar.add(j);
    const sp = makeSprinkles(); sp.scale.set(0.75, 0.6, 0.75); sp.position.y = 0.02; jar.add(sp); const sp2 = makeSprinkles(); sp2.scale.set(0.7, 0.4, 0.7); sp2.position.y = 0.06; jar.add(sp2);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.025, 20), fluffMat(0xffffff, 0.2)); lid.position.y = 0.14; jar.add(lid); shadowy(jar); }
  const bowl = new THREE.Group(); bowl.position.set(0.58, LEDGE, ROW); S.add(bowl);
  { const b = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0xffffff, { side: THREE.DoubleSide })); b.position.y = 0.085; bowl.add(b);
    for (let i = 0; i < 4; i++) { const c = makeCherry(); c.position.set(Math.cos(i * 1.6) * 0.035, -0.02, Math.sin(i * 1.6) * 0.035); bowl.add(c); } shadowy(bowl); }
  // register
  const reg = new THREE.Group(); reg.position.set(1.08, LEDGE, ROW - 0.05); S.add(reg);
  const regM = fluffMat(0xffffff, 0.5);
  { const b = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.14, 0.3, 2, 0.03), regM); b.position.y = 0.07; reg.add(b);
    const top = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.1, 0.18, 2, 0.03), regM); top.position.set(0, 0.17, 0.02); top.rotation.x = -0.5; reg.add(top);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.06), new THREE.MeshStandardMaterial({ color: 0x9ff7c9, emissive: 0x5fe0a0, emissiveIntensity: 0.5 })); scr.position.set(0, 0.2, -0.04); scr.rotation.set(Math.PI - 0.5, 0, Math.PI); reg.add(scr); reg.userData.scr = scr;
    for (let i = 0; i < 6; i++) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), mat([0xff5fae, 0xffe066, 0x7fd8ff][i % 3])); k.position.set(-0.06 + (i % 3) * 0.06, 0.15 - Math.floor(i / 3) * 0.035, -0.06 - Math.floor(i / 3) * 0.02); reg.add(k); }
    const dr = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.05, 0.28, 2, 0.015), mat(0xfff0f6)); dr.position.set(0, 0.025, 0); reg.add(dr); reg.userData.drawer = dr;
    shadowy(reg); }
  // girl on her stool
  const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.4, 24), fluffMat(0xffffff, 0.5)); stool.position.set(P ? -1.45 : -1.65, 0.65, 0.3); shadowy(stool); S.add(stool);
  girl.root.visible = true; girl.root.position.set(stool.position.x, 0.85, 0.3); girl.root.rotation.y = 2.55; girl.lookAt(0);
  // bubble
  const bubTex = canvasTex(256, 256, () => {});
  const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubTex, depthTest: false, transparent: true })); bubble.renderOrder = 20;
  bubble.position.set(0.5, 2.05, 0.9); bubble.scale.setScalar(0); S.add(bubble);

  await setShot({ look: V(-0.4, 1.45, 0.75), dir: V(0, 0.3, -1), w: P ? 3.1 : 3.4, h: 1.9 }, 0);
  await fade(0, 0.6);
  SFX.jingle();

  // ---------- making state ----------
  let cur = null; // {g, scoops:[], sauce, tops:Set, busy}
  let busy = false, customer = null, order = null, phase = 'idle', bug = null;
  let resolveServe = null, resolveReg = null;
  const topY = () => 0.035 + Math.max(0, cur.scoops.length - 1) * 0.12;
  const girlDo = (pose = 'reach') => { girl.pose(pose, 0.6); girl.face('happy', 0.8); };
  const lock = async (fn) => { if (busy) return; busy = true; try { await fn(); } finally { busy = false; } };

  async function getCone() {
    if (cur) return;
    const c = stackCones[stackCones.length - 1];
    const wp = new THREE.Vector3(); c.getWorldPosition(wp);
    S.attach(c);
    girlDo(); SFX.whoosh();
    await arcTo(c, CONE_AT, 0.45, 0.25);
    SFX.pop(); squash(c, 0.15, 0.3);
    // refill stack
    const n = makeCone(); n.position.y = 0.2 + 2 * 0.045; n.scale.setScalar(0); coneStack.add(n); stackCones.pop(); stackCones.unshift(n);
    stackCones.forEach((s, i) => s.position.y = 0.2 + i * 0.045); scaleTo(n, 1, 0.3);
    cur = { g: c, scoops: [], sauce: null, tops: new Set(), meshes: [] };
    tappable(c, tryServe);
  }
  const addScoop = (tub) => lock(async () => {
    await getCone();
    if (cur.scoops.length >= 3) { SFX.boing(); squash(cur.g, 0.2); return; }
    const f = tub.userData.flavor;
    const s = makeScoop(f); const wp = new THREE.Vector3(); tub.getWorldPosition(wp); s.position.copy(wp).add(V(0, 0.12, 0)); s.scale.setScalar(0.2); S.add(s);
    girlDo(); SFX.scoop(); squash(tub, 0.2, 0.3);
    await scaleTo(s, 1, 0.2);
    cur.scoops.push(f);
    const target = cur.g.localToWorld(V(0, topY(), 0));
    await arcTo(s, target, 0.45, 0.35);
    cur.g.attach(s); s.position.set(0, topY(), 0); cur.meshes.push(s);
    SFX.plop(); squash(s, 0.25, 0.4); FX.sparkle(target, 5);
    // lift sauce/toppings on top
    for (const m of cur.g.children) if (m.userData.onTop) m.position.y = topY();
    if (bug && bug.userData.onCone) bug.position.y = topY() + 0.1;
    if (onFirstScoop && cur.scoops.length === 1) { const f2 = onFirstScoop; onFirstScoop = null; f2(); }
  });
  const addSauce = (b) => lock(async () => {
    await getCone();
    if (!cur.scoops.length || cur.sauce) { SFX.boing(); squash(b, 0.2); return; }
    const home = b.position.clone();
    girlDo(); SFX.whoosh();
    await arcTo(b, cur.g.localToWorld(V(0.02, topY() + 0.3, 0)), 0.4, 0.2);
    await tween(0.2, t => b.rotation.z = Math.PI * 0.85 * t);
    SFX.squirt();
    const sm = makeSauce(b.userData.kind); sm.userData.onTop = true; sm.position.y = topY(); sm.scale.setScalar(0.01); cur.g.add(sm);
    await tween(0.45, t => sm.scale.set(1.05 * t + 0.01, 1, 1.05 * t + 0.01));
    sm.scale.setScalar(1.05);
    cur.sauce = b.userData.kind;
    await tween(0.2, t => b.rotation.z = Math.PI * 0.85 * (1 - t));
    await arcTo(b, home, 0.4, 0.2);
  });
  const addTopping = (kind, src) => lock(async () => {
    await getCone();
    if (!cur.scoops.length || cur.tops.has(kind)) { SFX.boing(); squash(src, 0.2); return; }
    girlDo();
    if (kind === 'sprinkles') {
      const home = src.position.clone();
      SFX.whoosh();
      await arcTo(src, cur.g.localToWorld(V(0, topY() + 0.32, 0)), 0.4, 0.2);
      await tween(0.15, t => src.rotation.z = 2.6 * t);
      SFX.sprinkle();
      const sp = makeSprinkles(); sp.userData.onTop = true; sp.position.y = topY() + 0.12; cur.g.add(sp);
      await tween(0.3, t => sp.position.y = topY() + 0.12 * (1 - t), ease.bounce);
      await tween(0.15, t => src.rotation.z = 2.6 * (1 - t));
      await arcTo(src, home, 0.4, 0.2);
    } else {
      const c = makeCherry(); const wp = new THREE.Vector3(); src.getWorldPosition(wp); c.position.copy(wp).add(V(0, 0.02, 0)); S.add(c);
      SFX.pop();
      await arcTo(c, cur.g.localToWorld(V(0, topY(), 0)), 0.45, 0.3);
      cur.g.attach(c); c.position.set(0, topY(), 0); c.rotation.set(0, 0, 0); c.userData.onTop = true;
      SFX.plop(); squash(c, 0.3, 0.4);
    }
    cur.tops.add(kind);
    FX.sparkle(cur.g.localToWorld(V(0, topY() + 0.1, 0)), 6);
  });
  tubs.forEach(t => tappable(t, () => addScoop(t)));
  sauces.forEach(b => tappable(b, () => addSauce(b)));
  tappable(jar, () => addTopping('sprinkles', jar));
  tappable(bowl, () => addTopping('cherry', bowl));
  tappable(coneStack, () => lock(async () => { if (cur) { SFX.boing(); squash(cur.g, 0.2); return; } await getCone(); }));
  const tryServe = () => lock(async () => {
    if (phase !== 'order' || !cur || !cur.scoops.length) { if (customer && phase === 'order') { customer.pose('wave', 0.8); SFX.yay(0.9); } return; }
    if (resolveServe) { const r = resolveServe; resolveServe = null; await r(); }
  });
  tappable(holder, tryServe);
  let onFirstScoop = null;
  tappable(reg, () => lock(async () => { if (phase !== 'pay') { SFX.pip(); squash(reg, 0.1); return; } if (resolveReg) { const r = resolveReg; resolveReg = null; await r(); } }));
  tappable(girl.root, () => { girl.face('laugh', 1); girl.pose('jump', 0.6); SFX.giggle(1.3); });

  // hints
  setHint(() => {
    if (phase === 'pay') return reg;
    if (phase !== 'order' || !order) return null;
    if (bug) return bug;
    if (!cur) return stackCones[stackCones.length - 1];
    const n = cur.scoops.length;
    if (n < order.scoops.length) return tubs[flavors.indexOf(order.scoops[n])];
    if (order.sauce && !cur.sauce) return sauces.find(s => s.userData.kind === order.sauce);
    for (const t of order.toppings) if (!cur.tops.has(t)) return t === 'cherry' ? bowl : jar;
    return cur.g;
  });

  // ---------- customers ----------
  const POS = V(-0.15, 0.3, 1.58);
  async function arrive(c) {
    c.root.visible = true; c.root.position.set(4.2, 0, 2.8); c.face('smile'); c.st.baseY = 0;
    await c.walkTo(-0.15, 2.25, 2.0);
    await tween(0.3, t => { c.root.position.z = 2.25 + (POS.z - 2.25) * t; c.root.position.y = 0.3 * t + Math.sin(t * Math.PI) * 0.15; });
    await c.turn(Math.PI);
    c.pose('wave', 1); SFX.yay(c.s > 1.3 ? 0.8 : 1.1);
  }
  async function leave(c) {
    untappable(c.root);
    c.pose('wave', 1); await wait(0.6);
    await c.turn(-Math.PI / 2);
    await tween(0.3, t => { c.root.position.z = POS.z + 0.6 * t; c.root.position.y = 0.3 * (1 - t) + Math.sin(t * Math.PI) * 0.12; });
    await c.walkTo(-4.5, 2.6, 2.0);
    c.root.visible = false;
  }
  function showBubble(o) {
    drawOrder(bubTex.userData.g, o); bubTex.needsUpdate = true; SFX.pop();
    return tween(0.35, t => bubble.scale.setScalar(0.62 * t), ease.back);
  }
  function hideBubble() { return tween(0.2, t => bubble.scale.setScalar(0.62 * (1 - t))); }
  const same = (o, c) => o.scoops.slice().sort().join() === c.scoops.slice().sort().join() && (o.sauce || null) === (c.sauce || null) && o.toppings.slice().sort().join() === [...c.tops].sort().join();

  async function handOver(c) {
    const ice = cur.g;
    c.pose('reach2', 0.8); await wait(0.25);
    const hp = new THREE.Vector3(); c.hand(1).getWorldPosition(hp);
    SFX.whoosh(); girlDo('reach');
    if (bug && bug.userData.onCone) await bugHopOff(true);
    await arcTo(ice, hp.add(V(0, 0.1, 0)), 0.45, 0.2);
    c.hand(1).attach(ice); ice.position.set(0, 0.12, 0); ice.rotation.set(0, 0, 0);
    ice.scale.setScalar(1 / c.s);
    const ok = same(order, cur);
    const result = cur; cur = null;
    await hideBubble();
    if (ok) {
      c.face('wow', 0.6); SFX.happy(); await wait(0.5);
      c.face('laugh', 1.6); c.pose('jump', 0.8); FX.hearts(hp, 8); SFX.yay(c.s > 1.3 ? 0.8 : 1.1);
    } else {
      c.face('are', 1.4); c.pose('think', 1.4); SFX.are(c.s > 1.3 ? 0.85 : 1.1); girl.face('wow', 1.2);
      await wait(1.5);
      c.face('laugh', 1.6); c.pose('jump', 0.8); FX.hearts(hp, 6); SFX.yay(c.s > 1.3 ? 0.8 : 1.1);
    }
    girl.face('laugh', 1.4); girl.pose('clap', 1.2);
    await wait(1.0);
    c.pose('lick', 2.5); c.face('yum', 2.5);
    return { ok, ice, result };
  }
  async function pay(c) {
    phase = 'pay'; pulse(reg);
    await new Promise(r => resolveReg = async () => {
      pulse(reg, false);
      girlDo('reach'); SFX.pip(); reg.userData.scr.material.emissiveIntensity = 2;
      const dr = reg.userData.drawer;
      await tween(0.2, t => dr.position.z = -0.14 * t);
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 24), mat(0xffd34d, { metalness: 0.9, roughness: 0.25 }));
      const hp = new THREE.Vector3(); c.head.getWorldPosition(hp); coin.position.copy(hp).add(V(0.15, -0.2, -0.1)); coin.rotation.x = Math.PI / 2; S.add(coin);
      const dp = new THREE.Vector3(); dr.getWorldPosition(dp);
      await tween(0.6, t => { coin.position.lerpVectors(hp.clone().add(V(0.15, -0.2, -0.1)), dp.clone().add(V(0, 0.05, 0)), t); coin.position.y += Math.sin(t * Math.PI) * 0.35; coin.rotation.y += 0.3; });
      S.remove(coin);
      SFX.ching(); FX.sparkle(dp.clone().add(V(0, 0.1, 0)), 10);
      await tween(0.2, t => dr.position.z = -0.14 * (1 - t));
      reg.userData.scr.material.emissiveIntensity = 0.5;
      girl.face('laugh', 1); girl.pose('cheer', 0.8);
      r();
    });
    phase = 'idle';
  }
  async function takeOrder(c, o) {
    order = o; customer = c; phase = 'order';
    tappable(c.root, tryServe);
    await showBubble(o);
    c.pose('point', 0.8);
    return new Promise(res => { resolveServe = async () => { phase = 'serving'; res(await handOver(c)); }; });
  }

  // splat & sponge for the dropped ice cream
  async function dropEvent(c, served) {
    await wait(1.2);
    const ice = served.ice;
    const wp = new THREE.Vector3(); ice.getWorldPosition(wp);
    S.attach(ice); ice.scale.setScalar(1);
    c.face('wow', 1); SFX.whoosh();
    const spot = V(-0.28, LEDGE + 0.01, 1.04);
    await tween(0.55, t => { ice.position.lerpVectors(wp, spot, t); ice.position.y += Math.sin(t * Math.PI) * 0.15; ice.rotation.z = t * 2.0; }, ease.in);
    SFX.splat(); shake(0.03);
    S.remove(ice);
    const splat = new THREE.Group(); splat.position.copy(spot); S.add(splat);
    const blobM = new THREE.MeshPhysicalMaterial({ color: FLAVORS.vanilla.color, roughness: 0.4, clearcoat: 0.6, transparent: true });
    const blobM2 = new THREE.MeshPhysicalMaterial({ color: FLAVORS.choco.color, roughness: 0.4, clearcoat: 0.6, transparent: true });
    const mk = (m, r, x, z) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m); b.scale.y = 0.3; b.position.set(x, 0, z); splat.add(b); };
    mk(blobM, 0.12, -0.04, 0); mk(blobM2, 0.1, 0.07, 0.02); mk(blobM, 0.035, 0.18, -0.05); mk(blobM2, 0.03, -0.17, 0.05); mk(blobM2, 0.028, 0.02, -0.1);
    const lc = makeCone(); lc.rotation.z = 1.6; lc.position.set(0.12, 0.07, -0.04); splat.add(lc);
    c.face('sad', 3); c.pose('sad', 3); SFX.sad();
    girl.face('wow', 1.2);
    await wait(1.0);
    // sponge appears
    const sponge = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.06, 0.1, 3, 0.025), fluffMat(0xffffff, 0.25)); sponge.position.set(-0.2, LEDGE + 0.04, 0.68); sponge.castShadow = true; S.add(sponge);
    FX.puff(sponge.position.clone(), 6, 0xffc4e4, 0.2); SFX.pop(); pulse(sponge);
    phase = 'clean';
    let dirt = 1, armed = false;
    const prevHint = null;
    setHint(() => armed ? splat : sponge);
    await new Promise(res => {
      const clean = (amt) => {
        dirt -= amt;
        const k = Math.max(dirt, 0);
        splat.children.forEach(m => { if (m.material.transparent) m.material.opacity = k; });
        splat.scale.setScalar(0.4 + 0.6 * k);
        if (Math.random() < 0.5) FX.sparkle(spot.clone().add(V(0, 0.05, 0)), 2);
        if (dirt <= 0) { input.onMove = null; untappable(splat); untappable(sponge); res(); }
      };
      tappable(sponge, async () => {
        if (armed) return; armed = true; pulse(sponge, false); girlDo(); SFX.whoosh();
        await arcTo(sponge, spot.clone().add(V(0, 0.05, 0)), 0.4, 0.15);
      });
      tappable(splat, async () => {
        if (!armed) { armed = true; pulse(sponge, false); }
        girlDo(); SFX.wipe();
        const p = spot.clone().add(V((Math.random() - .5) * 0.15, 0.05, (Math.random() - .5) * 0.06));
        await arcTo(sponge, p, 0.15, 0.05);
        clean(0.26);
      });
      let lastP = null;
      input.onMove = (e) => {
        if (!armed) return;
        const h = pickAt(e.clientX, e.clientY, [ledge, splat]);
        if (!h) return;
        const p = h.point; sponge.position.set(p.x, LEDGE + 0.05, p.z);
        if (lastP && p.distanceTo(spot) < 0.3) { const d = p.distanceTo(lastP); if (d > 0.01) { clean(d * 1.4); if (Math.random() < 0.3) SFX.wipe(); } }
        lastP = p.clone();
      };
    });
    S.remove(splat);
    SFX.sparkle(); FX.sparkle(spot.clone().add(V(0, 0.1, 0)), 20);
    girl.face('laugh', 1.4); girl.pose('cheer', 1);
    await tween(0.4, t => sponge.scale.setScalar(1 - t)); S.remove(sponge);
    c.face('happy', 1); c.pose('jump', 0.6); SFX.yay(1.1);
    await wait(0.6);
  }

  // toy bug that hops into the ice cream
  async function bugEvent() {
    const g = new THREE.Group();
    const shellTex = canvasTex(128, 64, c => { c.fillStyle = '#ff4466'; c.fillRect(0, 0, 128, 64); c.fillStyle = '#3a2030'; for (const [x, y] of [[20, 20], [50, 38], [80, 18], [108, 40], [36, 52], [94, 52]]) { c.beginPath(); c.arc(x, y, 8, 0, 7); c.fill(); } c.fillRect(62, 0, 4, 64); });
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ map: shellTex, roughness: 0.2, clearcoat: 1 })); g.add(shell);
    const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.02, 20), mat(0xffe0ea)); belly.position.y = -0.005; g.add(belly);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), mat(0x3a2030, { roughness: 0.4 })); head.position.set(0, 0.015, 0.06); g.add(head);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8), mat(0xffffff)); e.position.set(s * 0.015, 0.03, 0.088); g.add(e);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), mat(0x111111)); p.position.set(s * 0.015, 0.03, 0.099); g.add(p);
      const ant = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), mat(0xffd34d)); ant.position.set(s * 0.02, 0.07, 0.07); g.add(ant);
    }
    const key = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 6, 14), mat(0xffd34d, { metalness: 0.8, roughness: 0.3 })); key.position.set(0, 0.07, -0.03); g.add(key);
    const keyR = onUpdate(dt => key.rotation.z += dt * 6);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.userData.proxy = true; g.add(hit);
    g.position.set(1.3, LEDGE + 0.02, 1.06); g.rotation.y = -Math.PI / 2; g.scale.setScalar(1.3);
    shadowy(g); hit.castShadow = false; S.add(g);
    bug = g; g.userData.keyR = keyR;
    SFX.giggle(1.6);
    const from = g.position.clone(), to = V(-0.35, LEDGE + 0.02, 1.06);
    await tween(1.4, t => { g.position.lerpVectors(from, to, t); g.position.y += Math.abs(Math.sin(t * 18)) * 0.02; }, ease.lin);
    if (!cur || bug !== g) { await bugHopOff(false); return; }
    SFX.boing();
    const top = cur.g.localToWorld(V(0, topY() + 0.1, 0));
    await arcTo(g, top, 0.5, 0.25);
    cur.g.attach(g); g.position.set(0, topY() + 0.1, 0); g.rotation.set(0, Math.PI, 0); g.userData.onCone = true;
    SFX.giggle(1.5);
    girl.face('wow', 1.5); if (customer) { customer.face('wow', 1.5); }
    tappable(g, () => bugHopOff(true));
  }
  async function bugHopOff(funny) {
    const g = bug; if (!g || g.userData.leaving) return; g.userData.leaving = true;
    untappable(g);
    const wp = new THREE.Vector3(); g.getWorldPosition(wp); S.attach(g); g.userData.onCone = false;
    girlDo('reach'); SFX.boing();
    await arcTo(g, V(1.6, LEDGE + 0.6, 1.3), 0.7, 0.5, ease.out, 6);
    SFX.giggle(1.7); FX.puff(g.position.clone(), 5, 0xffffff, 0.2);
    g.userData.keyR(); S.remove(g); bug = null;
    if (funny) { girl.face('laugh', 1.2); girl.pose('clap', 1); if (customer) customer.face('laugh', 1.2); SFX.laugh(1.2); }
  }

  // ---------- the run ----------
  const orders = [
    { c: customers[0], o: { scoops: ['straw'], sauce: null, toppings: [] } },
    { c: customers[1], o: { scoops: ['vanilla', 'choco'], sauce: 'choco', toppings: [] }, drop: true },
    { c: customers[2], o: { scoops: ['mint'], sauce: null, toppings: ['sprinkles'] }, bug: true },
    { c: dad, o: { scoops: ['straw', 'vanilla', 'choco'], sauce: 'straw', toppings: ['cherry'] }, dad: true },
  ];
  for (const it of orders) {
    const c = it.c;
    await arrive(c);
    if (it.bug) onFirstScoop = () => bugEvent();
    let served = await takeOrder(c, it.o);
    if (it.drop) {
      await dropEvent(c, served);
      c.face('smile');
      served = await takeOrder(c, it.o);
    }
    await wait(0.5);
    await pay(c);
    if (it.dad) break;
    await leave(c);
    // tidy: drop eaten ice cream
    if (served.ice.parent) served.ice.parent.remove(served.ice);
  }
  // dad is thrilled and runs off to the pool, waving her along
  setHint(null);
  dad.face('laugh', 2); dad.pose('cheer', 1.5); SFX.laugh(0.8);
  FX.confetti(V(-0.2, 2.0, 1.2), 40); SFX.fanfare();
  girl.face('laugh', 2); girl.pose('cheer', 2);
  await wait(1.8);
  dad.pose('wave', 1.2); await wait(0.8);
  await dad.turn(-Math.PI / 2);
  await tween(0.3, t => { dad.root.position.z = POS.z + 0.6 * t; dad.root.position.y = 0.3 * (1 - t); });
  dad.walkTo(-5, 2.8, 3.2);
  await wait(0.8);
  await fade(1, 0.5);
  offB();
  for (const c of [...customers, dad]) { c.root.visible = false; }
  // keep dad's ice cream for the pool scene
  const dadIce = dad.hand(1).children.find(o => o.isGroup);
  S.clear();
  return dadIce;
}
