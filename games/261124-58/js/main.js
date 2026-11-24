import * as THREE from 'three';
import { clock, tween, wait, until, updateTweens, ease, rand, lerp, clamp, damp, canvasTex, noiseTex, woodTex, roundedBox, symbolTex } from './util.js';
import { initAudio, sfx, setMood } from './audio.js';
import { makePerson, walkTo, updateWalk, faceYaw } from './people.js';
import {
  V3, renderer, scene, camera, lightAt, cam, shot, updateCamera, fade, stdMat, mesh, woodMat, makeRoom, makeWindow, makeDoor,
  framedPicture, makeHat, makeBag, makeStrap, burst, updateParticles, CONFETTI, input, setRay, hits, rayPlane, toScreen, isUnder,
  updateHint, flyTo, popIn, popOut, signTex, raycaster,
} from './world.js';

const params = new URLSearchParams(location.search);
const JUMP = params.get('scene');
const AUTO = params.has('auto');

// =====================================================================
// People
// =====================================================================
const girl = makePerson({ skin: '#f3c6a5', hair: '#3a2214', hairStyle: 'pigtails', dress: true, shirt: '#ff9fc6', shoe: '#ff6f9f', voice: 1.18 });
const boyA = makePerson({ skin: '#eebd98', hair: '#2a1a10', hairStyle: 'short', shirt: '#79c267', pants: '#3e5c8e', shoe: '#ffffff', voice: 0.85, bangs: 0.34 });
const girlB = makePerson({ skin: '#f4c9a8', hair: '#7a4421', hairStyle: 'bob', dress: true, shirt: '#ffb04a', shoe: '#e65a2e', voice: 1.3, bangs: 0.38 });
const boyC = makePerson({ skin: '#b67a52', hair: '#1a120c', hairStyle: 'curly', shirt: '#a48ae0', pants: '#525a66', shoe: '#ffd23f', voice: 0.95 });
const teacher = makePerson({ adult: true, skin: '#efc29f', hair: '#4a2a18', hairStyle: 'ponytail', dress: true, shirt: '#7fb4d8', apron: '#ffd2e0', longSleeve: true, shoe: '#ffffff', voice: 0.72, bangs: 0.33, backLen: 0.8 });
const friends = [boyA, girlB, boyC];
const everyone = [girl, boyA, girlB, boyC, teacher];

// =====================================================================
// HALL (entrance with cubbies) at world origin
// =====================================================================
const hall = makeRoom({ w: 10, back: -2.5, front: 4, h: 3, wall: '#f6eedf' });
scene.add(hall.group);
const H = hall.group;
// cubby unit
const CUB = { xs: [-1.6, -0.8, 0, 0.8, 1.6], syms: ['apple', 'flower', 'car', 'star', 'fish'], z: -2.3 };
{
  const wood = new THREE.MeshStandardMaterial({ map: woodTex(36, 74, [2, 1]), roughness: 0.5 });
  const W = 4.1, D = 0.42, z0 = -2.5 + D / 2;
  const add = (w, h, d, x, y, z) => { const m = mesh(new THREE.BoxGeometry(w, h, d), wood); m.position.set(x, y, z); H.add(m); };
  add(W, 0.04, D, 0, 0.27, z0); add(W, 0.04, D, 0, 0.85, z0); add(W, 0.04, D, 0, 1.3, z0);
  add(W, 0.27, 0.03, 0, 0.135, -2.5 + D - 0.015);
  for (let i = 0; i <= 5; i++) add(0.04, 1.05, D, -2.0 + i * 0.8, 0.8, z0);
  CUB.xs.forEach((x, i) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshStandardMaterial({ map: symbolTex(CUB.syms[i]), roughness: 0.6 }));
    s.position.set(x, 1.42, -2.49 + D); H.add(s);
    const s2 = s.clone(); s2.position.set(x, 1.42 - 0.001, -2.49 + D); s2.scale.setScalar(1.15); s2.material = stdMat('#ffffff', 0.5); s2.position.z -= 0.002; H.add(s2);
    // hooks
    const hook = mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12, Math.PI), stdMat('#c9c9c9', 0.3, { metalness: 0.8 }));
    hook.position.set(x, 1.6, -2.47); H.add(hook);
  });
  [['sun', -3.4, 1.8], ['rainbow', 3.0, 1.85], ['family', 3.9, 1.7]].forEach(([k, x, y]) => {
    const p = framedPicture(k, 0.6, 0.48); p.position.set(x, y, -2.48); H.add(p);
  });
  const d = makeDoor(); d.rotation.y = -Math.PI / 2; d.position.set(4.99, 0, 0.7); H.add(d); hall.door = d;
  const d2 = makeDoor(); d2.rotation.y = Math.PI / 2; d2.position.set(-4.99, 0, 0.2); H.add(d2); hall.door2 = d2;
  const w = makeWindow(1.3, 1.0); w.position.set(-2.8, 1.75, -2.49); H.add(w);
  // plant
  const pot = mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.35, 20), stdMat('#d87b4a', 0.7)); pot.position.set(-4.3, 0.175, -2.0); H.add(pot);
  for (let i = 0; i < 9; i++) { const l = mesh(new THREE.SphereGeometry(0.16, 12, 8), stdMat('#4c9a3e', 0.6)); l.scale.set(0.6, 1.4, 0.3); l.position.set(-4.3 + rand(-0.15, 0.15), 0.6 + rand(0, 0.35), -2.0 + rand(-0.15, 0.15)); l.rotation.set(rand(-0.5, 0.5), rand(0, 3), rand(-0.6, 0.6)); H.add(l); }
  // stool for the start
  const stool = new THREE.Group();
  const seat = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 24), wood); seat.position.y = 0.4; stool.add(seat);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const l = mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.4, 8), wood); l.position.set(Math.cos(a) * 0.13, 0.2, Math.sin(a) * 0.13); stool.add(l); }
  stool.position.set(0.85, 0, 0.75); H.add(stool); hall.stool = stool;
  // mat at the entrance
  const mat = mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshStandardMaterial({ map: noiseTex('#5f9e7a', 30, 128, [4, 3]), roughness: 0.95 }), false, true);
  mat.rotation.x = -Math.PI / 2; mat.position.set(0.3, 0.004, 0.8); H.add(mat);
}
const slotPos = (col, kind) => new V3(CUB.xs[col], kind === 'hat' ? 0.95 : 0.4, CUB.z);

// hats & bags
const gear = new Map(); // person -> {hat, bag, strap}
function giveGear(p, sym, worn) {
  const hat = makeHat(), bag = makeBag(sym), strap = makeStrap();
  gear.set(p, { hat, bag, strap, sym });
  if (worn) { wearHat(p, hat, false); wearBag(p, bag, strap, false); }
  return gear.get(p);
}
function hatSpot(p) { return new V3(0, p.P.head * 1.03, 0); }
function bagSpot(p) { return new V3(-p.P.sh * 1.32, 0.07, 0.05); }
const bagQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0.1));
function wearHat(p, hat, anim = true) {
  if (!anim) { p.head.add(hat); hat.position.copy(hatSpot(p)); hat.quaternion.identity(); return Promise.resolve(); }
  return flyTo(hat, p.head, hatSpot(p), { dur: 0.55, arc: 0.3 });
}
function wearBag(p, bag, strap, anim = true) {
  p.hips.add(strap); strap.position.set(0, p.P.torso * 0.55, 0); strap.visible = true;
  bag.userData.loop.visible = false;
  if (!anim) { p.hips.add(bag); bag.position.copy(bagSpot(p)); bag.quaternion.copy(bagQuat); return Promise.resolve(); }
  return flyTo(bag, p.hips, bagSpot(p), { dur: 0.55, arc: 0.3, quat: bagQuat });
}

// =====================================================================
// CLASSROOM at x = 30
// =====================================================================
const CB = new V3(30, 0, 0);
const room = makeRoom({ w: 8, back: -3, front: 3.5, h: 3, wall: '#f5ecdc' });
room.group.position.copy(CB);
scene.add(room.group);
const C = room.group;
const toL = v => v.clone().sub(CB);
const toW = v => v.clone().add(CB);
const deco = new THREE.Group(); C.add(deco);
let cork, clockG, shelf, basket, tableG, cloth, rug, sign, bunting;
{
  [-1.2, 1.1].forEach(z => { const w = makeWindow(1.4, 1.15); w.rotation.y = Math.PI / 2; w.position.set(-3.99, 1.65, z); deco.add(w); });
  const d = makeDoor(); d.rotation.y = -Math.PI / 2; d.position.set(3.99, 0, 1.4); C.add(d); room.door = d;
  cork = new THREE.Group();
  const board = mesh(new THREE.BoxGeometry(2.6, 1.0, 0.03), new THREE.MeshStandardMaterial({ map: noiseTex('#c99a63', 40, 256, [3, 1]), roughness: 0.95 }));
  cork.add(board);
  const fr = mesh(new THREE.BoxGeometry(2.7, 1.1, 0.02), woodMat); fr.position.z = -0.01; cork.add(fr);
  ['sun', 'house', 'flower', 'fish', 'rainbow'].forEach((k, i) => {
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshStandardMaterial({ map: (framedPicture(k).children[0].material.map), roughness: 0.9 }));
    pic.position.set(-1.0 + i * 0.5, (i % 2 ? -0.18 : 0.15), 0.02); pic.rotation.z = rand(-0.08, 0.08); cork.add(pic);
    const pin = mesh(new THREE.SphereGeometry(0.02, 8, 6), stdMat(['#e53935', '#1e88e5', '#fdd835'][i % 3], 0.3)); pin.position.set(pic.position.x, pic.position.y + 0.17, 0.035); cork.add(pin);
  });
  cork.position.set(-0.6, 1.55, -2.98); deco.add(cork);
  // clock without numbers
  clockG = new THREE.Group();
  const face = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 40), stdMat('#ffffff', 0.4)); face.rotation.x = Math.PI / 2; clockG.add(face);
  const rim = mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 40), stdMat('#ff8a65', 0.4)); clockG.add(rim);
  for (let i = 0; i < 12; i++) { const t = mesh(new THREE.BoxGeometry(0.015, 0.04, 0.01), stdMat('#555', 0.5)); const a = i / 12 * Math.PI * 2; t.position.set(Math.sin(a) * 0.17, Math.cos(a) * 0.17, 0.025); t.rotation.z = -a; clockG.add(t); }
  const hh = mesh(new THREE.BoxGeometry(0.02, 0.1, 0.01), stdMat('#333')); hh.geometry.translate(0, 0.05, 0); hh.position.z = 0.03; hh.rotation.z = -1; clockG.add(hh);
  const mh = mesh(new THREE.BoxGeometry(0.014, 0.15, 0.01), stdMat('#333')); mh.geometry.translate(0, 0.075, 0); mh.position.z = 0.035; clockG.add(mh); clockG.userData.mh = mh;
  clockG.position.set(1.5, 2.3, -2.97); deco.add(clockG);
  // shelf with toys at back right
  shelf = new THREE.Group();
  const sw = new THREE.MeshStandardMaterial({ map: woodTex(38, 72, [1, 1]), roughness: 0.5 });
  const sadd = (w, h, d, x, y, z) => { const m = mesh(new THREE.BoxGeometry(w, h, d), sw); m.position.set(x, y, z); shelf.add(m); };
  sadd(1.0, 0.04, 0.4, 0, 0.02, 0); sadd(1.0, 0.04, 0.4, 0, 0.6, 0); sadd(1.0, 0.04, 0.4, 0, 1.18, 0);
  sadd(0.04, 1.2, 0.4, -0.48, 0.6, 0); sadd(0.04, 1.2, 0.4, 0.48, 0.6, 0); sadd(1.0, 1.2, 0.02, 0, 0.6, -0.19);
  ['#ef5350', '#42a5f5', '#ffca28'].forEach((c, i) => { const b = mesh(roundedBox(0.22, 0.22, 0.22, 0.03), stdMat(c, 0.5)); b.position.set(-0.3 + i * 0.3, 0.15, 0); shelf.add(b); });
  const ball = mesh(new THREE.SphereGeometry(0.14, 24, 16), stdMat('#ff7043', 0.35)); ball.position.set(-0.2, 0.76, 0); shelf.add(ball);
  const books = ['#8e24aa', '#43a047', '#fb8c00', '#1e88e5']; books.forEach((c, i) => { const b = mesh(new THREE.BoxGeometry(0.05, 0.3, 0.22), stdMat(c, 0.7)); b.position.set(0.1 + i * 0.07, 0.77, 0); shelf.add(b); });
  shelf.position.set(3.2, 0, -2.75); deco.add(shelf);
  basket = new THREE.Group();
  const bk = mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.12, 20, 1, true), new THREE.MeshStandardMaterial({ map: noiseTex('#c8955a', 50, 64, [6, 2]), roughness: 0.9, side: THREE.DoubleSide })); bk.position.y = 0.06; basket.add(bk);
  const bb = mesh(new THREE.CircleGeometry(0.13, 20), stdMat('#b07d48', 0.9)); bb.rotation.x = -Math.PI / 2; bb.position.y = 0.005; basket.add(bb);
  const bh = mesh(new THREE.TorusGeometry(0.16, 0.012, 6, 20, Math.PI), stdMat('#b07d48', 0.8)); bh.position.y = 0.12; basket.add(bh);
  basket.position.set(3.2, 1.2, -2.7); C.add(basket);
  // table
  tableG = new THREE.Group();
  const top = mesh(roundedBox(2.7, 0.06, 0.95, 0.02), new THREE.MeshStandardMaterial({ map: woodTex(34, 70, [2, 1]), roughness: 0.45 })); top.position.y = 0.47; tableG.add(top);
  [[-1.25, -0.4], [1.25, -0.4], [-1.25, 0.4], [1.25, 0.4]].forEach(([x, z]) => { const l = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 10), stdMat('#d9d2c5', 0.4, { metalness: 0.3 })); l.position.set(x, 0.225, z); tableG.add(l); });
  tableG.position.set(0, 0, -0.6); C.add(tableG);
  cloth = mesh(new THREE.BoxGeometry(2.8, 0.01, 1.05), new THREE.MeshStandardMaterial({
    map: canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,120,160,0.45)'; for (let i = 0; i < 8; i++) { c.fillRect(i * 32, 0, 16, h); c.fillRect(0, i * 32, w, 16); } }, { repeat: [6, 2] }), roughness: 0.9,
  }), false, true);
  cloth.position.set(0, 0.505, -0.6); cloth.visible = false; C.add(cloth);
  rug = mesh(new THREE.CircleGeometry(1.9, 48), new THREE.MeshStandardMaterial({
    map: canvasTex(512, 512, (c, w, h) => { const cols = ['#9ad0ec', '#f7c6d9', '#fde59a', '#b9e4c9']; for (let i = 6; i > 0; i--) { c.fillStyle = cols[i % 4]; c.beginPath(); c.arc(256, 256, i * 42, 0, 7); c.fill(); } }), roughness: 0.95,
  }), false, true);
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.005, -0.4); rug.scale.set(1.25, 0.8, 1); C.add(rug);
  sign = new THREE.Group();
  const sg = mesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshStandardMaterial({ map: signTex(), roughness: 0.8 }), false, true); sg.position.z = 0.012; sign.add(sg);
  const sfr = mesh(new THREE.BoxGeometry(1.6, 0.85, 0.025), new THREE.MeshStandardMaterial({ color: '#ff9fc6', roughness: 0.6 })); sign.add(sfr);
  sign.position.set(0.1, 1.75, -2.96); sign.visible = false; C.add(sign);
  bunting = new THREE.Group();
  for (let i = 0; i < 17; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 3), stdMat(CONFETTI[i % CONFETTI.length], 0.7));
    f.rotation.x = Math.PI; f.scale.z = 0.2; f.position.set(-3.6 + i * 0.45, 2.7 - Math.sin((i / 16) * Math.PI) * 0.25, -2.92); bunting.add(f);
  }
  bunting.visible = false; C.add(bunting);
}

