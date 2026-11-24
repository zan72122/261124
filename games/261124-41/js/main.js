// main.js — boot, loader, frame loop, scene manager, debug hooks.
import { L, layout, stageTransform, initInput, clamp, TAU, unitsToCss } from './engine.js';
import { loadAssets } from './assets.js';
import { fx, hint, drawIris } from './fx.js';
import { bubbles } from './bubbles.js';
import { snd } from './snd.js';
import { game } from './game.js';
import { drawVectorCarrot } from './shapes.js';

import title from './scenes/title.js';
import home from './scenes/home.js';
import wash from './scenes/wash.js';
import cut from './scenes/cut.js';
import stamp from './scenes/stamp.js';
import pot from './scenes/pot.js';
import roux from './scenes/roux.js';
import serve from './scenes/serve.js';
import eat from './scenes/eat.js';
import end from './scenes/end.js';

const SCENES = { title, home, wash, cut, stamp, pot, roux, serve, eat, end };
const ORDER = Object.keys(SCENES);

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let loadK = 0, loaded = false;
let trans = null; // { k, dir, id, opts }
let downDelivered = false;
let bgmStarted = false;

const debug = { get scene() { return game.id; }, get phase() { return game.phase; }, goto: (id) => go(id, { fade: false }), ready: false, toCss: unitsToCss };
window.__game = debug;

if (game.params.get('mute') === '1') snd.setMuted(true);

function resize() { layout(canvas); }
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();

// audio unlock must happen inside a user gesture: first pointerup AND touchend
const unlock = () => {
  snd.unlock().then(() => {
    if (!bgmStarted && game.id && game.id !== 'title') { bgmStarted = true; snd.bgmStart(); }
  });
};
window.addEventListener('pointerup', unlock, true);
window.addEventListener('touchend', unlock, true);

export function startBgm() { bgmStarted = true; snd.bgmStart(); }
game.startBgm = startBgm;

function go(id, opts = {}) {
  if (!SCENES[id]) return;
  if (opts.fade === false) { switchTo(id, opts); return; }
  if (trans) return;
  trans = { k: 0, dir: 1, id, opts };
}
game.goto = go;

function switchTo(id, opts) {
  if (game.scene && game.scene.exit) game.scene.exit();
  game.clock.clear();
  fx.clear();
  hint.clear();
  game.block = false;
  game.phase = id;
  game.id = id;
  game.scene = SCENES[id](opts.carry || game.carry || null);
  game.carry = null;
  if (game.scene.enter) game.scene.enter();
}

initInput(canvas, {
  down(p) {
    fx.ripple(p.x, p.y);
    snd.sfx('tap', { vol: 0.35 });
    hint.touch();
    downDelivered = !!(loaded && !trans && !game.block && game.scene);
    if (downDelivered && game.scene.down) game.scene.down(p);
  },
  move(p) { if (downDelivered && !trans && game.scene && game.scene.move) game.scene.move(p); },
  up(p) {
    if (downDelivered && game.scene && game.scene.up) game.scene.up(p);
    downDelivered = false;
  },
});

// ---------------------------------------------------------------- loop
let last = performance.now(), raf = 0, running = true;
function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  update(dt);
  render();
}
function update(dt) {
  game.time += dt;
  game.world.update(dt);
  if (!loaded) return;
  if (trans) {
    trans.k += (dt / 0.3) * trans.dir;
    if (trans.dir > 0 && trans.k >= 1) { trans.k = 1; trans.dir = -1; switchTo(trans.id, trans.opts); }
    else if (trans.dir < 0 && trans.k <= 0) trans = null;
  }
  game.clock.update(dt);
  if (game.scene && game.scene.update) game.scene.update(dt);
  bubbles.update(dt);
  fx.update(dt);
  hint.update(dt);
}
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#2a1c12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  stageTransform(ctx);
  if (!loaded) { drawLoader(); return; }
  const s = game.scene;
  if (s && s.draw) s.draw(ctx);
  fx.drawSteam(ctx, 'world');
  fx.drawParts(ctx, 'world');
  if (s && s.drawTop) s.drawTop(ctx);
  hint.draw(ctx, game.time);
  bubbles.draw(ctx);
  fx.drawParts(ctx, 'over');
  fx.drawSteam(ctx, 'over');
  if (s && s.drawOverlay) s.drawOverlay(ctx);
  if (trans) drawIris(ctx, clamp(trans.k, 0, 1));
  fx.drawRipples(ctx);
}

function drawLoader() {
  const t = game.time;
  const k = Math.min(loadK, 1);
  ctx.fillStyle = '#fff3df';
  ctx.fillRect(L.ex0, L.ey0, L.ex1 - L.ex0, L.ey1 - L.ey0);
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,160,80,0.25)'; ctx.lineWidth = 22;
  ctx.beginPath(); ctx.arc(500, 500, 150, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#ff8a2a';
  ctx.beginPath(); ctx.arc(500, 500, 150, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0.02, k)); ctx.stroke();
  const b = Math.abs(Math.sin(t * 4));
  ctx.fillStyle = 'rgba(120,60,20,0.15)';
  ctx.beginPath(); ctx.ellipse(500, 565, 40 - b * 10, 10, 0, 0, TAU); ctx.fill();
  drawVectorCarrot(ctx, 500, 490 - b * 50, 0.95 + (1 - b) * 0.05, Math.sin(t * 2) * 0.2 + 0.4);
}

function onVis() {
  const v = document.getElementById('v');
  if (document.hidden) {
    running = false; cancelAnimationFrame(raf);
    if (v && !v.paused) { v.pause(); v.dataset.resume = '1'; }
  } else if (!running) {
    running = true; last = performance.now(); raf = requestAnimationFrame(frame);
    if (v && v.dataset.resume) { delete v.dataset.resume; v.play().catch(() => {}); }
  }
}
document.addEventListener('visibilitychange', onVis);
window.addEventListener('pagehide', () => { running = false; cancelAnimationFrame(raf); });
window.addEventListener('pageshow', () => { if (!running && !document.hidden) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } });

raf = requestAnimationFrame(frame);
fx.init();
loadAssets((k) => { loadK = k; }).then(() => {
  loaded = true;
  const want = game.params.get('scene');
  const first = want && ORDER.includes(want) ? want : 'title';
  switchTo(first, {});
  trans = { k: 1, dir: -1, id: first, opts: {} };
  debug.ready = true;
}).catch((e) => { console.error(e); });
