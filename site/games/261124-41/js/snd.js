// snd.js — crash-proof facade over audio.js (loaded dynamically so a missing/broken module never stops the game).
let A = null;
const NOOP_LOOP = { set() {}, stop() {} };
const safe = (fn, fb) => { try { return A ? fn() : fb; } catch (e) { return fb; } };

let wantMuted = null;   // a mute asked for before the module arrived (?mute=1 is read at boot)
export const loaded = import('./audio.js').then((m) => {
  A = m.audio || m.default || null;
  if (A && wantMuted != null) { try { A.setMuted(wantMuted); } catch (e) { /* ignore */ } }
}).catch(() => { A = null; });

let unlocked = false;
export const snd = {
  get unlocked() { return unlocked; },
  unlock() {
    return safe(() => Promise.resolve(A.unlock()).then(() => { unlocked = true; }), Promise.resolve());
  },
  sfx(name, opts) { safe(() => A.sfx(name, opts)); },
  // Returns a handle that tolerates the module arriving late or failing.
  loop(name) {
    const h = safe(() => A.loop(name), null) || NOOP_LOOP;
    return { set(v, g) { try { h.set(v, g); } catch (e) { /* ignore */ } }, stop(f) { try { h.stop(f); } catch (e) { /* ignore */ } } };
  },
  stopAllLoops(f) { safe(() => A.stopAllLoops(f)); },
  bgmStart() { safe(() => A.bgm.start()); },
  bgmDuck(level, sec) { safe(() => A.bgm.duck(level, sec)); },
  bgmStop(sec) { safe(() => A.bgm.stop(sec)); },
  playStir() { return safe(() => A.playStir(), null) || { stop() {} }; },
  setMuted(m) { wantMuted = !!m; safe(() => A.setMuted(m)); },
};
