// Ambient life: original pixel critters + motion drawn in code (Inu Verse palette). Dragonflies and fish ripples by the water,
// butterflies on flowers, fireflies at dusk, birds overhead, swaying grass and reeds, drifting leaves / petals / mountain motes.
// Phone-light: counts are capped per quality level (0 low / 1 medium / 2 high) and the level drops automatically on low FPS.
const TILE = 16;
export const CAPS = [ // per quality level
  { drag: 1, fly: 2, ff: 6, leaf: 3, ripple: 1, bird: 1, sway: false },
  { drag: 2, fly: 3, ff: 9, leaf: 6, ripple: 2, bird: 2, sway: true },
  { drag: 3, fly: 5, ff: 14, leaf: 11, ripple: 4, bird: 3, sway: true },
];
// 0 by day, 1 at night; dusk ramps 17:00-19:00, dawn 05:00-07:00 (player's local clock).
export function nightFactor(hours) { const h = ((hours % 24) + 24) % 24; if (h >= 19 || h < 5) return 1; if (h >= 17) return (h - 17) / 2; if (h < 7) return 1 - (h - 5) / 2; return 0; }
// FPS-based quality governor. startQ: 1 on small / touch screens, 2 otherwise.
export function createPerf(startQ = 2) {
  return { q: startQ, maxQ: startQ, fps: 60, acc: 0, n: 0, low: 0, high: 0,
    sample(dt) { if (dt <= 0 || dt > 0.25) return this.q; this.acc += dt; this.n++; if (this.acc < 0.5) return this.q; this.fps = this.n / this.acc; this.acc = 0; this.n = 0;
      if (this.fps < 48) { this.low += 0.5; this.high = 0; } else if (this.fps > 57) { this.high += 0.5; this.low = 0; } else { this.low = 0; this.high = 0; }
      if (this.low >= 2 && this.q > 0) { this.q--; this.low = 0; } if (this.high >= 8 && this.q < this.maxQ) { this.q++; this.high = 0; } return this.q; } };
}
const FLY_COLS = [['#ffb3e6', '#c85a9a'], ['#ffe066', '#c89a20'], ['#9ad0ff', '#3a78b8'], ['#fff8e8', '#b8a890']];
export function createAmbient() {
  const A = { area: null, drag: [], fly: [], ff: [], leaf: [], ripple: [], bird: [], water: [], flowers: [], reeds: [], grass: [], rippleT: 0, birdT: 2, caught: 0 };
  const rnd = Math.random, pick = (a) => a[(rnd() * a.length) | 0];
  A.reset = (area) => { A.area = area; for (const k of ['drag', 'fly', 'ff', 'leaf', 'ripple', 'bird']) A[k] = []; A.water = []; A.flowers = []; A.reeds = []; A.grass = [];
    const isWater = (x, y) => area.get(x, y) === '~';
    for (let y = 0; y < area.h; y++) for (let x = 0; x < area.w; x++) { const c = area.get(x, y);
      if (c === '~') A.water.push([x, y]); else if (c === 'f') A.flowers.push([x, y]); else if (c === ',') A.grass.push([x, y]);
      if ('.,f'.includes(c) && (isWater(x - 1, y) || isWater(x + 1, y) || isWater(x, y - 1) || isWater(x, y + 1))) A.reeds.push([x, y, (x * 13 + y * 7) % 3]); }
    A.birdT = 1 + rnd() * 3; };
  const inView = (x, y, cam, VW, VH, m = 24) => x > cam.x - m && x < cam.x + VW + m && y > cam.y - m && y < cam.y + VH + m;
  const nearWater = () => { const w = pick(A.water); return w ? [w[0] * TILE + 8 + (rnd() - 0.5) * 30, w[1] * TILE + 8 + (rnd() - 0.5) * 20] : null; };
  A.update = (dt, env) => {
    const { pl, cam, VW, VH, q, night, boost, onCatch } = env, cap = CAPS[q], a = A.area; if (!a) return;
    const outdoor = a.id === 'village' || a.id === 'forest';
    // dragonflies: hover + dart near water
    if (A.water.length) { while (A.drag.length < cap.drag) { const p = nearWater(); if (!p) break; A.drag.push({ x: p[0], y: p[1], tx: p[0], ty: p[1], t: rnd() * 2, z: 10 + rnd() * 8 }); }
      A.drag.length = Math.min(A.drag.length, cap.drag);
      for (const d of A.drag) { d.t -= dt; if (d.t <= 0) { const p = nearWater(); d.tx = p[0]; d.ty = p[1]; d.t = 0.8 + rnd() * 1.8; } d.x += (d.tx - d.x) * Math.min(1, dt * 3); d.y += (d.ty - d.y) * Math.min(1, dt * 3); } }
    // butterflies: daytime, flowers, gently flee; catchable by touching them
    const flyCap = outdoor && A.flowers.length ? Math.round(cap.fly * (1 - night * 0.8)) : 0;
    while (A.fly.length < flyCap) { const f = pick(A.flowers); A.fly.push({ x: f[0] * TILE + 8, y: f[1] * TILE + 8, tx: f[0] * TILE + 8, ty: f[1] * TILE + 8, t: 0, ph: rnd() * 6, col: pick(FLY_COLS), z: 8 }); }
    A.fly.length = Math.min(A.fly.length, Math.max(flyCap, 0));
    for (const b of A.fly) { b.t -= dt; b.ph += dt * 14; if (b.t <= 0) { const f = rnd() < 0.6 ? pick(A.flowers) : [b.x / TILE + (rnd() - 0.5) * 6, b.y / TILE + (rnd() - 0.5) * 4]; b.tx = f[0] * TILE + 8; b.ty = f[1] * TILE + 8; b.t = 2 + rnd() * 3; }
      const dx = b.x - pl.x, dy = b.y - 8 - pl.y, d = Math.hypot(dx, dy) || 1;
      if (d < 9) { onCatch?.('butterfly', b.x, b.y - b.z); const f = pick(A.flowers); Object.assign(b, { x: f[0] * TILE + 8, y: f[1] * TILE + 8, tx: f[0] * TILE + 8, ty: f[1] * TILE + 8, t: 1 }); continue; }
      let vx = (b.tx - b.x) * 0.6, vy = (b.ty - b.y) * 0.6; if (d < 28) { vx += dx / d * 38; vy += dy / d * 38; } const sp = Math.hypot(vx, vy); if (sp > 40) { vx *= 40 / sp; vy *= 40 / sp; }
      b.x += vx * dt + Math.sin(b.ph * 0.4) * 10 * dt; b.y += vy * dt; b.z = 8 + Math.sin(b.ph * 0.3) * 3; }
    // fireflies: dusk/night (or Firefly Night challenge), spawned around the camera so you can find them
    const ffCap = outdoor && (night > 0.35 || boost) ? Math.max(boost ? 6 : 0, Math.round(cap.ff * Math.max(night, boost ? 0.7 : 0))) : 0;
    let tries = 0; while (A.ff.length < ffCap && tries++ < 20) { const x = cam.x + rnd() * VW, y = cam.y + 20 + rnd() * (VH - 30); const c = a.get(Math.floor(x / TILE), Math.floor(y / TILE)); if ('.,f='.includes(c) || c === 'T') A.ff.push({ x, y, vx: 0, vy: 0, ph: rnd() * 6, z: 6 + rnd() * 10, t: 0 }); }
    A.ff.length = Math.min(A.ff.length, ffCap);
    for (let i = A.ff.length - 1; i >= 0; i--) { const f = A.ff[i]; f.ph += dt; f.t -= dt; if (f.t <= 0) { f.vx = (rnd() - 0.5) * 18; f.vy = (rnd() - 0.5) * 12; f.t = 1 + rnd() * 2; } f.x += f.vx * dt; f.y += f.vy * dt; f.z = 8 + Math.sin(f.ph * 1.3) * 4;
      if (!inView(f.x, f.y, cam, VW, VH, 60)) { A.ff.splice(i, 1); continue; }
      if (Math.hypot(f.x - pl.x, f.y - 8 - pl.y) < 10) { onCatch?.('firefly', f.x, f.y - f.z); A.ff.splice(i, 1); } }
    // fish ripples on visible water
    A.rippleT -= dt; for (const r of A.ripple) r.t += dt; A.ripple = A.ripple.filter((r) => r.t < 1.6);
    if (A.rippleT <= 0 && A.ripple.length < cap.ripple && A.water.length) { A.rippleT = 0.6 + rnd() * 1.4; const vis = A.water.filter(([x, y]) => inView(x * TILE, y * TILE, cam, VW, VH, 0)); const w = pick(vis);
      if (w) A.ripple.push({ x: w[0] * TILE + 3 + rnd() * 10, y: w[1] * TILE + 4 + rnd() * 8, t: 0, fish: rnd() < 0.3 }); }
    // birds crossing overhead (hawk on Fang Peak)
    A.birdT -= dt; if (A.birdT <= 0 && A.bird.length < cap.bird) { A.birdT = 4 + rnd() * 6; const dir = rnd() < 0.5 ? 1 : -1; A.bird.push({ x: dir > 0 ? cam.x - 20 : cam.x + VW + 20, y: cam.y + 20 + rnd() * VH * 0.5, vx: dir * (34 + rnd() * 18), ph: rnd() * 6, hawk: a.id === 'mountain', z: 40 }); }
    for (const b of A.bird) { b.x += b.vx * dt; b.ph += dt * (b.hawk ? 4 : 9); b.y += Math.sin(b.ph * 0.3) * 4 * dt; } A.bird = A.bird.filter((b) => b.x > cam.x - 60 && b.x < cam.x + VW + 60);
    // drifting leaves (forest), petals (village), motes (peak)
    const leafCap = cap.leaf; while (A.leaf.length < leafCap) A.leaf.push({ x: cam.x + rnd() * VW, y: cam.y - 10 - rnd() * VH, vy: 10 + rnd() * 10, ph: rnd() * 6, kind: a.id });
    A.leaf.length = Math.min(A.leaf.length, leafCap);
    for (const l of A.leaf) { l.ph += dt * 2; l.y += l.vy * dt; l.x += (Math.sin(l.ph) * 14 + (a.id === 'mountain' ? 12 : 4)) * dt; if (l.y > cam.y + VH + 8 || l.x > cam.x + VW + 20 || l.x < cam.x - 20) { l.x = cam.x + rnd() * VW; l.y = cam.y - 8; } }
  };
  // ground layer: under characters (swaying grass, reeds, ripples)
  A.drawGround = (ctx, R, cam, VW, VH, t, q) => { const ox = cam.x, oy = cam.y, cap = CAPS[q];
    if (cap.sway) for (const [x, y] of A.grass) { if (!inView(x * TILE, y * TILE, cam, VW, VH, 16)) continue; for (let k = 0; k < 2; k++) { const bx = x * TILE + 4 + k * 7 - ox, by = y * TILE + 12 - oy, s = Math.round(Math.sin(t * 2.2 + x * 0.9 + k) * 1.2);
      R(bx, by - 1, 1, 2, '#3f7a34'); R(bx + (s > 0 ? 1 : s < 0 ? -1 : 0), by - 3, 1, 2, '#5aa048'); R(bx + s, by - 4, 1, 1, '#8ac86a'); } }
    for (const [x, y, v] of A.reeds) { if (!inView(x * TILE, y * TILE, cam, VW, VH, 16)) continue; for (let k = 0; k < 2; k++) { const bx = x * TILE + 3 + k * 8 + v - ox, by = y * TILE + 14 - oy, s = Math.round(Math.sin(t * 1.6 + x + y + k * 2) * 1.5);
      R(bx, by - 4, 1, 4, '#4a7a30'); R(bx + (s >> 1), by - 8, 1, 4, '#5e9038'); R(bx + s, by - 11, 2, 3, '#6a4026'); R(bx + s, by - 12, 1, 1, '#9a6a3a'); } }
    for (const r of A.ripple) { const k = r.t / 1.6, rx = 1 + k * 7; ctx.globalAlpha = 0.7 * (1 - k); ctx.strokeStyle = '#d8f0ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(Math.round(r.x - ox), Math.round(r.y - oy), rx, rx * 0.4, 0, 0, 6.283); ctx.stroke();
      if (r.fish && r.t < 0.5) { const j = r.t / 0.5, fx = r.x - ox - 4 + j * 8, fy = r.y - oy - Math.sin(j * Math.PI) * 7; ctx.globalAlpha = 1; R(fx, fy, 3, 1, '#ff9a4a'); R(fx + (j < 0.5 ? -1 : 3), fy, 1, 1, '#c85a20'); } }
    ctx.globalAlpha = 1; };
  // air layer: over characters (dragonflies, butterflies, fireflies, birds, leaves)
  A.drawAir = (ctx, R, cam, VW, VH, t, night) => { const ox = cam.x, oy = cam.y;
    for (const d of A.drag) { const x = Math.round(d.x - ox), y = Math.round(d.y - d.z - oy), w = Math.floor(t * 30) % 2; ctx.globalAlpha = 0.25; R(x - 2, Math.round(d.y - oy), 5, 1, '#10202a'); ctx.globalAlpha = 1;
      R(x - 2, y, 6, 1, '#2aa8b8'); R(x + 3, y, 1, 1, '#1a4a5a'); ctx.globalAlpha = 0.65; R(x - 1 + w, y - 2, 2, 1, '#e8fbff'); R(x + 1 - w, y - 2, 2, 1, '#e8fbff'); R(x - 1 + w, y + 1, 2, 1, '#e8fbff'); ctx.globalAlpha = 1; }
    for (const b of A.fly) { const x = Math.round(b.x - ox), y = Math.round(b.y - b.z - oy), open = Math.sin(b.ph) > 0; ctx.globalAlpha = 0.2; R(x - 1, Math.round(b.y - oy), 3, 1, '#10101a'); ctx.globalAlpha = 1;
      R(x, y - 1, 1, 3, '#2a1a1a'); if (open) { R(x - 2, y - 2, 2, 2, b.col[0]); R(x + 1, y - 2, 2, 2, b.col[0]); R(x - 2, y, 1, 1, b.col[1]); R(x + 2, y, 1, 1, b.col[1]); } else { R(x - 1, y - 2, 1, 2, b.col[0]); R(x + 1, y - 2, 1, 2, b.col[0]); } }
    for (const f of A.ff) { const x = Math.round(f.x - ox), y = Math.round(f.y - f.z - oy), on = 0.5 + 0.5 * Math.sin(f.ph * 4); ctx.globalAlpha = 0.14 * on; R(x - 2, y - 2, 5, 5, '#e8ff9a'); ctx.globalAlpha = 0.35 * on; R(x - 1, y - 1, 3, 3, '#e8ff9a'); ctx.globalAlpha = 0.6 + 0.4 * on; R(x, y, 1, 1, '#fffbd0'); ctx.globalAlpha = 1; }
    for (const b of A.bird) { const x = Math.round(b.x - ox), y = Math.round(b.y - oy), up = Math.sin(b.ph) > 0, col = b.hawk ? '#5a4030' : '#2b2440', s = b.vx > 0 ? 1 : -1;
      ctx.globalAlpha = 0.18; R(x - 2, y + b.z, 5, 1, '#10101a'); ctx.globalAlpha = 1; R(x, y, 2, 1, col); R(x + s * 2, y - 1, 1, 1, col);
      if (b.hawk) { R(x - 4, y + (up ? -2 : 1), 4, 1, col); R(x + 2, y + (up ? -2 : 1), 4, 1, col); } else { R(x - 2, y + (up ? -1 : 1), 2, 1, col); R(x + 2, y + (up ? -1 : 1), 2, 1, col); } }
    for (const l of A.leaf) { const x = Math.round(l.x - ox), y = Math.round(l.y - oy), flip = Math.sin(l.ph) > 0;
      if (l.kind === 'mountain') { ctx.globalAlpha = 0.7; R(x, y, 1, 1, '#f4f0ff'); ctx.globalAlpha = 1; } else if (l.kind === 'village') { R(x, y, 2, 1, '#ffc8dc'); if (flip) R(x, y + 1, 1, 1, '#ff9ab8'); } else { R(x, y, flip ? 2 : 1, 1, flip ? '#c8a040' : '#8ab048'); R(x + (flip ? 1 : 0), y + 1, 1, 1, '#6a8a30'); } }
    void night; };
  return A;
}
