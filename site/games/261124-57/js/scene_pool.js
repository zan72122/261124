// scene 3a: the pool, the "no running" sign, and dad's big slip
import { THREE, RoundedBoxGeometry, canvasTex, fluffMat, mat, shadowy, tween, wait, ease, arcTo, scaleTo, squash, setShot, tappable, untappable,
  SFX, FX, setHint, pulse, isPortrait, onUpdate, T, fade, shake, aimSun } from './core.js';
import { sets, showSets, girl, dad, POOL, makeScoop, makeCone } from './world.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function makeSign() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 12), mat(0xc8ccd2, { metalness: 0.8, roughness: 0.35 })); post.position.y = 0.65; g.add(post);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.06, 20), mat(0xc8ccd2, { metalness: 0.6, roughness: 0.4 })); base.position.y = 0.03; g.add(base);
  const tex = canvasTex(256, 256, c => {
    c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(0, 0, 256, 256, 30); c.fill();
    c.lineCap = 'round'; c.lineJoin = 'round';
    // running figure
    c.strokeStyle = '#222'; c.fillStyle = '#222'; c.lineWidth = 16;
    c.beginPath(); c.arc(140, 62, 18, 0, 7); c.fill();
    c.beginPath(); c.moveTo(128, 88); c.lineTo(112, 148); c.stroke();               // body
    c.beginPath(); c.moveTo(126, 98); c.lineTo(160, 112); c.lineTo(176, 92); c.stroke(); // front arm
    c.beginPath(); c.moveTo(124, 100); c.lineTo(96, 116); c.lineTo(80, 104); c.stroke();  // back arm
    c.beginPath(); c.moveTo(112, 148); c.lineTo(146, 168); c.lineTo(148, 204); c.stroke(); // front leg
    c.beginPath(); c.moveTo(112, 148); c.lineTo(92, 180); c.lineTo(62, 182); c.stroke();  // back leg
    // splash drops at feet
    c.fillStyle = '#4fb8f0'; for (const [x, y] of [[176, 214], [196, 206], [70, 212]]) { c.beginPath(); c.arc(x, y, 8, 0, 7); c.fill(); }
    // red circle + slash
    c.strokeStyle = '#e8283c'; c.lineWidth = 22;
    c.beginPath(); c.arc(128, 128, 104, 0, 7); c.stroke();
    c.beginPath(); c.moveTo(54, 54); c.lineTo(202, 202); c.stroke();
  });
  const board = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.62, 0.04, 2, 0.04), [mat(0xffffff), mat(0xffffff), mat(0xffffff), mat(0xffffff), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), mat(0xeeeeee)]);
  board.position.y = 1.55; g.add(board);
  return shadowy(g);
}

