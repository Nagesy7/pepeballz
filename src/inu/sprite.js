// Procedural pixel-art Shiba avatars (upright, big head) with outfit layers.
// v2 grid (22x30): wide-set thick ears with rounded tips, fluffy cheek tufts,
// white urajiro on brows/muzzle/cheeks/chest, curled tail visible from every side.
// Each sprite is painted on a tiny grid, outlined, cached and blitted crisp.
import { COATS, normalizeCoat } from './coats.js';
import { outfitLook } from './outfits.js';

export const GW = 22, GH = 30, PAD = 1;
const SHIRT = '#f3ead6', SHIRT_D = '#d9ccb0', JEANS = '#26335e', JEANS_D = '#1a2446', INK = '#1a1420', MOUTH = '#5a3a32', TONGUE = '#e0707e', BELT = '#2b2116', BUCKLE = '#c9a24a';
const cache = new Map();

function grid() {
  const g = Array.from({ length: GH }, () => new Array(GW).fill(null));
  const set = (x, y, c) => { if (c && x >= 0 && y >= 0 && x < GW && y < GH) g[y][x] = c; };
  const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
  const sym = (x, y, c) => { set(x, y, c); set(GW - 1 - x, y, c); };          // mirrored pair (front view)
  const row = (y, x0, c) => rect(x0, y, GW - 2 * x0, 1, c);                   // symmetric row x0..GW-1-x0
  const srect = (x, y, w, h, c) => { rect(x, y, w, h, c); rect(GW - x - w, y, w, h, c); };
  return { g, set, rect, sym, row, srect };
}

