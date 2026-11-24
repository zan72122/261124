import * as THREE from 'three';

export const clock = { time: 0 };

const tweens = [];
const waiters = [];

export const ease = {
  linear: k => k,
  inOut: k => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2),
  out: k => 1 - Math.pow(1 - k, 3),
  in: k => k * k * k,
  back: k => { const c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
  bounce: k => {
    const n = 7.5625, d = 2.75;
    if (k < 1 / d) return n * k * k;
    if (k < 2 / d) return n * (k -= 1.5 / d) * k + 0.75;
    if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + 0.9375;
    return n * (k -= 2.625 / d) * k + 0.984375;
  },
};

export function tween(dur, fn, e = ease.inOut) {
  return new Promise(res => {
    if (dur <= 0) { fn(1); res(); return; }
    tweens.push({ t: 0, dur, fn, e, res });
  });
}
export const wait = s => tween(s, () => {});
export function until(pred) {
  return new Promise(res => { if (pred()) res(); else waiters.push({ pred, res }); });
}

export function updateTweens(dt) {
  for (let i = 0; i < tweens.length; i++) {
    const w = tweens[i];
    w.t += dt;
    const k = Math.min(1, w.t / w.dur);
    w.fn(w.e(k), k);
    if (k >= 1) { tweens.splice(i, 1); i--; w.res(); }
  }
  for (let i = 0; i < waiters.length; i++) {
    if (waiters[i].pred()) { const w = waiters[i]; waiters.splice(i, 1); i--; w.res(); }
  }
}

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = arr => arr[(Math.random() * arr.length) | 0];
export const lerp = (a, b, k) => a + (b - a) * k;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));

export function canvasTex(w, h, draw, { repeat = null, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// subtle fabric / paint noise
export function noiseTex(base, amount = 14, size = 256, repeat = [2, 2]) {
  return canvasTex(size, size, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * amount;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }, { repeat });
}

export function woodFloorTex() {
  return canvasTex(1024, 1024, (ctx, w, h) => {
    const plankH = 128;
    for (let y = 0; y < h; y += plankH) {
      let x = -((y / plankH) % 2) * 300;
      while (x < w) {
        const len = 380 + Math.random() * 300;
        const l = 62 + Math.random() * 10;
        ctx.fillStyle = `hsl(${30 + Math.random() * 6},${42 + Math.random() * 10}%,${l}%)`;
        ctx.fillRect(x, y, len, plankH);
        for (let g = 0; g < 26; g++) {
          ctx.strokeStyle = `rgba(110,70,35,${0.04 + Math.random() * 0.07})`;
          ctx.lineWidth = 1 + Math.random() * 2;
          ctx.beginPath();
          const gy = y + Math.random() * plankH;
          ctx.moveTo(x, gy);
          ctx.bezierCurveTo(x + len * 0.3, gy + rand(-6, 6), x + len * 0.6, gy + rand(-6, 6), x + len, gy + rand(-4, 4));
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(70,40,20,0.35)';
        ctx.fillRect(x, y, 3, plankH);
        x += len;
      }
      ctx.fillStyle = 'rgba(70,40,20,0.3)';
      ctx.fillRect(0, y, w, 3);
    }
  }, { repeat: [3, 3] });
}

export function woodTex(hue = 32, light = 66, repeat = [1, 1]) {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = `hsl(${hue},40%,${light}%)`;
    ctx.fillRect(0, 0, w, h);
    for (let g = 0; g < 90; g++) {
      ctx.strokeStyle = `rgba(120,75,35,${0.03 + Math.random() * 0.08})`;
      ctx.lineWidth = 1 + Math.random() * 3;
      ctx.beginPath();
      const gy = Math.random() * h;
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(w * 0.3, gy + rand(-12, 12), w * 0.6, gy + rand(-12, 12), w, gy + rand(-8, 8));
      ctx.stroke();
    }
  }, { repeat });
}

// Rounded box: subdivided box whose vertices are pushed onto a rounded shell.
export function roundedBox(w, h, d, r, seg = 3) {
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const p = g.attributes.position;
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  const v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(clamp(v.x, -hw, hw), clamp(v.y, -hh, hh), clamp(v.z, -hd, hd));
    v.sub(c);
    if (v.lengthSq() > 0) v.normalize().multiplyScalar(r);
    v.add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function star(ctx, cx, cy, r1, r2, n = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = rot + (i * Math.PI) / n;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}

// Picture symbols used on lockers & bag tags (no letters).
export function drawSymbol(ctx, kind, cx, cy, s) {
  ctx.save();
  ctx.lineJoin = 'round';
  if (kind === 'star') {
    ctx.fillStyle = '#ffc928'; ctx.strokeStyle = '#e09000'; ctx.lineWidth = s * 0.06;
    star(ctx, cx, cy + s * 0.04, s * 0.48, s * 0.22); ctx.fill(); ctx.stroke();
  } else if (kind === 'flower') {
    ctx.fillStyle = '#ff7fb0';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * s * 0.24, cy + Math.sin(a) * s * 0.24, s * 0.2, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(cx, cy, s * 0.15, 0, 7); ctx.fill();
  } else if (kind === 'apple') {
    ctx.fillStyle = '#e8322f';
    ctx.beginPath(); ctx.arc(cx - s * 0.14, cy + s * 0.06, s * 0.3, 0, 7); ctx.arc(cx + s * 0.14, cy + s * 0.06, s * 0.3, 0, 7); ctx.fill();
    ctx.fillStyle = '#6b3d1c'; ctx.fillRect(cx - s * 0.03, cy - s * 0.38, s * 0.06, s * 0.16);
    ctx.fillStyle = '#4caf3a'; ctx.beginPath(); ctx.ellipse(cx + s * 0.12, cy - s * 0.3, s * 0.13, s * 0.06, -0.5, 0, 7); ctx.fill();
  } else if (kind === 'fish') {
    ctx.fillStyle = '#3aa0f0';
    ctx.beginPath(); ctx.ellipse(cx - s * 0.05, cy, s * 0.32, s * 0.2, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + s * 0.22, cy); ctx.lineTo(cx + s * 0.46, cy - s * 0.2); ctx.lineTo(cx + s * 0.46, cy + s * 0.2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx - s * 0.2, cy - s * 0.04, s * 0.06, 0, 7); ctx.fill();
    ctx.fillStyle = '#123'; ctx.beginPath(); ctx.arc(cx - s * 0.2, cy - s * 0.04, s * 0.03, 0, 7); ctx.fill();
  } else if (kind === 'car') {
    ctx.fillStyle = '#7d5bd6';
    ctx.beginPath(); ctx.roundRect(cx - s * 0.42, cy - s * 0.05, s * 0.84, s * 0.26, s * 0.08); ctx.fill();
    ctx.beginPath(); ctx.roundRect(cx - s * 0.24, cy - s * 0.27, s * 0.46, s * 0.26, s * 0.1); ctx.fill();
    ctx.fillStyle = '#cfe8ff'; ctx.fillRect(cx - s * 0.16, cy - s * 0.2, s * 0.14, s * 0.14); ctx.fillRect(cx + s * 0.02, cy - s * 0.2, s * 0.14, s * 0.14);
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(cx - s * 0.22, cy + s * 0.22, s * 0.1, 0, 7); ctx.arc(cx + s * 0.22, cy + s * 0.22, s * 0.1, 0, 7); ctx.fill();
  }
  ctx.restore();
}

export function symbolTex(kind, bg = '#ffffff') {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(8, 8, w - 16, h - 16, 40); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 6; ctx.stroke();
    drawSymbol(ctx, kind, w / 2, h / 2, 190);
  });
}
