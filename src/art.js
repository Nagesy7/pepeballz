// Procedural pixel art (tiles, Cate, Pepe, enemies, orbs, humans) in the Inu Verse palette: dark ink outlines, warm shading.
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; };
let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const px = (g, x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
const INK = '#1a1420';
export function blob(g, cx, cy, rx, ry, fill, shade, hi, outline) {
  const inside = (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
  for (let y = Math.floor(cy - ry) - 1; y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx) - 1; x <= cx + rx + 1; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1);
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    let c = fill; if (shade && nx * 0.5 + ny > 0.45) c = shade; if (hi && nx * 0.7 + ny < -0.75 && nx * nx + ny * ny < 0.75) c = hi;
    px(g, x, y, edge && outline ? outline : c);
  }
}
const T = 16; export const tiles = {};
function tile(key, n, fn) { tiles[key] = []; for (let v = 0; v < n; v++) { const [c, g] = mk(T, T); seed = 7 + v * 131 + key.charCodeAt(0) * 17; fn(g, v); tiles[key].push(c); } }
function speck(g, base, cols, n) { g.fillStyle = base; g.fillRect(0, 0, T, T); for (let i = 0; i < n; i++) px(g, rnd() * T | 0, rnd() * T | 0, cols[rnd() * cols.length | 0]); }
const grass = (g) => { speck(g, '#6cbf4a', ['#5aa83e', '#7fcf57', '#5aa83e'], 22); for (let i = 0; i < 3; i++) { const x = rnd() * 13 | 0, y = 2 + rnd() * 12 | 0; px(g, x, y, '#4e9636'); px(g, x + 1, y - 1, '#4e9636'); px(g, x + 2, y, '#4e9636'); } };
tile('.', 4, grass);
tile(',', 2, (g) => { grass(g); for (let i = 0; i < 6; i++) px(g, rnd() * T | 0, rnd() * T | 0, '#9ee06e'); });
tile('f', 3, (g, v) => { grass(g); const cs = [['#fff4f0', '#f6c94c'], ['#ff8fb5', '#fff'], ['#ffe066', '#e07a2e']][v]; for (let i = 0; i < 4; i++) { const x = 2 + rnd() * 11 | 0, y = 2 + rnd() * 11 | 0; for (const [a, b] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) px(g, x + a, y + b, cs[0]); px(g, x, y, cs[1]); } });
tile('=', 3, (g) => speck(g, '#dcb878', ['#c9a062', '#e8cc94', '#b98d52'], 26));
tile('~', 2, (g, v) => { g.fillStyle = '#3b8bd4'; g.fillRect(0, 0, T, T); g.fillStyle = '#2f73b8'; g.fillRect(0, 12, T, 4); for (let i = 0; i < 3; i++) { const x = (i * 6 + v * 3) % 13, y = 3 + i * 4; g.fillStyle = '#7cc2f2'; g.fillRect(x, y, 4, 1); g.fillRect(x + 1, y - 1, 2, 1); } });
tile('B', 1, (g) => { for (let y = 0; y < T; y += 4) { g.fillStyle = '#b07a42'; g.fillRect(0, y, T, 3); g.fillStyle = '#d29a5a'; g.fillRect(0, y, T, 1); g.fillStyle = '#6e4524'; g.fillRect(0, y + 3, T, 1); } });
tile('T', 2, (g) => { grass(g); g.fillStyle = '#6e4524'; g.fillRect(6, 4, 4, 11); g.fillStyle = '#8f5d32'; g.fillRect(6, 4, 2, 11); g.fillStyle = '#3f2814'; g.fillRect(5, 15, 6, 1); });
tile('P', 1, (g) => { speck(g, '#b2a594', ['#9d907e', '#c4b8a8'], 20); g.fillStyle = '#5a3a20'; g.fillRect(6, 6, 4, 9); });
tile('R', 2, (g) => { grass(g); blob(g, 8, 9, 6.5, 5.5, '#9aa3ad', '#6f7781', '#c9d0d6', '#3e434a'); });
tile('r', 2, (g) => { speck(g, '#b2a594', ['#9d907e', '#c4b8a8'], 20); blob(g, 8, 9, 6.5, 5.5, '#8f8a84', '#625d58', '#bdb8b0', '#38342f'); });
tile('S', 2, (g) => { g.fillStyle = '#b8b2a8'; g.fillRect(0, 0, T, T); g.fillStyle = '#8c857a'; g.fillRect(0, 7, T, 1); g.fillRect(0, 15, T, 1); g.fillRect(7, 0, 1, 7); g.fillRect(3, 8, 1, 7); g.fillRect(12, 8, 1, 7); g.fillStyle = '#d0cbc2'; g.fillRect(0, 0, 7, 1); g.fillRect(8, 0, 8, 1); g.fillRect(4, 8, 8, 1); });
tile('g', 3, (g) => speck(g, '#b2a594', ['#9d907e', '#c4b8a8', '#8a7e6e'], 30));
tile('*', 3, (g) => speck(g, '#eef4fa', ['#d6e2ee', '#ffffff', '#c8d6e6'], 18));
tile('M', 2, (g, v) => { g.fillStyle = '#8a6a4a'; g.fillRect(0, 0, T, T); for (let x = 0; x < T; x += 4) { g.fillStyle = '#6e5236'; g.fillRect(x + (v * 2) % 4, 0, 1, T); } g.fillStyle = '#a88660'; g.fillRect(0, 0, T, 2); g.fillStyle = '#4e3824'; g.fillRect(0, 14, T, 2); for (let i = 0; i < 6; i++) px(g, rnd() * T | 0, 3 + rnd() * 10 | 0, '#b8956c'); });
tile('^', 1, (g) => { g.fillStyle = '#c44a3a'; g.fillRect(0, 0, T, T); for (let y = 0; y < T; y += 4) { g.fillStyle = '#9a3328'; g.fillRect(0, y + 3, T, 1); g.fillStyle = '#e06a52'; g.fillRect(0, y, T, 1); for (let x = (y / 4 % 2) * 4; x < T; x += 8) { g.fillStyle = '#9a3328'; g.fillRect(x, y, 1, 4); } } });
tile('H', 2, (g, v) => { g.fillStyle = '#f2e2c0'; g.fillRect(0, 0, T, T); g.fillStyle = '#8f5d32'; g.fillRect(0, 0, T, 2); g.fillRect(0, 14, T, 2); g.fillRect(0, 0, 2, T); if (v) { g.fillStyle = '#5a3a20'; g.fillRect(4, 4, 8, 7); g.fillStyle = '#8ed0f0'; g.fillRect(5, 5, 6, 5); g.fillStyle = '#d6f0ff'; g.fillRect(5, 5, 2, 2); g.fillStyle = '#5a3a20'; g.fillRect(8, 5, 1, 5); } });
tile('D', 1, (g) => { g.fillStyle = '#f2e2c0'; g.fillRect(0, 0, T, T); g.fillStyle = '#5a3a20'; g.fillRect(3, 2, 10, 14); g.fillStyle = '#8f5d32'; g.fillRect(4, 3, 8, 13); g.fillStyle = '#f6c94c'; g.fillRect(10, 9, 1, 2); });
tile('F', 1, (g) => { grass(g); g.fillStyle = '#8f5d32'; g.fillRect(0, 6, T, 2); g.fillRect(0, 11, T, 2); g.fillStyle = '#6e4524'; g.fillRect(2, 4, 3, 11); g.fillRect(11, 4, 3, 11); g.fillStyle = '#b07a42'; g.fillRect(2, 4, 1, 11); g.fillRect(11, 4, 1, 11); });
tile('A', 1, (g) => { g.fillStyle = '#b8b2a8'; g.fillRect(0, 0, T, T); g.fillStyle = '#6f6a62'; g.fillRect(1, 5, 14, 11); g.fillStyle = '#d0cbc2'; g.fillRect(1, 5, 14, 2); g.fillStyle = '#8c857a'; g.fillRect(2, 7, 12, 8); blob(g, 8, 5, 4.5, 3.5, '#4fc25a', '#2f8a3c', '#a6f0a0', '#1d4a22'); px(g, 6, 4, INK); px(g, 10, 4, INK); });
export const SOLID = new Set(['T', 'P', 'R', 'r', '^', 'H', 'D', 'M', 'A', '~', 'F']);
export const TALL = { T: 'canopy', P: 'pine' };
const [canopy, cg] = mk(26, 24); seed = 99; blob(cg, 13, 11, 12, 10.5, '#3f9a3a', '#2d7430', '#6cc456', '#1c4a20'); for (let i = 0; i < 16; i++) px(cg, 5 + rnd() * 16 | 0, 4 + rnd() * 12 | 0, rnd() < .5 ? '#5ab64a' : '#2d7430');
const [pine, pg] = mk(24, 28); for (let i = 0; i < 4; i++) blob(pg, 12, 5 + i * 5, 4 + i * 2.6, 4, i % 2 ? '#2f7a52' : '#36885c', '#215a3c', '#e8f2f8', '#123824');
export const tall = { canopy, pine };
function cate(sq, angry) {
  const [c, g] = mk(64, 58); const ry = 17 - sq * 3, rx = 22 + sq * 3, cy = 38 + sq * 3;
  for (let i = 0; i < 14; i++) blob(g, 51 + Math.sin(i / 3) * 3 + i * 0.5, cy - i * 1.5, 2.6, 2.6, '#ff8fc8', '#e0609f', null, i > 11 ? '#7a1f4f' : null);
  for (const s of [-1, 1]) for (let y = 0; y < 10; y++) for (let x = 0; x <= 9 - y; x++) px(g, Math.round(32 + s * 12 + x - (9 - y) / 2), cy - ry + 4 - y, x === 0 || x === 9 - y ? '#7a1f4f' : (x > 2 && x < 7 - y ? '#ffd0e6' : '#ff8fc8'));
  blob(g, 32, cy, rx, ry, '#ff8fc8', '#e0609f', '#ffd0e6', '#7a1f4f'); blob(g, 32, cy + 7, rx * 0.55, ry * 0.4, '#ffc2df', null, null, null);
  blob(g, 24, cy - 5, 5, 5.5, '#ffffff', '#f2e8ff', null, '#3a0d26'); blob(g, 41, cy - 6, 6, 6.5, '#ffffff', '#f2e8ff', null, '#3a0d26');
  g.fillStyle = angry ? '#d01040' : '#2a1036'; g.fillRect(24, cy - 6, 3, 4); g.fillRect(41, cy - 8, 4, 5); px(g, 24, cy - 6, '#fff'); px(g, 41, cy - 8, '#fff');
  if (angry) { g.fillStyle = '#7a1f4f'; g.fillRect(19, cy - 12, 8, 1); g.fillRect(37, cy - 14, 9, 1); }
  for (let x = 24; x <= 40; x++) px(g, x, cy + 3 + Math.round(Math.sin((x - 24) / 16 * Math.PI) * 3), '#3a0d26');
  g.fillStyle = '#fff'; g.fillRect(27, cy + 5, 2, 3); g.fillRect(36, cy + 5, 2, 3);
  g.fillStyle = '#7a1f4f'; g.fillRect(6, cy, 7, 1); g.fillRect(6, cy + 3, 7, 1); g.fillRect(51, cy, 7, 1); g.fillRect(51, cy + 3, 7, 1);
  g.fillStyle = '#ff5fa8'; g.fillRect(16, cy + 1, 4, 2); g.fillRect(45, cy + 1, 4, 2); return c;
}
function kitten(f) { const [c, g] = mk(20, 18); const s = f ? 1 : 0; for (const d of [-1, 1]) { g.fillStyle = '#7a1f4f'; g.fillRect(10 + d * 5 - 1, 3 + s, 3, 1); g.fillStyle = '#ff8fc8'; g.fillRect(10 + d * 5 - 1, 4 + s, 3, 3); }
  blob(g, 10, 11 + s, 8 + s, 6 - s, '#ff8fc8', '#e0609f', '#ffd0e6', '#7a1f4f'); g.fillStyle = '#2a1036'; g.fillRect(6, 9 + s, 2, 3); g.fillRect(12, 9 + s, 2, 3); px(g, 6, 9 + s, '#fff'); px(g, 12, 9 + s, '#fff'); g.fillStyle = '#3a0d26'; g.fillRect(9, 13 + s, 2, 1); return c; }
