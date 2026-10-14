// Ascend forms + attack poses, built in code from the Inu Verse base grid (src/inu/sprite.js paint()).
// Stage 0 base, 1 Golden Howl, 2 Storm Howl, 3 Primal Howl. Every stage keeps the 4-direction, 4-frame stride.
import { paint, GW, GH } from './inu/sprite.js';
import { COATS } from './inu/coats.js';
const INK = '#1a1420', PX = 5, PY = 10, W = GW + PX * 2, H = GH + PY;
export const FORM_W = W + 2, FORM_H = H + 2;
export const STAGES = [
  { name: 'Base', drain: 0, power: 1, guard: 1 },
  { name: 'Golden Howl', drain: 7, power: 1.6, guard: 0.8, eye: '#3fffd0', pal: { base: '#ffd23a', dark: '#d9961a', light: '#fff3a8', ear: '#ffe07a' }, spike: ['#ffdc40', '#e09a18', '#fff8c0'], aura: '#ffd84a' },
  { name: 'Storm Howl', drain: 12, power: 2.0, guard: 0.7, eye: '#9ff6ff', pal: { base: '#ffe45c', dark: '#e0a82a', light: '#fffbd6', ear: '#fff0a0' }, spike: ['#ffeb6a', '#e0aa30', '#ffffff'], aura: '#fff07a' },
  { name: 'Primal Howl', drain: 18, power: 2.5, guard: 0.6, eye: '#5dff8a', pal: { base: '#ffbf1f', dark: '#c47a0c', light: '#ffe48a', ear: '#ffd060' }, spike: ['#ffc928', '#b86e08', '#fff0a0'], aura: '#ffb320', mane: ['#ffb000', '#d98200', '#ffd75a'] },
];
const cache = new Map();
function pad(g) { const o = Array.from({ length: H }, () => new Array(W).fill(null)); for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) o[y + PY][x + PX] = g[y][x]; return o; }
function mk(o) { return { o, set: (x, y, c) => { x += PX; y += PY; if (x >= 0 && y >= 0 && x < W && y < H) o[y][x] = c; }, get: (x, y) => o[y + PY]?.[x + PX] ?? null, rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); } }; }
function pose(G, view, kind, coat) {
  const C = COATS[coat], sleeve = view === 'side' ? G.get(11, 18) || G.get(11, 16) : G.get(4, 17) || G.get(4, 16), paw = C.light;
  const clear = (x, y, w, h) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) G.set(x + i, y + j, null); };
  const move = (x, y, w, h, dx, dy) => { const buf = []; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) buf.push([x + i, y + j, G.get(x + i, y + j)]); clear(x, y, w, h); for (const [a, b, c] of buf) if (c) G.set(a + dx, b + dy, c); };
  if (view === 'side') {
    if (kind === 'punch') { G.rect(12, 16, 7, 2, sleeve); G.rect(19, 15, 3, 3, paw); G.set(21, 17, C.dark); }
    if (kind === 'kick') { const pc = G.get(12, 25), fc = G.get(12, 29) || G.get(12, 28); clear(11, 24, 5, 6); G.rect(13, 23, 6, 3, pc); G.rect(19, 22, 3, 4, fc || paw); }
    if (kind === 'beam') { G.rect(12, 17, 6, 2, sleeve); G.rect(18, 16, 2, 3, paw); G.rect(17, 19, 2, 1, sleeve); }
  } else if (view === 'down') {
    if (kind === 'punch') { clear(16, 15, 2, 7); G.rect(15, 16, 3, 3, sleeve); G.rect(15, 19, 4, 4, paw); G.set(18, 22, C.dark); }
    if (kind === 'kick') move(5, 24, 5, 6, -1, -3);
    if (kind === 'beam') { clear(4, 15, 2, 7); clear(16, 15, 2, 7); G.rect(6, 17, 3, 2, sleeve); G.rect(13, 17, 3, 2, sleeve); G.rect(8, 19, 6, 3, paw); }
  } else {
    if (kind === 'punch') { clear(16, 15, 2, 7); G.rect(16, 10, 2, 6, sleeve); G.rect(16, 8, 3, 3, paw); }
    if (kind === 'kick') move(12, 24, 5, 6, 1, -3);
    if (kind === 'beam') { clear(4, 15, 2, 7); clear(16, 15, 2, 7); G.rect(4, 10, 2, 6, sleeve); G.rect(16, 10, 2, 6, sleeve); G.rect(4, 8, 3, 3, paw); G.rect(15, 8, 3, 3, paw); }
  }
}
function spike(G, cx, base, h, lean, cols, wmax = 3) {
  for (let i = 0; i < h; i++) { const w = Math.max(1, Math.round(wmax * (1 - i / h))), x0 = Math.round(cx + lean * i - w / 2);
    for (let k = 0; k < w; k++) G.set(x0 + k, base - i, k === 0 ? cols[1] : (k === w - 1 && w > 2) ? cols[2] : cols[0]); }
}
function ascend(G, view, stage, coat, frame) {
  const S = STAGES[stage], C = COATS[coat], map = { [C.base]: S.pal.base, [C.dark]: S.pal.dark, [C.light]: S.pal.light, [C.ear]: S.pal.ear };
  const by = frame % 2 === 1 ? 1 : 0;
  // eyes (find before recolour; INK pixels inside the face)
  const eyes = [];
  for (let y = 4 + by; y <= 9 + by; y++) for (let x = 0; x < GW; x++) { const c = G.get(x, y); if (c !== INK && c !== '#5a4844') continue;
    if (view === 'down' && (x <= 8 || x >= 13)) eyes.push([x, y]); if (view === 'side' && x === 14) eyes.push([x, y]); }
  for (let y = -PY; y < GH; y++) for (let x = -PX; x < GW + PX; x++) { const c = G.get(x, y); if (map[c]) G.set(x, y, map[c]); }
  // hood/hair pixels on the crown become fur so the spikes grow from the skull
  for (let y = 0; y <= 4; y++) for (let x = view === 'side' ? 6 : 6; x <= (view === 'side' ? 16 : 15); x++) { const c = G.get(x, y + by); if (c && !Object.values(S.pal).includes(c)) G.set(x, y + by, S.pal.base); }
  const cols = S.spike, big = stage >= 2, hb = 3 + by;
  if (stage === 3) { const M = S.mane; // long flowing mane, drawn behind (only into empty cells) except the back view
    if (view === 'down') for (let y = 4; y < 27; y++) { const w = y < 7 ? 1 : y < 22 ? 3 : 2; for (let k = 0; k < w; k++) for (const x of [-k, GW - 1 + k]) if (!G.get(x, y + by)) G.set(x, y + by, (y + k) % 3 ? M[0] : M[1]); }
    if (view === 'up') for (let y = 3; y < 25; y++) { const half = y < 6 ? 6 : y < 20 ? 8 : 8 - (y - 20) * 2; for (let x = 11 - half; x < 11 + half; x++) G.set(x, y + by, ((x + y) % 4 === 0) ? M[1] : ((x * 7 + y) % 5 === 0 ? M[2] : M[0])); }
    if (view === 'side') for (let y = 2; y < 26; y++) { const x0 = y < 6 ? 3 : 0 - Math.floor((y - 6) / 6), x1 = y < 6 ? 7 : 5; for (let x = x0; x <= x1; x++) if (!G.get(x, y + by)) G.set(x, y + by, (x + y) % 3 ? M[0] : M[1]); }
  }
  if (view === 'side') { // swept-back crest
    const set = big ? [[14, 5, -0.9], [12, 8, -1.1], [10, 9, -1.25], [8, 8, -1.3], [6, 6, -1.4], [5, 4, -1.5]] : [[13, 4, -0.8], [11, 6, -1], [9, 6, -1.1], [7, 5, -1.2]];
    for (const [x, h, l] of set) spike(G, x, hb, h + (stage === 3 ? 1 : 0), l, cols, big ? 3 : 4);
    for (const [x, y] of [[1, 13], [0, 12], [-1, 11], [3, 13], [2, 12], ...(big ? [[-2, 10], [4, 12], [4, 11]] : [])]) G.set(x, y + by, cols[0]);
  } else {
    const set = big ? [[3, 5, -0.8], [6, 7, -0.5], [8.5, 9, -0.2], [11, 10, 0], [13.5, 9, 0.2], [16, 7, 0.5], [19, 5, 0.8]] : [[5, 4, -0.5], [8, 6, -0.25], [11, 7, 0], [14, 6, 0.25], [17, 4, 0.5]];
    for (const [x, h, l] of set) spike(G, x, hb, h + (stage === 3 ? 1 : 0), l, cols, big ? 3 : 4);
    if (view === 'down') for (const [x, y] of [[20, 16], [21, 15], [19, 15], [22, 14], ...(big ? [[23, 13], [20, 14]] : [])]) G.set(x, y + by, cols[0]);
    else for (const [x, y] of [[9, 17], [8, 16], [12, 17], [13, 16], [10, 16], ...(big ? [[7, 15], [14, 15]] : [])]) G.set(x, y + by, cols[0]);
  }
  for (const [x, y] of eyes) G.set(x, y, S.eye); if (eyes.length) { const [x, y] = eyes[0]; G.set(x, y, '#ffffff'); }
  if (stage === 3 && eyes.length) { for (const [x, y] of eyes) { G.set(x, y - 1, S.pal.dark); G.set(x - 1, y - 1, S.pal.dark); G.set(x + 1, y - 1, S.pal.dark); } }
}
function toCanvas(o, mirror) {
  const cv = document.createElement('canvas'); cv.width = FORM_W; cv.height = FORM_H; const c = cv.getContext('2d');
  const at = (x, y) => (y >= 0 && y < H && x >= 0 && x < W ? o[y][mirror ? W - 1 - x : x] : null);
  for (let y = -1; y <= H; y++) for (let x = -1; x <= W; x++) { const col = at(x, y);
    if (col) { c.fillStyle = col; c.fillRect(x + 1, y + 1, 1, 1); } else if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) { c.fillStyle = INK; c.fillRect(x + 1, y + 1, 1, 1); } }
  return cv;
}
// face: down|up|left|right. kind: walk|punch|kick|beam
export function heroFrame(coat, stage, face, frame, kind = 'walk', eq = {}) {
  const key = `${coat}|${stage}|${face}|${frame}|${kind}|${JSON.stringify(eq)}`; let cv = cache.get(key); if (cv) return cv;
  const view = face === 'left' || face === 'right' ? 'side' : face; const G = mk(pad(paint(coat, view, kind === 'walk' ? frame : 0, eq)));
  if (kind !== 'walk') pose(G, view, kind, coat);
  if (stage > 0) ascend(G, view, stage, coat, kind === 'walk' ? frame : 0);
  cv = toCanvas(G.o, face === 'left'); cache.set(key, cv); return cv;
}