// =====================================================================
// Main loop
// =====================================================================
const updaters = new Set();
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  clock.time += dt;
  updateTweens(dt);
  everyone.forEach(p => { updateWalk(p, dt); p.update(dt); });
  updaters.forEach(f => f(dt));
  updateParticles(dt);
  if (clockG) clockG.userData.mh.rotation.z = -clock.time * 0.05;
  updateCamera();
  updateHint();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function lookAtWorld(p, wpos) {
  const rp = new V3(); p.root.getWorldPosition(rp);
  const yaw = Math.atan2(wpos.x - rp.x, wpos.z - rp.z) - p.root.rotation.y;
  let a = ((yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  p.yawLookT = clamp(a, -0.9, 0.9);
}
function place(p, parent, x, z, yaw = 0) {
  p._walk = null; p.walking = false;
  parent.add(p.root); p.root.position.set(x, 0, z); p.root.rotation.y = yaw; p._yawT = yaw; p.yawLookT = 0;
}
const celebrate = async (who = everyone) => {
  sfx.yay(); sfx.fanfare();
  who.forEach((p, i) => { p.setExpr('happy', 2.2); p.setPose('cheer', 2); setTimeout(() => p.jump(0.14), i * 90); setTimeout(() => p.jump(0.12), 800 + i * 90); });
  const c = new V3(); who[0].root.getWorldPosition(c);
  for (let i = 0; i < 3; i++) { const q = new V3(); who[i % who.length].head.getWorldPosition(q); burst(q.add(new V3(0, 0.3, 0)), { n: 40, colors: CONFETTI, speed: 2.2, up: 1.2, g: -2.5, size: 0.07, life: 1.8 }); }
  await wait(2.3);
};

// =====================================================================
// SCENE 1: lockers + friends arriving
// =====================================================================
async function sceneLockers() {
  lightAt(new V3(0, 0, 0));
  const g = gear.get(girl) || giveGear(girl, 'star', true);
  if (!g.hat.parent || g.hat.parent === H) { wearHat(girl, g.hat, false); wearBag(girl, g.bag, g.strap, false); }
  if (girl.root.parent !== H) place(girl, H, 0, 0.8, 0);
  shot(new V3(0.15, 1.55, 3.7), new V3(0.15, 0.75, -1.35), 2.35, 1.1, 2.0);
  walkTo(girl, 0.45, -0.95, 0.9, 0);
  const st = { hat: false, bag: false, drag: null, greeted: new Set(), arrived: new Set(), stand: new Map(), busy: false };
  const fdef = [
    { p: boyA, col: 0, sym: 'apple', stand: [-1.7, -1.05] },
    { p: girlB, col: 1, sym: 'flower', stand: [-0.85, -1.15] },
    { p: boyC, col: 4, sym: 'fish', stand: [1.6, -1.05] },
  ];
  const owners = new Map(fdef.map(f => [f.col, f]));
  const arrive = async f => {
    const p = f.p;
    giveGear(p, f.sym, true);
    place(p, H, 5.6, 0.7, -Math.PI / 2);
    const hinge = hall.door.userData.hinge;
    sfx.door();
    tween(0.4, k => { hinge.rotation.y = -k * 1.4; });
    await walkTo(p, 3.6, 0.6, 1.1);
    tween(0.6, k => { hinge.rotation.y = -(1 - k) * 1.4; });
    await walkTo(p, CUB.xs[f.col], -1.7, 1.1, Math.PI);
    await wait(0.35);
    const gg = gear.get(p);
    p.setPose('reach', 1.2);
    gg.strap.visible = false;
    gg.bag.userData.loop.visible = true;
    await flyTo(gg.bag, H, slotPos(f.col, 'bag'), { dur: 0.45, arc: 0.1 });
    sfx.drop();
    await flyTo(gg.hat, H, slotPos(f.col, 'hat'), { dur: 0.45, arc: 0.1 });
    sfx.drop();
    await walkTo(p, f.stand[0], f.stand[1], 1, 0);
    st.arrived.add(p);
    p.setExpr('happy', 1);
  };
  const arrivals = (async () => {
    await wait(0.6); await arrive(fdef[0]);
    await wait(0.3); await arrive(fdef[1]);
    await wait(0.3); await arrive(fdef[2]);
  })();
  // attention: arrived, not greeted friends bounce a little
  const att = dt => {
    st.arrived.forEach(p => { if (!st.greeted.has(p) && Math.random() < dt * 0.8) { p.jump(0.05); p.setPose('wave', 0.8); } });
  };
  updaters.add(att);
  const plane = new V3(0, 0, 1), planeAt = new V3(0, 0, -1.85);
  const placeItem = async (it, col) => {
    st.busy = true;
    const kind = it.userData.kind;
    if (kind === 'bag') it.userData.loop.visible = true;
    await flyTo(it, H, slotPos(col, kind), { dur: 0.35, arc: 0.08 });
    sfx.drop();
    if (col !== 3) {
      const o = owners.get(col);
      const who = o && st.arrived.has(o.p) ? o.p : girl;
      if (who !== girl) lookAtWorld(who, toWorldH(slotPos(col, kind)));
      await who.huhThenHappy();
      who.yawLookT = 0;
      await flyTo(it, H, slotPos(3, kind), { dur: 0.6, arc: 0.3 });
      sfx.drop();
    }
    if (kind === 'hat') st.hat = true; else st.bag = true;
    girl.happy(1.2); sfx.chime();
    burst(toWorldH(slotPos(3, kind)), { n: 22, speed: 1.1, size: 0.05 });
    st.busy = false;
  };
  const toWorldH = v => v.clone();
  input.active = {
    down() {
      if (st.busy) return;
      const pool = [];
      if (!st.hat) pool.push(g.hat);
      if (!st.bag) pool.push(g.bag);
      const h = hits([...pool, ...[...st.arrived].map(p => p.root)]);
      if (!h.length) return;
      const o = h[0].object;
      const it = pool.find(i => isUnder(o, i));
      if (it) {
        st.drag = it; H.attach(it); sfx.pick();
        if (it === g.bag) { g.strap.visible = false; }
        girl.setPose('reach', 30);
        return;
      }
      const fr = friends.find(p => isUnder(o, p.root));
      if (fr) {
        fr.setPose('wave', 1.4); fr.happy(1.4); sfx.giggle(fr.voice);
        girl.setPose('wave', 1.2); girl.setExpr('happy', 1.2); lookAtWorld(girl, fr.root.position);
        setTimeout(() => { girl.yawLookT = 0; }, 1300);
        if (!st.greeted.has(fr)) { st.greeted.add(fr); sfx.sparkle(); const q = new V3(); fr.head.getWorldPosition(q); burst(q.add(new V3(0, 0.25, 0)), { n: 16, colors: ['#ffd23f', '#ff9fc6'], size: 0.05, speed: 0.9 }); }
      }
    },
    move() {
      if (!st.drag) return;
      const p = rayPlane(plane, planeAt);
      if (p) { p.y = clamp(p.y, 0.15, 1.8); st.drag.position.lerp(p, 0.6); }
      lookAtWorld(girl, st.drag.position);
    },
    up(x, y, tap) {
      const it = st.drag; if (!it) return;
      st.drag = null; girl.setPose(null); girl.yawLookT = 0;
      const pp = it.position;
      let col = -1, best = 0.55;
      CUB.xs.forEach((cx, i) => { const d = Math.abs(pp.x - cx); if (d < best && pp.y < 1.7) { best = d; col = i; } });
      if (tap) col = 3;
      if (col < 0) {
        if (it === g.hat) wearHat(girl, it); else wearBag(girl, it, g.strap);
        sfx.drop();
        return;
      }
      placeItem(it, col);
    },
    hint() {
      const f = [...st.arrived].find(p => !st.greeted.has(p));
      if (f && (st.hat && st.bag || Math.floor(clock.time / 4) % 2)) { const q = new V3(); f.head.getWorldPosition(q); return { from: q }; }
      if (!st.hat && !st.busy) return { from: g.hat.getWorldPosition(new V3()), to: slotPos(3, 'hat') };
      if (!st.bag && !st.busy) return { from: g.bag.getWorldPosition(new V3()), to: slotPos(3, 'bag') };
      if (f) { const q = new V3(); f.head.getWorldPosition(q); return { from: q }; }
      return null;
    },
  };
  await until(() => st.hat && st.bag && st.greeted.size === 3 && !st.busy);
  await arrivals;
  input.active = null;
  updaters.delete(att);
  await wait(0.4);
  await celebrate([girl, ...friends]);
  // everyone heads to the classroom door (left)
  const hinge = hall.door2.userData.hinge;
  sfx.door(); tween(0.5, k => { hinge.rotation.y = k * 1.3; });
  shot(new V3(-2.2, 1.5, 3.3), new V3(-3.2, 0.8, -0.2), 2.2, 1.1, 2.2);
  [girl, ...friends].forEach((p, i) => { setTimeout(() => walkTo(p, -4.6, 0.2 + (i % 2) * 0.25, 1.2), i * 300); });
  await wait(2.2);
  await fade(1, 0.6);
}

// =====================================================================
// CLASSROOM set-ups
// =====================================================================
const seats = {
  girl: [-0.5, -1.45, 0], girlB: [0.55, -1.45, 0], boyA: [-1.75, -0.6, 1.05], boyC: [1.75, -0.6, -1.05],
};
function seatKids() {
  place(girl, C, ...seats.girl); place(girlB, C, ...seats.girlB); place(boyA, C, ...seats.boyA); place(boyC, C, ...seats.boyC);
  [girl, ...friends].forEach(p => { const g = gear.get(p); if (g) { g.hat.visible = false; g.bag.visible = false; g.strap.visible = false; } });
}
const CLASS_SHOT = () => [toW(new V3(0, 2.15, 3.1)), toW(new V3(0, 0.62, -0.9)), 2.25, 1.15];

// =====================================================================
// SCENE 2a: SLIME classroom
// =====================================================================
const slimeMat = new THREE.MeshPhysicalMaterial({ color: '#ff7db8', roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.5, sheenColor: new THREE.Color('#ffd0ea'), emissive: '#3a0a20' });
async function sceneSlime() {
  lightAt(CB);
  seatKids();
  await shot(...CLASS_SHOT(), 0);
  await fade(0, 0.7);
  [girl, ...friends].forEach(p => p.setExpr('smile'));
  await wait(1.0);
  // ---- transform: everything turns to slime ----
  setMood(1);
  sfx.gloop();
  [girl, ...friends].forEach(p => { p.setExpr('surprise', 2.2); });
  const drips = new THREE.Group(); C.add(drips);
  const dripGeo = new THREE.CapsuleGeometry(0.06, 1, 6, 12);
  dripGeo.translate(0, -0.5, 0);
  for (let i = 0; i < 26; i++) {
    const m = mesh(dripGeo, slimeMat, false, false);
    const side = i < 16 ? 0 : (i < 21 ? -1 : 1);
    if (side === 0) m.position.set(-3.8 + i * 0.5 + rand(-0.1, 0.1), 3.02, -2.95);
    else m.position.set(side * 3.95, 3.02, -2.6 + (i % 5) * 1.2);
    m.userData.len = rand(0.25, 1.3); m.scale.set(rand(0.7, 1.4), 0.001, rand(0.4, 0.8));
    drips.add(m);
  }
  const ceilSlime = mesh(new THREE.BoxGeometry(8, 0.1, 0.25), slimeMat, false, false); ceilSlime.position.set(0, 3.0, -2.9); ceilSlime.scale.y = 0.01; drips.add(ceilSlime);
  const puddles = [];
  for (let i = 0; i < 5; i++) { const pm = mesh(new THREE.SphereGeometry(0.35, 24, 12), slimeMat, false, true); pm.scale.set(rand(0.6, 1.3) * 0.001, 0.0001, rand(0.6, 1.0) * 0.001); pm.position.set(rand(-3, 3), 0.0, rand(-2.5, 1.4)); pm.userData.s = [rand(0.6, 1.3), 0.06, rand(0.6, 1)]; C.add(pm); puddles.push(pm); }
  const wallFrom = room.wallMat.color.clone(), wallTo = new THREE.Color('#ffc2df');
  await tween(2.2, k => {
    room.wallMat.color.lerpColors(wallFrom, wallTo, k);
    room.wallMat.roughness = lerp(0.92, 0.3, k); room.wallMat.clearcoat = k;
    drips.children.forEach((m, i) => { if (m !== ceilSlime) m.scale.y = Math.max(0.001, m.userData.len * clamp(k * 1.6 - (i % 7) * 0.08, 0, 1)); });
    ceilSlime.scale.y = Math.max(0.01, k);
    puddles.forEach(pm => pm.scale.set(pm.userData.s[0] * k + 0.001, pm.userData.s[1] * k + 0.0001, pm.userData.s[2] * k + 0.001));
  });
  // ---- the big slime blob falls on the table ----
  const blobGeo = new THREE.SphereGeometry(0.42, 72, 44);
  {
    const p = blobGeo.attributes.position;
    for (let i = 0; i < p.count; i++) { let y = p.getY(i) * 0.52; if (y < 0) y *= 0.08; p.setY(i, y + 0.012); }
    blobGeo.computeVertexNormals();
  }
  const blob = mesh(blobGeo, slimeMat, true, true);
  blob.position.set(0, 0.5, -0.6);
  C.add(blob);
  const n = blobGeo.attributes.position.count;
  const base = Float32Array.from(blobGeo.attributes.position.array);
  const disp = new Float32Array(n * 3), vel = new Float32Array(n * 3), wgt = new Float32Array(n), flat = new Float32Array(n);
  const S = { size: 1, grab: false, D: new V3(), p0: new V3(), p0w: new V3(), drop: 0 };
  blob.position.y = 3.2;
  sfx.whoosh();
  await tween(0.55, k => { blob.position.y = lerp(3.2, 0.5, k); }, ease.in);
  sfx.gloop(); sfx.squish();
  for (let i = 0; i < n; i++) vel[i * 3 + 1] -= 1.6 * (base[i * 3 + 1] / 0.23);
  [girl, ...friends].forEach((p, i) => setTimeout(() => { p.setExpr('laugh', 1.5); sfx.giggle(p.voice); }, 300 + i * 120));

  const slimeUpdate = dt => {
    const pos = blobGeo.attributes.position.array;
    const k = S.grab ? 320 : 85;
    const damping = Math.exp(-(S.grab ? 16 : 4.5) * dt);
    const D = S.D, sz = S.size;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const bx = base[i3] * sz, by = base[i3 + 1] * sz, bz = base[i3 + 2] * sz;
      let fl = flat[i];
      if (fl > 0) flat[i] = Math.max(0, fl - dt * 0.08);
      let tx = 0, ty = 0, tz = 0;
      if (S.grab) { const w = wgt[i]; tx = w * D.x; ty = w * D.y; tz = w * D.z; }
      if (fl > 0) { ty -= by * 0.6 * fl; tx += bx * 0.32 * fl; tz += bz * 0.32 * fl; }
      for (let a = 0; a < 3; a++) {
        const t = a === 0 ? tx : a === 1 ? ty : tz;
        let v = vel[i3 + a];
        v += (t - disp[i3 + a]) * k * dt;
        v *= damping;
        vel[i3 + a] = v;
        disp[i3 + a] += v * dt;
      }
      pos[i3] = bx + disp[i3]; pos[i3 + 1] = Math.max(0.004, by + disp[i3 + 1]); pos[i3 + 2] = bz + disp[i3 + 2];
    }
    blobGeo.attributes.position.needsUpdate = true;
    blobGeo.computeVertexNormals();
    blobGeo.computeBoundingSphere();
  };
  updaters.add(slimeUpdate);

  // bowls
  const bowlGeo = new THREE.LatheGeometry([[0, 0], [0.06, 0], [0.1, 0.02], [0.125, 0.07], [0.118, 0.072], [0.09, 0.025], [0, 0.015]].map(([x, y]) => new THREE.Vector2(x, y)), 32);
  const bowlMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.2, clearcoat: 0.8, side: THREE.DoubleSide });
  const bowlDefs = [{ p: boyA, pos: new V3(-1.08, 0.5, -0.6) }, { p: girlB, pos: new V3(0.62, 0.5, -1.0) }, { p: boyC, pos: new V3(1.08, 0.5, -0.6) }];
  const bowls = bowlDefs.map(b => { const m = mesh(bowlGeo, bowlMat); m.position.copy(b.pos); C.add(m); popIn(m); return { ...b, m, filled: false, piece: null }; });
  // rolling pin
  const pin = new THREE.Group();
  const pinMat = new THREE.MeshStandardMaterial({ map: woodTex(30, 66, [1, 1]), roughness: 0.4 });
  const roll = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.5, 24), pinMat); roll.rotation.z = Math.PI / 2; pin.add(roll);
  [-1, 1].forEach(s => { const h = mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.13, 12), pinMat); h.rotation.z = Math.PI / 2; h.position.x = s * 0.31; pin.add(h); const kn = mesh(new THREE.SphereGeometry(0.026, 12, 8), pinMat); kn.position.x = s * 0.38; pin.add(kn); });
  pin.position.set(-0.6, 0.545, -0.27); pin.rotation.y = 0.15; C.add(pin); popIn(pin);
  const pinHome = pin.position.clone();
  await wait(0.8);
  setMood(0);

  const pieceGeo = new THREE.SphereGeometry(0.075, 28, 18);
  const st = { mode: null, piece: null, delivered: 0, lastPin: new V3(), busy: 0 };
  const camN = new V3();
  const grabStart = (hitW) => {
    S.grab = true;
    S.p0w.copy(hitW);
    S.p0.copy(hitW).sub(CB).sub(blob.position);
    const sz = S.size;
    for (let i = 0; i < n; i++) {
      const dx = base[i * 3] * sz - S.p0.x, dy = base[i * 3 + 1] * sz - S.p0.y, dz = base[i * 3 + 2] * sz - S.p0.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      let w = 0.82 * Math.exp(-d2 / (2 * 0.1 * 0.1)) + 0.25 * Math.exp(-d2 / (2 * 0.28 * 0.28));
      if (base[i * 3 + 1] < 0.02) w *= 0.15;
      wgt[i] = Math.min(1, w);
    }
    S.D.set(0, 0, 0);
    sfx.squish();
    girl.setPose('reach', 30); girl.setExpr('surprise', 0.6);
  };
  const deliver = async (piece, sx, sy) => {
    let target = null, bestD = 1e9;
    bowls.forEach(b => { if (b.filled) return; const s = toScreen(toW(b.pos)); const d = Math.hypot(s.x - sx, s.y - sy); if (d < bestD) { bestD = d; target = b; } });
    if (!target) target = bowls[(Math.random() * 3) | 0];
    st.busy++;
    const was = target.filled;
    target.filled = true;
    const dest = target.pos.clone().add(new V3(rand(-0.03, 0.03), 0.045, rand(-0.03, 0.03)));
    await flyTo(piece, C, dest, { dur: 0.55, arc: 0.35 });
    sfx.squish(); sfx.plop();
    tween(0.5, k => { piece.scale.set(1 + Math.sin(k * 9) * 0.25 * (1 - k), 0.8 - Math.sin(k * 9) * 0.2 * (1 - k), 1 + Math.sin(k * 9) * 0.25 * (1 - k)); });
    const p = target.p;
    p.happy(1.6); p.setPose('clap', 1.3); sfx.giggle(p.voice);
    burst(toW(dest).add(new V3(0, 0.1, 0)), { n: 18, colors: ['#ff9fc6', '#ffffff'], speed: 0.9, size: 0.04 });
    if (!was) { st.delivered++; sfx.chime(); }
    st.busy--;
  };
  input.active = {
    down(x, y) {
      camN.copy(camera.position).sub(cam.tgt).normalize();
      const h = hits([pin, blob]);
      if (!h.length) {
        const hp = hits(friends.map(p => p.root));
        if (hp.length) { const fr = friends.find(p => isUnder(hp[0].object, p.root)); fr.happy(1); sfx.giggle(fr.voice); }
        return;
      }
      if (isUnder(h[0].object, pin)) {
        st.mode = 'pin'; sfx.pick(); girl.setPose('reach', 30);
        st.lastPin.copy(pin.position);
        return;
      }
      st.mode = 'pull';
      grabStart(h[0].point);
    },
    move() {
      if (st.mode === 'pull' && S.grab) {
        const p = rayPlane(camN, S.p0w);
        if (!p) return;
        const D = p.sub(S.p0w);
        if (D.y < -0.05) D.y = -0.05;
        const L = D.length();
        if (L > 0.07) sfx.stretch();
        S.D.copy(D).clampLength(0, 0.6);
        lookAtWorld(girl, S.p0w);
        if (L > 0.46 && !st.piece) {
          // tear a piece off!
          const pc = mesh(pieceGeo, slimeMat); pc.scale.set(1, 0.8, 1);
          pc.position.copy(S.p0w).add(S.D).sub(CB);
          C.add(pc);
          st.piece = pc;
          S.grab = false;
          for (let i = 0; i < n; i++) { vel[i * 3] -= wgt[i] * S.D.x * 4; vel[i * 3 + 1] -= wgt[i] * S.D.y * 4; vel[i * 3 + 2] -= wgt[i] * S.D.z * 4; }
          S.D.set(0, 0, 0);
          S.size = Math.max(0.72, S.size * 0.95);
          sfx.pop(); sfx.boing();
          girl.setExpr('happy', 1.2); girl.jump(0.06);
          st.mode = 'piece';
        }
      } else if (st.mode === 'piece' && st.piece) {
        const p = rayPlane(camN, S.p0w);
        if (p) st.piece.position.lerp(p.sub(CB), 0.5);
      } else if (st.mode === 'pin') {
        const p = rayPlane(new V3(0, 1, 0), toW(new V3(0, 0.6, 0)));
        if (!p) return;
        const l = p.sub(CB);
        l.x = clamp(l.x, -1.15, 1.15); l.z = clamp(l.z, -0.98, -0.22);
        const dxz = Math.hypot(l.x - blob.position.x, (l.z - blob.position.z) * 1.0);
        const over = dxz < 0.42 * S.size;
        const ty = over ? 0.5 + 0.235 * S.size * 0.42 + 0.045 : 0.545;
        pin.position.x = damp(pin.position.x, l.x, 18, 0.016);
        pin.position.z = damp(pin.position.z, l.z, 18, 0.016);
        pin.position.y = damp(pin.position.y, ty, 12, 0.016);
        pin.rotation.y = damp(pin.rotation.y, 0, 8, 0.016);
        const moved = pin.position.distanceTo(st.lastPin);
        roll.rotation.x += (pin.position.z - st.lastPin.z) / 0.045;
        st.lastPin.copy(pin.position);
        lookAtWorld(girl, toW(pin.position));
        if (over && moved > 0.003) {
          const px = pin.position.x - blob.position.x, pz = pin.position.z - blob.position.z;
          let changed = 0;
          const sz = S.size;
          for (let i = 0; i < n; i++) {
            const bx = base[i * 3] * sz, bz = base[i * 3 + 2] * sz;
            if (Math.abs(bx - px) > 0.28) continue;
            const d = Math.abs(bz - pz);
            if (d < 0.14) { const f = 1 - d / 0.14; if (f > flat[i]) { flat[i] = f; changed++; } }
          }
          if (changed > 20) { sfx.squish(); girl.setExpr('happy', 0.6); }
        }
      }
    },
    up(x, y, tap) {
      if (st.mode === 'pull') {
        if (tap || S.D.length() < 0.05) {
          for (let i = 0; i < n; i++) vel[i * 3 + 1] -= wgt[i] * 1.8;
          sfx.boing();
          girl.setExpr('happy', 0.8);
        } else { sfx.boing(); }
        S.grab = false; S.D.set(0, 0, 0);
      } else if (st.mode === 'piece' && st.piece) {
        deliver(st.piece, x, y); st.piece = null;
      } else if (st.mode === 'pin') {
        tween(0.5, k => { pin.position.lerp(pinHome, k); pin.rotation.y = lerp(pin.rotation.y, 0.15, k); });
        sfx.drop();
      }
      st.mode = null; girl.setPose(null); girl.yawLookT = 0;
    },
    hint() {
      if (st.delivered >= 3) return null;
      const top = toW(blob.position).add(new V3(0.1, 0.18, 0.15));
      const b = bowls.find(b => !b.filled);
      return { from: top, to: b ? toW(b.pos).add(new V3(0, 0.05, 0)) : null };
    },
  };
  await until(() => st.delivered >= 3 && st.busy === 0 && !st.mode);
  input.active = null;
  await wait(0.5);
  await celebrate([girl, ...friends]);

  // ---- transform to BLOCKS: slime melts away ----
  setMood(1);
  sfx.whoosh();
  const wf = room.wallMat.color.clone();
  const pieces = C.children.filter(m => m.geometry === pieceGeo);
  [girl, ...friends].forEach(p => p.setExpr('surprise', 1.5));
  await tween(1.4, k => {
    room.wallMat.color.lerpColors(wf, new THREE.Color('#f5ecdc'), k);
    room.wallMat.roughness = lerp(0.3, 0.92, k); room.wallMat.clearcoat = 1 - k;
    drips.children.forEach(m => { m.scale.y = Math.max(0.001, m.scale.y * (1 - k * 0.2)); });
    drips.position.y = -k * 0.2;
    puddles.forEach(pm => pm.scale.multiplyScalar(1 - k * 0.15));
    blob.scale.set(1 + k * 0.6, Math.max(0.01, 1 - k), 1 + k * 0.6);
    [...pieces, ...bowls.map(b => b.m), pin].forEach(m => m.scale.setScalar(Math.max(0.001, 1 - k)));
  });
  updaters.delete(slimeUpdate);
  [blob, drips, pin, ...pieces, ...bowls.map(b => b.m), ...puddles].forEach(m => { C.remove(m); });
  // keep geometry memory small
  blobGeo.dispose();
}

