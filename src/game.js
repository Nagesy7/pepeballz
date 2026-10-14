// PepeBallz: Cates Fury. Vanilla JS canvas action RPG. Original IP.
import * as C from './core.js';
import * as K from './kibble.js';
import { Audio8 } from './audio.js';
import { buildArt } from './art.js';
import { buildWorld, huntSpots, TILE } from './world.js';
import { shibaSprite } from './inu/sprite.js';

const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const A = buildArt(), W = buildWorld();
const DIRS = ['down', 'up', 'left', 'right'], DV = [[0, 1], [0, -1], [-1, 0], [1, 0]];
const HERO_EQ = { hoodie: { top: 'hoodie_maroon', bottom: 'jeans_ripped', feet: 'sneakers_red' } };
let VW = 400, VH = 240, SCALE = 2, DPR = 1;

// ---------------- input ----------------
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  KeyJ: 'atk', KeyZ: 'atk', KeyK: 'blast', KeyX: 'blast', KeyL: 'charge', KeyC: 'charge', Space: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash',
  KeyQ: 'ascend', KeyV: 'ascend', Enter: 'menu', Escape: 'back', KeyM: 'mute' };
const held = {}, pressed = {}; const stick = { x: 0, y: 0 };
const press = (a) => { if (!held[a]) pressed[a] = true; held[a] = true; Audio8.unlock(); };
const release = (a) => { held[a] = false; };
addEventListener('keydown', (e) => { const a = KEYMAP[e.code]; if (a) { e.preventDefault(); press(a); } });
addEventListener('keyup', (e) => { const a = KEYMAP[e.code]; if (a) release(a); });
addEventListener('blur', () => { for (const k in held) held[k] = false; });
const ok = () => pressed.atk || pressed.menu || pressed.dash, back = () => pressed.blast || pressed.back;
function moveVec() {
  let x = (held.right ? 1 : 0) - (held.left ? 1 : 0) + stick.x, y = (held.down ? 1 : 0) - (held.up ? 1 : 0) + stick.y;
  const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; } return [x, y];
}
// menu navigation repeat from stick or keys
let navCD = 0; function nav(dt) {
  navCD -= dt; const [, y] = moveVec(); let d = 0;
  if (pressed.up) d = -1; else if (pressed.down) d = 1; else if (Math.abs(y) > 0.6 && navCD <= 0) d = Math.sign(y);
  if (d) navCD = 0.22; if (Math.abs(y) < 0.3 && !held.up && !held.down) navCD = 0; return d;
}
function navX() { const [x] = moveVec(); if (pressed.left) return -1; if (pressed.right) return 1; if (Math.abs(x) > 0.7 && navCD <= 0) { navCD = 0.25; return Math.sign(x); } return 0; }
// touch: thumb stick + buttons (DOM overlay)
const touchUI = document.getElementById('touch');
function setupTouch() {
  const base = document.getElementById('stick'), knob = document.getElementById('knob'); let sid = null, cx = 0, cy = 0;
  const upd = (e) => { const r = base.getBoundingClientRect(), R = r.width / 2; let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R); const m = Math.hypot(dx, dy); if (m > R) { dx *= R / m; dy *= R / m; }
    knob.style.transform = `translate(${dx}px,${dy}px)`; const nx = dx / R, ny = dy / R, mm = Math.hypot(nx, ny); stick.x = mm < 0.2 ? 0 : nx; stick.y = mm < 0.2 ? 0 : ny; };
  base.addEventListener('pointerdown', (e) => { sid = e.pointerId; base.setPointerCapture(sid); upd(e); Audio8.unlock(); e.preventDefault(); });
  base.addEventListener('pointermove', (e) => { if (e.pointerId === sid) upd(e); });
  const end = (e) => { if (e.pointerId !== sid) return; sid = null; stick.x = stick.y = 0; knob.style.transform = ''; };
  base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end);
  for (const b of document.querySelectorAll('[data-act]')) { const a = b.dataset.act;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on'); press(a); });
    const up = () => { b.classList.remove('on'); release(a); }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up); }
  addEventListener('touchstart', () => document.body.classList.add('touch'), { passive: true, once: true });
  if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
  for (const ev of ['touchmove', 'gesturestart', 'dblclick', 'contextmenu']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
}
setupTouch();

// ---------------- sizing: crisp integer scale ----------------
function resize() {
  DPR = window.devicePixelRatio || 1; const r = cv.getBoundingClientRect(); const w = Math.round(r.width * DPR), h = Math.round(r.height * DPR);
  cv.width = w; cv.height = h; SCALE = Math.max(1, Math.floor(Math.min(w, h) / 230)); VW = Math.ceil(w / SCALE); VH = Math.ceil(h / SCALE);
  ctx.imageSmoothingEnabled = false;
}
addEventListener('resize', resize); new ResizeObserver(resize).observe(cv);

// ---------------- game state ----------------
const G = { state: 'title', t: 0, p: null, net: {}, area: null, enemies: [], shots: [], parts: [], floats: [], cam: { x: 0, y: 0 }, shake: 0,
  dialog: null, menu: null, boss: null, fade: 0, fadeTo: null, banner: null, mode: 'story', run: null, hunt: null, wallet: null, holdU: 0, toast: null };
window.__pb = G; G.C = C; G.K = K;
const pl = { x: 0, y: 0, dir: 0, walk: 0, moving: false, atk: 0, combo: 0, comboT: 0, hitDone: false, dash: 0, dashCD: 0, inv: 0, charge: false, chargeT: 0, ascend: false, kx: 0, ky: 0, blastCD: 0, flash: 0 };
G.pl = pl;
const STORE = (() => { try { localStorage.setItem('_t', 1); return localStorage; } catch { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = String(v); } }; } })();
const NET_KEY = 'pepeballz.net.v1';
function loadNet() { try { G.root = JSON.parse(STORE.getItem(NET_KEY)) || {}; } catch { G.root = {}; } G.net = K.ensureNet(G.root); G.net.wallet ||= {}; }
const saveNet = () => STORE.setItem(NET_KEY, JSON.stringify(G.root));
loadNet(); K.setWallet(new K.SimWallet(G.net.wallet));
function saveGame(quiet) { if (G.mode !== 'story') return; G.p.area = G.area.id; G.p.x = pl.x; G.p.y = pl.y; C.save(STORE, G.p); saveNet(); if (!quiet) toast('Game saved'); }
const toast = (msg, t = 2) => { G.toast = { msg, t }; };
const P = () => G.p, D = () => C.derived(G.p);
const solidAt = (x, y) => A.SOLID.has(G.area.get(Math.floor(x / TILE), Math.floor(y / TILE)));
function collide(x, y, hw = 5, hh = 3) { return solidAt(x - hw, y - hh) || solidAt(x + hw, y - hh) || solidAt(x - hw, y + hh) || solidAt(x + hw, y + hh) || npcBlock(x, y); }
function npcBlock(x, y) { for (const n of G.area.npcs) if (Math.abs(n.x * TILE - x) < 9 && Math.abs(n.y * TILE - y) < 6) return true; return false; }
function moveBody(o, dx, dy, hw, hh) { if (!collide(o.x + dx, o.y, hw, hh)) o.x += dx; if (!collide(o.x, o.y + dy, hw, hh)) o.y += dy; }

// ---------------- enemies ----------------
const ETYPES = {
  kitten: { hp: 22, dmg: 8, xp: 7, bones: 3, speed: 42, r: 7, art: 'kitten' },
  boar: { hp: 44, dmg: 13, xp: 13, bones: 6, speed: 30, r: 9, art: 'boar' },
  golem: { hp: 70, dmg: 15, xp: 22, bones: 9, speed: 22, r: 9, art: 'golem' },
};
function spawnEnemy(type, x, y) { const T = ETYPES[type]; const lvl = G.mode === 'story' ? 1 + Math.floor((P().level - 1) / 3) * 0.25 : 1;
  const e = { type, x, y, hp: Math.round(T.hp * lvl), max: Math.round(T.hp * lvl), T, vx: 0, vy: 0, kb: 0, flash: 0, cd: 1 + Math.random(), st: 'wander', t: 0, wx: 0, wy: 0, home: [x, y] };
  G.enemies.push(e); return e; }
function enterArea(id, tx, ty) {
  G.area = W[id]; pl.x = tx * TILE; pl.y = ty * TILE; G.enemies = []; G.shots = []; G.parts = []; G.boss = null;
  if (G.mode === 'story') for (const [t, x, y] of G.area.spawns) spawnEnemy(t, x * TILE, y * TILE);
  Audio8.music(G.area.music); G.banner = { text: G.area.name, t: 2.2 };
  if (G.mode === 'story') { P().area = id; saveGame(true); }
}
function newGame() { G.mode = 'story'; G.p = C.init(C.newPlayer()); Object.assign(pl, { ascend: false, inv: 0, dir: 0 }); enterArea('village', 20.5, 18); G.state = 'play';
  say([['Elder Hachi', 'Shiba! Wake up, pup. Something pink and hungry crawled down from Fang Peak last night.'], ['Elder Hachi', 'Come see me by the Wish altar, north of the square.']]); }
function continueGame() { const p = C.load(STORE); if (!p) return newGame(); G.mode = 'story'; G.p = p; enterArea(p.area, p.x / TILE, p.y / TILE); G.state = 'play'; toast('Welcome back, Shiba'); }

// ---------------- dialog (typewriter) ----------------
function say(lines, done) { G.dialog = { lines, i: 0, ch: 0, done }; }
function updateDialog(dt) {
  const d = G.dialog, line = d.lines[d.i][1], prev = Math.floor(d.ch); d.ch = Math.min(line.length, d.ch + dt * 45);
  if (Math.floor(d.ch) > prev && Math.floor(d.ch) % 2 === 0) Audio8.sfx('blip');
  if (ok() || pressed.blast) { if (d.ch < line.length) d.ch = line.length; else if (++d.i >= d.lines.length) { G.dialog = null; d.done?.(); } else d.ch = 0; }
}

