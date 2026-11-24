// bubbles.js — the two round portrait "wipes" (Mama top-left, girl top-right) and the thought bubble.
import { L, TAU, clamp, lerp, ease, Spring, canvas2d } from './engine.js';
import { img, size } from './assets.js';
import { cloudPath } from './shapes.js';
import { fx } from './fx.js';

let SHADOW = null;
function shadowSprite() {
  if (SHADOW) return SHADOW;
  SHADOW = canvas2d(128, 128);
  const x = SHADOW.getContext('2d');
  const g = x.createRadialGradient(64, 64, 30, 64, 64, 64);
  g.addColorStop(0, 'rgba(25,12,4,0.55)'); g.addColorStop(1, 'rgba(25,12,4,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return SHADOW;
}

class Bubble {
  constructor(who, side) {
    this.who = who; this.side = side;
    this.reset();
  }
  reset() {
    this.face = this.who + (this.who === 'mama' ? '_smile' : '_smile');
    this.prev = null; this.fadeT = 1;
    this.vis = 0; this.visTarget = 0;
    this.from = null; this.to = null; this.pt = 1; this.pdur = 1;
    this.sq = new Spring(240, 10);   // squash
    this.jy = new Spring(160, 9);    // jump offset
    this.rk = new Spring(120, 6);    // rock
    this.talkT = 0; this.wobT = 0; this.droop = 0; this.glow = 0; this.rockAmp = 0; this.bob = 1; this.t = Math.random() * 5;
    this.bow = 0;
  }
  home() {
    const d = Math.max(220, 84 / L.u);
    const m = 16;
    return { x: this.side < 0 ? L.sl + m + d / 2 : L.sr - m - d / 2, y: L.st + m + d / 2, d };
  }
  // current base placement (without bob/jump)
  base() {
    const h = this.home();
    const to = this.to || h;
    if (this.pt >= 1 || !this.from) return to;
    const k = ease.inOutCubic(this.pt);
    return { x: lerp(this.from.x, to.x, k), y: lerp(this.from.y, to.y, k), d: lerp(this.from.d, to.d, k) };
  }
  pos() {
    const b = this.base();
    return { x: b.x, y: b.y + this.jy.x + Math.sin(this.t * 2.1) * 5 * this.bob + this.droop * 8, d: b.d };
  }
  place(to, dur = 0.8) { this.from = this.base(); this.to = to; this.pt = dur > 0 ? 0 : 1; this.pdur = dur; }
  setFace(name, kick = true) {
    if (name === this.face) return;
    this.prev = this.face; this.face = name; this.fadeT = 0;
    if (kick) this.sq.kick(2.2);
  }
  show(face) { if (face) this.setFace(face, false); this.visTarget = 1; }
  hide() { this.visTarget = 0; }
  jump(v = 1) { this.jy.kick(-700 * v); this.sq.kick(-2 * v); }
  squash(v = 1) { this.sq.kick(3.5 * v); }
  talk(sec = 0.8) { this.talkT = sec; }
  wobble(sec = 1.2) { this.wobT = sec; }
  update(dt) {
    this.t += dt;
    const sp = this.visTarget > this.vis ? 3.2 : 4;
    this.vis = clamp(this.vis + (this.visTarget > this.vis ? dt * sp : -dt * sp), 0, 1);
    if (this.pt < 1) this.pt = Math.min(1, this.pt + dt / this.pdur);
    this.fadeT = Math.min(1, this.fadeT + dt / 0.22);
    this.sq.update(dt); this.jy.update(dt); this.rk.update(dt);
    if (this.talkT > 0) this.talkT -= dt;
    if (this.wobT > 0) this.wobT -= dt;
  }
  draw(ctx) {
    if (this.vis <= 0.001) return;
    const p = this.pos();
    const appear = this.visTarget > 0 ? ease.outBack(this.vis) : ease.inCubic(this.vis);
    const r = p.d / 2 * appear;
    if (r < 1) return;
    let sx = 1 + this.sq.x * 0.06, sy = 1 - this.sq.x * 0.06;
    if (this.talkT > 0) { const k = Math.sin(this.t * 22) * 0.025; sx += k; sy -= k; }
    if (this.wobT > 0) { const k = Math.sin(this.t * 26) * 0.05 * Math.min(1, this.wobT); sx += k; sy -= k; }
    const rot = this.rk.x * 0.05 + Math.sin(this.t * 2.2) * this.rockAmp + this.bow * 0.12 * this.side;
    ctx.save();
    ctx.translate(p.x, p.y + this.bow * p.d * 0.06);
    // shadow
    const sh = shadowSprite();
    ctx.drawImage(sh, -r * 1.05 + r * 0.1, -r * 1.05 + r * 0.16, r * 2.3, r * 2.3);
    ctx.rotate(rot);
    ctx.scale(sx, sy * (1 - this.bow * 0.08));
    if (this.glow > 0) {
      const g = ctx.createRadialGradient(0, 0, r * 0.9, 0, 0, r * 1.45);
      g.addColorStop(0, `rgba(255,230,120,${0.7 * this.glow})`); g.addColorStop(1, 'rgba(255,230,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.45, 0, TAU); ctx.fill();
    }
    // cream rim
    ctx.fillStyle = '#fff7e8';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = this.who === 'mama' ? '#ffb27a' : '#ff9fb8';
    ctx.lineWidth = r * 0.035;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.985, 0, TAU); ctx.stroke();
    // portrait
    const ri = r * 0.9;
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, ri, 0, TAU); ctx.clip();
    if (this.prev && this.fadeT < 1) drawFace(ctx, this.prev, ri, 1);
    drawFace(ctx, this.face, ri, this.prev ? ease.outQuad(this.fadeT) : 1);
    // inner edge shade + gloss
    const g = ctx.createRadialGradient(0, 0, ri * 0.75, 0, 0, ri);
    g.addColorStop(0, 'rgba(60,30,10,0)'); g.addColorStop(1, 'rgba(60,30,10,0.22)');
    ctx.fillStyle = g; ctx.fillRect(-ri, -ri, ri * 2, ri * 2);
    ctx.restore();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = r * 0.05; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.8, Math.PI * 1.08, Math.PI * 1.38); ctx.stroke();
    ctx.restore();
  }
}

