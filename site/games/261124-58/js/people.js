import * as THREE from 'three';
import { noiseTex, damp, lerp, clock } from './util.js';
import { sfx } from './audio.js';

const FW = 1024, FH = 512, K = FW / (Math.PI * 2); // face canvas px per radian

function drawFace(p) {
  const c = p.faceCtx, o = p.opts;
  const cx = FW * 0.25, cy = FH * 0.5;
  c.fillStyle = o.skin; c.fillRect(0, 0, FW, FH);
  // cheeks
  const ch = (x) => {
    const g = c.createRadialGradient(x, cy + 0.32 * K, 4, x, cy + 0.32 * K, 46);
    g.addColorStop(0, 'rgba(255,120,130,0.45)'); g.addColorStop(1, 'rgba(255,120,130,0)');
    c.fillStyle = g; c.fillRect(x - 60, cy + 0.32 * K - 60, 120, 120);
  };
  ch(cx - 0.52 * K); ch(cx + 0.52 * K);
  // green juice
  if (p.green > 0.01) {
    c.save();
    c.globalAlpha = Math.min(1, p.green) * 0.92;
    c.fillStyle = '#5fd14a';
    c.beginPath(); c.ellipse(cx, cy + 0.05 * K, 1.05 * K, 0.95 * K, 0, 0, 7); c.fill();
    for (let i = 0; i < 7; i++) {
      const x = cx + (i - 3) * 0.3 * K;
      c.beginPath(); c.ellipse(x, cy + (0.9 + (i % 3) * 0.12) * K, 14, 34 + (i % 2) * 18, 0, 0, 7); c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath(); c.ellipse(cx - 0.45 * K, cy - 0.35 * K, 26, 12, -0.5, 0, 7); c.fill();
    c.restore();
  }
  const e = p.blinking && !['happy', 'laugh', 'surprise'].includes(p.expr) ? 'blink' : p.expr;
  const eyeY = cy + 0.06 * K, ex = 0.34 * K, mouthY = cy + 0.44 * K;
  const dark = '#2a1a14';
  c.lineCap = 'round';
  // brows
  c.strokeStyle = o.brow || '#4a2a18'; c.lineWidth = 7;
  const browY = eyeY - 0.3 * K;
  const brow = (x, lift, tilt) => { c.beginPath(); c.moveTo(x - 22, browY - lift + tilt); c.quadraticCurveTo(x, browY - lift - 8, x + 22, browY - lift - tilt); c.stroke(); };
  if (e === 'huh') { brow(cx - ex, 14, 4); brow(cx + ex, -2, -2); }
  else if (e === 'surprise') { brow(cx - ex, 14, 0); brow(cx + ex, 14, 0); }
  else if (e === 'oops') { brow(cx - ex, 6, -8); brow(cx + ex, 6, 8); }
  else { brow(cx - ex, 0, 0); brow(cx + ex, 0, 0); }
  // eyes
  const openEye = (x, sc = 1) => {
    c.fillStyle = dark;
    c.beginPath(); c.ellipse(x, eyeY, 17 * sc, 23 * sc, 0, 0, 7); c.fill();
    c.fillStyle = '#5a3420';
    c.beginPath(); c.ellipse(x, eyeY + 6 * sc, 11 * sc, 12 * sc, 0, 0, 7); c.fill();
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(x - 6 * sc, eyeY - 9 * sc, 6.5 * sc, 0, 7); c.fill();
    c.beginPath(); c.arc(x + 6 * sc, eyeY + 7 * sc, 3 * sc, 0, 7); c.fill();
  };
  const arcEye = (x, up = true) => {
    c.strokeStyle = dark; c.lineWidth = 8;
    c.beginPath();
    if (up) c.arc(x, eyeY + 8, 18, Math.PI * 1.15, Math.PI * 1.85);
    else c.arc(x, eyeY - 10, 18, Math.PI * 0.15, Math.PI * 0.85);
    c.stroke();
  };
  if (e === 'blink') { arcEye(cx - ex, false); arcEye(cx + ex, false); }
  else if (e === 'happy' || e === 'laugh') { arcEye(cx - ex); arcEye(cx + ex); }
  else if (e === 'surprise') { openEye(cx - ex, 1.2); openEye(cx + ex, 1.2); }
  else if (e === 'huh') { openEye(cx - ex, 1.1); c.strokeStyle = dark; c.lineWidth = 8; c.beginPath(); c.moveTo(cx + ex - 16, eyeY); c.lineTo(cx + ex + 16, eyeY); c.stroke(); }
  else if (e === 'oops') {
    c.strokeStyle = dark; c.lineWidth = 7;
    [[cx - ex, 1], [cx + ex, -1]].forEach(([x, s]) => { c.beginPath(); c.moveTo(x - 14 * s, eyeY - 12); c.lineTo(x + 12 * s, eyeY); c.lineTo(x - 14 * s, eyeY + 12); c.stroke(); });
  } else { openEye(cx - ex); openEye(cx + ex); }
  // mouth
  c.lineWidth = 7; c.strokeStyle = '#a03a3a';
  if (e === 'happy' || e === 'laugh') {
    const w = e === 'laugh' ? 40 : 34, h = e === 'laugh' ? 34 : 26;
    c.fillStyle = '#8a2430';
    c.beginPath(); c.moveTo(cx - w, mouthY - 6); c.quadraticCurveTo(cx, mouthY - 10, cx + w, mouthY - 6); c.quadraticCurveTo(cx + w * 0.8, mouthY + h, cx, mouthY + h); c.quadraticCurveTo(cx - w * 0.8, mouthY + h, cx - w, mouthY - 6); c.fill();
    c.fillStyle = '#ff8a9a'; c.beginPath(); c.ellipse(cx, mouthY + h * 0.7, w * 0.45, h * 0.28, 0, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.fillRect(cx - w * 0.6, mouthY - 7, w * 1.2, 7);
  } else if (e === 'surprise') {
    c.fillStyle = '#8a2430'; c.beginPath(); c.ellipse(cx, mouthY + 6, 15, 20, 0, 0, 7); c.fill();
  } else if (e === 'huh') {
    c.beginPath(); c.moveTo(cx - 20, mouthY + 4); c.quadraticCurveTo(cx - 8, mouthY - 6, cx, mouthY + 3); c.quadraticCurveTo(cx + 10, mouthY + 12, cx + 20, mouthY); c.stroke();
  } else if (e === 'oops') {
    c.fillStyle = '#fff'; c.beginPath(); c.roundRect(cx - 34, mouthY - 6, 68, 22, 8); c.fill();
    c.strokeStyle = '#a03a3a'; c.lineWidth = 5; c.stroke();
    c.beginPath(); c.moveTo(cx - 34, mouthY + 5); c.lineTo(cx + 34, mouthY + 5); c.stroke();
  } else {
    c.beginPath(); c.arc(cx, mouthY - 14, 24, Math.PI * 0.2, Math.PI * 0.8); c.stroke();
  }
  // green mustache after drinking
  if (p.stache > 0.02) {
    c.fillStyle = `rgba(80,200,60,${Math.min(1, p.stache) * 0.9})`;
    c.beginPath(); c.ellipse(cx - 18, mouthY - 16, 26, 9, 0.2, 0, 7); c.ellipse(cx + 18, mouthY - 16, 26, 9, -0.2, 0, 7); c.fill();
  }
  p.faceTex.needsUpdate = true;
}

function lathe(points, mat, seg = 28) {
  const m = new THREE.Mesh(new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function sph(r, mat, sx = 1, sy = 1, sz = 1, ws = 24, hs = 16) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat);
  m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true;
  return m;
}
function capsule(r, len, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function makePerson(o) {
  const adult = !!o.adult;
  const P = adult
    ? { leg: 0.78, torso: 0.56, head: 0.125, sh: 0.18, arm: 0.56, armR: 0.042, legR: 0.06, hip: 0.08 }
    : { leg: 0.36, torso: 0.34, head: 0.165, sh: 0.135, arm: 0.3, armR: 0.042, legR: 0.05, hip: 0.06 };
  const root = new THREE.Group();
  const skinMat = new THREE.MeshPhysicalMaterial({ color: o.skin, roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color('#ffd0c0') });
  const clothMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: noiseTex(o.shirt, 18, 128, [4, 4]), roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: noiseTex(o.pants, 16, 128, [4, 4]), roughness: 0.85 });
  const hairMat = new THREE.MeshStandardMaterial({ color: o.hair, roughness: 0.55, side: THREE.DoubleSide });
  const shoeMat = new THREE.MeshStandardMaterial({ color: o.shoe || '#ffffff', roughness: 0.5 });

  const hips = new THREE.Group(); hips.position.y = P.leg; root.add(hips);
  // legs
  const legs = [];
  [-1, 1].forEach(s => {
    const piv = new THREE.Group(); piv.position.set(s * P.hip, 0, 0); hips.add(piv);
    const l = capsule(P.legR, P.leg - P.legR * 2 - 0.04, o.longPants ? pantsMat : skinMat);
    l.position.y = -P.leg / 2 + 0.02; piv.add(l);
    if (!o.longPants && !adult) {
      const sh = capsule(P.legR * 1.35, 0.06, pantsMat); sh.position.y = -0.05; piv.add(sh);
    }
    const shoe = sph(P.legR * 1.35, shoeMat, 1, 0.65, 1.6); shoe.position.set(0, -P.leg + 0.035, 0.03); piv.add(shoe);
    legs.push(piv);
  });
  // torso
  const tw = P.sh * (adult ? 1.05 : 1.15);
  const body = o.dress
    ? lathe([[0, 0], [tw * 1.5, -0.02], [tw * 1.35, P.torso * 0.35], [tw * 0.95, P.torso * 0.8], [tw * 0.75, P.torso], [0, P.torso + 0.02]], clothMat)
    : lathe([[0, -0.02], [tw * 1.0, -0.02], [tw * 1.08, P.torso * 0.35], [tw * 1.0, P.torso * 0.8], [tw * 0.78, P.torso], [0, P.torso + 0.02]], clothMat);
  body.position.y = adult && o.dress ? -0.2 : (o.dress ? -0.06 : 0);
  if (adult && o.dress) body.scale.y = (P.torso + 0.2) / P.torso;
  hips.add(body);
  if (!o.dress) {
    const pantsTop = lathe([[0, -0.08], [tw * 0.95, -0.08], [tw * 1.02, 0.06], [0, 0.06]], pantsMat);
    hips.add(pantsTop);
  }
  if (o.apron) {
    const ap = new THREE.Mesh(new THREE.CylinderGeometry(tw * 1.1, tw * 1.7, P.torso * 1.05, 24, 1, true, -0.9, 1.8),
      new THREE.MeshStandardMaterial({ color: '#ffffff', map: noiseTex(o.apron, 14, 128, [3, 3]), roughness: 0.9, side: THREE.DoubleSide }));
    ap.position.set(0, P.torso * 0.32, 0.005); ap.castShadow = false; ap.receiveShadow = false;
    // CylinderGeometry thetaStart 0 is +z
    hips.add(ap);
  }
  // neck + head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * (adult ? 1.2 : 1), 0.04 * (adult ? 1.2 : 1), 0.06, 12), skinMat);
  neck.position.y = P.torso + 0.02; hips.add(neck);
  const headPivot = new THREE.Group(); headPivot.position.y = P.torso + (adult ? 0.02 : -0.012); hips.add(headPivot);
  const faceCanvas = document.createElement('canvas'); faceCanvas.width = FW; faceCanvas.height = FH;
  const faceTex = new THREE.CanvasTexture(faceCanvas); faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.anisotropy = 8;
  const headMat = new THREE.MeshPhysicalMaterial({ map: faceTex, roughness: 0.5, sheen: 0.3, sheenColor: new THREE.Color('#ffd0c0') });
  const head = new THREE.Mesh(new THREE.SphereGeometry(P.head, 48, 32), headMat);
  head.castShadow = true;
  head.position.y = P.head * 0.98;
  head.scale.set(1, adult ? 1.12 : 0.97, adult ? 1.02 : 1);
  headPivot.add(head);
  const nose = sph(P.head * 0.11, skinMat, 1, 0.8, 0.8); nose.position.set(0, -P.head * 0.12, P.head * 0.97); head.add(nose);
  [-1, 1].forEach(s => { const ear = sph(P.head * 0.2, skinMat, 0.5, 1, 0.8); ear.position.set(s * P.head * 0.98, -P.head * 0.05, 0); head.add(ear); });
  // hair
  const R = P.head * 1.06;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 20, 0, Math.PI * 2, 0, Math.PI * (o.bangs ?? 0.36)), hairMat);
  cap.castShadow = true; head.add(cap);
  const back = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 20, Math.PI, Math.PI, 0, Math.PI * (o.backLen ?? 0.72)), hairMat);
  back.castShadow = true; head.add(back);
  const style = o.hairStyle;
  if (style === 'pigtails') {
    [-1, 1].forEach(s => {
      const pt = sph(P.head * 0.36, hairMat, 0.85, 1.25, 0.85); pt.position.set(s * P.head * 1.12, -P.head * 0.05, -P.head * 0.3); pt.rotation.z = s * 0.5; head.add(pt);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(P.head * 0.13, P.head * 0.05, 8, 16), new THREE.MeshStandardMaterial({ color: '#ff5a8a', roughness: 0.4 }));
      tie.position.set(s * P.head * 0.98, P.head * 0.22, -P.head * 0.22); tie.rotation.y = Math.PI / 2; head.add(tie);
    });
  } else if (style === 'bob') {
    const bob = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 40, 20, Math.PI * 0.82, Math.PI * 1.36, Math.PI * 0.2, Math.PI * 0.45), hairMat);
    bob.castShadow = true; head.add(bob);
  } else if (style === 'curly') {
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI * 0.45;
      const v = new THREE.Vector3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)).multiplyScalar(R);
      if (v.z > R * 0.55 && v.y < R * 0.75) continue;
      const cu = sph(P.head * 0.24, hairMat, 1, 1, 1, 12, 8); cu.position.copy(v); head.add(cu);
    }
  } else if (style === 'ponytail') {
    const pt = sph(P.head * 0.32, hairMat, 0.8, 1.6, 0.8); pt.position.set(0, -P.head * 0.35, -P.head * 1.12); pt.rotation.x = 0.35; head.add(pt);
    const tie = sph(P.head * 0.14, new THREE.MeshStandardMaterial({ color: '#ffb02e' }), 1, 1, 1); tie.position.set(0, P.head * 0.15, -P.head * 1.0); head.add(tie);
  }
  // arms
  const arms = [];
  [-1, 1].forEach(s => {
    const piv = new THREE.Group(); piv.position.set(s * (tw * 0.92 + P.armR), P.torso - 0.05, 0); hips.add(piv);
    const sleeve = capsule(P.armR * 1.3, P.arm * 0.32, clothMat); sleeve.position.y = -P.arm * 0.2; piv.add(sleeve);
    const a = capsule(P.armR, P.arm - P.armR * 2, o.longSleeve ? clothMat : skinMat); a.position.y = -P.arm / 2; piv.add(a);
    const hand = new THREE.Group(); hand.position.y = -P.arm; piv.add(hand);
    const hm = sph(P.armR * 1.35, skinMat); hand.add(hm);
    arms.push({ piv, hand, s, x: 0, z: 0, tx: 0, tz: 0 });
  });
  // arms[0] = right arm (at -x), arms[1] = left arm (at +x)

  const p = {
    root, hips, head, headPivot, arms, legs, P, opts: o, faceCtx: faceCanvas.getContext('2d'), faceTex,
    expr: 'smile', exprT: 0, blinking: false, blinkT: 2 + Math.random() * 2, green: 0, greenT: 0, stache: 0, stacheT: 0,
    tilt: 0, tiltT: 0, yawLook: 0, yawLookT: 0, jumpT: -1, jumpH: 0, walk: 0, walking: false, bobPhase: Math.random() * 10,
    crouch: 0, crouchT: 0, dirty: true, pose: null, poseT: 0, spin: 0,
    voice: o.voice || 1,
    setExpr(e, dur = 0) { if (p.expr !== e) { p.expr = e; p.dirty = true; } p.exprT = dur; },
    setPose(name, dur = 0) { p.pose = name; p.poseT = dur; },
    jump(h = 0.12) { p.jumpT = 0; p.jumpH = h; },
    async huhThenHappy() {
      p.setExpr('huh', 1.1); p.tiltT = 0.25; sfx.huh();
      await new Promise(r => setTimeout(r, 1000));
      p.tiltT = 0; p.setExpr('happy', 1.4); p.jump(0.08); sfx.giggle(p.voice);
    },
    happy(dur = 1.4, jump = true) { p.setExpr('happy', dur); if (jump) p.jump(); },
    face(target) { // turn root to face a world point (y ignored)
      const wp = new THREE.Vector3(); root.getWorldPosition(wp);
      return Math.atan2(target.x - wp.x, target.z - wp.z);
    },
    update(dt) {
      const t = clock.time;
      // expressions
      if (p.exprT > 0) { p.exprT -= dt; if (p.exprT <= 0) { p.expr = 'smile'; p.dirty = true; } }
      p.blinkT -= dt;
      if (p.blinkT <= 0) { p.blinking = !p.blinking; p.blinkT = p.blinking ? 0.13 : 2 + Math.random() * 3; p.dirty = true; }
      const g = damp(p.green, p.greenT, 3, dt);
      if (Math.abs(g - p.green) > 0.004) { p.green = g; p.dirty = true; }
      if (p.stacheT > 0) { p.stacheT -= dt; }
      const st = damp(p.stache, p.stacheT > 0 ? 1 : 0, 2, dt);
      if (Math.abs(st - p.stache) > 0.01) { p.stache = st; p.dirty = true; }
      if (p.dirty) { drawFace(p); p.dirty = false; }
      // body
      p.bobPhase += dt;
      let y = P.leg + Math.sin(p.bobPhase * 2.2) * 0.004;
      if (p.jumpT >= 0) {
        p.jumpT += dt;
        const k = p.jumpT / 0.42;
        if (k >= 1) p.jumpT = -1; else y += Math.sin(k * Math.PI) * p.jumpH;
      }
      p.crouch = damp(p.crouch, p.crouchT, 6, dt);
      y -= p.crouch;
      hips.position.y = y;
      p.tilt = damp(p.tilt, p.tiltT, 8, dt);
      headPivot.rotation.z = p.tilt;
      p.yawLook = damp(p.yawLook, p.yawLookT, 5, dt);
      headPivot.rotation.y = p.yawLook;
      headPivot.rotation.x = Math.sin(p.bobPhase * 1.3) * 0.03;
      // walking
      if (p.walking) p.walk += dt * 9; else p.walk = damp(p.walk, Math.round(p.walk / Math.PI) * Math.PI, 10, dt);
      const sw = Math.sin(p.walk) * (p.walking ? 0.5 : 0.5 * Math.abs(Math.sin(p.walk)));
      legs[0].rotation.x = sw; legs[1].rotation.x = -sw;
      if (p.walking) hips.position.y += Math.abs(Math.cos(p.walk)) * 0.02;
      // arms
      if (p.poseT > 0) { p.poseT -= dt; if (p.poseT <= 0) p.pose = null; }
      const pose = p.pose;
      arms.forEach((a, i) => {
        let tx = 0, tz = a.s * 0.08;
        if (p.walking) tx = -sw * 0.8 * (i ? 1 : -1);
        if (pose === 'cheer') { tx = -0.3; tz = a.s * 2.6 + Math.sin(t * 14 + i) * 0.15; }
        else if (pose === 'wave') { if (i === 1) { tz = 2.5 + Math.sin(t * 12) * 0.35; tx = -0.2; } }
        else if (pose === 'reach') { tx = -1.3; tz = a.s * 0.1; }
        else if (pose === 'reachR') { if (i === 0) { tx = -1.4; tz = -0.1; } }
        else if (pose === 'hold') { if (i === 0) { tx = -1.0; tz = 0.25; } }
        else if (pose === 'holdUp') { if (i === 0) { tx = -2.5; tz = 0.15; } }
        else if (pose === 'drink') { if (i === 0) { tx = -1.9; tz = 0.55; } }
        else if (pose === 'clap') { tx = -1.25; tz = -a.s * (0.25 + Math.abs(Math.sin(t * 10)) * 0.25); }
        else if (pose === 'swim') { tx = -1.2 + Math.sin(t * 6 + i * 3) * 0.6; tz = a.s * (0.9 + Math.cos(t * 6 + i * 3) * 0.5); }
        else if (pose === 'wipe') { if (i === 0) { tx = -2.0 + Math.sin(t * 16) * 0.2; tz = 0.4 + Math.sin(t * 16) * 0.3; } }
        else if (pose === 'shy') { tx = -0.5; tz = -a.s * 0.4; }
        if (p.armOverride && p.armOverride[i]) { tx = p.armOverride[i][0]; tz = p.armOverride[i][1]; }
        a.x = damp(a.x, tx, 10, dt); a.z = damp(a.z, tz, 10, dt);
        a.piv.rotation.set(a.x, 0, a.z);
      });
    },
  };
  root.userData.person = p;
  root.traverse(m => { m.userData.personRoot = root; });
  drawFace(p);
  return p;
}