// ---------------- menus ----------------
function openMenu(m) { m.sel = m.sel || 0; m.parent = G.menu; G.menu = m; Audio8.sfx('select'); }
function closeMenu() { G.menu = G.menu?.parent || null; }
function updateMenu(dt) {
  const m = G.menu, items = typeof m.items === 'function' ? m.items() : m.items; m._items = items;
  const d = nav(dt); if (d) { m.sel = (m.sel + d + items.length) % items.length; Audio8.sfx('blip'); }
  const it = items[m.sel]; const dx = navX(); if (dx && it?.lr) { it.lr(dx); Audio8.sfx('blip'); }
  if (pressed.atk || pressed.menu) { if (it && !it.disabled && it.act) { Audio8.sfx('select'); it.act(); } else Audio8.sfx('hurt'); }
  else if (back()) { if (m.noBack) return; Audio8.sfx('blip'); m.onBack ? m.onBack() : closeMenu(); }
}
function pauseMenu() {
  openMenu({ title: 'Menu', items: () => [
    { label: 'Items', act: itemsMenu }, { label: `Stats${P().points ? ` (+${P().points})` : ''}`, act: statsMenu },
    { label: 'Wish Network (SIM)', act: networkMenu }, { label: G.mode === 'story' ? 'Save game' : 'Abandon run', act: () => { if (G.mode === 'story') { saveGame(); closeMenu(); } else { G.menu = null; endRun(false); } } },
    { label: 'Sound: toggle', act: () => toast(Audio8.toggleMute() ? 'Muted' : 'Sound on') }, { label: 'Close', act: closeMenu } ] });
}
function itemsMenu() {
  openMenu({ title: 'Items', info: () => [`HP ${Math.ceil(P().hp)}/${D().maxHp}   Energy ${Math.floor(P().energy)}/${D().maxEnergy}`, `Bones ${P().bones}   Wish Orbs ${P().orbs.length}/7`],
    items: () => { const ks = Object.keys(P().inventory); return ks.length ? ks.map((k) => ({ label: `${C.ITEMS[k].name} x${P().inventory[k]}`, sub: C.ITEMS[k].desc,
      act: () => { if (C.useItem(P(), k)) { Audio8.sfx('pickup'); burst(pl.x, pl.y - 12, '#7dff8a', 12); toast(`Used ${C.ITEMS[k].name}`); } else toast(C.ITEMS[k].passive ? 'Always active' : 'Already full'); } })) : [{ label: '(empty)' }]; } });
}
function statsMenu() {
  const names = { str: 'STR  attack power', def: 'DEF  toughness', vit: 'VIT  max HP', enr: 'ENR  max energy' };
  openMenu({ title: 'Stats', info: () => [`Level ${P().level}  XP ${P().xp}/${C.xpToNext(P().level)}`, `Points to spend: ${P().points}`, `HP ${D().maxHp}  Energy ${D().maxEnergy}  STR ${D().str}  DEF ${D().def}`],
    items: () => Object.keys(names).map((k) => ({ label: `${names[k]}: ${P().stats[k]}`, disabled: !P().points, act: () => { if (C.spendPoint(P(), k)) Audio8.sfx('level'); } })) });
}
function shopMenu() {
  openMenu({ title: "Bram's Biscuits (bones)", info: () => [`Bones: ${P().bones}`, 'Bones are free: earned by playing, never cashed out.'],
    items: () => ['bone', 'jerky', 'tea'].map((k) => ({ label: `${C.ITEMS[k].name}  ${C.ITEMS[k].price} bones`, sub: C.ITEMS[k].desc, disabled: P().bones < C.ITEMS[k].price, act: () => { if (C.buyItem(P(), k)) { Audio8.sfx('pickup'); toast('Bought ' + C.ITEMS[k].name); } } })) });
}

// ---------------- NPC talk ----------------
const TALK = {
  elder: () => { const f = P().flags;
    if (!f.metElder) return say([['Elder Hachi', 'Long ago, Pepe the Wish Frog scattered seven Wish Orbs across our hills.'], ['Elder Hachi', 'Now a cat-blob called Cate is gobbling everything on Fang Peak, getting bigger with every bite.'], ['Elder Hachi', 'Take this orb. Find the rest in Whisker Woods and on Fang Peak, then bring all seven to this altar.']], () => { f.metElder = true; giveOrb(1); });
    if (P().orbs.length >= 7) return say([['Elder Hachi', 'Seven orbs! Stand at the altar and call for Pepe.']]);
    say([['Elder Hachi', `You hold ${P().orbs.length} of 7 Wish Orbs. East to the woods, north to the peak.`]]); },
  akita: () => say([['Akita Ren', 'Feel that heat in your fur? That is Ascend. Press Q or the gold button to go golden.'], ['Akita Ren', 'You hit harder and take less, but it burns energy fast. Hold C to charge back up.']]),
  kai: () => say([['Kai', 'Tap J three times for a full combo. The third hit sends foes flying.'], ['Kai', 'K fires a Howl Blast. Fire it right after charging for a big one. Space dashes through attacks.']]),
  merchant: () => say([['Biscuit Bram', 'Fresh biscuits! Bones only. Pink blobs drop them when you bonk them.']], shopMenu),
  pup: () => say([['Pip', 'When I grow up I want to Ascend too! My tail already glows a little. Probably.']]),
  rin: () => { const f = P().flags; const lines = [['Rin', 'I built a Wish Network terminal! Weekly orb hunts, a Cate boss rush, leaderboards...'], ['Rin', 'It runs on simulated KIBBLE for now. Prizes go by rank, never by luck, and entry is free.']];
    if (!f.rinGift) { lines.push(['Rin', 'Here, take some Spark Tea for the road.']); return say(lines, () => { f.rinGift = true; C.addItem(P(), 'tea', 2); Audio8.sfx('pickup'); toast('Got Spark Tea x2'); networkMenu(); }); }
    say(lines, networkMenu); },
  tomo: () => say([['Old Tomo', 'My grandpa swore he saw Pepe once. Bigger than a house. Smug as anything.'], ['Old Tomo', 'Said the frog grants one wish, then naps for a year.']]),
  shiro: () => say([['Scout Shiro', 'Careful. Those pink kittens wander back to Cate and she absorbs them to heal.'], ['Scout Shiro', 'Thin them out before you face her. The peak is north.']]),
  aki: () => say([['Ranger Aki', P().flags.cateDown ? 'You beat her! Though... that blob left a trail heading somewhere bigger.' : 'Cate is up at the summit. Watch for her pounce: she crouches first. Dash through it!']]),
};
function tryInteract() {
  const [fx, fy] = DV[pl.dir], tx = pl.x + fx * 12, ty = pl.y - 4 + fy * 12;
  for (const n of G.area.npcs) if (Math.hypot(n.x * TILE - tx, n.y * TILE - ty) < 16) { n.face = DIRS[pl.dir ^ (pl.dir < 2 ? 1 : 1)]; n.face = ['up', 'down', 'right', 'left'][pl.dir]; TALK[n.id]?.(); return true; }
  if (G.area.id === 'village' && Math.abs(pl.x - 20 * TILE) < 26 && pl.y < 7.5 * TILE) { altar(); return true; }
  return false;
}
function altar() {
  const have = G.mode === 'hunt' ? G.hunt.got.length : P().orbs.length;
  if (have >= 7) return startWish();
  say([['Wish altar', `Seven frog-shaped hollows. ${have} of 7 Wish Orbs ${G.mode === 'hunt' ? '(weekly hunt orbs)' : ''} glow in your pack.`]]);
}
function giveOrb(n) { if (C.addOrb(P(), 'orb' + n)) { Audio8.sfx('orb'); G.banner = { text: `Wish Orb ${n} found! (${P().orbs.length}/7)`, t: 2.5 }; burst(pl.x, pl.y - 16, A.orbs ? '#9effa0' : '#fff', 24); } }

