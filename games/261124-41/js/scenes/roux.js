// roux — break roux blocks into the broth, stir in circles: the golden broth turns into curry.
// Then the "oishiku naare" video cut-scene grows out of the girl's bubble.
import { TAU, rnd, ease, lerp, clamp, dist, angDiff, Spring, L as LAY } from '../engine.js';
import { spr, shadow } from '../sprite.js';
import { size, geo, img } from '../assets.js';
import { fx, hint } from '../fx.js';
import { bubbles } from '../bubbles.js';
import { snd } from '../snd.js';
import { game, phase, wait, anim } from '../game.js';
import { POT, createPot, fillPot, drawStove, drawPot, initMix, mixRotate, mixDeposit, mixRaise, mixFill, mixMeasure } from '../potview.js';
import { playStirVideo } from '../video.js';

const TRAY = { x: 500, y: 835, w: 220 };
const DISH_W = 285;
// quadrant centres of the roux bar (normalised to the tray image)
const QUADS = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];

export default function roux(carry) {
  const pv = carry && carry.pieces ? carry : createPot();
  const loops = pv.loops || {};
  const L = (name) => loops[name] || (loops[name] = snd.loop(name));
  let step = 'tray';
  const tray = { y: 1300, broken: [false, false, false, false] };
  const blocks = [];  // { name, x, y, h, w, rot, d (dissolved 0..1), inPot }
  let taps = 0;
  const spat = { x: 0, y: 0, vis: 0, h: 0 };
  let stirring = false, lastAng = null, lastP = null;
  let smSpeed = 0, smTan = 0;
  let frameDA = 0, frameDist = 0, measureT = 0, tokT = 0, cut = null;

  if (!carry || !carry.pieces) {
    fillPot(pv, true);
    pv.flame = 1; pv.broth = 1; pv.warm = 1; pv.simmer = 1;
  }
  for (const p of pv.pieces) if (p.float) { p.pa = Math.atan2(p.y - pv.g.iy, p.x - pv.g.ix); p.pr = Math.hypot(p.x - pv.g.ix, p.y - pv.g.iy); }

  async function trayIn() {
    phase('roux-tray');
    game.block = true;
    snd.sfx('slide');
    await anim(0.6, (k) => { tray.y = lerp(1300, TRAY.y, k); }, ease.outCubic);
    game.block = false;
    step = 'blocks';
    phase('roux-0');
    hint.set({ type: 'tap', x: TRAY.x, y: TRAY.y, r: TRAY.w * 0.6 });
  }

  function quadPos(i) {
    const s = size('roux_tray'), h = TRAY.w * s.h / s.w;
    return { x: TRAY.x + (QUADS[i][0] - 0.5) * TRAY.w, y: tray.y + (QUADS[i][1] - 0.5) * h };
  }

  function breakBlock() {
    if (taps >= 4) return;
    const i = taps++;
    hint.progress();
    tray.broken[i] = true;
    const q = quadPos(i);
    snd.sfx('pop', { pitch: 1 + i * 0.05 });
    const g = pv.g;
    const a = -Math.PI / 2 + (i - 1.5) * 1.1 + rnd.range(-0.2, 0.2), r = g.ir * rnd.range(0.35, 0.55);
    const tx = g.ix + Math.cos(a) * r, ty = g.iy + Math.sin(a) * r;
    const b = { name: 'roux_' + (i + 1), x: q.x, y: q.y, h: 0, w: TRAY.w * 0.48, rot: 0, d: 0, inPot: false, sq: new Spring(260, 10) };
    blocks.push(b);
    const r0 = rnd.range(-0.6, 0.6);
    anim(0.55, (k) => {
      b.x = lerp(q.x, tx, ease.inOutQuad(k)); b.y = lerp(q.y, ty, ease.inOutQuad(k));
      b.h = Math.sin(k * Math.PI) * 260; b.rot = r0 * k; b.w = lerp(TRAY.w * 0.48, 86, k);
    }).then(() => {
      b.h = 0; b.inPot = true; b.sq.kick(4);
      snd.sfx('plop');
      pv.ripple(b.x, b.y, 1.2, 1.2);
      fx.drops(b.x, b.y, 8, 'rgba(240,200,120,0.95)', 220);
    });
    phase('roux-' + taps);
    if (taps >= 4) {
      hint.clear();
      step = 'wait';
      game.clock.after(0.8, startStir);
    }
  }

  async function startStir() {
    initMix(pv);
    // tray dish slides away, spatula appears in the pot
    anim(0.5, (k) => { tray.y = lerp(TRAY.y, 1350, k); }, ease.inCubic);
    const g = pv.g;
    spat.x = g.ix + g.ir * 0.4; spat.y = g.iy + g.ir * 0.2;
    snd.sfx('whoosh', { vol: 0.5 });
    await anim(0.4, (k) => { spat.vis = k; spat.h = 200 * (1 - k); }, ease.outCubic);
    step = 'stir';
    phase('stir');
    loops.stir = snd.loop('stir');
    hint.set({ type: 'circle', x: g.ix, y: g.iy, r: g.ir * 1.1 });
    bubbles.girl.setFace('girl_focus');
  }

  async function complete() {
    step = 'done';
    hint.clear();
    stirring = false;
    game.block = true;
    phase('curry');
    mixFill(pv);
    for (const b of blocks) b.d = 1;
    L('stir').stop(0.4);
    L('thick').set(0.7, 0.6);
    L('simmer').set(0.25, 1);
    snd.sfx('success');
    pv.mix.sweep = 0;
    anim(1.0, (k) => { pv.mix.sweep = k; }, ease.inOutQuad).then(() => { pv.mix.sweep = -1; });
    const g = pv.g;
    for (let i = 0; i < 16; i++) fx.steam(g.ix + rnd.range(-150, 150), g.iy + rnd.range(-150, 150), { size: 120, alpha: 0.6, life: 2.4, spread: 40 });
    for (let i = 0; i < 6; i++) game.clock.after(0.3 + i * 0.25, () => fx.steam(g.ix + rnd.range(-90, 90), g.iy + rnd.range(-60, 60), { size: 60, alpha: 0.85, heart: true, vy: -60, life: 2.6, grow: 0.7, layer: 'over' }));
    spat.target = 0;
    anim(0.5, (k) => { spat.vis = 1 - k; spat.h = k * 200; });
    fx.sparkle(g.ix, g.iy, 20, g.ir);
    bubbles.girl.setFace('girl_wow'); bubbles.girl.jump(1);
    bubbles.mama.setFace('mama_wow'); bubbles.mama.jump(0.8);
    snd.sfx('girl', { mood: 'wow' });
    await wait(1.4);
    bubbles.girl.setFace('girl_happy');
    snd.sfx('sparkle');
    await wait(1.4);
    // cut-scene
    phase('cutscene');
    cut = { dim: 0, heartsT: 0 };
    snd.bgmDuck(0.15, 0.5);
    const gb = bubbles.girl;
    const D = Math.min(LAY.ex1 - LAY.ex0, LAY.ey1 - LAY.ey0) * 0.7;
    gb.place({ x: (LAY.ex0 + LAY.ex1) / 2, y: (LAY.ey0 + LAY.ey1) / 2, d: D }, 0.6);
    anim(0.5, (k) => { cut.dim = k; });
    await wait(0.6);
    const played = await playStirVideo({ onStart: () => { gb.hide(); } });
    phase(played ? 'cutscene-done' : 'cutscene-fallback');
    gb.show('girl_happy');
    gb.place(null, 0.7);
    anim(0.6, (k) => { cut.dim = 1 - k; });
    snd.bgmDuck(1, 0.8);
    await wait(0.8);
    L('thick').stop(1); L('simmer').stop(1); L('flame').stop(0.8);
    game.goto('serve');
  }

  // spatula: head under the finger, handle pointing out to the lower right
  function drawSpatula(ctx) {
    if (spat.vis <= 0.01) return;
    const s = size('spatula');
    const W = 330, H = W * s.h / s.w;
    const hd = geo('spatula', 'head', { x: 0.78, y: 0.16 }), gp = geo('spatula', 'grip', { x: 0.12, y: 0.92 });
    const vx = (gp.x - hd.x) * W, vy = (gp.y - hd.y) * H;
    const want = Math.PI / 4 + (spat.x - pv.g.ix) / pv.g.ir * 0.25;
    const rot = want - Math.atan2(vy, vx);
    const ox = (hd.x - 0.5) * W, oy = (hd.y - 0.5) * H;
    const c = Math.cos(rot), sn = Math.sin(rot);
    const cx = spat.x - (ox * c - oy * sn), cy = spat.y - (ox * sn + oy * c);
    spr(ctx, 'spatula', cx, cy, W, { rot, h: spat.h + 18, alpha: spat.vis, sa: 0.8 });
  }

  function stirUpdate(dt) {
    const m = pv.mix, g = pv.g;
    if (!m) return;
    // finger motion accumulated since the last frame
    // pointer events and frames are not in lock-step: smooth per-frame motion over ~0.15 s
    const r = Math.hypot(spat.x - g.ix, spat.y - g.iy);
    const sm = 1 - Math.exp(-dt / 0.15);
    smSpeed += (frameDist / dt - smSpeed) * sm;
    smTan += (Math.abs(frameDA) * r / dt - smTan) * sm;
    const speed = stirring ? smSpeed : 0;
    const circ = speed > 1 ? clamp(smTan / speed, 0, 1) : 0;
    const energy = stirring ? clamp(speed / 450, 0, 1) * (0.5 + 0.5 * circ) : 0;
    if (stirring) {
      const da = clamp(frameDA * 0.55, -0.16, 0.16);
      if (Math.abs(da) > 0.0005) mixRotate(pv, da * 0.6, r, g.ir * 0.22, da * 0.7);
      m.texAng += da * 0.5;
      for (const p of pv.pieces) if (p.float) { p.pa += da * 0.8; }
      if (frameDist > 2) mixDeposit(pv, spat.x, spat.y, 36, 0.05 + 0.25 * clamp(blocks.reduce((s, b) => s + b.d, 0) / 4, 0, 1) * energy);
      L('stir').set(clamp(speed / 900, 0.1, 1), 0.08);
    } else {
      L('stir').set(0, 0.25);
    }
    m.texAng += dt * 0.02;
    // roux blocks dissolve (faster while stirring) and bleed a brown cloud
    for (const b of blocks) {
      if (!b.inPot || b.d >= 1) continue;
      const rate = 0.025 + energy * 0.32;
      b.d = Math.min(1, b.d + rate * dt);
      if (stirring && energy > 0.05) {
        const a = Math.atan2(b.y - g.iy, b.x - g.ix) + clamp(frameDA * 0.4, -0.08, 0.08);
        const rr = Math.hypot(b.x - g.ix, b.y - g.iy);
        b.x = g.ix + Math.cos(a) * rr; b.y = g.iy + Math.sin(a) * rr;
      }
      mixDeposit(pv, b.x, b.y, 40 + b.d * 70, (0.06 + energy * 0.12) * (1 - b.d * 0.5));
    }
    // slow uniform thickening proportional to stirring (~9 s of good stirring completes it)
    mixRaise(pv, energy * 0.12 * dt);
    if (energy > 0.05) hint.progress();
    measureT -= dt;
    if (measureT <= 0) {
      measureT = 0.3;
      const mean = mixMeasure(pv);
      pv.broth = 1;
      if (step === 'stir' && (mean >= 0.97 || m.base >= 1.02)) complete();
    }
    if (stirring && energy > 0.2 && rnd() < dt * 3) fx.steam(g.ix + rnd.range(-120, 120), g.iy + rnd.range(-120, 120), { size: 50, alpha: 0.3, life: 1.6 });
    frameDA = 0; frameDist = 0;
  }

  return {
    enter() {
      bubbles.mama.show('mama_smile'); bubbles.girl.show('girl_wow');
      L('flame').set(0.6, 0.4); L('simmer').set(0.6, 0.6);
      pv.water = 0;
      trayIn();
    },
    exit() { for (const k in loops) loops[k].stop(0.4); },
    update(dt) {
      tokT -= dt;
      pv.update(dt);
      for (const b of blocks) b.sq.update(dt);
      for (const p of pv.pieces) if (p.float && p.pa !== undefined) { p.x = pv.g.ix + Math.cos(p.pa) * p.pr; p.y = pv.g.iy + Math.sin(p.pa) * p.pr; }
      if (step === 'stir' || step === 'done') stirUpdate(dt);
      if (cut) {
        cut.heartsT -= dt;
        if (cut.heartsT <= 0 && cut.dim > 0.5) {
          cut.heartsT = 0.35;
          const side = rnd() < 0.5 ? -1 : 1;
          const cx = (LAY.ex0 + LAY.ex1) / 2, w = (LAY.ex1 - LAY.ex0);
          fx.hearts(cx + side * rnd.range(0.25, 0.45) * w, rnd.range(LAY.ey0 + 100, LAY.ey1 - 50), 1, 'over', 1.3);
        }
      }
      if (rnd() < dt * 2.5 && step !== 'done') fx.steam(pv.g.ix + rnd.range(-140, 140), pv.g.iy + rnd.range(-140, 140), { size: 50, alpha: 0.3, life: 1.8 });
    },
    draw(ctx) {
      drawStove(ctx, pv);
      if (tray.y < 1250) {
        spr(ctx, 'dish', TRAY.x, tray.y, DISH_W, {});
        drawTray(ctx);
      }
      drawPot(ctx, pv);
      // blocks in the pot float on top of the broth and melt away
      ctx.save();
      ctx.beginPath(); ctx.arc(pv.g.ix, pv.g.iy, pv.g.ir, 0, TAU); ctx.clip();
      for (const b of blocks) {
        if (!b.inPot || b.d >= 1) continue;
        const q = b.sq.x * 0.05, k = 1 - b.d * 0.6;
        spr(ctx, b.name, b.x, b.y, b.w * k, { rot: b.rot, alpha: 1 - b.d * b.d, sx: 1 + q, sy: 1 - q, sa: 0.5 });
      }
      ctx.restore();
      drawSpatula(ctx);
    },
    drawTop(ctx) {
      for (const b of blocks) if (!b.inPot) spr(ctx, b.name, b.x, b.y, b.w, { rot: b.rot, h: b.h });
    },
    drawOverlay(ctx) {
      if (cut && cut.dim > 0) {
        ctx.fillStyle = `rgba(30,16,6,${0.6 * cut.dim})`;
        ctx.fillRect(LAY.ex0, LAY.ey0, LAY.ex1 - LAY.ex0, LAY.ey1 - LAY.ey0);
        // keep the (enlarged) girl bubble above the dim
        bubbles.girl.draw(ctx);
        fx.drawParts(ctx, 'over');
      }
    },
    down(p) {
      if (step === 'blocks') { breakBlock(); return; }
      if (step === 'stir') {
        const g = pv.g;
        if (dist(p.x, p.y, g.ix, g.iy) < POT.outerR * 1.35) {
          stirring = true;
          moveSpat(p);
          lastAng = Math.atan2(p.y - g.iy, p.x - g.ix); lastP = p;
          spat.h = 0;
        }
      }
    },
    move(p) {
      if (!stirring) return;
      const g = pv.g;
      const a = Math.atan2(p.y - g.iy, p.x - g.ix);
      if (lastAng !== null && Math.hypot(p.x - g.ix, p.y - g.iy) > 25) frameDA += angDiff(lastAng, a);
      if (lastP) frameDist += dist(p.x, p.y, lastP.x, lastP.y);
      lastAng = a; lastP = p;
      moveSpat(p);
    },
    up() { stirring = false; lastAng = null; lastP = null; spat.h = 18; },
  };

  function moveSpat(p) {
    const g = pv.g;
    let dx = p.x - g.ix, dy = p.y - g.iy;
    const d = Math.hypot(dx, dy), max = g.ir * 0.82;
    if (d > max) {
      dx *= max / d; dy *= max / d;
      if (tokT <= 0 && d > g.ir * 0.9) { tokT = 0.35; snd.sfx('tok', { vol: 0.6 }); pv.ripple(g.ix + dx, g.iy + dy, 0.5, 0.7); }
    }
    spat.x = g.ix + dx; spat.y = g.iy + dy;
  }

  // the roux bar, minus the blocks already broken off
  function drawTray(ctx) {
    const s = size('roux_tray'), h = TRAY.w * s.h / s.w;
    const x0 = TRAY.x - TRAY.w / 2, y0 = tray.y - h / 2;
    for (let pass = 0; pass < 2; pass++) {
      ctx.save();
      ctx.beginPath();
      QUADS.forEach((q, i) => {
        if (tray.broken[i]) return;
        const qx = x0 + (q[0] - 0.25) * TRAY.w + (pass ? 0 : 4), qy = y0 + (q[1] - 0.25) * h + (pass ? 0 : 7);
        ctx.rect(qx - 0.5, qy - 0.5, TRAY.w / 2 + 1, h / 2 + 1);
      });
      ctx.clip();
      if (pass === 0) shadow(ctx, 'roux_tray', TRAY.x, tray.y, TRAY.w, h, 0, 0, 1, 1, 0.5, 0.5, 1);
      else ctx.drawImage(img('roux_tray'), x0, y0, TRAY.w, h);
      ctx.restore();
    }
  }
}