// Walk a person to a point (in parent space), then optionally face a yaw.
export function walkTo(p, x, z, speed = 0.9, faceYaw = null) {
  return new Promise(res => {
    p.walking = true;
    const r = p.root;
    const step = () => {
      const dx = x - r.position.x, dz = z - r.position.z;
      const d = Math.hypot(dx, dz);
      return { dx, dz, d };
    };
    p._walk = { x, z, speed, faceYaw, res, step };
  });
}

export function updateWalk(p, dt) {
  const w = p._walk;
  if (!w) {
    if (p._yawT !== undefined) p.root.rotation.y = angDamp(p.root.rotation.y, p._yawT, 6, dt);
    return;
  }
  const { dx, dz, d } = w.step();
  if (d < 0.03) {
    p.walking = false; p._walk = null;
    if (w.faceYaw !== null) p._yawT = w.faceYaw;
    w.res();
    return;
  }
  const yaw = Math.atan2(dx, dz);
  p.root.rotation.y = angDamp(p.root.rotation.y, yaw, 10, dt);
  const s = Math.min(d, w.speed * dt);
  p.root.position.x += (dx / d) * s;
  p.root.position.z += (dz / d) * s;
  if (Math.sin(p.walk) * Math.sin(p.walk - dt * 9) < 0) sfx.step();
}

function angDamp(a, b, rate, dt) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * (1 - Math.exp(-rate * dt));
}
export function faceYaw(p, yaw) { p._yawT = yaw; }

export { lerp };
