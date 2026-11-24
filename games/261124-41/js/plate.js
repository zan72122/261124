// plate.js — the plate with masked reveals (rice / curry) and an "eaten" mask, shared by serve, eat, end.
import { TAU, rnd, canvas2d, clamp, lerp } from './engine.js';
import { spr } from './sprite.js';
import { img, geo, size } from './assets.js';
import { softBlob } from './fx.js';

const CS = 640;

export function createPlate(x, y, w) {
  const c = canvas2d(CS, CS);
  return {
    x, y, w, state: 'empty', // empty | rice | full
    reveal: null,            // { layer: 'plate_rice'|'plate_full', k, kind }
    eaten: null,             // canvas with remaining food (eat scene)
    c, sq: 0, glint: -1,
    shapes: [],              // carrot shapes on the curry: { name, nx, ny, w, h, rot, a }
    h() { return this.w * size('plate_empty').h / size('plate_empty').w; },
    pt(key) {
      const d = key === 'rice' ? { x: 0.36, y: 0.6 } : key === 'curry' ? { x: 0.62, y: 0.4 } : { x: 0.5, y: 0.5 };
      const g = geo('plate_full', key, geo('plate_empty', key, d));
      return { x: this.x + (g.x - 0.5) * this.w, y: this.y + (g.y - 0.5) * this.h(), nx: g.x, ny: g.y };
    },
  };
}

// soft organic blob mask grown at a normalised point; spread 0..1
function blobMask(x, nx, ny, k, kind) {
  const b = softBlob();
  const cx = nx * CS, cy = ny * CS;
  const R = CS * (kind === 'rice' ? 0.42 : 0.5) * k;
  x.globalAlpha = 1;
  if (kind === 'rice') {
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU, d = R * 0.35;
      const r = R * (0.75 + 0.15 * Math.sin(i * 2.7));
      x.drawImage(b, cx + Math.cos(a) * d - r, cy + Math.sin(a) * d - r, r * 2, r * 2);
    }
  } else {
    // sauce runs out in lobes from the ladle point
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU + 0.3;
      const reach = R * (0.55 + 0.45 * ((i * 0.618) % 1));
      for (let j = 0; j < 4; j++) {
        const d = reach * (j / 4);
        const r = R * (0.5 - j * 0.06);
        x.drawImage(b, cx + Math.cos(a) * d - r, cy + Math.sin(a) * d - r, r * 2, r * 2);
      }
    }
  }
  if (k >= 1) { x.fillStyle = '#fff'; x.fillRect(0, 0, CS, CS); }
}

export function drawPlate(ctx, p, o = {}) {
  const h = p.h();
  const sq = p.sq || 0;
  const sx = 1 + sq * 0.03, sy = 1 - sq * 0.03;
  const base = p.state === 'full' && !p.eaten ? 'plate_full' : p.state === 'rice' ? 'plate_rice' : 'plate_empty';
  spr(ctx, base, p.x, p.y, p.w, { sx, sy, h: o.h || 0 });
  const x0 = p.x - p.w / 2 * sx, y0 = p.y - h / 2 * sy, dw = p.w * sx, dh = h * sy;
  if (p.reveal && p.reveal.k > 0) {
    const r = p.reveal, cx = p.c.getContext('2d');
    cx.globalCompositeOperation = 'source-over';
    cx.clearRect(0, 0, CS, CS);
    blobMask(cx, r.nx, r.ny, clamp(r.k, 0, 1), r.kind);
    cx.globalCompositeOperation = 'source-in';
    cx.drawImage(img(r.layer), 0, 0, CS, CS);
    cx.globalCompositeOperation = 'source-over';
    ctx.drawImage(p.c, x0, y0, dw, dh);
  }
  if (p.eaten) ctx.drawImage(p.eaten, x0, y0, dw, dh);
  for (const s of p.shapes) {
    if (s.a <= 0) continue;
    spr(ctx, s.name, x0 + s.nx * dw, y0 + s.ny * dh, s.w, { rot: s.rot, h: s.h || 0, alpha: s.a, sa: 0.8 });
  }
  if (p.glint >= 0 && p.glint < 1) {
    ctx.save();
    ctx.beginPath(); ctx.ellipse(p.x, p.y, p.w * 0.48, h * 0.48, 0, 0, TAU); ctx.clip();
    ctx.globalCompositeOperation = 'screen';
    const gx = lerp(p.x - p.w, p.x + p.w, p.glint);
    const g = ctx.createLinearGradient(gx - 90, p.y - h / 2, gx + 90, p.y + h / 2);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(p.x - p.w / 2, p.y - h / 2, p.w, h);
    ctx.restore();
  }
}

// --- eating: remaining food lives in its own canvas, bites are erased from it
export function startEating(p) {
  p.eaten = canvas2d(CS, CS);
  p.eaten.getContext('2d').drawImage(img('plate_full'), 0, 0, CS, CS);
  // only the food should be erasable: remove the plate itself (plate_empty shows underneath anyway)
  p.state = 'empty';
}

export function bite(p, nx, ny, scale = 1) {
  const x = p.eaten.getContext('2d');
  x.save();
  x.globalCompositeOperation = 'destination-out';
  const b = softBlob();
  const R = CS * 0.17 * scale;
  for (let i = 0; i < 7; i++) {
    const a = rnd() * TAU, d = R * 0.35 * rnd();
    const r = R * (0.7 + rnd() * 0.3);
    x.drawImage(b, nx * CS + Math.cos(a) * d - r, ny * CS + Math.sin(a) * d * 0.8 - r * 0.8, r * 2, r * 1.6);
  }
  x.restore();
}

export function wipe(p, a) {
  const x = p.eaten.getContext('2d');
  x.save();
  x.globalCompositeOperation = 'destination-out';
  x.globalAlpha = a;
  x.fillRect(0, 0, CS, CS);
  x.restore();
}
