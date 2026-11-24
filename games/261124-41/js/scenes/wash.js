// wash — rub the mud off the carrot and a potato in a bowl of living water.
import { TAU, rnd, ease, Spring, clamp, lerp, dist, canvas2d } from '../engine.js';
import { spr, backdrop } from '../sprite.js';
import { img, size, geo } from '../assets.js';
import { fx, hint, softBlob } from '../fx.js';
import { bubbles } from '../bubbles.js';
import { snd } from '../snd.js';
import { game, phase, wait, anim } from '../game.js';

import { frame } from '../layout.js';

const BOWL_W = 860;
let BOWL = { x: 500, y: 560, w: BOWL_W };
let BRUSH = 60;
let ITEMS = [];

// bowl fills the short side; washed vegetables go to slots in the free band
function plan() {
  const s0 = size('bowl_water');
  const F = frame({ w: BOWL_W, h: BOWL_W * s0.h / s0.w }, ['carrot', 'potato'], { sec: 250, minSec: 215 });
  BOWL = { x: F.px, y: F.py, w: BOWL_W * F.k };
  const K = BOWL.w / 720;
  BRUSH = 58 * K;
  const side = F.mode === 'side', c = F.slots.carrot, p = F.slots.potato;
  ITEMS = [
    { name: 'carrot', w: 560 * K, rot: -0.12, cleanX: c.x, cleanY: c.y, cleanW: c.s * (side ? 1.25 : 1.7), cleanRot: side ? -1.25 : 0.04 },
    { name: 'potato', w: 230 * K, rot: 0.35, cleanX: p.x, cleanY: p.y, cleanW: p.s * 0.6, cleanRot: 1.3 },
  ];
  return F;
}

function makeDirt(name) {
  const s = size(name);
  const cw = 360, ch = Math.round(cw * s.h / s.w);
  const c = canvas2d(cw, ch), x = c.getContext('2d');
  const browns = ['94,62,32', '110,74,40', '78,52,28', '125,88,52', '68,46,26'];
  for (let i = 0; i < 520; i++) {
    const r = rnd.range(4, 26) * (cw / 360);
    x.fillStyle = `rgba(${rnd.pick(browns)},${rnd.range(0.35, 0.85)})`;
    x.beginPath(); x.ellipse(rnd() * cw, rnd() * ch, r, r * rnd.range(0.5, 1), rnd() * TAU, 0, TAU); x.fill();
  }
  for (let i = 0; i < 260; i++) {
    x.fillStyle = `rgba(${rnd.pick(browns)},${rnd.range(0.6, 1)})`;
    x.beginPath(); x.arc(rnd() * cw, rnd() * ch, rnd.range(1, 3), 0, TAU); x.fill();
  }
  // the carrot's leaves stay clean: only the root counts as dirt to rub off
  if (name === 'carrot') x.clearRect(geo('carrot', 'body', { x1: 0.7 }).x1 * cw + 6, 0, cw, ch);
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(img(name), 0, 0, cw, ch);
  return c;
}