// =====================================================================
// SCENE 2b: BLOCK classroom
// =====================================================================
const BS = 0.5;
const blockGeo = roundedBox(BS, BS, BS, 0.045, 2);
const grain = canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) { c.strokeStyle = `rgba(120,90,60,${rand(0.03, 0.1)})`; c.lineWidth = rand(1, 3); const y = rand(0, h); c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + rand(-8, 8), w * 0.6, y + rand(-8, 8), w, y + rand(-6, 6)); c.stroke(); }
});
const BCOLS = ['#e8473f', '#ffc93c', '#3e8ed8', '#4cb860', '#ff8a3d', '#f6efe2'];
const blockMats = BCOLS.map(c => new THREE.MeshStandardMaterial({ color: c, map: grain, roughness: 0.48 }));
function blockPatternTex() {
  return canvasTex(512, 256, (c, w, h) => {
    const s = 64;
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
      c.fillStyle = BCOLS[((x / s) * 3 + (y / s) * 2) % 5];
      c.fillRect(x, y, s, s);
      c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(x + 3, y + 3, s - 6, 6);
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x, y + s - 4, s, 4); c.fillRect(x + s - 4, y, 4, s);
    }
  }, { repeat: [3, 1.2] });
}

async function sceneBlocks() {
  lightAt(CB);
  if (girl.root.parent !== C) { seatKids(); await shot(...CLASS_SHOT(), 0); await fade(0, 0.5); }
  const BLOCK_SHOT = [toW(new V3(0.25, 2.1, 5.0)), toW(new V3(0.25, 1.35, -0.9)), 3.1, 1.7];
  shot(...BLOCK_SHOT, 1.6);
  const blocks = [];
  const mk = (x, y, z, ci, kind, col = -1, row = -1) => {
    const m = mesh(blockGeo, blockMats[ci]);
    m.position.set(x, y + 5 + rand(0, 2), z);
    C.add(m);
    const b = { m, state: 'static', kind, col, row, home: new V3(x, y, z), v: new V3(), w: new V3(), rest: 0 };
    blocks.push(b);
    return b;
  };
  const COLS = 10, ROWS = 5, WZ = -2.72;
  const grid = [];
  for (let c = 0; c < COLS; c++) {
    grid.push([]);
    for (let r = 0; r < ROWS; r++) grid[c].push(mk(-2.25 + c * BS, 0.25 + r * BS, WZ, (c * 2 + r * 3) % 5, 'wall', c, r));
  }
  const desk = [];
  for (let i = 0; i < 5; i++) desk.push(mk(-1.0 + i * BS, 0.25, -0.6, (i + 2) % 5, 'desk'));
  // side walls become blocks
  const bpt = blockPatternTex();
  const oldMap = room.wallMat.map;
  sfx.whoosh();
  // table shrinks away, blocks rain in
  tween(0.6, k => { tableG.scale.setScalar(Math.max(0.001, 1 - k)); });
  [...blocks].sort((a, b) => a.home.y - b.home.y).forEach((b, i) => {
    const y0 = b.m.position.y;
    setTimeout(() => {
      tween(0.55, k => { b.m.position.y = lerp(y0, b.home.y, k); }, ease.bounce).then(() => sfx.clack(rand(0.8, 1.2)));
    }, i * 22);
  });
  tween(1.2, k => { room.wallMat.color.setRGB(1, 1, 1).lerp(new THREE.Color('#f5ecdc'), 1 - k); }).then(() => { room.wallMat.map = bpt; room.wallMat.needsUpdate = true; });
  deco.visible = true;
  await wait(blocks.length * 0.022 + 0.7);
  tableG.visible = false;
  [girl, ...friends].forEach((p, i) => setTimeout(() => { p.setExpr('happy', 1.2); sfx.giggle(p.voice); }, i * 150));
  setMood(0);
  // tower spot + hanging star
  const TOWER = new V3(2.55, 0, 0.55), NEED = 5;
  const mat = mesh(new THREE.CircleGeometry(0.42, 32), stdMat('#fff2b3', 0.9), false, true); mat.rotation.x = -Math.PI / 2; mat.position.set(TOWER.x, 0.006, TOWER.z); C.add(mat);
  const starG = new THREE.Group();
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.09 : 0.2; const a = Math.PI / 2 + i * Math.PI / 5; if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  const starMat = new THREE.MeshStandardMaterial({ color: '#ffcc22', roughness: 0.3, metalness: 0.3, emissive: '#ffaa00', emissiveIntensity: 0.15 });
  const starM = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }), starMat);
  starM.position.z = -0.025; starG.add(starM);
  const string = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.4, 4), stdMat('#888'), false, false); string.position.y = 0.4; starG.add(string);
  const STAR_Y = 0.25 + NEED * BS + 0.12;
  starG.position.set(TOWER.x, STAR_Y, TOWER.z); C.add(starG);
  const starSpin = dt => { starG.rotation.y += dt * (st.done ? 6 : 0.8); };
  updaters.add(starSpin);
  const st = { tower: [], reserved: 0, done: false, knocked: 0 };
  const knock = (b, strong = 1) => {
    if (b.state !== 'static') return;
    b.state = 'fall';
    b.v.set(rand(-1.2, 1.2) * strong, rand(1.5, 3) * strong, rand(1.0, 2.6) * strong);
    b.w.set(rand(-7, 7), rand(-4, 4), rand(-7, 7));
    st.knocked++;
  };
  const supportCheck = () => {
    for (let c = 0; c < COLS; c++) {
      let gone = false;
      for (let r = 0; r < ROWS; r++) {
        const b = grid[c][r];
        if (b.state !== 'static') gone = true;
        else if (gone) { b.state = 'fall'; b.v.set(rand(-0.3, 0.3), 0, rand(0.4, 1.4)); b.w.set(rand(-3, 3), 0, rand(-3, 3)); }
      }
    }
  };
  const qTmp = new THREE.Quaternion(), eTmp = new THREE.Euler();
  const physics = dt => {
    for (const b of blocks) {
      if (b.state === 'fall') {
        b.v.y -= 11 * dt;
        b.m.position.addScaledVector(b.v, dt);
        b.m.rotation.x += b.w.x * dt; b.m.rotation.y += b.w.y * dt; b.m.rotation.z += b.w.z * dt;
        const p = b.m.position;
        if (p.x < -3.7) { p.x = -3.7; b.v.x = Math.abs(b.v.x) * 0.4; }
        if (p.x > 3.7) { p.x = 3.7; b.v.x = -Math.abs(b.v.x) * 0.4; }
        if (p.z < -2.7) { p.z = -2.7; b.v.z = Math.abs(b.v.z) * 0.4; }
        if (p.z > 2.0) { p.z = 2.0; b.v.z = -Math.abs(b.v.z) * 0.4; }
        if (p.y < BS / 2 && b.v.y < 0) {
          p.y = BS / 2;
          if (Math.abs(b.v.y) > 1.2) sfx.clack(rand(0.7, 1.3));
          b.v.y = -b.v.y * 0.32; b.v.x *= 0.55; b.v.z *= 0.55; b.w.multiplyScalar(0.45);
          if (Math.abs(b.v.y) < 0.7) {
            b.state = 'settle'; b.rest = 0;
            eTmp.set(0, b.m.rotation.y, 0); b.q1 = new THREE.Quaternion().setFromEuler(eTmp); b.q0 = b.m.quaternion.clone();
          }
        }
      } else if (b.state === 'settle') {
        b.rest += dt * 4;
        b.m.quaternion.slerpQuaternions(b.q0, b.q1, Math.min(1, b.rest));
        b.m.position.y = BS / 2;
        b.m.position.x += b.v.x * dt; b.m.position.z += b.v.z * dt; b.v.multiplyScalar(0.9);
        if (b.rest >= 1) b.state = 'rest';
      }
    }
    // spread resting blocks so they don't overlap
    const rs = blocks.filter(b => b.state === 'rest');
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i].m.position, c = rs[j].m.position;
      const dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz);
      if (d < 0.52 && d > 0.0001) { const push = (0.52 - d) * 0.25; a.x -= dx / d * push; a.z -= dz / d * push; c.x += dx / d * push; c.z += dz / d * push; }
    }
    rs.forEach(b => { const p = b.m.position; p.x = clamp(p.x, -3.7, 3.7); p.z = clamp(p.z, -2.7, 2.0); if (Math.hypot(p.x - TOWER.x, p.z - TOWER.z) < 0.55) { const d = Math.hypot(p.x - TOWER.x, p.z - TOWER.z) || 0.01; p.x = TOWER.x + (p.x - TOWER.x) / d * 0.55; p.z = TOWER.z + (p.z - TOWER.z) / d * 0.55; } });
  };
  updaters.add(physics);
  const toTower = async b => {
    const i = st.reserved++;
    b.state = 'fly';
    sfx.pick();
    girl.setPose('reach', 0.6); lookAtWorld(girl, toW(TOWER));
    const dest = new V3(TOWER.x, BS / 2 + i * BS, TOWER.z);
    await flyTo(b.m, C, dest, { dur: 0.55, arc: 0.6 + i * 0.1, quat: new THREE.Quaternion() });
    b.state = 'tower';
    st.tower.push(b);
    sfx.clack(1.2 + i * 0.1);
    tween(0.3, k => { b.m.scale.set(1 + Math.sin(k * Math.PI) * 0.1, 1 - Math.sin(k * Math.PI) * 0.1, 1 + Math.sin(k * Math.PI) * 0.1); });
    burst(toW(dest).add(new V3(0, 0.25, 0)), { n: 10, colors: ['#ffffff', '#ffe066'], size: 0.04, speed: 0.8 });
    friends[i % 3].happy(1); friends[i % 3].setPose('clap', 1);
    girl.yawLookT = 0;
    if (st.tower.length >= NEED && !st.done) {
      st.done = true;
      starMat.emissiveIntensity = 1.4;
      sfx.magic();
      burst(toW(starG.position), { n: 60, colors: ['#ffe066', '#ffffff', '#ffb02e'], speed: 2.2, size: 0.07, life: 1.6 });
    }
  };
  input.active = {
    down() {
      if (st.done) return;
      const meshes = blocks.filter(b => b.state === 'static' || b.state === 'rest' || b.state === 'tower').map(b => b.m);
      const h = hits(meshes);
      if (!h.length) {
        const hp = hits(friends.map(p => p.root));
        if (hp.length) { const fr = friends.find(p => isUnder(hp[0].object, p.root)); fr.happy(1); sfx.giggle(fr.voice); }
        return;
      }
      const b = blocks.find(bb => bb.m === h[0].object);
      if (b.state === 'static') {
        if (b.kind === 'desk') desk.forEach(d => knock(d, 0.8));
        else {
          blocks.forEach(o => { if (o.kind === 'wall' && o.state === 'static' && o.home.distanceTo(b.home) < 0.75) knock(o); });
        }
        supportCheck();
        sfx.crash();
        girl.setPose('reach', 0.5);
        [girl, ...friends].forEach((p, i) => { p.setExpr('surprise', 0.7); setTimeout(() => { p.setExpr('laugh', 1.2); if (i === 1) sfx.laughAll(); }, 700); });
      } else if (b.state === 'rest') {
        if (st.reserved < NEED) toTower(b);
        else { b.state = 'fall'; b.v.set(0, 3, 0); b.w.set(rand(-4, 4), 0, rand(-4, 4)); sfx.boing(); }
      } else if (b.state === 'tower') {
        tween(0.5, k => { st.tower.forEach((t, i) => { t.m.rotation.z = Math.sin(k * Math.PI * 4) * 0.04 * (1 - k) * (i + 1) * 0.4; }); });
        sfx.clack(0.7);
      }
    },
    hint() {
      if (st.done) return null;
      const r = blocks.find(b => b.state === 'rest');
      if (r && st.reserved < NEED) return { from: toW(r.m.position).add(new V3(0, 0.2, 0)) };
      const s = grid[4][2].state === 'static' ? grid[4][2] : blocks.find(b => b.state === 'static');
      return s ? { from: toW(s.m.position) } : null;
    },
  };
  await until(() => st.done);
  input.active = null;
  await wait(0.8);
  await celebrate([girl, ...friends]);
  updaters.delete(physics);
  return { blocks, starG, mat, starSpin, oldMap };
}

