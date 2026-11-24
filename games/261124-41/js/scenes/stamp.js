// stamp — a steel cookie cutter presses carrot rounds into flowers, a star and a heart.
import { TAU, rnd, ease, Spring, lerp, dist, minHit } from '../engine.js';
import { spr, drawBg, vignette } from '../sprite.js';
import { img } from '../assets.js';
import { shapePath } from '../shapes.js';
import { fx, hint } from '../fx.js';
import { bubbles } from '../bubbles.js';
import { snd } from '../snd.js';
import { game, phase, wait, anim } from '../game.js';
import { BOARD } from './cut.js';

const SIZE = 190;
const R = SIZE * 0.43;
const ORDER = ['flower', 'star', 'flower', 'heart', 'flower'];
const SPOTS = [[280, 470], [500, 455], [720, 470], [390, 705], [610, 705]];

export function drawCutter(ctx, kind, x, y, r, h, rot = 0) {
  const k = 1 + h / 1400;
  // shadow, softer and further away when lifted
  const off = 4 + h * 0.4;
  ctx.save();
  ctx.lineJoin = 'round';
  for (const [w, a] of [[30, 0.08], [20, 0.12], [12, 0.16]]) {
    ctx.strokeStyle = `rgba(20,10,0,${a / (1 + h / 160)})`;
    ctx.lineWidth = w + h * 0.06;
    ctx.beginPath(); shapePath(ctx, kind, x + off * 0.8, y + off * 1.2, r * (1 + h / 1000), rot); ctx.stroke();
  }
  ctx.translate(x, y); ctx.scale(k, k);
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, '#f4f7fa'); g.addColorStop(0.45, '#aab2ba'); g.addColorStop(0.55, '#c9d0d6'); g.addColorStop(1, '#6f777f');
  ctx.strokeStyle = '#5d646b'; ctx.lineWidth = 15;
  ctx.beginPath(); shapePath(ctx, kind, 0, 0, r, rot); ctx.stroke();
  ctx.strokeStyle = g; ctx.lineWidth = 11; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); shapePath(ctx, kind, -1.5, -1.5, r + 3, rot); ctx.stroke();
  ctx.strokeStyle = 'rgba(40,45,50,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); shapePath(ctx, kind, 0, 0, r - 5, rot); ctx.stroke();
  ctx.restore();
}

