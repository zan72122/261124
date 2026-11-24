// title — the curry plate filling the short side over a blurred copy of itself, a big play button.
import { L, rnd, canvas2d } from '../engine.js';
import { vignette } from '../sprite.js';
import { img } from '../assets.js';
import { fx, hint, drawButton } from '../fx.js';
import { bubbles } from '../bubbles.js';
import { snd } from '../snd.js';
import { game, phase } from '../game.js';
import { safe, frame, M, minBubble } from '../layout.js';

const PLATE_FRAC = 0.62; // plate width / image width in hero_curry
const PLATE_C = { x: 0.516, y: 0.52 }; // plate centre in the image (measured)

let BLUR = null, SHARP = null;
function prepare() {
  if (BLUR) return;
  // strong blur without ctx.filter: down to ~40 px, then let the up-scale smooth it
  BLUR = canvas2d(40, 40);
  BLUR.getContext('2d').drawImage(img('hero_curry'), 0, 0, 40, 40);
  // sharp copy with a feathered round edge so no rectangle shows against the backdrop
  const N = 900;
  SHARP = canvas2d(N, N);
  const x = SHARP.getContext('2d');
  x.drawImage(img('hero_curry'), 0, 0, N, N);
  x.globalCompositeOperation = 'destination-in';
  const g = x.createRadialGradient(N / 2, N / 2, N * 0.33, N / 2, N / 2, N * 0.48);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, N, N);
}

function plan() {
  const E = safe();
  const short = Math.min(E.w, E.h);
  const br = 150;
  let plateD = short * 0.92, cx = E.cx, cy, bx = E.cx, by, bub;
  if (E.h > E.w) {
    // portrait: girl bubble band on top, plate, big play button in the band below
    const d = Math.max(minBubble(), Math.min(300, E.h - plateD - 2 * br - 4 * M));
    plateD = Math.min(plateD, E.h - d - 2 * br - 4 * M);
    const group = d + M + plateD + M + 2 * br;
    const y0 = E.y0 + M + Math.max(0, (E.h - 2 * M - group) / 2);
    // the girl (stirring at her pot) is the one greeting the player: centred above the plate
    bub = { girl: { x: E.cx, y: y0 + d / 2, d }, mama: { x: E.x0 + M + d / 2, y: y0 + d / 2, d } };
    cy = y0 + d + M + plateD / 2;
    by = cy + plateD / 2 + M + br;
  } else {
    bub = frame({ w: plateD, h: plateD }, [], { chef: true }).bub;
    // landscape: the girl stands in the middle of the right-hand band, as big as it allows
    const bw = (E.w - plateD) / 2;
    if (bw > minBubble() + 2 * M) {
      const d = Math.min(bw - 2 * M, E.h * 0.5, 480);
      bub.girl = { x: E.x1 - bw / 2, y: E.cy - short * 0.03, d };
    }
    cy = E.cy - short * 0.03;
    by = E.y1 - br - M * 1.5;
  }
  return { cx, cy, S: plateD / PLATE_FRAC, plateD, bx, by, br, bub };
}

export default function title() {
  let t = 0, steamT = 0, leaving = false;
  let P = null;
  return {
    enter() {
      prepare();
      P = plan();
      bubbles.reset();
      bubbles.setHomes(P.bub);
      bubbles.girl.show('girl_smile');
      phase('title');
      hint.set({ type: 'tap', x: () => P.bx, y: () => P.by, r: P.br, glow: false });
    },
    update(dt) {
      t += dt; steamT -= dt;
      if (steamT <= 0) {
        steamT = 0.14;
        fx.steam(P.cx + rnd.range(-0.3, 0.3) * P.plateD, P.cy + rnd.range(-0.15, 0.15) * P.plateD, { size: P.plateD * 0.09, alpha: 0.3, vy: -45, life: 2.6 });
      }
    },
    draw(ctx) {
      const w = L.ex1 - L.ex0, h = L.ey1 - L.ey0;
      // blurred, darkened backdrop (cover)
      const k = Math.max(w, h) * 1.1;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(BLUR, (L.ex0 + L.ex1) / 2 - k / 2, (L.ey0 + L.ey1) / 2 - k / 2, k, k);
      ctx.fillStyle = 'rgba(25,12,4,0.45)'; ctx.fillRect(L.ex0, L.ey0, w, h);
      // sharp plate, gentle drift (never more than a few % of the plate)
      const z = 1 + Math.sin(t * 0.12) * 0.015;
      const S = P.S * z, dx = Math.sin(t * 0.09) * P.plateD * 0.012, dy = Math.cos(t * 0.07) * P.plateD * 0.01;
      ctx.drawImage(SHARP, P.cx - S * PLATE_C.x + dx, P.cy - S * PLATE_C.y + dy, S, S);
      vignette(ctx, 0.5, P.cx, P.cy);
    },
    drawTop(ctx) {
      drawButton(ctx, P.bx, P.by, P.br, 'play', t, leaving ? 0 : 1);
    },
    up() {
      if (leaving) return;
      leaving = true;
      snd.unlock().then(() => { snd.sfx('pop'); game.startBgm(); });
      fx.sparkleRing(P.bx, P.by, P.br, 14);
      hint.clear();
      phase('start');
      game.clock.wait(0.25).then(() => game.goto('home'));
    },
  };
}
