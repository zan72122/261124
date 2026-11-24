// chef.js — the girl at her own pot (sprite-girl/, 12 fps cut-out frames): the story's main character.
// She stirs while she waits and acts out what the player does: when a dish is tipped into the
// pot, the frame where that vegetable drops into HER pot is timed to the moment the first piece
// lands in the overhead pot. In the roux scene she stirs as fast as the player's finger.
import { canvas2d, bucket, pxScale } from './engine.js';
import { img, has, chefName, CHEF_N } from './assets.js';

export const FPS = 12;
// union of the cut-out's bounding boxes over all frames (sprite pixels), with a little air
const CROP = { x: 76, y: 2, w: 346, h: 345 };

// a..b: frames played once; land: the frame where the vegetable touches the soup
const CLIPS = {
  carrot: { a: 27, b: 40, land: 30 },
  potato: { a: 44, b: 54, land: 47 },
  onion: { a: 62, b: 71, land: 64 },
  smile: { a: 54, b: 61, land: 56 },   // eyes-closed giggle (also: meat goes in, the girl is tapped)
  wink: { a: 94, b: 99, land: 98 },
};
// stirring idles: played forward and back, so the motion never jumps
export const IDLE = { pot: [0, 27], curry: [72, 96] };

const XFADE = 0.16;

export const chef = {
  range: IDLE.pot, f: 0, dir: 1, speed: 1,
  clip: null,       // { name, a, b, land, hold, onLand, landed }
  pending: null,    // { name, delay, opts } — waits so that its land frame hits a given moment
  from: -1, xk: 1,  // cross-fade from frame `from` (0..1 progress)
  idle(range, speed = 1) {
    this.range = range; this.speed = speed;
    if (!this.clip && (this.f < range[0] - 1 || this.f > range[1] + 1)) this.cut(range[0]);
  },
  setSpeed(s) { this.speed = s; },
  reset(range = IDLE.pot) { this.clip = null; this.pending = null; this.range = range; this.f = range[0]; this.dir = 1; this.speed = 1; this.xk = 1; },
  has(a, b) { for (let i = a; i <= b; i++) if (!has(chefName(i))) return false; return true; },
  ready() { return this.has(this.range[0], this.range[1]); },
  busy() { return !!(this.clip || this.pending); },
  // play a clip; landIn: seconds from now at which its land frame should show
  play(name, opts = {}) {
    const c = CLIPS[name];
    if (!c || !this.has(c.a, c.b)) { if (opts.onLand) setTimeout(opts.onLand, (opts.landIn || 0) * 1000); return false; }
    const lead = (c.land - c.a) / FPS;
    const delay = (opts.landIn ?? lead) - lead;
    this.pending = null;
    if (delay > 0.02) { this.pending = { name, delay, opts }; return true; }
    // too late for the full wind-up: start further in, so the land frame still hits the moment
    const start = Math.min(c.land, c.a + Math.round(-delay * FPS));
    this.clip = Object.assign({ name, landed: false, onLand: opts.onLand || null }, c);
    this.cut(start);
    this.dir = 1;
    return true;
  },
  // a small reaction (face change in the old portrait): only when nothing else is playing
  react() { if (!this.busy()) this.play('smile'); },
  cut(f) {
    if (Math.abs(f - this.f) > 1.5) { this.from = Math.floor(this.f); this.xk = 0; }
    this.f = f;
  },
  update(dt) {
    if (this.xk < 1) this.xk = Math.min(1, this.xk + dt / XFADE);
    if (this.pending) {
      this.pending.delay -= dt;
      if (this.pending.delay <= 0) {
        const p = this.pending; this.pending = null;
        this.play(p.name, Object.assign({}, p.opts, { landIn: undefined }));
      }
    }
    const c = this.clip;
    if (c) {
      this.f += dt * FPS;
      if (!c.landed && this.f >= c.land) { c.landed = true; if (c.onLand) c.onLand(); }
      if (this.f >= c.b + 0.999) {
        if (c.hold) { this.f = c.b; return; }
        this.clip = null;
        // back to the idle stirring, at its nearest end
        const r = this.range;
        this.cut(Math.abs(c.b - r[0]) < Math.abs(c.b - r[1]) ? r[0] : r[1]);
        this.dir = this.f <= r[0] ? 1 : -1;
      }
      return;
    }
    const r = this.range;
    this.f += dt * FPS * this.speed * this.dir;
    if (this.f >= r[1]) { this.f = r[1] - (this.f - r[1]); this.dir = -1; }
    if (this.f <= r[0]) { this.f = r[0] + (r[0] - this.f); this.dir = 1; }
    if (this.f < r[0] || this.f > r[1]) this.f = r[0];
  },
  frame() { return Math.max(0, Math.min(CHEF_N - 1, Math.floor(this.f + 1e-6))); },
  state() { return { f: this.frame(), clip: this.clip ? this.clip.name : this.pending ? this.pending.name + '…' : null }; },
  // the girl inside a rounded window of side S centred on (0,0) of the current transform
  draw(ctx, S, alpha = 1) {
    if (alpha <= 0.001) return;
    const px = bucket(S * pxScale(ctx), 32, 1536);
    const P = panel(px);
    ctx.save();
    ctx.globalAlpha *= alpha;
    const T = S * PANEL_PAD;
    ctx.drawImage(P.back, -T / 2, -T / 2, T, T);
    const w = S * 0.9;
    const dx = -w / 2, dy = -S / 2 + S * 0.055;
    const a0 = ctx.globalAlpha;
    ctx.save();
    const ri = S * 0.045;
    rr(ctx, -S / 2 + ri, -S / 2 + ri, S - 2 * ri, S - 2 * ri, S * 0.22 * 0.82); ctx.clip();
    if (this.xk < 1 && this.from >= 0) {
      const k = this.xk * this.xk * (3 - 2 * this.xk);
      ctx.globalAlpha = a0 * (1 - k);
      frameImg(ctx, this.from, dx, dy, w);
      ctx.globalAlpha = a0 * k;
    }
    frameImg(ctx, this.frame(), dx, dy, w);
    ctx.restore();
    ctx.globalAlpha = a0;
    ctx.drawImage(P.front, -T / 2, -T / 2, T, T);
    ctx.restore();
  },
};

