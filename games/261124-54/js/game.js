// game: dress-up -> restaurant -> hotel desk -> bath -> garden trampoline + photo
import * as THREE from 'three';
import {
  renderer, tween, wait, ease, moveTo, camTo, setCam, onUpdate, resetScene, onTap, removeTap, beginDrag,
  rayPlaneY, toScreen, nearestOnScreen, current, fadeTo, lastInput, time, setRay,
} from './core.js';
import {
  M, std, mesh, tex, canvasTex, makeChar, animChar, setPose, armsTo, ARMS_DOWN, cheer, clap, hop, walkTo, turnTo,
  makeApron, makeChefHat, makeBubble, iconSprite, drawIcon, drawTag, makeDish, makeChair, makeTable, makeBell, ringBell,
  makeLamp, makeFrame, makeRoom, makeWindow, lights, sparkle, floatIcon, bowlGeo, plate, hitProxy,
} from './art.js';
import { sfx, waterOn, waterOff, playMusic } from './sound.js';

const params = new URLSearchParams(location.search);
const G = { cast: null, girl: null, photo: null, held: null, busy: false, dbg: {} };
window.__G = G; G.toScreen = toScreen; G.dbg.go = (i) => goScene(i);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const minDim = () => Math.min(window.innerWidth, window.innerHeight);

// ---------- cast ----------
function makeCast() {
  const girl = makeChar({ name: 'girl', size: 0.62, shirt: 0xffb8cc, skirt: 0xff7aa2, hair: 0x3b2314, hairStyle: 'pigtails', lashes: true, shoes: 0xd8344f });
  const mama = makeChar({ name: 'mama', size: 1, shirt: 0x7fc8a9, skirt: 0x3d5a80, hair: 0x6b3a1f, hairStyle: 'long', lashes: true, shoes: 0x5a3a2a });
  const papa = makeChar({ name: 'papa', size: 1.04, shirt: 0x4f86c6, pants: 0x3b3b4f, hair: 0x2b1d14, hairStyle: 'short', wide: 1.1 });
  const grandpa = makeChar({ name: 'grandpa', size: 0.96, shirt: 0xc89b6d, pants: 0x6b6b6b, hair: 0xeeeeee, hairStyle: 'bald', glasses: true, mustache: true, wide: 1.15 });
  const neighbor = makeChar({ name: 'neighbor', size: 0.95, shirt: 0xf4c542, skirt: 0x8e5ea2, hair: 0xc0763a, hairStyle: 'curly', lashes: true });
  return { girl, mama, papa, grandpa, neighbor };
}
function animate(list) { onUpdate((dt, t) => list.forEach(c => animChar(c, dt, t))); }
function place(c, x, z, ry = 0, y = 0) { c.g.position.set(x, y, z); c.g.rotation.set(0, ry, 0); setPose(c, 'stand'); c.rig.position.set(0, 0, 0); c.arms[0].rotation.set(0, 0, -0.12); c.arms[1].rotation.set(0, 0, 0.12); c.anim = null; c.walking = 0; c.g.visible = true; c.g.scale.setScalar(1); c.legs.forEach(l => { l.visible = true; }); }
function girlReact(e, d = 1.4) { G.girl.setExpr(e, d); }

// ---------- generic carry (drag or tap-then-tap) ----------
function lift(obj, h = 0.25) { const y0 = obj.position.y; return tween(0.15, k => { obj.position.y = y0 + h * k; }, ease.out); }
function arc(obj, to, h = 0.6, dur = 0.55) {
  const from = obj.position.clone();
  return tween(dur, k => { obj.position.lerpVectors(from, to, k); obj.position.y += Math.sin(k * Math.PI) * h; }, ease.inOut);
}
function grabbable(obj, o) {
  // o: { home: Vector3, planeY, targets: () => [{pos(), drop(obj)}], enabled() }
  obj.userData.home = o.home.clone();
  obj.userData.grab = o;
  return onTap(obj, (p, info) => pick(obj, o), () => !G.busy && (!o.enabled || o.enabled()));
}
function pick(obj, o) {
  if (G.held && G.held !== obj) putBack(G.held);
  G.held = obj; obj.userData.dragging = true;
  sfx.swish(); girlReact('wow', 0.8);
  obj.position.y = obj.userData.home.y + 0.25;
  beginDrag({
    move(sx, sy) {
      const p = rayPlaneY(sx, sy, o.planeY);
      if (p) obj.position.set(p.x, o.planeY, p.z);
    },
    up(sx, sy, info) {
      obj.userData.dragging = false;
      const t = findTarget(o, sx, sy);
      if (t && info.moved) { G.held = null; t.drop(obj); }
      else if (info.moved) putBack(obj);
      else { obj.position.copy(obj.userData.home); obj.position.y += 0.25; }
    },
  });
}
function findTarget(o, sx, sy) { return nearestOnScreen(o.targets(), sx, sy, Math.max(70, minDim() * 0.16)); }
function putBack(obj) {
  if (G.held === obj) G.held = null;
  obj.userData.dragging = false;
  arc(obj, obj.userData.home, 0.15, 0.3);
}
function heldPreTap(sx, sy) {
  const obj = G.held;
  if (!obj || obj.userData.dragging) return false;
  const t = findTarget(obj.userData.grab, sx, sy);
  if (t) { G.held = null; t.drop(obj); return true; }
  return false;
}
function heldBob(dt, t) {
  const o = G.held;
  if (o && !o.userData.dragging) o.position.y = o.userData.home.y + 0.25 + Math.sin(t * 5) * 0.03;
}

// ---------- hints: gently bounce what can be touched after a quiet moment ----------
let hintT = 0;
function hintUpdater(getList) {
  onUpdate((dt) => {
    if (performance.now() - lastInput < 6500 || G.busy) { hintT = 0; return; }
    hintT -= dt;
    if (hintT > 0) return;
    hintT = 2.6;
    for (const o of getList()) {
      if (!o || !o.parent) continue;
      const s0 = o.userData.baseScale || (o.userData.baseScale = o.scale.clone());
      tween(0.5, k => { o.scale.copy(s0).multiplyScalar(1 + Math.sin(k * Math.PI) * 0.22); }, ease.linear);
      const p = new THREE.Vector3(); o.getWorldPosition(p); p.y += 0.15;
      sparkle(current.scene.root, p, 3, 0.3, 0xffffff, 0.5);
    }
  });
}

// ---------- scene switching ----------
const scenes = [sceneDress, sceneRestaurant, sceneHotel, sceneBath, sceneGarden];
let sceneIndex = -1;
export async function goScene(i, instant = false) {
  if (!instant) { sfx.whoosh(); await fadeTo(1, 0.45); }
  waterOff();
  resetScene();
  G.held = null; G.busy = false;
  sceneIndex = i;
  const sc = scenes[i]();
  current.scene = sc;
  playMusic(i === 4 ? 3 : i === 3 ? 2 : i === 2 ? 1 : 0);
  onUpdate(heldBob);
  await fadeTo(0, 0.6);
  if (sc.start) sc.start();
}
export function boot() {
  G.cast = makeCast(); G.girl = G.cast.girl;
  // apply outfit immediately when jumping straight into a later scene (debug / thumbnail)
  const s = parseInt(params.get('scene') || '0', 10);
  if (s > 0) { wearApron(); wearHat(); }
  goScene(s, true);
}
function wearApron() {
  if (G.girl.apron) return G.girl.apron;
  const ap = makeApron(G.girl); ap.position.copy(G.girl.torso.position); ap.position.y -= 0.02;
  G.girl.rig.add(ap); G.girl.apron = ap; return ap;
}
function wearHat() {
  if (G.girl.hat) return G.girl.hat;
  const h = makeChefHat(); h.scale.setScalar(0.95); h.position.set(0, G.girl.headR * 0.78, -0.02); h.rotation.x = -0.12;
  G.girl.head.add(h); G.girl.hat = h; return h;
}

// =====================================================================
// 0. dress up: apron on the hook, hat on the table, brass bell to open
// =====================================================================
function sceneDress() {
  const root = new THREE.Scene(); root.background = new THREE.Color(0xf3e6d3);
  lights(root, { sunPos: [2, 6, 5], shadowExt: 4, sun: 2.0 });
  const room = makeRoom({ w: 7, d: 5, h: 3.2, z0: 0.5 }); root.add(room);
  const win = makeWindow(1.4, 1.3, tex('window', 1)); win.position.set(-0.2, 1.75, -1.98); root.add(win);
  const girl = G.girl; root.add(girl.g); place(girl, 0, 0.1, 0);
  girl.setExpr('smile');
  animate([girl]);

  // coat stand with the apron
  const stand = new THREE.Group(); stand.position.set(-1.25, 0, -0.2); root.add(stand);
  stand.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 12), M.brass, 0, 0.8, 0));
  stand.add(mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.04, 24), M.brass, 0, 0.02, 0));
  const hook = mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 16, Math.PI), M.brass, 0.05, 1.5, 0.05); hook.rotation.z = Math.PI; stand.add(hook);
  const apronItem = makeApron(girl); apronItem.position.set(-1.25, 1.12, -0.05); root.add(apronItem);
  const apronHit = hitProxy(new THREE.BoxGeometry(0.5, 0.7, 0.4)); apronItem.add(apronHit);

  // small round table with white tablecloth holding the hat and the brass bell
  const table = makeTable(0.45); table.position.set(1.25, 0, -0.1); table.scale.y = 0.85; root.add(table);
  table.children.slice(2).forEach(ch => ch.visible = false); // no vase here
  const hat = makeChefHat(); hat.position.set(1.12, 0.66, -0.15); root.add(hat);
  const hatHit = hitProxy(new THREE.BoxGeometry(0.45, 0.45, 0.45)); hatHit.position.y = 0.15; hat.add(hatHit);
  const bell = makeBell(2.2); bell.position.set(1.2, 0.655, 0.2); root.add(bell);
  bell.visible = false;

  // mirror frame on the wall shows... a smile sign (simple decoration)
  const art = makeFrame(0.7, 0.5, canvasTex(256, 180, (c, w, h) => { c.fillStyle = '#fbe9d0'; c.fillRect(0, 0, w, h); drawIcon(c, 'soup', 70, 95, 90); drawIcon(c, 'cake', 186, 95, 90); }));
  art.position.set(1.6, 1.85, -1.97); root.add(art);

  setCam(V(0, 1.25, 4.4), V(0, 0.85, 0), 3.6, 2.1);
  let dressed = 0;
  async function dressDone() {
    dressed++;
    if (dressed < 2) return;
    G.busy = true;
    await wait(0.3);
    girl.setExpr('wow'); sfx.sparkle();
    sparkle(root, V(0, 1.0, 0.3), 18, 0.7);
    await turnTo(girl, Math.PI, 0.35); await turnTo(girl, Math.PI * 2, 0.35); girl.g.rotation.y = 0;
    girl.setExpr('happy');
    await cheer(girl, 0.8);
    // take her portrait now (used at the very end)
    capturePortrait(root, girl);
    bell.visible = true; bell.scale.setScalar(0.01);
    await tween(0.4, k => bell.scale.setScalar(Math.max(0.01, 2.2 * k)), ease.back);
    bell.userData.baseScale = bell.scale.clone();
    sparkle(root, V(1.45, 0.8, 0.12), 10, 0.4);
    G.busy = false;
    girl.setExpr('smile');
  }
  const apronT = onTap(apronItem, async () => {
    removeTap(apronT); G.busy = true; sfx.swish();
    const p = girl.torso.getWorldPosition(new THREE.Vector3());
    await arc(apronItem, p, 0.5, 0.6);
    root.remove(apronItem); wearApron(); sfx.pop(); sparkle(root, p, 10, 0.4);
    girl.setExpr('happy', 1.2); G.busy = false; dressDone();
  });
  const hatT = onTap(hat, async () => {
    removeTap(hatT); G.busy = true; sfx.swish();
    const p = girl.headTop();
    await arc(hat, p.clone().add(V(0, 0.05, 0)), 0.5, 0.6);
    root.remove(hat); wearHat(); sfx.pop(); sparkle(root, p, 10, 0.4);
    girl.setExpr('happy', 1.2); G.busy = false; dressDone();
  });
  onTap(bell, async () => {
    if (G.busy || !bell.visible || dressed < 2) return;
    G.busy = true;
    ringBell(bell); sfx.ding();
    girl.setExpr('laugh');
    await wait(1.1);
    goScene(1);
  });
  // tapping the girl makes her giggle and hop
  onTap(girl.g, async () => { if (G.busy) return; sfx.giggle(); girl.setExpr('laugh', 1); hop(girl, 0.15, 0.3); });
  hintUpdater(() => dressed < 2 ? [apronItem.parent ? apronItem : null, hat.parent ? hat : null] : [bell]);
  return { root, start() { tween(1.6, k => { /* gentle intro dolly */ }, ease.linear); } };
}

