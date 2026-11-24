// assets.js — manifest-driven image loader with placeholders, normalised geometry and baked shadows.
import { canvas2d } from './engine.js';
import { placeholder, PH } from './placeholders.js';

export const REQUIRED = [
  'bg_counter', 'bg_table', 'bg_stove', 'hero_curry',
  'carrot', 'potato', 'onion', 'basket', 'bowl_water', 'board', 'knife', 'pot', 'lid', 'dish', 'jug',
  'spatula', 'ladle_curry', 'shamoji_rice', 'spoon',
  'carrot_slice_1', 'carrot_slice_2', 'carrot_slice_3',
  'potato_chunk_1', 'potato_chunk_2', 'potato_chunk_3', 'potato_chunk_4',
  'onion_wedge_1', 'onion_wedge_2', 'onion_wedge_3', 'onion_wedge_4',
  'meat_raw_1', 'meat_raw_2', 'meat_raw_3', 'meat_cooked_1', 'meat_cooked_2', 'meat_cooked_3',
  'roux_1', 'roux_2', 'roux_3', 'roux_4', 'roux_tray',
  'carrot_flower', 'carrot_star', 'carrot_heart', 'tex_curry', 'tex_rice',
  'plate_empty', 'plate_rice', 'plate_full',
  'girl_smile', 'girl_focus', 'girl_happy', 'girl_wow',
  'mama_tired', 'mama_smile', 'mama_wow', 'mama_aan', 'mama_laugh',
];
const OPTIONAL = ['story_hug', 'plate_rice_layer', 'plate_curry_layer'];
// sprites that never need a contact shadow
const NO_SHADOW = /^(bg_|hero_|tex_|girl_|mama_|story_)/;

const imgs = {};      // name -> HTMLImageElement | canvas
const real = {};      // name -> true when a real file was decoded
const meta = {};      // name -> manifest entry (merged geometry)
const shadows = {};   // name -> { sharp, soft, px, py } (pad as fraction of w/h)
let manifest = null;

function entriesOf(m) {
  if (!m || typeof m !== 'object') return {};
  let src = m.images || m.assets || m.sprites || m.files || m;
  const out = {};
  if (Array.isArray(src)) {
    for (const e of src) {
      if (!e) continue;
      const f = e.file || e.src || e.path || '';
      const n = e.name || e.id || String(f).split('/').pop().replace(/\.[a-z0-9]+$/i, '');
      if (n) out[n] = e;
    }
  } else {
    for (const k in src) {
      const e = src[k];
      if (typeof e === 'string') out[k] = { file: e };
      else if (e && typeof e === 'object' && !Array.isArray(e)) out[k] = e;
    }
  }
  for (const k in out) {
    const e = out[k];
    out[k] = Object.assign({}, e, e.geometry || {}, e.geom || {}, e.anchors || {}, e.points || {});
  }
  return out;
}