// =====================================================================
// SCENE 2c: BALLOON room
// =====================================================================
const NB = 270, BR = 0.22;
const balloonGeo = (() => {
  const g = new THREE.SphereGeometry(BR, 20, 14);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = y < 0 ? 1 - (-y / BR) * 0.18 : 1; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); p.setY(i, y * (y < 0 ? 1.15 : 1.02)); }
  g.computeVertexNormals();
  return g;
})();
const balloonMat = new THREE.MeshPhysicalMaterial({ roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.2 });
const balloons = new THREE.InstancedMesh(balloonGeo, balloonMat, NB);
balloons.castShadow = true; balloons.receiveShadow = true;
balloons.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
{
  const cols = ['#ff4d6d', '#ffd23f', '#4d9de0', '#3bceac', '#ff9fc6', '#b388eb', '#ffffff', '#ff8c42'];
  const c = new THREE.Color();
  for (let i = 0; i < NB; i++) { c.set(cols[i % cols.length]); balloons.setColorAt(i, c); }
}
balloons.visible = false;
balloons.frustumCulled = false;
balloons.boundingSphere = new THREE.Sphere(new V3(0, 1.5, 0), 7);
C.add(balloons);
const B = {
  pos: new Float32Array(NB * 3), vel: new Float32Array(NB * 3), q: [], alive: new Uint8Array(NB), scale: new Float32Array(NB),
  g: -3.2, colliders: [], push: null, pushV: new V3(), running: false, ceil: 3.0,
};
for (let i = 0; i < NB; i++) B.q.push(new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(-0.3, 0.3), rand(0, 6), rand(-0.3, 0.3))));
const bm = new THREE.Matrix4(), bv = new V3(), bs = new V3();
const strings = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NB * 6), 3));
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }));
  l.visible = false; l.frustumCulled = false; C.add(l);
  return l;
})();
function balloonStep(dt) {
  const P = B.pos, Vv = B.vel, n = NB, R2 = BR * 2, X0 = -3.75 + BR, X1 = 3.75 - BR, Z0 = -2.95 + BR, Z1 = 1.55, Y1 = B.ceil - BR;
  const drag = Math.exp(-1.6 * dt);
  for (let i = 0; i < n; i++) {
    if (!B.alive[i]) continue;
    const i3 = i * 3;
    Vv[i3 + 1] += B.g * dt;
    Vv[i3] *= drag; Vv[i3 + 1] *= drag; Vv[i3 + 2] *= drag;
    P[i3] += Vv[i3] * dt; P[i3 + 1] += Vv[i3 + 1] * dt; P[i3 + 2] += Vv[i3 + 2] * dt;
    if (P[i3 + 1] < BR) { P[i3 + 1] = BR; if (Vv[i3 + 1] < 0) Vv[i3 + 1] *= -0.3; }
    if (P[i3 + 1] > Y1) { P[i3 + 1] = Y1; if (Vv[i3 + 1] > 0) Vv[i3 + 1] *= -0.3; }
    if (P[i3] < X0) { P[i3] = X0; Vv[i3] = Math.abs(Vv[i3]) * 0.3; }
    if (P[i3] > X1) { P[i3] = X1; Vv[i3] = -Math.abs(Vv[i3]) * 0.3; }
    if (P[i3 + 2] < Z0) { P[i3 + 2] = Z0; Vv[i3 + 2] = Math.abs(Vv[i3 + 2]) * 0.3; }
    if (P[i3 + 2] > Z1) { P[i3 + 2] = Z1; Vv[i3 + 2] = -Math.abs(Vv[i3 + 2]) * 0.3; }
  }
  // balloon-balloon
  for (let i = 0; i < n; i++) {
    if (!B.alive[i]) continue;
    const i3 = i * 3, xi = P[i3], yi = P[i3 + 1], zi = P[i3 + 2];
    for (let j = i + 1; j < n; j++) {
      const j3 = j * 3;
      const dx = P[j3] - xi; if (dx > R2 || dx < -R2) continue;
      const dy = P[j3 + 1] - yi; if (dy > R2 || dy < -R2) continue;
      const dz = P[j3 + 2] - zi; if (dz > R2 || dz < -R2) continue;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= R2 * R2 || d2 < 1e-8 || !B.alive[j]) continue;
      const d = Math.sqrt(d2), o = (R2 - d) * 0.5, nx = dx / d, ny = dy / d, nz = dz / d;
      P[i3] -= nx * o; P[i3 + 1] -= ny * o; P[i3 + 2] -= nz * o;
      P[j3] += nx * o; P[j3 + 1] += ny * o; P[j3 + 2] += nz * o;
      const rv = (Vv[j3] - Vv[i3]) * nx + (Vv[j3 + 1] - Vv[i3 + 1]) * ny + (Vv[j3 + 2] - Vv[i3 + 2]) * nz;
      if (rv < 0) { const imp = rv * 0.5; Vv[i3] += nx * imp; Vv[i3 + 1] += ny * imp; Vv[i3 + 2] += nz * imp; Vv[j3] -= nx * imp; Vv[j3 + 1] -= ny * imp; Vv[j3 + 2] -= nz * imp; }
    }
  }
  // people as capsules
  for (const c of B.colliders) {
    const top = c.top();
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      if (P[i3 + 1] > top + BR) continue;
      const dx = P[i3] - c.x(), dz = P[i3 + 2] - c.z(), d = Math.hypot(dx, dz), m = c.r + BR;
      if (d < m && d > 1e-5) { P[i3] = c.x() + dx / d * m; P[i3 + 2] = c.z() + dz / d * m; }
    }
  }
  // finger: push away from the touch ray
  if (B.push) {
    const o = B.push.o, d = B.push.d, PR = 0.62;
    for (let i = 0; i < n; i++) {
      if (!B.alive[i]) continue;
      const i3 = i * 3;
      const px = P[i3] - o.x, py = P[i3 + 1] - o.y, pz = P[i3 + 2] - o.z;
      const t = px * d.x + py * d.y + pz * d.z;
      const cx = px - d.x * t, cy = py - d.y * t, cz = pz - d.z * t;
      const dist = Math.sqrt(cx * cx + cy * cy + cz * cz);
      if (dist < PR && dist > 1e-4) {
        const k = (PR - dist) / dist;
        P[i3] += cx * k * 0.22; P[i3 + 1] += cy * k * 0.12; P[i3 + 2] += cz * k * 0.22;
        Vv[i3] += cx * k * 2.2 + B.pushV.x * 0.3; Vv[i3 + 1] += cy * k * 1.2; Vv[i3 + 2] += cz * k * 2.2 + B.pushV.z * 0.3;
      }
    }
  }
}
function balloonRender() {
  const P = B.pos;
  const sp = strings.visible ? strings.geometry.attributes.position.array : null;
  for (let i = 0; i < NB; i++) {
    const s = B.scale[i] * (B.alive[i] ? 1 : 0);
    bv.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    bs.set(s, s, s);
    bm.compose(bv, B.q[i], bs);
    balloons.setMatrixAt(i, bm);
    if (sp) {
      const t = clock.time;
      sp[i * 6] = bv.x; sp[i * 6 + 1] = bv.y - BR * 1.1 * s; sp[i * 6 + 2] = bv.z;
      sp[i * 6 + 3] = bv.x + Math.sin(t * 1.3 + i) * 0.06; sp[i * 6 + 4] = bv.y - (BR * 1.1 + 0.55) * s; sp[i * 6 + 5] = bv.z + Math.cos(t + i) * 0.05;
    }
  }
  balloons.instanceMatrix.needsUpdate = true;
  if (sp) strings.geometry.attributes.position.needsUpdate = true;
}
const balloonUpdate = dt => {
  if (!B.running) return;
  const h = Math.min(dt, 0.033) / 2;
  balloonStep(h); balloonStep(h);
  for (let i = 0; i < NB; i++) if (B.alive[i] && B.scale[i] < 1) B.scale[i] = Math.min(1, B.scale[i] + dt * 3);
  balloonRender();
};
updaters.add(balloonUpdate);

