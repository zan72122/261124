// end — snuggle, a red hanamaru over the clean plate, fanfare, replay. (story_hug will never exist: not used.)
import { TAU, rnd, ease, lerp, canvas2d } from '../engine.js';
import { fx, drawButton } from '../fx.js';
import { bubbles } from '../bubbles.js';
import { snd } from '../snd.js';
import { game, phase, wait, anim } from '../game.js';
import { createPlate, drawPlate } from '../plate.js';
import { drawTable } from './serve.js';
import { eatLayout } from './eat.js';
import { safe, M } from '../layout.js';

const RB = 115; // replay button radius (≈230 diameter)

// the snuggling pair (≈360, overlapping) and the hanamaru plate are the centre; replay in a free band
function endLayout() {
  const E = safe();
  const o = {};
  if (E.h >= E.w) {
    const d = Math.min(360, (E.w - 2 * M) / 1.9);
    const pw = Math.min(780, E.w - 2 * M, E.h - d - 2 * RB - 5 * M);
    const group = d + M + pw + M + 2 * RB;
    const y0 = E.y0 + Math.max(M, (E.h - group) / 2);
    o.pair = { x: E.cx, y: y0 + d / 2, d };
    o.plate = { x: E.cx, y: y0 + d + M + pw / 2, w: pw };
    o.replay = { x: E.cx, y: o.plate.y + pw / 2 + M + RB };
    return o;
  }
  const pw = Math.min(780, E.h - 2 * M);
  for (const d of [360, 330, 300, 270]) {
    const need = 1.9 * d + pw + 2 * RB + 4 * M;
    if (need > E.w) continue;
    const x0 = E.cx - need / 2 + M;
    o.pair = { x: x0 + 0.95 * d, y: E.cy, d };
    o.plate = { x: x0 + 1.9 * d + M + pw / 2, y: E.cy, w: pw };
    o.replay = { x: o.plate.x + pw / 2 + M + RB, y: E.cy };
    return o;
  }
  const pw2 = Math.min(780, E.h - 2 * RB - 3 * M);
  const d = Math.min(360, (E.w - pw2 - 3 * M) / 1.9);
  const gw = 1.9 * d + M + pw2, x0 = E.cx - gw / 2;
  o.pair = { x: x0 + 0.95 * d, y: E.cy, d };
  o.plate = { x: x0 + 1.9 * d + M + pw2 / 2, y: E.y0 + M + pw2 / 2, w: pw2 };
  o.replay = { x: o.plate.x, y: o.plate.y + pw2 / 2 + M + RB };
  return o;
}

const HS = 560; // hanamaru canvas size (px) covering 2*EXT units
const EXT = 300;