let portraitRT = null;
function capturePortrait(root, girl) {
  portraitRT = new THREE.WebGLRenderTarget(512, 640, { samples: 4 });
  const cam = new THREE.PerspectiveCamera(24, 512 / 640, 0.1, 50);
  const h = girl.head.getWorldPosition(new THREE.Vector3());
  cam.position.set(h.x + 0.25, h.y + 0.1, h.z + 1.9);
  cam.lookAt(h.x, h.y - 0.02, h.z);
  renderer.setRenderTarget(portraitRT);
  renderer.render(root, cam);
  renderer.setRenderTarget(null);
  G.photo = portraitRT.texture;
}

// =====================================================================
// 1. restaurant: orders in bubbles, cook at 3 stations, papa spills, dessert
// =====================================================================
function sceneRestaurant() {
  const C = G.cast;
  const root = new THREE.Scene(); root.background = new THREE.Color(0xf3e6d3);
  lights(root, { sunPos: [3, 10, 7], shadowExt: 9, sun: 2.0, env: 0.6 });
  const room = makeRoom({ w: 12, d: 11, h: 3.6, z0: 2.3 }); root.add(room);
  const backZ = room.userData.backZ;
  for (const x of [-1.4, 1.9]) { const w = makeWindow(1.6, 1.5, tex('window', 1)); w.position.set(x, 1.95, backZ + 0.02); root.add(w); }
  // door (back left)
  const door = new THREE.Group(); door.position.set(-4.4, 0, backZ + 0.03); root.add(door);
  door.add(mesh(new THREE.BoxGeometry(1.1, 2.2, 0.05), std(0x7a4a2a, 0.5, { map: tex('woodfloor', 0.5) }), 0, 1.1, 0, false));
  door.add(mesh(new THREE.SphereGeometry(0.05, 12, 8), M.brass, 0.4, 1.05, 0.05, false));
  // the picture rule sign: bubble -> give -> happy
  const sign = makeFrame(1.5, 1.05, canvasTex(512, 360, (c, w, h) => {
    c.fillStyle = '#fff8ea'; c.fillRect(0, 0, w, h);
    // panel 1: face with bubble
    c.fillStyle = '#fff'; c.strokeStyle = '#ccc'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(95, 95, 70, 60, 0, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.arc(70, 168, 10, 0, 7); c.fill(); c.stroke();
    drawIcon(c, 'soup', 95, 98, 95);
    drawIcon(c, 'smile', 80, 255, 120);
    // arrow
    c.fillStyle = '#e39b2d'; c.beginPath(); c.moveTo(190, 190); c.lineTo(290, 190); c.lineTo(290, 165); c.lineTo(330, 205); c.lineTo(290, 245); c.lineTo(290, 220); c.lineTo(190, 220); c.fill();
    // panel 2: happy with soup and heart
    drawIcon(c, 'smile', 420, 175, 120);
    c.save(); c.translate(420, 175); c.fillStyle = '#4a3020'; c.beginPath(); c.arc(0, 4, 22, 0, Math.PI); c.fill(); c.restore();
    drawIcon(c, 'soup', 420, 285, 90);
    drawIcon(c, 'heart', 470, 80, 60); drawIcon(c, 'heart', 380, 70, 40);
  }));
  sign.position.set(4.3, 1.85, backZ + 0.03); root.add(sign);
  // brass pendant lamps
  for (const x of [-2.6, 0.2, 2.8]) { const l = makeLamp(1.2); l.position.set(x, 3.6, x === 0.2 ? -1.1 : 0.2); root.add(l); }
  const warm = new THREE.PointLight(0xffd8a0, 6, 12, 1.6); warm.position.set(0, 2.6, 0); root.add(warm);

  // tables (white cloths) & seats
  const T = [
    { x: -2.6, z: 0.2, r: 0.78 }, { x: 0.2, z: -1.1, r: 0.62 }, { x: 2.8, z: 0.2, r: 0.62 },
  ];
  T.forEach(t => { const tb = makeTable(t.r); tb.position.set(t.x, 0, t.z); root.add(tb); });
  const seats = [
    { c: C.papa, x: -3.0, t: T[0], want: 'soup' },
    { c: C.mama, x: -2.15, t: T[0], want: 'salad' },
    { c: C.grandpa, x: 0.2, t: T[1], want: 'pancake' },
    { c: C.neighbor, x: 2.8, t: T[2], want: 'soup' },
  ];
  seats.forEach(s => {
    s.z = s.t.z - s.t.r - 0.02;
    s.spot = V(s.x, 0.77, s.t.z - s.t.r + 0.33);
    const ch = makeChair(); ch.position.set(s.x, 0, s.z - 0.08); root.add(ch);
    root.add(s.c.g); place(s.c, -4.4, backZ - 0.5, 0); s.c.g.visible = false;
    s.served = false; s.seated = false; s.bubble = null; s.dish = null;
  });
  const girl = G.girl; root.add(girl.g); place(girl, -3.0, 3.3, 0.5);
  animate([girl, ...seats.map(s => s.c)]);

  // counter (marble top) with three cooking stations
  const counter = new THREE.Group(); counter.position.set(0, 0, 3.5); root.add(counter);
  counter.add(mesh(new THREE.BoxGeometry(5.2, 0.9, 0.7), std(0x9a6a40, 0.5, { map: tex('woodfloor', 2, 0.4) }), 0, 0.45, 0));
  counter.add(mesh(new THREE.BoxGeometry(5.35, 0.06, 0.82), M.marble, 0, 0.93, 0));
  counter.add(mesh(new THREE.BoxGeometry(5.2, 0.04, 0.04), M.brass, 0, 0.15, 0.36));
  const CY = 0.96;
  const stations = [];
  function station(kind, x) {
    const g = new THREE.Group(); g.position.set(x, CY, 3.45); root.add(g);
    const st = { kind, g, x, n: 0, dish: null, slot: V(x + 0.55, CY, 3.55) };
    if (kind === 'soup') {
      g.add(mesh(new THREE.BoxGeometry(0.55, 0.05, 0.45), M.black, 0, 0.025, 0));
      const pot = mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.22, 32, 1, true), std(0xcfd3d6, 0.18, { metalness: 1, side: THREE.DoubleSide }), 0, 0.16, 0); g.add(pot);
      g.add(mesh(new THREE.CircleGeometry(0.17, 32).rotateX(-Math.PI / 2), std(0xe2552d, 0.3), 0, 0.22, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.01, 32), M.steel, 0, 0.055, 0));
      const ladle = new THREE.Group(); ladle.position.set(0, 0.22, 0); g.add(ladle);
      const stick = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8), M.brass, 0.08, 0.12, 0); stick.rotation.z = -0.35; ladle.add(stick);
      st.anim = async () => { sfx.stir(); await tween(0.5, k => { ladle.rotation.y = k * Math.PI * 2; }, ease.inOut); steam(root, V(x, CY + 0.4, 3.45)); };
    } else if (kind === 'pancake') {
      g.add(mesh(new THREE.BoxGeometry(0.55, 0.05, 0.45), M.black, 0, 0.025, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.04, 32), std(0x2a2a2a, 0.35, { metalness: 0.6 }), 0, 0.07, 0));
      const handle = mesh(new THREE.BoxGeometry(0.28, 0.025, 0.04), std(0x3b2414, 0.5), 0.3, 0.08, 0.05); handle.rotation.y = -0.3; g.add(handle);
      const pc = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.025, 32), std(0xe0a45c, 0.6), 0, 0.1, 0); g.add(pc);
      st.anim = async () => { sfx.flip(); await tween(0.5, k => { pc.position.y = 0.1 + Math.sin(k * Math.PI) * 0.35; pc.rotation.x = k * Math.PI * 2; }, ease.linear); sfx.sizzle(); };
    } else {
      g.add(mesh(new THREE.BoxGeometry(0.55, 0.04, 0.36), std(0xd9b27c, 0.6, { map: tex('woodfloor', 0.3) }), 0, 0.02, 0));
      const lettuce = mesh(new THREE.IcosahedronGeometry(0.09, 1), std(0x6cbf4a, 0.6), -0.12, 0.1, 0); g.add(lettuce);
      g.add(mesh(new THREE.SphereGeometry(0.055, 16, 12), std(0xe8332e, 0.3), 0.02, 0.09, 0.08));
      const knife = new THREE.Group(); knife.position.set(0.15, 0.12, 0); g.add(knife);
      knife.add(mesh(new THREE.BoxGeometry(0.2, 0.06, 0.008), M.steel, 0, 0, 0));
      knife.add(mesh(new THREE.BoxGeometry(0.12, 0.03, 0.025), std(0x3b2414, 0.5), 0.15, 0.01, 0));
      st.anim = async () => {
        for (let i = 0; i < 2; i++) { await tween(0.08, k => { knife.position.y = 0.12 - k * 0.07; }); sfx.chop(); await tween(0.1, k => { knife.position.y = 0.05 + k * 0.07; }); }
        const bit = mesh(new THREE.BoxGeometry(0.03, 0.02, 0.03), std(0x6cbf4a, 0.6), 0, 0.06, 0); g.add(bit);
        const dx = Math.random() * 0.3 - 0.15;
        tween(0.4, k => { bit.position.set(dx * k, 0.06 + Math.sin(k * Math.PI) * 0.15, 0.1 * k); }).then(() => g.remove(bit));
      };
    }
    const icon = iconSprite(kind, 0.5, true); icon.position.set(0, 0.7, -0.05); g.add(icon);
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 8), M.brass, 0, 0.25, -0.2));
    const hit = hitProxy(new THREE.BoxGeometry(0.6, 0.5, 0.5)); hit.position.y = 0.2; g.add(hit);
    onTap(g, async () => {
      if (st.busy || phase !== 'serve') return;
      if (st.dish) { // already a dish waiting: wiggle it
        sfx.clink(); const d = st.dish; tween(0.3, k => { d.rotation.y = Math.sin(k * Math.PI * 4) * 0.2; });
        return;
      }
      st.busy = true; girlReact('happy', 0.8);
      await st.anim();
      st.n++;
      if (st.n >= 3) { st.n = 0; serveDish(st); }
      st.busy = false;
    }, () => !G.busy);
    stations.push(st);
    return st;
  }
  station('soup', -1.95); station('pancake', -0.15); station('salad', 1.65);

  function serveDish(st) {
    const d = makeDish(st.kind); d.position.copy(st.slot); d.scale.setScalar(0.01); root.add(d);
    tween(0.35, k => d.scale.setScalar(Math.max(0.01, k)), ease.back);
    sfx.pop(); sparkle(root, st.slot.clone().add(V(0, 0.2, 0)), 8, 0.35);
    st.dish = d; d.userData.station = st;
    const hit = hitProxy(new THREE.CylinderGeometry(0.25, 0.25, 0.35, 12)); hit.position.y = 0.12; d.add(hit);
    d.userData.tap = grabbable(d, {
      home: st.slot, planeY: 1.25,
      targets: () => seats.filter(s => s.seated && !s.served && !s.dish && !s.eating).map(s => ({ pos: () => s.c.center().add(V(0, 0.2, 0)), drop: (o) => deliver(o, s) })),
      enabled: () => phase === 'serve',
    });
  }
  function steam(r, p) {
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
      sp.scale.setScalar(0.08); sp.position.copy(p); r.add(sp);
      const dx = (Math.random() - 0.5) * 0.15;
      tween(1.0 + i * 0.2, k => { sp.position.set(p.x + dx * k, p.y + k * 0.5, p.z); sp.scale.setScalar(0.08 + k * 0.2); sp.material.opacity = 0.45 * (1 - k); }).then(() => r.remove(sp));
    }
  }

  // ---- deliver & reactions ----
  let papaSpilled = false;
  async function deliver(d, s) {
    const st = d.userData.station; st.dish = null; removeTap(d.userData.tap);
    s.dish = d; s.eating = true;
    sfx.swish();
    await arc(d, s.spot, 0.4, 0.5);
    d.position.copy(s.spot); sfx.clink();
    if (s.bubble) { const b = s.bubble; s.bubble = null; tween(0.2, k => b.scale.setScalar(0.8 * (1 - k))).then(() => root.remove(b)); }
    const good = d.userData.kind === s.want;
    if (!good) {
      s.c.setExpr('puzzled', 1.3); sfx.hm();
      await tween(0.6, k => { s.c.head.rotation.z = Math.sin(k * Math.PI) * 0.25; });
      await wait(0.6);
    }
    s.c.setExpr('happy', 1.2); sfx.yum(); girlReact('happy', 1.2);
    // papa: the grown-up mess-up gag on his first plate
    if (s.c === C.papa && !papaSpilled) { papaSpilled = true; await spill(s); return; }
    await eat(s);
  }
  async function eat(s) {
    const c = s.c;
    await armsTo(c, null, [-1.3, 0.25], 0.25);
    for (let i = 0; i < 3; i++) { await tween(0.25, k => { c.arms[1].rotation.x = -1.3 - Math.sin(k * Math.PI) * 0.6; }); sfx.blip(); }
    await armsTo(c, null, ARMS_DOWN[1], 0.25);
    c.setExpr('yum', 1.2); sfx.yum();
    floatIcon(root, 'heart', c.headTop().add(V(0.15, 0.1, 0.1)), 0.3);
    await wait(1.0);
    // plate becomes empty
    s.dish.children.slice(1).forEach(ch => { if (!ch.userData.hitProxy) ch.visible = false; });
    c.setExpr('happy');
    s.served = true; s.eating = false;
    checkAllServed();
  }
  let stain = null, cloth = null, rubbing = 0;
  async function spill(s) {
    const c = s.c, d = s.dish;
    await armsTo(c, null, [-1.3, 0.25], 0.25);
    await wait(0.3);
    // whoops: knocks the bowl over
    sfx.oops(); c.setExpr('surprised');
    await tween(0.35, k => { d.rotation.z = k * 1.5; d.position.x = s.spot.x + k * 0.12; d.position.y = s.spot.y + Math.sin(k * Math.PI) * 0.1; });
    sfx.splash();
    const col = d.userData.kind === 'soup' ? '#d9482a' : d.userData.kind === 'salad' ? '#7a9a2a' : '#8a3f12';
    stain = mesh(new THREE.CircleGeometry(0.42, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({
      map: canvasTex(128, 128, (cx) => { cx.fillStyle = col; for (let i = 0; i < 9; i++) { cx.beginPath(); cx.arc(64 + Math.cos(i * 1.9) * 28 * (i % 3 ? 1 : 0.4), 64 + Math.sin(i * 2.3) * 24, 18 + (i * 7) % 16, 0, 7); cx.fill(); } }),
      transparent: true, roughness: 0.2, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false,
    }), s.spot.x + 0.1, 0.772, s.spot.z + 0.05, false);
    stain.scale.setScalar(0.01); root.add(stain);
    tween(0.4, k => stain.scale.setScalar(Math.max(0.01, k)), ease.out);
    await armsTo(c, null, ARMS_DOWN[1], 0.2);
    c.setExpr('oops');
    camTo(V(-1.7, 3.3, 6.2), V(-2.1, 0.8, 1.2), 5.4, 3.2, 1.2);
    C.mama.setExpr('surprised', 1.0);
    await wait(1.0);
    C.mama.setExpr('laugh', 1.6); sfx.giggle();
    girlReact('surprised', 1.2);
    // the cloth appears on the counter
    cloth = new THREE.Group();
    const cm = mesh(new THREE.BoxGeometry(0.32, 0.03, 0.24), std(0x5a9bd8, 0.9, { map: canvasTex(64, 64, (cx) => { cx.fillStyle = '#5a9bd8'; cx.fillRect(0, 0, 64, 64); cx.fillStyle = '#fff'; for (let i = 0; i < 64; i += 16) { cx.fillRect(i, 0, 6, 64); cx.fillRect(0, i, 64, 6); } }) }), 0, 0.015, 0);
    cloth.add(cm); cloth.add(Object.assign(hitProxy(new THREE.BoxGeometry(0.5, 0.3, 0.45)), {}));
    cloth.position.set(-1.05, CY, 3.6); root.add(cloth);
    cloth.scale.setScalar(0.01); tween(0.4, k => cloth.scale.setScalar(Math.max(0.01, k)), ease.back);
    sparkle(root, cloth.position.clone().add(V(0, 0.2, 0)), 10, 0.4);
    rubbing = 0;
    const clothHome = cloth.position.clone();
    const startWipe = () => {
      if (!stain) return;
      G.held = null; sfx.swish(); girlReact('wow', 0.8);
      beginDrag({
        move(sx, sy) {
          const p = rayPlaneY(sx, sy, 0.8); if (!p || !stain) return;
          const prev = cloth.position.clone();
          cloth.position.set(p.x, 0.8, p.z);
          const dist = Math.hypot(p.x - stain.position.x, p.z - stain.position.z);
          if (dist < 0.8) {
            rubbing += prev.distanceTo(cloth.position);
            cloth.rotation.y = Math.sin(rubbing * 8) * 0.4;
            stain.material.opacity = Math.max(0, 1 - rubbing / 2.2);
            if (Math.random() < 0.25) sfx.swish();
            if (Math.random() < 0.15) sparkle(root, stain.position.clone().add(V(0, 0.05, 0)), 2, 0.2);
            if (rubbing > 2.2) cleaned();
          }
        },
        up() { if (stain && cloth) arc(cloth, clothHome, 0.2, 0.3); },
      });
    };
    clothTap = onTap(cloth, startWipe, () => !!stain);
    stainTap = onTap(stain, startWipe, () => !!stain);
  }
  let clothTap = null, stainTap = null;
G.dbg.serveAll = () => { seats.forEach(s => { s.served = true; s.seated = true; }); checkAllServed(); }; G.dbg.bowls = () => toppings; G.dbg.cake = () => cake; G.dbg.phase = () => phase;
    G.dbg.stain = () => stain; G.dbg.cloth = () => cloth; G.dbg.seats = seats; G.dbg.stations = stations;
  async function cleaned() {
    const st = stain; stain = null;
    root.remove(st); removeTap(clothTap); removeTap(stainTap);
    sfx.sparkle(); sparkle(root, st.position.clone().add(V(0, 0.1, 0)), 16, 0.6);
    const s = seats[0];
    root.remove(s.dish); s.dish = null; s.eating = false;
    tween(0.3, k => cloth.scale.setScalar(Math.max(0.01, 1 - k))).then(() => root.remove(cloth));
    C.papa.setExpr('happy'); girlReact('happy', 2); cheer(G.girl, 0.8);
    camTo(V(0, 5.0, 10.0), V(0, 0.9, 0.9), 9.4, 5.6, 1.2);
    sfx.yay();
    await wait(1.2);
    showBubble(s); // papa would like soup again, please!
  }
  function showBubble(s, key = s.want) {
    if (s.bubble) root.remove(s.bubble);
    const b = makeBubble(key); b.scale.setScalar(0.01);
    b.position.copy(s.c.headTop()).add(V(0.22, 0.42, 0));
    root.add(b); s.bubble = b;
    tween(0.35, k => b.scale.setScalar(Math.max(0.01, 0.8 * k)), ease.back);
    sfx.blip();
    onUpdate((dt, t) => { if (s.bubble === b) b.position.y = s.c.headTop().y + 0.42 + Math.sin(t * 2 + s.x) * 0.03; });
  }
  function checkAllServed() {
    if (phase === 'serve' && seats.every(s => s.served)) dessertTime();
  }

  // ---- dessert: decorate the cake, then share it ----
  let phase = 'serve';
  let cake = null, toppings = [], placed = 0;
  async function dessertTime() {
    phase = 'dessert'; G.busy = true;
    await wait(0.8);
    seats.forEach(s => { s.dish && root.remove(s.dish); s.dish = null; showBubble(s, 'cake'); });
    sfx.yay();
    await wait(1.0);
    // clear the stations, bring the cake
    stations.forEach(st => { tween(0.4, k => st.g.scale.setScalar(Math.max(0.01, 1 - k))); if (st.dish) { root.remove(st.dish); st.dish = null; } });
    camTo(V(0, 2.25, 5.4), V(0, 1.1, 3.45), 3.5, 2.0, 1.3);
    cake = new THREE.Group(); cake.position.set(0, CY, 3.45); root.add(cake);
    cake.add(mesh(new THREE.CylinderGeometry(0.06, 0.16, 0.12, 24), M.brass, 0, 0.06, 0));
    cake.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.015, 40), M.brass, 0, 0.125, 0));
    cake.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 40), std(0xfff4ea, 0.6), 0, 0.235, 0));
    cake.add(mesh(new THREE.TorusGeometry(0.28, 0.02, 8, 40).rotateX(Math.PI / 2), std(0xffffff, 0.7), 0, 0.14, 0));
    const cakeHit = hitProxy(new THREE.CylinderGeometry(0.4, 0.4, 0.5, 16)); cakeHit.position.y = 0.25; cake.add(cakeHit);
    cake.scale.setScalar(0.01);
    await tween(0.5, k => cake.scale.setScalar(Math.max(0.01, k)), ease.back);
    sfx.pop();
    const kinds = [
      { k: 'cream', x: -1.55, col: 0xffffff }, { k: 'berry', x: -0.85, col: 0xe8283a },
      { k: 'blue', x: 0.85, col: 0x3f51b5 }, { k: 'sprinkle', x: 1.55, col: 0xffc0d8 },
    ];
    kinds.forEach(kd => {
      const b = new THREE.Group(); b.position.set(kd.x, CY, 3.5); root.add(b);
      b.add(mesh(bowlGeo(0.16, 0.1), M.ceramic, 0, 0, 0));
      for (let i = 0; i < 7; i++) {
        const it = toppingMesh(kd.k, i); it.position.set(Math.cos(i * 2.2) * 0.07 * (i ? 1 : 0), 0.09 + (i % 2) * 0.02, Math.sin(i * 2.2) * 0.07 * (i ? 1 : 0)); b.add(it);
      }
      { const bh = hitProxy(new THREE.CylinderGeometry(0.3, 0.3, 0.4, 12)); bh.position.y = 0.1; b.add(bh); }
      b.scale.setScalar(0.01); tween(0.4, k => b.scale.setScalar(Math.max(0.01, k)), ease.back);
      onTap(b, () => addTopping(kd, b), () => phase === 'dessert');
      toppings.push(b);
    });
    G.busy = false;
  }
  function toppingMesh(k, i) {
    if (k === 'cream') { const g = new THREE.Group(); g.add(mesh(new THREE.ConeGeometry(0.035, 0.06, 12), std(0xffffff, 0.6), 0, 0.03, 0)); g.add(mesh(new THREE.SphereGeometry(0.035, 12, 8), std(0xffffff, 0.6), 0, 0.0, 0)); return g; }
    if (k === 'berry') { const m = mesh(new THREE.SphereGeometry(0.035, 12, 10), std(0xe8283a, 0.25)); m.scale.y = 1.3; return m; }
    if (k === 'blue') return mesh(new THREE.SphereGeometry(0.022, 12, 10), std(0x34408f, 0.3));
    const cols = [0xff6fa5, 0x6fd3ff, 0xffe066, 0x8cf07a];
    const m = mesh(new THREE.CapsuleGeometry(0.006, 0.02, 3, 6), std(cols[Math.floor(i) % 4], 0.5)); m.rotation.set(i, i * 1.3, 0); return m;
  }
  const slots = []; for (let i = 0; i < 8; i++) slots.push(V(Math.cos(i / 8 * Math.PI * 2) * 0.19, 0.35, Math.sin(i / 8 * Math.PI * 2) * 0.19)); slots.push(V(0, 0.36, 0));
  async function addTopping(kd, bowl) {
    if (!cake || phase !== 'dessert') return;
    girlReact('happy', 0.8);
    const n = kd.k === 'sprinkle' ? 6 : 1;
    const target = slots[Math.floor(placed) % slots.length].clone();
    for (let j = 0; j < n; j++) {
      const t = toppingMesh(kd.k, j + placed);
      const from = bowl.position.clone().add(V(0, 0.15, 0));
      t.position.copy(from); root.add(t);
      const to = cake.position.clone().add(kd.k === 'sprinkle' ? V((Math.random() - 0.5) * 0.4, 0.345, (Math.random() - 0.5) * 0.4) : target);
      arc(t, to, 0.35, 0.45).then(() => { root.remove(t); t.position.sub(cake.position); cake.add(t); });
    }
    sfx.boing(1.4);
    await wait(0.45); sfx.pop();
    if (kd.k !== 'sprinkle') placed++; else placed += 0.5;
    if (placed >= 7 && phase === 'dessert') cakeDone();
  }
  async function cakeDone() {
    phase = 'cakeDone';
    toppings.forEach(b => tween(0.4, k => b.scale.setScalar(Math.max(0.01, 1 - k))));
    await wait(0.5);
    sfx.sparkle(); sparkle(root, cake.position.clone().add(V(0, 0.4, 0)), 20, 0.7);
    G.girl.setExpr('wow', 1.5); cheer(G.girl, 0.8);
    cake.userData.baseScale = cake.scale.clone();
    onTap(cake, shareCake, () => phase === 'cakeDone');
  }
  async function shareCake() {
    phase = 'sharing'; G.busy = true;
    sfx.yay();
    camTo(V(0, 5.0, 10.0), V(0, 0.9, 0.9), 9.4, 5.6, 1.2);
    await wait(0.6);
    await Promise.all(seats.map(async (s, i) => {
      await wait(i * 0.25);
      const sl = makeDish('cakeSlice'); sl.position.copy(cake.position).add(V(0, 0.3, 0)); root.add(sl);
      sfx.swish();
      await arc(sl, s.spot, 1.2, 0.9);
      sfx.clink();
      if (s.bubble) { const b = s.bubble; s.bubble = null; root.remove(b); }
      s.c.setExpr('yum', 1.5); sfx.yum();
      floatIcon(root, 'heart', s.c.headTop().add(V(0, 0.1, 0.1)), 0.35);
    }));
    await wait(1.2);
    // everyone happy at full tables
    seats.forEach(s => { s.c.setExpr('laugh'); clap(s.c, 1.8); });
    sfx.clap(14); sfx.fanfare(); G.girl.setExpr('laugh'); cheer(G.girl, 1.6);
    confetti(root, V(0, 3.2, 0.5), 5);
    await wait(3.2);
    seats.forEach(s => s.c.setExpr('smile'));
    G.girl.setExpr('smile');
    goScene(2);
  }

  // ---- customers arrive ----
  async function arrive(s, delay) {
    await wait(delay);
    const c = s.c; c.g.visible = true;
    sfx.door();
    await walkTo(c, s.x, s.z - 0.5, 1.8);
    await turnTo(c, 0);
    setPose(c, 'sit');
    const y0 = c.g.position.y, z0 = c.g.position.z;
    await tween(0.3, k => { c.g.position.y = y0 + (0.6 - c.legL - y0) * k; c.g.position.z = z0 + (s.z - z0) * k; });
    s.seated = true;
    showBubble(s);
  }
  return {
    root,
    preTap: heldPreTap,
    onMiss() { if (G.held) putBack(G.held); },
    start() {
      setCam(V(0, 6.2, 12.5), V(0, 0.9, 0.4), 11, 6.5);
      camTo(V(0, 5.0, 10.0), V(0, 0.9, 0.9), 9.4, 5.6, 2.0);
      arrive(seats[0], 0.6); arrive(seats[1], 1.3); arrive(seats[2], 3.0); arrive(seats[3], 4.4);
      hintUpdater(() => {
        if (stain) return [cloth];
        if (phase === 'dessert') return toppings;
        if (phase === 'cakeDone') return [cake];
        const ready = stations.filter(st => st.dish).map(st => st.dish);
        if (G.held) return [];
        return ready.length ? ready : stations.map(st => st.g);
      });
    },
  };
}
function confetti(root, at, spread = 4) {
  const cols = [0xff5c8a, 0xffd34d, 0x5ad1ff, 0x8be06a, 0xb27bff, 0xffffff];
  const geo = new THREE.PlaneGeometry(0.07, 0.11);
  for (let i = 0; i < 90; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, roughness: 0.5 }));
    const p0 = at.clone().add(V((Math.random() - 0.5) * spread, Math.random() * 1.2, (Math.random() - 0.5) * spread * 0.5));
    m.position.copy(p0); root.add(m);
    const sx = Math.random() * 10, sy = Math.random() * 10, fall = 2.6 + Math.random() * 1.2, sw = (Math.random() - 0.5) * 0.6;
    tween(3.2 + Math.random(), k => {
      m.position.set(p0.x + Math.sin(k * 9 + sx) * 0.25 + sw * k, p0.y - fall * k, p0.z + Math.cos(k * 7 + sy) * 0.15);
      m.rotation.set(k * 12 + sx, k * 9 + sy, k * 5);
    }, ease.linear).then(() => root.remove(m));
  }
}

