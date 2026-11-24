// potview.js — the stove + pot seen from above, shared by the pot and roux scenes:
// flames, pieces lying in the pot, water, golden broth, the curry "mix" transformation, the lid.
import { TAU, rnd, clamp, Spring, canvas2d, ease } from './engine.js';
import { spr, backdrop, tint } from './sprite.js';
import { img, size, geo } from './assets.js';
import { softBlob } from './fx.js';
import { frame, slotCentre, M } from './layout.js';

export const POT = { x: 500, y: 415, outerR: 350 };

// pot (≈700 outer diameter) fills the short side; dishes / jug / roux dish go in the free band
export function planPot() {
  const F = frame({ w: 842, h: 800 }, ['meat', 'onion', 'potato', 'carrot'], { sec: 230, minSec: 210 });
  POT.x = F.px; POT.y = F.py; POT.outerR = 350 * F.k;
  const side = F.mode === 'side';
  const right = slotCentre(F, ['potato', 'carrot']);
  const mid = side ? slotCentre(F, ['meat', 'onion']) : slotCentre(F, ['onion', 'potato']);
  const s = F.slots.meat.s;
  F.jug = { x: right.x, y: right.y, w: side ? Math.min(s * 1.35, F.sideW - 2 * M) : s * 1.35 };
  F.roux = { x: mid.x, y: mid.y, w: side ? Math.min(s * 1.2, F.sideW - 2 * M) : s * 1.2 };
  return F;
}

export function potGeom() {
  const o = geo('pot', 'outer', { cx: 0.5, cy: 0.5, r: 0.38 });
  const i = geo('pot', 'inner', { cx: 0.5, cy: 0.5, r: 0.335 });
  const w = (POT.outerR) / o.r;
  const s = size('pot');
  const h = w * s.h / s.w;
  const x = POT.x - (o.cx - 0.5) * w, y = POT.y - (o.cy - 0.5) * h; // sprite centre so that outer circle is at POT
  return { w, x, y, ix: x + (i.cx - 0.5) * w, iy: y + (i.cy - 0.5) * h, ir: i.r * w, or: POT.outerR };
}

export function createPot() {
  const g = potGeom();
  return {
    g, t: 0,
    pieces: [],           // { name, cooked, x, y, rot, w, cook, float, sq, bob }
    flame: 0, water: 0, broth: 0, warm: 0, simmer: 0, soft: 0,
    lid: null,            // { x, y, h, alpha, rot, sq, jit }
    ripples: [], pops: [],
    mix: null,            // curry transformation state (roux scene)
    update(dt) {
      this.t += dt;
      for (const p of this.pieces) if (p.sq) p.sq.update(dt);
      if (this.lid && this.lid.sq) this.lid.sq.update(dt);
      for (let i = this.ripples.length - 1; i >= 0; i--) { const r = this.ripples[i]; r.age += dt; if (r.age > r.life) this.ripples.splice(i, 1); }
      // bubbles popping at the surface while simmering
      if (this.broth > 0.2 || this.simmer > 0.2) {
        const rate = (this.mix ? 3 + this.mix.mean * 3 : 7) * Math.max(this.broth, this.simmer);
        if (rnd() < rate * dt) {
          const a = rnd() * TAU, d = Math.sqrt(rnd()) * this.g.ir * 0.85;
          this.pops.push({ x: this.g.ix + Math.cos(a) * d, y: this.g.iy + Math.sin(a) * d, age: 0, life: rnd.range(0.5, 1.1), s: rnd.range(5, 13) });
        }
      }
      for (let i = this.pops.length - 1; i >= 0; i--) { const p = this.pops[i]; p.age += dt; if (p.age > p.life) this.pops.splice(i, 1); }
    },
    ripple(x, y, big = 1, life = 1) { this.ripples.push({ x, y, big, age: 0, life }); },
  };
}

