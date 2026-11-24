// flow: start -> dress up -> build truck -> shop -> pool -> block world (endless)
import { audioInit, fade, SFX, scene, THREE } from './core.js';
import { runDress, runTruck } from './scene_yard.js';
import { runShop } from './scene_shop.js';
import { runPool } from './scene_pool.js';
import { runBlocks } from './scene_block.js';

const start = document.getElementById('start');
const params = new URLSearchParams(location.search);

async function blockWipe() {
  // squares cover the screen, then reveal the block world
  const n = 8, wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;display:grid;pointer-events:none;z-index:5';
  const cols = Math.ceil(n * Math.max(1, innerWidth / innerHeight)), rows = Math.ceil(n * Math.max(1, innerHeight / innerWidth));
  wrap.style.gridTemplateColumns = `repeat(${cols},1fr)`;
  const cells = [];
  const colors = ['#ff8fc8', '#ffb3d9', '#86d35e', '#7fd0f5', '#fff4da', '#ffd34d'];
  for (let i = 0; i < cols * rows; i++) {
    const d = document.createElement('div');
    d.style.cssText = `background:${colors[i % colors.length]};transform:scale(0);transition:transform .35s cubic-bezier(.3,1.6,.6,1);border-radius:6px`;
    wrap.appendChild(d); cells.push(d);
  }
  document.body.appendChild(wrap);
  await new Promise(r => setTimeout(r, 30));
  SFX.whoosh();
  cells.forEach((d, i) => setTimeout(() => { d.style.transform = 'scale(1.06)'; if (i % 9 === 0) SFX.block(); }, ((i % cols) + Math.floor(i / cols)) * 45));
  await new Promise(r => setTimeout(r, (cols + rows) * 45 + 400));
  return () => {
    cells.forEach((d, i) => setTimeout(() => d.style.transform = 'scale(0)', ((i % cols) + Math.floor(i / cols)) * 40));
    setTimeout(() => wrap.remove(), (cols + rows) * 40 + 500);
  };
}

async function main() {
  const skip = params.get('s') || '';
  let dadIce = null;
  if (!skip || skip === 'dress') await runDress();
  else { // jump straight in (debug): put the costume on
    const { girl, makeHat, makeApron } = await import('./world.js');
    girl.hatSlot.add(makeHat()); girl.apronSlot.add(makeApron());
  }
  if (!skip || ['dress', 'truck'].includes(skip)) await runTruck();
  if (!skip || ['dress', 'truck', 'shop'].includes(skip)) dadIce = await runShop();
  if (skip !== 'blocks') await runPool(dadIce);
  const reveal = await blockWipe();
  document.getElementById('fade').style.opacity = 0;
  await runBlocks();
  reveal();
}

start.querySelector('button').addEventListener('pointerdown', e => {
  e.preventDefault();
  audioInit(); SFX.pop();
  start.style.transition = 'opacity .4s'; start.style.opacity = 0;
  setTimeout(() => start.remove(), 400);
  main();
}, { once: true });
if (params.has('auto')) start.querySelector('button').dispatchEvent(new Event('pointerdown'));
