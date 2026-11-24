// eat — six spoonfuls, Mama and the girl in turns; Mama's first bite is the emotional peak.
import { TAU, rnd, ease, lerp, Spring } from '../engine.js';
import { spr } from '../sprite.js';
import { img, size, geo } from '../assets.js';
import { fx, hint } from '../fx.js';
import { bubbles } from '../bubbles.js';
import { snd } from '../snd.js';
import { game, phase, wait, anim } from '../game.js';
import { createPlate, drawPlate, startEating, bite, wipe } from '../plate.js';
import { serveLayout, SHAPES, drawTable } from './serve.js';
import { safe, M } from '../layout.js';

// big bubbles (≈360) at the table: above the plate side by side in portrait, left/right of it in landscape
export function eatLayout() {
  const E = safe();
  const out = {};
  if (E.h >= E.w) {
    const d = Math.min(360, (E.w - 3 * M) / 2);
    const pw = Math.min(780, E.w - 2 * M - 150, E.h - d - 3 * M);
    const group = d + M + pw;
    const y0 = E.y0 + Math.max(M, (E.h - group) / 2);
    out.seats = { mama: { x: E.cx - d / 2 - M / 2, y: y0 + d / 2, d }, girl: { x: E.cx + d / 2 + M / 2, y: y0 + d / 2, d } };
    out.plate = { x: E.cx, y: y0 + d + M + pw / 2, w: pw };
    out.spoon = { x: Math.min(E.x1 - M - 40, E.cx + pw / 2 + 75), y: out.plate.y + pw * 0.12, rot: 0.12, w: 66 * pw / 600 };
  } else {
    const pw = Math.max(560, Math.min(780, E.h - 2 * M, E.w - 2 * (360 + 2 * M)));
    const band = (E.w - pw) / 2;
    const d = Math.min(360, band - 2 * M);
    out.plate = { x: E.cx, y: E.cy, w: pw };
    out.seats = { mama: { x: E.x0 + band / 2, y: E.cy - pw * 0.12, d }, girl: { x: E.x1 - band / 2, y: E.cy - pw * 0.12, d } };
    out.spoon = { x: E.x1 - band / 2, y: Math.min(E.y1 - 150, out.seats.girl.y + d / 2 + M + 130), rot: 0.12, w: Math.min(78, band * 0.25) * pw / 600 * 1.2 };
  }
  return out;
}

// bite spots (normalised plate coords); the topping eaten with that bite
const BITES = [
  { who: 'mama', nx: 0.45, ny: 0.45, food: 'mix' },
  { who: 'girl', nx: 0.32, ny: 0.66, food: 'tex_rice' },
  { who: 'mama', nx: 0.6, ny: 0.32, food: 'tex_curry', top: 'carrot_flower' },
  { who: 'girl', nx: 0.72, ny: 0.47, food: 'tex_curry', top: 'carrot_star' },
  { who: 'mama', nx: 0.63, ny: 0.6, food: 'mix', top: 'carrot_heart' },
  { who: 'girl', nx: 0.42, ny: 0.74, food: 'tex_rice', last: true },
];

export function setupPlate(carry) {
  if (carry && carry.plate) return carry.plate;
  const SL = serveLayout();
  const p = createPlate(SL.plate.x, SL.plate.y, SL.plate.w);
  p.state = 'full';
  for (const s of SHAPES) p.shapes.push({ name: s.name, nx: s.ax, ny: s.ay, w: 80 * SL.plate.w / 640, rot: s.rot, h: 0, a: 1 });
  return p;
}

