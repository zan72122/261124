// end — snuggle, a red hanamaru over the clean plate, fanfare, (story illustration), replay.
import { TAU, rnd, ease, lerp, canvas2d, L } from '../engine.js';
import { cover, rrect } from '../sprite.js';
import { has } from '../assets.js';
import { fx, drawButton } from '../fx.js';
import { bubbles } from '../bubbles.js';
import { snd } from '../snd.js';
import { game, phase, wait, anim } from '../game.js';
import { createPlate, drawPlate } from '../plate.js';
import { drawTable, drawSpoon } from './serve.js';
import { PLATE_EAT, SPOON_EAT, SEATS } from './eat.js';

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

function grain() {
  const c = canvas2d(HS, HS), x = c.getContext('2d');
  for (let i = 0; i < 2600; i++) {
    x.fillStyle = `rgba(0,0,0,${rnd.range(0.25, 0.85)})`;
    x.beginPath(); x.ellipse(rnd() * HS, rnd() * HS, rnd.range(0.6, 2.2), rnd.range(0.4, 1.2), rnd() * TAU, 0, TAU); x.fill();
  }
  return c;
}

export default function end(carry) {
  let t = 0, fanT = -1, steamT = 0;
  const plate = carry && carry.plate ? carry.plate : createPlate(PLATE_EAT.x, PLATE_EAT.y, PLATE_EAT.w);
  plate.state = 'empty'; plate.eaten = null; plate.shapes = [];
  const pts = hanamaruPts(520 * 0.36);
  const H = canvas2d(HS, HS);
  const G = grain();
  let hk = 0, drawnK = -1;
  let hug = 0, replay = 0, replayOn = false;
  const D = 250;

  function renderHanamaru() {
    if (drawnK === hk) return;
    drawnK = hk;
    const x = H.getContext('2d');
    x.clearRect(0, 0, HS, HS);
    const s = HS / (EXT * 2);
    const n = Math.max(2, Math.floor(pts.length * hk));
    x.save();
    x.translate(HS / 2, HS / 2); x.scale(s, s);
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (const [w, col, ox, oy] of [[16, 'rgba(214,32,38,0.92)', 0, 0], [7, 'rgba(240,70,60,0.6)', -2.5, -2], [5, 'rgba(160,15,25,0.45)', 3, 3]]) {
      x.strokeStyle = col; x.lineWidth = w;
      x.beginPath(); x.moveTo(pts[0][0] + ox, pts[0][1] + oy);
      for (let i = 1; i < n; i++) x.lineTo(pts[i][0] + ox, pts[i][1] + oy);
      x.stroke();
    }
    x.restore();
    x.globalCompositeOperation = 'destination-out';
    x.drawImage(G, 0, 0);
    x.globalCompositeOperation = 'source-over';
  }

  async function script() {
    game.block = true;
    phase('snuggle');
    const m = bubbles.mama, g = bubbles.girl;
    m.place({ x: 500 - D / 2, y: 195, d: D }, 1.1);
    g.place({ x: 500 + D / 2, y: 195, d: D }, 1.1);
    m.setFace('mama_laugh'); g.setFace('girl_happy');
    // plate settles a little smaller to leave room for the replay button below it
    const x0 = plate.x, y0 = plate.y, w0 = plate.w;
    await anim(1.1, (k) => { plate.x = lerp(x0, 500, k); plate.y = lerp(y0, 600, k); plate.w = lerp(w0, 520, k); }, ease.inOutCubic);
    m.rk.kick(-3); g.rk.kick(3);
    m.rockAmp = 0.05; g.rockAmp = -0.05;
    snd.sfx('heart');
    fx.hearts(500, 140, 1, 'over', 2.6);
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
    if (has('story_hug')) {
      await wait(3.5);
      phase('story');
      await anim(1.2, (k) => { hug = k; }, ease.inOutSine);
      await wait(1.3);
    } else await wait(6);
    phase('replay');
    replayOn = true;
    anim(0.8, (k) => { replay = k; });
    game.block = false;
  }

  return {
    enter() {
      bubbles.mama.show('mama_laugh'); bubbles.girl.show('girl_happy');
      if (!carry) { bubbles.mama.place(SEATS.mama, 0); bubbles.girl.place(SEATS.girl, 0); }
      script();
    },
    exit() {
      for (const b of [bubbles.mama, bubbles.girl]) { b.rockAmp = 0; b.glow = 0; }
    },
    update(dt) {
      t += dt;
      if (fanT >= 0) {
        fanT += dt;
        steamT -= dt;
        if (steamT <= 0) {
          steamT = 1.2;
          bubbles.mama.jump(0.35); game.clock.after(0.2, () => bubbles.girl.jump(0.35));
          if (fanT < 12) fx.hearts(rnd.range(L.ex0 + 100, L.ex1 - 100), rnd.range(400, 900), 1, 'over', 1.2);
        }
        if (fanT > 3 && rnd() < dt * 0.6) { fx.petals(2); }
      }
    },
    draw(ctx) {
      drawTable(ctx);
      drawPlate(ctx, plate);
      drawSpoon(ctx, SPOON_EAT.x, SPOON_EAT.y, SPOON_EAT.rot, SPOON_EAT.w);
      if (hk > 0) {
        renderHanamaru();
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(H, plate.x - EXT, plate.y - EXT, EXT * 2, EXT * 2);
        ctx.restore();
        ctx.globalAlpha = 0.35;
        ctx.drawImage(H, plate.x - EXT, plate.y - EXT, EXT * 2, EXT * 2);
        ctx.globalAlpha = 1;
      }
    },
    drawOverlay(ctx) {
      if (hug > 0) {
        const m = 22;
        const x = L.ex0 + m, y = L.ey0 + m, w = L.ex1 - L.ex0 - m * 2, h = L.ey1 - L.ey0 - m * 2;
        ctx.save();
        ctx.globalAlpha = hug;
        ctx.fillStyle = 'rgba(40,20,5,0.5)';
        ctx.fillRect(L.ex0, L.ey0, L.ex1 - L.ex0, L.ey1 - L.ey0);
        ctx.fillStyle = '#fff3dc';
        rrect(ctx, x - 14, y - 14, w + 28, h + 28, 46); ctx.fill();
        ctx.save(); rrect(ctx, x, y, w, h, 34); ctx.clip();
        cover(ctx, 'story_hug', x, y, w, h, 1.02 + Math.sin(t * 0.2) * 0.02);
        ctx.restore();
        ctx.restore();
        if (rnd() < 0.05) fx.hearts(rnd.range(L.ex0 + 80, L.ex1 - 80), L.ey1 - rnd.range(60, 300), 1, 'over', 1.4);
        fx.drawParts(ctx, 'over');
      }
      if (replay > 0) drawButton(ctx, 500, 925, 70, 'replay', t, replay);
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

