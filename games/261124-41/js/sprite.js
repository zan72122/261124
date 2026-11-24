// sprite.js — draw photo cut-outs with baked contact shadows; mirrored backgrounds; cover images.
import { L } from './engine.js';
import { img, size, shadowOf } from './assets.js';

// Lifted objects come toward the overhead camera: bigger, shadow further down-right, softer, fainter.
export const liftScale = (h) => 1 + h / 1400;

// o: rot, sx, sy, alpha, h (height above surface), ax/ay (anchor 0..1), shadow (false to skip), sa (shadow alpha)
export function spr(ctx, name, x, y, w, o = {}) {
  const s = size(name);
  const hh = w * s.h / s.w;
  const h = o.h || 0;
  const ax = o.ax ?? 0.5, ay = o.ay ?? 0.5;
  const rot = o.rot || 0;
  const sx = o.sx ?? 1, sy = o.sy ?? 1;
  const a = o.alpha ?? 1;
  if (a <= 0.001) return;
  if (o.shadow !== false) shadow(ctx, name, x, y, w, hh, h, rot, sx, sy, ax, ay, a * (o.sa ?? 1));
  const k = liftScale(h);
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.scale(sx * k, sy * k);
  if (a < 1) ctx.globalAlpha *= a;
  ctx.drawImage(img(name), -ax * w, -ay * hh, w, hh);
  ctx.restore();
}

export function shadow(ctx, name, x, y, w, hh, h, rot, sx, sy, ax, ay, a) {
  const sh = shadowOf(name);
  const k = 1 + h / 900;
  const dx = 4 + h * 0.32, dy = 7 + h * 0.48;
  const alpha = 0.5 * a / (1 + h / 110);
  const soft = Math.min(1, h / 60);
  ctx.save();
  ctx.translate(x + dx, y + dy);
  if (rot) ctx.rotate(rot);
  ctx.scale(sx * k, sy * k);
  const pw = sh.px * w, ph = sh.py * hh;
  if (soft < 1) {
    ctx.globalAlpha = alpha * (1 - soft);
    ctx.drawImage(sh.sharp, -ax * w - pw, -ay * hh - ph, w + 2 * pw, hh + 2 * ph);
  }
  if (soft > 0) {
    const g = 1 + soft * 0.08;
    ctx.globalAlpha = alpha * soft;
    ctx.drawImage(sh.soft, (-ax * w - pw) * g, (-ay * hh - ph) * g, (w + 2 * pw) * g, (hh + 2 * ph) * g);
  }
  ctx.restore();
}

// Background image of side S units centred at (cx,cy); the rest of the screen is filled by mirrored copies.
export function drawBg(ctx, name, cx, cy, S) {
  const im = img(name);
  const x0 = cx - S / 2, y0 = cy - S / 2;
  const i0 = Math.floor((L.ex0 - x0) / S), i1 = Math.floor((L.ex1 - x0) / S);
  const j0 = Math.floor((L.ey0 - y0) / S), j1 = Math.floor((L.ey1 - y0) / S);
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      ctx.save();
      ctx.translate(x0 + i * S, y0 + j * S);
      if (i & 1) { ctx.translate(S, 0); ctx.scale(-1, 1); }
      if (j & 1) { ctx.translate(0, S); ctx.scale(1, -1); }
      ctx.drawImage(im, -0.5, -0.5, S + 1, S + 1);
      ctx.restore();
    }
  }
}

export function vignette(ctx, strength = 0.4, cx = 500, cy = 500) {
  const w = L.ex1 - L.ex0, h = L.ey1 - L.ey0;
  const r0 = Math.min(w, h) * 0.42, r1 = Math.hypot(w, h) * 0.62;
  const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
  g.addColorStop(0, 'rgba(20,10,0,0)');
  g.addColorStop(1, `rgba(20,10,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(L.ex0, L.ey0, w, h);
}

export function tint(ctx, color, op = 'source-over') {
  ctx.save();
  ctx.globalCompositeOperation = op;
  ctx.fillStyle = color;
  ctx.fillRect(L.ex0, L.ey0, L.ex1 - L.ex0, L.ey1 - L.ey0);
  ctx.restore();
}

// Draw an image covering the rectangle (centre "cover").
export function cover(ctx, name, x, y, w, h, zoom = 1, ox = 0, oy = 0) {
  const im = img(name);
  const s = size(name);
  const k = Math.max(w / s.w, h / s.h) * zoom;
  const dw = s.w * k, dh = s.h * k;
  ctx.drawImage(im, x + (w - dw) / 2 + ox, y + (h - dh) / 2 + oy, dw, dh);
}

export function screenRect() { return { x: L.ex0, y: L.ey0, w: L.ex1 - L.ex0, h: L.ey1 - L.ey0 }; }

export function circlePath(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }

export function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