export async function runPool(dadIce) {
  const S = sets.pool;
  showSets('pool');
  aimSun(0, 0.5);
  SFX.birdsOn = true;
  const P = isPortrait();
  const signX = P ? -2.0 : -3.0, girlX = P ? 1.8 : 2.4, puddleX = -1.2;
  const sign = makeSign(); sign.position.set(signX, 0, 1.45); sign.rotation.y = 0.15; S.add(sign);
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.38, 28), new THREE.MeshPhysicalMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.55, roughness: 0.02, clearcoat: 1 }));
  puddle.rotation.x = -Math.PI / 2; puddle.scale.set(1.4, 0.8, 1); puddle.position.set(puddleX, 0.006, 1.35); S.add(puddle);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.12, 16, 36), fluffMat(0xffffff, 0.6)); ring.rotation.x = -Math.PI / 2; ring.position.set(girlX - 0.75, 0.12, 1.6); shadowy(ring); S.add(ring);
  { const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16), new THREE.MeshBasicMaterial({ visible: false })); hit.rotation.x = Math.PI / 2; hit.userData.proxy = true; ring.add(hit); }
  // water ripple animation
  const offW = onUpdate(dt => { POOL.cau.offset.x += dt * 0.02; POOL.cau.offset.y += dt * 0.013; });
  girl.root.visible = true; girl.root.position.set(girlX, 0, 1.75); girl.root.rotation.y = -1.2; girl.lookAt(0); girl.st.baseY = 0;
  dad.root.visible = true; dad.root.position.set(P ? -5 : -6.5, 0, 1.4); dad.root.rotation.set(0, Math.PI / 2, 0); dad.st.baseY = 0; dad.st.leanOverride = null;
  dad.face('happy');
  if (dadIce) { dad.hand(1).add(dadIce); dadIce.position.set(0, 0.12, 0); dadIce.rotation.set(0, 0, 0); dadIce.scale.setScalar(1 / dad.s); }
  dad.pose('hold', 99);
  await setShot({ look: V(-0.3, 0.55, 0.6), dir: V(0.05, 0.22, 1), w: P ? 5.4 : 8.2, h: 3.6 }, 0);
  await fade(0, 0.6);
  // extra toys: tap sign / water / girl any time
  tappable(sign, async () => { SFX.pip(); setTimeout(SFX.pip, 160); girl.pose('point', 0.8); await tween(0.5, t => sign.rotation.z = Math.sin(t * Math.PI * 4) * 0.08 * (1 - t), ease.lin); });
  tappable(POOL.waterMesh, (h) => { SFX.splash(); FX.drops(h.point, 10); });
  tappable(girl.root, () => { girl.face('laugh', 1); girl.pose('jump', 0.6); SFX.giggle(1.3); });
  await wait(0.8);
  girl.pose('wave', 1); SFX.yay(1.3);
  dad.face('laugh'); SFX.laugh(0.8);
  await wait(0.5);
  // dad runs, ignoring the sign
  dad.pose('hold', 99);
  const run = dad.walkTo(puddleX - 0.15, 1.4, 3.4);
  const signWatch = onUpdate(() => { if (Math.abs(dad.root.position.x - signX) < 0.25 && !sign.userData.warned) { sign.userData.warned = true; SFX.pip(); setTimeout(SFX.pip, 150); tween(0.6, t => sign.rotation.z = Math.sin(t * Math.PI * 5) * 0.1 * (1 - t), ease.lin); girl.face('wow', 1.2); girl.pose('point', 1); } });
  await run; signWatch();
  // slip!
  SFX.slip(); dad.face('wow'); dad.pose('cheer', 2);
  FX.drops(V(puddleX, 0.1, 1.35), 12);
  const from = dad.root.position.clone(), to = V(-0.2, -1.54, -0.35);
  // the ice cream flies up
  let iceFly = null;
  if (dadIce) {
    const wp = new THREE.Vector3(); dadIce.getWorldPosition(wp); S.attach(dadIce); dadIce.scale.setScalar(1);
    const top = V(-0.2, 0.05 + 0.25, -0.35);
    iceFly = tween(1.5, t => { dadIce.position.lerpVectors(wp, top.clone().add(V(0, 0.55, 0)), t); dadIce.position.y += Math.sin(t * Math.PI) * 2.2; dadIce.rotation.z = t * Math.PI * 3; }, ease.lin);
  }
  await tween(0.95, t => {
    dad.root.position.lerpVectors(from, to, t); dad.root.position.y += Math.sin(t * Math.PI) * 1.4;
    dad.st.leanOverride = -t * 1.6; dad.root.rotation.y = Math.PI / 2 + t * Math.PI * 1.5;
  }, ease.lin);
  dad.st.leanOverride = null; dad.root.rotation.y = 0;
  SFX.splash(); shake(0.12); FX.drops(V(-0.2, 0, -0.35), 36); FX.puff(V(-0.2, 0, -0.35), 8, 0xffffff, 0.5);
  dad.face('oops'); dad.pose('swim', 99);
  girl.face('wow', 2); girl.pose('think', 1.5);
  const bob = onUpdate(() => { if (dad.st.inWater) dad.root.position.y = -1.54 + Math.sin(T.now * 3) * 0.03; });
  dad.st.inWater = true;
  if (iceFly) {
    await iceFly;
    dad.head.attach(dadIce); dadIce.position.set(0, 0.42, 0); dadIce.rotation.set(Math.PI, 0, 0);
    SFX.plop(); squash(dadIce, 0.3, 0.4); FX.sparkle(V(-0.2, 0.5, -0.35), 6);
    dad.face('are', 1.6); SFX.are(0.8);
    await wait(1.4);
    girl.face('laugh', 1.4); SFX.giggle(1.3);
  }
  dad.face('sad');
  await wait(0.6);
  // 1) throw the ring
  pulse(ring);
  await new Promise(res => {
    const go = async () => {
      untappable(ring); untappable(dad.root); pulse(ring, false); setHint(null);
      girl.pose('reach', 0.8); girl.face('happy', 1); SFX.whoosh();
      const tp = V(dad.root.position.x, POOL.water + 0.02, dad.root.position.z);
      await arcTo(ring, tp, 0.9, 1.4, ease.io, 0);
      SFX.splash(); FX.drops(tp, 14);
      const offR = onUpdate(() => { ring.position.x = dad.root.position.x; ring.position.z = dad.root.position.z; ring.position.y = POOL.water + 0.02 + Math.sin(T.now * 3) * 0.03; });
      ring.userData.off = offR;
      dad.face('happy', 1.5); SFX.yay(0.8); dad.pose('swim', 99);
      res();
    };
    tappable(ring, go); tappable(dad.root, go);
    setHint(() => ring);
  });
  await wait(0.8);
  // 2) pull dad out
  await new Promise(res => {
    tappable(dad.root, async () => {
      untappable(dad.root); setHint(null);
      girl.pose('reach2', 2.2); girl.face('happy', 2); SFX.yay(1.3);
      const edge = V(girlX - 1.0, -1.54, POOL.z1 - 0.45);
      const f = dad.root.position.clone();
      await tween(1.2, t => dad.root.position.lerpVectors(f, edge, t), ease.io);
      dad.st.inWater = false;
      ring.userData.off();
      SFX.whoosh(); dad.pose('cheer', 0.6);
      const out = V(girlX - 1.25, 0, 1.25);
      await tween(0.6, t => { dad.root.position.lerpVectors(edge, out, t); dad.root.position.y += Math.sin(t * Math.PI) * 0.4; ring.position.copy(dad.root.position).add(V(0, 0.5 * (1 - t) + 0.1, 0)); }, ease.out);
      SFX.thud(); FX.drops(V(out.x, 1.2, out.z), 30);
      await arcTo(ring, V(out.x + 0.9, 0.12, out.z + 0.5), 0.4, 0.3);
      dad.root.rotation.y = 0.4;
      dad.face('oops', 1.5); dad.pose('shrug', 1.5);
      res();
    });
    setHint(() => dad.head);
  });
  bob();
  await wait(1.0);
  // 3) pop the silly ice cream hat off
  if (dadIce) {
    pulse(dadIce);
    await new Promise(res => {
      const go = async () => {
        untappable(dadIce); untappable(dad.root); pulse(dadIce, false); setHint(null);
        girl.pose('reach', 0.6); SFX.boing();
        const wp = new THREE.Vector3(); dadIce.getWorldPosition(wp); S.attach(dadIce);
        await arcTo(dadIce, wp.clone().add(V(-1.2, -0.6, 0.8)), 0.7, 0.8, ease.out, 4);
        SFX.poof(); FX.sparkle(dadIce.position.clone(), 14); FX.puff(dadIce.position.clone(), 6, 0xffbfe0, 0.4);
        S.remove(dadIce);
        dad.face('laugh', 2); dad.pose('jump', 0.8); SFX.laugh(0.8);
        girl.face('laugh', 2); girl.pose('clap', 1.5); SFX.giggle(1.3);
        res();
      };
      tappable(dadIce, go); tappable(dad.root, go);
      setHint(() => dadIce);
    });
    await wait(1.6);
  }
  // 4) dad sees the sign... and tiptoes
  await dad.turn(-Math.PI / 2 - 0.3, 0.5);
  dad.pose('point', 1.8); dad.face('oops', 1.8);
  SFX.pip(); setTimeout(SFX.pip, 150); FX.sparkle(V(signX, 1.6, 1.5), 16);
  await tween(0.8, t => sign.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.25), ease.lin);
  await wait(1.0);
  dad.pose('tiptoe', 99); dad.face('smile');
  const tick = setInterval(() => SFX.tiptoe(), 260);
  dad.st.walk = 0;
  const f2 = dad.root.position.clone();
  dad.root.rotation.y = -Math.PI / 2;
  await tween(3.0, t => dad.root.position.lerpVectors(f2, V(puddleX - 0.6, 0, 1.25), t), ease.lin);
  clearInterval(tick);
  dad.pose('cheer', 1.5); dad.face('laugh', 2); await dad.turn(0.3);
  girl.face('laugh', 2); girl.pose('cheer', 2); SFX.fanfare(); FX.confetti(V(0, 1.8, 1.2), 50);
  await wait(2.2);
  setHint(null);
  untappable(sign); untappable(POOL.waterMesh); untappable(girl.root);
  offW();
  dad.pose('idle', 0.1);
}
