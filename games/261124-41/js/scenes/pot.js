// pot — light the flame, tip four dishes into the pot, pour water (hold), lid + simmer, lift the lid.
import { TAU, rnd, ease, Spring, lerp, dist, minHit } from '../engine.js';
import { spr } from '../sprite.js';
import { size, geo } from '../assets.js';
import { fx, hint } from '../fx.js';
import { bubbles } from '../bubbles.js';
import { snd } from '../snd.js';
import { game, phase, wait, anim } from '../game.js';
import { L as LAY } from '../engine.js';
import { POT, planPot, createPot, potSpots, drawStove, drawPot } from '../potview.js';

let DISH_W = 220;
let JUG = { x: 820, y: 800, w: 300 };
const KINDS = ['meat', 'onion', 'potato', 'carrot'];

// pieces lying on a dish: sizes/offsets authored for a 200-unit dish and a 280-radius pot
function dishPieces(kind) {
  const fd = DISH_W / 200, fp = POT.outerR / 280;
  return dishPieces0(kind).map((p) => Object.assign(p, { w: p.w * fd, potW: p.potW * fp, ox: p.ox * fd, oy: p.oy * fd }));
}
function dishPieces0(kind) {
  const ring = (n, r) => Array.from({ length: n }, (_, i) => { const a = i / n * TAU + rnd.range(-0.2, 0.2); return [Math.cos(a) * r, Math.sin(a) * r]; });
  const make = (names, w, potW, pos, extra = {}) => names.map((name, i) => Object.assign({ name, w, potW, ox: pos[i][0], oy: pos[i][1], rot: rnd() * TAU }, typeof extra === 'function' ? extra(i) : extra));
  if (kind === 'meat') return make([1, 2, 3, 1, 2].map((i) => 'meat_raw_' + i), 58, 76, [[0, 0], ...ring(4, 42)], (i) => ({ cooked: 'meat_cooked_' + [1, 2, 3, 1, 2][i] }));
  if (kind === 'onion') return make([1, 2, 3, 4, 1].map((i) => 'onion_wedge_' + i), 60, 78, [[0, 0], ...ring(4, 42)]);
  if (kind === 'potato') return make([1, 2, 3, 4, 2].map((i) => 'potato_chunk_' + i), 60, 80, [[0, 0], ...ring(4, 42)]);
  const shapes = ['flower', 'star', 'flower', 'heart', 'flower'];
  return [
    ...make(['carrot_slice_1', 'carrot_slice_2'], 58, 64, [[-26, 10], [24, -14]]),
    ...make(shapes.map((s) => 'carrot_' + s), 52, 70, ring(5, 40), { float: true }),
  ];
}