// =====================================================================
// 2. hotel front desk: bell rings, hand the key, roll the luggage cart
// =====================================================================
function sceneHotel() {
  const C = G.cast;
  const root = new THREE.Scene(); root.background = new THREE.Color(0xf0e2cc);
  lights(root, { sunPos: [3, 9, 7], shadowExt: 7, sun: 1.9, env: 0.65 });
  const room = makeRoom({ w: 11, d: 9, h: 3.6, z0: 2.5, floor: 'marble', floorRough: 0.15, wallTint: 0xfff0dc }); root.add(room);
  const backZ = room.userData.backZ;
  const warm = new THREE.PointLight(0xffd8a0, 5, 10, 1.6); warm.position.set(0, 2.8, 0.5); root.add(warm);
  // chandelier-ish brass lamps
  for (const x of [-2.5, 2.5]) { const l = makeLamp(1.0); l.position.set(x, 3.6, 0.3); root.add(l); }
  // front desk
  const desk = new THREE.Group(); desk.position.set(0, 0, 0); root.add(desk);
  desk.add(mesh(new THREE.BoxGeometry(3.2, 1.0, 0.75), std(0x8a5530, 0.45, { map: tex('woodfloor', 2, 0.6) }), 0, 0.5, 0));
  desk.add(mesh(new THREE.BoxGeometry(3.35, 0.06, 0.9), M.marble, 0, 1.03, 0));
  for (const x of [-1.2, -0.4, 0.4, 1.2]) desk.add(mesh(new THREE.BoxGeometry(0.04, 0.8, 0.02), M.brass, x, 0.5, 0.38));
  // white runner cloth on the desk
  desk.add(mesh(new THREE.BoxGeometry(1.1, 0.012, 0.92), M.linen, 0.75, 1.065, 0));
  const vase = makeTable(0.01); vase.children[0].visible = vase.children[1].visible = false; vase.position.set(1.2, 0.29, 0.1); root.add(vase);
  const bell = makeBell(2.3); bell.position.set(-0.95, 1.06, 0.15); root.add(bell);
  const bellHit = hitProxy(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 12)); bellHit.position.y = 0.1; bell.add(bellHit);
  // key board with three tagged keys
  const board = new THREE.Group(); board.position.set(0.5, 1.95, backZ + 0.03); root.add(board);
  board.add(mesh(new THREE.BoxGeometry(2.0, 0.9, 0.06), std(0x6b3f22, 0.45, { map: tex('woodfloor', 0.6) }), 0, 0, 0));
  board.add(mesh(new THREE.BoxGeometry(2.08, 0.05, 0.08), M.brass, 0, 0.46, 0));
  board.add(mesh(new THREE.BoxGeometry(2.08, 0.05, 0.08), M.brass, 0, -0.46, 0));
  const keyKinds = ['duck', 'flower', 'star'];
  const keys = [];
  const girl = G.girl; root.add(girl.g);
  // step stool so she can reach over the desk
  const stool = mesh(new THREE.BoxGeometry(0.6, 0.5, 0.5), std(0xc0904f, 0.5, { map: tex("woodfloor", 0.3) }), 0.25, 0.25, -0.85); root.add(stool);
  place(girl, 0.25, -0.85, 0, 0.5);
  keyKinds.forEach((k, i) => {
    const hx = 0.5 + (i - 1) * 0.6;
    root.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.08, 8).rotateX(Math.PI / 2), M.brass, hx, 1.97, backZ + 0.1));
    const key = makeKey(k); key.scale.setScalar(1.7);
    const home = V(hx, 1.9, backZ + 0.14);
    key.position.copy(home); root.add(key);
    key.userData.kind = k;
    key.userData.tap = grabbable(key, {
      home, planeY: 1.5,
      targets: () => (guest && guest.waiting) ? [{ pos: () => guest.c.center().add(V(0, 0.25, 0)), drop: (o) => giveKey(o) }] : [],
      enabled: () => !!(guest && guest.waiting),
    });
    keys.push(key);
  });
  // brass luggage cart
  const cart = makeCart(); const cartHome = V(2.7, 0, 1.3); cart.position.copy(cartHome); cart.rotation.y = -0.3; root.add(cart);
  // corridor door (right of back wall)
  const doorG = new THREE.Group(); doorG.position.set(3.4, 0, backZ + 0.04); root.add(doorG);
  const doorPivot = new THREE.Group(); doorPivot.position.x = -0.55; doorG.add(doorPivot);
  doorPivot.add(mesh(new THREE.BoxGeometry(1.1, 2.3, 0.06), std(0x7a4a2a, 0.45, { map: tex('woodfloor', 0.5) }), 0.55, 1.15, 0, false));
  doorPivot.add(mesh(new THREE.SphereGeometry(0.05, 12, 8), M.brass, 0.95, 1.1, 0.06, false));
  doorG.add(mesh(new THREE.PlaneGeometry(1.1, 2.3), std(0x2a1d14, 1), 0, 1.15, -0.02, false));
  const plant = new THREE.Group(); plant.position.set(-4.3, 0, backZ + 0.6); root.add(plant);
  plant.add(mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.5, 20), M.brass, 0, 0.25, 0));
  for (let i = 0; i < 9; i++) { const l = mesh(new THREE.SphereGeometry(0.22, 10, 8), std(0x3f8f3a, 0.7), Math.cos(i * 2.1) * 0.2, 0.75 + (i % 3) * 0.2, Math.sin(i * 2.1) * 0.2); l.scale.set(0.7, 1.2, 0.7); plant.add(l); }
  const win = makeWindow(1.4, 1.4, tex('window', 1)); win.position.set(-2.4, 1.95, backZ + 0.02); root.add(win);

  const spot = V(-2.05, 0, 0.95);
  let guest = null;
  const guests = [{ c: C.neighbor, want: 'flower' }, { c: C.grandpa, want: 'duck' }];
  guests.forEach(gst => { root.add(gst.c.g); place(gst.c, -6.2, 1.3, Math.PI / 2); gst.c.g.visible = false; });
  animate([girl, ...guests.map(x => x.c)]);
  let idx = 0;
  G.dbg.keys = keys; G.dbg.guest = () => guest; G.dbg.cart = cart;

  async function nextGuest() {
    if (idx >= guests.length) return;
    guest = guests[idx++];
    const c = guest.c; c.g.visible = true; place(c, -6.2, 1.3, Math.PI / 2);
    // suitcase rolls along
    guest.bag = makeSuitcase(idx === 1 ? 0xd2504f : 0x3c7fbf);
    guest.bag.position.set(-6.7, 0, 1.6); root.add(guest.bag);
    const bagWalk = moveTo(guest.bag.position, V(-1.55, 0, 1.55), 4.7 / 1.6, ease.linear);
    await walkTo(c, spot.x, spot.z, 1.6);
    await bagWalk;
    await turnTo(c, 1.15);
    // ring ring!
    for (let i = 0; i < (idx === 2 ? 3 : 1); i++) {
      await armsTo(c, null, [-1.4, 0.5], 0.2);
      ringBell(bell); sfx.ding(); girlReact('surprised', 0.6);
      await armsTo(c, null, [-1.1, 0.5], 0.15);
      await wait(0.25);
    }
    await armsTo(c, null, ARMS_DOWN[1], 0.2);
    if (idx === 2) { c.setExpr('laugh', 1.2); sfx.laughLow(); }
    guest.bubble = makeBubble(guest.want); guest.bubble.scale.setScalar(0.01);
    guest.bubble.position.copy(c.headTop()).add(V(0.3, 0.45, 0)); root.add(guest.bubble);
    const b = guest.bubble; tween(0.35, k => b.scale.setScalar(Math.max(0.01, 0.8 * k)), ease.back); sfx.blip();
    guest.waiting = true;
    girlReact('happy', 1);
  }
  async function giveKey(key) {
    const gst = guest; gst.waiting = false;
    removeTap(key.userData.tap);
    sfx.swish();
    const hand = gst.c.handPos(1);
    await arc(key, hand, 0.4, 0.5);
    root.remove(gst.bubble);
    // key stays in the guest's hand
    gst.c.arms[1].attach(key);
    const good = key.userData.kind === gst.want;
    if (!good) {
      gst.c.setExpr('puzzled', 1.3); sfx.hm();
      await tween(0.6, k => { gst.c.head.rotation.z = Math.sin(k * Math.PI) * 0.25; });
      await wait(0.5);
    }
    gst.c.setExpr('happy', 1.5); sfx.yay(); girlReact('happy', 1.5);
    floatIcon(root, 'heart', gst.c.headTop().add(V(0, 0.1, 0.1)), 0.3);
    await armsTo(gst.c, null, [-0.6, 0.6], 0.25);
    // now: the suitcase wants to go on the cart
    gst.bag.userData.baseScale = gst.bag.scale.clone();
    gst.bagTap = onTap(gst.bag, () => loadBag(gst), () => !gst.loaded);
    const cartTap = onTap(cart, () => loadBag(gst), () => !gst.loaded);
    gst.cartTap = cartTap;
  }
  async function loadBag(gst) {
    if (gst.loaded) return;
    gst.loaded = true; removeTap(gst.bagTap); removeTap(gst.cartTap);
    sfx.boing(); girlReact('happy', 1);
    const top = cart.localToWorld(V(0, 0.22, 0));
    await arc(gst.bag, top, 0.8, 0.6);
    cart.attach(gst.bag); sfx.thud();
    gst.c.setExpr('happy');
    // show the way: door opens, cart & guest roll off
    sfx.door();
    tween(0.6, k => { doorPivot.rotation.y = -k * 1.4; });
    girl.setExpr('happy'); armsTo(girl, null, [0, 2.4], 0.3);
    sfx.roll();
    const cp = cart.position.clone();
    const end = V(3.4, 0, backZ - 0.6);
    const cartGo = tween(2.6, k => { cart.position.lerpVectors(cp, end, k); }, ease.inOut);
    await walkTo(gst.c, 2.6, 0.6, 1.6);
    await walkTo(gst.c, 3.4, backZ - 0.4, 1.4);
    await cartGo;
    gst.c.g.visible = false; cart.visible = false;
    sfx.door();
    await tween(0.5, k => { doorPivot.rotation.y = -1.4 * (1 - k); });
    armsTo(girl, null, ARMS_DOWN[1], 0.3);
    cart.remove(gst.bag);
    if (idx < guests.length) {
      cart.visible = true; cart.position.copy(cartHome); cart.rotation.y = -0.3;
      cart.scale.setScalar(0.01); tween(0.4, k => cart.scale.setScalar(Math.max(0.01, k)), ease.back);
      await wait(0.6);
      nextGuest();
    } else {
      await wait(0.4);
      goScene(3);
    }
  }
  // the brass bell can always be rung for fun
  onTap(bell, () => { if (G.busy) return; ringBell(bell); sfx.ding(); girlReact('laugh', 0.8); });
  return {
    root,
    preTap: heldPreTap,
    onMiss() { if (G.held) putBack(G.held); },
    start() {
      setCam(V(-1.5, 3.4, 9.2), V(0, 1.2, 0), 9, 5.2);
      camTo(V(-0.2, 2.9, 7.3), V(0.1, 1.15, 0.2), 7.8, 4.5, 2.0);
      wait(1.2).then(nextGuest);
      hintUpdater(() => {
        if (guest && guest.waiting) return keys.filter(k => k.parent === root);
        if (guest && guest.bagTap && !guest.loaded) return [guest.bag];
        return [];
      });
    },
  };
}
function makeKey(kind) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.TorusGeometry(0.04, 0.012, 8, 20), M.brass, 0, 0.0, 0));
  g.add(mesh(new THREE.BoxGeometry(0.018, 0.17, 0.012), M.brass, 0, -0.12, 0));
  g.add(mesh(new THREE.BoxGeometry(0.04, 0.018, 0.012), M.brass, 0.02, -0.18, 0));
  g.add(mesh(new THREE.BoxGeometry(0.03, 0.018, 0.012), M.brass, 0.015, -0.145, 0));
  const tagT = canvasTex(128, 128, (c) => drawTag(c, kind, 64, 64, 56));
  const tag = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.012, 32).rotateX(Math.PI / 2), [
    std(0xffffff, 0.6), new THREE.MeshStandardMaterial({ map: tagT, roughness: 0.5 }), std(0xffffff, 0.6),
  ]);
  tag.position.set(0.1, -0.07, 0.01); tag.castShadow = true; g.add(tag);
  const hit = hitProxy(new THREE.BoxGeometry(0.3, 0.5, 0.2)); hit.position.y = 0; g.add(hit);
  return g;
}
function makeSuitcase(col) {
  const g = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(0.5, 0.62, 0.24), std(col, 0.45), 0, 0.36, 0); g.add(body);
  g.add(mesh(new THREE.BoxGeometry(0.52, 0.04, 0.26), std(0x3b2414, 0.5), 0, 0.48, 0));
  g.add(mesh(new THREE.TorusGeometry(0.07, 0.015, 8, 16, Math.PI), M.brass, 0, 0.68, 0));
  for (const x of [-0.18, 0.18]) g.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), M.black, x, 0.035, 0));
  const hit = hitProxy(new THREE.BoxGeometry(0.7, 0.9, 0.5)); hit.position.y = 0.4; g.add(hit);
  return g;
}
function makeCart() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(1.1, 0.08, 0.6), std(0x8a1f2a, 0.8), 0, 0.18, 0));
  g.add(mesh(new THREE.BoxGeometry(1.14, 0.03, 0.64), M.brass, 0, 0.13, 0));
  for (const x of [-0.5, 0.5]) {
    g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 12), M.brass, x, 0.9, -0.2));
    for (const z of [-0.22, 0.22]) g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 16).rotateX(Math.PI / 2), M.black, x * 0.9, 0.07, z));
  }
  const arch = mesh(new THREE.TorusGeometry(0.5, 0.025, 8, 24, Math.PI), M.brass, 0, 1.65, -0.2); g.add(arch);
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 10).rotateZ(Math.PI / 2), M.brass, 0, 1.35, -0.2));
  const hit = hitProxy(new THREE.BoxGeometry(1.3, 1.8, 0.8)); hit.position.y = 0.8; g.add(hit);
  return g;
}