// ---------------- combat ----------------
function burst(x, y, col, n = 10, sp = 60) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = sp * (0.3 + Math.random()); G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + Math.random() * 0.4, col, s: 1 + (Math.random() * 2 | 0) }); } }
const float = (x, y, text, col = '#fff') => G.floats.push({ x, y, text: String(text), col, t: 0.9 });
function auraColor() { const c = K.COSMETICS[P().cosmetics.aura]; return c?.color || '#ffe066'; }
function beamColor() { const c = K.COSMETICS[P().cosmetics.beam]; return c?.color === 'rainbow' ? `hsl(${(G.t * 400) % 360},100%,65%)` : c?.color || '#7ff0ff'; }
function hurtPlayer(raw, fromX, fromY) {
  if (pl.inv > 0 || pl.dash > 0 || G.state !== 'play') return;
  const dmg = C.damageTaken(P(), raw, { ascended: pl.ascend }); P().hp -= dmg; pl.inv = 0.9; pl.flash = 0.2; G.shake = 0.2; Audio8.sfx('hurt');
  const a = Math.atan2(pl.y - fromY, pl.x - fromX); pl.kx = Math.cos(a) * 160; pl.ky = Math.sin(a) * 160; float(pl.x, pl.y - 30, dmg, '#ff6b6b');
  if (P().hp <= 0) die();
}
function die() {
  P().hp = 0; Audio8.sfx('die'); pl.ascend = false;
  if (G.mode !== 'story') { G.run.deaths++; toast('Fainted! +1 death. Back on your paws...'); C.init(P()); pl.inv = 2; if (G.mode === 'rush') { pl.x = 20 * TILE; pl.y = 14 * TILE; } else enterArea('village', 20.5, 9); return; }
  P().deaths++; G.state = 'gameover';
  openMenu({ title: 'You fainted...', noBack: true, items: [{ label: 'Continue from last save', act: () => { G.menu = null; continueGame(); } }, { label: 'Title screen', act: () => { G.menu = null; toTitle(); } }] });
}
function hitEnemy(e, dmg, ang, kb, isBoss) {
  e.hp = Math.max(0, e.hp - dmg); e.flash = 0.12; float(e.x, e.y - (isBoss ? 40 : 20), dmg, pl.ascend ? '#ffe066' : '#fff'); burst(e.x, e.y - 8, '#fff6c0', 6);
  if (!isBoss) { e.vx = Math.cos(ang) * kb; e.vy = Math.sin(ang) * kb; e.kb = 0.18; e.st = 'chase'; }
  G.shake = Math.max(G.shake, kb > 150 ? 0.15 : 0.06);
  if (e.hp <= 0) isBoss ? bossDown() : killEnemy(e);
}
function killEnemy(e) {
  burst(e.x, e.y - 6, e.type === 'kitten' ? '#ff8fc8' : e.type === 'boar' ? '#b07a52' : '#bdb8b0', 18); Audio8.sfx('hit3'); e.dead = true;
  if (G.mode !== 'story') return;
  const ups = C.gainXp(P(), e.T.xp); P().bones += e.T.bones; float(e.x, e.y - 24, `+${e.T.xp}xp  +${e.T.bones} bones`, '#9effa0');
  if (Math.random() < 0.12) G.drops.push({ x: e.x, y: e.y, id: 'bone', t: 12 });
  if (ups) { Audio8.sfx('level'); G.banner = { text: `Level up! Lv ${P().level}  (+${ups * 3} stat points)`, t: 3 }; burst(pl.x, pl.y - 16, '#ffe066', 30, 90); }
}
G.drops = [];
function attackHitbox() { const [fx, fy] = DV[pl.dir]; return { x: pl.x + fx * 14, y: pl.y - 8 + fy * 12, r: pl.combo === 2 ? 15 : 12 }; }
function updatePlayer(dt) {
  const p = P(), d = D(), [mx, my] = moveVec();
  pl.inv = Math.max(0, pl.inv - dt); pl.flash = Math.max(0, pl.flash - dt); pl.dashCD -= dt; pl.blastCD -= dt; pl.comboT -= dt; pl.chargeT -= dt;
  // Ascend toggle + drain
  if (pressed.ascend) { if (pl.ascend) { pl.ascend = false; toast('Ascend released'); } else if (p.energy >= 30) { pl.ascend = true; p.energy -= 10; Audio8.sfx('ascend'); burst(pl.x, pl.y - 16, auraColor(), 40, 120); G.shake = 0.25; G.banner = { text: 'ASCEND!', t: 1.2 }; } else toast('Need 30 energy to Ascend'); }
  if (pl.ascend) { p.energy -= 7 * dt; if (Math.random() < 0.6) G.parts.push({ x: pl.x + (Math.random() - 0.5) * 18, y: pl.y - Math.random() * 6, vx: 0, vy: -40 - Math.random() * 40, life: 0.5, col: auraColor(), s: 2 }); if (p.energy <= 0) { p.energy = 0; pl.ascend = false; toast('Out of energy'); } }
  // charge
  pl.charge = held.charge && pl.atk <= 0 && pl.dash <= 0;
  if (pl.charge) { p.energy = Math.min(d.maxEnergy, p.energy + 32 * dt); pl.chargeT = 0.6; if (Math.random() < 0.7) { const a = Math.random() * 6.28; G.parts.push({ x: pl.x + Math.cos(a) * 22, y: pl.y - 12 + Math.sin(a) * 18, vx: -Math.cos(a) * 60, vy: -Math.sin(a) * 50, life: 0.35, col: auraColor(), s: 1 }); } if (Math.random() < dt * 8) Audio8.sfx('charge'); }
  // dash
  if (pressed.dash && pl.dashCD <= 0 && !pl.charge) { pl.dash = 0.18; pl.dashCD = 0.45; Audio8.sfx('dash'); if (mx || my) pl.dir = Math.abs(mx) > Math.abs(my) ? (mx < 0 ? 2 : 3) : (my < 0 ? 1 : 0); }
  // attack / talk
  if (pressed.atk && !pl.charge) { if (pl.atk <= 0 && !tryInteract()) { pl.combo = pl.comboT > 0 ? (pl.combo + 1) % 3 : 0; pl.atk = pl.combo === 2 ? 0.3 : 0.2; pl.hitDone = false; pl.comboT = pl.atk + 0.35; Audio8.sfx('swing'); } }
  if (pressed.blast && !pl.charge && pl.blastCD <= 0) { const cost = 14; if (p.energy >= cost) { p.energy -= cost; const charged = pl.chargeT > 0; pl.blastCD = 0.35; const [fx, fy] = DV[pl.dir];
      G.shots.push({ x: pl.x + fx * 10, y: pl.y - 12 + fy * 6, vx: fx * 240, vy: fy * 240, r: charged ? 7 : 4, dmg: C.attackDamage(p, 'blast', { charged, ascended: pl.ascend }), mine: true, t: 1.2, col: beamColor(), big: charged });
      Audio8.sfx('blast'); pl.chargeT = 0; } else toast('Not enough energy (hold C to charge)'); }
  // movement
  let spd = 78 * (pl.ascend ? 1.25 : 1);
  if (pl.dash > 0) { pl.dash -= dt; const [fx, fy] = DV[pl.dir]; moveBody(pl, fx * 270 * dt, fy * 270 * dt, 5, 3); if (Math.random() < 0.8) G.parts.push({ x: pl.x, y: pl.y - 10, vx: 0, vy: 0, life: 0.2, col: '#ffffff', s: 2 }); }
  else if (pl.charge) pl.moving = false;
  else { const sl = pl.atk > 0 ? 0.25 : 1; pl.moving = !!(mx || my) && pl.atk <= 0;
    if (mx || my) { if (pl.atk <= 0) pl.dir = Math.abs(mx) > Math.abs(my) ? (mx < 0 ? 2 : 3) : (my < 0 ? 1 : 0); moveBody(pl, mx * spd * sl * dt, my * spd * sl * dt, 5, 3); }
    pl.walk += pl.moving ? dt * Math.hypot(mx, my) : 0; }
  if (pl.kx || pl.ky) { moveBody(pl, pl.kx * dt, pl.ky * dt, 5, 3); pl.kx *= 0.82; pl.ky *= 0.82; if (Math.abs(pl.kx) + Math.abs(pl.ky) < 5) pl.kx = pl.ky = 0; }
  if (G.boss && G.boss.lock) pl.y = Math.min(pl.y, 15.3 * TILE);
  // melee hit window
  if (pl.atk > 0) { pl.atk -= dt; const el = (pl.combo === 2 ? 0.3 : 0.2) - pl.atk;
    if (!pl.hitDone && el > 0.05) { pl.hitDone = true; const hb = attackHitbox(), dmg = C.attackDamage(p, pl.combo, { ascended: pl.ascend }), kb = pl.combo === 2 ? 220 : 70; let any = false;
      for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - hb.x, e.y - 6 - hb.y) < hb.r + e.T.r) { hitEnemy(e, dmg, Math.atan2(e.y - pl.y, e.x - pl.x), kb); any = true; }
      const b = G.boss; if (b && b.st !== 'intro' && b.hp > 0 && Math.hypot(b.x - hb.x, b.y - 14 - hb.y) < hb.r + 20) { hitEnemy(b, dmg, 0, kb, true); any = true; }
      if (any) Audio8.sfx(pl.combo === 2 ? 'hit3' : 'hit'); } }
  // exits
  for (const ex of G.area.exits) { const tx = pl.x / TILE, ty = pl.y / TILE; if (tx >= ex.x && tx <= ex.x + ex.w && ty >= ex.y && ty <= ex.y + ex.h && !G.fadeTo) { if (G.mode === 'rush') continue; G.fadeTo = ex; } }
}
function updateEnemies(dt) {
  for (const e of G.enemies) { if (e.dead) continue; e.flash -= dt; e.t += dt; e.cd -= dt;
    const dx = pl.x - e.x, dy = pl.y - e.y, dist = Math.hypot(dx, dy), T = e.T;
    if (e.kb > 0) { e.kb -= dt; moveBody(e, e.vx * dt, e.vy * dt, 5, 3); continue; }
    if (e.type === 'boar' && e.st === 'charge') { moveBody(e, e.vx * dt, e.vy * dt, 6, 3); if ((e.t -= 0) && e.cd < 0) { e.st = 'chase'; e.cd = 2; } }
    else if (e.type === 'boar' && e.st === 'wind') { if (e.cd < 0) { e.st = 'charge'; const a = Math.atan2(dy, dx); e.vx = Math.cos(a) * 175; e.vy = Math.sin(a) * 175; e.cd = 0.6; } }
    else if (dist < 130 || e.st === 'chase') { e.st = dist > 220 ? 'wander' : 'chase';
      const sp = T.speed * (e.type === 'kitten' ? (Math.sin(e.t * 9) > 0 ? 1.5 : 0.4) : 1); moveBody(e, dx / dist * sp * dt, dy / dist * sp * dt, 5, 3);
      if (e.type === 'boar' && dist < 90 && e.cd < 0) { e.st = 'wind'; e.cd = 0.55; }
      if (e.type === 'golem' && dist < 150 && e.cd < 0) { e.cd = 2.4; const a = Math.atan2(dy, dx); G.shots.push({ x: e.x, y: e.y - 14, vx: Math.cos(a) * 105, vy: Math.sin(a) * 105, r: 4, dmg: 12, t: 2.5, col: '#8f8a84', rock: true }); } }
    else { if (e.cd < 0) { e.cd = 1.5 + Math.random() * 2; const a = Math.random() * 6.28; e.wx = Math.cos(a) * 18; e.wy = Math.sin(a) * 18; } moveBody(e, e.wx * dt, e.wy * dt, 5, 3); }
    if (dist < T.r + 6 && Math.abs(dy) < 12) hurtPlayer(T.dmg * (e.st === 'charge' ? 1.3 : 1), e.x, e.y);
  }
  G.enemies = G.enemies.filter((e) => !e.dead);
}
function updateShots(dt) {
  for (const s of G.shots) { s.x += s.vx * dt; s.y += s.vy * dt; s.t -= dt; if (s.mine && Math.random() < 0.7) G.parts.push({ x: s.x, y: s.y, vx: 0, vy: 0, life: 0.18, col: s.col, s: s.big ? 3 : 2 });
    if (solidAt(s.x, s.y + 8) && !G.area.get(Math.floor(s.x / TILE), Math.floor((s.y + 8) / TILE)).match(/[~]/)) s.t = 0;
    if (s.mine) { for (const e of G.enemies) if (!e.dead && s.t > 0 && Math.hypot(e.x - s.x, e.y - 8 - s.y) < e.T.r + s.r) { hitEnemy(e, s.dmg, Math.atan2(s.vy, s.vx), 120); s.t = 0; Audio8.sfx('hit'); }
      const b = G.boss; if (b && b.hp > 0 && b.st !== 'intro' && s.t > 0 && Math.hypot(b.x - s.x, b.y - 16 - s.y) < 22 + s.r) { hitEnemy(b, s.dmg, 0, 0, true); s.t = 0; Audio8.sfx('hit'); } }
    else if (Math.hypot(pl.x - s.x, pl.y - 10 - s.y) < s.r + 7) { hurtPlayer(s.dmg, s.x, s.y); s.t = 0; }
    if (s.t <= 0) burst(s.x, s.y, s.col, 5); }
  G.shots = G.shots.filter((s) => s.t > 0);
}