function boar(f) { const [c, g] = mk(26, 21); blob(g, 13, 12, 11, 7, '#8a5a3a', '#5e3a22', '#b07a52', '#2e1a0e');
  for (let i = 0; i < 6; i++) { g.fillStyle = '#3f7a2e'; g.fillRect(5 + i * 3, 3 + (i % 2), 2, 4); px(g, 5 + i * 3, 2 + (i % 2), '#9ee06e'); }
  g.fillStyle = '#2e1a0e'; g.fillRect(6 + f, 18, 3, 3); g.fillRect(17 - f, 18, 3, 3); g.fillStyle = '#d88a7a'; g.fillRect(9, 13, 8, 4); px(g, 11, 14, '#5e3a22'); px(g, 14, 14, '#5e3a22');
  g.fillStyle = '#fff4e0'; g.fillRect(7, 13, 2, 3); g.fillRect(17, 13, 2, 3); g.fillStyle = INK; g.fillRect(9, 10, 2, 2); g.fillRect(15, 10, 2, 2); return c; }
function golem(f) { const [c, g] = mk(26, 29); blob(g, 5, 17 + f, 4, 5, '#8f8a84', '#625d58', '#bdb8b0', '#38342f'); blob(g, 21, 17 - f, 4, 5, '#8f8a84', '#625d58', '#bdb8b0', '#38342f');
  blob(g, 13, 16, 8, 9, '#a39e96', '#6f6a64', '#cfcac2', '#38342f'); blob(g, 13, 7, 6, 5, '#a39e96', '#6f6a64', '#cfcac2', '#38342f');
  g.fillStyle = '#6ff0ff'; g.fillRect(10, 6, 2, 2); g.fillRect(15, 6, 2, 2); g.fillStyle = '#4fc25a'; g.fillRect(11, 14, 4, 4); px(g, 11, 14, '#a6f0a0');
  g.fillStyle = '#38342f'; g.fillRect(8 - f, 25, 4, 3); g.fillRect(14 + f, 25, 4, 3); return c; }
