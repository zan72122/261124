// cut — tap anywhere: the helper knife chops carrot, potato, onion; slices become pieces in neat piles.
import { TAU, rnd, ease, Spring, lerp, clamp } from '../engine.js';
import { spr, shadow, backdrop } from '../sprite.js';
import { size, geo } from '../assets.js';
import { fx, hint } from '../fx.js';
import { bubbles } from '../bubbles.js';
import { snd } from '../snd.js';
import { game, phase, wait, anim } from '../game.js';

export const BOARD = { x: 500, y: 590, w: 860 };
const VY = 650;          // vegetable axis on the board
const HOVER = 120;       // knife height when waiting
const PILES = [{ x: 290, y: 330 }, { x: 500, y: 330 }, { x: 710, y: 330 }];
const PILE_OFF = [[-48, -14, 0.3], [40, -22, 1.4], [-6, 22, 2.2], [56, 28, 0.9], [-58, 40, 4.1]];

function vegDefs() {
  const body = geo('carrot', 'body', { x0: 0.05, x1: 0.7, cy: 0.59 });
  const cw = 760, cs = size('carrot');
  const ch = cw * cs.h / cs.w;
  // place the carrot body centred on the board
  const bodyMid = ((body.x0 + body.x1) / 2 - 0.5) * cw;
  const cx = 500 - bodyMid + 40, cy = VY - (body.cy - 0.5) * ch;
  const bx0 = cx + (body.x0 - 0.5) * cw, bx1 = cx + (body.x1 - 0.5) * cw;
  const L = bx1 - bx0;
  const carrotCuts = [bx1 + 4];
  for (let i = 1; i <= 4; i++) carrotCuts.push(bx1 - L * i / 5 * 0.98);
  const ps = size('potato');
  const pw = 300, ph = pw * ps.h / ps.w;          // drawn rotated 90°: screen width = ph
  const ow = 330;
  return [
    { name: 'carrot', x: cx, y: cy, w: cw, rot: 0, cuts: carrotCuts, leaf: true, piece: (i) => 'carrot_slice_' + (1 + (i % 3)), pieceW: 100, juice: 'rgba(255,140,40,0.9)', soft: false },
    { name: 'potato', x: 500, y: VY, w: pw, rot: Math.PI / 2, cuts: [500 + ph * 0.24, 500, 500 - ph * 0.24], piece: (i) => 'potato_chunk_' + (1 + (i % 4)), pieceW: 92, juice: 'rgba(250,235,190,0.9)', soft: false },
    { name: 'onion', x: 500, y: VY, w: ow, rot: 0, cuts: [500 + ow * 0.24, 500, 500 - ow * 0.24], piece: (i) => 'onion_wedge_' + (1 + (i % 4)), pieceW: 98, juice: 'rgba(240,245,255,0.9)', soft: true },
  ];
}

// one separable strip of the vegetable between two (slightly tilted) cut lines
function makeSegs(v) {
  const lines = [{ x: -2000, a: 0 }];
  const sorted = v.cuts.map((x, i) => ({ x, a: v.tilts[i] })).sort((a, b) => a.x - b.x);
  lines.push(...sorted, { x: 3000, a: 0 });
  const segs = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const l = lines[i], r = lines[i + 1];
    const cx = clamp((Math.max(l.x, v.x - 600) + Math.min(r.x, v.x + 600)) / 2, 0, 1000);
    segs.push({ l, r, cx, dx: 0, dy: 0, rot: 0, alpha: 1, pop: 0, sq: new Spring(300, 14) });
  }
  return segs;
}

function segPath(ctx, s, ox = 0, oy = 0) {
  const y0 = VY - 420, y1 = VY + 420;
  const xl = (y) => s.l.x + Math.tan(s.l.a) * (y - VY), xr = (y) => s.r.x + Math.tan(s.r.a) * (y - VY);
  ctx.beginPath();
  ctx.moveTo(xl(y0) + ox, y0 + oy); ctx.lineTo(xr(y0) + ox, y0 + oy);
  ctx.lineTo(xr(y1) + ox, y1 + oy); ctx.lineTo(xl(y1) + ox, y1 + oy);
  ctx.closePath();
}

