// fx.js — particles, steam, ripples, hint hand + target glow, round buttons, iris transition.
import { TAU, clamp, lerp, rnd, canvas2d, L, ease } from './engine.js';
import { img } from './assets.js';
import { shapePath, heartPath, drawHand } from './shapes.js';

// ---------------------------------------------------------------- pre-rendered soft sprites
function softPuff(seed, heart) {
  const S = 128, c = canvas2d(S, S), x = c.getContext('2d');
  if (heart) {
    // blurred heart: many stacked translucent hearts of decreasing size
    for (let i = 0; i < 14; i++) {
      x.fillStyle = 'rgba(255,255,255,0.09)';
      heartPath(x, S / 2, S / 2, S * (0.46 - i * 0.022));
      x.fill();
    }
    return c;
  }
  const r = rnd;
  for (let i = 0; i < 16; i++) {
    const a = r() * TAU, d = r() * S * 0.18;
    const px = S / 2 + Math.cos(a) * d, py = S / 2 + Math.sin(a) * d;
    const rr = S * (0.16 + r() * 0.2);
    const g = x.createRadialGradient(px, py, 0, px, py, rr);
    g.addColorStop(0, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
  }
  return c;
}
let PUFFS = null, HPUFF = null, GLOW = null, BLOB = null;
function initSprites() {
  PUFFS = [0, 1, 2, 3].map((i) => softPuff(i));
  HPUFF = softPuff(9, true);
  GLOW = canvas2d(64, 64);
  const gx = GLOW.getContext('2d');
  const g = gx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  gx.fillStyle = g; gx.fillRect(0, 0, 64, 64);
  BLOB = canvas2d(64, 64);
  const bx = BLOB.getContext('2d');
  const g2 = bx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g2.addColorStop(0, 'rgba(255,255,255,1)'); g2.addColorStop(0.55, 'rgba(255,255,255,0.75)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
  bx.fillStyle = g2; bx.fillRect(0, 0, 64, 64);
}
export const softBlob = () => BLOB;
export const glowSprite = () => GLOW;

// ---------------------------------------------------------------- particles
const parts = [];   // world layer (under bubbles)
const over = [];    // over bubbles
const steam = [];
const ripples = [];

export function spawn(p, layer = 'world') {
  const q = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, drag: 1, age: 0, life: 1, size: 10, rot: 0, vr: 0, color: '#fff', a: 1 }, p);
  (layer === 'over' ? over : parts).push(q);
  return q;
}