function makeFruit(kind) {
  const g = new THREE.Group();
  if (kind === 'apple') {
    const a = mesh(new THREE.SphereGeometry(0.08, 28, 20), new THREE.MeshPhysicalMaterial({ color: '#98d44a', roughness: 0.3, clearcoat: 0.8 }));
    const p = a.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); const r = Math.hypot(p.getX(i), p.getZ(i)); if (y > 0.05 && r < 0.03) p.setY(i, y - 0.02 * (1 - r / 0.03)); }
    a.geometry.computeVertexNormals(); a.scale.y = 0.92; g.add(a);
    const s = mesh(new THREE.CylinderGeometry(0.005, 0.007, 0.05, 6), stdMat('#6b3d1c', 0.8)); s.position.y = 0.085; s.rotation.z = 0.2; g.add(s);
    const l = mesh(new THREE.SphereGeometry(0.03, 10, 6), stdMat('#3e9b2f', 0.5)); l.scale.set(1, 0.2, 0.5); l.position.set(0.025, 0.1, 0); l.rotation.z = -0.5; g.add(l);
    g.position.y = 0.075;
  } else if (kind === 'kiwi') {
    const skin = mesh(new THREE.SphereGeometry(0.07, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#8b6a3c', roughness: 0.95, side: THREE.DoubleSide }));
    skin.rotation.x = Math.PI; skin.scale.set(1, 1.2, 1); g.add(skin);
    const face = mesh(new THREE.CircleGeometry(0.068, 32), new THREE.MeshPhysicalMaterial({
      roughness: 0.25, clearcoat: 0.8,
      map: canvasTex(128, 128, (c) => { c.fillStyle = '#7ccf3a'; c.fillRect(0, 0, 128, 128); const gr = c.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, '#f4ffe0'); gr.addColorStop(0.25, '#d8f5a0'); gr.addColorStop(0.3, '#8ad84a'); gr.addColorStop(1, '#6cc232'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128); c.fillStyle = '#222'; for (let i = 0; i < 18; i++) { const a = i / 18 * 7; c.beginPath(); c.ellipse(64 + Math.cos(a) * 26, 64 + Math.sin(a) * 26, 4, 2, a, 0, 7); c.fill(); } }),
    }));
    face.rotation.x = -Math.PI / 2; g.add(face);
    g.position.y = 0.085;
  } else {
    const gm = new THREE.MeshPhysicalMaterial({ color: '#b6e06a', roughness: 0.25, clearcoat: 0.8 });
    const pts = [[0, 0.07, 0], [-0.03, 0.06, 0.02], [0.03, 0.06, 0.02], [0, 0.06, -0.03], [-0.02, 0.03, 0.0], [0.02, 0.03, 0.02], [0.0, 0.03, -0.02], [-0.035, 0.035, -0.02], [0.035, 0.035, -0.015], [0.0, 0.0, 0.0], [-0.015, 0.005, 0.02], [0.018, 0.008, -0.01]];
    pts.forEach(([x, y, z]) => { const s = mesh(new THREE.SphereGeometry(0.024, 14, 10), gm); s.position.set(x, y, z); g.add(s); });
    const st = mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.05, 6), stdMat('#6b5a2c', 0.8)); st.position.y = 0.11; g.add(st);
    g.position.y = 0.03;
  }
  g.userData.kind = kind;
  return g;
}

