// home — Mama comes home tired, the girl has an idea (curry!), vegetables hop out of the basket.
import { TAU, ease, Spring, lerp } from '../engine.js';
import { spr, backdrop } from '../sprite.js';
import { geo } from '../assets.js';
import { fx, hint } from '../fx.js';
import { bubbles } from '../bubbles.js';
import { snd } from '../snd.js';
import { game, phase, wait, anim } from '../game.js';

const BASKET = { x: 500, y: 540, w: 560 };

export default function home() {
  const basket = { h: 900, vis: 0, sq: new Spring(260, 12) };
  // vegetables lying in the basket (local offsets) and where they land when they hop out
  const veg = [
    { name: 'carrot', w: 400, lx: -15, ly: -55, rot: -0.35, tx: 500, ty: 875, trot: 0.06 },
    { name: 'potato', w: 150, lx: -120, ly: 85, rot: 0.5, tx: 135, ty: 600, trot: 0.25 },
    { name: 'potato', w: 140, lx: 25, ly: 120, rot: -1.1, tx: 150, ty: 805, trot: -0.4 },
    { name: 'onion', w: 175, lx: 125, ly: 35, rot: 0.3, tx: 865, ty: 700, trot: 0.2 },
  ].map((v) => Object.assign(v, { out: false, x: 0, y: 0, h: 0, sq: new Spring(260, 10), flying: false }));
  let next = 0;
  let interactive = false;

  async function script() {
    game.block = true;
    phase('mama-arrives');
    await wait(0.4);
    snd.sfx('door');
    await wait(0.8);
    snd.sfx('steps');
    await wait(0.6);
    bubbles.mama.show('mama_tired');
    bubbles.mama.droop = 1;
    await wait(0.7);
    snd.sfx('sigh');
    snd.sfx('mama', { mood: 'tired' });
    bubbles.mama.talk(1.0);
    const m = bubbles.mama.pos();
    fx.sweat(m.x + m.d * 0.42, m.y - m.d * 0.25);
    game.clock.after(1.2, () => { const q = bubbles.mama.pos(); fx.sweat(q.x + q.d * 0.45, q.y - q.d * 0.2); });
    await wait(1.1);
    phase('basket');
    basket.vis = 1;
    await anim(0.55, (k) => { basket.h = 900 * (1 - k); }, ease.inQuad);
    snd.sfx('thump');
    basket.sq.kick(5);
    fx.specks(BASKET.x, BASKET.y + 200, 6, 'rgba(160,120,70,0.5)', 160, 6);
    await wait(0.6);
    phase('girl');
    bubbles.girl.show('girl_smile');
    snd.sfx('girl', { mood: 'happy' });
    bubbles.girl.talk(0.6);
    await wait(0.9);
    snd.sfx('growl');
    bubbles.girl.wobble(1.4);
    bubbles.girl.setFace('girl_focus');
    await wait(1.4);
    phase('idea');
    snd.sfx('idea');
    bubbles.girl.setFace('girl_wow');
    bubbles.girl.jump(1);
    const g = bubbles.girl.pos();
    fx.burst(g.x - g.d * 0.3, g.y - g.d * 0.35, 70, '#fff2a0');
    fx.sparkle(g.x - g.d * 0.3, g.y - g.d * 0.35, 8, 40, 'over');
    await wait(0.25);
    bubbles.thought.show('hero_curry');
    snd.sfx('girl', { mood: 'happy' });
    bubbles.girl.talk(0.8);
    await wait(1.5);
    snd.sfx('mama', { mood: 'happy' });
    bubbles.mama.droop = 0;
    bubbles.mama.setFace('mama_smile');
    bubbles.mama.jump(0.5);
    bubbles.mama.talk(0.8);
    await wait(0.3);
    bubbles.heartBetween();
    snd.sfx('heart');
    await wait(1.6);
    bubbles.thought.hide();
    bubbles.girl.setFace('girl_smile');
    await wait(0.5);
    phase('basket-taps');
    game.block = false;
    interactive = true;
    hint.set({ type: 'tap', x: BASKET.x, y: BASKET.y, r: 220 });
  }

  async function hop(v) {
    hint.progress();
    v.out = true; v.flying = true;
    const sx = BASKET.x + v.lx, sy = BASKET.y + v.ly, r0 = v.rot;
    snd.sfx('pop', { pitch: 1 + next * 0.08 });
    basket.sq.kick(2);
    bubbles.girl.setFace('girl_happy');
    await anim(0.62, (k) => {
      const e = ease.inOutQuad(k);
      v.x = lerp(sx, v.tx, e); v.y = lerp(sy, v.ty, e);
      v.h = Math.sin(k * Math.PI) * 260;
      v.rot = lerp(r0, v.trot + TAU * (v.name === 'carrot' ? 0 : 1), e);
    });
    v.flying = false; v.h = 0;
    v.sq.kick(4);
    snd.sfx('drop');
    fx.specks(v.x, v.y, 5, 'rgba(150,110,60,0.45)', 140, 5);
  }

  async function finish() {
    game.block = true;
    hint.clear();
    phase('done');
    await wait(0.7);
    snd.sfx('success');
    bubbles.girl.jump(1); bubbles.mama.jump(0.8);
    bubbles.girl.setFace('girl_happy');
    fx.sparkle(BASKET.x, BASKET.y, 14, 200);
    await wait(1.3);
    game.goto('wash');
  }

  return {
    enter() {
      bubbles.reset();
      script();
    },
    update(dt) {
      basket.sq.update(dt);
      for (const v of veg) v.sq.update(dt);
    },
    draw(ctx) {
      backdrop(ctx, 'bg_counter', 500, 500, 1600, { tint: 'rgba(255,150,80,0.25)', vig: 0.5 });
      if (basket.vis) {
        const sq = basket.sq.x * 0.03;
        spr(ctx, 'basket', BASKET.x, BASKET.y, BASKET.w, { h: basket.h, sx: 1 + sq, sy: 1 - sq });
        // vegetables still inside, clipped to the basket's inner area
        const inn = geo('basket', 'inner', { cx: 0.5, cy: 0.5, r: 0.42 });
        const k = 1 + basket.h / 1400;
        const bh = BASKET.w * 1000 / 989;
        const icx = BASKET.x + (inn.cx - 0.5) * BASKET.w * k, icy = BASKET.y + (inn.cy - 0.5) * bh * k;
        const rx = (inn.rx || inn.r) * BASKET.w * k * 1.04, ry = (inn.ry ? inn.ry * bh : (inn.r * BASKET.w)) * k * 1.04;
        ctx.save();
        ctx.beginPath(); ctx.ellipse(icx, icy, rx, ry, 0, 0, TAU); ctx.clip();
        for (const v of veg) {
          if (v.out) continue;
          spr(ctx, v.name, BASKET.x + v.lx * k * (1 + sq), BASKET.y + v.ly * k * (1 - sq), v.w * k, { rot: v.rot, sa: 0.9 });
        }
        ctx.restore();
      }
      for (const v of veg) {
        if (!v.out || v.flying) continue;
        drawVeg(ctx, v);
      }
    },
    drawTop(ctx) {
      for (const v of veg) if (v.out && v.flying) drawVeg(ctx, v);
    },
    // any tap makes the next vegetable hop out (forgiving: no need to hit the basket)
    down() {
      if (!interactive || next >= veg.length) return;
      const v = veg[next++];
      hop(v);
      if (next >= veg.length) { interactive = false; game.clock.after(0.4, finish); }
    },
  };
}

function drawVeg(ctx, v) {
  const s = v.sq.x * 0.05;
  spr(ctx, v.name, v.x, v.y, v.w, { rot: v.rot, h: v.h, sx: 1 + s, sy: 1 - s });
}