export default function pot() {
  let t = 0;
  const F = planPot();
  DISH_W = F.slots.meat.s;
  JUG = F.jug;
  const pv = createPot();
  const spots = potSpots(pv, 24);
  const dishes = KINDS.map((kind) => ({ kind, x: F.slots[kind].x, y: F.slots[kind].y, sx: F.slots[kind].x, sy: F.slots[kind].y, h: 0, rot: rnd.range(-0.2, 0.2), alpha: 1, pieces: dishPieces(kind), used: false, held: false, sq: new Spring(260, 10) }));
  const flying = [];
  let step = 'flame';
  let dishesDone = 0;
  let held = null;
  const loops = {};
  const jugOff = LAY.ex1 + JUG.w;
  const jug = { x: jugOff, y: JUG.y, rot: -0.15, h: 0, vis: false, tilt: 0 };
  let pouring = false, holding = false, pourMin = 0, firstContact = false, pourT = 0;
  let simmerTimer = 0, rattleT = 0, steamT = 0, sizzleSpeckT = 0, whiteout = 0;

  const L = (name) => loops[name] || (loops[name] = snd.loop(name));

  async function ignite() {
    game.block = true;
    phase('flame');
    await wait(0.6);
    snd.sfx('ignite');
    anim(0.5, (k) => { pv.flame = k; }, ease.outCubic);
    L('flame').set(0.6, 0.4);
    await wait(0.6);
    bubbles.girl.setFace('girl_wow');
    await wait(0.4);
    game.block = false;
    step = 'dishes';
    phase('dishes-0');
    hintDish();
  }

  function hintDish() {
    const d = dishes.find((x) => !x.used && x.kind === 'meat') || dishes.find((x) => !x.used);
    if (d) hint.set({ type: 'drag', x: d.x, y: d.y, x2: POT.x, y2: POT.y + 40, r: DISH_W * 0.55 });
  }

  async function tip(d) {
    if (d.used) return;
    d.used = true; d.held = false;
    hint.progress();
    hint.clear();
    snd.sfx('whoosh', { vol: 0.5 });
    // dish leans toward the pot
    const x0 = d.x, y0 = d.y;
    const tx = lerp(d.x, POT.x, 0.3), ty = lerp(d.y, POT.y, 0.3);
    await anim(0.2, (k) => { d.x = lerp(x0, tx, k); d.y = lerp(y0, ty, k); d.h = lerp(d.h, 60, k); d.rot = lerp(d.rot, d.x < POT.x ? 0.5 : -0.5, k); }, ease.outQuad);
    const ps = d.pieces;
    ps.forEach((p, i) => {
      const s = spots.shift() || { x: POT.x + rnd.range(-100, 100), y: POT.y + rnd.range(-100, 100) };
      const c = Math.cos(d.rot), sn = Math.sin(d.rot);
      const fx0 = d.x + p.ox * c - p.oy * sn, fy0 = d.y + p.ox * sn + p.oy * c;
      const f = { name: p.name, cooked: p.cooked, w: p.w, x: fx0, y: fy0, rot: p.rot, h: 60, float: !!p.float, cook: 0, sq: new Spring(260, 10), bob: rnd() * TAU };
      p.gone = true;
      flying.push(f);
      const r0 = f.rot, r1 = f.rot + rnd.range(-2, 2);
      anim(0.5, (k) => {
        f.x = lerp(fx0, s.x, ease.inOutQuad(k)); f.y = lerp(fy0, s.y, ease.inOutQuad(k));
        f.h = 60 * (1 - k) + Math.sin(k * Math.PI) * 200; f.w = lerp(p.w, p.potW, k); f.rot = lerp(r0, r1, k);
      }, ease.linear, i * 0.08).then(() => {
        f.h = 0; f.sq.kick(5);
        flying.splice(flying.indexOf(f), 1);
        pv.pieces.push(f);
        snd.sfx('drop', { pitch: 0.9 + rnd() * 0.3, vol: 0.7 });
        fx.specks(f.x, f.y, 4, 'rgba(255,230,150,0.9)', 160, 3);
        if (f.cooked) anim(2.5, (k) => { f.cook = k; }, ease.inOutQuad, 0.3);
      });
    });
    await wait(ps.length * 0.08 + 0.45);
    dishesDone++;
    L('sizzle').set(0.25 + dishesDone * 0.18, 0.5);
    phase('dishes-' + dishesDone);
    bubbles.girl.setFace(dishesDone % 2 ? 'girl_happy' : 'girl_focus');
    // empty dish slides away
    const x1 = d.x, y1 = d.y;
    anim(0.5, (k) => { d.x = lerp(x1, x1 + (x1 < 500 ? -500 : 500), k); d.y = lerp(y1, y1 + 200, k); d.h = 60 * (1 - k); d.alpha = 1 - k; }, ease.inCubic);
    snd.sfx('slide', { vol: 0.5 });
    if (dishesDone >= 4) lively();
    else hintDish();
  }

  async function lively() {
    step = 'lively';
    game.block = true;
    phase('sizzle');
    L('sizzle').set(1, 0.3);
    pv.jiggle = 1;
    await wait(1.1);
    pv.jiggle = 0.35;
    // water jug slides in
    jug.vis = true;
    snd.sfx('slide');
    await anim(0.6, (k) => { jug.x = lerp(jugOff, JUG.x, k); }, ease.outCubic);
    game.block = false;
    step = 'water';
    phase('water');
    hint.set({ type: 'hold', x: JUG.x, y: JUG.y, r: JUG.w * 0.5 });
  }

  // jug pose while pouring: spout over the rim, tilted
  function jugPour() {
    const g = pv.g;
    return { x: g.ix + g.ir * 1.05, y: g.iy - g.ir * 0.55, rot: -0.55, h: 70 };
  }
  function spout() {
    const s = size('jug'), hh = JUG.w * s.h / s.w;
    const hd = geo('jug', 'head', geo('jug', 'spout', { x: 0.1, y: 0.22 }));
    const k = 1 + jug.h / 1400;
    const ox = (hd.x - 0.5) * JUG.w * k, oy = (hd.y - 0.5) * hh * k;
    const c = Math.cos(jug.rot), sn = Math.sin(jug.rot);
    return { x: jug.x + ox * c - oy * sn, y: jug.y + ox * sn + oy * c };
  }

  async function startPour() {
    if (step !== 'water' || pouring) return;
    pouring = true; holding = true; pourMin = 0.7;
    hint.clear();
    const p = jugPour(), x0 = jug.x, y0 = jug.y, r0 = jug.rot;
    await anim(0.3, (k) => { jug.x = lerp(x0, p.x, k); jug.y = lerp(y0, p.y, k); jug.rot = lerp(r0, p.rot, k); jug.h = p.h * k; }, ease.outCubic);
    jug.tilt = 1;
    L('pourwater').set(0.9, 0.15);
  }
  async function stopPour() {
    pouring = false; jug.tilt = 0;
    L('pourwater').set(0, 0.2);
    const x0 = jug.x, y0 = jug.y, r0 = jug.rot, h0 = jug.h;
    if (pv.water >= 1) return;
    await anim(0.3, (k) => { jug.x = lerp(x0, JUG.x, k); jug.y = lerp(y0, JUG.y, k); jug.rot = lerp(r0, -0.15, k); jug.h = h0 * (1 - k); }, ease.outCubic);
    hint.set({ type: 'hold', x: JUG.x, y: JUG.y, r: JUG.w * 0.5 });
  }

  async function waterFull() {
    step = 'lid';
    pouring = false; holding = false; jug.tilt = 0;
    hint.clear();
    L('pourwater').stop(0.3);
    L('sizzle').set(0, 0.6);
    game.block = true;
    snd.sfx('ding');
    bubbles.girl.setFace('girl_happy');
    const x0 = jug.x, y0 = jug.y;
    anim(0.6, (k) => { jug.x = lerp(x0, jugOff + 100, k); jug.y = lerp(y0, y0 - 100, k); jug.h = 70 + k * 80; }, ease.inCubic).then(() => { jug.vis = false; });
    await wait(0.7);
    // lid flies in and lands
    phase('lid');
    const g = pv.g;
    const lx0 = LAY.ex1 + 300, ly0 = LAY.ey0 - 300;
    pv.lid = { x: lx0, y: ly0, h: 400, alpha: 1, rot: 0.6, sq: new Spring(260, 10) };
    snd.sfx('whoosh');
    await anim(0.7, (k) => { pv.lid.x = lerp(lx0, g.ix, k); pv.lid.y = lerp(ly0, g.iy, k); pv.lid.h = 400 * (1 - k) + Math.sin(k * Math.PI) * 80; pv.lid.rot = 0.6 * (1 - k); }, ease.inOutCubic);
    pv.lid.h = 0;
    snd.sfx('clink');
    pv.lid.sq.kick(5);
    step = 'simmer';
    phase('simmer');
    simmerTimer = 5;
    rattleT = 1.2;
    L('simmer').set(0.2, 1);
    anim(5, (k) => { pv.warm = k; pv.simmer = k; L('simmer').set(0.2 + 0.6 * k, 0.3); }, ease.linear);
    bubbles.girl.setFace('girl_focus');
    bubbles.mama.setFace('mama_smile');
  }

  async function lidReady() {
    step = 'lidtap';
    game.block = false;
    phase('lid-tap');
    hint.set({ type: 'tap', x: pv.g.ix, y: pv.g.iy, r: pv.g.ir });
  }

  async function lift() {
    step = 'lifting';
    hint.clear();
    game.block = true;
    phase('lid-lift');
    const l = pv.lid;
    snd.sfx('steam');
    snd.sfx('whoosh', { vol: 0.6 });
    anim(0.6, (k) => { l.h = k * 900; l.x = lerp(pv.g.ix, pv.g.ix - 120, k); l.y = lerp(pv.g.iy, pv.g.iy - 500, k); l.alpha = 1 - Math.max(0, (k - 0.5) * 2); }, ease.inCubic);
    // big steam cloud whites out the screen, then clears to reveal the broth
    for (let i = 0; i < 16; i++) fx.steam(pv.g.ix + rnd.range(-200, 200), pv.g.iy + rnd.range(-200, 200), { size: rnd.range(200, 320), alpha: 0.9, vy: -60, vx: -30, life: 2.4, grow: 1.4, spread: 60, layer: 'over' });
    await anim(0.35, (k) => { whiteout = k; }, ease.outQuad);
    // the reveal: simmered golden broth, softer pieces
    pv.lid = null; pv.water = 0; pv.broth = 1; pv.jiggle = 0; pv.soft = 1;
    for (const p of pv.pieces) { p.cook = 1; p.w *= 0.96; }
    await wait(0.8);
    await anim(0.9, (k) => { whiteout = 1 - k; }, ease.inOutQuad);
    whiteout = 0;
    snd.sfx('sparkle');
    fx.sparkle(pv.g.ix, pv.g.iy, 16, pv.g.ir);
    bubbles.girl.setFace('girl_wow'); bubbles.girl.jump(1);
    bubbles.mama.setFace('mama_smile');
    await wait(0.9);
    game.goto('roux', { fade: false, carry: pv });
  }

  return {
    enter() {
      bubbles.setHomes(F.bub);
      bubbles.mama.show('mama_smile'); bubbles.girl.show('girl_focus');
      ignite();
    },
    exit(next) {
      // flame + simmer loops continue in roux when we hand over the pot
      for (const k in loops) if (next !== 'roux' || (k !== 'flame' && k !== 'simmer')) loops[k].stop(0.3);
      pv.loops = loops;
    },
    update(dt) {
      t += dt;
      pv.update(dt);
      for (const d of dishes) d.sq.update(dt);
      for (const f of flying) f.sq.update(dt);
      const g = pv.g;
      // sizzle: oil specks and thin wisps
      if (dishesDone > 0 && pv.water < 0.5 && step !== 'lifting') {
        sizzleSpeckT -= dt;
        if (sizzleSpeckT <= 0) {
          sizzleSpeckT = 0.12 / (0.5 + dishesDone * 0.25);
          const a = rnd() * TAU, r = Math.sqrt(rnd()) * g.ir * 0.8;
          fx.specks(g.ix + Math.cos(a) * r, g.iy + Math.sin(a) * r, 2, 'rgba(255,245,200,0.95)', 120, 3);
          if (rnd() < 0.3) fx.steam(g.ix + Math.cos(a) * r, g.iy + Math.sin(a) * r, { size: 30, alpha: 0.25, life: 1.4 });
        }
      }
      if (step === 'water') {
        if (pouring) {
          pourT += dt;
          pourMin -= dt;
          if (jug.tilt) {
            pv.water = Math.min(1, pv.water + dt / 3);
            if (!firstContact && pourT > 0.35) {
              firstContact = true;
              snd.sfx('steam');
              for (let i = 0; i < 12; i++) fx.steam(g.ix + rnd.range(-120, 120), g.iy + rnd.range(-120, 120), { size: 110, alpha: 0.7, life: 2, spread: 40 });
            }
            const lp = { x: g.ix + g.ir * 0.04, y: g.iy + g.ir * 0.04 };
            if (rnd() < dt * 10) pv.ripple(lp.x + rnd.range(-10, 10), lp.y + rnd.range(-10, 10), 0.8, 0.9);
            if (rnd() < dt * 12) fx.drops(lp.x, lp.y, 2, 'rgba(225,240,250,0.9)', 160);
            L('sizzle').set(Math.max(0, 1 - pv.water * 1.4), 0.2);
            pv.jiggle = 0.35 * (1 - pv.water);
          }
          if (!holding && pourMin <= 0) stopPour();
          if (pv.water >= 1) waterFull();
        }
      }
      if (step === 'simmer' || step === 'lidtap') {
        steamT -= dt; rattleT -= dt;
        if (steamT <= 0) {
          steamT = 0.15;
          const a = rnd() * TAU, r = g.ir * 1.12;
          fx.steam(g.ix + Math.cos(a) * r, g.iy + Math.sin(a) * r, { size: 65, alpha: 0.5 * pv.simmer + 0.2, life: 1.8 });
        }
        if (rattleT <= 0 && pv.lid) {
          rattleT = 1.2;
          snd.sfx('rattle', { vol: 0.7 });
          const l = pv.lid;
          anim(0.35, (k) => { l.jx = Math.sin(k * 40) * 4 * (1 - k); l.jy = Math.cos(k * 33) * 3 * (1 - k); l.h = Math.sin(k * Math.PI) * 8; });
        }
        if (step === 'simmer') {
          simmerTimer -= dt;
          if (simmerTimer <= 0) lidReady();
        } else if (pv.lid) {
          pv.lid.sc = 1 + Math.max(0, Math.sin(t * 5)) * 0.025;
        }
      }
    },
    draw(ctx) {
      drawStove(ctx, pv);
      for (const d of dishes) {
        if (d.alpha <= 0.01) continue;
        const q = d.sq.x * 0.04;
        spr(ctx, 'dish', d.x, d.y, DISH_W, { h: d.h, rot: d.rot, alpha: d.alpha, sx: 1 + q, sy: 1 - q });
        const k = 1 + d.h / 1400;
        const c = Math.cos(d.rot), s = Math.sin(d.rot);
        for (const p of d.pieces) {
          if (p.gone) continue;
          spr(ctx, p.name, d.x + (p.ox * c - p.oy * s) * k, d.y + (p.ox * s + p.oy * c) * k, p.w * k, { rot: p.rot + d.rot, alpha: d.alpha, sa: 0.7 });
        }
      }
      drawPot(ctx, pv);
      if (jug.vis && !pouring) drawJug(ctx);
    },
    drawTop(ctx) {
      for (const f of flying) spr(ctx, f.name, f.x, f.y, f.w, { rot: f.rot, h: f.h });
      if (jug.vis && pouring) {
        if (jug.tilt) drawStream(ctx);
        drawJug(ctx);
      }
    },
    drawOverlay(ctx) {
      if (whiteout > 0) {
        ctx.fillStyle = `rgba(255,252,246,${0.93 * whiteout})`;
        ctx.fillRect(-5000, -5000, 11000, 11000);
      }
    },
    down(p) {
      if (step === 'dishes') {
        let best = null, bd = 1e9;
        for (const d of dishes) {
          if (d.used) continue;
          const dd = dist(p.x, p.y, d.x, d.y);
          if (dd < Math.max(DISH_W * 0.65, minHit()) && dd < bd) { bd = dd; best = d; }
        }
        if (dist(p.x, p.y, POT.x, POT.y) < POT.outerR && !best) best = dishes.find((d) => !d.used);
        if (best) { held = best; best.held = true; best.h = 40; best.offx = best.x - p.x; best.offy = best.y - p.y; snd.sfx('pop', { vol: 0.5 }); }
      } else if (step === 'water') {
        if (dist(p.x, p.y, jug.x, jug.y) < Math.max(JUG.w * 0.7, minHit()) || dist(p.x, p.y, POT.x, POT.y) < POT.outerR * 1.1) { holding = true; startPour(); }
      } else if (step === 'lidtap') {
        lift();
      }
    },
    move(p) {
      if (held && !held.used) {
        held.x = p.x + held.offx; held.y = p.y + held.offy;
        if (dist(held.x, held.y, POT.x, POT.y) < POT.outerR * 0.9) { const d = held; held = null; tip(d); }
      }
    },
    up() {
      holding = false;
      if (held && !held.used) { const d = held; held = null; tip(d); }
    },
  };

  function drawJug(ctx) {
    spr(ctx, 'jug', jug.x, jug.y, JUG.w, { rot: jug.rot, h: jug.h });
  }

  function drawStream(ctx) {
    const s = spout(), g = pv.g;
    const lx = g.ix + g.ir * 0.04, ly = g.iy + g.ir * 0.04;
    const mx = (s.x + lx) / 2 + 20, my = (s.y + ly) / 2 - 10;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(200,225,245,0.55)'; ctx.lineWidth = 22;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.quadraticCurveTo(mx, my, lx, ly); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 7;
    ctx.setLineDash([26, 18]); ctx.lineDashOffset = -t * 260;
    ctx.beginPath(); ctx.moveTo(s.x - 4, s.y - 2); ctx.quadraticCurveTo(mx - 4, my - 2, lx - 3, ly - 2); ctx.stroke();
    ctx.setLineDash([]);
    // splash ring where the stream hits
    for (let i = 0; i < 3; i++) {
      const k = ((t * 2.2 + i / 3) % 1);
      ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - k)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(lx, ly, 14 + k * 46, (14 + k * 46) * 0.85, 0, 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(lx, ly, 13, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