export default function stamp() {
  let t = 0;
  const rounds = SPOTS.map(([x, y], i) => ({ x, y, name: 'carrot_slice_' + (1 + (i % 3)), rot: rnd() * TAU, shape: null, sq: new Spring(260, 9), ring: null }));
  const cutter = { x: 500, y: 1200, h: 140, kind: 'flower' };
  let count = 0, busy = false, done = false;

  const nextRound = () => rounds.find((r) => !r.shape);

  async function press(r) {
    busy = true;
    hint.progress();
    cutter.kind = ORDER[count];
    const x0 = cutter.x, y0 = cutter.y;
    await anim(0.22, (k) => { cutter.x = lerp(x0, r.x, k); cutter.y = lerp(y0, r.y, k); }, ease.outCubic);
    await anim(0.1, (k) => { cutter.h = 140 * (1 - k); }, ease.inQuad);
    snd.sfx('stamp');
    r.shape = { kind: cutter.kind, name: 'carrot_' + cutter.kind };
    r.ring = { dx: 0, dy: 0, a: 1, dir: rnd() * TAU };
    r.sq.kick(-3);
    fx.specks(r.x, r.y, 6, 'rgba(255,140,40,0.85)', 200, 4);
    count++;
    await wait(0.08);
    anim(0.25, (k) => { cutter.h = 140 * k; }, ease.outQuad);
    // off-cut ring slides away and fades, the shape springs up
    const ring = r.ring, dir = Math.atan2(r.y - 560, r.x - 500) + rnd.range(-0.4, 0.4);
    anim(0.7, (k) => { ring.dx = Math.cos(dir) * 70 * k; ring.dy = Math.sin(dir) * 70 * k; ring.a = 1 - k; }, ease.outCubic, 0.1);
    r.sq.kick(6);
    fx.sparkle(r.x, r.y, 8, 90);
    snd.sfx('sparkle', { vol: 0.6, pitch: 1 + count * 0.06 });
    bubbles.girl.setFace(count % 2 ? 'girl_happy' : 'girl_wow');
    await wait(0.3);
    busy = false;
    const n = nextRound();
    if (n) { cutter.kind = ORDER[count]; phase('stamp-' + (count + 1)); hint.set({ type: 'tap', x: n.x, y: n.y, r: SIZE * 0.6 }); }
    else finish();
  }

  async function finish() {
    done = true;
    hint.clear();
    game.block = true;
    phase('done');
    anim(0.5, (k) => { cutter.y = lerp(cutter.y, 1300, k); cutter.h = 140 + k * 100; }, ease.inCubic);
    await wait(0.4);
    snd.sfx('sparkle');
    for (const r of rounds) fx.sparkle(r.x, r.y, 6, 80);
    await wait(0.3);
    snd.sfx('success');
    bubbles.girl.setFace('girl_wow'); bubbles.girl.jump(1);
    bubbles.mama.setFace('mama_wow'); bubbles.mama.jump(0.8);
    await wait(1.8);
    game.goto('pot');
  }

  return {
    enter() {
      bubbles.mama.show('mama_smile'); bubbles.girl.show('girl_focus');
      phase('stamp-1');
      const n = nextRound();
      anim(0.5, (k) => { cutter.x = lerp(500, n.x, k); cutter.y = lerp(1200, n.y, k); }, ease.outCubic);
      hint.set({ type: 'tap', x: n.x, y: n.y, r: SIZE * 0.6 });
    },
    update(dt) {
      t += dt;
      for (const r of rounds) r.sq.update(dt);
      if (!busy && !done) {
        const n = nextRound();
        if (n) { cutter.x = lerp(cutter.x, n.x, Math.min(1, dt * 6)); cutter.y = lerp(cutter.y, n.y, Math.min(1, dt * 6)); }
      }
    },
    draw(ctx) {
      drawBg(ctx, 'bg_counter', 500, 500, 1600);
      spr(ctx, 'board', BOARD.x, BOARD.y, BOARD.w);
      for (const r of rounds) {
        const q = r.sq.x * 0.04;
        if (!r.shape) { spr(ctx, r.name, r.x, r.y, SIZE, { rot: r.rot, sx: 1 + q, sy: 1 - q }); continue; }
        if (r.ring && r.ring.a > 0.01) {
          // round minus the cut shape, clipped from the slice photo
          ctx.save();
          ctx.globalAlpha = r.ring.a;
          ctx.translate(r.ring.dx, r.ring.dy);
          ctx.beginPath(); ctx.rect(r.x - SIZE, r.y - SIZE, SIZE * 2, SIZE * 2); shapePath(ctx, r.shape.kind, r.x, r.y, R);
          ctx.clip('evenodd');
          spr(ctx, r.name, r.x, r.y, SIZE, { rot: r.rot });
          ctx.restore();
        }
        const pop = 1 + q * 1.5;
        spr(ctx, r.shape.name, r.x, r.y, R * 2.05, { sx: pop, sy: pop, h: Math.max(0, r.sq.x * 6) });
      }
      vignette(ctx, 0.35);
    },
    drawTop(ctx) {
      if (count < ORDER.length || cutter.y < 1100) drawCutter(ctx, cutter.kind, cutter.x, cutter.y, R, cutter.h + (busy ? 0 : Math.sin(t * 3) * 8));
    },
    down(p) {
      if (busy || done) return;
      let target = null, best = 1e9;
      for (const r of rounds) {
        if (r.shape) continue;
        const d = dist(p.x, p.y, r.x, r.y);
        if (d < Math.max(SIZE * 0.65, minHit()) && d < best) { best = d; target = r; }
      }
      press(target || nextRound());
    },
  };
}

void img;