// ---------------- Cate, form 1 ----------------
function startBoss(intro = true) {
  const a = W.mountain.boss; G.boss = { x: a.x * TILE, y: a.y * TILE, hp: 700, max: 700, st: 'intro', t: 0, cd: 1, vx: 0, vy: 0, flash: 0, lock: true, seq: 0 };
  if (G.mode === 'rush') { G.boss.hp = G.boss.max = 900; }
  Audio8.music('boss'); Audio8.sfx('meow'); G.shake = 0.4;
  const go = () => { G.boss.st = 'hop'; G.boss.t = 0; G.banner = { text: 'CATE  -  FORM 1', t: 2 }; };
  if (intro) say([['Cate', 'Mrrrowww~! A little doggy came all the way up here? How snackable!'], ['Cate', 'Everything I absorb makes me BIGGER. Let\'s see how you taste!']], go); else go();
}
function bossShootRing(n, sp) { const b = G.boss, off = Math.random(); for (let i = 0; i < n; i++) { const a = (i + off) / n * 6.283; G.shots.push({ x: b.x, y: b.y - 16, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 4, dmg: 12, t: 3, col: '#ff7bd5' }); } Audio8.sfx('blast'); }
function updateBoss(dt) {
  const b = G.boss; if (!b || b.hp <= 0) return; b.t += dt; b.flash -= dt; if (b.st === 'intro') return;
  const rage = b.hp < b.max / 2, dx = pl.x - b.x, dy = pl.y - b.y, dist = Math.hypot(dx, dy) || 1, k = rage ? 1.35 : 1;
  const next = () => { const order = ['hop', 'spit', 'pounce', 'hop', 'summon', 'pounce', 'spit']; b.seq = (b.seq + 1) % order.length; b.st = order[b.seq]; b.t = 0; };
  if (b.st === 'hop') { const sp = 38 * k * (Math.sin(b.t * 7) > 0 ? 1.6 : 0.3); moveBody(b, dx / dist * sp * dt, dy / dist * sp * dt, 14, 6); if (b.t > 2.2) next(); }
  else if (b.st === 'spit') { if (b.t > 0.5 && !b.s1) { b.s1 = 1; bossShootRing(rage ? 16 : 12, 85); } if (rage && b.t > 1.1 && !b.s2) { b.s2 = 1; bossShootRing(16, 70); } if (b.t > 1.6) { b.s1 = b.s2 = 0; next(); } }
  else if (b.st === 'pounce') { if (b.t < 0.7) { b.tx = pl.x; b.ty = pl.y; } else if (b.t < 1.25) { if (!b.pv) { const a = Math.atan2(b.ty - b.y, b.tx - b.x); b.vx = Math.cos(a) * 240 * k; b.vy = Math.sin(a) * 240 * k; b.pv = 1; Audio8.sfx('meow'); } moveBody(b, b.vx * dt, b.vy * dt, 14, 6); } else { b.pv = 0; G.shake = 0.2; burst(b.x, b.y, '#ffffff', 14); next(); } }
  else if (b.st === 'summon') { if (b.t > 0.6 && !b.s1) { b.s1 = 1; for (let i = 0; i < (rage ? 3 : 2); i++) { const e = spawnEnemy('kitten', b.x + (i - 1) * 30, b.y + 20); e.st = 'chase'; burst(e.x, e.y, '#ff8fc8', 10); } Audio8.sfx('meow'); } if (b.t > 1.4) { b.s1 = 0; next(); } }
  // absorb nearby kittens to heal
  for (const e of G.enemies) if (!e.dead && e.type === 'kitten' && Math.hypot(e.x - b.x, e.y - b.y) < 24 && b.st !== 'summon') { e.dead = true; b.hp = Math.min(b.max, b.hp + 45); float(b.x, b.y - 48, 'ABSORBED! +45', '#ff7bd5'); burst(b.x, b.y - 16, '#ff8fc8', 20); Audio8.sfx('meow'); }
  if (Math.hypot(dx, dy + 8) < 24) hurtPlayer(b.st === 'pounce' ? 22 : 16, b.x, b.y);
}
function bossDown() {
  const b = G.boss; b.st = 'down'; G.enemies.forEach((e) => (e.dead = true)); G.shots = []; burst(b.x, b.y - 16, '#ff8fc8', 60, 140); G.shake = 0.6; Audio8.sfx('die');
  if (G.mode === 'rush') { b.lock = false; return finishRun(); }
  const ups = C.gainXp(P(), 150); P().bones += 60; P().flags.cateDown = true;
  say([['Cate', 'Mrrp?! You... popped my snack-sized form!'], ['Cate', 'Fine! I\'ll go absorb something BIGGER. You haven\'t seen my other forms, doggy!'], ['Shiba', 'She dropped something glowing...']],
    () => { G.boss = null; Audio8.music('mountain'); G.area.pickups.push({ key: 'orb7', kind: 'orb', n: 7, x: b.x / TILE, y: b.y / TILE }); G.banner = { text: ups ? `Cate defeated!  Lv ${P().level}` : 'Cate defeated!', t: 3 }; saveGame(true); });
}

// ---------------- pickups ----------------
function updatePickups() {
  const p = P();
  for (const it of G.area.pickups) { if (G.mode !== 'story') break; if (p.flags['got_' + it.key]) continue;
    if (Math.hypot(it.x * TILE - pl.x, it.y * TILE - pl.y) < 12) { p.flags['got_' + it.key] = true;
      if (it.kind === 'orb') giveOrb(it.n); else { C.addItem(p, it.id); Audio8.sfx('pickup'); toast(`Found ${C.ITEMS[it.id].name}`); } saveGame(true); } }
  for (const d of G.drops) { d.t -= 1 / 60; if (Math.hypot(d.x - pl.x, d.y - pl.y) < 12 && G.mode === 'story') { d.t = 0; C.addItem(p, d.id); Audio8.sfx('pickup'); toast('Bone Biscuit!'); } }
  G.drops = G.drops.filter((d) => d.t > 0);
  if (G.mode === 'hunt') for (const o of G.hunt.orbs) if (o.area === G.area.id && !G.hunt.got.includes(o.id) && Math.hypot(o.x * TILE - pl.x, o.y * TILE - pl.y) < 12) { G.hunt.got.push(o.id); Audio8.sfx('orb'); G.banner = { text: `Hunt orb ${G.hunt.got.length}/7`, t: 2 }; }
}

// ---------------- Pepe the Wish Frog ----------------
function startWish() {
  G.state = 'wish'; G.wish = { t: 0, phase: 'rise' }; Audio8.music('wish'); Audio8.sfx('croak'); G.shake = 0.5;
}
function updateWish(dt) {
  const w = G.wish; w.t += dt;
  if (w.phase === 'rise' && w.t > 2.4) { w.phase = 'talk'; Audio8.sfx('croak');
    if (G.mode === 'hunt') return say([['Pepe', 'RIBBIT. Seven hunt orbs, and quick about it too. Your time is logged on the Wish Network.']], () => { w.phase = 'leave'; w.t = 0; finishRun(); });
    say([['Pepe', 'RIBBIT. Who dares wake the great Pepe from his nap?'], ['Pepe', 'Seven Wish Orbs... very well, little Shiba. Speak one wish, and make it a good one.']], () => {
      w.phase = 'choose'; openMenu({ title: 'Make a wish', noBack: true, items: C.WISHES.map((x) => ({ label: x.name, sub: x.desc, act: () => {
        C.grantWish(P(), x.id); G.menu = null; Audio8.sfx('level'); burst(pl.x, pl.y - 16, '#9effa0', 50, 120);
        say([['Pepe', `Your wish is granted: ${x.name}! Now... nap time. The orbs scatter. Feels good man.`]], () => { w.phase = 'leave'; w.t = 0; P().flags.wished = true; for (let i = 1; i <= 7; i++) delete P().flags['got_orb' + i]; P().flags.got_orb1 = true; saveGame(true); });
      } })) }); }); }
  if (w.phase === 'leave' && w.t > 1.6) { G.state = G.state === 'wish' ? 'play' : G.state; G.wish = null; if (G.mode === 'story') { Audio8.music(G.area.music); G.banner = { text: P().flags.cateDown ? 'CHAPTER 1 CLEAR!' : 'The orbs scatter across the land...', t: 3 }; } }
}

