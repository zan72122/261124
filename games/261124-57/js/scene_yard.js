// scene 0: dress up / scene 1: build the pink truck
import { THREE, RoundedBoxGeometry, canvasTex, fluffMat, mat, shadowy, tween, wait, ease, arcTo, scaleTo, squash, setShot, tappable, untappable,
  SFX, FX, setHint, pulse, isPortrait, onUpdate, T, fade, shake, aimSun } from './core.js';
import { sets, showSets, girl, dad, customers, makeHat, makeApron, waffleMat, makeMiniIce } from './world.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const E = (x, y, z) => new THREE.Euler(x, y, z);

// ================= dress up =================
export async function runDress() {
  const S = sets.dress;
  showSets('yard', 'dress');
  aimSun(-2, 3);
  SFX.birdsOn = true;
  const gx = isPortrait() ? -2.25 : -2.4;
  girl.root.visible = true; girl.root.position.set(gx, 0, 3.2); girl.root.rotation.y = 0.15;
  // rack
  const rack = new THREE.Group(); rack.position.set(gx + 0.85, 0, 3.0); S.add(rack);
  const wood = mat(0xd9b48a, { roughness: 0.7 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.25, 12), wood); post.position.y = 0.62; rack.add(post);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.05, 20), wood); foot.position.y = 0.025; rack.add(foot);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8), wood); arm.rotation.z = Math.PI / 2; arm.position.y = 1.08; rack.add(arm);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), fluffMat(0xffffff, 0.2)); knob.position.y = 1.27; rack.add(knob);
  shadowy(rack);
  const hat = makeHat(); hat.position.set(0, 1.33, 0); rack.add(hat);
  const apron = makeApron(); apron.position.set(0.0, 0.86, 0.04); apron.rotation.y = 0; rack.add(apron);
  // hanger hook
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 16, Math.PI), mat(0xbfc5cc, { metalness: 0.8, roughness: 0.3 })); hook.position.set(0, 1.08, 0.03); rack.add(hook);
  const big = isPortrait();
  await setShot({ look: V(gx + 0.4, 0.75, 3.1), dir: V(0.12, 0.22, 1), w: big ? 1.9 : 2.2, h: 1.75 }, 0);
  await fade(0, 0.8);
  girl.face('happy', 1.2); girl.pose('wave', 1.4); SFX.yay(1.3);
  let worn = 0;
  const done = new Promise(res => {
    const wear = async (obj, slot, finalPos, finalRot) => {
      untappable(obj); pulse(obj, false);
      girl.lookAt(0.6); girl.pose('reach', 0.8); SFX.whoosh();
      const wp = new THREE.Vector3(); obj.getWorldPosition(wp);
      slot.attach(obj);
      const from = obj.position.clone();
      const r0 = obj.rotation.clone();
      await tween(0.75, t => {
        obj.position.lerpVectors(from, finalPos, t); obj.position.y += Math.sin(Math.PI * t) * 0.6;
        obj.rotation.set(lerpA(r0.x, finalRot.x, t), lerpA(r0.y, finalRot.y, t) + t * Math.PI * 2, lerpA(r0.z, finalRot.z, t));
      });
      obj.rotation.copy(finalRot);
      SFX.poof(); const p = new THREE.Vector3(); obj.getWorldPosition(p); FX.sparkle(p, 16); FX.puff(p, 6, 0xffc4e4, 0.25);
      girl.lookAt(0); girl.face('happy', 1.6); girl.pose('jump', 0.9); SFX.yay(1.35);
      worn++;
      if (worn === 2) res();
    };
    tappable(hat, () => wear(hat, girl.hatSlot, V(0, 0.05, 0), E(-0.12, 0, 0)));
    tappable(apron, () => wear(apron, girl.apronSlot, V(0, -0.02, 0), E(0, 0, 0)));
    tappable(rack.children[0], () => { if (hat.parent === rack) wear(hat, girl.hatSlot, V(0, 0.05, 0), E(-0.12, 0, 0)); else if (apron.parent === rack) wear(apron, girl.apronSlot, V(0, -0.02, 0), E(0, 0, 0)); });
    tappable(girl.root, () => { girl.face('laugh', 1); girl.pose('jump', 0.6); SFX.giggle(1.3); });
    pulse(hat); pulse(apron);
    setHint(() => hat.parent === rack ? hat : apron.parent === rack ? apron : null);
  });
  await done;
  setHint(null); untappable(girl.root); untappable(rack.children[0]);
  await wait(0.5);
  // spin & cheer: she is now the ice cream girl
  SFX.happy();
  await tween(0.8, t => girl.root.rotation.y = 0.15 + t * Math.PI * 2, ease.io);
  girl.face('laugh', 1.5); girl.pose('cheer', 1.5); FX.confetti(V(gx, 1.4, 3.3), 30); SFX.fanfare();
  await wait(1.6);
  await fade(1, 0.5);
  S.clear();
}
function lerpA(a, b, t) { return a + (b - a) * t; }

