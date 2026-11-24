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
      bubbles.girl.pulse = 0;
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
    // real iPhones can take a while to start; the girl bubble keeps pulsing meanwhile
    bubbles.girl.pulse = 1;
    timers.push(setTimeout(() => { if (!started) fail(); }, 4000));
  });
}

// enlarged happy girl bubble with hearts instead of the video
function fallback(resolve) {
  const g = bubbles.girl;
  g.pulse = 0;
  g.setFace('girl_happy');
  g.jump(1);
  const p = g.pos();
  let n = 0;
  const id = setInterval(() => {
    bubbles.hearts('girl', 2, 1.2);
    if (++n > 8) clearInterval(id);
  }, 220);
  fx.sparkleRing(p.x, p.y, p.d * 0.56, 16);
  snd.sfx('heart');
  setTimeout(() => resolve(false), 2000);
}