// =====================================================================
// 3. bath: fill the tub, pour bubble soap, grandpa disappears in foam
// =====================================================================
function sceneBath() {
  const C = G.cast;
  const root = new THREE.Scene(); root.background = new THREE.Color(0xe8eef2);
  lights(root, { sunPos: [2, 8, 6], shadowExt: 5, sun: 1.8, env: 0.8, sky: 0xf4f8ff });
  const room = makeRoom({ w: 7, d: 6, h: 3.2, z0: 1.2, floor: 'tiles', wall: 'tiles', floorRough: 0.2, trim: 0xffffff }); root.add(room);
  const backZ = room.userData.backZ;
  const win = makeWindow(1.0, 1.0, tex('garden', 1)); win.position.set(-1.6, 2.0, backZ + 0.02); root.add(win);
  // towel rail with white towels
  root.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 10).rotateZ(Math.PI / 2), M.brass, 2.0, 1.5, backZ + 0.12));
  for (const x of [1.7, 2.25]) root.add(mesh(new THREE.BoxGeometry(0.42, 0.7, 0.05), std(0xffffff, 0.95, { map: tex('linen', 1) }), x, 1.2, backZ + 0.14));
  // claw-foot tub
  const tub = new THREE.Group(); tub.position.set(0.2, 0, -0.3); root.add(tub);
  const pts = [];
  for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI / 2; pts.push(new THREE.Vector2(0.001 + Math.sin(a) * 0.55, 0.12 + 0.5 - Math.cos(a) * 0.5)); }
  for (let i = 12; i >= 0; i--) { const a = i / 12 * Math.PI / 2; pts.push(new THREE.Vector2(0.001 + Math.sin(a) * 0.49, 0.17 + 0.45 - Math.cos(a) * 0.45)); }
  const shell = mesh(new THREE.LatheGeometry(pts, 48), M.ceramic, 0, 0, 0); shell.scale.x = 1.75; tub.add(shell);
  const rim = mesh(new THREE.TorusGeometry(0.52, 0.035, 10, 48).rotateX(Math.PI / 2), M.ceramic, 0, 0.62, 0); rim.scale.x = 1.75; tub.add(rim);
  for (const [x, z] of [[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]]) tub.add(mesh(new THREE.SphereGeometry(0.07, 12, 10), M.brass, x, 0.08, z));
  const water = mesh(new THREE.CircleGeometry(0.5, 40).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x8fd0ff, roughness: 0.05, transparent: true, opacity: 0.75, clearcoat: 1 }), 0, 0.2, 0, false);
  water.scale.set(1.72, 1, 0.98); water.visible = false; tub.add(water);
  // brass faucet at the right end
  const faucet = new THREE.Group(); faucet.position.set(1.05, 0.62, 0); tub.add(faucet);
  faucet.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 12), M.brass, 0, 0.17, 0));
  const spout = mesh(new THREE.TorusGeometry(0.12, 0.028, 10, 20, Math.PI), M.brass, -0.12, 0.35, 0); faucet.add(spout);
  const knob = new THREE.Group(); knob.position.set(0.0, 0.3, 0.12); faucet.add(knob);
  knob.add(mesh(new THREE.BoxGeometry(0.16, 0.03, 0.03), M.brass, 0, 0, 0));
  knob.add(mesh(new THREE.BoxGeometry(0.03, 0.16, 0.03), M.brass, 0, 0, 0));
  knob.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), M.brass, 0, 0, 0));
  const fHit = hitProxy(new THREE.BoxGeometry(0.5, 0.6, 0.5)); fHit.position.y = 0.25; faucet.add(fHit);
  const stream = mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.5, 10), new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.6, roughness: 0.05 }), -0.24, 0.1, 0, false);
  stream.visible = false; faucet.add(stream);
  // bubble bath bottle on a little stool
  const stoolB = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.45, 20), std(0xffffff, 0.4), -1.35, 0.225, 0.75); root.add(stoolB);
  const bottle = new THREE.Group(); bottle.position.set(-1.35, 0.45, 0.75); root.add(bottle);
  bottle.add(mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.3, 20), new THREE.MeshPhysicalMaterial({ color: 0xff8fc0, roughness: 0.15, clearcoat: 1 }), 0, 0.15, 0));
  bottle.add(mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.08, 16), std(0xff8fc0, 0.2), 0, 0.34, 0));
  bottle.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 16), M.brass, 0, 0.4, 0));
  const lbl = iconSprite('heart', 0.12); lbl.position.set(0, 0.16, 0.11); bottle.add(lbl);
  const bHit = hitProxy(new THREE.BoxGeometry(0.4, 0.6, 0.4)); bHit.position.y = 0.2; bottle.add(bHit);
  // little bubble decoration on the bottle top
  const gp = C.grandpa; root.add(gp.g); place(gp, -1.4, -0.5, 0.4);
  const girl = G.girl; root.add(girl.g); place(girl, 1.7, 0.75, -0.5);
  animate([gp, girl]);

  let filled = false, soap = false, foamOn = false, done = false;
  G.dbg.faucet = faucet; G.dbg.bottle = bottle; G.dbg.popped = () => poppedN;
  onTap(faucet, async () => {
    if (filled || faucet.userData.running) return;
    faucet.userData.running = true; girlReact('happy', 1);
    tween(0.3, k => { knob.rotation.z = k * Math.PI / 2; });
    stream.visible = true; water.visible = true; waterOn();
    await tween(3.2, k => { water.position.y = 0.2 + k * 0.33; stream.scale.y = 1 + k * 0.0; }, ease.linear);
    waterOff(); stream.visible = false; filled = true;
    tween(0.3, k => { knob.rotation.z = (1 - k) * Math.PI / 2; });
    sfx.sparkle(); gp.setExpr('happy', 1.2);
    if (soap && filled) jumpIn();
  }, () => !done);
  onTap(bottle, async () => {
    if (soap || bottle.userData.busy) return;
    bottle.userData.busy = true; girlReact('happy', 1);
    const p0 = bottle.position.clone();
    await arc(bottle, V(-0.6, 1.2, -0.1), 0.3, 0.5);
    await tween(0.3, k => { bottle.rotation.z = -k * 2.0; });
    sfx.pour();
    for (let i = 0; i < 6; i++) {
      const dr = mesh(new THREE.SphereGeometry(0.025, 8, 6), std(0xff8fc0, 0.2), -0.45, 1.15, -0.1, false); root.add(dr);
      tween(0.4, k => { dr.position.y = 1.15 - k * (1.15 - 0.4); }, ease.in).then(() => root.remove(dr));
      await wait(0.12);
    }
    await tween(0.3, k => { bottle.rotation.z = -(1 - k) * 2.0; });
    await arc(bottle, p0, 0.3, 0.5);
    soap = true;
    sfx.blip(); gp.setExpr('wow', 1.2);
    if (soap && filled) jumpIn();
  }, () => !done);

  // ---- foam ----
  const N = 260;
  const foam = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, emissive: 0xf4f8ff, emissiveIntensity: 0.25 }), N);
  foam.castShadow = true; foam.receiveShadow = true; foam.frustumCulled = false;
  foam.boundingSphere = new THREE.Sphere(V(0.2, 1.0, -0.3), 2.5);
  const F = [];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < N; i++) {
    // pile shape: dense mound in the tub that spills over a little
    const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random());
    const layer = Math.random();
    const x = 0.2 + Math.cos(a) * rr * (0.85 + layer * 0.35) * 1.05;
    const z = -0.3 + Math.sin(a) * rr * (0.5 + layer * 0.25);
    const near = Math.hypot(x - 0.0, (z + 0.3) * 1.3) < 0.4;
    const top = near ? 0.9 + Math.random() * 0.08 : 0.6 + (1 - rr) * 0.75 + Math.random() * 0.15;
    const y = 0.45 + layer * (top - 0.45);
    F.push({ p: V(x, y, z), s: 0, target: 0.13 + Math.random() * 0.1, delay: layer * 2.2 + Math.random() * 0.4, alive: true, pop: 0 });
  }
  function writeFoam() {
    for (let i = 0; i < N; i++) {
      const f = F[i];
      dummy.position.copy(f.p); dummy.scale.setScalar(Math.max(0.0001, f.s)); dummy.updateMatrix();
      foam.setMatrixAt(i, dummy.matrix);
    }
    foam.instanceMatrix.needsUpdate = true;
  }
  writeFoam(); root.add(foam);
  let foamT = 0;
  onUpdate((dt, t) => {
    if (!foamOn) return;
    foamT += dt;
    for (const f of F) {
      if (!f.alive) { f.s = Math.max(0, f.s - dt * 2.5); continue; }
      if (foamT > f.delay) f.s += (f.target - f.s) * Math.min(1, dt * 4);
      f.s += Math.sin(t * 3 + f.p.x * 10) * 0.0004;
    }
    writeFoam();
  });
  async function jumpIn() {
    G.busy = true;
    await wait(0.4);
    gp.setExpr('laugh'); sfx.laughLow();
    await walkTo(gp, -0.9, -0.3, 1.4);
    sfx.boing(0.7);
    const from = gp.g.position.clone();
    const to = V(0.0, 0.2, -0.3);
    setPose(gp, 'sit');
    await tween(0.6, k => { gp.g.position.lerpVectors(from, to, k); gp.g.position.y += Math.sin(k * Math.PI) * 0.6; gp.g.rotation.y = 0.4 - k * 0.15; });
    gp.g.position.y = 0.3 - gp.legL + 0.05; gp.g.rotation.y = 0.25; gp.legs.forEach(l => { l.visible = false; }); // legs are under the water
    sfx.splash(); sparkle(root, V(0.2, 0.7, -0.3), 12, 0.6, 0xbfe6ff);
    gp.setExpr('happy');
    await wait(0.6);
    // foam goes wild
    foamOn = true; sfx.giggle();
    for (let i = 0; i < 10; i++) { setTimeout(() => sfx.blip(), i * 180); }
    await wait(0.9); gp.setExpr('surprised');
    girl.setExpr('surprised', 1.5);
    await wait(1.6);
    gp.setExpr('laugh'); sfx.laughLow(); girl.setExpr('laugh', 1.5); sfx.giggle();
    // foam hat on grandpa
    const hat = new THREE.Group();
    for (let i = 0; i < 6; i++) hat.add(mesh(new THREE.SphereGeometry(0.09 - i * 0.008, 12, 10), foam.material, Math.sin(i) * 0.03, i * 0.07, 0));
    hat.position.set(0, gp.headR * 0.9, 0); hat.scale.setScalar(0.01); gp.head.add(hat);
    tween(0.6, k => hat.scale.setScalar(Math.max(0.01, k)), ease.back);
    const beard = mesh(new THREE.SphereGeometry(0.11, 12, 10), foam.material, 0, -gp.headR * 0.75, gp.headR * 0.6); beard.scale.set(1.2, 0.8, 0.7); gp.head.add(beard);
    await wait(0.8);
    G.busy = false;
    popping = true;
  }
  let popping = false, poppedN = 0;
  onTap(foam, (p) => popAt(p), () => popping && !done);
  function popAt(p) {
    let n = 0;
    for (const f of F) if (f.alive && f.s > 0.02 && f.p.distanceTo(p) < 0.38) { f.alive = false; n++; }
    if (n) {
      sfx.pop(); poppedN += n; girlReact('happy', 0.6);
      for (let i = 0; i < Math.min(4, n); i++) floatBubble(p.clone().add(V((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3)));
    }
    if (poppedN > N * 0.8) finish();
  }
  const scene = { root };
  const bubTex = canvasTex(64, 64, (c) => { const g = c.createRadialGradient(28, 26, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.6, 'rgba(200,230,255,0.25)'); g.addColorStop(0.92, 'rgba(255,200,240,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(32, 32, 31, 0, 7); c.fill(); });
  function floatBubble(p) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubTex, transparent: true, depthWrite: false }));
    const s = 0.08 + Math.random() * 0.12; sp.scale.setScalar(s); sp.position.copy(p); root.add(sp);
    const dx = (Math.random() - 0.5) * 0.6;
    tween(2 + Math.random(), k => { sp.position.set(p.x + dx * k + Math.sin(k * 10) * 0.05, p.y + k * 1.4, p.z); sp.material.opacity = 1 - k * k; }, ease.linear).then(() => root.remove(sp));
  }
  async function finish() {
    if (done) return; done = true; popping = false;
    F.forEach(f => f.alive = false);
    G.busy = true;
    await wait(0.5);
    sfx.sparkle(); gp.setExpr('laugh'); sfx.laughLow();
    // rubber duck plops into the water
    const duck = new THREE.Group();
    const dm = std(0xffd21f, 0.35);
    duck.add(mesh(new THREE.SphereGeometry(0.1, 16, 12), dm, 0, 0, 0)); duck.children[0].scale.set(1.3, 0.8, 1);
    duck.add(mesh(new THREE.SphereGeometry(0.065, 16, 12), dm, -0.07, 0.1, 0));
    duck.add(mesh(new THREE.ConeGeometry(0.03, 0.06, 10).rotateZ(Math.PI / 2), std(0xff8a1f, 0.4), -0.15, 0.1, 0));
    duck.position.set(0.7, 1.6, -0.25); root.add(duck);
    await tween(0.6, k => { duck.position.y = 1.6 - k * (1.6 - 0.58); }, ease.in);
    sfx.splash(); sfx.blip();
    onUpdate((dt, t) => { duck.position.y = 0.58 + Math.sin(t * 3) * 0.015; duck.rotation.z = Math.sin(t * 2) * 0.1; });
    await cheer(gp, 1.0);
    girl.setExpr('laugh'); cheer(girl, 1.0); sfx.yay();
    floatIcon(root, 'heart', gp.headTop().add(V(0, 0.3, 0.1)), 0.4);
    await wait(2.2);
    goScene(4);
  }
  // ambient floating bubbles you can pop
  let ambT = 0;
  const ambient = [];
  onUpdate((dt) => {
    if (!foamOn) return;
    ambT -= dt;
    if (ambT < 0 && ambient.length < 6) {
      ambT = 0.9;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubTex, transparent: true, depthWrite: false }));
      const s = 0.15 + Math.random() * 0.12; sp.scale.setScalar(s);
      sp.position.set(-0.4 + Math.random() * 1.4, 0.9, -0.3 + Math.random() * 0.4); root.add(sp);
      const b = { sp, vy: 0.25 + Math.random() * 0.2, ph: Math.random() * 6 };
      ambient.push(b);
      b.tap = onTap(sp, () => { sfx.pop(); sparkle(root, sp.position, 4, 0.2, 0xbfe6ff); kill(b); });
    }
    for (const b of ambient.slice()) {
      b.sp.position.y += b.vy * dt; b.ph += dt; b.sp.position.x += Math.sin(b.ph * 2) * 0.004;
      if (b.sp.position.y > 3.0) kill(b);
    }
  });
  function kill(b) { root.remove(b.sp); removeTap(b.tap); ambient.splice(ambient.indexOf(b), 1); }
  scene.start = () => {
    setCam(V(0.6, 2.8, 5.6), V(0.1, 0.9, -0.2), 5.6, 3.3);
    camTo(V(0.3, 2.35, 4.4), V(0.1, 0.85, -0.2), 4.6, 2.75, 1.8);
    gp.setExpr('smile');
    wait(1.2).then(() => { gp.setExpr('wow', 1.2); sfx.yum(); });
    hintUpdater(() => {
      if (popping) return [];
      const l = [];
      if (!filled && !faucet.userData.running) l.push(faucet);
      if (!soap && !bottle.userData.busy) l.push(bottle);
      return l;
    });
  };
  scene.onRub = (sx, sy) => {
    if (!popping || done) return;
    // rubbing across the foam also pops it
    const hit = setRay(sx, sy).intersectObject(foam)[0];
    if (hit) popAt(hit.point);
  };
  return scene;
}

