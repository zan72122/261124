// shapes.js — vector paths: carrot cutter shapes, heart, cloud, the hint hand, a small vector carrot.
import { TAU } from './engine.js';

// Points of a shape of "radius" 1 centred at 0,0.
const cache = {};
export function shapePts(kind) {
  if (cache[kind]) return cache[kind];
  const pts = [];
  const N = 160;
  if (kind === 'flower') {
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU - Math.PI / 2;
      const r = 0.6 + 0.4 * Math.pow(Math.abs(Math.cos((a + Math.PI / 2) * 2.5)), 0.6);
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  } else if (kind === 'star') {
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU - Math.PI / 2;
      const k = Math.abs(((((a + Math.PI / 2) / TAU) * 5) % 1) - 0.5) * 2; // 1 at tips, 0 between
      const r = 0.48 + 0.52 * Math.pow(k, 1.6);
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  } else if (kind === 'heart') {
    for (let i = 0; i < N; i++) {
      const t = (i / N) * TAU;
      const x = 16 * Math.sin(t) ** 3;
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      pts.push([x / 17, (y + 2.5) / 17]);
    }
  } else {
    for (let i = 0; i < N; i++) { const a = (i / N) * TAU; pts.push([Math.cos(a), Math.sin(a)]); }
  }
  return (cache[kind] = pts);
}

export function shapePath(ctx, kind, x, y, r, rot = 0) {
  const pts = shapePts(kind);
  const c = Math.cos(rot), s = Math.sin(rot);
  ctx.moveTo(x + (pts[0][0] * c - pts[0][1] * s) * r, y + (pts[0][0] * s + pts[0][1] * c) * r);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    ctx.lineTo(x + (p[0] * c - p[1] * s) * r, y + (p[0] * s + p[1] * c) * r);
  }
  ctx.closePath();
}

export function heartPath(ctx, x, y, r) { ctx.beginPath(); shapePath(ctx, 'heart', x, y, r); }

// Cloud for the thought bubble: ring of bumps around radius r.
export function cloudPath(ctx, x, y, r, n = 9) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
    const p0x = x + Math.cos(a0) * r, p0y = y + Math.sin(a0) * r * 0.86;
    const am = (a0 + a1) / 2;
    const cx = x + Math.cos(am) * r * 1.32, cy = y + Math.sin(am) * r * 1.32 * 0.86;
    const p1x = x + Math.cos(a1) * r, p1y = y + Math.sin(a1) * r * 0.86;
    if (i === 0) ctx.moveTo(p0x, p0y);
    if (i < n) ctx.quadraticCurveTo(cx, cy, p1x, p1y);
  }
  ctx.closePath();
}

// Friendly pointing hand, fingertip at (0,0), pointing up-left. Size ~ 150 units tall.
function handParts(ctx) {
  ctx.beginPath();
  // index finger
  ctx.moveTo(-15, 8); ctx.arc(0, 8, 15, Math.PI, 0); ctx.lineTo(15, 78); ctx.lineTo(-15, 78); ctx.closePath();
  // palm
  const x = -24, y = 58, w = 86, h = 92, r = 34;
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  // folded fingers
  for (const [cx, cy, rr] of [[30, 70, 16], [50, 80, 15], [64, 96, 13]]) { ctx.moveTo(cx + rr, cy); ctx.arc(cx, cy, rr, 0, TAU); }
  // thumb
  ctx.moveTo(-18, 112); ctx.ellipse(-24, 100, 14, 28, -0.5, 0, TAU);
}

export function drawHand(ctx, x, y, scale, press, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.38);
  const s = scale * (1 - press * 0.08);
  ctx.globalAlpha = alpha;
  // shadow (closer when pressed)
  const sd = 18 - press * 12;
  ctx.save(); ctx.translate(sd * 0.9, sd * 1.2); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(30,15,5,0.22)'; handParts(ctx); ctx.fill('nonzero');
  ctx.restore();
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(120,90,70,0.55)'; ctx.lineWidth = 9; handParts(ctx); ctx.stroke();
  ctx.fillStyle = '#fffdf8'; handParts(ctx); ctx.fill('nonzero');
  // fingernail
  ctx.fillStyle = 'rgba(255,200,190,0.75)';
  ctx.beginPath(); ctx.ellipse(0, 6, 8, 10, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

// Small vector carrot for the loader.
export function drawVectorCarrot(ctx, x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = '#4caf50';
  for (const a of [-0.5, 0, 0.5]) { ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, -62, 9, 24, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  const g = ctx.createLinearGradient(-26, 0, 26, 0);
  g.addColorStop(0, '#ff9a3c'); g.addColorStop(1, '#e8701a');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(-26, -40); ctx.quadraticCurveTo(0, -52, 26, -40); ctx.quadraticCurveTo(8, 40, 0, 70); ctx.quadraticCurveTo(-8, 40, -26, -40); ctx.fill();
  ctx.strokeStyle = 'rgba(150,60,10,0.35)'; ctx.lineWidth = 3;
  for (const yy of [-15, 8, 30]) { ctx.beginPath(); ctx.moveTo(-14 + yy * 0.2, yy); ctx.lineTo(-4, yy + 3); ctx.stroke(); }
  ctx.restore();
}