// standard full set of pieces (for starting a later scene directly)
export function fillPot(pv, cooked = true) {
  const spots = potSpots(pv, 26);
  const add = (name, w0, extra = {}) => {
    const s = spots.shift(), w = w0 * POT.outerR / 280;
    pv.pieces.push(Object.assign({ name, x: s.x, y: s.y, rot: rnd() * TAU, w, cook: cooked ? 1 : 0, float: false, sq: new Spring(260, 10), bob: rnd() * TAU }, extra));
  };
  for (let i = 0; i < 5; i++) add('meat_raw_' + (1 + (i % 3)), 74, { cooked: 'meat_cooked_' + (1 + (i % 3)) });
  for (let i = 0; i < 5; i++) add('onion_wedge_' + (1 + (i % 4)), 76);
  for (let i = 0; i < 5; i++) add('potato_chunk_' + (1 + (i % 4)), 78);
  for (let i = 0; i < 2; i++) add('carrot_slice_' + (1 + i), 64);
  for (const k of ['flower', 'star', 'flower', 'heart', 'flower']) add('carrot_' + k, 70, { float: true });
}

// well-spread landing spots inside the pot (golden-angle spiral with jitter)
export function potSpots(pv, n) {
  const out = [];
  const off = rnd() * TAU;
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt((i + 0.5) / n) * pv.g.ir * 0.74;
    const a = off + i * 2.39996;
    out.push({ x: pv.g.ix + Math.cos(a) * r + rnd.range(-8, 8), y: pv.g.iy + Math.sin(a) * r + rnd.range(-8, 8) });
  }
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

export function drawStove(ctx, pv) {
  const b = geo('bg_stove', 'burner', { cx: 0.5, cy: 0.5, r: 0.2 });
  const S = clamp((POT.outerR * 1.02) / b.r, 1300, 2200);
  backdrop(ctx, 'bg_stove', POT.x - (b.cx - 0.5) * S, POT.y - (b.cy - 0.5) * S, S, { crop: 0.25, vig: 0.45, vx: POT.x, vy: POT.y });
  if (pv.warm > 0) tint(ctx, `rgba(255,140,50,${0.06 * pv.warm})`);
  drawFlames(ctx, pv);
}

// one pre-rendered blue flame petal (base at the bottom), drawn rotated around the pot
let PETAL = null;
function petal() {
  if (PETAL) return PETAL;
  PETAL = canvas2d(32, 128);
  const x = PETAL.getContext('2d');
  const g = x.createLinearGradient(0, 128, 0, 0);
  g.addColorStop(0, 'rgba(150,200,255,0.95)'); g.addColorStop(0.2, 'rgba(80,130,255,0.85)');
  g.addColorStop(0.6, 'rgba(50,80,255,0.45)'); g.addColorStop(1, 'rgba(40,60,255,0)');
  x.fillStyle = g;
  x.beginPath(); x.moveTo(3, 124); x.quadraticCurveTo(0, 50, 16, 0); x.quadraticCurveTo(32, 50, 29, 124); x.closePath(); x.fill();
  x.fillStyle = 'rgba(220,235,255,0.5)';
  x.beginPath(); x.ellipse(16, 112, 6, 10, 0, 0, TAU); x.fill();
  return PETAL;
}

function drawFlames(ctx, pv) {
  if (pv.flame <= 0.01) return;
  const t = pv.t, R = POT.outerR, f = pv.flame;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(POT.x, POT.y, R * 0.9, POT.x, POT.y, R * 1.35);
  glow.addColorStop(0, `rgba(60,120,255,${0.35 * f})`); glow.addColorStop(1, 'rgba(40,80,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(POT.x, POT.y, R * 1.35, 0, TAU); ctx.fill();
  const N = 28, P = petal();
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU + 0.05 * Math.sin(t * 3 + i);
    const len = f * (34 + 9 * Math.sin(t * 17 + i * 2.3) + 6 * Math.sin(t * 29 + i * 5.1));
    const r0 = R - 10;
    ctx.save();
    ctx.translate(POT.x + Math.cos(a) * r0, POT.y + Math.sin(a) * r0);
    ctx.rotate(a + Math.PI / 2);
    ctx.drawImage(P, -10, -len, 20, len + 6);
    ctx.restore();
  }
  ctx.restore();
}

function drawPiece(ctx, pv, p) {
  const q = p.sq ? p.sq.x * 0.05 : 0;
  let x = p.x, y = p.y, rot = p.rot;
  const liquid = Math.max(pv.water, pv.broth);
  if (liquid > 0.3) { x += Math.sin(pv.t * 1.6 + p.bob) * 3 * liquid; y += Math.cos(pv.t * 1.3 + p.bob) * 3 * liquid; rot += Math.sin(pv.t + p.bob) * 0.04 * liquid; }
  if (pv.jiggle) { x += Math.sin(pv.t * 40 + p.bob * 7) * 1.6 * pv.jiggle; y += Math.cos(pv.t * 37 + p.bob * 5) * 1.6 * pv.jiggle; }
  const o = { rot, sx: 1 + q, sy: 1 - q, sa: 0.8, h: p.h || 0 };
  const cook = p.cooked ? p.cook : 0;
  if (cook < 1) spr(ctx, p.name, x, y, p.w, o);
  if (cook > 0) spr(ctx, p.cooked, x, y, p.w, Object.assign({}, o, { alpha: cook, shadow: cook >= 1 }));
}