export default function cut() {
  let t = 0;
  const defs = vegDefs();
  const board = { sh: new Spring(400, 18) };
  const knife = { x: 1300, y: VY, h: HOVER, rot: Math.PI / 2, vis: 1 };
  let vi = -1, veg = null, segs = [], cutN = 0;
  let queue = 0, chopping = false, accepting = false;
  const pieces = [];   // finished pieces lying in piles

  function knifeAt(x, a) {
    // place the knife so the cutting edge (30% from the tip) is on the cut line at the veg axis
    const ks = size('knife'), kw = 620, kh = kw * ks.h / ks.w;
    // contact point: 60% of the way along the cutting edge from the tip toward the heel
    const e = geo('knife', 'edge', { x0: 0.005, y0: 0.31, x1: 0.56, y1: 0.9 });
    const ox = (lerp(e.x0, e.x1, 0.6) - 0.5) * kw, oy = (lerp(e.y0, e.y1, 0.6) - 0.5) * kh;
    const th = Math.PI / 2 - a;
    const c = Math.cos(th), s = Math.sin(th);
    return { x: x - (ox * c - oy * s), y: VY - (ox * s + oy * c), rot: th, kw };
  }

  async function bring(i) {
    vi = i;
    const d = defs[i];
    veg = { ...d, tilts: d.cuts.map(() => rnd.range(-0.07, 0.07)), slide: -900, alpha: 1 };
    segs = makeSegs(veg);
    cutN = 0;
    phase('cut-' + d.name + '-enter');
    game.block = true;
    snd.sfx('slide');
    await anim(0.6, (k) => { veg.slide = -900 * (1 - k); }, ease.outCubic);
    veg.slide = 0;
    const kp = knifeAt(veg.cuts[0], veg.tilts[0]);
    const fx0 = knife.x, fy0 = knife.y, fr0 = knife.rot;
    await anim(0.45, (k) => { knife.x = lerp(fx0, kp.x, k); knife.y = lerp(fy0, kp.y, k); knife.rot = lerp(fr0, kp.rot, k); knife.h = HOVER + Math.sin(k * Math.PI) * 60; }, ease.inOutCubic);
    game.block = false;
    accepting = true;
    phase('cut-' + d.name);
    hint.set({ type: 'tap', x: () => veg.cuts[Math.min(cutN, veg.cuts.length - 1)], y: VY, r: 110 });
  }

  async function chop() {
    chopping = true;
    while (queue > 0 && cutN < veg.cuts.length) {
      queue--;
      const i = cutN;
      const kp = knifeAt(veg.cuts[i], veg.tilts[i]);
      const x0 = knife.x, y0 = knife.y, r0 = knife.rot;
      await anim(0.1, (k) => { knife.h = HOVER * (1 - k); knife.x = lerp(x0, kp.x, k); knife.y = lerp(y0, kp.y, k); knife.rot = lerp(r0, kp.rot, k); }, ease.inQuad);
      knife.h = 0;
      contact(i);
      const last = cutN >= veg.cuts.length;
      const nx = last ? knifeAt(veg.cuts[i] + 260, 0) : knifeAt(veg.cuts[cutN], veg.tilts[cutN]);
      const x1 = knife.x, y1 = knife.y, r1 = knife.rot;
      await anim(last ? 0.3 : 0.14, (k) => { knife.h = HOVER * k; knife.x = lerp(x1, nx.x, k); knife.y = lerp(y1, nx.y, k); knife.rot = lerp(r1, nx.rot, k); }, ease.outQuad);
      if (last) { queue = 0; finishVeg(); }
    }
    chopping = false;
  }

  function contact(i) {
    cutN++;
    hint.progress();
    snd.sfx('chop', { soft: veg.soft, pitch: 1 + rnd.range(-0.05, 0.05) });
    board.sh.kick(-60);
    fx.specks(veg.cuts[i], VY + rnd.range(-30, 30), 7, veg.juice, 240, 5);
    // every strip right of this cut moves a little further right
    const cx = veg.cuts[i];
    for (const s of segs) {
      if (s.l.x >= cx - 1) {
        const isNew = Math.abs(s.l.x - cx) < 1;
        const isLeaf = veg.leaf && i === 0;
        const tx = s.dx + (isLeaf ? 170 : isNew ? 26 : 16), ty = s.dy + (isLeaf ? 50 : rnd.range(-6, 6));
        const tr = s.rot + (isNew ? (isLeaf ? 0.35 : rnd.range(-0.09, 0.09)) : 0);
        const fx0 = s.dx, fy0 = s.dy, fr0 = s.rot;
        anim(isLeaf ? 0.6 : 0.25, (k) => { s.dx = lerp(fx0, tx, k); s.dy = lerp(fy0, ty, k); s.rot = lerp(fr0, tr, k); }, ease.outCubic);
        if (isLeaf && isNew) { s.leaf = true; anim(0.6, (k) => { s.alpha = 1 - k; }, ease.linear, 0.7); }
      }
    }
    bubbles.girl.setFace('girl_focus');
  }

  async function finishVeg() {
    accepting = false;
    hint.clear();
    game.block = true;
    const name = veg.name;
    phase('cut-' + name + '-pieces');
    await wait(0.25);
    // strips pop into separate pieces
    const live = segs.filter((s) => !s.leaf);
    const pile = PILES[vi];
    const made = [];
    for (let k = 0; k < 5; k++) {
      const s = live[Math.min(live.length - 1, Math.floor(k * live.length / 5))];
      const p = { name: veg.piece(k), w: veg.pieceW, x: s.cx + s.dx + rnd.range(-20, 20) + (k % 2 ? 14 : -14), y: VY + s.dy + rnd.range(-30, 30), rot: rnd() * TAU, h: 0, a: 0, sq: new Spring(260, 10) };
      made.push(p); pieces.push(p);
    }
    snd.sfx('pop');
    await anim(0.25, (k) => { for (const s of live) { s.pop = Math.sin(k * Math.PI) * 0.12; s.alpha = 1 - k; } for (const p of made) p.a = k; });
    veg = null;
    fx.sparkle(500, VY, 10, 200);
    await wait(0.15);
    snd.sfx('slide');
    made.forEach((p, k) => {
      const [ox, oy, r] = PILE_OFF[k];
      const x0 = p.x, y0 = p.y, r0 = p.rot;
      anim(0.5, (e) => { p.x = lerp(x0, pile.x + ox, e); p.y = lerp(y0, pile.y + oy, e); p.rot = lerp(r0, r, e); p.h = Math.sin(e * Math.PI) * 40; }, ease.inOutCubic, k * 0.06)
        .then(() => { p.sq.kick(2); });
    });
    await wait(0.8);
    snd.sfx('ding');
    bubbles.girl.setFace('girl_happy'); bubbles.girl.jump(0.7);
    fx.sparkle(pile.x, pile.y, 10, 90);
    await wait(0.8);
    if (vi + 1 < defs.length) { bubbles.girl.setFace('girl_focus'); bring(vi + 1); }
    else {
      phase('done');
      snd.sfx('success');
      bubbles.mama.setFace('mama_wow'); bubbles.mama.jump(0.8);
      fx.sparkle(500, 330, 18, 300);
      await wait(1.6);
      game.goto('stamp');
    }
  }

  function drawVeg(ctx) {
    if (!veg) return;
    const sl = veg.slide;
    const s = size(veg.name);
    const hh = veg.w * s.h / s.w;
    // pass 1: shadows of all strips; pass 2: the strips
    for (let pass = 0; pass < 2; pass++) {
      for (const g of segs) {
        if (g.alpha <= 0.01) continue;
        ctx.save();
        ctx.globalAlpha = g.alpha;
        ctx.translate(g.cx + g.dx + sl, VY + g.dy);
        ctx.rotate(g.rot);
        const sc = (1 + g.pop) * (1 + g.sq.x * 0.03);
        ctx.scale(sc, sc);
        ctx.translate(-g.cx, -VY);
        segPath(ctx, g, pass === 0 ? 4 : 0, pass === 0 ? 7 : 0);
        ctx.clip();
        if (pass === 0) shadow(ctx, veg.name, veg.x, veg.y, veg.w, hh, 0, veg.rot, 1, 1, 0.5, 0.5, 1);
        else spr(ctx, veg.name, veg.x, veg.y, veg.w, { rot: veg.rot, shadow: false });
        ctx.restore();
      }
    }
  }

  return {
    enter() {
      bubbles.mama.show('mama_smile'); bubbles.girl.show('girl_focus');
      bring(0);
    },
    update(dt) {
      t += dt;
      board.sh.update(dt);
      for (const p of pieces) p.sq.update(dt);
      for (const s of segs) s.sq.update(dt);
    },
    draw(ctx) {
      backdrop(ctx, 'bg_counter', 500, 500, 1600);
      const by = board.sh.x * 0.05;
      ctx.save();
      ctx.translate(0, by);
      spr(ctx, 'board', BOARD.x, BOARD.y, BOARD.w);
      for (const p of pieces) {
        const q = p.sq.x * 0.05;
        spr(ctx, p.name, p.x, p.y, p.w, { rot: p.rot, h: p.h, alpha: p.a, sx: 1 + q, sy: 1 - q });
      }
      drawVeg(ctx);
      ctx.restore();
    },
    drawTop(ctx) {
      // knife (with its lifted shadow), bobbing gently while it waits
      const bob = accepting && !chopping ? Math.sin(t * 3) * 6 : 0;
      spr(ctx, 'knife', knife.x, knife.y, 620, { rot: knife.rot, h: knife.h + bob, sa: 0.9 });
    },
    down() {
      if (!accepting || !veg) return;
      if (queue < 2) queue++;
      if (!chopping) chop();
    },
  };
}