// spiral (~3 turns) from the centre flowing into 7 round petal loops
function hanamaruPts(R) {
  const pts = [];
  const petals = 7, rho = R * 0.2, rIn = R - rho;
  const turns = 3;
  const N1 = 260;
  for (let i = 0; i <= N1; i++) {
    const k = i / N1;
    const a = k * turns * TAU;
    const r = rIn * Math.pow(k, 0.85);
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const N2 = 420;
  for (let i = 1; i <= N2; i++) {
    const k = i / N2;
    const a = k * TAU * 1.04;
    // epicycle: small loops riding on the circle
    const x = Math.cos(a) * R - Math.cos(a * (petals + 1)) * rho;
    const y = Math.sin(a) * R - Math.sin(a * (petals + 1)) * rho;
    pts.push([x, y]);
  }
  // crayon wobble
  for (let i = 0; i < pts.length; i++) {
    const w = Math.sin(i * 0.21) * 2.2 + Math.sin(i * 0.057 + 1) * 3;
    pts[i][0] += w; pts[i][1] += Math.cos(i * 0.17) * 2.2;
  }
  return pts;
}

// crayon grain: the same random speckle every time (built once, not on every visit to the scene)
let GRAIN = null;
function grain() {
  if (GRAIN) return GRAIN;
  const c = canvas2d(HS, HS), x = c.getContext('2d');
  for (let i = 0; i < 2600; i++) {
    x.fillStyle = `rgba(0,0,0,${rnd.range(0.25, 0.85)})`;
    x.beginPath(); x.ellipse(rnd() * HS, rnd() * HS, rnd.range(0.6, 2.2), rnd.range(0.4, 1.2), rnd() * TAU, 0, TAU); x.fill();
  }
  return (GRAIN = c);
}

// the three crayon strokes, each drawn opaque into its own layer and only extended by the new
// segments each frame; the visible mark = layers at their alpha, minus the grain
const STROKES = [[16, 'rgb(214,32,38)', 0.92, 0, 0], [7, 'rgb(240,70,60)', 0.6, -2.5, -2], [5, 'rgb(160,15,25)', 0.45, 3, 3]];
let LAYERS = null;
function layers() { return LAYERS || (LAYERS = STROKES.map(() => canvas2d(HS, HS))); }

export default function end(carry) {
  let t = 0, fanT = -1, steamT = 0;
  const EL = endLayout();
  const plate = carry && carry.plate ? carry.plate : (() => { const p = eatLayout().plate; return createPlate(p.x, p.y, p.w); })();
  plate.state = 'empty'; plate.eaten = null; plate.shapes = [];
  const pts = hanamaruPts(520 * 0.36);
  const H = canvas2d(HS, HS);
  const G = grain();
  let hk = 0, drawnK = -1;
  let replay = 0, replayOn = false;

  const LY = layers();
  for (const c of LY) c.getContext('2d').clearRect(0, 0, HS, HS);
  let drawnN = 1;
  function renderHanamaru() {
    if (drawnK === hk) return;
    drawnK = hk;
    const s = HS / (EXT * 2);
    const n = Math.max(2, Math.floor(pts.length * hk));
    if (n > drawnN) {
      STROKES.forEach(([w, col, , ox, oy], i) => {
        const x = LY[i].getContext('2d');
        x.save();
        x.translate(HS / 2, HS / 2); x.scale(s, s);
        x.lineCap = 'round'; x.lineJoin = 'round';
        x.strokeStyle = col; x.lineWidth = w;
        x.beginPath(); x.moveTo(pts[drawnN - 1][0] + ox, pts[drawnN - 1][1] + oy);
        for (let j = drawnN; j < n; j++) x.lineTo(pts[j][0] + ox, pts[j][1] + oy);
        x.stroke();
        x.restore();
      });
      drawnN = n;
    }
    const x = H.getContext('2d');
    x.clearRect(0, 0, HS, HS);
    STROKES.forEach(([, , a], i) => { x.globalAlpha = a; x.drawImage(LY[i], 0, 0); });
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'destination-out';
    x.drawImage(G, 0, 0);
    x.globalCompositeOperation = 'source-over';
  }

  async function script() {
    game.block = true;
    phase('snuggle');
    const m = bubbles.mama, g = bubbles.girl;
    const P = EL.pair, d = P.d;
    m.place({ x: P.x - d * 0.45, y: P.y, d }, 1.1);
    g.place({ x: P.x + d * 0.45, y: P.y, d }, 1.1);
    m.setFace('mama_laugh'); g.setFace('girl_happy');
    const x0 = plate.x, y0 = plate.y, w0 = plate.w;
    await anim(1.1, (k) => { plate.x = lerp(x0, EL.plate.x, k); plate.y = lerp(y0, EL.plate.y, k); plate.w = lerp(w0, EL.plate.w, k); }, ease.inOutCubic);
    m.rk.kick(-3); g.rk.kick(3);
    m.rockAmp = 0.05; g.rockAmp = -0.05;
    snd.sfx('heart');
    fx.heartAt(P.x, P.y - d * 0.55, 0, -60, d * 0.16);
    await wait(0.8);
    phase('hanamaru');
    snd.sfx('hanamaru');
    await anim(1.5, (k) => { hk = k; }, ease.inOutSine);
    hk = 1;
    phase('fanfare');
    snd.sfx('fanfare');
    snd.sfx('confetti');
    fanT = 0;
    fx.confetti(90);
    fx.petals(24);
    fx.rain(['carrot_flower', 'carrot_star', 'carrot_heart'], 16);
    fx.sparkle(plate.x, plate.y, 24, plate.w * 0.4, 'over');
    m.jump(1); g.jump(1);
    await wait(6);
    phase('replay');
    replayOn = true;
    anim(0.8, (k) => { replay = k; });
    game.block = false;
  }

  return {
    enter() {
      bubbles.mama.show('mama_laugh'); bubbles.girl.show('girl_happy');
      if (!carry) { const s = eatLayout().seats; bubbles.mama.place(s.mama, 0); bubbles.girl.place(s.girl, 0); }
      script();
    },
    exit() {
      for (const b of [bubbles.mama, bubbles.girl]) { b.rockAmp = 0; b.glow = 0; b.boost = 0; }
    },
    update(dt) {
      t += dt;
      if (fanT >= 0) {
        fanT += dt;
        steamT -= dt;
        if (steamT <= 0) {
          steamT = 1.2;
          bubbles.mama.jump(0.35); game.clock.after(0.2, () => bubbles.girl.jump(0.35));
          if (fanT < 12) { const P = EL.pair; fx.heartAt(P.x + rnd.range(-0.3, 0.3) * P.d, P.y - P.d * 0.55, rnd.range(-40, 40), -80, P.d * 0.1); }
        }
        if (fanT > 3 && rnd() < dt * 0.6) { fx.petals(2); }
      }
    },
    draw(ctx) {
      drawTable(ctx);
      drawPlate(ctx, plate);
      if (hk > 0) {
        renderHanamaru();
        const e = EXT * plate.w / 520; // the mark was authored for a 520-wide plate
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(H, plate.x - e, plate.y - e, e * 2, e * 2);
        ctx.restore();
        ctx.globalAlpha = 0.35;
        ctx.drawImage(H, plate.x - e, plate.y - e, e * 2, e * 2);
        ctx.globalAlpha = 1;
      }
    },
    drawOverlay(ctx) {
      if (replay > 0) drawButton(ctx, EL.replay.x, EL.replay.y, RB, 'replay', t, replay);
    },
    down() {
      if (!replayOn) return;
      // any tap restarts; the button is just the visual cue
      replayOn = false;
      snd.sfx('pop');
      game.goto('home');
    },
  };
}

