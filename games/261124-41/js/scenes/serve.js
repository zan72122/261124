// serve — rice from the paddle, curry from the ladle, carrot shapes on top, then "itadakimasu".
import { rnd, ease, lerp, dist, minHit, Spring } from '../engine.js';
import { spr, backdrop } from '../sprite.js';
import { fx, hint } from '../fx.js';
import { bubbles } from '../bubbles.js';
import { snd } from '../snd.js';
import { game, phase, wait, anim } from '../game.js';
import { createPlate, drawPlate } from '../plate.js';

export const PLATE_SERVE = { x: 500, y: 500, w: 640 };
export const SPOON_REST = { x: 905, y: 540, rot: 0.12, w: 78 };
export const SHAPES = [
  // placed exactly on the bite spots that will eat them (see eat.js BITES)
  { name: 'carrot_flower', ax: 0.6, ay: 0.32, rot: 0.3 },
  { name: 'carrot_star', ax: 0.72, ay: 0.47, rot: -0.2 },
  { name: 'carrot_heart', ax: 0.63, ay: 0.6, rot: 0.15 },
];

export function drawTable(ctx) {
  backdrop(ctx, 'bg_table', 500, 500, 1500, { vig: 0.3 });
}

export function drawSpoon(ctx, x, y, rot, w, o = {}) {
  spr(ctx, 'spoon', x, y, w, Object.assign({ rot }, o));
}