export default function wash() {
  let t = 0;
  const water = { tint: 0, ripples: [], speed: 0 };
  const loop = snd.loop('water');
  const done = [];       // cleaned vegetables lying at the top edge
  let cur = null;        // vegetable being washed
  let idx = 0;
  let lastP = null, scrubT = 0, measureT = 0;
  const sample = canvas2d(32, 32);
  const sx = sample.getContext('2d', { willReadFrequently: true });
  let brush = null;

  const inner = () => {
    const g = geo('bowl_water', 'inner', { cx: 0.5, cy: 0.5, r: 0.4 });
    const bh = BOWL.w * size('bowl_water').h / size('bowl_water').w;
    return { x: BOWL.x + (g.cx - 0.5) * BOWL.w, y: BOWL.y + (g.cy - 0.5) * bh, r: g.r * BOWL.w * 0.84 };  // water line sits a little below the rim
  };

  function measure() {
    sx.clearRect(0, 0, 32, 32);
    sx.drawImage(cur.dirt, 0, 0, 32, 32);
    const d = sx.getImageData(0, 0, 32, 32).data;
    let s = 0;
    for (let i = 3; i < d.length; i += 4) s += d[i];
    return s;
  }

  async function bring(i) {
    const it = ITEMS[i];
    const c = inner();
    cur = { ...it, x: c.x - c.r * 2.2, y: c.y + 30, h: 160, bobT: rnd() * 5, sq: new Spring(200, 8), dirt: makeDirt(it.name), dirtA: 1, clean: false, glint: -1 };
    cur.total = measure();
    phase(i === 0 ? 'wash-carrot-enter' : 'wash-potato-enter');
    game.block = true;
    const x0 = cur.x;
    await anim(0.8, (k) => { cur.x = lerp(x0, c.x, k); cur.h = 160 * (1 - k) + Math.sin(k * Math.PI) * 60; }, ease.outCubic);
    cur.h = 0;
    snd.sfx('splash');
    cur.sq.kick(4);
    addRipple(cur.x, cur.y, 1.6);
    fx.drops(cur.x, cur.y, 14, 'rgba(215,235,250,0.9)', 320);
    game.block = false;
    phase(i === 0 ? 'wash-carrot' : 'wash-potato');
    hint.set({ type: 'rub', x: () => cur.x - (it.name === 'carrot' ? it.w * 0.06 : 0), y: () => cur.y, r: it.name === 'carrot' ? it.w * 0.32 : it.w * 0.62 });
  }

  function addRipple(x, y, big = 1) { water.ripples.push({ x, y, age: 0, big }); if (water.ripples.length > 18) water.ripples.shift(); }

  function onVeg(p) {
    const s = size(cur.name);
    const h = cur.w * s.h / s.w;
    const dx = p.x - cur.x, dy = p.y - cur.y;
    const c = Math.cos(-cur.rot), sn = Math.sin(-cur.rot);
    const lx = dx * c - dy * sn, ly = dx * sn + dy * c;
    return { lx, ly, h, hit: Math.abs(lx) < cur.w / 2 + 40 && Math.abs(ly) < h / 2 + 50 };
  }

  function erase(a, b) {
    const s = size(cur.name);
    const hh = cur.w * s.h / s.w;
    const cw = cur.dirt.width, ch = cur.dirt.height;
    const x = cur.dirt.getContext('2d');
    if (!brush) brush = softBlob();
    x.save();
    x.globalCompositeOperation = 'destination-out';
    const n = Math.max(1, Math.ceil(dist(a.lx, a.ly, b.lx, b.ly) / (BRUSH * 0.3)));
    const r = (BRUSH / cur.w) * cw * 1.2;
    for (let i = 1; i <= n; i++) {
      const lx = lerp(a.lx, b.lx, i / n), ly = lerp(a.ly, b.ly, i / n);
      const px = (lx / cur.w + 0.5) * cw, py = (ly / hh + 0.5) * ch;
      x.globalAlpha = 0.55;
      x.drawImage(brush, px - r, py - r, r * 2, r * 2);
    }
    x.restore();
  }

  async function cleaned() {
    const v = cur;
    v.clean = true;
    hint.clear();
    game.block = true;
    loop.set(0, 0.3);
    phase('clean');
    anim(0.35, (k) => { v.dirtA = 1 - k; });
    snd.sfx('shine');
    fx.sparkle(v.x, v.y, 16, v.w * 0.5);
    bubbles.girl.setFace('girl_happy'); bubbles.girl.jump(0.6);
    anim(0.5, (k) => { v.glint = k; }, ease.inOutQuad, 0.1);
    await wait(0.9);
    snd.sfx('pop');
    const x0 = v.x, y0 = v.y, w0 = v.w, r0 = v.rot;
    await anim(0.7, (k) => {
      const e = ease.inOutQuad(k);
      v.x = lerp(x0, v.cleanX, e); v.y = lerp(y0, v.cleanY, e); v.w = lerp(w0, v.cleanW, e);
      v.rot = lerp(r0, v.cleanRot, e); v.h = Math.sin(k * Math.PI) * 220;
    });
    v.h = 0; v.sq.kick(3);
    snd.sfx('drop');
    fx.drops(v.x, v.y, 6, 'rgba(215,235,250,0.9)', 160);
    done.push(v); cur = null;
    bubbles.girl.setFace('girl_focus');
    idx++;
    if (idx < ITEMS.length) { await wait(0.3); bring(idx); }
    else {
      phase('done');
      await wait(0.4);
      snd.sfx('success');
      bubbles.girl.setFace('girl_happy'); bubbles.girl.jump(1);
      bubbles.mama.setFace('mama_smile'); bubbles.mama.jump(0.7);
      fx.sparkle(BOWL.x, BOWL.y, 14, BOWL.w * 0.35);
      await wait(1.4);
      game.goto('cut');
    }
  }

  function drawItem(ctx, v) {
    const s = size(v.name);
    const hh = v.w * s.h / s.w;
    const sq = v.sq.x * 0.04;
    const floating = !done.includes(v);
    const bob = floating ? Math.sin(t * 1.7 + v.bobT) * 4 : 0;
    spr(ctx, v.name, v.x, v.y + bob, v.w, { rot: v.rot + (floating ? Math.sin(t * 1.3 + v.bobT) * 0.02 : 0), h: v.h + (floating ? 26 : 0), sx: 1 + sq, sy: 1 - sq, sa: floating ? 0.55 : 1 });
    const k = 1 + v.h / 1400;
    ctx.save();
    ctx.translate(v.x, v.y + bob);
    ctx.rotate(v.rot + (floating ? Math.sin(t * 1.3 + v.bobT) * 0.02 : 0));
    ctx.scale((1 + sq) * k, (1 - sq) * k);
    if (v.dirtA > 0) { ctx.globalAlpha = v.dirtA; ctx.drawImage(v.dirt, -v.w / 2, -hh / 2, v.w, hh); ctx.globalAlpha = 1; }
    if (v.glint >= 0 && v.glint < 1) {
      // glint: a bright diagonal band masked by the vegetable's own silhouette
      const gc = glintCanvas(v.dirt.width, v.dirt.height);
      const gx = gc.getContext('2d');
      gx.globalCompositeOperation = 'copy';
      gx.drawImage(img(v.name), 0, 0, gc.width, gc.height);
      gx.globalCompositeOperation = 'source-in';
      const p = (v.glint * 1.6 - 0.3) * gc.width;
      // brief, narrow glint: the vegetable must keep its own vivid colour
      const g = gx.createLinearGradient(p - 26, 0, p + 26, gc.height * 0.25);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      gx.fillStyle = g; gx.fillRect(0, 0, gc.width, gc.height);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(gc, -v.w / 2, -hh / 2, v.w, hh);
    }
    ctx.restore();
  }

  return {
    enter() {
      bubbles.setHomes(plan().bub);
      bubbles.mama.show('mama_smile'); bubbles.girl.show('girl_focus');
      bring(0);
    },
    exit() { loop.stop(0.3); },
    update(dt) {
      t += dt; scrubT -= dt; measureT -= dt;
      if (cur) cur.sq.update(dt);
      for (const v of done) v.sq.update(dt);
      for (let i = water.ripples.length - 1; i >= 0; i--) { water.ripples[i].age += dt; if (water.ripples[i].age > 1.4) water.ripples.splice(i, 1); }
      water.speed *= Math.pow(0.02, dt);
      if (cur && !cur.clean && measureT <= 0 && lastP) {
        measureT = 0.25;
        const left = measure() / Math.max(1, cur.total);
        water.tint = Math.max(water.tint, (idx + (1 - left)) * 0.5);
        if (left <= 0.15) cleaned();
      }
    },
    draw(ctx) {
      backdrop(ctx, 'bg_counter', 500, 500, 1600);
      spr(ctx, 'bowl_water', BOWL.x, BOWL.y, BOWL.w, { sa: 1 });
      const c = inner();
      ctx.save();
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.clip();
      // water body: cool translucent fill + faint mud tint picked up from washing
      ctx.drawImage(waterBody(), c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
      if (water.tint > 0) { ctx.fillStyle = `rgba(140,100,55,${0.16 * water.tint})`; ctx.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2); }
      if (cur) drawItem(ctx, cur);
      drawWater(ctx, c, t, water);
      ctx.restore();
      // meniscus: bright water line against the bowl wall
      ctx.strokeStyle = 'rgba(235,248,255,0.55)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r - 2, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r - 8, Math.PI * 0.95, Math.PI * 1.55); ctx.stroke();
      for (const v of done) drawItem(ctx, v);
    },
    drawTop(ctx) { if (cur && cur.h > 40) drawItem(ctx, cur); },
    down(p) { lastP = null; this.move(p, true); },
    move(p, first) {
      const c = inner();
      const inWater = dist(p.x, p.y, c.x, c.y) < c.r;
      const sp = lastP ? dist(p.x, p.y, lastP.x, lastP.y) / Math.max(0.008, p.t - lastP.t) : 0;
      water.speed = Math.max(water.speed * 0.8, sp);
      if (cur && !cur.clean && !game.block) {
        const a = onVeg(p);
        if (a.hit) {
          const prev = lastP && lastP.veg ? lastP.veg : a;
          erase(prev, a);
          if (!first && sp > 60) hint.progress();
          if (scrubT <= 0 && (first || sp > 80)) { scrubT = 0.12; snd.sfx('scrub', { vol: 0.8 }); }
          if (rnd() < 0.35) fx.bubbles(p.x, p.y, 1, 20);
          if (rnd() < 0.2) fx.drops(p.x, p.y, 2, 'rgba(215,235,250,0.9)', 160);
          loop.set(clamp(sp / 1400, 0.15, 1), 0.08);
          if (first) cur.sq.kick(1);
          lastP = { x: p.x, y: p.y, t: p.t, veg: a };
          if (rnd() < 0.15) addRipple(p.x, p.y, 0.6);
          return;
        }
      }
      if (inWater) {
        if (first || rnd() < 0.12) { addRipple(p.x, p.y, 1); }
        if (first) { snd.sfx('bubble'); fx.bubbles(p.x, p.y, 3, 20); }
        loop.set(clamp(sp / 2000, 0.1, 0.7), 0.1);
      }
      lastP = { x: p.x, y: p.y, t: p.t, veg: null };
    },
    up() { lastP = null; loop.set(0, 0.35); measureT = 0; },
  };
}