export const ORBCOL = ['#ff6b6b', '#ffb84d', '#ffe066', '#6ee07a', '#5cc8ff', '#8a7bff', '#ff7bd5'];
function pepe(blink) { const [c, g] = mk(120, 100);
  blob(g, 60, 64, 50, 32, '#4fb04a', '#357a34', '#7fd46c', '#173a18'); blob(g, 60, 75, 34, 17, '#cfe9a0', '#b4d488', null, null);
  for (const s of [-1, 1]) { const ex = 60 + s * 24; blob(g, ex, 34, 18, 16, '#4fb04a', '#357a34', '#7fd46c', '#173a18'); blob(g, ex, 35, 12, 10, '#ffffff', '#e6eef0', null, '#173a18');
    if (blink) { g.fillStyle = '#173a18'; g.fillRect(ex - 10, 35, 20, 2); } else { g.fillStyle = '#1c1030'; g.fillRect(ex - 4 + s * 2, 30, 7, 9); g.fillStyle = '#fff'; g.fillRect(ex - 3 + s * 2, 31, 2, 2); }
    g.fillStyle = '#357a34'; g.fillRect(ex - 13, 23, 26, 2); }
  for (let x = 26; x <= 94; x++) { const y = 58 + Math.round(Math.sin((x - 26) / 68 * Math.PI) * 6); g.fillStyle = '#9b2d2d'; g.fillRect(x, y, 1, 3); px(g, x, y - 1, '#173a18'); }
  g.fillStyle = '#ff9a9a'; g.fillRect(16, 52, 8, 4); g.fillRect(96, 52, 8, 4);
  ORBCOL.forEach((col, i) => blob(g, 30 + i * 10, 13 + Math.abs(i - 3) * 2, 3.5, 3.5, col, null, '#ffffff', '#173a18')); return c; }