async function sceneBalloons(prev) {
  lightAt(CB);
  if (girl.root.parent !== C) { seatKids(); await fade(0, 0.5); }
  const BAL_SHOT = [toW(new V3(0, 2.75, 4.3)), toW(new V3(0, 0.35, -0.75)), 2.85, 1.55];
  shot(...BAL_SHOT, 1.8);
  // fruits hidden on the floor
  const fruits = [
    { kind: 'kiwi', at: new V3(-1.55, 0, -0.55) },
    { kind: 'apple', at: new V3(0.65, 0, -0.35) },
    { kind: 'grapes', at: new V3(1.85, 0, -1.75) },
  ].map(f => { const m = makeFruit(f.kind); m.position.x = f.at.x; m.position.z = f.at.z; m.userData.y0 = m.position.y; C.add(m); return { ...f, m, found: false }; });
  // kids move into the room; friends will hide
  const hide = [[boyA, -2.2, -1.3, 0.5], [girlB, 0.0, -2.1, 0], [boyC, 2.4, -0.4, -0.6]];
  walkTo(girl, -0.1, 0.95, 1, 0);
  hide.forEach(([p, x, z, y]) => walkTo(p, x, z, 1.1, y));
  // blocks pop into balloons
  const blocks = prev ? prev.blocks : [];
  let bi = 0;
  const spawn = (x, y, z, vy = 0) => {
    if (bi >= NB) return;
    const i = bi++;
    B.pos[i * 3] = x; B.pos[i * 3 + 1] = y; B.pos[i * 3 + 2] = z;
    B.vel[i * 3] = rand(-0.5, 0.5); B.vel[i * 3 + 1] = vy; B.vel[i * 3 + 2] = rand(-0.5, 0.5);
    B.alive[i] = 1; B.scale[i] = 0.05;
  };
  balloons.visible = true; B.running = true; B.g = -3.2;
  setMood(1);
  sfx.wow();
  blocks.forEach((b, i) => {
    setTimeout(() => {
      const p = b.m.position;
      sfx.pop();
      spawn(clamp(p.x, -3.4, 3.4), p.y, clamp(p.z, -2.6, 1.4), 1);
      burst(toW(p), { n: 6, colors: CONFETTI, size: 0.05, speed: 1 });
      C.remove(b.m);
    }, i * 30);
  });
  if (prev) {
    popOut(prev.starG); popOut(prev.mat); updaters.delete(prev.starSpin);
    tween(1, k => { room.wallMat.color.setScalar(1).lerp(new THREE.Color('#f5ecdc'), k); }).then(() => { room.wallMat.map = room.wallTex; room.wallMat.needsUpdate = true; });
  }
  await wait(blocks.length * 0.03 + 0.2);
  sfx.balloonRain();
  const rain = setInterval(() => {
    for (let k = 0; k < 6; k++) spawn(rand(-3.4, 3.4), 2.7, rand(-2.6, 1.3), -1);
    if (bi % 30 < 6) sfx.balloonRain();
    if (bi >= NB) clearInterval(rain);
  }, 70);
  await until(() => bi >= NB);
  // colliders for kids
  B.colliders = [girl, ...friends].map(p => ({ x: () => p.root.position.x, z: () => p.root.position.z, r: 0.16, top: () => p.hips.position.y + p.P.torso + 0.2 }));
  // friends duck and hide
  await wait(0.6);
  friends.forEach(p => { p.crouchT = 0.6; });
  sfx.giggle(1); sfx.giggle(1.2);
  await wait(1.4);
  setMood(0);
  const st = { found: 0, peeked: new Set(), busy: 0 };
  let lastRay = null;
  const findFruit = async f => {
    f.found = true; st.busy++;
    sfx.peek(); sfx.chime();
    girl.happy(1.4); girl.setExpr('surprise', 0.4); setTimeout(() => girl.happy(1.4), 400);
    burst(toW(f.m.position).add(new V3(0, 0.1, 0)), { n: 30, colors: ['#bfff6a', '#ffffff', '#ffe066'], speed: 1.4, size: 0.06 });
    // rise up out of the balloons, then fly into the basket
    const p0 = f.m.position.clone();
    await tween(0.5, k => { f.m.position.y = lerp(p0.y, 1.4, k); f.m.rotation.y = k * 6; }, ease.out);
    const slot = st.found;
    await flyTo(f.m, basket, new V3(-0.06 + slot * 0.06, 0.08, (slot % 2) * 0.04), { dur: 0.7, arc: 0.4 });
    sfx.plop();
    st.found++; st.busy--;
  };
  const peek = p => {
    if (st.peeked.has(p)) return;
    st.peeked.add(p);
    p.crouchT = 0; p.jump(0.15);
    p.setExpr('laugh', 1.5); sfx.peek(); setTimeout(() => sfx.giggle(p.voice), 250);
    girl.setExpr('surprise', 0.4); setTimeout(() => { girl.setExpr('laugh', 1); }, 400);
    const q = new V3(); p.head.getWorldPosition(q);
    burst(q.add(new V3(0, 0.2, 0)), { n: 14, colors: CONFETTI, size: 0.05, speed: 1 });
  };
  const handle = (x, y) => {
    setRay(x, y);
    const r = raycaster.ray;
    const o = toL(r.origin), d = r.direction.clone();
    if (lastRay) B.pushV.copy(o).sub(lastRay).multiplyScalar(30).clampLength(0, 4); else B.pushV.set(0, 0, 0);
    // push along a point deep in the scene so the tunnel is wide near the floor
    B.push = { o, d };
    lastRay = o.clone();
    const h = hits([balloons, ...fruits.filter(f => !f.found).map(f => f.m), ...friends.map(p => p.root)]);
    if (h.length) {
      const f = fruits.find(ff => !ff.found && isUnder(h[0].object, ff.m));
      if (f) findFruit(f);
      const fr = friends.find(p => isUnder(h[0].object, p.root));
      if (fr) peek(fr);
    }
    // friends: if the ray passes close to their head, they pop up
    friends.forEach(p => {
      if (st.peeked.has(p)) return;
      const q = new V3(); p.head.getWorldPosition(q);
      if (r.distanceSqToPoint(q) < 0.3 * 0.3) peek(p);
    });
    girl.setPose('swim', 0.6); girl.setExpr('happy', 0.5);
    if (Math.random() < 0.15) sfx.bonk();
  };
  input.active = {
    down(x, y) { lastRay = null; handle(x, y); },
    move(x, y) { handle(x, y); },
    up() { B.push = null; lastRay = null; },
    hint() {
      const f = fruits.find(ff => !ff.found);
      if (!f) return null;
      return { from: toW(f.m.position).add(new V3(0, 0.6, 0)), circle: true };
    },
  };
  await until(() => st.found >= 3 && st.busy === 0);
  input.active = null; B.push = null;
  friends.forEach(p => peek(p));
  await wait(1.0);
  await celebrate([girl, ...friends]);
  return { fruits };
}

// =====================================================================
// SCENE 3: green juice party
// =====================================================================
function glassMat() { return new THREE.MeshPhysicalMaterial({ color: '#eaf6ff', roughness: 0.04, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }); }
const juiceMat = new THREE.MeshPhysicalMaterial({ color: '#c9d98a', roughness: 0.18, clearcoat: 0.6, emissive: '#0d2a05', emissiveIntensity: 0.3 });
const cupJuiceMat = new THREE.MeshPhysicalMaterial({ color: '#56d13c', roughness: 0.15, clearcoat: 0.6, emissive: '#0d2a05', emissiveIntensity: 0.4 });

function makeCup() {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.04, 0], [0.042, 0.004], [0.05, 0.12], [0.046, 0.12], [0.038, 0.008], [0, 0.008]].map(([x, y]) => new THREE.Vector2(x, y)), 28), glassMat());
  glass.renderOrder = 2;
  g.add(glass);
  const j = mesh(new THREE.CylinderGeometry(0.045, 0.038, 1, 24), cupJuiceMat, false, false);
  j.geometry.translate(0, 0.5, 0);
  j.position.y = 0.01; j.scale.y = 0.0001; g.add(j);
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.08; g.add(hit);
  g.userData = { juice: j, level: 0, hit };
  return g;
}
function setCupLevel(cup, l) { cup.userData.level = l; cup.userData.juice.scale.y = Math.max(0.0001, l * 0.1); cup.userData.juice.visible = l > 0.01; }