function fileUrl(name, e) {
  let f = (e && (e.file || e.src || e.path || e.url)) || name + '.webp';
  if (/^(https?:)?\/\//.test(f)) return null; // never fetch external
  f = f.replace(/^\.?\//, '');
  if (!/^assets\//.test(f)) f = 'assets/' + f;
  return f;
}

function loadImg(url) {
  return new Promise((res) => {
    if (!url) { res(null); return; }
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => {
      const done = () => res(im.naturalWidth ? im : null);
      if (im.decode) im.decode().then(done, done); else done();
    };
    im.onerror = () => res(null);
    im.src = url;
  });
}

// Load order. The title needs only two pictures; everything else streams in behind it while the
// player looks at the title (and plays the home scene). A scene is entered only once its group and
// every earlier group are decoded, so no scene ever caches a placeholder.
export const GROUPS = [
  ['title', ['hero_curry', 'girl_smile']],
  ['home', ['bg_counter', 'basket', 'carrot', 'potato', 'onion', 'mama_tired', 'mama_smile', 'girl_focus', 'girl_wow', 'girl_happy']],
  ['wash', ['bowl_water']],
  ['cut', ['board', 'knife', 'mama_wow', 'carrot_slice_1', 'carrot_slice_2', 'carrot_slice_3',
    'potato_chunk_1', 'potato_chunk_2', 'potato_chunk_3', 'potato_chunk_4',
    'onion_wedge_1', 'onion_wedge_2', 'onion_wedge_3', 'onion_wedge_4']],
  ['stamp', ['carrot_flower', 'carrot_star', 'carrot_heart', 'pot']],
  ['pot', ['bg_stove', 'lid', 'dish', 'jug', 'tex_curry', 'meat_raw_1', 'meat_raw_2', 'meat_raw_3',
    'meat_cooked_1', 'meat_cooked_2', 'meat_cooked_3']],
  ['roux', ['roux_1', 'roux_2', 'roux_3', 'roux_4', 'roux_tray', 'spatula']],
  // last group: whatever is left (plates, table, toppings, anything only the manifest lists)
  ['serve', []],
];
const GROUP_IDS = GROUPS.map((g) => g[0]);

const fin = {};       // name -> true once settled (loaded or failed)
const settled = {};   // name -> Promise (resolves once the file is decoded or has failed)
let manifestP = null;
let groupP = [];      // per group: Promise resolving when that group (and all before it) is ready
const groupDone = [];
let allNames = [];

function fetchManifest() {
  if (!manifestP) {
    manifestP = fetch('assets/manifest.json')
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((m) => { manifest = m; return entriesOf(m); });
  }
  return manifestP;
}

// decode one image; its contact shadow is baked right after so no frame pays for it later
function loadOne(n, ents) {
  if (settled[n]) return settled[n];
  meta[n] = ents[n] || meta[n] || {};
  const want = ents[n] || REQUIRED.includes(n);
  settled[n] = (want ? loadImg(fileUrl(n, ents[n])) : Promise.resolve(null)).then((im) => {
    if (im) { imgs[n] = im; real[n] = true; }
    else if (REQUIRED.includes(n)) imgs[n] = placeholder(n);
    fin[n] = true;
    if (imgs[n] && !NO_SHADOW.test(n)) shadows[n] = bakeShadow(imgs[n]);
    else delete shadows[n];
  });
  return settled[n];
}

// small queue: earlier groups get the bandwidth first
function queue(names, ents, conc) {
  let i = 0;
  const worker = () => (i < names.length ? loadOne(names[i++], ents).then(worker) : Promise.resolve());
  return Promise.all(Array.from({ length: Math.min(conc, names.length) }, worker));
}

/** Resolves as soon as the title can be shown; the rest keeps loading in the background. */
export async function loadAssets(onProgress) {
  // the two title pictures start downloading together with the manifest (default file names)
  const first = GROUPS[0][1];
  const early = first.map((n) => loadImg(fileUrl(n, null)));
  const ents = await fetchManifest();
  const names = new Set(REQUIRED);
  for (const n of OPTIONAL) if (ents[n]) names.add(n);
  for (const n in ents) {
    const f = String(ents[n].file || ents[n].src || ents[n].path || '');
    if (!/\.(mp3|mp4|json|m4a|ogg|wav)$/i.test(f)) names.add(n);
  }
  for (const n of names) meta[n] = ents[n] || {};
  allNames = [...names];
  // title group: reuse the early downloads when the manifest agrees on the file
  let done = 0;
  await Promise.all(first.map((n, i) => {
    if (fileUrl(n, ents[n]) === fileUrl(n, null)) {
      settled[n] = early[i].then((im) => {
        if (im) { imgs[n] = im; real[n] = true; } else imgs[n] = placeholder(n);
        fin[n] = true;
      });
    }
    return loadOne(n, ents).then(() => { done++; if (onProgress) onProgress(done / first.length); });
  }));
  groupDone[0] = true;
  groupP[0] = Promise.resolve();
  // background: one group after another, a few files at a time
  const seen = new Set(first);
  let prev = groupP[0];
  for (let g = 1; g < GROUPS.length; g++) {
    const last = g === GROUPS.length - 1;
    const list = (last ? allNames : GROUPS[g][1]).filter((n) => !seen.has(n));
    list.forEach((n) => seen.add(n));
    prev = prev.then(() => queue(list, ents, 4)).then(() => {
      if (last) {
        for (const n of REQUIRED) if (!imgs[n]) imgs[n] = placeholder(n);
        composePlates();
        for (const n of ['plate_rice', 'plate_full']) if (imgs[n]) shadows[n] = bakeShadow(imgs[n]);
      }
      groupDone[g] = true;
    });
    groupP[g] = prev;
  }
  prev.then(() => { if (onAll) onAll(); });
}

let onAll = null;
/** Called once when every file has been loaded (used to start the cut-scene video download). */
export function afterAll(fn) { onAll = fn; }

function groupIndex(sceneId) {
  const i = GROUP_IDS.indexOf(sceneId);
  return i < 0 ? GROUPS.length - 1 : i;
}
/** true when the scene can be entered right now */
export function sceneReady(sceneId) { return !!groupDone[groupIndex(sceneId)]; }
/** resolves when the scene can be entered */
export function whenSceneReady(sceneId) {
  const p = groupP[groupIndex(sceneId)];
  return p || new Promise((res) => { const t = setInterval(() => { const q = groupP[groupIndex(sceneId)]; if (q) { clearInterval(t); q.then(res); } }, 50); });
}
/** 0..1 loading progress of everything a scene needs (for the waiting spinner) */
export function sceneProgress(sceneId) {
  const gi = groupIndex(sceneId);
  let need = [];
  for (let g = 0; g <= gi; g++) need = need.concat(g === GROUPS.length - 1 ? allNames : GROUPS[g][1]);
  need = [...new Set(need)];
  if (!need.length) return 0;
  return need.filter((n) => fin[n]).length / need.length;
}

// Plate set: either three registered full images, or plate_empty + overlay layers.
function composePlates() {
  const base = imgs.plate_empty;
  const lay = (layerNames) => {
    const w = base.naturalWidth || base.width, h = base.naturalHeight || base.height;
    const s = Math.min(1, 900 / Math.max(w, h));
    const c = canvas2d(w * s, h * s), x = c.getContext('2d');
    x.drawImage(base, 0, 0, c.width, c.height);
    for (const ln of layerNames) if (imgs[ln]) x.drawImage(imgs[ln], 0, 0, c.width, c.height);
    return c;
  };
  if (!real.plate_rice && real.plate_rice_layer) { imgs.plate_rice = lay(['plate_rice_layer']); real.plate_rice = true; }
  if (!real.plate_full && real.plate_rice_layer && real.plate_curry_layer) {
    imgs.plate_full = lay(['plate_rice_layer', 'plate_curry_layer']); real.plate_full = true;
  }
}

function bakeShadow(img) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const S = 80, sc = S / Math.max(w, h);
  const iw = Math.max(2, Math.round(w * sc)), ih = Math.max(2, Math.round(h * sc));
  const pad = 18;
  const make = (down) => {
    const c = canvas2d(iw + pad * 2, ih + pad * 2), x = c.getContext('2d');
    x.drawImage(img, pad, pad, iw, ih);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#1b0f06';
    x.fillRect(0, 0, c.width, c.height);
    // cheap blur: down-sample then up-sample twice (ctx.filter is not available on older Safari)
    for (let i = 0; i < 2; i++) {
      const t = canvas2d(c.width / down, c.height / down), tx = t.getContext('2d');
      tx.imageSmoothingEnabled = true;
      tx.drawImage(c, 0, 0, t.width, t.height);
      x.globalCompositeOperation = 'copy';
      x.imageSmoothingEnabled = true;
      x.drawImage(t, 0, 0, c.width, c.height);
    }
    return c;
  };
  return { sharp: make(3), soft: make(7), px: pad / iw, py: pad / ih };
}

export const has = (n) => !!real[n];
export const img = (n) => imgs[n] || (imgs[n] = placeholder(n));
export const shadowOf = (n) => shadows[n] || (shadows[n] = bakeShadow(img(n)));
export function size(n) {
  const im = img(n);
  return { w: im.naturalWidth || im.width, h: im.naturalHeight || im.height };
}
export const aspect = (n) => { const s = size(n); return s.h / s.w; };
export const metaOf = (n) => meta[n] || {};

// Geometry from the manifest, normalised to 0..1 of the image (x by width, y by height, r by width).
const XK = new Set(['x', 'cx', 'x0', 'x1', 'left', 'right', 'w', 'width', 'r', 'rx']);
const YK = new Set(['y', 'cy', 'y0', 'y1', 'top', 'bottom', 'h', 'height', 'ry']);
export function geo(n, key, def) {
  const m = meta[n] || {};
  // '_self': geometry stored at the top level of the entry (e.g. lid cx/cy/r)
  let g = key === '_self' ? (m.cx != null ? { cx: m.cx, cy: m.cy, r: m.r } : null) : m[key];
  if (g == null) return def;
  const { w, h } = size(n);
  const mw = m.w || m.width || w, mh = m.h || m.height || h;
  if (Array.isArray(g) && g.length === 2 && typeof g[0] === 'object') {
    // a segment given as two points
    g = { x0: g[0].x, y0: g[0].y, x1: g[1].x, y1: g[1].y };
  } else if (Array.isArray(g)) {
    if (g.length === 2) g = { x: g[0], y: g[1] };
    else if (g.length === 3) g = { cx: g[0], cy: g[1], r: g[2] };
    else if (g.length === 4) g = { x0: g[0], y0: g[1], x1: g[2], y1: g[3] };
    else return def;
  }
  if (typeof g !== 'object') return def;
  const nums = Object.values(g).filter((v) => typeof v === 'number');
  const px = m.units === 'px' || m.normalized === false || nums.some((v) => Math.abs(v) > 2);
  const out = {};
  for (const k in g) {
    const v = g[k];
    if (typeof v !== 'number') { out[k] = v; continue; }
    out[k] = !px ? v : XK.has(k) ? v / mw : YK.has(k) ? v / mh : v;
  }
  if (out.x != null && out.w != null && out.x0 == null) { out.x0 = out.x; out.x1 = out.x + out.w; }
  if (out.y != null && out.h != null && out.y0 == null) { out.y0 = out.y; out.y1 = out.y + out.h; }
  if (out.left != null && out.x0 == null) { out.x0 = out.left; out.x1 = out.right; out.y0 = out.top; out.y1 = out.bottom; }
  return Object.assign({}, def || {}, out);
}

export { PH };
