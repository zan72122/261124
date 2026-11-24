// cut — tap anywhere: the helper knife chops carrot, potato, onion; slices become pieces in neat piles.
import { TAU, rnd, ease, Spring, lerp, clamp, canvas2d, bucket, pxScale } from '../engine.js';
import { spr, shadow, backdrop } from '../sprite.js';
import { size, geo, img } from '../assets.js';
import { fx, hint } from '../fx.js';
import { bubbles } from '../bubbles.js';
import { snd } from '../snd.js';
import { game, phase, wait, anim } from '../game.js';
import { frame } from '../layout.js';

export const BOARD = { x: 500, y: 590, w: 860 };
// cut + stamp are authored in "board space" (a 860-wide board at 500,590);
// boardFrame() maps that onto the real layout (board ≈ 960 units wide, filling the short side)
export function boardFrame() {
  const s = size('board');
  const F = frame({ w: 960, h: 960 * s.h / s.w }, []);
  return { F, k: (960 * F.k) / BOARD.w, ox: F.px, oy: F.py };
}
export const W = (T, x, y) => ({ x: T.ox + (x - BOARD.x) * T.k, y: T.oy + (y - BOARD.y) * T.k });
export function applyT(ctx, T) { ctx.translate(T.ox, T.oy); ctx.scale(T.k, T.k); ctx.translate(-BOARD.x, -BOARD.y); }
const VY = 650;          // vegetable axis on the board
const HOVER = 120;       // knife height when waiting
const PILES = [{ x: 255, y: 345 }, { x: 500, y: 345 }, { x: 745, y: 345 }];
const PILE_OFF = [[-62, -18, 0.3], [52, -28, 1.4], [-8, 28, 2.2], [72, 36, 0.9], [-74, 50, 4.1]];

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
    { name: 'carrot', x: cx, y: cy, w: cw, hw: cw * 0.45, rot: 0, cuts: carrotCuts, leaf: true, piece: (i) => 'carrot_slice_' + (1 + (i % 3)), pieceW: 128, juice: 'rgba(255,140,40,0.9)', soft: false },
    { name: 'potato', x: 500, y: VY, w: pw, hw: ph * 0.45, rot: Math.PI / 2, cuts: [500 + ph * 0.24, 500, 500 - ph * 0.24], piece: (i) => 'potato_chunk_' + (1 + (i % 4)), pieceW: 120, juice: 'rgba(250,235,190,0.9)', soft: false },
    { name: 'onion', x: 500, y: VY, w: ow, hw: ow * 0.45, rot: 0, cuts: [500 + ow * 0.24, 500, 500 - ow * 0.24], piece: (i) => 'onion_wedge_' + (1 + (i % 4)), pieceW: 124, juice: 'rgba(240,245,255,0.9)', soft: true },
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
    const cx = clamp((Math.max(l.x, v.x - v.hw) + Math.min(r.x, v.x + v.hw)) / 2, 0, 1000);
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

// opaque part of a photo, as 0..1 of its width/height (read once from a small copy, never per frame)
const opaque = {};
function opaqueBox(name) {
  if (opaque[name]) return opaque[name];
  const N = 64, c = canvas2d(N, N), x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img(name), 0, 0, N, N);
  let box = { x0: 0, y0: 0, x1: 1, y1: 1 };
  try {
    const d = x.getImageData(0, 0, N, N).data;
    let a = N, b = N, e = -1, f = -1;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (d[(j * N + i) * 4 + 3] > 2) { a = Math.min(a, i); b = Math.min(b, j); e = Math.max(e, i); f = Math.max(f, j); }
    if (e >= 0) box = { x0: Math.max(0, (a - 1) / N), y0: Math.max(0, (b - 1) / N), x1: Math.min(1, (e + 2) / N), y1: Math.min(1, (f + 2) / N) };
  } catch (err) { /* keep the full box */ }
  return (opaque[name] = box);
}