async function sceneParty(prevB) {
  lightAt(CB);
  if (girl.root.parent !== C) { seatKids(); }
  // balloons float up to the ceiling
  if (!B.running) {
    balloons.visible = true; B.running = true;
    for (let i = 0; i < NB; i++) { B.pos[i * 3] = rand(-3.4, 3.4); B.pos[i * 3 + 1] = rand(2, 2.8); B.pos[i * 3 + 2] = rand(-2.6, 1.4); B.alive[i] = 1; B.scale[i] = 1; }
    await fade(0, 0.5);
  }
  B.colliders = [];
  sfx.whoosh(); sfx.wow();
  B.g = 2.6;
  strings.visible = true;
  const fruits = prevB ? prevB.fruits : ['kiwi', 'apple', 'grapes'].map((k, i) => { const m = makeFruit(k); basket.add(m); m.position.set(-0.06 + i * 0.06, 0.08, (i % 2) * 0.04); return { kind: k, m }; });
  friends.forEach(p => { p.crouchT = 0; });
  const PARTY_SHOT = [toW(new V3(0, 1.85, 3.55)), toW(new V3(0, 1.05, -0.9)), 2.3, 1.4];
  shot(...PARTY_SHOT, 2.0);
  await wait(1.0);
  // table comes back with a cloth, bunting and the picture sign
  tableG.visible = true; tableG.scale.setScalar(0.001);
  popIn(tableG, 0.6); sfx.magic();
  await wait(0.4);
  popIn(cloth, 0.4); bunting.visible = true; popIn(bunting, 0.6);
  const pos = { girl: [-0.55, -1.45, 0], girlB: [0.35, -1.45, 0], teacher: [1.2, -1.55, -0.15], boyA: [-1.75, -0.55, 1.1], boyC: [1.8, -0.45, -1.1] };
  walkTo(girl, pos.girl[0], pos.girl[1], 1, 0);
  walkTo(girlB, pos.girlB[0], pos.girlB[1], 1, 0);
  walkTo(boyA, pos.boyA[0], pos.boyA[1], 1, pos.boyA[2]);
  walkTo(boyC, pos.boyC[0], pos.boyC[1], 1, pos.boyC[2]);
  // the teacher (mom playing teacher) comes in with pitcher & cups
  place(teacher, C, 4.6, 1.4, -Math.PI / 2);
  const hinge = room.door.userData.hinge;
  sfx.door(); tween(0.4, k => { hinge.rotation.y = -k * 1.4; });
  await walkTo(teacher, 2.6, 1.0, 1.2);
  tween(0.6, k => { hinge.rotation.y = -(1 - k) * 1.4; });
  await walkTo(teacher, pos.teacher[0], pos.teacher[1], 1.2, pos.teacher[2]);
  teacher.happy(1.5); teacher.setPose('wave', 1.4); sfx.ooh(0.8);
  // put out things
  const pitcher = new THREE.Group();
  const pg = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.095, 0], [0.1, 0.01], [0.112, 0.26], [0.104, 0.26], [0.092, 0.012], [0, 0.012]].map(([x, y]) => new THREE.Vector2(x, y)), 36), glassMat());
  pg.renderOrder = 2; pitcher.add(pg);
  const spout = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 12, 1, true), glassMat()); spout.rotation.z = -Math.PI / 2 - 0.5; spout.position.set(0.12, 0.245, 0); spout.renderOrder = 2; pitcher.add(spout);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 8, 20, Math.PI), glassMat()); handle.rotation.z = Math.PI / 2; handle.position.set(-0.11, 0.14, 0); handle.renderOrder = 2; pitcher.add(handle);
  const pj = mesh(new THREE.CylinderGeometry(0.098, 0.093, 1, 32), juiceMat, false, false); pj.geometry.translate(0, 0.5, 0); pj.position.y = 0.014; pj.scale.y = 0.0001; pitcher.add(pj);
  const swirlTex = canvasTex(256, 256, (c) => { c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, 256, 256); c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); for (let a = 0; a < 12; a += 0.1) { const r = 10 + a * 9; c.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } c.stroke(); });
  const swirl = new THREE.Mesh(new THREE.CircleGeometry(0.096, 32), new THREE.MeshBasicMaterial({ map: swirlTex, transparent: true, opacity: 0, depthWrite: false }));
  swirl.rotation.x = -Math.PI / 2; pitcher.add(swirl);
  const spoon = new THREE.Group();
  const sh = mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.36, 8), stdMat('#d8d8d8', 0.2, { metalness: 0.9 })); sh.position.y = 0.18; spoon.add(sh);
  const sb = mesh(new THREE.SphereGeometry(0.022, 12, 8), stdMat('#d8d8d8', 0.2, { metalness: 0.9 })); sb.scale.set(1, 0.35, 1.4); spoon.add(sb);
  spoon.position.set(0.04, 0.05, 0); spoon.rotation.z = 0.25; spoon.visible = false; pitcher.add(spoon);
  const PITCHER_HOME = new V3(0, 0.51, -0.62);
  pitcher.position.copy(PITCHER_HOME); C.add(pitcher); pitcher.scale.setScalar(0.001); popIn(pitcher);
  const cupDefs = [
    { p: girl, at: new V3(-0.5, 0.51, -0.92) }, { p: girlB, at: new V3(0.35, 0.51, -0.95) }, { p: teacher, at: new V3(0.95, 0.51, -0.98) },
    { p: boyA, at: new V3(-1.12, 0.51, -0.52) }, { p: boyC, at: new V3(1.15, 0.51, -0.42) },
  ];
  const cups = cupDefs.map((c, i) => { const m = makeCup(); m.position.copy(c.at); C.add(m); m.scale.setScalar(0.001); setTimeout(() => popIn(m), 150 + i * 120); setCupLevel(m, 0); return { ...c, m, held: false, full: false }; });
  sfx.sparkle();
  await flyTo(basket, C, new V3(-0.68, 0.51, -0.38), { dur: 0.8, arc: 0.6 });
  sfx.drop();
  sign.visible = true; sign.scale.setScalar(0.001); popIn(sign, 0.6); sfx.chime();
  teacher.setPose('reach', 0.8);
  await wait(0.8);
  setMood(0);

  const towel = new THREE.Group();
  const tw = mesh(roundedBox(0.2, 0.035, 0.13, 0.015), new THREE.MeshStandardMaterial({ color: '#ffffff', map: canvasTex(64, 64, (c) => { c.fillStyle = '#9fd8ff'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) c.fillRect(0, i * 16, 64, 6); }), roughness: 0.95 }));
  towel.add(tw); towel.position.set(0.35, 0.53, -0.3); towel.visible = false; C.add(towel);

  // held cups keep upright in world space
  const heldUp = new THREE.Quaternion(), tq = new THREE.Quaternion();
  const holdUpdate = () => {
    cups.forEach(c => {
      if (!c.held) return;
      c.m.parent.getWorldQuaternion(tq);
      const tilt = c.tilt || 0;
      heldUp.setFromEuler(new THREE.Euler(tilt, 0, 0));
      const yaw = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, c.p.root.rotation.y, 0));
      c.m.quaternion.copy(tq.invert().multiply(yaw.multiply(heldUp)));
    });
  };
  updaters.add(holdUpdate);

  const st = { stage: 'fruit', inPitcher: 0, stir: 0, lastAng: null, busy: false, gag: 'none', drag: null, filled: 0, kanpai: false, juiceLevel: 0 };
  const juiceTo = (lvl, dur = 0.5) => { const a = st.juiceLevel; st.juiceLevel = lvl; return tween(dur, k => { pj.scale.y = Math.max(0.0001, lerp(a, lvl, k) * 0.23); swirl.position.y = 0.016 + lerp(a, lvl, k) * 0.23; }); };
  const insideFruits = [];
  const dropInPitcher = async f => {
    st.busy = true;
    f.inside = true;
    await flyTo(f.m, pitcher, new V3(rand(-0.03, 0.03), 0.32, rand(-0.03, 0.03)), { dur: 0.5, arc: 0.3 });
    sfx.plop(); sfx.splash();
    burst(toW(pitcher.position).add(new V3(0, 0.27, 0)), { n: 14, colors: ['#bfff6a', '#e8ffd0'], speed: 1, size: 0.03, g: -6 });
    await tween(0.3, k => { f.m.position.y = lerp(0.32, 0.06 + insideFruits.length * 0.05, k); f.m.scale.setScalar(lerp(1, 0.8, k)); });
    insideFruits.push(f);
    st.inPitcher++;
    juiceTo(st.inPitcher * 0.28);
    girl.happy(1); teacher.happy(1); teacher.setPose('clap', 1);
    st.busy = false;
  };
  const pitcherScreen = () => toScreen(toW(pitcher.position).add(new V3(0, 0.15, 0)));
  const pourInto = async c => {
    st.busy = true;
    const cupW = new V3(); c.m.getWorldPosition(cupW);
    const cupL = toL(cupW);
    const from = pitcher.position.clone();
    const side = cupL.x >= from.x ? -1 : 1; // pitcher stands on the far side of the cup, spout toward it
    const dest = new V3(cupL.x + side * 0.27, cupL.y + 0.2, cupL.z);
    const y0 = pitcher.rotation.y;
    const yaw = side < 0 ? 0 : Math.PI;
    girl.setPose('reachR', 2.2); lookAtWorld(girl, cupW);
    await tween(0.45, k => { pitcher.position.lerpVectors(from, dest, k); pitcher.rotation.y = lerp(y0, yaw, k); });
    await tween(0.3, k => { pitcher.rotation.z = -k * 1.05; });
    const stream = mesh(new THREE.CylinderGeometry(0.008, 0.012, 1, 8), cupJuiceMat, false, false);
    stream.geometry.translate(0, -0.5, 0);
    const top = dest.clone().add(new V3(0, 0.02, 0));
    stream.position.set(cupL.x, top.y, cupL.z);
    stream.scale.y = Math.max(0.01, top.y - cupL.y - 0.02);
    C.add(stream);
    sfx.pour(0.9);
    await tween(0.9, k => { setCupLevel(c.m, k); stream.scale.x = stream.scale.z = 1 + Math.sin(clock.time * 40) * 0.2; }, ease.linear);
    C.remove(stream);
    await tween(0.3, k => { pitcher.rotation.z = -(1 - k) * 1.05; });
    await tween(0.45, k => { pitcher.position.lerpVectors(dest, PITCHER_HOME, k); pitcher.rotation.y = lerp(yaw, 0, k); });
    c.full = true;
    girl.yawLookT = 0;
    st.busy = false;
  };
  const pickUp = async c => {
    c.held = true; c.tilt = 0;
    const hand = c.p.arms[0].hand;
    c.p.setPose('hold', 1e9);
    await flyTo(c.m, hand, new V3(0, -0.07, 0.035), { dur: 0.35, arc: 0.05 });
    c.p.happy(1.2); sfx.giggle(c.p.voice);
  };
  const putDown = async c => {
    c.held = false;
    c.p.setPose(null);
    await flyTo(c.m, C, c.at.clone(), { dur: 0.4, arc: 0.1 });
  };
  const drink = async c => {
    st.busy = true;
    c.p.setPose('drink', 1.3);
    await tween(0.35, k => { c.tilt = -k * 1.2; });
    sfx.gulp();
    await tween(0.8, k => { setCupLevel(c.m, 1 - k); });
    await tween(0.3, k => { c.tilt = -(1 - k) * 1.2; });
    c.full = false;
    c.p.setPose('hold', 1e9);
    c.p.stacheT = 4; c.p.happy(1.4); sfx.giggle(c.p.voice);
    st.busy = false;
  };
  const gag = async c => {
    // teacher lifts her cup way up... and it tips onto her face
    st.gag = 'running'; st.busy = true;
    await wait(0.3);
    teacher.setPose('holdUp', 2.5); teacher.setExpr('happy', 1.2); sfx.ooh(0.75);
    await wait(0.8);
    await tween(0.35, k => { c.tilt = -k * 2.4; });
    sfx.splash();
    const q = new V3(); teacher.head.getWorldPosition(q);
    burst(q.clone().add(new V3(0, 0.05, 0.1)), { n: 60, colors: ['#56d13c', '#8ae86a', '#3fae2a'], speed: 1.2, up: 0.4, g: -7, size: 0.04, life: 1.2 });
    setCupLevel(c.m, 0); c.full = false;
    teacher.greenT = 1; teacher.setExpr('oops', 2.6); teacher.tiltT = 0.12;
    teacher.jump(0.05);
    await wait(0.5);
    [girl, ...friends].forEach((p, i) => setTimeout(() => p.setExpr('laugh', 2.5), i * 100));
    sfx.laughAll();
    await tween(0.3, k => { c.tilt = -(1 - k) * 2.4; });
    teacher.setPose('shy', 3);
    await putDown(c);
    teacher.tiltT = 0;
    // a towel appears for the girl to help
    towel.visible = true; towel.scale.setScalar(0.001); popIn(towel); sfx.sparkle();
    st.gag = 'towel'; st.busy = false;
  };
  const wipeFace = async () => {
    st.gag = 'wiping'; st.busy = true;
    sfx.pick();
    girl.setPose('reach', 1.6); lookAtWorld(girl, teacher.root.getWorldPosition(new V3()));
    await flyTo(towel, teacher.head, new V3(0, -0.02, teacher.P.head * 1.25), { dur: 0.5, arc: 0.2, quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)) });
    teacher.setExpr('happy', 3);
    await tween(1.5, (k, raw) => { towel.position.x = Math.sin(raw * 28) * 0.06; towel.position.y = -0.02 + Math.cos(raw * 20) * 0.02; if (Math.sin(raw * 28) > 0.95) sfx.wipe(); if (raw > 0.3) teacher.greenT = 0; }, ease.linear);
    await flyTo(towel, C, new V3(0.35, 0.53, -0.3), { dur: 0.45, arc: 0.2 });
    popOut(towel);
    teacher.happy(2); teacher.setPose('cheer', 1.4); sfx.sparkle(); sfx.chime();
    girl.happy(1.6); girl.yawLookT = 0;
    const q = new V3(); teacher.head.getWorldPosition(q);
    burst(q.add(new V3(0, 0.2, 0)), { n: 30, colors: ['#ffffff', '#ffe066', '#ff9fc6'], speed: 1.3, size: 0.05 });
    // she gives a big hug-ish thank you
    teacher.setPose('clap', 1.2);
    st.gag = 'done'; st.busy = false;
  };
  const kanpai = async () => {
    st.busy = true;
    await wait(0.4);
    everyone.forEach(p => { p.setPose('holdUp', 1.6); p.setExpr('happy', 2); });
    await wait(0.45);
    sfx.clink(); setTimeout(() => sfx.clink(), 140); setTimeout(() => sfx.clink(), 300);
    sfx.yay();
    cups.forEach(c => { const q = new V3(); c.m.getWorldPosition(q); burst(q.add(new V3(0, 0.1, 0)), { n: 16, colors: ['#ffe066', '#ffffff', '#8ae86a'], speed: 1, size: 0.05 }); });
    burst(toW(new V3(0, 1.6, -0.8)), { n: 90, colors: CONFETTI, speed: 2.5, up: 1, g: -1.8, size: 0.07, life: 2.4, drag: 0.97 });
    everyone.forEach((p, i) => setTimeout(() => p.jump(0.1), i * 70));
    await wait(1.4);
    everyone.forEach(p => p.setPose('hold', 1e9));
    sfx.fanfare();
    st.busy = false;
  };
  const fruitMeshes = () => fruits.filter(f => !f.inside).map(f => f.m);
  const tapPersonOrCup = (o) => {
    const c = cups.find(cc => isUnder(o, cc.m) || isUnder(o, cc.p.root));
    return c;
  };
  input.active = {
    down(x, y) {
      if (st.busy) return;
      if (st.stage === 'fruit') {
        const h = hits(fruitMeshes());
        if (h.length) { const f = fruits.find(ff => isUnder(h[0].object, ff.m)); st.drag = f; C.attach(f.m); sfx.pick(); girl.setPose('reach', 30); }
        else if (hits([pitcher]).length) { sfx.tap(); teacher.setExpr('happy', 0.6); }
        return;
      }
      if (st.stage === 'stir') {
        const s = pitcherScreen();
        if (Math.hypot(x - s.x, y - s.y) < Math.max(140, innerHeight * 0.22)) { st.stirring = true; st.lastAng = Math.atan2(y - s.y, x - s.x); girl.setPose('reachR', 30); }
        return;
      }
      if (st.stage === 'between') return;
      // pour / free play
      const towelHit = st.gag === 'towel' && towel.visible ? hits([towel]) : [];
      if (towelHit.length || (st.gag === 'towel' && hits([teacher.root]).length)) { wipeFace(); return; }
      if (st.gag === 'towel') { sfx.tap(); return; }
      const targets = [...cups.map(c => c.m), ...everyone.map(p => p.root), pitcher];
      const h = hits(targets);
      if (!h.length) {
        if (st.stage === 'free') {
          const hb = hits([balloons]);
          if (hb.length && hb[0].instanceId !== undefined) {
            const i = hb[0].instanceId;
            if (B.alive[i]) {
              B.alive[i] = 0; sfx.pop();
              burst(toW(new V3(B.pos[i * 3], B.pos[i * 3 + 1], B.pos[i * 3 + 2])), { n: 24, colors: CONFETTI, speed: 1.4, g: -2, size: 0.06, life: 1.6 });
              setTimeout(() => { B.alive[i] = 1; B.scale[i] = 0.05; B.pos[i * 3 + 1] = 2.2; }, 5000);
              everyone[(Math.random() * 5) | 0].setExpr('surprise', 0.5);
            }
          }
        }
        return;
      }
      if (isUnder(h[0].object, pitcher)) {
        sfx.swish(); swirl.material.opacity = 0.8; tween(1, k => { swirl.rotation.z -= 0.2; swirl.material.opacity = 0.8 * (1 - k); });
        burst(toW(pitcher.position).add(new V3(0, 0.28, 0)), { n: 12, colors: ['#e8ffd0', '#ffffff'], speed: 0.5, up: 1.5, g: 0.5, size: 0.03 });
        return;
      }
      const c = tapPersonOrCup(h[0].object);
      if (!c) return;
      if (!c.full && !c.held) {
        pourInto(c).then(async () => {
          st.filled++;
          if (c.p === teacher && st.gag === 'none') { await pickUp(c); await gag(c); return; }
          await pickUp(c);
          if (!st.kanpai && cups.every(cc => cc.full) && st.gag === 'done') { st.kanpai = true; await kanpai(); st.stage = 'free'; document.getElementById('again').style.display = 'flex'; }
        });
      } else if (!c.full && c.held) {
        pourInto(c).then(async () => {
          if (cups.every(cc => cc.full)) await kanpai();
        });
      } else if (c.full && c.held) {
        if (st.stage === 'free') drink(c);
        else { c.p.happy(1); sfx.giggle(c.p.voice); c.p.jump(0.06); }
      }
    },
    move(x, y) {
      if (st.stage === 'fruit' && st.drag) {
        const p = rayPlane(new V3(0, 0, 1), toW(new V3(0, 0.7, -0.6)));
        if (p) { const l = toL(p); l.y = Math.max(0.55, l.y); st.drag.m.position.lerp(l, 0.6); }
        lookAtWorld(girl, toW(st.drag.m.position));
      } else if (st.stage === 'stir' && st.stirring) {
        const s = pitcherScreen();
        const a = Math.atan2(y - s.y, x - s.x);
        let da = a - st.lastAng; if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2;
        st.lastAng = a;
        st.stir += Math.abs(da);
        spoon.rotation.y -= da * 1.2;
        spoon.position.set(Math.cos(-spoon.rotation.y) * 0.04, 0.05, Math.sin(-spoon.rotation.y) * 0.04);
        swirl.rotation.z -= da; swirl.material.opacity = Math.min(0.85, swirl.material.opacity + Math.abs(da) * 0.2);
        insideFruits.forEach((f, i) => { const r = 0.045; const an = clock.time * 3 + i * 2.1 + st.stir; f.m.position.x = Math.cos(an) * r; f.m.position.z = Math.sin(an) * r; f.m.scale.setScalar(Math.max(0.001, 0.8 * (1 - st.stir / 14))); });
        const k = clamp(st.stir / 14, 0, 1);
        juiceMat.color.set('#c9d98a').lerp(new THREE.Color('#4fcf35'), k);
        if (Math.abs(da) > 0.02) sfx.swish();
        if (Math.random() < Math.abs(da) * 0.6) burst(toW(pitcher.position).add(new V3(rand(-0.05, 0.05), 0.02 + st.juiceLevel * 0.23, rand(-0.05, 0.05))), { n: 2, colors: ['#ffffff', '#e8ffd0'], speed: 0.3, up: 1, g: 0.3, size: 0.025, life: 0.6 });
        lookAtWorld(girl, toW(pitcher.position));
      }
    },
    up(x, y, tap) {
      if (st.stage === 'fruit' && st.drag) {
        const f = st.drag; st.drag = null; girl.setPose(null); girl.yawLookT = 0;
        const d = Math.hypot(f.m.position.x - pitcher.position.x, f.m.position.z - pitcher.position.z);
        if (tap || d < 0.45) dropInPitcher(f);
        else { const i = fruits.indexOf(f); flyTo(f.m, basket, new V3(-0.06 + i * 0.06, 0.08, (i % 2) * 0.04), { dur: 0.4, arc: 0.15 }); sfx.drop(); }
      }
      if (st.stage === 'stir') { st.stirring = false; girl.setPose(null); }
    },
    hint() {
      if (st.busy) return null;
      if (st.stage === 'fruit') { const f = fruits.find(ff => !ff.inside); return f ? { from: f.m.getWorldPosition(new V3()), to: toW(pitcher.position).add(new V3(0, 0.3, 0)) } : null; }
      if (st.stage === 'stir') return { from: toW(pitcher.position).add(new V3(0, 0.2, 0)), circle: true };
      if (st.gag === 'towel') return { from: towel.getWorldPosition(new V3()), to: teacher.head.getWorldPosition(new V3()) };
      if (st.stage === 'pour') { const c = cups.find(cc => !cc.full && !cc.held) || cups.find(cc => !cc.full); return c ? { from: c.m.getWorldPosition(new V3()).add(new V3(0, 0.08, 0)) } : null; }
      return null;
    },
  };
  await until(() => st.inPitcher >= 3 && !st.busy);
  // stir!
  await wait(0.3);
  st.stage = 'stir';
  spoon.visible = true; spoon.scale.setScalar(0.001); popIn(spoon); sfx.sparkle();
  teacher.setPose('wave', 0.8);
  await until(() => st.stir >= 14);
  st.stage = 'between';
  st.stirring = false; girl.setPose(null);
  juiceMat.color.set('#4fcf35');
  insideFruits.forEach(f => { f.m.visible = false; });
  juiceTo(0.95, 0.6);
  sfx.magic(); sfx.wow();
  burst(toW(pitcher.position).add(new V3(0, 0.3, 0)), { n: 60, colors: ['#8ae86a', '#ffffff', '#ffe066'], speed: 1.6, size: 0.05, life: 1.4 });
  everyone.forEach((p, i) => setTimeout(() => { p.happy(1.6); p.setPose('clap', 1.2); }, i * 80));
  await popOut(spoon);
  await wait(0.6);
  st.stage = 'pour';
  // after the first full kanpai the loop is endless: pour → pick up → drink → pour → kanpai...
  await until(() => st.kanpai && !st.busy);
  st.stage = 'free';
  document.getElementById('again').style.display = 'flex';
}

