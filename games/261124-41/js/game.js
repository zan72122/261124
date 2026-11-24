// game.js — shared state between the scene manager and scenes.
import { Clock } from './engine.js';

export const game = {
  id: '',
  scene: null,
  phase: '',
  clock: new Clock(),   // scene clock: cleared on every scene change
  world: new Clock(),   // persistent clock
  block: false,         // scripted beat: input goes to ripples only
  time: 0,
  params: new URLSearchParams(location.search),
  goto: () => {},
  carry: null,          // state handed from one scene to the next (pot -> roux, serve -> eat ...)
};

export function phase(s) { game.phase = s; }
export const wait = (s) => game.clock.wait(s);
export const tween = (o, p, d, e, delay) => game.clock.tween(o, p, d, e, delay);
export const anim = (d, fn, e, delay) => game.clock.anim(d, fn, e, delay);