function orb(n) { const [c, g] = mk(14, 14); blob(g, 7, 7, 6, 6, '#58c45a', '#2f8a3c', '#c8ffb8', '#123a16');
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 - Math.PI / 2; px(g, Math.round(6.5 + Math.cos(a) * 2.6), Math.round(7 + Math.sin(a) * 2.6), '#fff27a'); } if (n === 1) px(g, 7, 7, '#fff27a'); px(g, 4, 4, '#fff'); return c; }
const [bone, bg] = mk(12, 8); bg.fillStyle = '#5a3a20'; bg.fillRect(0, 0, 12, 8); bg.clearRect(4, 0, 4, 1); bg.clearRect(4, 7, 4, 1); bg.fillStyle = '#fff4e0'; bg.fillRect(1, 1, 3, 6); bg.fillRect(8, 1, 3, 6); bg.fillRect(3, 2, 6, 4); bg.fillStyle = '#d8c8a8'; bg.fillRect(3, 5, 6, 1);
const [chest, chg] = mk(16, 14); chg.fillStyle = '#3f2814'; chg.fillRect(0, 2, 16, 12); chg.fillStyle = '#b07a42'; chg.fillRect(1, 3, 14, 10); chg.fillStyle = '#d29a5a'; chg.fillRect(1, 3, 14, 3); chg.fillStyle = '#f6c94c'; chg.fillRect(0, 6, 16, 2); chg.fillRect(7, 5, 2, 4);
// human ally, front-facing, matched to the 24x32 Inu sprite cell
function human(skin, hair, shirt, pants, long) { const [c, g] = mk(24, 32); const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  R(7, 27, 4, 4, INK); R(13, 27, 4, 4, INK); R(7, 21, 10, 7, pants); R(11, 22, 1, 6, '#00000040'); R(6, 14, 12, 8, shirt); R(4, 15, 2, 6, shirt); R(18, 15, 2, 6, shirt); R(4, 21, 2, 2, skin); R(18, 21, 2, 2, skin);
  blob(g, 12, 8, 6.5, 6.5, skin, '#e0a87a', null, INK); R(9, 8, 2, 2, INK); R(13, 8, 2, 2, INK); R(11, 11, 2, 1, '#8a4a3a'); R(7, 10, 1, 1, '#f0a0a0'); R(16, 10, 1, 1, '#f0a0a0');
  blob(g, 12, 4, 7, 3.5, hair, null, null, INK); R(5, 4, 2, long ? 12 : 4, hair); R(17, 4, 2, long ? 12 : 4, hair); return c; }
export function buildArt() {
  return { tiles, SOLID, TALL, tall, cate: [cate(0, 0), cate(1, 0), cate(0, 1), cate(-1, 1)], kitten: [kitten(0), kitten(1)], boar: [boar(0), boar(1)], golem: [golem(0), golem(1)],
    pepe: [pepe(0), pepe(1)], orbs: [1, 2, 3, 4, 5, 6, 7].map(orb), bone, chest, humans: { rin: human('#f4c8a0', '#3a2a6a', '#e0603a', '#2e4a7a', 1), tomo: human('#d8a070', '#e8e8e8', '#4a7a4a', '#6a5a3a', 0) } };
}