export default function eat(carry) {
  let steamT = 0;
  const plate = setupPlate(carry);
  const EL = eatLayout();
  const SPOON_REST = (carry && carry.spoon) || serveLayout().spoon;
  const SPOON_EAT = EL.spoon, SEATS = EL.seats;
  const spoon = { x: 0, y: 0, rot: SPOON_REST.rot, w: SPOON_REST.w, h: 0, a: 1, heap: null, top: null, sc: 1, flying: false };
  let n = 0, busy = true;
  const psq = new Spring(260, 10);
  let food = 1;

  // spoon is drawn with its bowl ("head") at x,y
  function headOffset(rot, w, h) {
    const s = size('spoon'), H = w * s.h / s.w;
    const hd = geo('spoon', 'head', { x: 0.5, y: 0.14 });
    const ox = (hd.x - 0.5) * w, oy = (hd.y - 0.5) * H;
    const k = 1 + h / 1400;
    const c = Math.cos(rot), sn = Math.sin(rot);
    return { x: (ox * c - oy * sn) * k, y: (ox * sn + oy * c) * k, H };
  }

  // rest positions are sprite centres; spoon.x/y is the bowl
  function restHead(b) { const o = headOffset(b.rot, b.w, 0); return { x: b.x + o.x, y: b.y + o.y }; }
  Object.assign(spoon, restHead(SPOON_REST));

  async function enter() {
    game.block = true;
    phase('eat-setup');
    const m = bubbles.mama, g = bubbles.girl;
    m.place(SEATS.mama, 0.9); g.place(SEATS.girl, 0.9);
    const x0 = plate.x, y0 = plate.y, w0 = plate.w;
    const s0 = { x: spoon.x, y: spoon.y, w: spoon.w }, s1 = restHead(SPOON_EAT);
    await anim(0.9, (k) => {
      plate.x = lerp(x0, EL.plate.x, k); plate.y = lerp(y0, EL.plate.y, k); plate.w = lerp(w0, EL.plate.w, k);
      spoon.x = lerp(s0.x, s1.x, k); spoon.y = lerp(s0.y, s1.y, k); spoon.w = lerp(s0.w, SPOON_EAT.w, k);
    }, ease.inOutCubic);
    startEating(plate);
    turn();
  }

  function turn() {
    const b = BITES[n];
    const who = bubbles[b.who];
    who.setFace(b.who === 'mama' ? 'mama_aan' : 'girl_wow');
    who.talk(0.8);
    snd.sfx(b.who, { mood: 'happy' });
    busy = false;
    game.block = false;
    phase('bite-' + (n + 1) + '-' + b.who);
    hint.set({ type: 'tap', x: plate.x, y: plate.y, r: plate.w * 0.4 });
  }

  async function doBite() {
    busy = true;
    hint.clear();
    game.block = true;
    const b = BITES[n];
    const who = bubbles[b.who];
    const tx = plate.x + (b.nx - 0.5) * plate.w, ty = plate.y + (b.ny - 0.5) * plate.h();
    spoon.flying = true;
    // to the plate
    const x0 = spoon.x, y0 = spoon.y, r0 = spoon.rot;
    const dipRot = -0.5;
    await anim(0.35, (k) => {
      spoon.x = lerp(x0, tx, k); spoon.y = lerp(y0, ty, k); spoon.rot = lerp(r0, dipRot, k);
      spoon.h = Math.sin(k * Math.PI) * 120 + 20 * k;
    }, ease.inOutCubic);
    snd.sfx('spoon');
    await anim(0.12, (k) => { spoon.h = 20 * (1 - k); }, ease.inQuad);
    if (b.last) {
      bite(plate, b.nx, b.ny, 1.2);
      anim(0.4, () => wipe(plate, 0.25));
    } else bite(plate, b.nx, b.ny);
    food = Math.max(0, food - 1 / 6);
    if (b.top) { const s = plate.shapes.find((q) => q.name === b.top); if (s) s.a = 0; }
    psq.kick(2);
    spoon.heap = b.food; spoon.top = b.top || null;
    fx.specks(tx, ty, 4, 'rgba(160,90,30,0.7)', 150, 5);
    // up to the eater
    const x1 = spoon.x, y1 = spoon.y, r1 = spoon.rot;
    const toRot = b.who === 'mama' ? -0.9 : 0.6;
    await anim(0.55, (k) => {
      const q = who.pos();
      spoon.x = lerp(x1, q.x + q.d * (b.who === 'mama' ? 0.1 : -0.1), k); spoon.y = lerp(y1, q.y + q.d * 0.33, k);
      spoon.rot = lerp(r1, toRot, k); spoon.h = Math.sin(k * Math.PI) * 200 + k * 60;
    }, ease.inOutCubic);
    // into the mouth
    await anim(0.18, (k) => { spoon.sc = 1 - k * 0.6; spoon.a = 1 - k; }, ease.inQuad);
    spoon.heap = null; spoon.top = null;
    who.squash(1.4);
    snd.sfx('munch');
    who.setFace(b.who === 'mama' ? 'mama_smile' : 'girl_happy', false);
    who.talk(0.5);
    await wait(0.55);
    if (b.who === 'mama' && n === 0) {
      // the peak: tired Mama is full of energy again
      phase('mama-first-bite');
      who.setFace('mama_wow');
      who.jump(1.6);
      snd.sfx('sparkle');
      snd.sfx('mama', { mood: 'wow' });
      // she grows ~25 % for this beat; rays, sparkles and hearts stay outside her face
      anim(0.35, (k) => { who.boost = 0.25 * k; }, ease.outBack);
      anim(0.4, (k) => { who.glow = k; });
      game.clock.after(0.15, () => { bubbles.rays('mama'); bubbles.sparkle('mama', 22); });
      for (let i = 0; i < 3; i++) game.clock.after(0.3 + i * 0.25, () => { bubbles.hearts('mama', 1, 1.5); snd.sfx('heart', { pitch: 1 + i * 0.1 }); });
      await wait(1.4);
      snd.sfx('yum');
      who.setFace('mama_laugh');
      who.jump(0.8);
      await wait(0.6);
      anim(0.6, (k) => { who.boost = 0.25 * (1 - k); }, ease.inOutQuad);
      await wait(0.4);
      anim(1.2, (k) => { who.glow = 1 - k * 0.6; });
    } else {
      snd.sfx('yum');
      snd.sfx(b.who, { mood: 'yum' });
      who.setFace(b.who === 'mama' ? 'mama_laugh' : 'girl_happy');
      who.jump(0.7);
      bubbles.hearts(b.who, 2);
      bubbles.sparkle(b.who, 8);
      await wait(0.6);
    }
    // spoon reappears at rest
    Object.assign(spoon, restHead(SPOON_EAT)); spoon.rot = SPOON_EAT.rot; spoon.h = 0; spoon.sc = 1; spoon.flying = false;
    anim(0.3, (k) => { spoon.a = k; });
    n++;
    if (n < BITES.length) { await wait(0.3); turn(); }
    else finish();
  }

  async function finish() {
    phase('clean-plate');
    plate.eaten = null;
    plate.shapes = [];
    await wait(0.3);
    snd.sfx('shine');
    await anim(0.9, (k) => { plate.glint = k; }, ease.inOutQuad);
    plate.glint = -1;
    fx.sparkle(plate.x, plate.y, 14, plate.w * 0.4);
    await wait(0.6);
    game.goto('end', { fade: false, carry: { plate } });
  }

  function drawSpoonNow(ctx) {
    if (spoon.a <= 0.01) return;
    const o = headOffset(spoon.rot, spoon.w * spoon.sc, spoon.h);
    // spoon anchored so the head sits at spoon.x/y
    spr(ctx, 'spoon', spoon.x - o.x, spoon.y - o.y, spoon.w * spoon.sc, { rot: spoon.rot, h: spoon.h, alpha: spoon.a });
    if (spoon.heap) {
      const k = (1 + spoon.h / 1400) * spoon.sc;
      const rx = spoon.w * 0.36 * k, ry = spoon.w * 0.42 * k;
      ctx.save();
      ctx.translate(spoon.x, spoon.y + 4 * k);
      ctx.rotate(spoon.rot);
      ctx.globalAlpha = spoon.a;
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.clip();
      const draw = (name, x0) => { const z = img(name); ctx.drawImage(z, x0, -ry, rx * 2, ry * 2); };
      if (spoon.heap === 'mix') { draw('tex_rice', -rx * 2); ctx.save(); ctx.beginPath(); ctx.rect(-rx * 0.1, -ry, rx * 1.2, ry * 2); ctx.clip(); draw('tex_curry', -rx); ctx.restore(); draw('tex_rice', -rx * 1.1 - rx); }
      else draw(spoon.heap, -rx);
      const g = ctx.createRadialGradient(-rx * 0.3, -ry * 0.3, 0, 0, 0, rx * 1.1);
      g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(60,30,10,0.35)');
      ctx.fillStyle = g; ctx.fillRect(-rx, -ry, rx * 2, ry * 2);
      ctx.restore();
      if (spoon.top) spr(ctx, spoon.top, spoon.x, spoon.y, spoon.w * 0.62 * k, { rot: spoon.rot, alpha: spoon.a, sa: 0.6 });
    }
  }

  return {
    enter() {
      if (!carry) bubbles.setHomes(serveLayout().F.bub);
      bubbles.mama.show('mama_smile'); bubbles.girl.show('girl_smile');
      enter();
    },
    update(dt) {
      psq.update(dt); plate.sq = psq.x;
      steamT -= dt;
      if (steamT <= 0 && food > 0.2) { steamT = 0.3; fx.steam(plate.x + rnd.range(-0.2, 0.2) * plate.w, plate.y + rnd.range(-0.15, 0.15) * plate.w, { size: plate.w * 0.075, alpha: 0.28 * food, life: 2 }); }
    },
    draw(ctx) {
      drawTable(ctx);
      drawPlate(ctx, plate);
      if (!spoon.flying) drawSpoonNow(ctx);
    },
    drawOverlay(ctx) { if (spoon.flying) drawSpoonNow(ctx); },
    down() { if (!busy) doBite(); },
  };
}