// ================= truck build =================
const pinkM = () => fluffMat(0xffffff, 1.6);
function partBody() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new RoundedBoxGeometry(3.4, 2.2, 2.1, 5, 0.22), pinkM()); g.add(b);
  const band = new THREE.Mesh(new RoundedBoxGeometry(3.44, 0.2, 2.14, 3, 0.08), fluffMat(0xffffff, 0.8)); band.material = fluffMat(0xfff0f8, 3); band.position.y = -0.7; g.add(band);
  const ch = new THREE.Mesh(new RoundedBoxGeometry(5.0, 0.22, 1.7, 2, 0.06), mat(0x5a5a64, { roughness: 0.5, metalness: 0.4 })); ch.position.set(0.65, -1.12, 0); g.add(ch);
  // polka dots
  const dotM = mat(0xffffff, { roughness: 0.6 });
  for (let i = 0; i < 9; i++) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 16), dotM);
    d.rotation.x = Math.PI / 2; d.position.set(-1.45 + (i % 3) * 0.14 + (i > 5 ? 2.7 : 0) - (i > 5 ? 0.4 : 0), 0.6 - Math.floor((i % 6) / 3) * 0.16, i % 2 ? 1.06 : -1.06); g.add(d);
  }
  return g;
}
function partCab() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new RoundedBoxGeometry(1.3, 1.5, 2.0, 5, 0.25), pinkM()); g.add(b);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x9fd6ff, roughness: 0.05, metalness: 0.1, transmission: 0, opacity: 0.85, transparent: true, clearcoat: 1, envMapIntensity: 1.5 });
  const ws = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.55, 1.6, 2, 0.02), glass); ws.position.set(0.64, 0.33, 0); ws.rotation.z = -0.12; g.add(ws);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new RoundedBoxGeometry(0.75, 0.5, 0.06, 2, 0.02), glass); w.position.set(0.05, 0.35, s * 1.0); g.add(w); }
  const lightM = new THREE.MeshStandardMaterial({ color: 0xfffbe0, emissive: 0xfff2a0, emissiveIntensity: 0.6, roughness: 0.2 });
  for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 12), lightM); l.position.set(0.62, -0.32, s * 0.68); l.scale.x = 0.5; g.add(l); }
  const bump = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.2, 2.0, 2, 0.08), mat(0xe8e8ee, { metalness: 0.9, roughness: 0.25 })); bump.position.set(0.68, -0.68, 0); g.add(bump);
  // smiley grill
  const grill = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 8, 20, Math.PI), mat(0xffffff)); grill.rotation.set(0, Math.PI / 2, Math.PI); grill.position.set(0.66, -0.25, 0); g.add(grill);
  return g;
}
function partWheel() {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.12, 14, 28), mat(0x2a2a2e, { roughness: 0.85 })); g.add(tire);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 24), fluffMat(0xffffff, 0.4)); hub.rotation.x = Math.PI / 2; g.add(hub);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), mat(0xffffff, { metalness: 0.6, roughness: 0.3 })); cap.position.z = 0.1; g.add(cap);
  return g;
}
function partSign() {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.95, 28), waffleMat()); cone.rotation.x = Math.PI; g.add(cone);
  const sc = new THREE.Mesh(new THREE.SphereGeometry(0.52, 32, 24), pinkM()); sc.position.y = 0.62; g.add(sc);
  const drip = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 10, 28), fluffMat(0xffffff, 0.6)); drip.rotation.x = Math.PI / 2; drip.position.y = 0.42; g.add(drip);
  const ch = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 14), new THREE.MeshPhysicalMaterial({ color: 0xd8102e, roughness: 0.15, clearcoat: 1 })); ch.position.y = 1.2; g.add(ch);
  return g;
}
function partWindow() {
  const g = new THREE.Group();
  const W = 2.4, H = 1.1;
  const frameM = mat(0xffffff, { roughness: 0.5 });
  const fr = (w, h, x, y) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.1, 2, 0.04), frameM); m.position.set(x, y, 0); g.add(m); };
  fr(W + 0.16, 0.1, 0, H / 2 + 0.03); fr(W + 0.16, 0.1, 0, -H / 2 - 0.03); fr(0.1, H, -W / 2 - 0.03, 0); fr(0.1, H, W / 2 + 0.03, 0);
  // inner shop picture
  const inner = canvasTex(512, 256, (c) => {
    c.fillStyle = '#fff1f7'; c.fillRect(0, 0, 512, 256);
    c.fillStyle = '#ffd1e6'; c.fillRect(0, 150, 512, 106);
    c.fillStyle = '#f4b6d2'; c.fillRect(0, 140, 512, 12);
    const cols = ['#ff9ec8', '#fff4da', '#8a5232', '#9fe8c8', '#ff9ec8', '#fff4da'];
    for (let i = 0; i < 6; i++) { c.fillStyle = '#ffffff'; c.fillRect(30 + i * 80, 160, 64, 40); c.fillStyle = cols[i]; c.beginPath(); c.ellipse(62 + i * 80, 162, 30, 14, 0, 0, 7); c.fill(); }
    for (let i = 0; i < 5; i++) { c.fillStyle = '#e2a65a'; c.beginPath(); c.moveTo(70 + i * 90, 70); c.lineTo(100 + i * 90, 70); c.lineTo(85 + i * 90, 120); c.fill(); c.fillStyle = cols[i]; c.beginPath(); c.arc(85 + i * 90, 62, 18, 0, 7); c.fill(); }
  });
  const ip = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: inner, roughness: 0.9, emissive: 0xffffff, emissiveMap: inner, emissiveIntensity: 0.25 }));
  ip.position.z = -0.02; g.add(ip);
  // flap (hinged at top)
  const flapTex = canvasTex(256, 128, c => { for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#ff6fb1'; c.fillRect(i * 22, 0, 22, 128); } });
  const hinge = new THREE.Group(); hinge.position.set(0, H / 2, 0.06); g.add(hinge);
  const flap = new THREE.Mesh(new RoundedBoxGeometry(W + 0.1, H + 0.05, 0.06, 2, 0.02), [
    mat(0xffffff), mat(0xffffff), mat(0xffffff), mat(0xffffff), new THREE.MeshStandardMaterial({ map: flapTex, roughness: 0.8 }), mat(0xffd7ea)]);
  flap.position.y = -H / 2; hinge.add(flap);
  // scalloped edge
  for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), fluffMat(0xffffff, 0.3)); s.rotation.x = Math.PI; s.scale.set(1, 0.6, 0.35); s.position.set(-W / 2 + 0.13 + i * (W - 0.26) / 8, -H - 0.02, 0); hinge.add(s); }
  const ledge = new THREE.Mesh(new RoundedBoxGeometry(W + 0.1, 0.07, 0.36, 2, 0.03), mat(0xffffff, { roughness: 0.4 })); ledge.position.set(0, -H / 2 - 0.06, 0.15); g.add(ledge);
  g.userData.hinge = hinge;
  return g;
}