function clipInner(ctx, g) { ctx.beginPath(); ctx.arc(g.ix, g.iy, g.ir, 0, TAU); ctx.clip(); }

export function drawPot(ctx, pv) {
  const g = pv.g;
  spr(ctx, 'pot', g.x, g.y, g.w, { sa: 1.1 });
  ctx.save();
  clipInner(ctx, g);
  for (const p of pv.pieces) if (!p.float && p.inPot !== false) drawPiece(ctx, pv, p);
  if (pv.water > 0) drawWater(ctx, pv);
  if (pv.broth > 0) drawBroth(ctx, pv);
  if (pv.mix) drawMix(ctx, pv);
  for (const p of pv.pieces) if (p.float && p.inPot !== false) drawPiece(ctx, pv, p);
  drawSurface(ctx, pv);
  // the pot wall darkens toward the rim
  const sh = ctx.createRadialGradient(g.ix - g.ir * 0.1, g.iy - g.ir * 0.12, g.ir * 0.7, g.ix, g.iy, g.ir);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(0.65, 'rgba(10,5,0,0.14)'); sh.addColorStop(1, 'rgba(10,5,0,0.5)');
  ctx.fillStyle = sh; ctx.fillRect(g.ix - g.ir, g.iy - g.ir, g.ir * 2, g.ir * 2);
  ctx.restore();
  if (pv.lid && pv.lid.alpha > 0) drawLid(ctx, pv);
}

function drawWater(ctx, pv) {
  const g = pv.g, w = pv.water;
  ctx.fillStyle = `rgba(200,222,235,${0.42 * w})`;
  ctx.fillRect(g.ix - g.ir, g.iy - g.ir, g.ir * 2, g.ir * 2);
  caustics(ctx, pv, 0.1 * w * (1 - pv.broth));
}

function caustics(ctx, pv, a) {
  if (a <= 0.005) return;
  const g = pv.g, t = pv.t, blob = softBlob();
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 8; i++) {
    const an = t * (0.2 + i * 0.04) + i * 2.3;
    const rr = g.ir * (0.2 + 0.55 * ((i * 0.41) % 1));
    const x = g.ix + Math.cos(an) * rr, y = g.iy + Math.sin(an * 1.2) * rr * 0.85;
    const s = g.ir * 0.3;
    ctx.globalAlpha = a * (0.7 + 0.3 * Math.sin(t * 1.7 + i));
    ctx.save(); ctx.translate(x, y); ctx.rotate(an); ctx.scale(1.9, 0.45);
    ctx.drawImage(blob, -s, -s, s * 2, s * 2);
    ctx.restore();
  }
  ctx.restore();
}

function drawBroth(ctx, pv) {
  const g = pv.g, b = pv.broth;
  ctx.save();
  ctx.fillStyle = `rgba(214,150,52,${0.5 * b})`;
  ctx.fillRect(g.ix - g.ir, g.iy - g.ir, g.ir * 2, g.ir * 2);
  ctx.globalCompositeOperation = 'screen';
  const hl = ctx.createRadialGradient(g.ix - g.ir * 0.35, g.iy - g.ir * 0.4, 0, g.ix - g.ir * 0.35, g.iy - g.ir * 0.4, g.ir * 0.9);
  hl.addColorStop(0, `rgba(255,220,140,${0.28 * b})`); hl.addColorStop(1, 'rgba(255,220,140,0)');
  ctx.fillStyle = hl; ctx.fillRect(g.ix - g.ir, g.iy - g.ir, g.ir * 2, g.ir * 2);
  ctx.restore();
  caustics(ctx, pv, 0.07 * b);
}

