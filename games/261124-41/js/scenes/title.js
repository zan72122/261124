// title — hero curry with rising steam, play button.
import { L, rnd } from '../engine.js';
import { cover, vignette } from '../sprite.js';
import { fx, hint, drawButton } from '../fx.js';
import { bubbles } from '../bubbles.js';
import { snd } from '../snd.js';
import { game, phase } from '../game.js';

export default function title() {
  let t = 0, steamT = 0, leaving = false;
  const btn = { x: 500, y: 800, r: 115 };
  return {
    enter() {
      bubbles.reset();
      bubbles.girl.show('girl_smile');
      phase('title');
      hint.set({ type: 'tap', x: btn.x, y: btn.y, r: btn.r, glow: false });
    },
    update(dt) {
      t += dt; steamT -= dt;
      if (steamT <= 0) {
        steamT = 0.16;
        fx.steam(500 + rnd.range(-180, 180), 470 + rnd.range(-80, 80), { size: 70, alpha: 0.32, vy: -45, life: 2.6 });
      }
    },
    draw(ctx) {
      const w = L.ex1 - L.ex0, h = L.ey1 - L.ey0;
      const z = 1.06 + Math.sin(t * 0.12) * 0.04;
      cover(ctx, 'hero_curry', L.ex0, L.ey0, w, h, z, Math.sin(t * 0.09) * 20, Math.cos(t * 0.07) * 14);
      vignette(ctx, 0.45);
    },
    drawTop(ctx) {
      drawButton(ctx, btn.x, btn.y, btn.r, 'play', t, leaving ? 0 : 1);
    },
    up() {
      if (leaving) return;
      leaving = true;
      snd.unlock().then(() => { snd.sfx('pop'); game.startBgm(); });
      fx.sparkle(btn.x, btn.y, 12, 80, 'over');
      hint.clear();
      phase('start');
      game.clock.wait(0.25).then(() => game.goto('home'));
    },
  };
}
