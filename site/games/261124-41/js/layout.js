// layout.js — places a scene's primary object, its secondary items and the two portrait bubbles
// inside the whole (safe) screen, not just the 1000-unit stage.
import { L } from './engine.js';

export const M = 22; // margin in units

export function safe() {
  return { x0: L.sl, y0: L.st, x1: L.sr, y1: L.sb, w: L.sr - L.sl, h: L.sb - L.st, cx: (L.sl + L.sr) / 2, cy: (L.st + L.sb) / 2 };
}
export const minBubble = () => 110 / L.u;
export const isPortrait = () => L.sb - L.st >= L.sr - L.sl;
// changes when a re-layout of the running scene is needed (rotation or big size change)
export function layoutKey() {
  const E = safe();
  return (isPortrait() ? 'P' : 'L') + Math.round(E.w / 80) + 'x' + Math.round(E.h / 80);
}

// prim: { w, h } full-size primary in units; items: names of secondaries.
// o: { sec (secondary size), minSec, bub (wanted bubble diameter), left/right (name lists for side bands), minK }
// returns { mode: 'below'|'side', px, py, k (primary scale), slots: {name: {x,y,s}}, bub: {mama, girl}, E }
export function frame(prim, items = [], o = {}) {
  const E = safe();
  const sec = o.sec ?? 230, minSec = o.minSec ?? 170, want = o.bub ?? 300, mb = minBubble();
  const n = items.length;
  const out = { slots: {}, E };
  const vertical = E.h - prim.h >= E.w - prim.w;
  const sideW = (k) => (E.w - prim.w * k) / 2;
  let side = !vertical;
  if (side) {
    let k = Math.min(1, (E.h - 2 * M) / prim.h);
    // the faces carry the story: shrink the primary a little rather than fall back to minimum-size bubbles
    const need = Math.max(n ? minSec : 0, mb, o.prefBub ?? Math.min(want, 215)) + 2 * M;
    if (sideW(k) < need) k = Math.max(o.minK ?? 0.82, (E.w - 2 * need) / prim.w);
    if (sideW(k) < Math.max(n ? minSec : 0, mb) + 2 * M - 1) side = false;
    else {
      const bw = sideW(k);
      const d = Math.max(mb, Math.min(want, bw - 2 * M));
      // o.chef: the girl is shown whole at her pot, so her window gets more room than the portrait
      const dg = o.chef ? Math.max(d, Math.min(want * 1.4, bw - 2 * M)) : d;
      out.mode = 'side'; out.k = k; out.px = E.cx; out.py = E.cy;
      out.bub = {
        mama: { x: E.x0 + bw / 2, y: E.y0 + M + d / 2, d },
        girl: { x: E.x1 - bw / 2, y: E.y0 + M + dg / 2, d: dg },
      };
      const left = o.left || items.slice(0, Math.ceil(n / 2));
      const right = o.right || items.filter((x) => !left.includes(x));
      const bot = E.y1 - M;
      for (const [list, cx, dd] of [[left, E.x0 + bw / 2, d], [right, E.x1 - bw / 2, dg]]) {
        const top = E.y0 + 2 * M + dd;
        const m = list.length;
        if (!m) continue;
        const s = Math.min(sec * 1.05, bw - 2 * M, (bot - top - (m - 1) * M) / m);
        const gap = (bot - top - m * s) / (m + 1);
        list.forEach((nm, i) => { out.slots[nm] = { x: cx, y: top + gap * (i + 1) + s * (i + 0.5), s }; });
      }
      out.sideW = bw;
      return out;
    }
  }
  // vertical: bubbles in the top band, primary below, secondaries in a row under it
  const d = Math.max(mb, Math.min(want, (E.w - 3 * M) / 2.2));
  const needRow = n ? minSec + 2 * M : 0;
  // o.chef: the girl's window grows (up to 1.25x) only into height nobody else needs
  const k0 = Math.min(1, (E.w - 2 * M) / prim.w);
  const spare = E.h - (d + 2 * M) - prim.h * k0 - needRow;
  const dg = o.chef ? d + Math.max(0, Math.min(d * 0.25, E.w - 4 * M - 2 * d, spare)) : d;
  const topBand = dg + 2 * M;
  let k = Math.min(1, (E.w - 2 * M) / prim.w);
  if (E.h - topBand - prim.h * k < needRow) k = Math.max(o.minK ?? 0.6, (E.h - topBand - needRow) / prim.h);
  const hh = prim.h * k;
  const rowS = n ? Math.max(minSec * 0.8, Math.min(sec, E.h - topBand - hh - 2 * M, (E.w - (n + 1) * M) / n)) : 0;
  const group = hh + (n ? M + rowS : 0);
  const y0 = E.y0 + topBand + Math.max(0, (E.h - topBand - group) / 2);
  out.mode = 'below'; out.k = k; out.px = E.cx; out.py = y0 + hh / 2;
  out.bub = {
    mama: { x: E.x0 + M + d / 2, y: E.y0 + M + dg / 2, d },
    girl: { x: E.x1 - M - dg / 2, y: E.y0 + M + dg / 2, d: dg },
  };
  const step = n ? Math.min((E.w - 2 * M) / n, rowS * 1.25) : 0;
  const rowY = y0 + hh + M + rowS / 2;
  items.forEach((nm, i) => { out.slots[nm] = { x: E.cx + (i - (n - 1) / 2) * step, y: rowY, s: rowS }; });
  out.topBand = topBand;
  return out;
}

// centre of a group of slots
export function slotCentre(f, names) {
  const ss = names.map((n) => f.slots[n]).filter(Boolean);
  return { x: ss.reduce((a, s) => a + s.x, 0) / ss.length, y: ss.reduce((a, s) => a + s.y, 0) / ss.length, s: ss[0].s };
}

// largest free rectangle candidate for a cloud of radius R (thought bubble)
// rects are in order of preference: the first one that fits ~85 % of maxR wins, else the roomiest
export function cloudSpot(rects, maxR) {
  let best = null;
  for (const r of rects) {
    if (r.w <= 0 || r.h <= 0) continue;
    const R = Math.min(maxR, r.w / 2.8, r.h / 2.5);
    const c = { x: r.x + r.w / 2, y: r.y + r.h / 2, R };
    if (R >= maxR * 0.85) return c;
    if (!best || R > best.R) best = c;
  }
  return best;
}