function drawSurface(ctx, pv) {
  const liquid = Math.max(pv.water, pv.broth, pv.mix ? 1 : 0);
  if (liquid <= 0) return;
  ctx.save();
  for (const r of pv.ripples) {
    const k = r.age / r.life;
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - k) * Math.min(1, r.big)})`;
    ctx.lineWidth = 3 * (1 - k) + 1;
    ctx.beginPath(); ctx.arc(r.x, r.y, 10 + ease.outCubic(k) * 110 * r.big, 0, TAU); ctx.stroke();
  }
  const thick = pv.mix ? pv.mix.mean : 0;
  for (const p of pv.pops) {
    const k = p.age / p.life;
    const s = p.s * (0.5 + k * 0.7);
    if (k < 0.85) {
      ctx.fillStyle = thick > 0.5 ? `rgba(120,60,15,${0.35})` : `rgba(255,240,200,${0.25})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(255,250,230,${0.55 * (1 - k)})`; ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(p.x - s * 0.35, p.y - s * 0.35, s * 0.25, 0, TAU); ctx.fill();
    } else {
      const kk = (k - 0.85) / 0.15;
      ctx.strokeStyle = `rgba(255,250,230,${0.6 * (1 - kk)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, s * (1 + kk * 1.5), 0, TAU); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawLid(ctx, pv) {
  const l = pv.lid, g = pv.g;
  const lg = geo('lid', '_self', { cx: 0.5, cy: 0.5, r: 0.49 });
  const r = l.r || g.ir * 1.13;
  const w = r / (lg.r || 0.49);
  const q = l.sq ? l.sq.x * 0.04 : 0;
  spr(ctx, 'lid', l.x + (l.jx || 0), l.y + (l.jy || 0), w * (l.sc || 1), { h: l.h, alpha: l.alpha, rot: l.rot || 0, sx: 1 + q, sy: 1 - q });
}

// ---------------------------------------------------------------- curry transformation
const MS = 256, CS = 512;
export function initMix(pv) {
  const M = canvas2d(MS, MS), T = canvas2d(MS, MS), C = canvas2d(CS, CS), S = canvas2d(16, 16);
  pv.mix = { M, T, C, S, sx: S.getContext('2d', { willReadFrequently: true }), mean: 0, base: 0, pending: 0, texAng: 0, thick: 0, done: false };
}
// stage coords -> mask pixel coords
function toM(pv, x, y) { const g = pv.g; return { x: ((x - g.ix) / (g.ir * 2) + 0.5) * MS, y: ((y - g.iy) / (g.ir * 2) + 0.5) * MS }; }

export function mixRotate(pv, ang, ringR, ringW, ringAng) {
  const m = pv.mix, mx = m.M.getContext('2d'), tx = m.T.getContext('2d');
  tx.clearRect(0, 0, MS, MS);
  tx.drawImage(m.M, 0, 0);
  mx.save();
  mx.clearRect(0, 0, MS, MS);
  mx.translate(MS / 2, MS / 2); mx.rotate(ang); mx.translate(-MS / 2, -MS / 2);
  mx.drawImage(m.T, 0, 0);
  mx.restore();
  if (ringAng) {
    // extra rotation in the ring the spatula moves through -> shear -> swirls
    tx.clearRect(0, 0, MS, MS);
    tx.drawImage(m.M, 0, 0);
    const r = (ringR / (pv.g.ir * 2)) * MS, w = (ringW / (pv.g.ir * 2)) * MS;
    mx.save();
    mx.beginPath(); mx.arc(MS / 2, MS / 2, r + w, 0, TAU); mx.arc(MS / 2, MS / 2, Math.max(1, r - w), 0, TAU, true); mx.clip();
    mx.clearRect(0, 0, MS, MS);
    mx.translate(MS / 2, MS / 2); mx.rotate(ringAng); mx.translate(-MS / 2, -MS / 2);
    mx.drawImage(m.T, 0, 0);
    mx.restore();
  }
}

export function mixDeposit(pv, x, y, r, a) {
  const m = pv.mix, mx = m.M.getContext('2d');
  const p = toM(pv, x, y), rr = (r / (pv.g.ir * 2)) * MS;
  mx.globalAlpha = clamp(a, 0, 1);
  mx.drawImage(softBlob(), p.x - rr, p.y - rr, rr * 2, rr * 2);
  mx.globalAlpha = 1;
}

// uniform rise, applied additively in chunks big enough to survive 8-bit rounding
export function mixRaise(pv, amount) {
  const m = pv.mix;
  m.pending += amount; m.base += amount;
  if (m.pending < 4 / 255) return;
  const mx = m.M.getContext('2d');
  mx.save();
  mx.globalCompositeOperation = 'lighter';
  mx.fillStyle = `rgba(255,255,255,${m.pending})`;
  mx.fillRect(0, 0, MS, MS);
  mx.restore();
  m.pending = 0;
}

export function mixFill(pv) {
  const mx = pv.mix.M.getContext('2d');
  mx.fillStyle = '#fff'; mx.fillRect(0, 0, MS, MS);
  pv.mix.mean = 1; pv.mix.base = Math.max(pv.mix.base, 1);
}

export function mixMeasure(pv) {
  const m = pv.mix;
  m.sx.clearRect(0, 0, 16, 16);
  m.sx.drawImage(m.M, 0, 0, 16, 16);
  const d = m.sx.getImageData(0, 0, 16, 16).data;
  let s = 0, n = 0;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if ((x - 7.5) ** 2 + (y - 7.5) ** 2 > 7.2 * 7.2) continue;
    s += d[(y * 16 + x) * 4 + 3]; n++;
  }
  m.mean = s / (n * 255);
  return m.mean;
}