function frameImg(ctx, i, x, y, w) {
  const n = chefName(i);
  if (!has(n)) return;
  ctx.drawImage(img(n), CROP.x, CROP.y, CROP.w, CROP.h, x, y, w, w * CROP.h / CROP.w);
}

// ---------------------------------------------------------------- the window, pre-rendered per pixel size
const PANEL_PAD = 1.06;
const panels = new Map();
function rr(x, X, Y, W, H, R) {
  x.beginPath();
  x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R);
  x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath();
}
function panel(px) {
  let p = panels.get(px);
  if (p) return p;
  if (panels.size > 12) panels.clear();
  const T = Math.ceil(px * PANEL_PAD), o = (T - px) / 2;
  const R = px * 0.22;
  // back: cream rim, pink ring, a warm little kitchen wall + floor, a soft shadow where she stands
  const back = canvas2d(T, T), b = back.getContext('2d');
  b.fillStyle = '#fff7e8'; rr(b, o, o, px, px, R); b.fill();
  const ri = px * 0.045;
  rr(b, o + ri, o + ri, px - 2 * ri, px - 2 * ri, R * 0.82); b.save(); b.clip();
  const g = b.createLinearGradient(0, o, 0, o + px);
  g.addColorStop(0, '#ffeedd'); g.addColorStop(0.62, '#ffd9bd'); g.addColorStop(0.63, '#f2c29a'); g.addColorStop(1, '#e7b088');
  b.fillStyle = g; b.fillRect(0, 0, T, T);
  // a few soft tiles on the wall
  b.fillStyle = 'rgba(255,255,255,0.35)';
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) {
    const s = px * 0.15, x = o + px * 0.1 + i * px * 0.22 + (j & 1) * px * 0.11, y = o + px * 0.08 + j * px * 0.17;
    rr(b, x, y, s, s * 0.8, s * 0.2); b.fill();
  }
  const sh = b.createRadialGradient(o + px * 0.52, o + px * 0.9, 0, o + px * 0.52, o + px * 0.9, px * 0.42);
  sh.addColorStop(0, 'rgba(90,40,10,0.32)'); sh.addColorStop(1, 'rgba(90,40,10,0)');
  b.save(); b.translate(o + px * 0.52, o + px * 0.9); b.scale(1, 0.22); b.translate(-(o + px * 0.52), -(o + px * 0.9));
  b.fillStyle = sh; b.fillRect(0, 0, T, T); b.restore();
  b.restore();
  // front: inner shade at the edge, the pink ring and a gloss stroke
  const front = canvas2d(T, T), f = front.getContext('2d');
  f.save(); rr(f, o + ri, o + ri, px - 2 * ri, px - 2 * ri, R * 0.82); f.clip();
  f.lineWidth = px * 0.06; f.strokeStyle = 'rgba(90,45,15,0.12)'; rr(f, o + ri, o + ri, px - 2 * ri, px - 2 * ri, R * 0.82); f.stroke();
  f.restore();
  f.strokeStyle = '#ff9fb8'; f.lineWidth = px * 0.018;
  rr(f, o + px * 0.012, o + px * 0.012, px * 0.976, px * 0.976, R * 0.97); f.stroke();
  f.globalCompositeOperation = 'screen';
  f.strokeStyle = 'rgba(255,255,255,0.5)'; f.lineWidth = px * 0.025; f.lineCap = 'round';
  f.beginPath(); f.moveTo(o + px * 0.12, o + px * 0.05); f.lineTo(o + px * 0.34, o + px * 0.05); f.stroke();
  p = { back, front };
  panels.set(px, p);
  return p;
}
