window.addEventListener("unhandledrejection", (e) => console.error("unhandled:", e.reason && (e.reason.stack || e.reason)));
import { startLoop, onFirstTouch } from './core.js';
import { initMaterials } from './art.js';
import { unlock, playMusic } from './sound.js';
import { boot } from './game.js';

initMaterials();
let started = false;
onFirstTouch(() => { unlock(); if (!started) { started = true; playMusic(0); } });
startLoop();
boot();
const ld = document.getElementById('loading');
setTimeout(() => { ld.style.opacity = '0'; setTimeout(() => ld.remove(), 600); }, 400);