// face: 'down' | 'up' | 'side' (side = facing right; left is mirrored)
export function paint(coatKey, face, frame, equipped) {
  const C = COATS[normalizeCoat(coatKey)], o = outfitLook(equipped), G = grid(), { set, rect, sym, row, srect } = G;
  const step = frame % 2 === 1 ? (frame === 1 ? -1 : 1) : 0;
  const by = frame % 2 === 1 ? 1 : 0;
  const top = o.top, gown = top?.kind === 'gown';
  const pants = o.bottom || { c: JEANS, d: JEANS_D };
  const shirtC = top ? top.c : SHIRT, shirtD = top ? top.d : SHIRT_D;
  const longSleeve = top && top.kind !== 'hawaiian' && top.kind !== 'gown';
  const hair = top?.hair && !o.hat ? top.hair : top?.hair?.long ? top.hair : null;

  if (face !== 'side') {
    const back = face === 'up';
    // ---- tail (behind body): front view peeks out at right hip, back view curls on the back
    if (!back) { rect(16, 18 + by, 3, 3, C.base); set(19, 18 + by, C.base); set(17, 19 + by, C.light); set(18, 17 + by, C.base); set(18, 20 + by, C.light); }
    // ---- legs / feet
    const legs = [[6, step === -1 ? -1 : 0], [12, step === 1 ? -1 : 0]];
    if (!gown) for (const [lx, ly] of legs) {
      rect(lx, 24 + ly + by, 4, 4, pants.c); rect(lx + 3, 24 + ly + by, 1, 4, pants.d);
      if (pants.rip) { set(lx + 1, 25 + ly + by, pants.rip); set(lx + 2, 26 + ly + by, pants.rip); }
    }
    for (const [lx, ly] of legs) {
      const fx = lx - (lx < 10 ? 1 : 0), fy = 28 + ly + by;
      if (o.feet) { rect(fx, fy, 5, 2, o.feet.c); rect(fx, fy + 1, 5, 1, o.feet.sole); if (o.feet.c !== '#141418') set(fx + 2, fy, o.feet.sole); }
      else { rect(fx + 1, fy, 4, 2, C.light); set(fx + 2, fy + 1, C.dark); set(fx + 3, fy + 1, C.dark); }
    }
    if (!gown) { rect(6, 23 + by, 10, 1, BELT); set(10, 23 + by, BUCKLE); set(11, 23 + by, BUCKLE); }
    // ---- torso
    rect(6, 15 + by, 10, 8, shirtC); rect(15, 15 + by, 1, 8, shirtD); rect(6, 15 + by, 10, 1, shirtD);
    // arms swing opposite to legs
    const armL = step === 1 ? -1 : 0, armR = step === -1 ? -1 : 0;
    for (const [ax, ay] of [[4, armL], [16, armR]]) {
      rect(ax, 15 + ay + by, 2, longSleeve ? 6 : 2, shirtC); set(ax === 4 ? ax : ax + 1, 16 + ay + by, shirtD);
      if (!longSleeve) rect(ax, 17 + ay + by, 2, 4, gown ? C.base : C.base);
      rect(ax, 21 + ay + by, 2, 1, C.light);
      if (o.neck?.kind === 'chain' && gown && ax === 16) set(ax, 19 + ay + by, o.neck.c); // bracelet
    }
    if (gown) {
      // fitted bodice + flared skirt with gold trim, slit and sparkle
      rect(6, 15 + by, 10, 8, top.c); row(15 + by, 6, top.accent); sym(6, 15 + by, C.base); sym(7, 15 + by, C.base);
      rect(10, 16 + by, 2, 1, C.light); // chest urajiro in neckline
      for (const yy of [17, 19, 21]) { set(8, yy + by, top.d); set(13, yy + by, top.d); }
      row(22 + by, 6, top.accent); set(10, 22 + by, '#fff1b0'); set(11, 22 + by, '#fff1b0');
      for (let r = 0; r < 7; r++) { const x0 = 6 - Math.floor((r + 1) / 2); row(23 + r + by, x0, top.c); set(x0, 23 + r + by, top.d); set(GW - 1 - x0, 23 + r + by, top.d); }
      row(29, 3, top.accent);
      for (const [px, py] of [[8, 24], [13, 25], [9, 27], [14, 27], [7, 28], [12, 23]]) set(px, py + by, top.accent);
      if (!back) { rect(12, 25 + by, 1, 4, top.d); set(12, 28 + by, C.light); } // slit
    }
    if (!back && top) {
      if (top.kind === 'suit') { rect(10, 15 + by, 2, 6, top.shirt); sym(9, 16 + by, top.d); sym(8, 17 + by, top.d); set(14, 17 + by, top.pin); set(7, 20 + by, top.d); set(14, 20 + by, top.d); rect(10, 21 + by, 2, 1, top.d); set(5, 20 + by, top.shirt); set(16, 20 + by, top.shirt); }
      if (top.kind === 'hoodie') { sym(8, 16 + by, '#f3ead6'); sym(8, 17 + by, '#f3ead6'); rect(9, 18 + by, 4, 2, top.accent); set(10, 18 + by, top.d); rect(7, 21 + by, 8, 1, top.d); row(15 + by, 6, top.d); }
      if (top.kind === 'jacket') { rect(10, 15 + by, 2, 8, '#111'); set(10, 17 + by, top.accent); set(11, 19 + by, top.accent); set(14, 17 + by, top.accent); sym(7, 16 + by, top.d); }
      if (top.kind === 'hawaiian') { for (const [px, py] of [[7, 16], [13, 17], [8, 19], [14, 20], [6, 21], [12, 15], [9, 21], [4, 15], [17, 16]]) set(px, py + by, top.accent); rect(10, 15 + by, 1, 8, top.d); rect(10, 15 + by, 2, 2, C.light); }
    }
    if (!back && !top) rect(10, 15 + by, 2, 2, C.light), set(9, 15 + by, C.light), set(12, 15 + by, C.light); // tee neckline shows white chest
    if (back && top?.kind === 'hoodie') row(15 + by, 7, top.d), row(16 + by, 8, top.d);
    if (back && !gown) { rect(9, 18 + by, 4, 3, C.base); set(10, 19 + by, C.light); set(11, 19 + by, C.light); set(12, 18 + by, C.dark); } // curled tail on the back
    if (back && gown) { rect(9, 21 + by, 4, 3, C.base); set(10, 22 + by, C.light); }
    // neck accessories
    if (!back && o.neck) {
      if (o.neck.kind === 'tie') { rect(10, 15 + by, 2, 1, o.neck.c); rect(10, 16 + by, 2, 4, o.neck.c); set(10, 20 + by, o.neck.c); set(11, 19 + by, '#8e1a20'); }
      if (o.neck.kind === 'bow') { rect(8, 15 + by, 6, 1, o.neck.c); sym(8, 16 + by, o.neck.c); rect(10, 15 + by, 2, 2, '#444'); }
      if (o.neck.kind === 'chain') { sym(7, 15 + by, o.neck.c); sym(8, 16 + by, o.neck.c); sym(9, 17 + by, o.neck.c); rect(10, 18 + by, 2, 1, o.neck.c); rect(10, 19 + by, 2, 1, '#fff1b0'); }
    }
    // ---- long hair behind head (gown)
    const hy = by;
    if (hair?.long) { for (let y = 4; y < 20; y++) { const w = y < 8 ? 2 : 3; srect(0, y + hy, w, 1, (y % 3) ? hair.c : hair.d); } sym(2, 18 + hy, hair.c); sym(1, 20 + hy, hair.d); }
    // ---- ears: wide-set, thick, rounded tips
    for (const L of [true, false]) {
      const e = (x, y, w, c) => L ? rect(x, y + hy, w, 1, c) : rect(GW - x - w, y + hy, w, 1, c);
      e(3, 0, 2, C.base); e(2, 1, 4, C.base); e(2, 2, 5, C.base); e(1, 3, 7, C.base); e(1, 4, 8, C.base);
      if (!back) { e(3, 2, 2, C.ear); e(3, 3, 3, C.ear); e(4, 4, 3, C.ear); e(2, 3, 1, C.light); }
      else e(2, 2, 1, C.dark);
    }
    // ---- head: broad skull, fluffy cheek tufts
    row(4 + hy, 5, C.base); row(5 + hy, 2, C.base);
    for (let y = 6; y <= 11; y++) row(y + hy, 1, C.base);
    row(12 + hy, 1, C.base); row(13 + hy, 2, C.base); row(14 + hy, 5, C.base);
    sym(0, 10 + hy, C.base); sym(0, 11 + hy, C.base); sym(1, 13 + hy, C.base); // cheek fluff
    rect(20, 6 + hy, 1, 7, C.dark); set(21, 11 + hy, C.dark); set(19, 13 + hy, C.dark); rect(15, 14 + hy, 2, 1, C.dark);
    if (!back) {
      sym(6, 5 + hy, C.light); sym(7, 5 + hy, C.light); // urajiro brow dots
      // urajiro: muzzle, cheeks, chin
      rect(8, 9 + hy, 6, 1, C.light); row(10 + hy, 3, C.light); row(11 + hy, 1, C.light); sym(0, 11 + hy, C.light);
      row(12 + hy, 2, C.light); row(13 + hy, 3, C.light); row(14 + hy, 6, C.light); sym(3, 9 + hy, C.light); sym(4, 9 + hy, C.light);
      sym(1, 12 + hy, C.base); sym(2, 13 + hy, C.base);
      // eyes, nose, smile, tongue
      srect(6, 7 + hy, 2, 2, INK); sym(6, 7 + hy, '#5a4844');
      rect(9, 9 + hy, 4, 1, INK); rect(10, 10 + hy, 2, 1, INK); set(10, 9 + hy, '#4a4048');
      set(10, 11 + hy, MOUTH); set(11, 11 + hy, MOUTH); sym(8, 12 + hy, MOUTH); sym(9, 12 + hy, MOUTH); rect(10, 12 + hy, 2, 1, TONGUE);
      sym(4, 11 + hy, '#f0a8a8');
      if (o.eyes) { row(7 + hy, 3, o.eyes.frame); srect(4, 7 + hy, 5, 2, o.eyes.c); sym(5, 7 + hy, '#5a6070'); }
    } else { row(11 + hy, 3, C.dark); row(12 + hy, 4, C.dark); row(5 + hy, 6, C.dark); }
    if (hair && !hair.long) { row(4 + hy, 6, hair.c); row(3 + hy, 7, hair.c); rect(8, 2 + hy, 6, 1, hair.c); set(9, 2 + hy, hair.d); set(12, 3 + hy, hair.d); set(14, 1 + hy, hair.c); }
    if (hair?.long && !o.hat) { row(4 + hy, 5, hair.c); row(3 + hy, 6, hair.l); rect(7, 2 + hy, 8, 1, hair.c); if (!back) { sym(3, 5 + hy, hair.c); sym(2, 6 + hy, hair.d); set(9, 4 + hy, hair.d); set(13, 4 + hy, hair.d); } else for (let y = 5; y < 18; y++) row(y + hy, 3 + (y > 14 ? 2 : 0), y % 3 ? hair.c : hair.l); }
    if (o.hat?.kind === 'cap') { row(2 + hy, 5, o.hat.c); row(3 + hy, 4, o.hat.c); row(4 + hy, 4, o.hat.c); set(10, 2 + hy, o.hat.d); set(11, 2 + hy, o.hat.d); rect(17, 3 + hy, 1, 2, o.hat.d); if (!back) row(5 + hy, 3, o.hat.d); else row(5 + hy, 7, o.hat.d); }
    if (o.hat?.kind === 'tophat') { rect(6, 0 + hy, 10, 4, o.hat.c); rect(6, 3 + hy, 10, 1, o.hat.band); row(4 + hy, 3, o.hat.d); rect(15, 0 + hy, 1, 3, o.hat.d); }
  } else {
    // ---- side view (facing right) ----
    const legF = step === 1 ? 1 : step === -1 ? -1 : 0, hy = by;
    if (hair?.long) for (let y = 3; y < 20; y++) rect(3, y + hy, y < 6 ? 3 : 4, 1, y % 3 ? hair.c : hair.d);
    // curled tail over the back
    if (!gown) { rect(3, 15 + by, 4, 3, C.base); set(2, 16 + by, C.base); set(4, 14 + by, C.base); set(5, 14 + by, C.base); set(4, 16 + by, C.light); set(5, 16 + by, C.light); set(3, 17 + by, C.dark); }
    else { rect(4, 20 + by, 3, 3, C.base); set(5, 21 + by, C.light); }
    if (!gown) {
      rect(8 - legF, 24 + by, 3, 4, pants.d); rect(11 + legF, 24 + by, 3, 4, pants.c);
      if (pants.rip) set(12 + legF, 25 + by, pants.rip);
    }
    for (const [fx, near] of [[8 - legF, 0], [11 + legF, 1]]) {
      if (o.feet) { rect(fx, 28 + by, 5, 2, o.feet.c); rect(fx, 29 + by, 5, 1, o.feet.sole); }
      else rect(fx + 1, 28 + by, 4, 2, near ? C.light : C.dark);
    }
    if (!gown) { rect(7, 23 + by, 8, 1, BELT); set(13, 23 + by, BUCKLE); rect(7, 24 + by, 7, 1, pants.c); }
    rect(7, 15 + by, 8, 8, shirtC); rect(7, 15 + by, 1, 8, shirtD);
    if (!top) { rect(13, 15 + by, 2, 2, C.light); }
    if (top?.kind === 'suit') { rect(13, 15 + by, 2, 4, top.shirt); set(12, 17 + by, top.pin); }
    if (top?.kind === 'hawaiian') for (const [px, py] of [[8, 16], [12, 18], [9, 20], [13, 21]]) set(px, py + by, top.accent);
    if (top?.kind === 'jacket') { rect(14, 15 + by, 1, 8, '#111'); set(14, 18 + by, top.accent); }
    if (top?.kind === 'hoodie') { rect(7, 15 + by, 3, 3, top.d); set(14, 19 + by, top.accent); }
    if (gown) {
      rect(7, 15 + by, 8, 1, top.accent); rect(13, 16 + by, 2, 1, C.light); rect(7, 22 + by, 8, 1, top.accent);
      for (let r = 0; r < 7; r++) { const x0 = 7 - Math.floor((r + 1) / 2), w = 8 + Math.floor((r + 1) / 2) * 2; rect(x0, 23 + r + by, w, 1, top.c); set(x0, 23 + r + by, top.d); }
      rect(4, 29, 14, 1, top.accent); set(10, 25 + by, top.accent); set(13, 27 + by, top.accent);
    }
    if (o.neck?.kind === 'chain') { set(13, 16 + by, o.neck.c); set(14, 17 + by, o.neck.c); set(14, 18 + by, '#fff1b0'); }
    if (o.neck?.kind === 'tie') rect(14, 16 + by, 1, 4, o.neck.c);
    if (o.neck?.kind === 'bow') { set(14, 15 + by, o.neck.c); set(14, 16 + by, o.neck.c); }
    const arm = -legF;
    rect(10 + arm, 15 + by, 3, longSleeve ? 6 : 2, shirtC); set(10 + arm, 16 + by, shirtD);
    if (!longSleeve) rect(10 + arm, 17 + by, 3, 4, C.base);
    rect(10 + arm, 21 + by, 3, 1, C.light);
    // head
    rect(6, 1 + hy, 2, 4, C.dark); set(7, 0 + hy, C.dark); // far ear
    rect(10, 0 + hy, 2, 1, C.base); rect(9, 1 + hy, 4, 1, C.base); rect(9, 2 + hy, 5, 1, C.base); rect(8, 3 + hy, 6, 2, C.base);
    rect(10, 2 + hy, 2, 1, C.ear); rect(10, 3 + hy, 3, 1, C.ear);
    rect(5, 4 + hy, 12, 1, C.base); rect(4, 5 + hy, 13, 8, C.base); set(3, 9 + hy, C.base); set(3, 11 + hy, C.base); rect(5, 13 + hy, 11, 1, C.base); rect(7, 14 + hy, 7, 1, C.base);
    rect(4, 6 + hy, 1, 6, C.dark); rect(5, 13 + hy, 2, 1, C.dark);
    // snout: tan bridge, white underside, black nose
    rect(16, 8 + hy, 4, 1, C.base); rect(16, 9 + hy, 5, 3, C.light); rect(15, 12 + hy, 4, 1, C.light);
    rect(20, 8 + hy, 2, 2, INK); set(19, 11 + hy, MOUTH); set(18, 11 + hy, MOUTH); set(17, 12 + hy, TONGUE);
    rect(10, 10 + hy, 6, 3, C.light); rect(9, 13 + hy, 6, 1, C.light); rect(9, 14 + hy, 5, 1, C.light); set(3, 11 + hy, C.light); // cheek urajiro
    rect(14, 6 + hy, 1, 2, INK); set(15, 5 + hy, C.light); set(14, 5 + hy, C.light);
    set(12, 11 + hy, '#f0a8a8');
    if (o.eyes) { rect(11, 6 + hy, 7, 1, o.eyes.frame); rect(13, 6 + hy, 4, 2, o.eyes.c); set(14, 6 + hy, '#5a6070'); }
    if (hair && !hair.long) { rect(7, 3 + hy, 9, 2, hair.c); rect(12, 2 + hy, 5, 1, hair.c); set(17, 3 + hy, hair.c); set(10, 3 + hy, hair.d); }
    if (hair?.long && !o.hat) { rect(5, 3 + hy, 10, 2, hair.c); rect(6, 2 + hy, 8, 1, hair.l); set(15, 4 + hy, hair.d); }
    if (o.hat?.kind === 'cap') { rect(6, 2 + hy, 9, 1, o.hat.c); rect(5, 3 + hy, 11, 2, o.hat.c); rect(5, 3 + hy, 1, 2, o.hat.d); rect(15, 5 + hy, 5, 1, o.hat.d); }
    if (o.hat?.kind === 'tophat') { rect(7, 0 + hy, 8, 4, o.hat.c); rect(7, 3 + hy, 8, 1, o.hat.band); rect(5, 4 + hy, 12, 1, o.hat.d); }
  }
  return G.g;
}

function toCanvas(g, mirror) {
  const W = GW + PAD * 2, H = GH + PAD * 2;
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
  const c = cv.getContext('2d');
  const at = (x, y) => (y >= 0 && y < GH && x >= 0 && x < GW ? g[y][mirror ? GW - 1 - x : x] : null);
  for (let y = -1; y <= GH; y++) for (let x = -1; x <= GW; x++) {
    const col = at(x, y);
    if (col) { c.fillStyle = col; c.fillRect(x + PAD, y + PAD, 1, 1); }
    else if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) { c.fillStyle = INK; c.fillRect(x + PAD, y + PAD, 1, 1); }
  }
  return cv;
}

export function shibaSprite(coat, face = 'down', frame = 0, equipped = {}) {
  const mirror = face === 'left', f = face === 'left' || face === 'right' ? 'side' : face;
  const key = `${coat}|${face}|${frame}|${JSON.stringify(equipped || {})}`;
  let cv = cache.get(key);
  if (!cv) { cv = toCanvas(paint(coat, f, frame, equipped), mirror); cache.set(key, cv); if (cache.size > 600) cache.delete(cache.keys().next().value); }
  return cv;
}
