// engine.js — math, clocks/tweens, layout (virtual 1000-unit stage), single-pointer input.

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => t * (2 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: (t) => { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
  inBack: (t) => { const c = 1.70158; return (c + 1) * t * t * t - c * t * t; },
  outElastic: (t) => (t <= 0 || t >= 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * TAU / 3) + 1),
  outSine: (t) => Math.sin(t * Math.PI / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

export function makeRng(seed = 1) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.sign = () => (f() < 0.5 ? -1 : 1);
  return f;
}
export const rnd = makeRng((Date.now() ^ 0x5a5a) & 0xffffff);

// Clock: game-time timers and tweens. clear() drops everything pending (scene change),
// so awaiting scripts of an old scene simply never continue.
export class Clock {
  constructor() { this.t = 0; this.items = []; }
  update(dt) {
    this.t += dt;
    const list = this.items;
    this.items = [];
    const keep = [];
    for (const it of list) if (!it.dead && !it.step(dt)) keep.push(it);
    this.items = keep.concat(this.items);
  }
  clear() { for (const it of this.items) it.dead = true; this.items = []; }
  wait(sec) {
    return new Promise((res) => {
      let left = sec;
      this.items.push({ step(dt) { left -= dt; if (left <= 0) { res(); return true; } return false; } });
    });
  }
  // fn(k) with k in 0..1 (eased), called every frame for dur seconds.
  anim(dur, fn, ez = ease.linear, delay = 0) {
    return new Promise((res) => {
      let d = delay, t = 0;
      this.items.push({
        step(dt) {
          if (d > 0) { d -= dt; if (d > 0) return false; dt = -d; }
          t += dt;
          const k = dur <= 0 ? 1 : Math.min(1, t / dur);
          fn(ez(k), k);
          if (k >= 1) { res(); return true; }
          return false;
        },
      });
    });
  }
  tween(obj, props, dur, ez = ease.outCubic, delay = 0) {
    let from = null;
    return this.anim(dur, (k) => {
      if (!from) { from = {}; for (const key in props) from[key] = obj[key]; }
      for (const key in props) obj[key] = lerp(from[key], props[key], k);
    }, ez, delay);
  }
  after(sec, fn) { this.wait(sec).then(fn); }
}

// Damped spring around 0, used for squash/stretch and wobbles.
export class Spring {
  constructor(k = 220, d = 11) { this.k = k; this.d = d; this.x = 0; this.v = 0; }
  kick(v) { this.v += v; }
  update(dt) {
    const n = Math.ceil(dt / 0.012);
    const h = dt / n;
    for (let i = 0; i < n; i++) { this.v += (-this.k * this.x - this.d * this.v) * h; this.x += this.v * h; }
  }
}

// ---------------------------------------------------------------- layout
// Stage = 1000x1000 units centred in the safe area. ex*/ey* = full screen extents in units,
// sl/st/sr/sb = safe-area extents in units.
export const L = { W: 1, H: 1, dpr: 1, u: 1, sx: 0, sy: 0, ex0: 0, ey0: 0, ex1: 1000, ey1: 1000, sl: 0, st: 0, sr: 1000, sb: 1000 };

function readSafe() {
  const el = document.getElementById('safe');
  if (!el) return { l: 0, t: 0, r: 0, b: 0 };
  const cs = getComputedStyle(el);
  const n = (v) => parseFloat(v) || 0;
  return { l: n(cs.paddingLeft), t: n(cs.paddingTop), r: n(cs.paddingRight), b: n(cs.paddingBottom) };
}

export function layout(canvas) {
  const W = Math.max(1, window.innerWidth), H = Math.max(1, window.innerHeight);
  const s = readSafe();
  const aw = Math.max(1, W - s.l - s.r), ah = Math.max(1, H - s.t - s.b);
  const u = Math.min(aw, ah) / 1000;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (W * H * dpr * dpr > 4e6) dpr = Math.sqrt(4e6 / (W * H));
  Object.assign(L, { W, H, dpr, u, sx: s.l + (aw - 1000 * u) / 2, sy: s.t + (ah - 1000 * u) / 2 });
  L.ex0 = -L.sx / u; L.ey0 = -L.sy / u; L.ex1 = (W - L.sx) / u; L.ey1 = (H - L.sy) / u;
  L.sl = (s.l - L.sx) / u; L.st = (s.t - L.sy) / u; L.sr = (W - s.r - L.sx) / u; L.sb = (H - s.b - L.sy) / u;
  const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
  if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
}

export function stageTransform(ctx) {
  const k = L.dpr * L.u;
  ctx.setTransform(k, 0, 0, k, L.dpr * L.sx, L.dpr * L.sy);
}
export const toUnits = (cx, cy) => ({ x: (cx - L.sx) / L.u, y: (cy - L.sy) / L.u });
export const unitsToCss = (x, y) => ({ x: L.sx + x * L.u, y: L.sy + y * L.u });
// minimum touch radius in units (88 CSS px diameter)
export const minHit = () => 44 / L.u;

// ---------------------------------------------------------------- input
// Only the first active pointer is tracked; extra fingers/palms are ignored.
export const input = { id: null, down: false, x: 0, y: 0, t: 0 };

export function initInput(canvas, h) {
  const pt = (e) => { const p = toUnits(e.clientX, e.clientY); p.t = performance.now() / 1000; return p; };
  const end = (e) => {
    if (e.pointerId !== input.id) return;
    input.id = null; input.down = false;
    const p = pt(e);
    h.up(p);
  };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (input.id !== null) return;
    input.id = e.pointerId; input.down = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const p = pt(e);
    input.x = p.x; input.y = p.y;
    h.down(p);
  }, { passive: false });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== input.id) return;
    e.preventDefault();
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    for (const ev of (list && list.length ? list : [e])) {
      const p = pt(ev);
      input.x = p.x; input.y = p.y;
      h.move(p);
    }
  }, { passive: false });
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);
  const block = (e) => e.preventDefault();
  for (const ev of ['touchstart', 'touchmove', 'gesturestart', 'gesturechange', 'contextmenu', 'dblclick', 'selectstart']) {
    document.addEventListener(ev, block, { passive: false });
  }
}

export function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}