export const fx = {
  init() { initSprites(); },
  clear() { parts.length = 0; over.length = 0; steam.length = 0; },

  sparkle(x, y, n = 8, spread = 60, layer, color) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, s = rnd.range(60, 260);
      spawn({ type: 'spark', x: x + Math.cos(a) * spread * rnd() * 0.4, y: y + Math.sin(a) * spread * rnd() * 0.4, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 0.04, life: rnd.range(0.5, 0.9), size: rnd.range(10, 22), color: color || rnd.pick(['#fff7c8', '#ffffff', '#ffe08a']), vr: rnd.range(-3, 3) }, layer);
    }
  },
  hearts(x, y, n = 3, layer = 'over', big = 1) {
    for (let i = 0; i < n; i++) {
      spawn({ type: 'heart', x: x + rnd.range(-30, 30), y: y + rnd.range(-10, 10), vx: rnd.range(-40, 40), vy: rnd.range(-160, -90), drag: 0.5, life: rnd.range(1.2, 1.8), size: rnd.range(18, 28) * big, color: rnd.pick(['#ff5c8a', '#ff7aa2', '#ff4d6d']), wob: rnd() * TAU, delay: i * 0.12 }, layer);
    }
  },
  flyHeart(x0, y0, x1, y1, size = 34, layer = 'over') {
    spawn({ type: 'heartfly', x0, y0, x1, y1, x: x0, y: y0, life: 1.6, size, color: '#ff5c8a' }, layer);
  },
  drops(x, y, n = 6, color = 'rgba(220,240,255,0.9)', speed = 200, layer) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, s = rnd.range(0.3, 1) * speed;
      spawn({ type: 'drop', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 0.02, life: rnd.range(0.3, 0.6), size: rnd.range(4, 9), color, z: 0, vz: rnd.range(150, 300) }, layer);
    }
  },
  specks(x, y, n, color, speed = 220, size = 5) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, s = rnd.range(0.3, 1) * speed;
      spawn({ type: 'speck', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 0.01, life: rnd.range(0.25, 0.5), size: rnd.range(0.5, 1) * size, color, z: 0, vz: rnd.range(100, 260) });
    }
  },
  bubbles(x, y, n = 3, spread = 30) {
    for (let i = 0; i < n; i++) {
      spawn({ type: 'bubble', x: x + rnd.range(-spread, spread), y: y + rnd.range(-spread, spread), vx: rnd.range(-30, 30), vy: rnd.range(-50, -10), drag: 0.2, life: rnd.range(0.6, 1.2), size: rnd.range(5, 14) });
    }
  },
  ring(x, y, r0, r1, life = 0.5, color = 'rgba(255,255,255,0.8)', w = 4, layer) {
    spawn({ type: 'ring', x, y, r0, r1, life, color, w }, layer);
  },
  confetti(n = 80) {
    const cols = ['#ff5c5c', '#ffb02e', '#ffe14d', '#5cd67a', '#4db8ff', '#b77dff', '#ff7ac0'];
    for (let i = 0; i < n; i++) {
      spawn({ type: 'confetti', x: rnd.range(L.ex0, L.ex1), y: L.ey0 - rnd.range(10, 400), vx: rnd.range(-40, 40), vy: rnd.range(120, 260), life: 5, size: rnd.range(10, 18), color: rnd.pick(cols), rot: rnd() * TAU, vr: rnd.range(-6, 6), wob: rnd() * TAU }, 'over');
    }
  },
  rain(names, n = 20) {
    for (let i = 0; i < n; i++) {
      spawn({ type: 'image', name: rnd.pick(names), x: rnd.range(L.ex0, L.ex1), y: L.ey0 - rnd.range(20, 600), vx: rnd.range(-30, 30), vy: rnd.range(140, 240), life: 6, size: rnd.range(40, 70), rot: rnd() * TAU, vr: rnd.range(-2, 2), wob: rnd() * TAU }, 'over');
    }
  },
  petals(n = 30) {
    for (let i = 0; i < n; i++) {
      spawn({ type: 'petal', x: rnd.range(L.ex0, L.ex1), y: L.ey0 - rnd.range(20, 500), vx: rnd.range(-50, 50), vy: rnd.range(90, 170), life: 7, size: rnd.range(12, 20), color: rnd.pick(['#ffc1d6', '#ffd6e4', '#ffb0c8']), rot: rnd() * TAU, vr: rnd.range(-3, 3), wob: rnd() * TAU }, 'over');
    }
  },
  heartAt(x, y, vx, vy, size, delay = 0) {
    spawn({ type: 'heart', x, y, vx, vy, drag: 0.6, life: 1.5, size, color: rnd.pick(['#ff5c8a', '#ff7aa2', '#ff4d6d']), wob: rnd() * TAU, delay }, 'over');
  },
  // sparkles born on a ring of radius r, flying outward
  sparkleRing(x, y, r, n = 10, color) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, s = rnd.range(80, 220);
      spawn({ type: 'spark', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 0.05, life: rnd.range(0.5, 0.9), size: rnd.range(12, 24), color: color || rnd.pick(['#fff7c8', '#ffffff', '#ffe08a']), vr: rnd.range(-3, 3) }, 'over');
    }
  },
  sweat(x, y, layer = 'over', size = 20) {
    spawn({ type: 'sweat', x, y, vx: 0, vy: size * 1.3, life: 1.4, size }, layer);
  },
  burst(x, y, r = 120, color = '#fff3b0', layer = 'over') {
    spawn({ type: 'burst', x, y, life: 0.6, size: r, color }, layer);
  },

  // Steam puffs rise toward the camera: they drift up-left, grow and fade.
  steam(x, y, o = {}) {
    if (steam.length > 140) return;
    const s = o.size ?? 60;
    steam.push({
      x: x + rnd.range(-1, 1) * (o.spread ?? 10), y: y + rnd.range(-1, 1) * (o.spread ?? 10),
      vx: (o.vx ?? -14) + rnd.range(-10, 10), vy: (o.vy ?? -34) + rnd.range(-10, 10),
      s0: s * rnd.range(0.7, 1.1), grow: o.grow ?? 1.6, age: 0, life: (o.life ?? 2.2) * rnd.range(0.8, 1.2),
      a: o.alpha ?? 0.5, rot: rnd() * TAU, vr: rnd.range(-0.4, 0.4), k: (rnd() * 4) | 0, heart: !!o.heart, layer: o.layer || 'world',
    });
  },
  ripple(x, y) { ripples.push({ x, y, age: 0 }); },

  update(dt) {
    for (const list of [parts, over]) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        if (p.delay > 0) { p.delay -= dt; continue; }
        p.age += dt;
        if (p.age >= p.life) { list.splice(i, 1); continue; }
        const d = Math.pow(p.drag, dt);
        p.vx = (p.vx + p.ax * dt) * d; p.vy = (p.vy + p.ay * dt) * d;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.vz !== undefined) { p.vz -= 900 * dt; p.z = Math.max(0, p.z + p.vz * dt); }
        if (p.type === 'confetti' || p.type === 'petal' || p.type === 'image') p.x += Math.sin(p.age * 2.5 + p.wob) * 40 * dt;
      }
    }
    for (let i = steam.length - 1; i >= 0; i--) {
      const s = steam[i];
      s.age += dt;
      if (s.age >= s.life) { steam.splice(i, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt;
    }
    for (let i = ripples.length - 1; i >= 0; i--) { ripples[i].age += dt; if (ripples[i].age > 0.5) ripples.splice(i, 1); }
  },

  drawSteam(ctx, layer = 'world') {
    if (!steam.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const s of steam) {
      if (s.layer !== layer) continue;
      const k = s.age / s.life;
      const a = s.a * Math.min(1, k * 5) * (1 - k) * (1 - k);
      const size = s.s0 * (1 + k * s.grow);
      ctx.globalAlpha = a;
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot);
      ctx.drawImage(s.heart ? HPUFF : PUFFS[s.k], -size, -size, size * 2, size * 2);
      ctx.restore();
    }
    ctx.restore();
  },
  drawParts(ctx, layer = 'world') { drawList(ctx, layer === 'over' ? over : parts); },
  drawRipples(ctx) {
    for (const r of ripples) {
      const k = r.age / 0.5;
      ctx.strokeStyle = `rgba(255,255,255,${0.75 * (1 - k)})`;
      ctx.lineWidth = 7 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, 14 + ease.outCubic(k) * 52, 0, TAU); ctx.stroke();
    }
  },
};