// water body gradient, rendered once in a unit square
let WB = null;
function waterBody() {
  if (WB) return WB;
  const N = 512, r = N / 2;
  WB = canvas2d(N, N);
  const x = WB.getContext('2d');
  const wg = x.createRadialGradient(r - r * 0.3, r - r * 0.3, r * 0.1, r, r, r);
  wg.addColorStop(0, 'rgba(170,215,235,0.28)'); wg.addColorStop(1, 'rgba(90,150,190,0.42)');
  x.fillStyle = wg; x.fillRect(0, 0, N, N);
  return WB;
}

let GC = null;
function glintCanvas(w, h) {
  if (!GC || GC.width !== w || GC.height !== h) GC = canvas2d(w, h);
  return GC;
}

// caustic highlights and ripple rings, already clipped to the water circle
function drawWater(ctx, c, t, water) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const blob = softBlob();
  for (let i = 0; i < 9; i++) {
    const a = t * (0.15 + i * 0.03) + i * 2.1;
    const rr = c.r * (0.25 + 0.5 * ((i * 0.37) % 1));
    const x = c.x + Math.cos(a) * rr, y = c.y + Math.sin(a * 1.3) * rr * 0.8;
    const s = c.r * (0.22 + 0.08 * Math.sin(t * 0.8 + i));
    ctx.globalAlpha = 0.07 + 0.04 * Math.sin(t * 1.3 + i * 1.7);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(1.8, 0.5);
    ctx.drawImage(blob, -s, -s, s * 2, s * 2);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  for (const r of water.ripples) {
    const k = r.age / 1.4;
    for (let j = 0; j < 2; j++) {
      const kk = k - j * 0.12;
      if (kk <= 0) continue;
      ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - kk) * r.big})`;
      ctx.lineWidth = 3 * (1 - kk) + 1;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, 14 + kk * 160 * r.big, (14 + kk * 160 * r.big) * 0.92, 0, 0, TAU); ctx.stroke();
    }
  }
  ctx.restore();
}