export default function serve() {
  let steamT = 0, steaming = false;
  const plate = createPlate(PLATE_SERVE.x, PLATE_SERVE.y, PLATE_SERVE.w);
  const psq = new Spring(260, 10);
  const tools = {
    shamoji: { name: 'shamoji_rice', rx: 165, ry: 820, rrot: -0.55, w: 150, x: 165, y: 820, rot: -0.55, h: 0, a: 1, used: false },
    ladle: { name: 'ladle_curry', rx: 830, ry: 840, rrot: 0, w: 300, x: 830, y: 840, rot: 0, h: 0, a: 1, used: false },
  };
  let step = 'rice', held = null;

  function setHint() {
    const tl = step === 'rice' ? tools.shamoji : tools.ladle;
    const tp = plate.pt(step === 'rice' ? 'rice' : 'curry');
    hint.set({ type: 'drag', x: tl.x, y: tl.y, x2: tp.x, y2: tp.y, r: 110 });
  }

  async function use(tl, kind) {
    if (tl.used) return;
    tl.used = true; held = null;
    hint.clear();
    game.block = true;
    const tp = plate.pt(kind);
    const x0 = tl.x, y0 = tl.y, r0 = tl.rot, h0 = tl.h;
    const over = kind === 'rice' ? { x: tp.x + 10, y: tp.y + 40, rot: -0.3 } : { x: tp.x + 70, y: tp.y + 40, rot: -0.5 };
    await anim(0.45, (k) => { tl.x = lerp(x0, over.x, k); tl.y = lerp(y0, over.y, k); tl.rot = lerp(r0, over.rot, k); tl.h = lerp(h0, 110, k) + Math.sin(k * Math.PI) * 80; }, ease.inOutCubic);
    if (kind === 'rice') {
      phase('rice');
      await anim(0.15, (k) => { tl.h = 110 - 70 * k; tl.rot = over.rot - k * 0.5; }, ease.inQuad);
      snd.sfx('rice');
      plate.reveal = { layer: 'plate_rice', kind: 'rice', nx: tp.nx, ny: tp.ny, k: 0 };
      await anim(0.35, (k) => { plate.reveal.k = k; }, ease.outCubic);
      plate.state = 'rice'; plate.reveal = null;
      psq.kick(4);
      fx.sparkle(tp.x, tp.y, 8, 100);
    } else {
      phase('curry');
      snd.sfx('pour');
      await anim(0.3, (k) => { tl.rot = over.rot - k * 0.9; tl.h = 110 - 40 * k; }, ease.inOutQuad);
      plate.reveal = { layer: 'plate_full', kind: 'curry', nx: tp.nx, ny: tp.ny, k: 0 };
      await anim(0.9, (k) => { plate.reveal.k = k; }, ease.inOutSine);
      plate.state = 'full'; plate.reveal = null;
      psq.kick(3);
      steaming = true;
    }
    // tool flies away
    const x1 = tl.x, y1 = tl.y, h1 = tl.h, rr = tl.rot;
    const away = kind === 'rice' ? { x: -250, y: 1150 } : { x: 1250, y: 1150 };
    anim(0.5, (k) => { tl.x = lerp(x1, away.x, k); tl.y = lerp(y1, away.y, k); tl.h = h1 + k * 100; tl.rot = rr + k * 0.4; tl.a = 1 - k; }, ease.inCubic);
    await wait(0.4);
    if (kind === 'rice') {
      bubbles.girl.setFace('girl_happy'); bubbles.girl.jump(0.6);
      step = 'curry'; game.block = false; phase('serve-curry'); setHint();
    } else {
      await shapesDrop();
    }
  }

  async function shapesDrop() {
    phase('toppings');
    for (const s of SHAPES) {
      const sh = { name: s.name, nx: s.ax, ny: s.ay, w: 64, rot: s.rot, h: 300, a: 1 };
      plate.shapes.push(sh);
      await anim(0.3, (k) => { sh.h = 300 * (1 - k); }, ease.inQuad);
      sh.h = 0;
      snd.sfx('pop', { pitch: 1.1 });
      const px = plate.x + (sh.nx - 0.5) * plate.w, py = plate.y + (sh.ny - 0.5) * plate.h();
      fx.sparkle(px, py, 6, 40);
      await wait(0.15);
    }
    snd.sfx('success');
    bubbles.mama.setFace('mama_wow'); bubbles.mama.jump(0.8);
    bubbles.girl.setFace('girl_happy'); bubbles.girl.jump(1);
    await wait(1.3);
    // itadakimasu: both bow
    phase('itadakimasu');
    snd.sfx('clap');
    bubbles.mama.setFace('mama_smile'); bubbles.girl.setFace('girl_smile');
    await anim(0.35, (k) => { bubbles.mama.bow = k; bubbles.girl.bow = k; }, ease.inOutQuad);
    await wait(0.35);
    await anim(0.35, (k) => { bubbles.mama.bow = 1 - k; bubbles.girl.bow = 1 - k; }, ease.inOutQuad);
    await wait(0.3);
    game.goto('eat', { fade: false, carry: { plate } });
  }

  return {
    enter() {
      bubbles.mama.show('mama_smile'); bubbles.girl.show('girl_smile');
      phase('serve-rice');
      setHint();
    },
    update(dt) {
      psq.update(dt); plate.sq = psq.x;
      if (steaming) {
        steamT -= dt;
        if (steamT <= 0) { steamT = 0.2; const c = plate.pt('curry'); fx.steam(c.x + rnd.range(-80, 80), c.y + rnd.range(-60, 60), { size: 55, alpha: 0.35, life: 2.2 }); }
      }
    },
    draw(ctx) {
      drawTable(ctx);
      drawPlate(ctx, plate);
      drawSpoon(ctx, SPOON_REST.x, SPOON_REST.y, SPOON_REST.rot, SPOON_REST.w);
      for (const k in tools) { const tl = tools[k]; if (tl.h < 40 && tl.a > 0) drawTool(ctx, tl); }
    },
    drawTop(ctx) { for (const k in tools) { const tl = tools[k]; if (tl.h >= 40 && tl.a > 0) drawTool(ctx, tl); } },
    down(p) {
      const tl = step === 'rice' ? tools.shamoji : step === 'curry' ? tools.ladle : null;
      if (!tl || tl.used) return;
      held = { tl, ox: tl.x - p.x, oy: tl.y - p.y, moved: 0, near: dist(p.x, p.y, tl.x, tl.y) < Math.max(160, minHit()) };
      if (held.near) tl.h = 40;
    },
    move(p) {
      if (!held || !held.near) return;
      const tl = held.tl;
      tl.x = p.x + held.ox; tl.y = p.y + held.oy;
      held.moved++;
      if (dist(tl.x, tl.y, plate.x, plate.y) < plate.w * 0.3) use(tl, step === 'rice' ? 'rice' : 'curry');
    },
    up() {
      if (!held) return;
      const tl = held.tl;
      held = null;
      use(tl, step === 'rice' ? 'rice' : 'curry');
    },
  };
}

function drawTool(ctx, tl) {
  spr(ctx, tl.name, tl.x, tl.y, tl.w, { rot: tl.rot, h: tl.h, alpha: tl.a });
}

