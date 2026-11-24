// placeholders.js — soft coloured stand-ins for any image that failed to load.
import { canvas2d, TAU } from './engine.js';

// name -> [width, height, colour, shape]  shape: 'o' ellipse, 'r' rounded rect, 'full' opaque square
export const PH = {
  bg_counter: [512, 512, '#d8b98e', 'full'], bg_table: [512, 512, '#e9dcc8', 'full'], bg_stove: [512, 512, '#1d1d1f', 'full'],
  hero_curry: [512, 512, '#c98a2a', 'full'], tex_curry: [256, 256, '#a8611f', 'full'], tex_rice: [256, 256, '#f4f1e8', 'full'],
  carrot: [480, 150, '#f08a24', 'o'], potato: [200, 260, '#cda46c', 'o'], onion: [240, 220, '#d9a868', 'o'],
  basket: [500, 500, '#b98a4c', 'o'], bowl_water: [500, 500, '#cfd8dc', 'o'], board: [520, 420, '#e2c495', 'r'],
  knife: [600, 80, '#c7ccd0', 'r'], pot: [600, 500, '#a9aeb3', 'o'], lid: [400, 400, '#b8bcc0', 'o'], dish: [300, 300, '#f6f6f4', 'o'],
  jug: [300, 240, '#cfe6f3', 'o'], spatula: [400, 120, '#c8975e', 'r'], ladle_curry: [400, 160, '#9a5a2a', 'r'],
  shamoji_rice: [200, 420, '#efece4', 'o'], spoon: [100, 400, '#c9cdd1', 'r'],
  roux_tray: [300, 300, '#5a3216', 'r'], plate_empty: [600, 600, '#fbfbf8', 'o'], plate_rice: [600, 600, '#fbfbf8', 'o'],
  plate_full: [600, 600, '#fbfbf8', 'o'],
};
const PIECE = { carrot_slice: '#f08a24', potato_chunk: '#ecd28d', onion_wedge: '#f2ead0', meat_raw: '#c0393b', meat_cooked: '#7a4a30', roux: '#5c3214' };
const FACE = { girl: '#ffd9c2', mama: '#f6d2b8' };

function spec(n) {
  if (PH[n]) return PH[n];
  for (const k in PIECE) if (n.startsWith(k)) return [160, 140, PIECE[k], 'o'];
  if (/^carrot_(flower|star|heart)/.test(n)) return [160, 160, '#f07a14', 'o'];
  if (/^(girl|mama)_/.test(n)) return [256, 256, FACE[n.split('_')[0]], 'face'];
  return [200, 200, '#ccc', 'o'];
}

export function placeholder(n) {
  const [w, h, col, shape] = spec(n);
  const c = canvas2d(w, h), x = c.getContext('2d');
  if (shape === 'full') {
    x.fillStyle = col; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      x.fillStyle = `rgba(${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},0.04)`;
      x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 10 + Math.random() * 60, 0, TAU); x.fill();
    }
    return c;
  }
  if (shape === 'face') {
    x.fillStyle = '#f3e3cc'; x.fillRect(0, 0, w, h);
    x.fillStyle = n.startsWith('girl') ? '#3a2418' : '#4a2c1c';
    x.beginPath(); x.arc(w / 2, h * 0.5, w * 0.4, 0, TAU); x.fill();
    x.fillStyle = col; x.beginPath(); x.ellipse(w / 2, h * 0.58, w * 0.3, h * 0.32, 0, 0, TAU); x.fill();
    x.fillStyle = '#2a1a12';
    const open = /wow|aan/.test(n), tired = /tired/.test(n);
    for (const s of [-1, 1]) {
      x.beginPath();
      if (tired) x.ellipse(w / 2 + s * w * 0.11, h * 0.55, w * 0.04, h * 0.012, 0, 0, TAU);
      else x.arc(w / 2 + s * w * 0.11, h * 0.54, w * 0.03, 0, TAU);
      x.fill();
    }
    x.strokeStyle = '#a0302a'; x.lineWidth = w * 0.02; x.beginPath();
    if (open) { x.fillStyle = '#a0302a'; x.arc(w / 2, h * 0.72, w * 0.05, 0, TAU); x.fill(); }
    else if (tired) { x.moveTo(w * 0.45, h * 0.73); x.lineTo(w * 0.55, h * 0.73); x.stroke(); }
    else { x.arc(w / 2, h * 0.68, w * 0.07, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke(); }
    return c;
  }
  const g = x.createRadialGradient(w * 0.4, h * 0.38, 0, w / 2, h / 2, Math.max(w, h) * 0.55);
  g.addColorStop(0, '#ffffff55'); g.addColorStop(0.35, col); g.addColorStop(1, col);
  x.fillStyle = g;
  x.beginPath();
  if (shape === 'r') { const r = Math.min(w, h) * 0.2; x.moveTo(r, 2); x.arcTo(w - 2, 2, w - 2, h - 2, r); x.arcTo(w - 2, h - 2, 2, h - 2, r); x.arcTo(2, h - 2, 2, 2, r); x.arcTo(2, 2, w - 2, 2, r); }
  else x.ellipse(w / 2, h / 2, w / 2 - 3, h / 2 - 3, 0, 0, TAU);
  x.fill();
  if (/^plate_(rice|full)/.test(n)) {
    x.fillStyle = '#f2efe6'; x.beginPath(); x.ellipse(w * 0.4, h / 2, w * 0.2, h * 0.24, 0, 0, TAU); x.fill();
    if (n === 'plate_full') { x.fillStyle = '#b06a22'; x.beginPath(); x.ellipse(w * 0.6, h / 2, w * 0.2, h * 0.26, 0, 0, TAU); x.fill(); }
  }
  return c;
}
