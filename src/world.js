// Chapter 1 maps: Pawpaw Village, Whisker Woods, Fang Peak. Built procedurally from a fixed seed.
import { mulberry32 } from './kibble.js';
export const TILE = 16;
function area(id, name, w, h, fill, music) {
  const t = Array.from({ length: h }, () => new Array(w).fill(fill));
  const a = { id, name, w, h, t, music, exits: [], npcs: [], spawns: [], pickups: [] };
  a.set = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) t[y][x] = c; };
  a.rect = (x, y, rw, rh, c) => { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) a.set(x + i, y + j, c); };
  a.get = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? t[y][x] : 'M');
  return a;
}
function village() {
  const a = area('village', 'Pawpaw Village', 40, 30, '.', 'village'), r = mulberry32(11);
  for (let y = 0; y < 30; y++) for (let x = 0; x < 40; x++) { const v = r(); if (v < 0.08) a.set(x, y, ','); else if (v < 0.12) a.set(x, y, 'f'); }
  a.rect(0, 0, 40, 2, 'T'); a.rect(0, 28, 40, 2, 'T'); a.rect(0, 0, 2, 30, 'T'); a.rect(38, 0, 2, 30, 'T');
  a.rect(2, 14, 38, 2, '='); a.rect(19, 4, 2, 24, '='); a.rect(38, 13, 2, 4, '=');
  a.rect(15, 3, 10, 6, 'S'); a.set(19, 4, 'A'); a.set(20, 4, 'A');
  for (const [hx, hy] of [[5, 6], [27, 6], [5, 19], [27, 19]]) { a.rect(hx, hy, 6, 2, '^'); a.rect(hx, hy + 2, 6, 2, 'H'); a.set(hx + 1, hy + 2, 'H'); a.t[hy + 2][hx + 4] = 'H'; a.set(hx + 1, hy + 2, 'H'); a.t[hy + 2][hx + 1] = 'H'; a.t[hy + 2][hx + 4] = 'H'; a.set(hx + 2, hy + 3, 'D'); a.rect(hx + 2, hy + 4, 1, 1, '='); }
  for (const [hx, hy] of [[5, 6], [27, 6], [5, 19], [27, 19]]) { a.t[hy + 2][hx + 1] = 'H'; a.wins = 1; }
  a.rect(12, 22, 5, 4, '~'); a.rect(24, 24, 8, 1, 'F');
  a.exits.push({ x: 39, y: 13, w: 1, h: 4, to: 'forest', tx: 2.5, ty: 15 });
  a.npcs.push({ id: 'elder', coat: 'cream', eq: { top: 'suit_navy', bottom: 'slacks_navy', feet: 'loafers', hat: 'top_hat' }, x: 21.5, y: 8, face: 'down', name: 'Elder Hachi' });
  a.npcs.push({ id: 'akita', coat: 'red', eq: { top: 'jacket_black', bottom: 'slacks_black', feet: 'sneakers_gold', neck: 'chain_gold' }, x: 25, y: 16.2, face: 'left', name: 'Akita Ren' });
  a.npcs.push({ id: 'kai', coat: 'gray', eq: { top: 'hawaiian', bottom: 'chinos', feet: 'loafers' }, x: 14, y: 16.2, face: 'right', name: 'Kai' });
  a.npcs.push({ id: 'merchant', coat: 'dark', eq: { top: 'tux_black', bottom: 'slacks_black', feet: 'loafers', neck: 'bowtie' }, x: 31, y: 12, face: 'down', name: 'Biscuit Bram' });
  a.npcs.push({ id: 'pup', coat: 'tan', eq: { hat: 'cap_red' }, x: 9, y: 12, face: 'down', name: 'Pip' });
  a.npcs.push({ id: 'rin', human: 'rin', x: 23, y: 24, face: 'down', name: 'Rin (inventor)' });
  a.npcs.push({ id: 'tomo', human: 'tomo', x: 11, y: 24.5, face: 'down', name: 'Old Tomo' });
  a.pickups.push({ key: 'orb2', kind: 'orb', n: 2, x: 35, y: 26 }, { key: 'v_bone1', kind: 'item', id: 'bone', x: 3, y: 3 });
  return a;
}
function forest() {
  const a = area('forest', 'Whisker Woods', 50, 34, '.', 'forest'), r = mulberry32(22);
  const keep = new Set(), mark = (x, y, rad = 1) => { for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) keep.add((x + i) + ',' + (y + j)); };
  const path = []; for (let x = 0; x <= 25; x++) path.push([x, 14], [x, 15]); for (let y = 0; y <= 15; y++) path.push([24, y], [25, y]); for (let x = 24; x <= 45; x++) path.push([x, 24], [x, 25]); for (let y = 15; y <= 25; y++) path.push([24, y], [25, y]);
  for (const [x, y] of path) mark(x, y, 2);
  const clear = [[11, 26, 5], [40, 8, 5], [42, 26, 5], [10, 6, 4]]; for (const [cx, cy, rr] of clear) for (let j = -rr; j <= rr; j++) for (let i = -rr; i <= rr; i++) if (i * i + j * j <= rr * rr) keep.add((cx + i) + ',' + (cy + j));
  for (let y = 0; y < 34; y++) for (let x = 0; x < 50; x++) { const v = r(); if (x < 2 || y < 2 || x > 47 || y > 31 || (!keep.has(x + ',' + y) && v < 0.42)) a.set(x, y, 'T'); else if (v < 0.5) a.set(x, y, ','); else if (v < 0.53) a.set(x, y, 'f'); }
  for (const [x, y] of path) a.set(x, y, '=');
  a.rect(18, 15, 6, 11, '.'); for (let y = 16; y < 26; y++) for (let x = 18; x < 24; x++) if (r() < 0.25) a.set(x, y, 'T');
  for (let y = 2; y < 32; y++) { a.set(33, y, '~'); a.set(34, y, '~'); } a.set(33, 24, 'B'); a.set(34, 24, 'B'); a.set(33, 25, 'B'); a.set(34, 25, 'B');
  for (const [x, y] of [[8, 25], [14, 28], [12, 23]]) a.set(x, y, 'R');
  a.exits.push({ x: 0, y: 13, w: 1, h: 4, to: 'village', tx: 37, ty: 15 }, { x: 23, y: 0, w: 4, h: 1, to: 'mountain', tx: 20, ty: 41.5 });
  a.npcs.push({ id: 'shiro', coat: 'golden', eq: { top: 'hoodie_maroon', bottom: 'chinos', feet: 'sneakers_red', eyes: 'shades' }, x: 22, y: 12.5, face: 'down', name: 'Scout Shiro' });
  a.spawns.push(['kitten', 12, 15], ['kitten', 20, 14], ['kitten', 25, 8], ['boar', 11, 25], ['kitten', 14, 27], ['boar', 40, 8], ['kitten', 38, 10], ['boar', 42, 25], ['kitten', 44, 27], ['kitten', 30, 24]);
  a.pickups.push({ key: 'orb3', kind: 'orb', n: 3, x: 11, y: 27 }, { key: 'orb4', kind: 'orb', n: 4, x: 44, y: 26 }, { key: 'f_jerky', kind: 'item', id: 'jerky', x: 41, y: 7 }, { key: 'f_tea', kind: 'item', id: 'tea', x: 10, y: 5 });
  return a;
}
function mountain() {
  const a = area('mountain', 'Fang Peak', 40, 44, 'g', 'mountain'), r = mulberry32(33);
  for (let y = 0; y < 44; y++) for (let x = 0; x < 40; x++) { const v = r(); if (v < 0.07 && y > 17) a.set(x, y, 'r'); else if (v < 0.12) a.set(x, y, '*'); else if (v < 0.14 && y > 17) a.set(x, y, 'P'); }
  a.rect(0, 0, 40, 2, 'M'); a.rect(0, 42, 40, 2, 'M'); a.rect(0, 0, 2, 44, 'M'); a.rect(38, 0, 2, 44, 'M');
  const zig = [[19, 41], [19, 36], [9, 36], [9, 28], [29, 28], [29, 21], [19, 21], [19, 16]]; for (let i = 0; i < zig.length - 1; i++) { const [x0, y0] = zig[i], [x1, y1] = zig[i + 1]; for (let x = Math.min(x0, x1) - 1; x <= Math.max(x0, x1) + 1; x++) for (let y = Math.min(y0, y1) - 1; y <= Math.max(y0, y1) + 1; y++) a.set(x, y, '='); }
  a.rect(18, 42, 4, 2, '=');
  a.rect(2, 16, 36, 2, 'M'); a.rect(18, 16, 4, 2, '='); a.rect(2, 2, 36, 14, '*'); for (let i = 0; i < 18; i++) a.set(3 + Math.floor(r() * 34), 2 + Math.floor(r() * 3), 'M');
  for (const [x, y] of [[8, 6], [31, 6], [8, 12], [31, 12]]) a.set(x, y, 'r');
  a.exits.push({ x: 18, y: 43, w: 4, h: 1, to: 'forest', tx: 24.5, ty: 2.5 });
  a.npcs.push({ id: 'aki', human: 'rin', x: 17, y: 39, face: 'down', name: 'Ranger Aki' });
  a.spawns.push(['golem', 10, 33], ['kitten', 12, 36], ['golem', 28, 26], ['kitten', 22, 28], ['kitten', 30, 24], ['golem', 20, 20], ['kitten', 6, 30]);
  a.pickups.push({ key: 'orb5', kind: 'orb', n: 5, x: 5, y: 24 }, { key: 'orb6', kind: 'orb', n: 6, x: 35, y: 33 }, { key: 'm_jerky', kind: 'item', id: 'jerky', x: 34, y: 20 });
  a.boss = { x: 20, y: 7 };
  return a;
}
export function buildWorld() {
  const W = { village: village(), forest: forest(), mountain: mountain() };
  for (const a of Object.values(W)) for (const p of [...a.pickups, ...a.npcs]) { const x = Math.floor(p.x), y = Math.floor(p.y); if ('TPrRM~^HDF'.includes(a.get(x, y))) a.set(x, y, a.id === 'mountain' ? 'g' : '.'); }
  return W;
}
// walkable candidate spots for the seeded weekly hunt (fixed list so every player gets the same set)
export function huntSpots(W) {
  const out = []; for (const a of Object.values(W)) for (let y = 3; y < a.h - 3; y += 3) for (let x = 3; x < a.w - 3; x += 4) if ('.,f=g*'.includes(a.get(x, y)) && !(a.id === 'mountain' && y < 16)) out.push({ area: a.id, x: x + 0.5, y: y + 0.5 });
  return out;
}