export default function cut() {
  let t = 0;
  const T = boardFrame();
  const fxp = (x, y) => W(T, x, y);
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
    hint.set({ type: 'tap', x: () => fxp(veg.cuts[Math.min(cutN, veg.cuts.length - 1)], VY).x, y: fxp(0, VY).y, r: 110 * T.k });
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
    { const q = fxp(veg.cuts[i], VY + rnd.range(-30, 30)); fx.specks(q.x, q.y, 7, veg.juice, 240 * T.k, 5 * T.k); }
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
    { const q = fxp(500, VY); fx.sparkle(q.x, q.y, 10, 200 * T.k); }
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
    { const q = fxp(pile.x, pile.y); fx.sparkle(q.x, q.y, 10, 90 * T.k); }
    await wait(0.8);
    if (vi + 1 < defs.length) { bubbles.girl.setFace('girl_focus'); bring(vi + 1); }
    else {
      phase('done');
      snd.sfx('success');
      bubbles.mama.setFace('mama_wow'); bubbles.mama.jump(0.8);
      { const q = fxp(500, 345); fx.sparkle(q.x, q.y, 18, 300 * T.k); }
      await wait(1.6);
      game.goto('stamp');
    }
  }

  // Each strip (its clipped shadow and its clipped slice of the photo) is pre-rendered once per
  // vegetable and pixel size, so the strips are plain drawImage calls instead of 8 clip paths a frame.
  let stripCache = null;
  function stripSprites(px) {
    const key = veg.name + '|' + px;
    if (stripCache && stripCache.key === key && stripCache.veg === veg) return stripCache.list;
    const s = size(veg.name);
    const hh = veg.w * s.h / s.w;
    // bounding box of the photo's opaque part, rotated (+ the shadow's blur pad and offset)
    const o = opaqueBox(veg.name);
    let X0 = Infinity, X1 = -Infinity, Y0 = Infinity, Y1 = -Infinity;
    const c = Math.cos(veg.rot), sn = Math.sin(veg.rot);
    for (const [u, v] of [[o.x0, o.y0], [o.x1, o.y0], [o.x0, o.y1], [o.x1, o.y1]]) {
      const lx = (u - 0.5) * veg.w, ly = (v - 0.5) * hh;
      const X = veg.x + lx * c - ly * sn, Y = veg.y + lx * sn + ly * c;
      X0 = Math.min(X0, X); X1 = Math.max(X1, X); Y0 = Math.min(Y0, Y); Y1 = Math.max(Y1, Y);
    }
    const pad = Math.max(veg.w, hh) * 0.08 + 6;
    X0 -= pad; Y0 = Math.max(VY - 420, Y0 - pad); X1 += pad + 10; Y1 = Math.min(VY + 427, Y1 + pad + 14);
    const list = segs.map((g) => {
      const xs = [g.l.x + Math.tan(g.l.a) * (Y0 - VY), g.l.x + Math.tan(g.l.a) * (Y1 - VY), g.r.x + Math.tan(g.r.a) * (Y0 - VY), g.r.x + Math.tan(g.r.a) * (Y1 - VY)];
      const x0 = Math.max(X0, Math.min(...xs) - 2), x1 = Math.min(X1, Math.max(...xs) + 10);
      if (x1 <= x0) return null;
      const out = [];
      for (let pass = 0; pass < 2; pass++) {
        const cv = canvas2d((x1 - x0) * px, (Y1 - Y0) * px), x = cv.getContext('2d');
        x.scale(cv.width / (x1 - x0), cv.height / (Y1 - Y0));
        x.translate(-x0, -Y0);
        segPath(x, g, pass === 0 ? 4 : 0, pass === 0 ? 7 : 0);
        x.clip();
        if (pass === 0) shadow(x, veg.name, veg.x, veg.y, veg.w, hh, 0, veg.rot, 1, 1, 0.5, 0.5, 1);
        else spr(x, veg.name, veg.x, veg.y, veg.w, { rot: veg.rot, shadow: false });
        out.push(cv);
      }
      return { x0, y0: Y0, w: x1 - x0, h: Y1 - Y0, c: out };
    });
    stripCache = { key, veg, list };
    return list;
  }

  function drawVeg(ctx) {
    if (!veg) return;
    const sl = veg.slide;
    const list = stripSprites(bucket(pxScale(ctx), 0.25, 8));
    // pass 1: shadows of all strips; pass 2: the strips
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < segs.length; i++) {
        const g = segs[i], sp = list[i];
        if (g.alpha <= 0.01 || !sp) continue;
        ctx.save();
        ctx.globalAlpha = g.alpha;
        ctx.translate(g.cx + g.dx + sl, VY + g.dy);
        ctx.rotate(g.rot);
        const sc = (1 + g.pop) * (1 + g.sq.x * 0.03);
        ctx.scale(sc, sc);
        ctx.translate(-g.cx, -VY);
        ctx.drawImage(sp.c[pass], sp.x0, sp.y0, sp.w, sp.h);
        ctx.restore();
      }
    }
  }

  return {
    enter() {
      bubbles.setHomes(T.F.bub);
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
      applyT(ctx, T);
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
      ctx.save();
      applyT(ctx, T);
      spr(ctx, 'knife', knife.x, knife.y, 620, { rot: knife.rot, h: knife.h + bob, sa: 0.9 });
      ctx.restore();
    },
    down() {
      if (!accepting || !veg) return;
      if (queue < 2) queue++;
      if (!chopping) chop();
    },
  };
}