// ---------------- network modes (simulated) ----------------
const STD_BUILD = () => { const p = C.newPlayer(); p.level = 6; p.stats = { str: 11, def: 8, vit: 9, enr: 9 }; p.inventory = { bone: 3, tea: 2 }; return C.init(p); }; // fixed build so boards are fair
let storySave = null;
function startRun(mode) {
  storySave = G.p ? JSON.parse(JSON.stringify(G.p)) : null; if (G.mode === 'story' && G.p) saveGame(true);
  const p = STD_BUILD(); p.cosmetics = { ...(storySave?.cosmetics || G.net.cos || p.cosmetics) }; G.p = p; G.mode = mode; G.menu = null; G.state = 'play';
  G.run = { mode, t0: performance.now(), deaths: 0, week: K.weekId(Date.now()), day: K.dayId(Date.now()) };
  if (mode === 'rush') { enterArea('mountain', 20, 14); startBoss(false); }
  else { G.hunt = { orbs: K.huntOrbs(G.run.week, huntSpots(W)), got: [] }; enterArea('village', 20.5, 9); G.banner = { text: `Weekly Wish Orb Hunt #${G.run.week}`, t: 3 }; }
}
G.startRun = startRun;
function finishRun() {
  const r = G.run, ms = Math.round(performance.now() - r.t0), board = r.mode, n = G.net;
  const row = { id: 'you', name: n.pack.tag ? `Shiba [${n.pack.tag}]` : 'Shiba (you)', timeMs: ms, deaths: r.deaths, at: Date.now() };
  const key = board === 'rush' ? 'rush' : 'huntRuns'; n[key] ||= []; n[key].push({ ...row, period: board === 'rush' ? r.day : r.week }); if (n[key].length > 40) n[key].shift();
  const ranked = K.rankRuns([...K.sampleRows(board, board === 'rush' ? r.day : r.week), ...bestMine(board)]); const mine = ranked.find((x) => x.id === 'you');
  K.addPackPoints(G.root, board === 'rush' ? 'rushClear' : 'huntFinish'); if (mine.rank <= 3) K.addPackPoints(G.root, board === 'rush' ? 'rushTop3' : 'huntTop3'); saveNet();
  setTimeout(() => { G.boss = null; openMenu({ title: board === 'rush' ? 'Boss Rush clear!' : 'Hunt complete!', noBack: true, info: () => [`Time ${fmtTime(ms)}   Deaths ${r.deaths}`, `Your rank: #${mine.rank} of ${ranked.length} (rivals simulated)`, n.pack.tag ? `Pack [${n.pack.tag}] points: ${n.pack.points}` : 'Join a pack to earn Kibble Cup points'],
    items: [{ label: 'View leaderboards', act: leaderboardsMenu }, { label: 'Return to story', act: () => endRun(true) }] }); }, 600);
}
function endRun() { G.menu = null; G.mode = 'story'; G.run = null; G.hunt = null; G.boss = null; if (storySave) { G.p = storySave; enterArea(G.p.area, G.p.x / TILE, G.p.y / TILE); G.state = 'play'; } else toTitle(); }
const fmtTime = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(Math.floor(ms / 10) % 100).padStart(2, '0')}`;
function bestMine(board) { const n = G.net, list = (board === 'rush' ? n.rush : n.huntRuns) || [], per = board === 'rush' ? K.dayId(Date.now()) : K.weekId(Date.now()); const mine = list.filter((x) => x.period === per); return mine.length ? [K.rankRuns(mine)[0]] : []; }
function boardRows(board) { const per = board === 'rush' ? K.dayId(Date.now()) : K.weekId(Date.now()); return K.rankRuns([...K.sampleRows(board, per), ...bestMine(board)]); }
function cupRows() { const n = G.net; const packs = [{ tag: 'FANG', points: 140 }, { tag: 'MOCHI', points: 95 }, { tag: 'KURO', points: 60 }]; if (n.pack.tag) packs.push({ tag: n.pack.tag, points: n.pack.points, mine: true }); return K.kibbleCup(packs); }
async function refreshWallet() { const w = K.getWallet(); if (!w.address) return; G.walletBal = await w.balanceU(); G.holdU = await w.holdingsU(); }
const tier = () => K.tierFor(G.holdU || 0);
const SIM = 'SIMULATED: no real KIBBLE moves';
function networkMenu() {
  refreshWallet();
  openMenu({ title: 'Wish Network', info: () => [SIM, K.getWallet().address ? `Wallet ${K.getWallet().address.slice(0, 10)}..  ${K.fmtK(G.walletBal || 0)} KIBBLE  Tier: ${tier().name}` : 'Wallet: not connected (simulated)'],
    items: () => [
      { label: K.getWallet().address ? 'Wallet: connected (SIM)' : 'Connect SIM wallet', act: async () => { await K.getWallet().connect(); await refreshWallet(); toast('SIM wallet connected'); } },
      { label: 'Weekly Wish Orb Hunt', sub: 'Free. Same 7 orbs for everyone this week. Fastest wins.', act: () => startRun('hunt') },
      { label: 'Cate Boss Rush', sub: 'Free. Fixed build. Fastest clear wins.', act: () => startRun('rush') },
      { label: 'Leaderboards & prize pools', act: leaderboardsMenu }, { label: 'Pepe Wish Shop (cosmetic)', act: wishShop }, { label: 'Cosmetics & holder tier', act: cosmeticsMenu },
      { label: 'Pack & Kibble Cup', act: packMenu }, { label: 'Co-op Cate Raid (event stub)', act: raidMenu }, { label: 'Export cosmetics to Inu Verse (stub)', act: exportMenu }, { label: 'Back', act: closeMenu } ] });
}
function leaderboardsMenu() {
  let tab = 0; const tabs = ['daily', 'weekly', 'monthly'], names = { daily: 'Daily: Cate Boss Rush', weekly: 'Weekly: Wish Orb Hunt', monthly: 'Monthly: Kibble Cup (packs)' };
  openMenu({ title: 'Leaderboards', info: () => { const pool = tabs[tab], n = G.net; const rows = pool === 'monthly' ? cupRows().map((r) => `#${r.rank} [${r.tag}] ${r.points} pts${r.mine ? ' <you' : ''}`) : boardRows(K.POOL_BOARDS[pool]).slice(0, 6).map((r) => `#${r.rank} ${r.name.padEnd(13)} ${fmtTime(r.timeMs)} d${r.deaths}${r.id === 'you' ? ' <' : ''}`);
      return [`< ${names[pool]} >   pool ${K.fmtK(n.pools[pool])} KIBBLE (sim)`, 'Paid by rank: 50% / 30% / 20%. No draws, no entry fee.', ...rows]; },
    items: () => [{ label: `Board: ${tabs[tab]} (left/right)`, lr: (d) => (tab = (tab + d + 3) % 3), act: () => (tab = (tab + 1) % 3) },
      { label: 'Settle this period (sim)', sub: 'Awards the pool to the current top 3', act: async () => { const pool = tabs[tab]; const ranked = pool === 'monthly' ? cupRows().map((r) => ({ ...r, id: r.mine ? 'you' : r.tag, name: r.tag })) : boardRows(K.POOL_BOARDS[pool]);
        const out = K.awardPool(G.root, pool, ranked, pool); const mine = out.find((o) => o.id === 'you'); if (mine) G.net.wallet.balU += mine.amountU; saveNet(); await refreshWallet();
        toast(out.length ? `Paid ${out.map((o) => `#${o.rank} ${K.fmtK(o.amountU)}`).join(', ')}` : 'Pool is empty: buy a cosmetic to seed it', 3); } }, { label: 'Back', act: closeMenu }] });
}
function wishShop() {
  openMenu({ title: 'Pepe Wish Shop', info: () => [SIM, 'Cosmetic only. Never changes stats. Fee 2%: 1% treasury,', '0.25% daily / 0.5% weekly / 0.25% monthly prize pools.', `Treasury ${K.OWNER_WALLET.slice(0, 6)}..${K.OWNER_WALLET.slice(-4)}  Balance ${K.fmtK(G.walletBal || 0)}`],
    items: () => [...K.WISH_SHOP.map((c) => { const q = K.quote(c.id), own = G.net.owned.includes(c.id); return { label: `${c.name}  ${own ? 'OWNED' : K.fmtK(q.total) + ' K'}`, sub: own ? 'Equip it in Cosmetics' : `${K.fmtK(q.price)} + fee ${K.fmtK(q.fee)} (treasury ${K.fmtK(q.owner)}, pools ${K.fmtK(q.daily)}/${K.fmtK(q.weekly)}/${K.fmtK(q.monthly)})`, disabled: own,
      act: async () => { if (!K.getWallet().address) await K.getWallet().connect(); const r = await K.buyWish(G.root, c.id); if (r.ok) { Audio8.sfx('orb'); toast(`Wish granted: ${c.name} (sim)`); saveNet(); await refreshWallet(); } else toast(r.reason); } }; }), { label: 'Back', act: closeMenu }] });
}
function cosmeticsMenu() {
  const kinds = ['aura', 'beam', 'outfit', 'title'];
  const avail = (k) => ['', ...Object.keys(K.COSMETICS).filter((id) => K.COSMETICS[id].kind === k && (G.net.owned.includes(id) || K.unlockedByTier(G.holdU || 0).includes(id)))];
  const label = (k) => { const v = P().cosmetics[k]; return v && K.COSMETICS[v] ? K.COSMETICS[v].name : k === 'aura' ? 'Gold (default)' : k === 'beam' ? 'Cyan (default)' : k === 'outfit' ? 'Hoodie (default)' : 'none'; };
  openMenu({ title: 'Cosmetics', info: () => [`Holder tier: ${tier().name} (holdings ${K.fmtK(G.holdU || 0)} sim KIBBLE)`, 'Tiers: Pup 0, Hound 1k, Alpha 10k, Shogun 100k. Cosmetic only.'],
    items: () => [...kinds.map((k) => ({ label: `${k[0].toUpperCase() + k.slice(1)}: ${label(k)}  <>`, lr: (d) => { const l = avail(k), i = l.indexOf(P().cosmetics[k] || ''); P().cosmetics[k] = l[(i + d + l.length) % l.length]; G.net.cos = { ...P().cosmetics }; saveNet(); }, act: () => {} })),
      { label: 'SIM: raise holdings (tier preview)', act: async () => { const w = K.getWallet(); w.s.holdU = w.s.holdU >= K.toU(100000) ? 0 : w.s.holdU < K.toU(1000) ? K.toU(1000) : w.s.holdU * 10; saveNet(); await refreshWallet(); toast(`Tier: ${tier().name}`); } }, { label: 'Back', act: closeMenu }] });
}
function packMenu() {
  const TAGS = ['', 'INU', 'SHIBA', 'PEPE', 'HOWL', 'KAI'];
  openMenu({ title: 'Pack & Kibble Cup', info: () => [`Pack tag: ${G.net.pack.tag || '(none)'}   Pack points: ${G.net.pack.points}`, 'Points: hunt finish 50, top 3 +30, rush clear 20, top 3 +20, raid 15.', ...cupRows().map((r) => `#${r.rank} [${r.tag}] ${r.points}${r.mine ? ' <you' : ''}`)],
    items: () => [{ label: `Tag: ${G.net.pack.tag || 'none'}  <>`, lr: (d) => { const i = TAGS.indexOf(G.net.pack.tag); G.net.pack.tag = TAGS[(i + d + TAGS.length) % TAGS.length]; saveNet(); }, act: () => {} }, { label: 'Back', act: closeMenu }] });
}
function raidMenu() {
  openMenu({ title: 'Co-op Cate Raid (stub)', info: () => ['Free event. Every participant gets the same reward.', 'Networking not built yet: allies are simulated.', G.lastRaid ? `Last raid: ${G.lastRaid.won ? 'WON' : 'lost'}  ${G.lastRaid.dealt} dmg  +${G.lastRaid.rewards[0].bones} bones each` : ''],
    items: [{ label: 'Join raid with 4 sim allies', act: () => { const r = K.resolveRaid([{ id: 'you', damage: 9000 + P().level * 900 }, ...['Mochi', 'Kuro', 'Hana', 'Yuzu'].map((n, i) => ({ id: n, damage: 9000 + i * 1500 }))]); G.lastRaid = r; if (G.mode === 'story') P().bones += r.rewards[0].bones; K.addPackPoints(G.root, 'raid'); saveNet(); Audio8.sfx('level'); toast(`Raid ${r.won ? 'won' : 'over'}: everyone +${r.rewards[0].bones} bones`); } }, { label: 'Back', act: closeMenu }] });
}
function exportMenu() {
  const data = K.exportCosmetics(G.root, P());
  openMenu({ title: 'Inu Verse carry-over (stub)', info: () => ['Cosmetics only. Unsigned stub format:', ...JSON.stringify(data).match(/.{1,46}/g).slice(0, 6)],
    items: [{ label: 'Copy JSON', act: () => { navigator.clipboard?.writeText(JSON.stringify(data)).then(() => toast('Copied'), () => toast('Clipboard unavailable')); } }, { label: 'Back', act: closeMenu }] });
}

// ---------------- title ----------------
function toTitle() { G.state = 'title'; G.mode = 'story'; G.menu = null; G.dialog = null; Audio8.music('title'); titleMenu(); }
function titleMenu() {
  G.menu = null; const has = !!C.load(STORE);
  openMenu({ title: '', titleScreen: true, noBack: true, items: () => [...(has ? [{ label: 'Continue', act: () => { G.menu = null; continueGame(); } }] : []), { label: 'New Game', act: () => { G.menu = null; newGame(); } }, { label: 'Wish Network (SIM)', act: () => { G.p = G.p || C.init(C.newPlayer()); networkMenu(); } }] });
}

// ---------------- main update ----------------
function update(dt) {
  G.t += dt; if (G.toast && (G.toast.t -= dt) <= 0) G.toast = null; if (G.banner && (G.banner.t -= dt) <= 0) G.banner = null; G.shake = Math.max(0, G.shake - dt);
  if (pressed.mute) toast(Audio8.toggleMute() ? 'Muted' : 'Sound on');
  for (const p of G.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; } G.parts = G.parts.filter((p) => p.life > 0);
  for (const f of G.floats) { f.y -= 22 * dt; f.t -= dt; } G.floats = G.floats.filter((f) => f.t > 0);
  if (G.fadeTo) { G.fade += dt * 4; if (G.fade >= 1) { const ex = G.fadeTo; G.fadeTo = null; enterArea(ex.to, ex.tx, ex.ty); } return; } else if (G.fade > 0) G.fade = Math.max(0, G.fade - dt * 4);
  if (G.menu) return updateMenu(dt);
  if (G.dialog) return updateDialog(dt);
  if (G.state === 'wish') return updateWish(dt);
  if (G.state !== 'play') return;
  if (pressed.menu || pressed.back) return pauseMenu();
  P().playTime += dt;
  updatePlayer(dt); updateEnemies(dt); updateBoss(dt); updateShots(dt); updatePickups();
  if (G.mode === 'story' && G.area.id === 'mountain' && !P().flags.cateDown && !G.boss && pl.y < 15 * TILE) startBoss(true);
}

// ---------------- render ----------------
const heroCache = new Map();
function heroSprite(face, frame) {
  const c = P().cosmetics, oc = K.COSMETICS[c.outfit]; const eq = oc?.equip || HERO_EQ.hoodie; const key = face + frame + (pl.ascend ? 'A' : '') + (c.outfit || '');
  let s = heroCache.get(key); if (s) return s;
  const base = shibaSprite('golden', face, frame, eq); if (!pl.ascend) { heroCache.set(key, base); return base; }
  const [cc, g] = (() => { const c2 = document.createElement('canvas'); c2.width = base.width; c2.height = base.height; return [c2, c2.getContext('2d')]; })();
  g.drawImage(base, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,230,90,0.45)'; g.fillRect(0, 0, cc.width, cc.height);
  // spiky golden crest on top of the head
  g.globalCompositeOperation = 'destination-over'; g.fillStyle = '#ffe066'; for (const [x, y, h] of [[7, 2, 3], [10, 0, 4], [13, 1, 4], [16, 2, 3]]) g.fillRect(x, y - 1, 2, h);
  heroCache.set(key, cc); return cc;
}
const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
function text(s, x, y, col = '#fff', size = 8, align = 'left', shadow = '#1a1420') {
  ctx.font = `bold ${size}px "Trebuchet MS", Verdana, sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'top';
  if (shadow) { ctx.fillStyle = shadow; ctx.fillText(s, x + 1, y + 1); } ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function wrap(s, maxW, size = 8) { ctx.font = `bold ${size}px "Trebuchet MS", Verdana, sans-serif`; const out = []; let line = ''; for (const w of s.split(' ')) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } if (line) out.push(line); return out; }
function panel(x, y, w, h) { R(x, y, w, h, '#1a1420'); R(x + 1, y + 1, w - 2, h - 2, '#f6e7c8'); R(x + 2, y + 2, w - 4, h - 4, '#2b2440'); R(x + 3, y + 3, w - 6, 1, '#4a4068'); }
function drawWorld() {
  const a = G.area, sx = G.shake > 0 ? Math.round((Math.random() - 0.5) * 6 * G.shake * 5) : 0, sy = G.shake > 0 ? Math.round((Math.random() - 0.5) * 6 * G.shake * 5) : 0;
  const cx = Math.round(Math.max(0, Math.min(a.w * TILE - VW, pl.x - VW / 2))) - sx, cy = Math.round(Math.max(0, Math.min(a.h * TILE - VH, pl.y - 12 - VH / 2))) - sy;
  const ox = a.w * TILE < VW ? -Math.floor((VW - a.w * TILE) / 2) : cx, oy = a.h * TILE < VH ? -Math.floor((VH - a.h * TILE) / 2) : cy; G.cam = { x: ox, y: oy };
  R(0, 0, VW, VH, '#1a1420');
  const x0 = Math.max(0, Math.floor(ox / TILE)), y0 = Math.max(0, Math.floor(oy / TILE)), x1 = Math.min(a.w - 1, Math.ceil((ox + VW) / TILE)), y1 = Math.min(a.h - 1, Math.ceil((oy + VH) / TILE) + 1);
  const depth = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const ch = a.t[y][x], set = A.tiles[ch] || A.tiles['.']; const v = ch === '~' ? Math.floor(G.t * 2 + x) % 2 : (x * 7 + y * 13) % set.length;
    ctx.drawImage(set[v], x * TILE - ox, y * TILE - oy); if (A.TALL[ch]) depth.push({ y: y * TILE + 15, f: () => { const img = A.tall[A.TALL[ch]]; ctx.drawImage(img, x * TILE + 8 - img.width / 2 - ox, y * TILE + 6 - img.height - oy + (ch === 'P' ? 6 : 0)); } }); }
  const shadow = (x, y, w = 7) => { ctx.fillStyle = 'rgba(20,20,30,.3)'; ctx.beginPath(); ctx.ellipse(Math.round(x - ox), Math.round(y - oy), w, 2.5, 0, 0, 7); ctx.fill(); };
  for (const n of a.npcs) depth.push({ y: n.y * TILE, f: () => { const x = n.x * TILE, y = n.y * TILE; shadow(x, y); const img = n.human ? A.humans[n.human] : shibaSprite(n.coat, n.face, Math.floor(G.t * 1.5) % 2 ? 0 : 0, n.eq); ctx.drawImage(img, Math.round(x - img.width / 2 - ox), Math.round(y - img.height + 1 - oy));
    if (Math.hypot(x - pl.x, y - pl.y) < 30 && !G.dialog) { const bob = Math.floor(G.t * 3) % 2; R(x - ox - 1, y - 38 - oy - bob, 3, 5, '#ffe066'); R(x - ox - 1, y - 32 - oy - bob, 3, 2, '#ffe066'); } } });
  if (G.mode === 'story') for (const it of a.pickups) if (!P().flags['got_' + it.key]) depth.push({ y: it.y * TILE, f: () => { const bob = Math.round(Math.sin(G.t * 4) * 2), x = it.x * TILE - ox, y = it.y * TILE - oy; shadow(it.x * TILE, it.y * TILE, 5);
    if (it.kind === 'orb') { ctx.globalAlpha = 0.35 + Math.sin(G.t * 5) * 0.15; R(x - 9, y - 18 + bob, 18, 18, '#b6ffb0'); ctx.globalAlpha = 1; ctx.drawImage(A.orbs[it.n - 1], Math.round(x - 7), Math.round(y - 16 + bob)); } else ctx.drawImage(A.chest, Math.round(x - 8), Math.round(y - 13)); } });
  if (G.mode === 'hunt') for (const o of G.hunt.orbs) if (o.area === a.id && !G.hunt.got.includes(o.id)) depth.push({ y: o.y * TILE, f: () => { const bob = Math.round(Math.sin(G.t * 4) * 2), x = o.x * TILE - ox, y = o.y * TILE - oy; ctx.globalAlpha = 0.5; R(x - 9, y - 18 + bob, 18, 18, `hsl(${(G.t * 200 + o.n * 50) % 360},100%,70%)`); ctx.globalAlpha = 1; ctx.drawImage(A.orbs[o.n - 1], Math.round(x - 7), Math.round(y - 16 + bob)); } });
  for (const d of G.drops) depth.push({ y: d.y, f: () => ctx.drawImage(A.bone, Math.round(d.x - 6 - ox), Math.round(d.y - 8 - oy)) });
  for (const e of G.enemies) depth.push({ y: e.y, f: () => { const fr = A[e.T.art][Math.floor(e.t * 6) % 2], wind = e.st === 'wind'; shadow(e.x, e.y, e.T.r);
    ctx.drawImage(fr, Math.round(e.x - fr.width / 2 - ox + (wind ? Math.round(Math.random() * 2 - 1) : 0)), Math.round(e.y - fr.height + 2 - oy));
    if (e.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7; ctx.drawImage(fr, Math.round(e.x - fr.width / 2 - ox), Math.round(e.y - fr.height + 2 - oy)); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    if (e.hp < e.max) { R(e.x - 8 - ox, e.y - fr.height - 3 - oy, 16, 3, '#1a1420'); R(e.x - 7 - ox, e.y - fr.height - 2 - oy, Math.ceil(14 * e.hp / e.max), 1, '#ff5f6d'); } } });
  const b = G.boss; if (b && b.st !== 'down') depth.push({ y: b.y, f: () => { const crouch = b.st === 'pounce' && b.t < 0.7, rage = b.hp < b.max / 2; const fr = A.cate[(rage ? 2 : 0) + (crouch ? 1 : Math.floor(b.t * 5) % 2)]; shadow(b.x, b.y, 20);
    ctx.drawImage(fr, Math.round(b.x - 32 - ox), Math.round(b.y - 56 - oy)); if (b.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; ctx.drawImage(fr, Math.round(b.x - 32 - ox), Math.round(b.y - 56 - oy)); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    if (crouch) text('!', b.x - ox, b.y - 70 - oy, '#ff5f6d', 14, 'center'); } });
  depth.push({ y: pl.y, f: drawHero });
  depth.sort((p, q) => p.y - q.y).forEach((d) => d.f());
  for (const s of G.shots) { const x = Math.round(s.x - ox), y = Math.round(s.y - oy); if (s.mine) { R(x - s.r, y - s.r / 2, s.r * 2, s.r, s.col); R(x - s.r + 2, y - 1, s.r * 2 - 4, 2, '#ffffff'); R(x - s.r / 2, y - s.r, s.r, s.r * 2, s.col); } else if (s.rock) { R(x - 3, y - 3, 6, 6, '#38342f'); R(x - 2, y - 2, 4, 4, '#a39e96'); } else { R(x - 4, y - 3, 8, 6, '#7a1f4f'); R(x - 3, y - 4, 6, 8, '#7a1f4f'); R(x - 3, y - 2, 6, 4, s.col); R(x - 2, y - 2, 2, 2, '#fff'); } }
  for (const p of G.parts) { ctx.globalAlpha = Math.min(1, p.life * 3); R(p.x - ox, p.y - oy, p.s, p.s, p.col); } ctx.globalAlpha = 1;
  for (const f of G.floats) text(f.text, Math.round(f.x - ox), Math.round(f.y - oy), f.col, 8, 'center');
  if (G.state === 'wish') drawWish(ox, oy);
}
function drawHero() {
  const { x: ox, y: oy } = G.cam, face = DIRS[pl.dir]; const frame = pl.moving ? Math.floor(pl.walk * 9) % 4 : 0; const img = heroSprite(face, frame);
  const [fx, fy] = DV[pl.dir], lunge = pl.atk > 0 ? 3 : 0; let x = Math.round(pl.x - img.width / 2 - ox + fx * lunge), y = Math.round(pl.y - img.height + 1 - oy + fy * lunge);
  ctx.fillStyle = 'rgba(20,20,30,.3)'; ctx.beginPath(); ctx.ellipse(Math.round(pl.x - ox), Math.round(pl.y - oy), 7, 2.5, 0, 0, 7); ctx.fill();
  if (pl.ascend || pl.charge) { const col = auraColor(); ctx.globalAlpha = 0.35 + Math.sin(G.t * 20) * 0.15; for (let i = 0; i < 7; i++) { const h = 6 + ((G.t * 30 + i * 13) % 10); R(x + 1 + i * 3, y + 30 - h - 18 + Math.abs(i - 3) * 2, 2, h + 10, col); } ctx.globalAlpha = 1; }
  if (pl.inv > 0 && Math.floor(G.t * 20) % 2) ctx.globalAlpha = 0.4; ctx.drawImage(img, x, y); ctx.globalAlpha = 1;
  if (pl.dash > 0) { ctx.globalAlpha = 0.3; ctx.drawImage(img, x - fx * 8, y - fy * 8); ctx.globalAlpha = 1; }
  if (pl.atk > 0) { const hb = attackHitbox(), el = 1 - pl.atk / (pl.combo === 2 ? 0.3 : 0.2); ctx.strokeStyle = pl.ascend ? '#ffe066' : '#ffffff'; ctx.lineWidth = pl.combo === 2 ? 3 : 2; ctx.beginPath();
    const base = Math.atan2(fy, fx), sw = pl.combo === 1 ? -1 : 1; ctx.arc(Math.round(pl.x - ox), Math.round(pl.y - 10 - oy), hb.r + 2, base - sw * 1.2 + sw * el * 2.4 - 0.6, base - sw * 1.2 + sw * el * 2.4 + 0.6); ctx.stroke(); }
  const t = P().cosmetics.title && K.COSMETICS[P().cosmetics.title]; if (t) text(t.name, Math.round(pl.x - ox), y - 9, '#ffe066', 6, 'center');
}
function drawWish(ox, oy) {
  const w = G.wish, k = Math.min(1, w.t / 1.2); ctx.fillStyle = `rgba(10,20,40,${0.6 * (w.phase === 'leave' ? Math.max(0, 1 - w.t / 1.6) : k)})`; ctx.fillRect(0, 0, VW, VH);
  if (w.phase === 'rise' && Math.random() < 0.08) { R(0, 0, VW, VH, 'rgba(200,255,200,.4)'); G.shake = 0.15; }
  const rise = w.phase === 'rise' ? Math.min(1, Math.max(0, (w.t - 0.8) / 1.4)) : w.phase === 'leave' ? Math.max(0, 1 - w.t / 1.4) : 1; if (rise <= 0) return;
  const img = A.pepe[Math.floor(G.t * 0.7) % 4 === 0 ? 1 : 0], px = 20 * TILE - 60 - ox, py = 4 * TILE - 30 - oy - Math.round(rise * 70);
  ctx.globalAlpha = rise; for (let i = 0; i < 7; i++) { const a = G.t * 1.5 + i / 7 * 6.28; ctx.drawImage(A.orbs[i], Math.round(20 * TILE - 7 + Math.cos(a) * 70 - ox), Math.round(py + 50 + Math.sin(a) * 22)); }
  ctx.drawImage(img, Math.round(px), Math.round(py)); ctx.globalAlpha = 1;
}
function drawHUD() {
  const p = P(), d = D(), bx = 6, by = 6;
  panel(bx, by, 118, 34); text(`Lv ${p.level}`, bx + 6, by + 5, '#ffe066', 8);
  const bar = (y, v, max, c1, c2, label) => { R(bx + 32, y, 80, 7, '#1a1420'); R(bx + 33, y + 1, Math.max(0, Math.round(78 * v / max)), 5, c1); R(bx + 33, y + 1, Math.max(0, Math.round(78 * v / max)), 1, c2); text(label, bx + 6, y - 1, '#fff', 7); };
  bar(by + 15, p.hp, d.maxHp, '#ff5f6d', '#ffb0b8', 'HP'); bar(by + 24, p.energy, d.maxEnergy, pl.ascend ? '#ffe066' : '#5cc8ff', '#ffffff', pl.ascend ? 'ASC' : 'EN');
  R(bx + 33, by + 12, Math.round(78 * p.xp / C.xpToNext(p.level)), 1, '#9effa0');
  if (G.mode === 'hunt') { for (let i = 0; i < 7; i++) { ctx.globalAlpha = i < G.hunt.got.length ? 1 : 0.25; ctx.drawImage(A.orbs[i], VW - 108 + i * 14, 8); } ctx.globalAlpha = 1; }
  else if (G.mode === 'story') { for (let i = 0; i < 7; i++) { ctx.globalAlpha = p.orbs.includes('orb' + (i + 1)) ? 1 : 0.22; ctx.drawImage(A.orbs[i], VW - 108 + i * 14, 8); } ctx.globalAlpha = 1; text(`${p.bones} bones`, VW - 8, 24, '#fff4e0', 7, 'right'); }
  if (G.run) text(`${G.mode === 'rush' ? 'BOSS RUSH' : 'HUNT'}  ${fmtTime(performance.now() - G.run.t0)}  deaths ${G.run.deaths}`, VW - 8, G.mode === 'hunt' ? 24 : 8, '#ffe066', 8, 'right');
  const b = G.boss; if (b && b.st !== 'intro' && b.st !== 'down') { const w = Math.min(220, VW - 40), x = (VW - w) / 2, y = VH - 18; R(x - 1, y - 1, w + 2, 9, '#1a1420'); R(x, y, Math.round(w * b.hp / b.max), 7, '#ff7bd5'); R(x, y, Math.round(w * b.hp / b.max), 2, '#ffd0e6'); text('CATE', x, y - 10, '#ffd0e6', 8); }
}
function drawDialog() {
  const d = G.dialog, [name, line] = d.lines[d.i], w = Math.min(VW - 12, 360), h = 56, x = Math.floor((VW - w) / 2), y = VH - h - 6;
  panel(x, y, w, h); if (name) { panel(x + 6, y - 12, Math.min(140, name.length * 6 + 14), 15); text(name, x + 13, y - 8, '#ffe066', 8); }
  wrap(line.slice(0, Math.floor(d.ch)), w - 20, 8).slice(0, 4).forEach((l, i) => text(l, x + 10, y + 9 + i * 11, '#fff8e8', 8));
  if (d.ch >= line.length && Math.floor(G.t * 3) % 2) R(x + w - 12, y + h - 10, 5, 3, '#ffe066');
}
function drawMenu() {
  const m = G.menu, items = m._items || (typeof m.items === 'function' ? m.items() : m.items); const info = m.info ? m.info().filter(Boolean) : [];
  if (m.titleScreen) { const w = 130, x = Math.floor((VW - w) / 2), y = Math.floor(VH * 0.62); items.forEach((it, i) => { const sel = i === m.sel; text((sel ? '> ' : '  ') + it.label, x + 10, y + i * 13, sel ? '#ffe066' : '#fff', 9); }); return; }
  const w = Math.min(VW - 12, 330), lineH = 12, h = 22 + info.length * 10 + items.length * lineH + (items[m.sel]?.sub ? 20 : 6), x = Math.floor((VW - w) / 2), y = Math.max(4, Math.floor((VH - h) / 2));
  ctx.fillStyle = 'rgba(10,8,20,.55)'; ctx.fillRect(0, 0, VW, VH); panel(x, y, w, h); text(m.title, x + 10, y + 7, '#ffe066', 9);
  info.forEach((l, i) => text(l, x + 10, y + 20 + i * 10, l.startsWith('SIM') ? '#ff9ac8' : '#cfc6e6', 7));
  const iy = y + 22 + info.length * 10; items.forEach((it, i) => { const sel = i === m.sel; if (sel) R(x + 5, iy + i * lineH - 2, w - 10, lineH, '#4a4068'); text((sel ? '> ' : '  ') + it.label, x + 10, iy + i * lineH, it.disabled ? '#8a84a0' : sel ? '#ffe066' : '#fff8e8', 8); });
  const sub = items[m.sel]?.sub; if (sub) wrap(sub, w - 20, 7).slice(0, 2).forEach((l, i) => text(l, x + 10, iy + items.length * lineH + 3 + i * 9, '#9effa0', 7));
}
const stars = Array.from({ length: 70 }, (_, i) => [(i * 97) % 997 / 997, (i * 61) % 613 / 613, i % 3]);
function drawTitle() {
  const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#1c1440'); g.addColorStop(0.6, '#6a2c70'); g.addColorStop(1, '#f08a5d'); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  for (const [sx, sy, s] of stars) if ((G.t * 2 + sx * 10) % 3 > 0.4) R(sx * VW, sy * VH * 0.6, s ? 1 : 2, s ? 1 : 2, '#fff8e8');
  ctx.fillStyle = '#3a1f4a'; ctx.beginPath(); ctx.moveTo(0, VH); for (let x = 0; x <= VW; x += 8) ctx.lineTo(x, VH * 0.72 - Math.abs(Math.sin(x / 47)) * 40 - (x > VW * 0.4 && x < VW * 0.6 ? 30 - Math.abs(x - VW / 2) / 3 : 0)); ctx.lineTo(VW, VH); ctx.fill();
  const pepe = A.pepe[Math.floor(G.t) % 5 === 0 ? 1 : 0]; ctx.globalAlpha = 0.9; ctx.drawImage(pepe, Math.round(VW / 2 - 60), Math.round(VH * 0.12 + Math.sin(G.t * 1.5) * 3)); ctx.globalAlpha = 1;
  const ty = Math.round(VH * 0.12 + 78); const sz = Math.min(34, Math.floor(VW / 8));
  ctx.font = `900 ${sz}px Impact, "Arial Black", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1a1420'; ctx.lineWidth = 6; ctx.strokeText('PEPEBALLZ', VW / 2, ty); ctx.fillStyle = '#ffe066'; ctx.fillText('PEPEBALLZ', VW / 2, ty); ctx.fillStyle = '#ff9a3c'; ctx.fillRect(0, 0, 0, 0);
  ctx.font = `900 ${Math.floor(sz * 0.45)}px Impact, "Arial Black", sans-serif`; ctx.lineWidth = 4; ctx.strokeText("CATE'S FURY", VW / 2, ty + sz + 2); ctx.fillStyle = '#ff8fc8'; ctx.fillText("CATE'S FURY", VW / 2, ty + sz + 2);
  const hero = shibaSprite('golden', 'right', Math.floor(G.t * 8) % 4, HERO_EQ.hoodie); ctx.drawImage(hero, Math.round(VW * 0.18), Math.round(VH * 0.8) - 32);
  const cate = A.cate[Math.floor(G.t * 4) % 2]; ctx.drawImage(cate, Math.round(VW * 0.82) - 32, Math.round(VH * 0.8) - 56);
  if (Math.floor(G.t * 2) % 2) text('Press J / tap to start', VW / 2, VH - 14, '#fff8e8', 7, 'center');
  text('Original fan-made game. Wish Network features are simulated.', VW / 2, VH - 24, '#e8c8e8', 6, 'center', null);
}
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false; ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  if (G.state === 'title') drawTitle(); else { drawWorld(); drawHUD(); }
  if (G.banner) { const a = Math.min(1, G.banner.t * 2); ctx.globalAlpha = a; const w = Math.min(VW - 20, G.banner.text.length * 7 + 30); panel((VW - w) / 2, VH * 0.2, w, 20); text(G.banner.text, VW / 2, VH * 0.2 + 6, '#ffe066', 9, 'center'); ctx.globalAlpha = 1; }
  if (G.dialog) drawDialog();
  if (G.menu) drawMenu();
  if (G.toast) { const w = Math.min(VW - 20, G.toast.msg.length * 5.5 + 20); panel((VW - w) / 2, 46, w, 16); text(G.toast.msg, VW / 2, 50, '#fff8e8', 7, 'center'); }
  if (G.fade > 0) { ctx.fillStyle = `rgba(10,8,20,${G.fade})`; ctx.fillRect(0, 0, VW, VH); }
}
// ---------------- loop ----------------
let last = performance.now();
function frame(now) { const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; try { update(dt); render(); } catch (e) { console.error(e); window.__pbErr = String(e.stack || e); } for (const k in pressed) pressed[k] = false; requestAnimationFrame(frame); }
resize(); toTitle(); requestAnimationFrame(frame);
cv.addEventListener('pointerdown', () => { Audio8.unlock(); if (G.state === 'title' && G.menu?.titleScreen) press('atk'), setTimeout(() => release('atk'), 50); });
G.enterArea = enterArea; G.startBoss = startBoss; G.saveGame = saveGame; G.giveOrb = giveOrb;