function drawFace(ctx, name, r, a) {
  const s = size(name);
  const k = (r * 2) / Math.min(s.w, s.h);
  ctx.globalAlpha = a;
  ctx.drawImage(img(name), -s.w * k / 2, -s.h * k / 2, s.w * k, s.h * k);
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- thought bubble (girl imagines curry)
const thought = {
  vis: 0, target: 0, name: null, t: 0,
  show(name) { this.name = name; this.target = 1; this.t = 0; },
  hide() { this.target = 0; },
  update(dt) { this.t += dt; this.vis = clamp(this.vis + (this.target ? dt * 2.2 : -dt * 3), 0, 1); },
  draw(ctx, from) {
    if (this.vis <= 0.001) return;
    const d = from.d;
    // place toward the screen/stage centre from the girl bubble
    let cx = from.x - d * 0.95, cy = from.y + d * 0.9;
    const R = d * 0.62;
    cx = clamp(cx, L.ex0 + R * 1.4, L.ex1 - R * 1.4); cy = clamp(cy, L.ey0 + R * 1.4, L.ey1 - R * 1.4);
    // trailing dots
    for (let i = 0; i < 3; i++) {
      const tt = (i + 1) / 4;
      const vis = clamp(this.vis * 3 - i * 0.5, 0, 1);
      if (vis <= 0) continue;
      const x = lerp(from.x - d * 0.35, cx + R * 0.6, tt), y = lerp(from.y + d * 0.35, cy - R * 0.5, tt);
      const rr = d * (0.05 + i * 0.03) * vis;
      ctx.fillStyle = 'rgba(40,20,0,0.18)'; ctx.beginPath(); ctx.arc(x + 4, y + 6, rr, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
    }
    const vis = clamp(this.vis * 1.6 - 0.6, 0, 1);
    if (vis <= 0) return;
    const kk = this.target ? ease.outBack(vis) : vis;
    ctx.save();
    ctx.translate(cx, cy + Math.sin(this.t * 2) * 5);
    ctx.scale(kk, kk);
    ctx.fillStyle = 'rgba(40,20,0,0.2)'; ctx.save(); ctx.translate(8, 12); cloudPath(ctx, 0, 0, R); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#fffaf0'; cloudPath(ctx, 0, 0, R); ctx.fill();
    ctx.strokeStyle = 'rgba(230,170,110,0.5)'; ctx.lineWidth = 4; ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.92, R * 0.8, 0, 0, TAU); ctx.clip();
    const s = size(this.name);
    const z = (R * 2.4) / Math.min(s.w, s.h);
    ctx.drawImage(img(this.name), -s.w * z / 2, -s.h * z / 2, s.w * z, s.h * z);
    ctx.restore();
    ctx.restore();
  },
};

export const bubbles = {
  mama: new Bubble('mama', -1),
  girl: new Bubble('girl', 1),
  thought,
  reset() { this.mama.reset(); this.girl.reset(); thought.vis = 0; thought.target = 0; },
  update(dt) { this.mama.update(dt); this.girl.update(dt); thought.update(dt); },
  draw(ctx) {
    this.mama.draw(ctx);
    this.girl.draw(ctx);
    if (thought.vis > 0) thought.draw(ctx, this.girl.pos());
  },
  // little reactions used everywhere
  cheer(both = true) {
    this.girl.jump(0.8); this.girl.setFace('girl_happy');
    if (both) { this.mama.jump(0.6); this.mama.setFace('mama_smile'); }
  },
  heartBetween() {
    const a = this.mama.pos(), b = this.girl.pos();
    fx.flyHeart(a.x + a.d * 0.3, a.y + a.d * 0.1, b.x - b.d * 0.3, b.y + b.d * 0.1, 30);
  },
};
