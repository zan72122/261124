// main.js — boot, loader, frame loop, scene manager, debug hooks.
import { L, layout, stageTransform, initInput, clamp, TAU, unitsToCss, getQuality, setQuality } from './engine.js';
import { loadAssets, sceneReady, whenSceneReady, sceneProgress, afterAll } from './assets.js';
import { fx, hint, drawIris } from './fx.js';
import { bubbles } from './bubbles.js';
import { snd } from './snd.js';
import { game } from './game.js';
import { layoutKey } from './layout.js';
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
// opaque canvas: the compositor never has to blend it with the page
const ctx = canvas.getContext('2d', { alpha: false });
let loadK = 0, loaded = false;
let trans = null; // { k, dir, id, opts }
let downDelivered = false;
let bgmStarted = false;

const debug = { get scene() { return game.id; }, get phase() { return game.phase; }, goto: (id) => whenSceneReady(id).then(() => go(id, { fade: false })), ready: false, toCss: unitsToCss,
  // for automated play-throughs: where the hint currently points
  hint: () => { const s = hint.spec; return s ? { type: s.type, x: hint.pos(s.x), y: hint.pos(s.y), x2: s.x2 != null ? hint.pos(s.x2) : null, y2: s.y2 != null ? hint.pos(s.y2) : null, r: s.r || 80 } : null; },
  get block() { return game.block; } };
window.__game = debug;

if (game.params.get('mute') === '1') snd.setMuted(true);

function resize() { layout(canvas); if (loaded) checkRelayout(); }
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();

// audio unlock must happen inside a user gesture: first pointerup AND touchend
// (the video is warmed on the first gesture after all pictures are in, so it never competes with them)
let warmed = false, picturesIn = false;
const unlock = () => {
  if (!warmed && picturesIn) { warmed = true; warmVideo(); }
  snd.unlock().then(() => {
    if (!bgmStarted && game.id && game.id !== 'title') { bgmStarted = true; snd.bgmStart(); }
  });
};
window.addEventListener('pointerup', unlock, true);
window.addEventListener('touchend', unlock, true);

export function startBgm() { bgmStarted = true; snd.bgmStart(); }
game.startBgm = startBgm;

// iOS: start + pause the muted video inside the first gesture so it is fetched and decoded long before the cut-scene
function warmVideo() {
  const v = document.getElementById('v');
  if (!v) return;
  try {
    v.muted = true;
    const p = v.play();
    const stop = () => { try { v.pause(); v.currentTime = 0; } catch (e) { /* ignore */ } };
    if (p && p.then) p.then(stop, () => {}); else stop();
  } catch (e) { /* ignore */ }
}

// rotation / big size change: restart the running scene so its layout is recomputed
let layKey = '', relayTimer = 0;
function checkRelayout() {
  const k = layoutKey();
  if (!layKey) { layKey = k; return; }
  if (k === layKey) return;
  layKey = k;
  clearTimeout(relayTimer);
  relayTimer = setTimeout(() => { if (loaded && game.id && !trans && !/cutscene/.test(game.phase)) go(game.id, { carry: null, fade: true }); }, 350);
}

function go(id, opts = {}) {
  if (!SCENES[id]) return;
  if (opts.fade === false) { switchTo(id, opts); return; }
  if (trans) return;
  trans = { k: 0, dir: 1, id, opts };
}
game.goto = go;

function switchTo(id, opts) {
  fw.hold = 1.5;
  if (game.scene && game.scene.exit) game.scene.exit(id);
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
  if (fw.apply) { fw.apply = false; layout(canvas); }  // resize right before drawing: no blank frame
  const t0 = performance.now();
  update(dt);
  render();
  watchFrame(now, performance.now() - t0);
}

// Safety net for slower iPhones/iPads: if frames keep arriving late AND the frame work itself is heavy,
// render at a slightly lower resolution (never below 1.5x on retina screens). A plain 30 fps cap
// (Low Power Mode) has light work and is left alone.
const fw = { last: 0, gaps: [], work: [], hold: 1.5, steps: 0, apply: false };
function watchFrame(now, work) {
  if (!loaded || trans || document.hidden || /cutscene/.test(game.phase)) { fw.gaps.length = 0; fw.work.length = 0; fw.last = now; return; }
  if (fw.hold > 0) { fw.hold -= Math.min(0.1, (now - fw.last) / 1000); fw.last = now; return; }
  fw.gaps.push(now - fw.last); fw.work.push(work); fw.last = now;
  if (fw.gaps.length < 120) return;
  const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  const gap = med(fw.gaps), w = med(fw.work);
  fw.gaps.length = 0; fw.work.length = 0;
  const q = getQuality(), dpr0 = Math.min(window.devicePixelRatio || 1, 2);
  if (gap > 22 && w > 6 && fw.steps < 3 && dpr0 * q * 0.85 >= Math.min(1.5, dpr0) - 1e-3) {
    fw.steps++;
    setQuality(q * 0.85);
    fw.apply = true;
    fw.hold = 2;
  }
}
function update(dt) {
  game.time += dt;
  game.world.update(dt);
  if (!loaded) return;
  if (trans) {
    trans.k += (dt / 0.3) * trans.dir;
    if (trans.dir > 0 && trans.k >= 1) {
      trans.k = 1;
      // the next scene's pictures are still streaming in: stay behind the closed iris with the loader
      if (!sceneReady(trans.id)) { trans.wait = (trans.wait || 0) + dt; loadK = sceneProgress(trans.id); }
      else { trans.wait = 0; trans.dir = -1; switchTo(trans.id, trans.opts); }
    }
    else if (trans.dir < 0 && trans.k <= 0) trans = null;
  }
  game.clock.update(dt);
  if (game.scene && game.scene.update) game.scene.update(dt);
  bubbles.update(dt);
  fx.update(dt);
  hint.update(dt);
}
function render() {
  const s = game.scene;
  // every scene paints a full-screen backdrop first, so the clear is only needed before that
  if (!loaded || !s || !s.draw) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#2a1c12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  stageTransform(ctx);
  if (!loaded) { drawLoader(); return; }
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
  if (trans && trans.wait > 0.25) {
    ctx.save(); ctx.globalAlpha = Math.min(1, (trans.wait - 0.25) / 0.3); drawLoader(); ctx.restore();
  }
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
// the cut-scene video is fetched only after every picture, so it never competes with the first screen
afterAll(() => {
  picturesIn = true;
  const v = document.getElementById('v');
  if (v && v.preload !== 'auto') { v.preload = 'auto'; if (v.readyState === 0 && v.networkState !== 2) v.load(); }
});
loadAssets((k) => { loadK = k; }).then(() => {
  const want = game.params.get('scene');
  const first = want && ORDER.includes(want) ? want : 'title';
  return whenSceneReady(first).then(() => first);
}).then((first) => {
  loaded = true;
  layKey = layoutKey();
  switchTo(first, {});
  trans = { k: 1, dir: -1, id: first, opts: {} };
  debug.ready = true;
}).catch((e) => { console.error(e); });