// =====================================================================
// flow
// =====================================================================
document.getElementById('again').addEventListener('click', () => location.reload());

async function run() {
  if (JUMP) {
    // debug / thumbnail entry points
    document.getElementById('start').style.display = 'none';
    initAudio();
    if (JUMP === 'lockers') { await sceneDress0(); await fade(0, 0.2); await sceneLockers(); }
    else {
      giveGear(girl, 'star', true); seatKids();
      await shot(...CLASS_SHOT(), 0);
      if (JUMP === 'slime') { await sceneSlime(); return; }
      if (JUMP === 'blocks') { await fade(0, 0.2); const r = await sceneBlocks(); await sceneBalloons(r); return; }
      if (JUMP === 'balloons') { await fade(0, 0.2); const r = await sceneBalloons(null); await sceneParty(r); return; }
      if (JUMP === 'party') { await sceneParty(null); return; }
    }
    return;
  }
  // title: girl waiting in the hall
  lightAt(new V3(0, 0, 0));
  place(girl, H, 0, 0.8, 0);
  await shot(new V3(0.35, 1.0, 3.3), new V3(0.4, 0.62, 0.85), 1.05, 0.68, 0);
  const g = giveGear(girl, 'star', false);
  H.add(g.hat); g.hat.position.set(0.85, 0.43, 0.75); g.hat.rotation.set(0, 0.4, 0);
  H.add(g.bag); g.bag.position.set(0.85, 0.12, 0.98); g.bag.rotation.set(-0.15, -0.2, 0);
  await fade(0, 0.8);
  await new Promise(res => {
    const btn = document.getElementById('play');
    const go = () => { btn.removeEventListener('pointerup', go); initAudio(); sfx.chime(); res(); };
    btn.addEventListener('pointerup', go);
  });
  const startEl = document.getElementById('start');
  startEl.style.transition = 'opacity .4s'; startEl.style.opacity = '0';
  setTimeout(() => { startEl.style.display = 'none'; }, 450);
  girl.happy(1.2); sfx.giggle(girl.voice);
  await sceneDressInteractive(g);
  await sceneLockers();
  await sceneSlime();
  const r = await sceneBlocks();
  const b = await sceneBalloons(r);
  await sceneParty(b);
}

// split of sceneDress so the title screen can show the set first
async function sceneDress0() {
  lightAt(new V3(0, 0, 0));
  place(girl, H, 0, 0.8, 0);
  const g = giveGear(girl, 'star', true);
  return g;
}
async function sceneDressInteractive(g) {
  const st = { hat: false, bag: false, drag: null };
  const items = [g.hat, g.bag];
  const home = new Map([[g.hat, { p: g.hat.position.clone(), q: g.hat.quaternion.clone() }], [g.bag, { p: g.bag.position.clone(), q: g.bag.quaternion.clone() }]]);
  const wear = async it => {
    st.drag = null;
    sfx.pick();
    girl.setPose('reach', 0.6);
    if (it === g.hat) { st.hat = true; await wearHat(girl, g.hat); }
    else { st.bag = true; await wearBag(girl, g.bag, g.strap); }
    sfx.sparkle(); girl.happy(1.4); const q = new V3(); it.getWorldPosition(q); burst(q, { n: 18, speed: 1, size: 0.05 });
  };
  const plane = new V3(0, 0, 1);
  input.active = {
    down() {
      const h = hits(items.filter(i => !(i === g.hat ? st.hat : st.bag)));
      if (!h.length) {
        if (hits([girl.root]).length) { girl.setExpr('happy', 0.8); sfx.giggle(girl.voice); girl.jump(0.06); }
        return;
      }
      const it = isUnder(h[0].object, g.hat) ? g.hat : g.bag;
      st.drag = it; H.attach(it); sfx.pick();
      girl.setExpr('surprise', 0.5);
    },
    move() {
      if (!st.drag) return;
      const p = rayPlane(plane, new V3(0, 0, 0.95));
      if (p) st.drag.position.lerp(p, 0.6);
      lookAtWorld(girl, st.drag.position);
    },
    up(x, y, tap) {
      const it = st.drag; if (!it) return;
      const hp = new V3(); girl.head.getWorldPosition(hp);
      const d = it.position.distanceTo(hp);
      if (tap || d < 0.75) wear(it);
      else { st.drag = null; const h0 = home.get(it); const p0 = it.position.clone(), q0 = it.quaternion.clone(); tween(0.4, k => { it.position.lerpVectors(p0, h0.p, k); it.quaternion.slerpQuaternions(q0, h0.q, k); }); sfx.drop(); }
      girl.yawLookT = 0;
    },
    hint() {
      const hp = new V3(); girl.head.getWorldPosition(hp);
      if (!st.hat && st.drag !== g.hat) return { from: g.hat.getWorldPosition(new V3()), to: hp };
      if (!st.bag && st.drag !== g.bag) return { from: g.bag.getWorldPosition(new V3()), to: hp.clone().add(new V3(0, -0.4, 0)) };
      return null;
    },
  };
  await until(() => st.hat && st.bag);
  input.active = null;
  await wait(0.7);
  sfx.magic();
  const y0 = girl.root.rotation.y;
  girl.setExpr('happy', 2);
  tween(0.9, k => { girl.root.rotation.y = y0 + k * Math.PI * 2; });
  girl.jump(0.16);
  await wait(0.9);
  girl.root.rotation.y = 0; girl._yawT = 0;
  burst(new V3(0, 1.2, 0.9), { n: 50, colors: CONFETTI, speed: 2, size: 0.06, life: 1.5 });
  sfx.chime();
  await wait(0.8);
}

window.__game = {
  girl, teacher, cam, input, B, clock, friends,
  hint() {
    const a = input.active; if (!a || !a.hint) return null;
    const h = a.hint(); if (!h) return null;
    return { from: toScreen(h.from), to: h.to ? toScreen(h.to) : null, circle: !!h.circle };
  },
};
run().catch(e => { console.error(e); });
window.addEventListener('unhandledrejection', e => console.error('UNHANDLED', e.reason && e.reason.stack || e.reason));