function star4(ctx, x, y, r, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU, rr = i % 2 ? r * 0.28 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawList(ctx, list) {
  for (const p of list) {
    if (p.delay > 0) continue;
    const k = p.age / p.life;
    ctx.save();
    switch (p.type) {
      case 'spark': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - k) * 0.9;
        ctx.drawImage(GLOW, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
        ctx.fillStyle = p.color;
        star4(ctx, p.x, p.y, p.size * (1 - k * 0.5) * (0.8 + 0.2 * Math.sin(p.age * 30)), p.rot);
        break;
      }
      case 'heart':
      case 'heartfly': {
        let x = p.x, y = p.y, s = p.size;
        if (p.type === 'heartfly') {
          const t = ease.inOutSine(Math.min(1, k * 1.3));
          x = lerp(p.x0, p.x1, t); y = lerp(p.y0, p.y1, t) - Math.sin(t * Math.PI) * 90;
          s = p.size * (0.6 + 0.6 * Math.sin(Math.min(1, k * 1.3) * Math.PI) + (k > 0.77 ? 0 : 0));
        } else x += Math.sin(p.age * 4 + p.wob) * 10;
        ctx.globalAlpha = k < 0.15 ? k / 0.15 : k > 0.7 ? (1 - k) / 0.3 : 1;
        const pop = p.type === 'heart' ? ease.outBack(Math.min(1, k * 5)) : 1;
        ctx.fillStyle = 'rgba(120,20,40,0.22)';
        heartPath(ctx, x + 3, y + 4, s * pop); ctx.fill();
        ctx.fillStyle = p.color;
        heartPath(ctx, x, y, s * pop); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.ellipse(x - s * 0.35 * pop, y - s * 0.3 * pop, s * 0.16 * pop, s * 0.1 * pop, -0.6, 0, TAU); ctx.fill();
        break;
      }
      case 'drop': {
        const z = p.z || 0;
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = 'rgba(0,30,60,0.15)';
        ctx.beginPath(); ctx.arc(p.x + 3 + z * 0.15, p.y + 4 + z * 0.2, p.size, 0, TAU); ctx.fill();
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + z / 300), 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.3, 0, TAU); ctx.fill();
        break;
      }
      case 'speck': {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + (p.z || 0) / 200), 0, TAU); ctx.fill();
        break;
      }
      case 'bubble': {
        ctx.globalAlpha = (1 - k) * 0.9;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + k * 0.5), 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.18, 0, TAU); ctx.fill();
        break;
      }
      case 'ring': {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = p.color; ctx.lineWidth = p.w * (1 - k * 0.6);
        ctx.beginPath(); ctx.arc(p.x, p.y, lerp(p.r0, p.r1, ease.outCubic(k)), 0, TAU); ctx.stroke();
        break;
      }
      case 'confetti': {
        ctx.globalAlpha = Math.min(1, (1 - k) * 4);
        ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.age * 7 + p.wob));
        ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        break;
      }
      case 'petal': {
        ctx.globalAlpha = Math.min(1, (1 - k) * 4);
        ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, 0.5 + 0.5 * Math.abs(Math.cos(p.age * 3 + p.wob)));
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, TAU); ctx.fill();
        break;
      }
      case 'image': {
        ctx.globalAlpha = Math.min(1, (1 - k) * 4);
        const im = img(p.name);
        const w = p.size, h = w * (im.height || im.naturalHeight) / (im.width || im.naturalWidth);
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.drawImage(im, -w / 2, -h / 2, w, h);
        break;
      }
      case 'sweat': {
        ctx.globalAlpha = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
        const s = p.size;
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#8fd0ff'; ctx.strokeStyle = '#3d8fd1'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, -s * 1.3); ctx.quadraticCurveTo(s, 0, 0, s * 0.6); ctx.quadraticCurveTo(-s, 0, 0, -s * 1.3);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.ellipse(-s * 0.25, -s * 0.05, s * 0.12, s * 0.22, 0.3, 0, TAU); ctx.fill();
        break;
      }
      case 'burst': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - k) * 0.9;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y); ctx.rotate(k * 0.6);
        const n = 12;
        for (let i = 0; i < n; i++) {
          // rays start outside the given radius (never over a face)
          const a = (i / n) * TAU, r0 = p.size * (1.04 + k * 0.3), r1 = p.size * (1.4 + k * 0.7);
          ctx.beginPath();
          ctx.moveTo(Math.cos(a - 0.08) * r0, Math.sin(a - 0.08) * r0);
          ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
          ctx.lineTo(Math.cos(a + 0.08) * r0, Math.sin(a + 0.08) * r0);
          ctx.fill();
        }
        break;
      }
      default: break;
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- hint hand + target glow
// spec: { type: 'tap'|'rub'|'circle'|'hold'|'drag', x, y, r, x2, y2, glow } — x/y may be functions.
export const hint = {
  spec: null, timer: 0, showing: false, t: 0, firstDone: false, alpha: 0,
  set(spec) {
    this.spec = spec; this.showing = false; this.t = 0;
    this.timer = 1.5;
  },
  clear() { this.spec = null; this.showing = false; },
  // any touch hides the hand; it comes back after 3.5 s without progress
  touch() { if (this.showing) this.showing = false; this.timer = 3.5; },
  progress() { this.showing = false; this.timer = 3.5; },
  update(dt) {
    this.alpha = clamp(this.alpha + (this.showing ? dt * 5 : -dt * 6), 0, 1);
    if (!this.spec) return;
    if (this.showing) {
      this.t += dt;
      if (this.t > cycleLen(this.spec.type)) { this.showing = false; this.timer = 5; }
    } else {
      this.timer -= dt;
      if (this.timer <= 0) { this.showing = true; this.t = 0; }
    }
  },
  pos(v) { return typeof v === 'function' ? v() : v; },
  draw(ctx, time) {
    const s = this.spec;
    if (!s) return;
    const x = this.pos(s.x), y = this.pos(s.y), r = s.r || 80;
    if (s.glow !== false) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 4);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.16 + 0.14 * pulse;
      const gr = r * (1.25 + 0.1 * pulse);
      ctx.drawImage(GLOW, x - gr, y - gr, gr * 2, gr * 2);
      ctx.restore();
    }
    if (this.alpha <= 0.01) return;
    const t = this.t;
    let hx = x, hy = y, press = 0, a = this.alpha;
    const type = s.type;
    if (type === 'tap') {
      const ph = t % 1.1;
      press = ph > 0.35 && ph < 0.6 ? 1 : 0;
      hy = y + (press ? 0 : 26); hx = x + (press ? 0 : 18);
      if (ph > 0.35 && ph < 0.4) ringAt(ctx, x, y, (ph - 0.35) / 0.25);
      if (ph >= 0.4 && ph < 0.6) ringAt(ctx, x, y, (ph - 0.35) / 0.25);
    } else if (type === 'rub') {
      press = t > 0.3 && t < 2.1 ? 1 : 0;
      const k = clamp((t - 0.3) / 1.8, 0, 1);
      hx = x + Math.sin(k * TAU * 2.5) * r * 0.6; hy = y + (k - 0.5) * r * 0.5;
    } else if (type === 'circle') {
      press = t > 0.3 && t < 2.4 ? 1 : 0;
      const k = clamp((t - 0.3) / 2.1, 0, 1);
      const a0 = -Math.PI / 2 + k * TAU * 1.5;
      hx = x + Math.cos(a0) * r * 0.55; hy = y + Math.sin(a0) * r * 0.55;
    } else if (type === 'hold') {
      press = t > 0.4 && t < 2.0 ? 1 : 0;
      if (press) {
        const k = (t - 0.4) / 1.6;
        ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x, y, 60, -Math.PI / 2, -Math.PI / 2 + k * TAU); ctx.stroke(); ctx.restore();
      }
      hy = y + (press ? 0 : 24);
    } else if (type === 'drag') {
      const x2 = this.pos(s.x2), y2 = this.pos(s.y2);
      const k = ease.inOutCubic(clamp((t - 0.4) / 1.3, 0, 1));
      press = t > 0.3 && t < 1.9 ? 1 : 0;
      hx = lerp(x, x2, k); hy = lerp(y, y2, k) + (press ? 0 : 24);
    }
    const len = cycleLen(type);
    if (t > len - 0.3) a *= Math.max(0, (len - t) / 0.3);
    if (t < 0.2) a *= t / 0.2;
    drawHand(ctx, hx, hy, 1, press, a);
  },
};
function cycleLen(type) { return { tap: 2.2, rub: 2.5, circle: 2.8, hold: 2.4, drag: 2.3 }[type] || 2.2; }
function ringAt(ctx, x, y, k) {
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - k)})`; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(x, y, 20 + k * 50, 0, TAU); ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- round button (play / replay)
export function drawButton(ctx, x, y, r, icon, time, alpha = 1) {
  if (alpha <= 0) return;
  const pulse = 1 + Math.sin(time * 3.2) * 0.04;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y); ctx.scale(pulse, pulse);
  // soft shadow
  const g = ctx.createRadialGradient(8, 14, r * 0.7, 8, 14, r * 1.25);
  g.addColorStop(0, 'rgba(40,20,0,0.35)'); g.addColorStop(1, 'rgba(40,20,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(8, 14, r * 1.25, 0, TAU); ctx.fill();
  // body
  const b = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  b.addColorStop(0, '#fffdf6'); b.addColorStop(1, '#f6e6c8');
  ctx.fillStyle = b; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = r * 0.06; ctx.stroke();
  ctx.strokeStyle = 'rgba(230,150,60,0.35)'; ctx.lineWidth = r * 0.03;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#ff8a2a'; ctx.strokeStyle = '#ff8a2a'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (icon === 'play') {
    ctx.lineWidth = r * 0.16;
    ctx.beginPath(); ctx.moveTo(-r * 0.22, -r * 0.36); ctx.lineTo(r * 0.38, 0); ctx.lineTo(-r * 0.22, r * 0.36); ctx.closePath();
    ctx.fill(); ctx.stroke();
  } else {
    ctx.lineWidth = r * 0.15;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.42, -Math.PI * 0.35, Math.PI * 1.25); ctx.stroke();
    const a = -Math.PI * 0.35, ax = Math.cos(a) * r * 0.42, ay = Math.sin(a) * r * 0.42;
    ctx.lineWidth = r * 0.08;
    ctx.beginPath(); ctx.moveTo(ax + r * 0.24, ay - r * 0.02); ctx.lineTo(ax - r * 0.06, ay - r * 0.2); ctx.lineTo(ax + r * 0.02, ay + r * 0.2); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- iris transition (k: 0 open .. 1 closed)
export function drawIris(ctx, k, cx = 500, cy = 500) {
  if (k <= 0) return;
  const R = Math.hypot(L.ex1 - L.ex0, L.ey1 - L.ey0) * 0.6;
  const r = R * (1 - ease.inOutSine(k)) - 40;
  ctx.save();
  if (r <= 0) {
    ctx.fillStyle = '#fff3df';
    ctx.fillRect(L.ex0, L.ey0, L.ex1 - L.ex0, L.ey1 - L.ey0);
  } else {
    const g = ctx.createRadialGradient(cx, cy, r, cx, cy, r + 120);
    g.addColorStop(0, 'rgba(255,243,223,0)'); g.addColorStop(1, 'rgba(255,243,223,1)');
    ctx.fillStyle = g;
    ctx.fillRect(L.ex0, L.ey0, L.ex1 - L.ex0, L.ey1 - L.ey0);
  }
  ctx.restore();
}

export function softShapeFill(ctx, kind, x, y, r, color) {
  ctx.fillStyle = color; ctx.beginPath(); shapePath(ctx, kind, x, y, r); ctx.fill();
}
