// Ascend forms + attack poses, built in code from the Inu Verse base grid (src/inu/sprite.js paint()).
// Stage 0 base, 1 Moon Howl, 2 Tide Howl, 3 Wild Howl (original coat-glow forms; no golden spiky hair). Every stage keeps the 4-direction, 4-frame stride.
import { paint, GW, GH } from './inu/sprite.js';
import { COATS } from './inu/coats.js';
const INK = '#1a1420', PX = 5, PY = 10, W = GW + PX * 2, H = GH + PY;
export const FORM_W = W + 2, FORM_H = H + 2;
export const STAGES = [
  { name: 'Base', drain: 0, power: 1, guard: 1 },
  { name: 'Moon Howl', drain: 7, power: 1.6, guard: 0.8, eye: '#ffe6ff', pal: { base: '#c8c4e8', dark: '#8a84b8', light: '#f2f0ff', ear: '#e0dcf8' }, spike: ['#d8d4f4', '#8a84b8', '#ffffff'], aura: '#b8b0ff' },
  { name: 'Tide Howl', drain: 12, power: 2.0, guard: 0.7, eye: '#fff6c0', pal: { base: '#5cc8c0', dark: '#2a8a8a', light: '#c8f6ee', ear: '#90e0d8' }, spike: ['#7ad8d0', '#2a8a8a', '#e8fffa'], aura: '#6ae8e0' },
  { name: 'Wild Howl', drain: 18, power: 2.5, guard: 0.6, eye: '#ffd0e0', pal: { base: '#6aa848', dark: '#3a6a2a', light: '#c8eaa0', ear: '#9ad070' }, spike: ['#7ab858', '#3a6a2a', '#d8f4b0'], aura: '#8ae060', mane: ['#4a8a38', '#2e5a22', '#a8d878'] },
];
const cache = new Map();
function pad(g) { const o = Array.from({ length: H }, () => new Array(W).fill(null)); for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) o[y + PY][x + PX] = g[y][x]; return o; }
function mk(o) { return { o, set: (x, y, c) => { x += PX; y += PY; if (x >= 0 && y >= 0 && x < W && y < H) o[y][x] = c; }, get: (x, y) => o[y + PY]?.[x + PX] ?? null, rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); } }; }
function pose(G, view, kind, coat) {
  const C = COATS[coat], sleeve = view === 'side' ? G.get(11, 18) || G.get(11, 16) : G.get(4, 17) || G.get(4, 16), paw = C.light;
  const clear = (x, y, w, h) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) G.set(x + i, y + j, null); };
  const move = (x, y, w, h, dx, dy) => { const buf = []; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) buf.push([x + i, y + j, G.get(x + i, y + j)]); clear(x, y, w, h); for (const [a, b, c] of buf) if (c) G.set(a + dx, b + dy, c); };
  if (kind === 'power') { if (view === 'side') { G.rect(8, 16, 3, 3, sleeve); G.rect(8, 19, 3, 2, paw); } else { move(4, 15, 2, 7, -1, -1); move(16, 15, 2, 7, 1, -1); G.set(3, 20, paw); G.set(18, 20, paw); } return; }
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
  h = Math.max(1, Math.round(h * 0.4)); // short soft fur tufts (not a tall spiky crest)
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
  if (stage === 3) { const M = S.mane; // short neck ruff (shortened from the old long mane), drawn behind (only into empty cells) except the back view
    if (view === 'down') for (let y = 6; y < 15; y++) { const w = y < 8 ? 1 : 2; for (let k = 0; k < w; k++) for (const x of [-k, GW - 1 + k]) if (!G.get(x, y + by)) G.set(x, y + by, (y + k) % 3 ? M[0] : M[1]); }
    if (view === 'up') for (let y = 4; y < 14; y++) { const half = y < 6 ? 5 : y < 11 ? 7 : 7 - (y - 11) * 2; for (let x = 11 - half; x < 11 + half; x++) G.set(x, y + by, ((x + y) % 4 === 0) ? M[1] : ((x * 7 + y) % 5 === 0 ? M[2] : M[0])); }
    if (view === 'side') for (let y = 5; y < 14; y++) { const x0 = y < 8 ? 4 : 2, x1 = 6; for (let x = x0; x <= x1; x++) if (!G.get(x, y + by)) G.set(x, y + by, (x + y) % 3 ? M[0] : M[1]); }
  }
  void cols; void big; void hb; // no head crest/spikes: forms differ by coat colour, eye glow and (Wild Howl) a short neck ruff only
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