export async function runTruck() {
  const S = sets.truck;
  showSets('yard', 'truck');
  aimSun(0, 1.5);
  const P = isPortrait();
  const xs = P ? 0.62 : 1;
  const truck = new THREE.Group(); S.add(truck);
  const ghostM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false });
  const defs = [
    { make: partBody, slot: V(-0.3, 1.55, 0), rest: V(-2.4 * xs, 0, 3.4), spin: 0 },
    { make: partCab, slot: V(2.05, 1.2, 0), rest: V(2.4 * xs, 0, 3.4), spin: 0 },
    { make: partSign, slot: V(-0.3, 3.12, 0), rest: V(1.05 * xs, 0, 3.1), spin: 0 },
    { make: partWindow, slot: V(-0.3, 1.82, 1.08), rest: V(-0.95 * xs, 0, 3.1), spin: 0, win: true },
    { make: partWheel, slot: V(-1.3, 0.42, 1.0), rest: V(-1.35 * xs, 0, 4.3), wheel: 1 },
    { make: partWheel, slot: V(1.95, 0.42, 1.0), rest: V(-0.45 * xs, 0, 4.45), wheel: 1 },
    { make: partWheel, slot: V(-1.3, 0.42, -1.0), rest: V(0.45 * xs, 0, 4.45), wheel: -1 },
    { make: partWheel, slot: V(1.95, 0.42, -1.0), rest: V(1.35 * xs, 0, 4.3), wheel: -1 },
  ];
  const MINI = 0.32;
  const parts = defs.map(d => {
    const g = shadowy(d.make());
    const gh = d.make(); gh.traverse(o => { if (o.isMesh) { o.material = ghostM; o.castShadow = false; } });
    gh.position.copy(d.slot); truck.add(gh);
    if (d.wheel === -1) { g.rotation.y = Math.PI; gh.rotation.y = Math.PI; }
    const box = new THREE.Box3().setFromObject(g);
    const restY = -box.min.y * MINI + 0.02;
    g.position.set(d.rest.x, restY + 6, d.rest.z); g.scale.setScalar(MINI);
    if (d.wheel) g.rotation.y = d.wheel === -1 ? Math.PI : 0;
    else g.rotation.y = (Math.random() - 0.5) * 0.6;
    g.visible = false; truck.add(g);
    return { ...d, g, gh, restY, placed: false };
  });
  const win = parts.find(p => p.win);
  girl.root.position.set(P ? -2.0 : -3.6, 0, P ? 2.0 : 2.3); girl.root.rotation.y = 0.5; girl.lookAt(0);
  await setShot({ look: V(0, 1.45, 1.8), dir: V(0.22, 0.32, 1), w: P ? 5.4 : 7.4, h: 4.6 }, 0);
  await fade(0, 0.6);
  // parts rain down
  for (const p of parts) {
    p.g.visible = true; SFX.pop();
    const to = V(p.g.position.x, p.restY, p.g.position.z);
    const from = p.g.position.clone();
    tween(0.6, t => p.g.position.lerpVectors(from, to, t), ease.bounce).then(() => FX.puff(to.clone().setY(0.15), 4, 0xffc4e4, 0.4));
    await wait(0.14);
  }
  await wait(0.7);
  girl.face('wow', 1); girl.pose('cheer', 1); SFX.yay();
  let placed = 0;
  let allDone;
  const finished = new Promise(r => allDone = r);
  const place = async (p) => {
    if (p.placed) return; p.placed = true;
    untappable(p.g); untappable(p.gh); pulse(p.g, false);
    girl.pose('reach', 0.8); girl.face('happy', 1);
    girl.lookAt(Math.atan2(p.slot.x - girl.root.position.x, p.slot.z - girl.root.position.z) - girl.root.rotation.y);
    SFX.whoosh();
    const from = p.g.position.clone(), to = p.slot.clone();
    const r0 = p.g.rotation.y, r1 = p.wheel === -1 ? Math.PI : 0;
    await tween(0.85, t => {
      p.g.position.lerpVectors(from, to, t); p.g.position.y += Math.sin(Math.PI * t) * 2.2;
      p.g.scale.setScalar(MINI + (1 - MINI) * t);
      p.g.rotation.y = r0 + (r1 - r0) * t;
      if (p.wheel) p.g.rotation.z = -t * Math.PI * 4;
    }, ease.io);
    p.gh.visible = false;
    SFX.poof(); FX.puff(to, 10, 0xffbfe0, 0.6); FX.sparkle(to, 10);
    squash(p.g, 0.18, 0.5);
    girl.lookAt(0); girl.pose('clap', 0.9); SFX.yay(1.2 + Math.random() * 0.2);
    placed++;
    if (placed === parts.length) allDone();
  };
  for (const p of parts) { tappable(p.g, () => place(p)); tappable(p.gh, () => place(p)); pulse(p.g); }
  tappable(girl.root, () => { girl.face('laugh', 1); girl.pose('jump', 0.6); SFX.giggle(1.3); });
  setHint(() => { const p = parts.find(q => !q.placed); return p ? p.g : null; });
  await finished;
  setHint(null);
  await wait(0.6);
  // the truck comes alive
  SFX.boing(); await squashGroup(truck);
  FX.sparkle(V(-0.3, 3.5, 0), 24); SFX.sparkle();
  girl.face('laugh', 1.5); girl.pose('cheer', 1.5);
  await wait(0.6);
  const hinge = win.g.userData.hinge;
  const glowFlap = hinge.children[0];
  pulse(win.g);
  const opened = new Promise(res => {
    tappable(win.g, async () => {
      untappable(win.g); pulse(win.g, false); setHint(null);
      girl.pose('reach', 0.6); SFX.whoosh();
      await tween(0.9, t => hinge.rotation.x = -1.25 * t, ease.back);
      SFX.jingle(); FX.confetti(V(-0.3, 2.2, 1.6), 50); shake(0.04);
      res();
    });
  });
  setHint(() => win.g);
  await opened;
  girl.face('laugh', 2); girl.pose('cheer', 2);
  await wait(1.0);
  // a queue forms
  const q = [...customers, dad];
  for (let i = 0; i < q.length; i++) {
    const c = q[i]; c.root.visible = true; c.root.position.set(7 + i * 1.2, 0, 2.6 + i * 0.3); c.face('happy');
    const tx = -0.2 + i * 0.95, tz = 2.25 + i * 0.32;
    c.walkTo(tx, tz, 2.2).then(() => { c.turn(-0.75); c.pose('wave', 1.2); SFX.yay(0.8 + i * 0.15); });
    await wait(0.45);
  }
  await setShot({ look: V(0.8, 1.4, 2.2), dir: V(0.2, 0.3, 1), w: P ? 6 : 9.5, h: 5 }, 2.2);
  await wait(0.6);
  await fade(1, 0.5);
  S.clear();
  for (const c of q) c.root.visible = false;
}
function squashGroup(g) { return squash(g, 0.08, 0.7); }
