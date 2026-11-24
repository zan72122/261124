// video.js — the "oishiku naare" cut-scene: muted inline <video> (no gesture needed on iOS),
// its sound comes from audio.playStir(). Falls back gracefully if playback does not start.
import { L } from './engine.js';
import { snd } from './snd.js';
import { bubbles } from './bubbles.js';
import { fx } from './fx.js';
import { game } from './game.js';

const VW = 1280, VH = 720;

function fitFrame(v) {
  const m = Math.min(L.W, L.H) * 0.05;
  const aw = L.W - m * 2, ah = L.H - m * 2;
  const k = Math.min(aw / VW, ah / VH);
  const w = Math.round(VW * k), h = Math.round(VH * k);
  Object.assign(v.style, { left: Math.round((L.W - w) / 2) + 'px', top: Math.round((L.H - h) / 2) + 'px', width: w + 'px', height: h + 'px' });
}

export function playStirVideo({ onStart } = {}) {
  const v = document.getElementById('v');
  return new Promise((resolve) => {
    if (!v || game.params.get('novideo') === '1') { fallback(resolve); return; }
    let started = false, finished = false, stir = null;
    const timers = [];
    const onResize = () => fitFrame(v);
    const cleanup = () => {
      timers.forEach(clearTimeout);
      v.removeEventListener('ended', done); v.removeEventListener('error', fail); v.removeEventListener('canplay', tryPlay);
      window.removeEventListener('resize', onResize);
    };
    function done() {
      if (finished) return;
      finished = true; cleanup();
      v.style.opacity = '0';
      if (stir) stir.stop();
      setTimeout(() => { try { v.pause(); } catch (e) { /* ignore */ } }, 400);
      resolve(true);
    }
    function fail() {
      if (finished || started) { if (started) done(); return; }
      finished = true; cleanup();
      v.style.opacity = '0';
      try { v.pause(); } catch (e) { /* ignore */ }
      fallback(resolve);
    }
    function begin() {
      if (started || finished) return;
      started = true;
      v.style.opacity = '1';
      stir = snd.playStir();
      if (onStart) onStart();
      timers.push(setTimeout(done, 8300));
    }
    function tryPlay() {
      if (started || finished) return;
      v.muted = true;
      try {
        const p = v.play();
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* ignore */ }
    }
    v.muted = true; v.defaultMuted = true; v.playsInline = true;
    try { v.currentTime = 0; } catch (e) { /* ignore */ }
    fitFrame(v);
    window.addEventListener('resize', onResize);
    v.addEventListener('ended', done);
    v.addEventListener('error', fail);
    // "playing" can fire before frames advance; poll currentTime to be sure
    const poll = () => {
      if (finished || started) return;
      if (!v.paused && v.currentTime > 0.04) begin();
      else timers.push(setTimeout(poll, 50));
    };
    if (v.readyState >= 3) tryPlay(); else { v.addEventListener('canplay', tryPlay); if (v.readyState === 0) v.load(); tryPlay(); }
    poll();
    timers.push(setTimeout(() => { if (!started) fail(); }, 1500));
  });
}

// enlarged happy girl bubble with hearts instead of the video
function fallback(resolve) {
  const g = bubbles.girl;
  g.setFace('girl_happy');
  g.jump(1);
  const p = g.pos();
  let n = 0;
  const id = setInterval(() => {
    const q = g.pos();
    fx.hearts(q.x + (Math.random() - 0.5) * q.d * 0.8, q.y + q.d * 0.2, 2, 'over', 1.4);
    if (++n > 8) clearInterval(id);
  }, 220);
  fx.sparkle(p.x, p.y, 16, p.d * 0.5, 'over');
  snd.sfx('heart');
  setTimeout(() => resolve(false), 2000);
}