// =====================================================================
// 4. garden: trampoline "flying practice", then the photo on the wall; free play
// =====================================================================
function sceneGarden() {
  const C = G.cast;
  const root = new THREE.Scene(); root.background = new THREE.Color(0xa8d4f5);
  const sun = lights(root, { sunPos: [-5, 12, 7], shadowExt: 10, sun: 2.6, env: 0.5, sky: 0xdff0ff, ground: 0x6a8a3a, hemi: 1.0 });
  const grass = mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: tex('grass', 22), roughness: 0.95, color: 0xd8f0c8 }), 0, 0, 0, false);
  grass.rotation.x = -Math.PI / 2; root.add(grass);
  // backdrop photo of a garden on a big curved screen
  const bd = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 17, 48, 1, true, Math.PI - 0.95, 1.9), new THREE.MeshBasicMaterial({ map: tex('garden', 1), side: THREE.BackSide, toneMapped: false, color: 0xeeeeee }));
  bd.position.set(0, 6.6, 9); root.add(bd);
  // hotel wall (brick) with the empty frame
  const wall = mesh(new THREE.BoxGeometry(7.5, 4.6, 0.4), new THREE.MeshStandardMaterial({ map: tex('brick', 4, 2.4), roughness: 0.9 }), -5.4, 2.3, -3.2); root.add(wall);
  wall.add(mesh(new THREE.BoxGeometry(7.6, 0.15, 0.5), std(0xf4efe6, 0.6), 0, 2.3, 0));
  const blank = canvasTex(64, 80, (c) => { c.fillStyle = '#f5efe2'; c.fillRect(0, 0, 64, 80); c.fillStyle = '#e5dccb'; c.beginPath(); c.arc(32, 34, 14, 0, 7); c.fill(); c.fillRect(14, 52, 36, 28); });
  const frame = makeFrame(1.1, 1.38, blank, M.brass); frame.position.set(-3.6, 2.35, -2.98); root.add(frame);
  const plaque = mesh(new THREE.BoxGeometry(0.6, 0.16, 0.03), M.brass, -3.6, 1.45, -2.98); root.add(plaque);
  // wall lamps (brass)
  for (const x of [-4.6, -2.6]) { const l = mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.3, 16), M.brass, x, 2.9, -2.9); root.add(l); }
  const win = makeWindow(1.2, 1.2, tex('window', 1)); win.position.set(-6.4, 2.4, -2.98); root.add(win);
  // garden table with white tablecloth & parasol
  const tbl = makeTable(0.6); tbl.position.set(4.6, 0, -2.6); root.add(tbl);
  const para = new THREE.Group(); para.position.set(4.6, 0, -2.6); root.add(para);
  para.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 8), M.brass, 0, 1.2, 0));
  para.add(mesh(new THREE.ConeGeometry(1.3, 0.5, 12, 1, true), std(0xffffff, 0.8, { side: THREE.DoubleSide, map: tex('linen', 2) }), 0, 2.4, 0));
  // hedges
  for (let i = 0; i < 6; i++) { const h = mesh(new THREE.SphereGeometry(0.7, 16, 12), std(0x3f7f34, 0.9), 2.2 + i * 1.1, 0.5, -4.6 - (i % 2) * 0.4); h.scale.y = 0.8; root.add(h); }
  // trampoline
  const tramp = new THREE.Group(); const TP = V(0.9, 0, -0.4); tramp.position.copy(TP); root.add(tramp);
  const MAT_Y = 0.62;
  const matM = mesh(new THREE.CircleGeometry(1.05, 48).rotateX(-Math.PI / 2), std(0x1e1e24, 0.7), 0, MAT_Y, 0); tramp.add(matM);
  const pad = mesh(new THREE.TorusGeometry(1.18, 0.12, 12, 48).rotateX(Math.PI / 2), std(0x3fa7e0, 0.5), 0, MAT_Y + 0.02, 0); tramp.add(pad);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; tramp.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, MAT_Y, 8), M.steel, Math.cos(a) * 1.15, MAT_Y / 2, Math.sin(a) * 1.15)); }
  const tHit = hitProxy(new THREE.CylinderGeometry(1.3, 1.3, 0.9, 16)); tHit.position.y = 0.45; tramp.add(tHit);
  const girl = G.girl; root.add(girl.g); place(girl, -2.0, 2.3, 0.5);
  const jumpers = [
    { c: C.papa, home: V(3.0, 0, 0.8) }, { c: C.mama, home: V(3.9, 0, 1.4) },
    { c: C.grandpa, home: V(-1.0, 0, 1.0) }, { c: C.neighbor, home: V(-3.0, 0, 0.6) },
  ];
  jumpers.forEach(j => { root.add(j.c.g); place(j.c, j.home.x, j.home.z, j.home.x > 0 ? -0.5 : 0.5); j.c.setExpr('smile'); j.flown = false; });
  const girlJ = { c: girl, home: V(-2.0, 0, 2.3), isGirl: true };
  animate([girl, ...jumpers.map(j => j.c)]);

  const HEIGHTS = [0.3, 0.75, 1.3, 1.95, 2.7];
  const GRAV = 7.0;
  let on = null; // { j, y, vy, level, boost, spinning }
  G.dbg.tramp = tramp; G.dbg.jumpers = jumpers; G.dbg.on = () => on; G.dbg.flyAll = () => jumpers.forEach(j => j.flown = true);
  let ceremony = false, free = false;

  function setOn(j) {
    on = { j, y: 0, vy: 0, level: 0, boost: false, topAt: -1, air: false };
  }
  async function goOn(j) {
    if (busyMove) return;
    busyMove = true;
    if (on) { const old = on; on = null; await getOff(old.j); }
    const c = j.c;
    c.setExpr('happy'); sfx.boing(0.8);
    const from = c.g.position.clone();
    const to = V(TP.x, MAT_Y, TP.z);
    const d = from.distanceTo(to);
    c.walking++;
    await tween(Math.max(0.6, d * 0.3), k => { c.g.position.lerpVectors(from, to, k); c.g.position.y = from.y + (MAT_Y - from.y) * k + Math.sin(k * Math.PI) * 0.9; c.g.rotation.y = 0; }, ease.inOut);
    c.walking--;
    setOn(j);
    busyMove = false;
  }
  async function getOff(j) {
    const c = j.c; c.anim = null; c.g.rotation.set(0, 0, 0); setPose(c, 'stand');
    armsTo(c, ARMS_DOWN[0], ARMS_DOWN[1], 0.2);
    const from = c.g.position.clone();
    await tween(0.6, k => { c.g.position.lerpVectors(from, j.home, k); c.g.position.y = from.y * (1 - k) + Math.sin(k * Math.PI) * 0.7; }, ease.inOut);
    c.g.position.y = 0;
    turnTo(c, j.home.x > 0 ? -0.5 : 0.5);
  }
  let busyMove = false;
  function boost() {
    if (!on || ceremony) return;
    on.boost = true;
    // squash the mat a bit under the finger
    sfx.blip();
  }
  // per-frame bounce physics
  onUpdate((dt, t) => {
    // pad wobble
    if (!on) { matM.position.y = MAT_Y; return; }
    const c = on.j.c;
    if (on.sit) return;
    on.vy -= GRAV * dt * (on.level >= 4 && on.vy < 0.6 && on.vy > -0.6 ? 0.35 : 1);
    on.y += on.vy * dt;
    if (on.y <= 0) {
      // landing
      on.y = 0;
      if (on.level >= 4 && on.j.c === C.papa && !on.j.gagDone) { papaGag(on); return; }
      if (on.boost) { on.level = Math.min(4, on.level + 1); on.boost = false; }
      else if (on.level > 0 && !free) on.level = Math.max(0, on.level - 1);
      else if (on.level > 0 && free) on.level = Math.max(0, on.level - 1);
      on.vy = Math.sqrt(2 * GRAV * HEIGHTS[on.level]);
      sfx.boing(0.8 + on.level * 0.18);
      tween(0.18, k => { matM.position.y = MAT_Y - Math.sin(k * Math.PI) * 0.12; pad.scale.setScalar(1 - Math.sin(k * Math.PI) * 0.03); }, ease.linear);
      c.setExpr(on.level >= 3 ? 'wow' : 'happy');
      if (on.level >= 4) {
        // flying!
        sfx.yay(); c.setExpr('laugh');
        const t0 = t;
        c.anim = (dt2, tt) => {
          const k = tt - t0;
          c.arms[0].rotation.z = -1.5 + Math.sin(k * 14) * 0.5; c.arms[1].rotation.z = 1.5 - Math.sin(k * 14) * 0.5;
          c.g.rotation.y = Math.min(Math.PI * 2, k * 4.5);
        };
        if (!on.j.flown && !on.j.isGirl) { on.j.flown = true; }
        bird(t);
      } else { c.anim = null; c.g.rotation.y = 0; c.arms[0].rotation.z = -0.5 - on.level * 0.2; c.arms[1].rotation.z = 0.5 + on.level * 0.2; }
    }
    c.g.position.set(TP.x, MAT_Y + on.y, TP.z);
    c.legs[0].rotation.x = on.y > 0.1 ? -0.3 : 0; c.legs[1].rotation.x = on.y > 0.1 ? 0.2 : 0;
    if (on.level >= 4 && on.y > HEIGHTS[4] * 0.5 && Math.random() < 0.3) sparkle(root, c.center(), 1, 0.3);
    if (!ceremony && !free && jumpers.every(j => j.flown) && on.y === 0) startCeremony();
  });
  async function papaGag(o) {
    o.sit = true; o.j.gagDone = true;
    const c = o.j.c; c.anim = null; c.g.rotation.y = 0;
    setPose(c, 'sit'); c.g.position.set(TP.x, MAT_Y - c.legL + 0.1, TP.z);
    sfx.thud(); c.setExpr('oops'); sfx.oops();
    tween(0.25, k => { matM.position.y = MAT_Y - Math.sin(k * Math.PI) * 0.2; });
    C.mama.setExpr('laugh', 2); girl.setExpr('laugh', 2); sfx.giggle();
    await wait(1.6);
    c.setExpr('laugh'); sfx.laughLow();
    setPose(c, 'stand'); armsTo(c, ARMS_DOWN[0], ARMS_DOWN[1], 0.2);
    o.level = 0; o.y = 0; o.vy = Math.sqrt(2 * GRAV * HEIGHTS[1]); o.sit = false;
  }
  let birdBusy = false;
  function bird(t) {
    if (birdBusy) return; birdBusy = true;
    const b = new THREE.Group();
    const bm = std(0x5aa0e0, 0.5);
    b.add(mesh(new THREE.SphereGeometry(0.12, 12, 10), bm, 0, 0, 0)); b.children[0].scale.set(1.4, 1, 1);
    const w1 = mesh(new THREE.BoxGeometry(0.06, 0.01, 0.25), bm, 0, 0.05, 0.12); const w2 = w1.clone(); w2.position.z = -0.12;
    b.add(w1, w2);
    b.add(mesh(new THREE.ConeGeometry(0.035, 0.08, 8).rotateZ(-Math.PI / 2), std(0xffa53a, 0.4), 0.18, 0.02, 0));
    root.add(b);
    tween(3.2, k => { b.position.set(-7 + k * 15, 4.0 + Math.sin(k * 6) * 0.3, -1.5); w1.rotation.x = Math.sin(k * 60) * 0.7; w2.rotation.x = -w1.rotation.x; }, ease.linear).then(() => { root.remove(b); birdBusy = false; });
    sfx.blip();
  }
  // taps
  jumpers.forEach(j => onTap(j.c.g, () => { if (on && on.j === j) boost(); else if (!ceremony) goOn(j); }, () => !ceremony));
  onTap(girl.g, () => { if (on && on.j === girlJ) boost(); else if (free) goOn(girlJ); else { sfx.giggle(); girl.setExpr('laugh', 1); hop(girl, 0.15, 0.3); } }, () => !ceremony);
  onTap(tramp, () => boost(), () => !ceremony);

  async function startCeremony() {
    ceremony = true;
    await wait(0.4);
    if (on) { const o = on; on = null; await getOff(o.j); }
    sfx.ding();
    // everyone lines up by the wall
    const spots = [[-5.4, -1.7], [-4.7, -1.2], [-2.5, -1.2], [-1.8, -1.7]];
    camTo(V(-3.6, 2.0, 4.4), V(-3.6, 1.7, -2.9), 5.8, 3.7, 1.6);
    await Promise.all(jumpers.map((j, i) => walkTo(j.c, spots[i][0], spots[i][1], 2.2, 0)));
    await walkTo(girl, -3.6, -1.6, 2.0, 0);
    await wait(0.4);
    // snap! the photo appears in the frame
    sfx.shutter(); await fadeTo(0.9, 0.08); await fadeTo(0, 0.35);
    const pic = frame.userData.pic;
    pic.material = new THREE.MeshBasicMaterial({ map: G.photo || blank, color: 0xffffff });
    sparkle(root, V(-3.6, 2.4, -2.8), 24, 1.0);
    // gold star badge on the frame
    const badge = iconSprite('heart', 0.4); badge.position.set(-3.05, 3.0, -2.85); root.add(badge);
    const plaqueStar = mesh(new THREE.CircleGeometry(0.06, 5), std(0xffe066, 0.3, { emissive: 0x806000 }), -3.6, 1.45, -2.96); root.add(plaqueStar);
    sfx.fanfare();
    girl.setExpr('wow'); cheer(girl, 2.0);
    jumpers.forEach(j => { j.c.setExpr('laugh'); clap(j.c, 2.4); });
    sfx.clap(16);
    confetti(root, V(-3.6, 3.8, -1.6), 4);
    await wait(3.4);
    jumpers.forEach(j => j.c.setExpr('happy'));
    girl.setExpr('happy');
    // back to the garden for free play
    camTo(V(-0.6, 2.9, 10.0), V(-0.6, 2.0, -0.8), 11.2, 6.6, 1.6);
    await Promise.all(jumpers.map(j => walkTo(j.c, j.home.x, j.home.z, 2.4, j.home.x > 0 ? -0.5 : 0.5)));
    await walkTo(girl, girlJ.home.x, girlJ.home.z, 2.2, 0.5);
    free = true; ceremony = false;
    document.getElementById('again').style.display = 'block';
    goOn(girlJ);
  }
  return {
    root,
    onMiss() { boost(); },
    start() {
      setCam(V(0, 3.6, 12.5), V(0, 2.2, -0.5), 12.5, 7.5);
      camTo(V(-0.4, 2.8, 9.8), V(-0.4, 2.0, -0.8), 10.6, 6.6, 2.0);
      wait(1.0).then(() => goOn(jumpers[0]));
      hintUpdater(() => {
        if (ceremony) return [];
        if (on && on.level < 2) return [tramp];
        return jumpers.filter(j => !j.flown && (!on || on.j !== j)).map(j => j.c.g);
      });
    },
  };
}
export { G };