// Two stages: A = glossy brown sauce through the mix mask M (ribbons that follow the spoon),
// B = the chunky curry photo through the same mask, faded in by m.thick (it "sets" in the last third).
function drawMix(ctx, pv) {
  const m = pv.mix, g = pv.g;
  const cx = m.C.getContext('2d');
  cx.clearRect(0, 0, CS, CS);
  cx.fillStyle = 'rgba(122,66,22,0.86)';
  cx.fillRect(0, 0, CS, CS);
  const sh = cx.createRadialGradient(CS * 0.38, CS * 0.34, CS * 0.05, CS / 2, CS / 2, CS * 0.55);
  sh.addColorStop(0, 'rgba(170,100,40,0.35)'); sh.addColorStop(1, 'rgba(60,28,6,0.35)');
  cx.fillStyle = sh; cx.fillRect(0, 0, CS, CS);
  cx.globalCompositeOperation = 'destination-in';
  cx.drawImage(m.M, 0, 0, CS, CS);
  cx.globalCompositeOperation = 'source-over';
  // drawn twice: thin ribbons already read as brown sauce instead of a pale tint
  ctx.drawImage(m.C, g.ix - g.ir, g.iy - g.ir, g.ir * 2, g.ir * 2);
  ctx.drawImage(m.C, g.ix - g.ir, g.iy - g.ir, g.ir * 2, g.ir * 2);
  if (m.thick > 0.005) {
    cx.clearRect(0, 0, CS, CS);
    cx.save();
    cx.translate(CS / 2, CS / 2); cx.rotate(m.texAng);
    // texture side ≈ 1.1 × the inner diameter: chunks match the real pieces, circle stays covered
    const D = CS * 1.1;
    cx.drawImage(img('tex_curry'), -D / 2, -D / 2, D, D);
    cx.restore();
    cx.globalCompositeOperation = 'destination-in';
    cx.drawImage(m.M, 0, 0, CS, CS);
    cx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalAlpha = Math.min(1, m.thick);
    ctx.drawImage(m.C, g.ix - g.ir, g.iy - g.ir, g.ir * 2, g.ir * 2);
    ctx.restore();
  }
  // glossy swirl highlights rotating with the stir
  const a = clamp(m.mean * 1.2 - 0.1, 0, 1);
  if (a > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const r = g.ir * (0.25 + i * 0.17);
      const st = m.texAng * (1.3 - i * 0.15) + i * 1.9;
      ctx.strokeStyle = `rgba(255,232,190,${0.2 * a})`;
      ctx.lineWidth = (10 - i) * g.ir / 220;
      ctx.beginPath(); ctx.arc(g.ix, g.iy, r, st, st + 0.7); ctx.stroke();
    }
    ctx.restore();
  }
  if (m.sweep >= 0 && m.sweep < 1) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const p = g.ix - g.ir * 1.6 + m.sweep * g.ir * 3.2;
    const gr = ctx.createLinearGradient(p - 80, g.iy - g.ir, p + 80, g.iy + g.ir);
    gr.addColorStop(0, 'rgba(255,240,210,0)'); gr.addColorStop(0.5, 'rgba(255,240,210,0.55)'); gr.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = gr; ctx.fillRect(g.ix - g.ir, g.iy - g.ir, g.ir * 2, g.ir * 2);
    ctx.restore();
  }
}

