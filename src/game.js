// Vanilla JS canvas action RPG. Original IP. Display title comes from config.js (GAME_TITLE).
import * as C from './core.js';
import * as K from './kibble.js';
import { Audio8 } from './audio.js';
import { buildArt } from './art.js';
import { buildWorld, huntSpots, TILE } from './world.js';
import { shibaSprite } from './inu/sprite.js';
import { heroFrame, STAGES, FORM_W, FORM_H } from './forms.js';
import { drawText, measure } from './font.js';
import { GAME_TITLE, GAME_SUBTITLE, GAME_FULL_TITLE } from './config.js';
document.title = GAME_FULL_TITLE;
{ const a = document.getElementById('vaultLink'); if (a) { a.href = K.VAULT_URL; a.innerHTML = `<b>${K.VAULT_NAME}</b> ${K.VAULT_SHORT} <u>View on Solscan ↗</u>`; a.title = K.OWNER_WALLET; } }

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
function navX() { const [x] = moveVec(); if (pressed.left) { navCD = 0.3; return -1; } if (pressed.right) { navCD = 0.3; return 1; } if (held.left || held.right) return 0; if (Math.abs(x) > 0.7 && navCD <= 0) { navCD = 0.25; return Math.sign(x); } return 0; }
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
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on'); press(a); if (navigator.vibrate) try { navigator.vibrate(a === 'atk' ? 6 : 10); } catch {} });
    const up = () => { b.classList.remove('on'); release(a); }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up); }
  addEventListener('touchstart', () => document.body.classList.add('touch'), { passive: true, once: true });
  if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
  for (const ev of ['touchmove', 'gesturestart', 'dblclick', 'contextmenu']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
}
setupTouch();

// ---------------- sizing: crisp integer scale ----------------
function resize() {
  // DPR cap 3 (was 2): on 3x phones a 2x backing store was CSS-stretched 1.5x => uneven pixel columns that shimmer while scrolling.
  DPR = Math.min(3, window.devicePixelRatio || 1); const r = cv.getBoundingClientRect(); const w = Math.round(r.width * DPR), h = Math.round(r.height * DPR);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } // resetting width clears the canvas: only on a real size change
  SCALE = Math.max(1, Math.floor(Math.min(w, h) / 230)); VW = Math.ceil(w / SCALE); VH = Math.ceil(h / SCALE);
  ctx.imageSmoothingEnabled = false;
}
addEventListener('resize', resize); new ResizeObserver(resize).observe(cv);

// ---------------- game state ----------------
const G = { state: 'title', t: 0, p: null, net: {}, area: null, enemies: [], shots: [], parts: [], floats: [], cam: { x: 0, y: 0 }, shake: 0,
  dialog: null, menu: null, boss: null, fade: 0, fadeTo: null, banner: null, mode: 'story', run: null, hunt: null, wallet: null, holdU: 0, toast: null };
window.__pb = G; G.C = C; G.K = K;
const pl = { x: 0, y: 0, dir: 0, walk: 0, moving: false, atk: 0, combo: 0, comboT: 0, hitDone: false, dash: 0, dashCD: 0, inv: 0, charge: false, chargeT: 0, ascend: false, kx: 0, ky: 0, blastCD: 0, flash: 0 };
pl.stage = 0; pl.beamT = 0; Object.defineProperty(pl, 'ascend', { get: () => pl.stage > 0, set: (v) => { if (!v) pl.stage = 0; else if (!pl.stage) pl.stage = 1; } });
G.pl = pl;
const STORE = (() => { try { localStorage.setItem('_t', 1); return localStorage; } catch { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = String(v); } }; } })();
const NET_KEY = K.DEMO ? 'pepeballz.demo.net.v1' : 'pepeballz.net.v1'; // demo progress never leaks into real mode
function loadNet() { try { G.root = JSON.parse(STORE.getItem(NET_KEY)) || {}; } catch { G.root = {}; } G.net = K.ensureNet(G.root); G.net.wallet ||= {}; }
const saveNet = () => STORE.setItem(NET_KEY, JSON.stringify(G.root));
loadNet();
if (K.DEMO) K.setWallet(new K.SimWallet(G.net.wallet));
else { // real mode: purchased / burned cosmetics come only from the wallet's server inventory
  G.net.owned = G.net.owned.filter((id) => !K.COSMETICS[id]?.shop && !K.COSMETICS[id]?.burn); K.setWallet(K.pendingWallet()); }
addEventListener('pepe:wallet', (e) => { if (e.detail?.address) refreshWallet().catch?.(() => {}); });
K.initKibble().then(() => { if (K.getWallet().address) refreshWallet(); }).catch(() => {});
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
function newGame() { G.mode = 'story'; G.p = C.init(C.newPlayer()); pl.stage = 0; Object.assign(pl, { inv: 0, dir: 0 }); enterArea('village', 20.5, 18); G.state = 'play';
  say([['Elder Hachi', 'Woof! Wake up, pup. Cate the Catnip Queen crept down from Fang Peak last night and pawed off with the pack\'s kibble stash.'], ['Elder Hachi', 'Come see me by the old pond basin, north of the square.']]); }
function continueGame() { const p = C.load(STORE); if (!p) return newGame(); G.mode = 'story'; G.p = p; enterArea(p.area, p.x / TILE, p.y / TILE); G.state = 'play'; toast('Welcome back, Shiba. Woof!'); }

// ---------------- dialog (typewriter) ----------------
function say(lines, done) { G.dialog = { lines, i: 0, ch: 0, done }; }
function updateDialog(dt) {
  const d = G.dialog, line = d.lines[d.i][1], prev = Math.floor(d.ch); d.ch = Math.min(line.length, d.ch + dt * 45);
  if (Math.floor(d.ch) > prev && Math.floor(d.ch) % 2 === 0) Audio8.sfx('blip');
  if (ok() || pressed.blast) { if (d.ch < line.length) d.ch = line.length; else if (++d.i >= d.lines.length) { G.dialog = null; d.done?.(); } else d.ch = 0; }
}

// ---------------- menus ----------------
function openMenu(m) { // simulated payouts / stubs are demo-only: outside ?demo=1 they explain instead of faking money
  const wrap = (it) => (it && DEMO_ONLY(it.label || '') ? { ...it, sub: 'Demo mode only (?demo=1)', act: () => toast('Demo mode only: open the game with ?demo=1') } : it);
  if (Array.isArray(m.items)) m.items = m.items.map(wrap); else if (typeof m.items === 'function') { const f = m.items; m.items = () => f().map(wrap); }
  m.sel = m.sel || 0; m.parent = G.menu; G.menu = m; Audio8.sfx('select'); }
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
    { label: 'Pond Network', act: networkMenu }, { label: G.mode === 'story' ? 'Save game' : 'Abandon run', act: () => { if (G.mode === 'story') { saveGame(); closeMenu(); } else { G.menu = null; endRun(false); } } },
    { label: 'Sound: toggle', act: () => toast(Audio8.toggleMute() ? 'Muted' : 'Sound on') }, { label: 'Close', act: closeMenu } ] });
}
function itemsMenu() {
  openMenu({ title: 'Items', info: () => [`HP ${Math.ceil(P().hp)}/${D().maxHp}   Energy ${Math.floor(P().energy)}/${D().maxEnergy}`, `Bones ${P().bones}   Pond Lilies ${P().orbs.length}/${C.LILY_COUNT}`, ...C.LILIES.filter((l) => P().orbs.includes(l.id)).map((l) => `${l.name}: ${l.buff}`)],
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

// ---------------- NPCs wander ----------------
function updateNPCs(dt) {
  for (const n of G.area.npcs) { n.hx ??= n.x; n.hy ??= n.y; n.tm = (n.tm ?? Math.random() * 2) - dt; n.walk ||= 0;
    const near = Math.hypot(n.x * TILE - pl.x, n.y * TILE - pl.y) < 30;
    if (G.dialog || G.menu || near || G.state !== 'play') { n.moving = false; continue; }
    if (n.tm <= 0) { n.tm = 1.2 + Math.random() * 2.5; if (Math.random() < 0.55) { n.tx = n.hx + (Math.random() - 0.5) * 3; n.ty = n.hy + (Math.random() - 0.5) * 2; } else n.tx = null; }
    if (n.tx == null) { n.moving = false; continue; }
    const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy); if (d < 0.05) { n.tx = null; n.moving = false; continue; }
    const sp = 1.4 * dt, nx = n.x + dx / d * sp, ny = n.y + dy / d * sp;
    const blocked = (x, y) => A.SOLID.has(G.area.get(Math.floor(x + 0.3), Math.floor(y))) || A.SOLID.has(G.area.get(Math.floor(x - 0.3), Math.floor(y))) || A.SOLID.has(G.area.get(Math.floor(x), Math.floor(y - 0.2)));
    if (blocked(nx, ny)) { n.tx = null; continue; }
    n.x = nx; n.y = ny; n.moving = true; n.walk += dt; n.face = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'); }
}

// ---------------- NPC talk ----------------
const TALK = {
  elder: () => { const f = P().flags;
    if (!f.metElder) return say([['Elder Hachi', 'Woof. Our village pond has run dry since Cate came down from Fang Peak. Its five Pond Lilies blew away across the land.'], ['Elder Hachi', 'Each lily is a different colour, and each one makes whoever carries it a little stronger.'], ['Elder Hachi', 'Take this Rose Lily. Find the other four in the village, Whisker Woods and on Fang Peak, then bring them to the basin to restore the pond.']], () => { f.metElder = true; giveOrb(1); });
    if (P().orbs.length >= C.LILY_COUNT) return say([['Elder Hachi', 'All five lilies! Set them in the basin and the pond will fill again.']]);
    say([['Elder Hachi', `You carry ${P().orbs.length} of ${C.LILY_COUNT} Pond Lilies. East to the woods, north to the peak.`]]); },
  akita: () => say([['Akita Ren', 'Feel that hum in your fur? That is Unleash. Press Q or the ▲ button and let your coat glow.'], ['Akita Ren', 'You hit harder and take less, but it burns energy fast. Hold C to rest and catch your breath.']]),
  kai: () => say([['Kai', 'Tap J three times for a full combo. The third hit sends foes flying.'], ['Kai', 'K lets out a Howl Wave. Howl right after resting for a big one. Space dashes through attacks.']]),
  merchant: () => say([['Biscuit Bram', 'Fresh biscuits! Bones only. Cate\'s tabby kits drop them when you bonk them.'], ['Biscuit Bram', 'Fancy coats and auras? Rin\'s Pond Shop takes $KIBBLE. Cosmetic only, every pup plays fair.']], shopMenu),
  pup: () => say([['Pip', 'Arf! When I grow up I want to Unleash too! My tail already glows a little. Probably.']]),
  rin: () => { const f = P().flags; const lines = [['Rin', 'I built a Pond Network terminal! Weekly lily hunts, a Cate boss rush, leaderboards...'], ['Rin', '$KIBBLE is live now: connect Phantom up top! Prizes go by rank, never by luck, and entry is free.']];
    if (!f.rinGift) { lines.push(['Rin', 'Here, take some Lily Tea for the road.']); return say(lines, () => { f.rinGift = true; C.addItem(P(), 'tea', 2); Audio8.sfx('pickup'); toast('Got Lily Tea x2'); networkMenu(); }); }
    say(lines, networkMenu); },
  tomo: () => say([['Old Tomo', 'When the pond was full, an old toad called Pondo kept it clean. Grumpy, warty, kind.'], ['Old Tomo', 'Fill it again and maybe he will come home.']]),
  shiro: () => say([['Scout Shiro', 'Careful. Those tabby kits wander back to Cate, and a good cuddle heals her right up.'], ['Scout Shiro', 'Thin them out before you face her. The peak is north.']]),
  aki: () => say([['Ranger Aki', P().flags.cateDown ? 'You beat her! Though... those royal pawprints head somewhere bigger.' : 'Cate is up at the summit. Watch for her pounce: she crouches first. Dash through it!']]),
};
function tryInteract() {
  const [fx, fy] = DV[pl.dir], tx = pl.x + fx * 12, ty = pl.y - 4 + fy * 12;
  for (const n of G.area.npcs) if (Math.hypot(n.x * TILE - tx, n.y * TILE - ty) < 16) { n.face = DIRS[pl.dir ^ (pl.dir < 2 ? 1 : 1)]; n.face = ['up', 'down', 'right', 'left'][pl.dir]; TALK[n.id]?.(); return true; }
  if (G.area.id === 'village' && Math.abs(pl.x - 20 * TILE) < 26 && pl.y < 7.5 * TILE) { altar(); return true; }
  return false;
}
function altar() {
  const have = G.mode === 'hunt' ? G.hunt.got.length : P().orbs.length;
  if (have >= C.LILY_COUNT) return startWish();
  say([['Pond basin', `A dry stone basin with five lily-shaped hollows. ${have} of ${C.LILY_COUNT} Pond Lilies ${G.mode === 'hunt' ? '(weekly hunt lilies)' : ''} in your pack.`]]);
}
function giveOrb(n) { const L = C.lily('orb' + n); if (C.addOrb(P(), 'orb' + n)) { Audio8.sfx('orb'); G.banner = { text: `${L.name}! ${L.buff} (${P().orbs.length}/${C.LILY_COUNT})`, t: 2.5 }; burst(pl.x, pl.y - 16, A.orbs ? '#9effa0' : '#fff', 24); } }

// ---------------- Unleash transformation cutscene ----------------
G.craters = [];
function startTransform(stage) { G.cut = { t: 0, stage, flashed: false }; G.state = 'cut'; pl.dir = 0; pl.atk = 0; pl.dash = 0; pl.charge = false; Audio8.sfx('roar'); }
function updateCut(dt) {
  const c = G.cut; c.t += dt;
  if (!c.flashed && Math.random() < 0.35) { const a = Math.random() * 6.28; G.parts.push({ x: pl.x + Math.cos(a) * 18, y: pl.y - 6 + Math.sin(a) * 6, vx: Math.cos(a) * 20, vy: -20 - Math.random() * 25, life: 0.9, col: Math.random() < 0.5 ? '#9ad070' : '#e8f2c8', s: 1 }); } // drifting leaves

  if (!c.flashed && c.t >= 1.0) { c.flashed = true; pl.stage = c.stage; P().energy = Math.max(0, P().energy - 10); G.flash = 0.5; G.shake = 0.15;
    for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, v = 60 + Math.random() * 140; G.parts.push({ x: pl.x, y: pl.y - 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - 60, g: 260, life: 0.9, col: i % 3 ? '#7a6a58' : '#bfb2a0', s: 1 + (Math.random() * 3 | 0) }); }
    burst(pl.x, pl.y - 16, STAGES[c.stage].aura, 40, 150); G.banner = { text: STAGES[c.stage].name.toUpperCase() + '!', t: 1.6 }; }
  if (c.t >= 1.75) { G.state = 'play'; G.cut = null; }
}

// ---------------- combat ----------------
function burst(x, y, col, n = 10, sp = 60) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = sp * (0.3 + Math.random()); G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + Math.random() * 0.4, col, s: 1 + (Math.random() * 2 | 0) }); } }
const float = (x, y, text, col = '#fff') => G.floats.push({ x, y, text: String(text), col, t: 0.9 });
function auraColor() { const c = K.COSMETICS[P().cosmetics.aura]; return (c && (!c.forms || c.forms.includes(Math.max(1, pl.stage))) && c.color) || STAGES[Math.max(1, pl.stage)].aura; }
function boltColor() { const c = K.COSMETICS[P()?.cosmetics?.bolt]; return c?.color || '#e8ff9a'; } // holder cosmetics tint the aura only, never the fur
function beamColor() { const c = K.COSMETICS[P().cosmetics.beam]; return c?.color === 'rainbow' ? `hsl(${(G.t * 400) % 360},100%,65%)` : c?.color || '#7ff0ff'; }
function hurtPlayer(raw, fromX, fromY) {
  if (pl.inv > 0 || pl.dash > 0 || G.state !== 'play') return;
  const dmg = C.damageTaken(P(), raw, { stage: pl.stage }); P().hp -= dmg; pl.inv = 0.9; pl.flash = 0.2; G.shake = 0.2; Audio8.sfx('hurt');
  const a = Math.atan2(pl.y - fromY, pl.x - fromX); pl.kx = Math.cos(a) * 160; pl.ky = Math.sin(a) * 160; float(pl.x, pl.y - 30, dmg, '#ff6b6b');
  if (P().hp <= 0) die();
}
function die() {
  P().hp = 0; Audio8.sfx('die'); pl.ascend = false;
  if (G.mode === 'tourney') return tourneyResult(false);
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
  if (e.type === 'ghost') { e.dead = true; burst(e.x, e.y - 12, '#d0c0ff', 30, 100); return tourneyResult(true); }
  burst(e.x, e.y - 6, e.type === 'kitten' ? '#e0a060' : e.type === 'boar' ? '#b07a52' : '#bdb8b0', 18); Audio8.sfx('hit3'); e.dead = true;
  if (G.mode !== 'story') return;
  const ups = C.gainXp(P(), e.T.xp); P().bones += e.T.bones; float(e.x, e.y - 24, `+${e.T.xp}xp  +${e.T.bones} bones`, '#9effa0');
  if (Math.random() < 0.12) G.drops.push({ x: e.x, y: e.y, id: 'bone', t: 12 });
  if (ups) { Audio8.sfx('level'); G.banner = { text: `Level up! Lv ${P().level}  (+${ups * 3} stat points)`, t: 3 }; burst(pl.x, pl.y - 16, '#ffe066', 30, 90); }
}
G.drops = [];
function attackHitbox() { const [fx, fy] = DV[pl.dir]; return { x: pl.x + fx * 14, y: pl.y - 8 + fy * 12, r: pl.combo === 2 ? 15 : 12 }; }
function updatePlayer(dt) {
  const p = P(), d = D(), [mx, my] = moveVec();
  pl.beamT -= dt; pl.inv = Math.max(0, pl.inv - dt); pl.flash = Math.max(0, pl.flash - dt); pl.dashCD -= dt; pl.blastCD -= dt; pl.comboT -= dt; pl.chargeT -= dt;
  // Ascend toggle + drain
  if (pressed.ascend) { const top = C.unlockedStage(p);
    if (pl.stage >= top) { if (pl.stage) { pl.stage = 0; toast('Unleash released'); Audio8.sfx('dash'); } }
    else if (p.energy >= C.ASCEND_COST) startTransform(pl.stage + 1); else toast(`Need ${C.ASCEND_COST} energy to Unleash`); }
  if (pl.stage) { p.energy -= C.ASCEND_DRAIN[pl.stage] * dt; if (Math.random() < 0.5 + pl.stage * 0.15) G.parts.push({ x: pl.x + (Math.random() - 0.5) * (14 + pl.stage * 8), y: pl.y - Math.random() * 8, vx: (Math.random() - 0.5) * 10, vy: -40 - Math.random() * 40 * pl.stage, life: 0.4 + pl.stage * 0.1, col: Math.random() < 0.3 ? '#ffffff' : auraColor(), s: Math.random() < 0.5 ? 1 : 2 }); if (p.energy <= 0) { p.energy = 0; pl.stage = 0; toast('Out of energy'); } }
  // charge
  pl.charge = held.charge && pl.atk <= 0 && pl.dash <= 0;
  if (pl.charge) { p.energy = Math.min(d.maxEnergy, p.energy + 32 * dt); pl.chargeT = 0.6; if (Math.random() < 0.7) { const a = Math.random() * 6.28; G.parts.push({ x: pl.x + Math.cos(a) * 22, y: pl.y - 12 + Math.sin(a) * 18, vx: -Math.cos(a) * 60, vy: -Math.sin(a) * 50, life: 0.35, col: auraColor(), s: 1 }); } if (Math.random() < dt * 8) Audio8.sfx('charge'); }
  // dash
  if (pressed.dash && pl.dashCD <= 0 && !pl.charge) { pl.dash = 0.18; pl.dashCD = 0.45; Audio8.sfx('dash'); if (mx || my) pl.dir = Math.abs(mx) > Math.abs(my) ? (mx < 0 ? 2 : 3) : (my < 0 ? 1 : 0); }
  // attack / talk
  if (pressed.atk && !pl.charge) { if (pl.atk <= 0 && !tryInteract()) { pl.combo = pl.comboT > 0 ? (pl.combo + 1) % 3 : 0; pl.atk = pl.combo === 2 ? 0.3 : 0.2; pl.hitDone = false; pl.comboT = pl.atk + 0.35; Audio8.sfx('swing'); } }
  if (pressed.blast && !pl.charge && pl.blastCD <= 0) { const cost = 14; if (p.energy >= cost) { p.energy -= cost; const charged = pl.chargeT > 0; pl.blastCD = 0.35; const [fx, fy] = DV[pl.dir];
      G.shots.push({ x: pl.x + fx * 10, y: pl.y - 12 + fy * 6, vx: fx * 240, vy: fy * 240, r: charged ? 7 : 4, dmg: C.attackDamage(p, 'blast', { charged, stage: pl.stage }), mine: true, t: 1.2, col: beamColor(), big: charged });
      Audio8.sfx('blast'); pl.chargeT = 0; pl.beamT = 0.28; } else toast('Not enough energy (hold C to rest)'); }
  // movement
  let spd = 78 * [1, 1.25, 1.35, 1.45][pl.stage];
  if (pl.dash > 0) { pl.dash -= dt; const [fx, fy] = DV[pl.dir]; moveBody(pl, fx * 270 * dt, fy * 270 * dt, 5, 3); if (Math.random() < 0.8) G.parts.push({ x: pl.x, y: pl.y - 10, vx: 0, vy: 0, life: 0.2, col: '#ffffff', s: 2 }); }
  else if (pl.charge) pl.moving = false;
  else { const sl = pl.atk > 0 ? 0.25 : 1; pl.moving = !!(mx || my) && pl.atk <= 0;
    if (mx || my) { if (pl.atk <= 0) pl.dir = Math.abs(mx) > Math.abs(my) ? (mx < 0 ? 2 : 3) : (my < 0 ? 1 : 0); moveBody(pl, mx * spd * sl * dt, my * spd * sl * dt, 5, 3); }
    pl.walk += pl.moving ? dt * Math.hypot(mx, my) : 0; }
  if (pl.kx || pl.ky) { moveBody(pl, pl.kx * dt, pl.ky * dt, 5, 3); pl.kx *= 0.82; pl.ky *= 0.82; if (Math.abs(pl.kx) + Math.abs(pl.ky) < 5) pl.kx = pl.ky = 0; }
  if (G.boss && G.boss.lock) pl.y = Math.min(pl.y, 15.3 * TILE);
  // melee hit window
  if (pl.atk > 0) { pl.atk -= dt; const el = (pl.combo === 2 ? 0.3 : 0.2) - pl.atk;
    if (!pl.hitDone && el > 0.05) { pl.hitDone = true; const hb = attackHitbox(), dmg = C.attackDamage(p, pl.combo, { stage: pl.stage }), kb = pl.combo === 2 ? 220 : 70; let any = false;
      for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - hb.x, e.y - 6 - hb.y) < hb.r + e.T.r) { hitEnemy(e, dmg, Math.atan2(e.y - pl.y, e.x - pl.x), kb); any = true; }
      const b = G.boss; if (b && b.st !== 'intro' && b.hp > 0 && Math.hypot(b.x - hb.x, b.y - 14 - hb.y) < hb.r + 20) { hitEnemy(b, dmg, 0, kb, true); any = true; }
      if (any) Audio8.sfx(pl.combo === 2 ? 'hit3' : 'hit'); } }
  // exits
  for (const ex of G.area.exits) { const tx = pl.x / TILE, ty = pl.y / TILE; if (tx >= ex.x && tx <= ex.x + ex.w && ty >= ex.y && ty <= ex.y + ex.h && !G.fadeTo) { if (G.mode === 'rush') continue; G.fadeTo = ex; } }
}
function updateEnemies(dt) {
  for (const e of G.enemies) { if (e.dead) continue; e.flash -= dt; e.t += dt; e.cd -= dt; if (e.type === 'ghost') { updateGhost(e, dt); continue; }
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
  for (const s of G.shots) { s.x += s.vx * dt; s.y += s.vy * dt; s.t -= dt; if (s.mine && Math.random() < 0.15) G.parts.push({ x: s.x, y: s.y, vx: 0, vy: 0, life: 0.18, col: s.col, s: s.big ? 3 : 2 });
    if (solidAt(s.x, s.y + 8) && !G.area.get(Math.floor(s.x / TILE), Math.floor((s.y + 8) / TILE)).match(/[~]/)) s.t = 0;
    if (s.mine) { for (const e of G.enemies) if (!e.dead && s.t > 0 && Math.hypot(e.x - s.x, e.y - 8 - s.y) < e.T.r + s.r) { hitEnemy(e, s.dmg, Math.atan2(s.vy, s.vx), 120); s.t = 0; Audio8.sfx('hit'); }
      const b = G.boss; if (b && b.hp > 0 && b.st !== 'intro' && s.t > 0 && Math.hypot(b.x - s.x, b.y - 16 - s.y) < 22 + s.r) { hitEnemy(b, s.dmg, 0, 0, true); s.t = 0; Audio8.sfx('hit'); } }
    else if (Math.hypot(pl.x - s.x, pl.y - 10 - s.y) < s.r + 7) { hurtPlayer(s.dmg, s.x, s.y); s.t = 0; }
    if (s.t <= 0) burst(s.x, s.y, s.col, 5); }
  G.shots = G.shots.filter((s) => s.t > 0);
}

// ---------------- Cate, the Catnip Queen ----------------
function startBoss(intro = true) {
  const a = W.mountain.boss; G.boss = { x: a.x * TILE, y: a.y * TILE, hp: 700, max: 700, st: 'intro', t: 0, cd: 1, vx: 0, vy: 0, flash: 0, lock: true, seq: 0 };
  if (G.mode === 'rush') { G.boss.hp = G.boss.max = 900; }
  Audio8.music('boss'); Audio8.sfx('meow'); G.shake = 0.4;
  const go = () => { G.boss.st = 'hop'; G.boss.t = 0; G.banner = { text: 'CATE, THE CATNIP QUEEN', t: 2 }; };
  if (intro) say([['Cate', 'Mrrrowww~! A little doggy came all the way up here? This kibble is MINE now.'], ['Cate', 'Every kit I cuddle makes me stronger. Let\'s see how well you fetch!']], go); else go();
}
function bossShootRing(n, sp) { const b = G.boss, off = Math.random(); for (let i = 0; i < n; i++) { const a = (i + off) / n * 6.283; G.shots.push({ x: b.x, y: b.y - 16, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 4, dmg: 12, t: 3, col: '#b8a0d8' }); } Audio8.sfx('blast'); }
function updateBoss(dt) {
  const b = G.boss; if (!b || b.hp <= 0) return; b.t += dt; b.flash -= dt; if (b.st === 'intro') return;
  const rage = b.hp < b.max / 2, dx = pl.x - b.x, dy = pl.y - b.y, dist = Math.hypot(dx, dy) || 1, k = rage ? 1.35 : 1;
  const next = () => { const order = ['hop', 'spit', 'pounce', 'hop', 'summon', 'pounce', 'spit']; b.seq = (b.seq + 1) % order.length; b.st = order[b.seq]; b.t = 0; };
  if (b.st === 'hop') { const sp = 38 * k * (Math.sin(b.t * 7) > 0 ? 1.6 : 0.3); moveBody(b, dx / dist * sp * dt, dy / dist * sp * dt, 14, 6); if (b.t > 2.2) next(); }
  else if (b.st === 'spit') { if (b.t > 0.5 && !b.s1) { b.s1 = 1; bossShootRing(rage ? 16 : 12, 85); } if (rage && b.t > 1.1 && !b.s2) { b.s2 = 1; bossShootRing(16, 70); } if (b.t > 1.6) { b.s1 = b.s2 = 0; next(); } }
  else if (b.st === 'pounce') { if (b.t < 0.7) { b.tx = pl.x; b.ty = pl.y; } else if (b.t < 1.25) { if (!b.pv) { const a = Math.atan2(b.ty - b.y, b.tx - b.x); b.vx = Math.cos(a) * 240 * k; b.vy = Math.sin(a) * 240 * k; b.pv = 1; Audio8.sfx('meow'); } moveBody(b, b.vx * dt, b.vy * dt, 14, 6); } else { b.pv = 0; G.shake = 0.2; burst(b.x, b.y, '#ffffff', 14); next(); } }
  else if (b.st === 'summon') { if (b.t > 0.6 && !b.s1) { b.s1 = 1; for (let i = 0; i < (rage ? 3 : 2); i++) { const e = spawnEnemy('kitten', b.x + (i - 1) * 30, b.y + 20); e.st = 'chase'; burst(e.x, e.y, '#e0a060', 10); } Audio8.sfx('meow'); } if (b.t > 1.4) { b.s1 = 0; next(); } }
  // absorb nearby kittens to heal
  for (const e of G.enemies) if (!e.dead && e.type === 'kitten' && Math.hypot(e.x - b.x, e.y - b.y) < 24 && b.st !== 'summon') { e.dead = true; b.hp = Math.min(b.max, b.hp + 45); float(b.x, b.y - 48, 'PURR! +45', '#d8a050'); burst(b.x, b.y - 16, '#e0a060', 20); Audio8.sfx('meow'); }
  if (Math.hypot(dx, dy + 8) < 24) hurtPlayer(b.st === 'pounce' ? 22 : 16, b.x, b.y);
}
function bossDown() {
  const b = G.boss; b.st = 'down'; G.enemies.forEach((e) => (e.dead = true)); G.shots = []; burst(b.x, b.y - 16, '#e0a060', 60, 140); G.shake = 0.6; Audio8.sfx('die');
  if (G.mode === 'rush') { b.lock = false; K.contribute(G.root, 'cate_defeats', 'you'); return finishRun(); }
  const ups = C.gainXp(P(), 150); P().bones += 60; P().flags.cateDown = true; K.contribute(G.root, 'cate_defeats', 'you'); saveNet();
  say([['Cate', 'Mrrp?! You... ruffled my perfect fur!'], ['Cate', 'Fine! Keep your crunchy kibble. I\'ll find a comfier throne. This isn\'t over, doggy!'], ['Shiba', 'Woof! She dropped the pack\'s kibble... and something glowing.']],
    () => { G.boss = null; Audio8.music('mountain'); if (!P().orbs.includes('orb5')) G.area.pickups.push({ key: 'orb5', kind: 'orb', n: 5, x: b.x / TILE, y: b.y / TILE }); G.banner = { text: ups ? `Cate defeated!  Lv ${P().level}` : 'Cate defeated!', t: 3 }; saveGame(true); });
}

// ---------------- pickups ----------------
function updatePickups() {
  const p = P();
  for (const it of G.area.pickups) { if (G.mode !== 'story') break; if (p.flags['got_' + it.key]) continue;
    if (Math.hypot(it.x * TILE - pl.x, it.y * TILE - pl.y) < 12) { p.flags['got_' + it.key] = true;
      if (it.kind === 'orb') giveOrb(it.n); else { C.addItem(p, it.id); Audio8.sfx('pickup'); toast(`Found ${C.ITEMS[it.id].name}`); } saveGame(true); } }
  for (const d of G.drops) { d.t -= 1 / 60; if (Math.hypot(d.x - pl.x, d.y - pl.y) < 12 && G.mode === 'story') { d.t = 0; C.addItem(p, d.id); Audio8.sfx('pickup'); toast('Bone Biscuit!'); } }
  G.drops = G.drops.filter((d) => d.t > 0);
  if (G.mode === 'hunt') for (const o of G.hunt.orbs) if (o.area === G.area.id && !G.hunt.got.includes(o.id) && Math.hypot(o.x * TILE - pl.x, o.y * TILE - pl.y) < 12) { G.hunt.got.push(o.id); K.contribute(G.root, 'hunt_orbs', 'you'); Audio8.sfx('orb'); G.banner = { text: `Hunt lily ${G.hunt.got.length}/${C.LILY_COUNT}`, t: 2 }; }
}

// ---------------- Pond restoration + Pondo the Pond Toad (no wishes, no summoning) ----------------
function startWish() {
  const golden = G.mode === 'story' && G.net.useGolden && K.goldenOrbEligible(G.holdU || 0);
  G.state = 'wish'; G.wish = { t: 0, phase: 'rise', golden }; if (golden) { const r = K.goldenSummon(G.root, G.holdU || 0); if (r.ok) { P().cosmetics.title = 'title_golden'; saveNet(); } } pl.x = 20 * TILE; pl.y = 9.5 * TILE; pl.dir = 1; pl.ascend = false; Audio8.music('wish'); Audio8.sfx('croak');
}
function updateWish(dt) {
  const w = G.wish; w.t += dt;
  if (w.phase === 'rise' && w.t > 2.4) { w.phase = 'talk'; Audio8.sfx('croak');
    if (G.mode === 'hunt') return say([['Pondo', 'Croak. Five hunt lilies, and quick about it too. Your time is logged on the Pond Network.']], () => { w.phase = 'leave'; w.t = 0; finishRun(); });
    say([['Pondo', 'Croak! Water! Real water! Who filled my pond?'], ['Pondo', 'I am Pondo. I keep this pond clean. Keep those lilies, pup: their strength is yours now.'], ['Pondo', 'Here, some Lily Tea from the shallows. Now shoo, I have algae to sort.']], () => {
      C.restorePond(P()); Audio8.sfx('level'); burst(pl.x, pl.y - 16, '#9effe0', 50, 120); toast('Pond restored! Got Lily Tea x2'); w.phase = 'leave'; w.t = 0; saveGame(true); }); }
  if (w.phase === 'leave' && w.t > 1.6) { G.state = G.state === 'wish' ? 'play' : G.state; G.wish = null; if (G.mode === 'story') { Audio8.music(G.area.music); G.banner = { text: P().flags.cateDown ? 'CHAPTER 1 CLEAR!' : 'The pond is full again!', t: 3 }; } }
}

// ---------------- network modes (simulated) ----------------
const STD_BUILD = () => { const p = C.newPlayer(); p.level = 6; p.stats = { str: 11, def: 8, vit: 9, enr: 9 }; p.inventory = { bone: 3, tea: 2 }; return C.init(p); }; // fixed build so boards are fair
let storySave = null;
function startRun(mode) {
  storySave = G.p ? JSON.parse(JSON.stringify(G.p)) : null; if (G.mode === 'story' && G.p) saveGame(true);
  const p = STD_BUILD(); p.cosmetics = { ...(storySave?.cosmetics || G.net.cos || p.cosmetics) }; G.p = p; G.mode = mode; G.menu = null; G.state = 'play';
  G.run = { mode, t0: performance.now(), deaths: 0, week: K.weekId(Date.now()), day: K.dayId(Date.now()) };
  if (mode === 'rush') { enterArea('mountain', 20, 14); startBoss(false); }
  else { G.hunt = { orbs: K.huntOrbs(G.run.week, huntSpots(W)), got: [] }; enterArea('village', 20.5, 9); G.banner = { text: `Weekly Pond Lily Hunt #${G.run.week}`, t: 3 }; }
}
G.startRun = startRun;
function finishRun() {
  const r = G.run, ms = Math.round(performance.now() - r.t0), board = r.mode, n = G.net; G.posted = '';
  K.postRun(ms, r.deaths).then((p) => { if (p) G.posted = p.ok ? `Posted score ${p.score} to the prize board` : 'Prize board: ' + p.reason; }).catch((e) => { G.posted = 'Prize board: ' + e.message; });
  const row = { id: 'you', name: n.pack.tag ? `Shiba [${n.pack.tag}]` : 'Shiba (you)', timeMs: ms, deaths: r.deaths, at: Date.now() };
  const key = board === 'rush' ? 'rush' : 'huntRuns'; n[key] ||= []; n[key].push({ ...row, period: board === 'rush' ? r.day : r.week }); if (n[key].length > 40) n[key].shift();
  const ranked = K.rankRuns([...K.sampleRows(board, board === 'rush' ? r.day : r.week), ...bestMine(board)]); const mine = ranked.find((x) => x.id === 'you');
  K.addPackPoints(G.root, board === 'rush' ? 'rushClear' : 'huntFinish'); if (mine.rank <= 3) K.addPackPoints(G.root, board === 'rush' ? 'rushTop3' : 'huntTop3'); saveNet();
  setTimeout(() => { G.boss = null; openMenu({ title: board === 'rush' ? 'Boss Rush clear!' : 'Hunt complete!', noBack: true, info: () => [`Time ${fmtTime(ms)}   Deaths ${r.deaths}`, K.DEMO ? `Your rank: #${mine.rank} of ${ranked.length} (demo rivals)` : (G.posted || (K.getWallet().address ? 'Posting to the prize board…' : 'Sign in (Pond Network) to post runs to the prize board')), n.pack.tag ? `Pack [${n.pack.tag}] points: ${n.pack.points}` : 'Join a pack to earn Kibble Cup points'],
    items: [{ label: 'View leaderboards', act: leaderboardsMenu }, { label: 'Return to story', act: () => endRun(true) }] }); }, 600);
}
function endRun() { G.menu = null; G.mode = 'story'; G.run = null; G.hunt = null; G.boss = null; if (storySave) { G.p = storySave; enterArea(G.p.area, G.p.x / TILE, G.p.y / TILE); G.state = 'play'; } else toTitle(); }
const fmtTime = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(Math.floor(ms / 10) % 100).padStart(2, '0')}`;
function bestMine(board) { const n = G.net, list = (board === 'rush' ? n.rush : n.huntRuns) || [], per = board === 'rush' ? K.dayId(Date.now()) : K.weekId(Date.now()); const mine = list.filter((x) => x.period === per); return mine.length ? [K.rankRuns(mine)[0]] : []; }
function boardRows(board) { const per = board === 'rush' ? K.dayId(Date.now()) : K.weekId(Date.now()); return K.rankRuns([...K.sampleRows(board, per), ...bestMine(board)]); }
function cupRows() { const n = G.net; const packs = [{ tag: 'FANG', points: 140 }, { tag: 'MOCHI', points: 95 }, { tag: 'KURO', points: 60 }]; if (n.pack.tag) packs.push({ tag: n.pack.tag, points: n.pack.points, mine: true }); return K.kibbleCup(packs); }
// purchases/burns: if kibble-pay is unreachable say so; otherwise sign in (errors become toasts, never page errors)
async function ensureWallet() { if (!K.DEMO && K.mode !== 'live') { toast(K.SOON_MSG, 3); return false; } try { await K.getWallet().connect(); await refreshWallet(); return true; } catch (e) { toast(e.message, 3); return false; } }
async function refreshWallet() { const w = K.getWallet(); if (!w.address) return; G.walletBal = await w.balanceU(); G.holdU = await w.holdingsU();
  if (!w.simulated && w.inventory) { K.syncOwned(G.root, await w.inventory()); saveNet(); if (!G.shiba && K.glue) G.shiba = await K.glue.loadShiba(w.address).catch(() => null); } }
const tier = () => K.tierFor(G.holdU || 0);
const SIM = () => (K.DEMO ? 'DEMO MODE (?demo=1): fake KIBBLE, nothing real' : K.mode === 'live' ? 'LIVE $KIBBLE: you sign every payment in Phantom' : K.SOON_MSG);
const DEMO_ONLY = (lbl) => !K.DEMO && /\(sim\)|sim allies|^SIM:|^Settle|^List \$PAWS/.test(lbl);
function networkMenu() {
  refreshWallet();
  openMenu({ title: 'Pond Network', info: () => [SIM(), K.getWallet().address ? `Wallet ${K.getWallet().address.slice(0, 10)}..  ${K.fmtK(G.walletBal || 0)} KIBBLE  Tier: ${tier().name}` : (K.DEMO ? 'Wallet: not connected (demo)' : 'Wallet: not signed in. Scores need a Phantom sign-in (free).')],
    items: () => [
      { label: K.getWallet().address ? (K.DEMO ? 'Wallet: connected (DEMO)' : 'Wallet: signed in') : (K.DEMO ? 'Connect DEMO wallet' : 'Sign in with Phantom'), act: async () => { try { await K.getWallet().connect(); await refreshWallet(); toast(K.DEMO ? 'DEMO wallet connected' : 'Signed in. Runs now post to the prize board.'); } catch (e) { toast(e.message); } } },
      { label: 'Weekly Pond Lily Hunt', sub: 'Free. Same 5 lilies for everyone this week. Fastest wins.', act: () => startRun('hunt') },
      { label: 'Cate Boss Rush', sub: 'Free. Fixed build. Fastest clear wins.', act: () => startRun('rush') },
      { label: 'Leaderboards & prize pools', act: leaderboardsMenu }, { label: 'Pond Shop (cosmetic)', act: wishShop }, { label: 'Cosmetics & holder tier', act: cosmeticsMenu },
      { label: 'Tournament of Paws (weekly, free)', act: tourneyMenu }, { label: 'Cate Bounty Board', act: bountyMenu }, { label: 'Seasons', act: seasonMenu }, { label: 'Burn for Legends', act: burnMenu }, { label: 'Fighter Launches (stub)', act: launchMenu },
      { label: 'Pack & Kibble Cup', act: packMenu }, { label: 'Co-op Cate Raid (event stub)', act: raidMenu }, { label: 'Export cosmetics to Inu Verse (stub)', act: exportMenu }, { label: 'Back', act: closeMenu } ] });
}
function leaderboardsMenu() {
  let tab = 0; const tabs = ['daily', 'weekly', 'monthly'], names = { daily: 'Daily: Cate Boss Rush', weekly: 'Weekly: Pond Lily Hunt', monthly: 'Monthly: Kibble Cup (packs)' };
  openMenu({ title: 'Leaderboards', info: () => { const pool = tabs[tab], n = G.net; const rows = pool === 'monthly' ? cupRows().map((r) => `#${r.rank} [${r.tag}] ${r.points} pts${r.mine ? ' <you' : ''}`) : boardRows(K.POOL_BOARDS[pool]).slice(0, 6).map((r) => `#${r.rank} ${r.name.padEnd(13)} ${fmtTime(r.timeMs)} d${r.deaths}${r.id === 'you' ? ' <' : ''}`);
      if (!K.DEMO) { const b = K.serverBoards[pool] || [], me = K.getWallet().address, P = K.serverPools?.[pool];
        return [`< ${pool.toUpperCase()}: ${GAME_TITLE} runs (wallet-signed) >`, `Live pool ${P ? K.fmtK(Number(P.accruedBaseUnits)) : '0'} KIBBLE, paid to the combined top 3 of all Inu games`, 'Free entry, skill only. Score = faster clear, fewer deaths.',
          ...(b.length ? b.slice(0, 6).map((e) => `#${e.rank} ${e.wallet.slice(0, 4)}..${e.wallet.slice(-4)}  ${e.score}${e.wallet === me ? ' <you' : ''}`) : ['No signed runs yet. Sign in and clear the Boss Rush or Hunt!'])]; }
      return [`< ${names[pool]} >   pool ${K.fmtK(n.pools[pool])} KIBBLE (demo)`, 'DEMO: rivals are simulated. Paid by rank: 50% / 30% / 20%.', ...rows]; },
    items: () => [{ label: `Board: ${tabs[tab]} (left/right)`, lr: (d) => (tab = (tab + d + 3) % 3), act: () => (tab = (tab + 1) % 3) },
      { label: 'Settle this period (sim)', sub: 'Awards the pool to the current top 3', act: async () => { const pool = tabs[tab]; const ranked = pool === 'monthly' ? cupRows().map((r) => ({ ...r, id: r.mine ? 'you' : r.tag, name: r.tag })) : boardRows(K.POOL_BOARDS[pool]);
        const out = K.awardPool(G.root, pool, ranked, pool); const mine = out.find((o) => o.id === 'you'); if (mine) G.net.wallet.balU += mine.amountU; saveNet(); await refreshWallet();
        toast(out.length ? `Paid ${out.map((o) => `#${o.rank} ${K.fmtK(o.amountU)}`).join(', ')}` : 'Pool is empty: buy a cosmetic to seed it', 3); } }, { label: 'Back', act: closeMenu }] });
}
// President's Vault (treasury) on Solscan: a real DOM <a> (#vaultLink) is shown over the canvas while these menus are open;
// the menu item also opens it (keyboard/gamepad users) and falls back to a toast with the URL if a popup is blocked.
const VAULT_MENUS = ['Pond Shop', 'Fighter Launches (stub)'];
const vaultItem = () => ({ label: `${K.VAULT_NAME} on Solscan  ${K.VAULT_SHORT}`, sub: 'Opens solscan.io in a new tab (or tap the gold link at the top).', act: () => { const w = window.open(K.VAULT_URL, '_blank', 'noopener'); if (!w) toast(K.VAULT_URL, 4); } });
function wishShop() {
  openMenu({ title: 'Pond Shop', info: () => [SIM(), 'Cosmetic only. Never changes stats. Price includes the 2%:', `1% to ${K.VAULT_NAME}, 0.25% daily / 0.5% weekly / 0.25% monthly pools.`, `${K.VAULT_NAME} ${K.VAULT_SHORT}  Balance ${K.fmtK(G.walletBal || 0)}`],
    items: () => [...K.WISH_SHOP.map((c) => { const q = K.quote(c.id), own = G.net.owned.includes(c.id); return { label: `${c.name}  ${own ? 'OWNED' : K.fmtK(q.total) + ' K'}`, sub: own ? 'Equip it in Cosmetics' : `incl. 2% (President's Vault ${K.fmtK(q.owner)}, pools ${K.fmtK(q.daily)}/${K.fmtK(q.weekly)}/${K.fmtK(q.monthly)})`, disabled: own,
      act: async () => { if (!K.getWallet().address && !(await ensureWallet())) return; const r = await K.buyWish(G.root, c.id); if (r.ok) { Audio8.sfx('orb'); toast(`Unlocked: ${c.name}${K.DEMO ? ' (demo)' : ''}`); saveNet(); await refreshWallet(); } else toast(r.reason); } }; }), vaultItem(), { label: 'Back', act: closeMenu }] });
}
function cosmeticsMenu() {
  const kinds = ['aura', 'bolt', 'beam', 'outfit', 'title'];
  const avail = (k) => ['', ...Object.keys(K.COSMETICS).filter((id) => K.COSMETICS[id].kind === k && (G.net.owned.includes(id) || K.unlockedByTier(G.holdU || 0).includes(id)))];
  const label = (k) => { const v = P().cosmetics[k]; return v && K.COSMETICS[v] ? K.COSMETICS[v].name : k === 'aura' ? 'Gold (default)' : k === 'beam' ? 'Cyan (default)' : k === 'bolt' ? 'Fireflies (default)' : k === 'outfit' ? 'Hoodie (default)' : 'none'; };
  openMenu({ title: 'Cosmetics', info: () => [`Holder tier: ${tier().name} (holdings ${K.fmtK(G.holdU || 0)} ${K.DEMO ? 'demo ' : ''}KIBBLE)`, 'Tiers: Pup 0, Hound 1k, Alpha 10k, Shogun 100k. Cosmetic only.'],
    items: () => [...kinds.map((k) => ({ label: `${k[0].toUpperCase() + k.slice(1)}: ${label(k)}  <>`, lr: (d) => { const l = avail(k), i = Math.max(0, l.indexOf(P().cosmetics[k] || '')); P().cosmetics[k] = l[(i + d + l.length) % l.length]; G.net.cos = { ...P().cosmetics }; saveNet(); }, act: () => {} })),
      { label: `Golden Lily: ${K.goldenOrbEligible(G.holdU || 0) ? (G.net.useGolden ? 'ON' : 'off') : 'locked (Alpha+)'}`, sub: 'Cosmetic. Restore the pond with it for a golden Pondo + a unique title.', act: () => { if (!K.goldenOrbEligible(G.holdU || 0)) return toast('Alpha tier or higher'); G.net.useGolden = !G.net.useGolden; saveNet(); } },
      { label: 'SIM: raise holdings (tier preview)', act: async () => { const w = K.getWallet(); w.s.holdU = w.s.holdU >= K.toU(100000) ? 0 : w.s.holdU < K.toU(1000) ? K.toU(1000) : w.s.holdU * 10; saveNet(); await refreshWallet(); toast(`Tier: ${tier().name}`); } }, { label: 'Back', act: closeMenu }] });
}
function packMenu() {
  const TAGS = ['', 'INU', 'SHIBA', 'POND', 'HOWL', 'KAI'];
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

// ---------------- Tournament of Paws (weekly 1v1 vs warrior ghosts) ----------------
const GHOST_NAMES = [['Mochi', 'cream', { str: 9, def: 4, vit: 5, enr: 4 }], ['Kuro', 'dark', { str: 5, def: 9, vit: 6, enr: 3 }], ['Hana', 'red', { str: 7, def: 5, vit: 7, enr: 5 }], ['Taro', 'tan', { str: 6, def: 6, vit: 6, enr: 6 }], ['Yuzu', 'gray', { str: 10, def: 3, vit: 4, enr: 7 }], ['Goma', 'dark', { str: 4, def: 7, vit: 9, enr: 4 }], ['Sora', 'cream', { str: 8, def: 6, vit: 4, enr: 6 }]];
function myGhost() { const src = storySave || C.load(STORE) || C.newPlayer(); return K.ghostSnapshot('you', 'Shiba (you)', { ...src, coat: 'golden' }); }
function tourneyEntrants() { return K.seedBracket([myGhost(), ...GHOST_NAMES.map(([n, coat, st]) => ({ ...K.ghostSnapshot('g_' + n.toLowerCase(), n + ' (ghost)', { stats: st, cosmetics: {} }), coat }))]); }
function tourneyDecide(a, b, week) { const T = G.tour; if (a.id !== 'you' && b.id !== 'you') return K.simMatch(a, b, week); const key = a.id + '|' + b.id; if (key in T.res) return T.res[key] === a.id ? a : b; if (!T.pending) T.pending = { key, opp: a.id === 'you' ? b : a }; return a.id === 'you' ? a : b; }
function startTourney() {
  storySave = G.p ? JSON.parse(JSON.stringify(G.p)) : null; if (G.mode === 'story' && G.p) saveGame(true);
  const p = STD_BUILD(); p.cosmetics = { ...(storySave?.cosmetics || G.net.cos || p.cosmetics) }; G.p = p; G.mode = 'tourney'; G.menu = null; G.state = 'play';
  G.run = { mode: 'tourney', t0: performance.now(), deaths: 0, week: K.weekId(Date.now()) }; G.tour = { week: G.run.week, ents: tourneyEntrants(), res: {}, round: 0 }; nextTourneyMatch();
}
function nextTourneyMatch() { const T = G.tour; T.pending = null; T.out = K.runBracket(T.ents, T.week, tourneyDecide);
  if (T.pending && !T.lost) { T.round++; C.init(P()); pl.stage = 0; enterArea('mountain', 20, 13); const o = T.pending.opp; const e = spawnEnemy('kitten', 20 * TILE, 6 * TILE); Object.assign(e, { type: 'ghost', ghost: o, coat: o.coat, hp: 260, max: 260, T: { r: 8, dmg: 12, xp: 0, bones: 0, speed: 60 }, kind: 'walk', kt: 0, dir: 0 });
    Audio8.music('boss'); G.banner = { text: `${['QUARTER', 'SEMI', ''][T.round - 1] || ''}FINAL vs ${o.name}`.replace('vs', 'VS'), t: 2.5 }; return; }
  const place = T.out.placements.findIndex((x) => x.id === 'you'); T.place = place < 0 ? 4 : place; finishTourney(); }
function tourneyResult(won) { const T = G.tour; if (!T?.pending) return; T.res[T.pending.key] = won ? 'you' : T.pending.opp.id; if (!won) T.lost = true; G.enemies.forEach((e) => (e.dead = true)); G.shots = [];
  toast(won ? 'Victory!' : 'Defeated...'); setTimeout(nextTourneyMatch, 900); }
function finishTourney() { const T = G.tour, out = T.out, n = G.net; n.tourney = { week: T.week, placements: out.placements.map((p) => p.name), place: T.place }; saveNet();
  const lbl = ['1st', '2nd', 'Top 4', 'Top 4', 'Top 8'][T.place]; Audio8.music('wish');
  openMenu({ title: 'Tournament of Paws', noBack: true, info: () => [`Your finish: ${lbl}`, ...out.rounds.map((r, i) => ['QF', 'SF', 'Final'][i] + ': ' + r.map((m) => m.w.replace('g_', '')).join(', ')), 'Ghost builds normalised to the same stat budget.'],
    items: [{ label: 'Return to story', act: () => endRun(true) }] }); }
function updateGhost(e, dt) { const dx = pl.x - e.x, dy = pl.y - e.y, d = Math.hypot(dx, dy) || 1; e.kt -= dt; e.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
  if (e.kb > 0) { e.kb -= dt; moveBody(e, e.vx * dt, e.vy * dt, 5, 3); return; } const st = e.ghost.stats, sp = 50 + st.enr * 1.5, guard = e.ghost.style === 'guard';
  if (e.kt <= 0) e.kind = 'walk';
  if (d > 20) { moveBody(e, dx / d * sp * dt, dy / d * sp * dt, 5, 3); e.moving = true; e.walk = (e.walk || 0) + dt; } else e.moving = false;
  if (d < 26 && e.cd < 0) { e.cd = guard ? 0.9 : 0.6; e.kind = Math.random() < 0.3 ? 'kick' : 'punch'; e.kt = 0.25; setTimeout(() => { if (!e.dead && Math.hypot(pl.x - e.x, pl.y - e.y) < 28) hurtPlayer(8 + st.str * 0.6, e.x, e.y); }, 120); }
  if (d > 70 && e.cd < -1.2) { e.cd = 1.4; e.kind = 'beam'; e.kt = 0.3; G.shots.push({ x: e.x, y: e.y - 12, vx: dx / d * 150, vy: dy / d * 150, r: 4, dmg: 10 + st.str * 0.4, t: 2, col: '#d0a0ff' }); Audio8.sfx('blast'); } }
function drawGhost(e, ox, oy) { const img = heroFrame(e.coat, 0, DIRS[e.dir], e.moving ? Math.floor(e.walk * 9) % 4 : 0, e.kind, { top: 'jacket_black', bottom: 'slacks_black', feet: 'sneakers_gold' });
  ctx.globalAlpha = 0.85; ctx.drawImage(img, Math.round(e.x - FORM_W / 2 - ox), Math.round(e.y - FORM_H + 2 - oy)); ctx.globalAlpha = 1; if (e.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; ctx.drawImage(img, Math.round(e.x - FORM_W / 2 - ox), Math.round(e.y - FORM_H + 2 - oy)); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  text(e.ghost.name, Math.round(e.x - ox), Math.round(e.y - FORM_H - 6 - oy), '#d0c0ff', 6, 'center'); R(e.x - 12 - ox, e.y - FORM_H - 12 - oy, 24, 3, '#1a1420'); R(e.x - 11 - ox, e.y - FORM_H - 11 - oy, Math.ceil(22 * e.hp / e.max), 1, '#d0a0ff'); }
function tourneyMenu() {
  openMenu({ title: 'Tournament of Paws', info: () => [SIM(), 'Free weekly 8-ghost bracket. You fight live; other matches use saved ghosts.', 'All builds normalised to the same stat budget. Pool split 50/25/12.5/12.5 by placement.', `Tourney pool (30% of weekly): ${K.fmtK(Math.floor(G.net.pools.weekly * 0.3))} KIBBLE`, G.net.tourney ? `Last: ${['1st', '2nd', 'Top 4', 'Top 4', 'Top 8'][G.net.tourney.place]} (week ${G.net.tourney.week})` : ''],
    items: [{ label: 'Enter this week (free)', act: startTourney }, { label: 'Settle tournament pool (sim)', act: async () => { const t = G.net.tourney; if (!t) return toast('Play this week first'); const amt = Math.floor(G.net.pools.weekly * 0.3), pl4 = t.placements.map((name, i) => ({ id: name.includes('you') ? 'you' : name, name })); const out = K.tourneyPayout(amt, pl4); G.net.pools.weekly -= out.reduce((a, o) => a + o.amountU, 0); const m = out.find((o) => o.id === 'you'); if (m) G.net.wallet.balU += m.amountU; saveNet(); await refreshWallet(); toast(out.length ? out.map((o) => `${o.name.split(' ')[0]} ${K.fmtK(o.amountU)}`).join(', ') : 'Pool empty', 3); } }, { label: 'Back', act: closeMenu }] });
}
function bountyContribs(b) { const mine = G.net.bounty?.[b.id] || {}, r = K.mulberry32(K.weekId(Date.now()) * 7 + b.goal), base = {}; ['Mochi', 'Kuro', 'Hana', 'Yuzu', 'Goma'].forEach((n) => (base['sim_' + n] = Math.floor(b.goal * (0.12 + r() * 0.07)))); return { ...base, ...mine }; }
function bountyMenu() {
  openMenu({ title: 'Cate Bounty Board', info: () => [SIM(), 'Community goals. When met, a pool share is split by contribution.', ...K.BOUNTIES.map((b) => { const c = bountyContribs(b), t = K.bountyTotal(c); return `${b.name}: ${t}/${b.goal} (you ${c.you || 0}) share ${b.shareBps / 100}% of weekly`; })],
    items: () => [...K.BOUNTIES.map((b) => ({ label: `Settle: ${b.name}`, act: async () => { const r = K.settleBounty(G.root, b, bountyContribs(b)); if (!r.ok) return toast(r.reason); const m = r.payouts.find((o) => o.id === 'you'); if (m) G.net.wallet.balU += m.amountU; saveNet(); await refreshWallet(); toast(`Paid ${r.payouts.length} contributors${m ? `, you ${K.fmtK(m.amountU)}` : ''}`, 3); } })), { label: 'Back', act: closeMenu }] });
}
function seasonMenu() { const now = Date.now(), se = K.currentSeason(now);
  openMenu({ title: 'Seasons', info: () => [SIM(), ...K.SEASONS.map((x) => { const a = K.seasonAccess(x, now, G.holdU || 0); return `${x.name}: ${a.open ? (a.early ? 'HOLDER EARLY ACCESS' : 'open') : 'closed'}`; }), 'Holders (Hound+) get a 2-day early-access weekend.'],
    items: () => [...se.set.map((id) => { const c = K.COSMETICS[id], own = G.net.owned.includes(id), q = K.feeSplit(K.toU(c.shop)); return { label: `${c.name} ${own ? 'OWNED' : K.fmtK(q.total) + ' K'}`, sub: 'Limited to ' + se.name, disabled: own, act: async () => { if (!K.getWallet().address && !(await ensureWallet())) return; const r = await K.buySeasonItem(G.root, id, now, G.holdU || 0); toast(r.ok ? 'Season item unlocked (sim)' : r.reason); saveNet(); await refreshWallet(); } }; }), { label: 'Back', act: closeMenu }] }); }
function burnMenu() {
  openMenu({ title: 'Burn for Legends', info: () => [SIM(), `${K.DEMO ? 'Your demo burns' : 'All Inu games, opt-in burns'}: ${K.fmtK(K.publicBurned(G.root))} KIBBLE`, `You burned: ${K.fmtK(G.net.burnedU || 0)}. OPTIONAL: burned KIBBLE is destroyed, nobody receives it.`],
    items: () => [...Object.entries(K.COSMETICS).filter(([, c]) => c.burn).map(([id, c]) => { const own = G.net.owned.includes(id); return { label: `${c.name}  ${own ? 'UNLOCKED' : 'burn ' + c.burn + ' K'}`, disabled: own, act: async () => { if (!K.getWallet().address && !(await ensureWallet())) return; const r = await K.burnForLegend(G.root, id); toast(r.ok ? `Burned ${K.fmtK(r.burnedU)}${K.DEMO ? ' (demo)' : ''}. Legend unlocked!` : r.reason); if (r.ok) { Audio8.sfx('ascend'); burst(pl.x, pl.y - 16, '#ff6a2a', 30, 90); } saveNet(); await refreshWallet(); } }; }), { label: 'Back', act: closeMenu }] });
}
function launchMenu() { const q = K.listingQuote();
  openMenu({ title: 'Fighter Launches (stub)', info: () => [SIM(), 'Launch Hall community tokens sponsor a warrior skin.', `Listing: ${K.LISTING_FEE} K fee to ${K.VAULT_NAME} (${K.VAULT_SHORT}) + 2% split = ${K.fmtK(q.total)} K`, ...(G.net.launches || []).slice(0, 3).map((l) => `${l.token} sponsors ${l.skin}: ${l.status}`), '$WOOF sponsors Kai Surf skin: live (sample)'],
    items: [{ label: 'List $PAWS sponsoring "Violet Fireflies"', act: async () => { if (!K.getWallet().address && !(await ensureWallet())) return; const r = await K.listFighter(G.root, { token: '$PAWS', skin: 'Violet Fireflies' }); toast(r.ok ? 'Listing submitted (stub)' : r.reason); saveNet(); await refreshWallet(); } }, vaultItem(), { label: 'Back', act: closeMenu }] }); }

// ---------------- title ----------------
function toTitle() { G.state = 'title'; G.mode = 'story'; G.menu = null; G.dialog = null; Audio8.music('title'); titleMenu(); }
function titleMenu() {
  G.menu = null; const has = !!C.load(STORE);
  openMenu({ title: '', titleScreen: true, noBack: true, items: () => [...(has ? [{ label: 'Continue', act: () => { G.menu = null; continueGame(); } }] : []), { label: 'New Game', act: () => { G.menu = null; newGame(); } }, { label: 'Pond Network', act: () => { G.p = G.p || C.init(C.newPlayer()); networkMenu(); } }] });
}

// ---------------- main update ----------------
function update(dt) {
  if (G.freeze) return;
  G.t += dt; if (G.toast && (G.toast.t -= dt) <= 0) G.toast = null; if (G.banner && (G.banner.t -= dt) <= 0) G.banner = null; G.shake = Math.max(0, G.shake - dt);
  if (pressed.mute) toast(Audio8.toggleMute() ? 'Muted' : 'Sound on');
  for (const p of G.parts) { p.x += p.vx * dt; p.y += p.vy * dt; if (p.g) p.vy += p.g * dt; p.life -= dt; } G.flash = Math.max(0, (G.flash || 0) - dt * 2.6); for (const c of G.craters) c.t += dt; G.craters = G.craters.filter((c) => c.t < 5);
  if (G.state !== 'title' && G.area) updateNPCs(dt); G.parts = G.parts.filter((p) => p.life > 0);
  for (const f of G.floats) { f.y -= 22 * dt; f.t -= dt; } G.floats = G.floats.filter((f) => f.t > 0);
  if (G.fadeTo) { G.fade += dt * 4; if (G.fade >= 1) { const ex = G.fadeTo; G.fadeTo = null; enterArea(ex.to, ex.tx, ex.ty); } return; } else if (G.fade > 0) G.fade = Math.max(0, G.fade - dt * 4);
  if (G.menu) return updateMenu(dt);
  if (G.dialog) return updateDialog(dt);
  if (G.state === 'wish') return updateWish(dt);
  if (G.state === 'cut') return updateCut(dt);
  if (G.state !== 'play') return;
  if (pressed.menu || pressed.back) return pauseMenu();
  P().playTime += dt;
  updatePlayer(dt); updateEnemies(dt); updateBoss(dt); updateShots(dt); updatePickups();
  if (G.mode === 'story' && G.area.id === 'mountain' && !P().flags.cateDown && !G.boss && pl.y < 15 * TILE) startBoss(true);
}

// ---------------- render ----------------
function heroImg() {
  const c = P().cosmetics, oc = K.COSMETICS[c.outfit], eq = oc?.equip || HERO_EQ.hoodie, face = DIRS[pl.dir];
  const kind = pl.atk > 0 ? (pl.combo === 2 ? 'kick' : 'punch') : 'walk'; // no power-up crouch or two-handed beam pose
  return heroFrame('golden', pl.stage, face, kind === 'walk' && pl.moving ? Math.floor(pl.walk * 9) % 4 : 0, kind, eq);
}
// Unleash glow: soft ripple rings on the ground at the feet + a faint coat shimmer (no flame column).
function drawAura(cx, fy, stage, col, k = 1) {
  ctx.strokeStyle = col; ctx.lineWidth = 1;
  for (let i = 0; i < stage + 1; i++) { const ph = (G.t * 0.9 + i / (stage + 1)) % 1, rx = (8 + ph * (10 + stage * 4)) * k; ctx.globalAlpha = 0.55 * (1 - ph); ctx.beginPath(); ctx.ellipse(cx, fy, rx, rx * 0.32, 0, 0, 6.283); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
// fireflies drifting around the hero (holder 'bolt' cosmetics tint them)
function drawBolts(cx, fy, n, k = 1, tint) {
  const bc = tint || boltColor();
  for (let b = 0; b < n + 1; b++) { const a = G.t * (0.8 + b * 0.23) + b * 2.1, x = cx + Math.cos(a) * 14 * k, y = fy - 16 + Math.sin(a * 1.7) * 10 * k; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(G.t * 6 + b); R(x, y, 1, 1, '#ffffff'); R(x - 1, y, 3, 1, bc); R(x, y - 1, 1, 3, bc); }
  ctx.globalAlpha = 1;
}
function line(x0, y0, x1, y1, c) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0; ctx.fillStyle = c; for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / (n || 1)), Math.round(y0 + (y1 - y0) * i / (n || 1)), 1, 1); }
const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
function text(s, x, y, col = '#fff', size = 8, align = 'left', shadow = '#1a1420') { drawText(ctx, s, x, y, col, size >= 14 ? 2 : 1, align, shadow); }
function wrap(s, maxW) { const out = []; let line = ''; for (const w of String(s).split(' ')) { const t = line ? line + ' ' + w : w; if (measure(t) > maxW && line) { out.push(line); line = w; } else line = t; } if (line) out.push(line); return out; }
function panel(x, y, w, h) { R(x, y, w, h, '#1a1420'); R(x + 1, y + 1, w - 2, h - 2, '#f6e7c8'); R(x + 2, y + 2, w - 4, h - 4, '#2b2440'); R(x + 3, y + 3, w - 6, 1, '#d8a050'); } // kibble-gold accent line
// tiny 5x5 pawprint (Inu UI accent)
function paw(x, y, col) { R(x + 1, y + 2, 3, 3, col); R(x, y, 1, 1, col); R(x + 2, y - 1, 1, 1, col); R(x + 4, y, 1, 1, col); }
function drawWorld() {
  const a = G.area, sx = G.shake > 0 ? Math.round((Math.random() - 0.5) * 6 * G.shake * 5) : 0, sy = G.shake > 0 ? Math.round((Math.random() - 0.5) * 6 * G.shake * 5) : 0;
  // Camera follows the hero's ROUNDED position with an integer half-view, so hero-vs-camera rounding can never disagree.
  // Before: round(pl.x - VW/2) with odd VW rounded opposite to round(pl.x) every other frame => hero wobbled 1 art px (3-6 CSS px) while walking.
  const cx = Math.max(0, Math.min(a.w * TILE - VW, Math.round(pl.x) - (VW >> 1))) - sx, cy = Math.max(0, Math.min(a.h * TILE - VH, Math.round(pl.y) - 12 - (VH >> 1))) - sy;
  const ox = a.w * TILE < VW ? -Math.floor((VW - a.w * TILE) / 2) : cx, oy = a.h * TILE < VH ? -Math.floor((VH - a.h * TILE) / 2) : cy; G.cam = { x: ox, y: oy };
  R(0, 0, VW, VH, '#1a1420');
  const x0 = Math.max(0, Math.floor(ox / TILE)), y0 = Math.max(0, Math.floor(oy / TILE)), x1 = Math.min(a.w - 1, Math.ceil((ox + VW) / TILE)), y1 = Math.min(a.h - 1, Math.ceil((oy + VH) / TILE) + 1);
  const depth = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const ch = a.t[y][x], set = A.tiles[ch] || A.tiles['.']; const v = ch === '~' ? Math.floor(G.t * 2 + x) % 2 : (x * 7 + y * 13) % set.length;
    ctx.drawImage(set[v], x * TILE - ox, y * TILE - oy); if (A.TALL[ch]) depth.push({ y: y * TILE + 15, f: () => { const img = A.tall[A.TALL[ch]]; ctx.drawImage(img, x * TILE + 8 - img.width / 2 - ox, y * TILE + 6 - img.height - oy + (ch === 'P' ? 6 : 0)); } }); }
  for (const c of G.craters) { const k = Math.min(1, c.t / 0.25), fade = Math.min(1, (5 - c.t) / 1.5); ctx.globalAlpha = 0.55 * fade; ctx.fillStyle = '#3a2a1e'; ctx.beginPath(); ctx.ellipse(Math.round(c.x - ox), Math.round(c.y - oy), c.r * k, c.r * k * 0.38, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#c8b090'; ctx.lineWidth = 1; ctx.stroke(); if (c.t < 0.6) { ctx.globalAlpha = 1 - c.t / 0.6; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(Math.round(c.x - ox), Math.round(c.y - oy), c.r * 0.5 + c.t * 120, (c.r * 0.5 + c.t * 120) * 0.38, 0, 0, 7); ctx.stroke(); } ctx.globalAlpha = 1; }
  const shadow = (x, y, w = 7) => { ctx.fillStyle = 'rgba(20,20,30,.3)'; ctx.beginPath(); ctx.ellipse(Math.round(x - ox), Math.round(y - oy), w, 2.5, 0, 0, 7); ctx.fill(); };
  for (const n of a.npcs) depth.push({ y: n.y * TILE, f: () => { const x = n.x * TILE, y = n.y * TILE; shadow(x, y); const fr = n.moving ? Math.floor(n.walk * 7) % 4 : 0, spark = n.spark && pl.stage > 0 && Math.hypot(x - pl.x, y - pl.y) < 100;
    if (spark) { drawAura(x - ox, y - oy, 1, '#9ff0ff', 0.75); if (Math.random() < 0.3) drawBolts(x - ox, y - oy, 1, 0.8, '#7fd0ff'); }
    const img = n.human ? A.humans[n.human + (spark ? '_spark' : '')][fr] : shibaSprite(n.coat, n.face, fr, n.eq); ctx.drawImage(img, Math.round(x - img.width / 2 - ox), Math.round(y - img.height + 1 - oy));
    if (Math.hypot(x - pl.x, y - pl.y) < 30 && !G.dialog) { const bob = Math.floor(G.t * 3) % 2; R(x - ox - 1, y - 38 - oy - bob, 3, 5, '#ffe066'); R(x - ox - 1, y - 32 - oy - bob, 3, 2, '#ffe066'); } } });
  if (G.mode === 'story') for (const it of a.pickups) if (!P().flags['got_' + it.key]) depth.push({ y: it.y * TILE, f: () => { const bob = Math.round(Math.sin(G.t * 4) * 2), x = it.x * TILE - ox, y = it.y * TILE - oy; shadow(it.x * TILE, it.y * TILE, 5);
    if (it.kind === 'orb') { ctx.globalAlpha = 0.35 + Math.sin(G.t * 5) * 0.15; R(x - 9, y - 18 + bob, 18, 18, '#b6ffb0'); ctx.globalAlpha = 1; ctx.drawImage(A.orbs[it.n - 1], Math.round(x - 7), Math.round(y - 16 + bob)); } else ctx.drawImage(A.chest, Math.round(x - 8), Math.round(y - 13)); } });
  if (G.mode === 'hunt') for (const o of G.hunt.orbs) if (o.area === a.id && !G.hunt.got.includes(o.id)) depth.push({ y: o.y * TILE, f: () => { const bob = Math.round(Math.sin(G.t * 4) * 2), x = o.x * TILE - ox, y = o.y * TILE - oy; ctx.globalAlpha = 0.5; R(x - 9, y - 18 + bob, 18, 18, `hsl(${(G.t * 200 + o.n * 50) % 360},100%,70%)`); ctx.globalAlpha = 1; ctx.drawImage(A.orbs[o.n - 1], Math.round(x - 7), Math.round(y - 16 + bob)); } });
  for (const d of G.drops) depth.push({ y: d.y, f: () => ctx.drawImage(A.bone, Math.round(d.x - 6 - ox), Math.round(d.y - 8 - oy)) });
  for (const e of G.enemies) if (e.type === 'ghost') depth.push({ y: e.y, f: () => drawGhost(e, ox, oy) }); else depth.push({ y: e.y, f: () => { const fr = A[e.T.art][Math.floor(e.t * 6) % 2], wind = e.st === 'wind'; shadow(e.x, e.y, e.T.r);
    ctx.drawImage(fr, Math.round(e.x - fr.width / 2 - ox + (wind ? Math.round(Math.random() * 2 - 1) : 0)), Math.round(e.y - fr.height + 2 - oy));
    if (e.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7; ctx.drawImage(fr, Math.round(e.x - fr.width / 2 - ox), Math.round(e.y - fr.height + 2 - oy)); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    if (e.hp < e.max) { R(e.x - 8 - ox, e.y - fr.height - 3 - oy, 16, 3, '#1a1420'); R(e.x - 7 - ox, e.y - fr.height - 2 - oy, Math.ceil(14 * e.hp / e.max), 1, '#ff5f6d'); } } });
  const b = G.boss; if (b && b.st !== 'down') depth.push({ y: b.y, f: () => { const crouch = b.st === 'pounce' && b.t < 0.7, rage = b.hp < b.max / 2; const fr = A.cate[(rage ? 2 : 0) + (crouch ? 1 : Math.floor(b.t * 5) % 2)]; shadow(b.x, b.y, 20);
    ctx.drawImage(fr, Math.round(b.x - 32 - ox), Math.round(b.y - 56 - oy)); if (b.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; ctx.drawImage(fr, Math.round(b.x - 32 - ox), Math.round(b.y - 56 - oy)); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    if (crouch) text('!', b.x - ox, b.y - 70 - oy, '#ff5f6d', 14, 'center'); } });
  depth.push({ y: pl.y, f: drawHero });
  depth.sort((p, q) => p.y - q.y).forEach((d) => d.f());
  for (const s of G.shots) { const x = Math.round(s.x - ox), y = Math.round(s.y - oy); if (s.mine) { const a = Math.atan2(s.vy, s.vx); ctx.strokeStyle = s.col; ctx.lineWidth = 1; for (let k = 0; k < 3; k++) { ctx.globalAlpha = 1 - k * 0.3; ctx.beginPath(); ctx.arc(x - Math.cos(a) * k * 4, y - Math.sin(a) * k * 4, s.r + 2 - k, a - 0.9, a + 0.9); ctx.stroke(); } ctx.globalAlpha = 1; } else if (s.rock) { R(x - 3, y - 3, 6, 6, '#38342f'); R(x - 2, y - 2, 4, 4, '#a39e96'); } else { R(x - 4, y - 3, 8, 6, '#7a1f4f'); R(x - 3, y - 4, 6, 8, '#7a1f4f'); R(x - 3, y - 2, 6, 4, s.col); R(x - 2, y - 2, 2, 2, '#fff'); } }
  for (const p of G.parts) { ctx.globalAlpha = Math.min(1, p.life * 3); R(p.x - ox, p.y - oy, p.s, p.s, p.col); } ctx.globalAlpha = 1;
  for (const f of G.floats) text(f.text, Math.round(f.x - ox), Math.round(f.y - oy), f.col, 8, 'center');
  if (G.state === 'wish') drawWish(ox, oy);
  if (pl.stage >= 3) { ctx.globalAlpha = 0.07 + 0.06 * Math.sin(G.t * 6); ctx.fillStyle = '#ffb320'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; } // Primal screen pulse
  if (G.state === 'cut' && !G.cut.flashed) { ctx.globalAlpha = Math.min(0.35, G.cut.t * 0.35); ctx.fillStyle = '#100818'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
  if (G.flash > 0) { ctx.globalAlpha = Math.min(1, G.flash); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
}
function drawHero() {
  const { x: ox, y: oy } = G.cam, img = heroImg(), [fx, fy] = DV[pl.dir], lunge = pl.atk > 0 ? 2 : 0;
  const shakeX = G.state === 'cut' && !G.cut.flashed ? Math.round(Math.random() * 2 - 1) : 0;
  const rx = Math.round(pl.x), ry = Math.round(pl.y), x = rx - Math.round(FORM_W / 2) - ox + fx * lunge + shakeX, y = ry - FORM_H + 2 - oy + fy * lunge, feetX = rx - ox, feetY = ry - oy;
  window.__camDbg = { x: -ox * SCALE / DPR, y: -oy * SCALE / DPR, px: x * SCALE / DPR, py: y * SCALE / DPR }; // jitter probe (CSS px)
  ctx.fillStyle = 'rgba(20,20,30,.3)'; ctx.beginPath(); ctx.ellipse(feetX, feetY, 7, 2.5, 0, 0, 7); ctx.fill();
  const cut = G.state === 'cut' ? G.cut : null, st = cut ? (cut.flashed ? cut.stage : Math.max(1, cut.stage - 1)) : pl.stage;
  if (st > 0 || pl.charge) drawAura(feetX, feetY, Math.max(1, st), auraColor(), cut && !cut.flashed ? 0.6 + cut.t * 0.6 : pl.charge && !st ? 0.7 : 1);
  if (pl.inv > 0 && Math.floor(G.t * 20) % 2) ctx.globalAlpha = 0.4; ctx.drawImage(img, x, y); ctx.globalAlpha = 1;
  if (pl.dash > 0) { ctx.globalAlpha = 0.3; ctx.drawImage(img, x - fx * 8, y - fy * 8); ctx.globalAlpha = 1; }
  if (st >= 2 || (cut && !cut.flashed && cut.t > 0.4)) drawBolts(feetX, feetY, st >= 3 ? 4 : 2, st >= 3 ? 1.4 : 1);
  if (pl.beamT > 0) { const hx = feetX + fx * 12, hy = feetY - 14 + fy * 8, r = 3 + Math.round(Math.sin(G.t * 40)); ctx.fillStyle = beamColor(); ctx.fillRect(hx - r, hy - r, r * 2, r * 2); ctx.fillStyle = '#fff'; ctx.fillRect(hx - 1, hy - 1, 2, 2); }
  if (pl.atk > 0) { const el = 1 - pl.atk / (pl.combo === 2 ? 0.3 : 0.2), hx = feetX + fx * (14 + el * 4), hy = feetY - (pl.combo === 2 ? 6 : 12) + fy * 10;
    ctx.fillStyle = st ? '#fff3a8' : '#ffffff'; for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + G.t * 20, r = 2 + el * (pl.combo === 2 ? 9 : 6); ctx.fillRect(Math.round(hx + Math.cos(a) * r), Math.round(hy + Math.sin(a) * r * 0.7), 2, 1); } }
  const t = P().cosmetics.title && K.COSMETICS[P().cosmetics.title]; if (t) text(t.name, feetX, y - 2, '#ffe066', 6, 'center');
}
let _gt = null; function goldToad() { if (_gt) return _gt; _gt = A.toad.map((src) => { const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const g = c.getContext('2d'); g.drawImage(src, 0, 0); const d = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) { const [r, gg, b] = [d.data[i], d.data[i + 1], d.data[i + 2]]; if (r > b + 30 && gg > b + 20) { const l = (r + gg) / 510; d.data[i] = Math.min(255, 255 * (0.6 + l * 0.6)); d.data[i + 1] = Math.min(255, 210 * (0.45 + l * 0.7)); d.data[i + 2] = 50 * l; } } g.putImageData(d, 0, 0); return c; }); return _gt; }
// Pond restoration: the dry basin fills with water, the 5 lilies settle on it, and Pondo hops in from the side.
function drawWish(ox, oy) {
  const w = G.wish, fill = w.phase === 'rise' ? Math.min(1, w.t / 1.6) : 1, fade = w.phase === 'leave' ? Math.max(0, 1 - w.t / 1.6) : 1;
  const bx = 20 * TILE - ox, by = 5.6 * TILE - oy;
  ctx.globalAlpha = 0.85 * fade; ctx.fillStyle = '#3b8bd4'; ctx.beginPath(); ctx.ellipse(bx, by, 64 * fill, 24 * fill, 0, 0, 6.283); ctx.fill();
  ctx.strokeStyle = '#9fd8ff'; for (let i = 0; i < 3; i++) { const ph = (G.t * 0.5 + i / 3) % 1; ctx.globalAlpha = 0.6 * (1 - ph) * fade * fill; ctx.beginPath(); ctx.ellipse(bx, by, 64 * fill * ph, 24 * fill * ph, 0, 0, 6.283); ctx.stroke(); }
  ctx.globalAlpha = fade; const N = C.LILY_COUNT; for (let i = 0; i < N; i++) { const a = i / N * 6.283 + G.t * 0.2, r = 46 * fill; ctx.drawImage(A.orbs[i], Math.round(bx - 7 + Math.cos(a) * r), Math.round(by - 9 + Math.sin(a) * r * 0.36)); }
  const hop = w.phase === 'rise' ? Math.max(0, (w.t - 1.4) / 1.0) : 1; if (hop <= 0) { ctx.globalAlpha = 1; return; }
  const img = (w.golden ? goldToad() : A.toad)[Math.floor(G.t * 0.7) % 4 === 0 ? 1 : 0], k = Math.min(1, hop), tx = bx + 150 * (1 - k) - 60, ty = by - 72 - Math.abs(Math.sin(k * Math.PI * 2)) * 18 * (1 - k);
  ctx.drawImage(img, Math.round(tx), Math.round(ty)); ctx.globalAlpha = 1;
}
let _rxT = -1, _rx = 0;
function hudRightInset() { // keep orbs/bones/timer clear of DOM overlays in the top-right (menu button, shared kibble-pay wallet / home widgets)
  if (VW <= VH) return 0;
  if (G.t - _rxT > 1 || _rxT < 0) { _rxT = G.t; const cr = cv.getBoundingClientRect(); let left = cr.right;
    for (const id of ['menuBtn', 'inu-wallet', 'inu-home']) { const el = document.getElementById(id); if (!el || !el.offsetParent && getComputedStyle(el).position !== 'fixed') continue; const r = el.getBoundingClientRect();
      if (r.width && r.top < cr.top + 44 && r.left > cr.left + cr.width / 2) left = Math.min(left, r.left); }
    _rx = Math.max(0, Math.ceil((cr.right - left + 4) * DPR / SCALE)); }
  return _rx;
}
function drawHUD() {
  const p = P(), d = D(), bx = 6, by = 6, rx = hudRightInset();
  panel(bx, by, 118, 34); text(`Lv ${p.level}`, bx + 6, by + 5, '#ffe066', 8); paw(bx + 106, by + 5, '#d8a050');
  const bar = (y, v, max, c1, c2, label) => { R(bx + 32, y, 80, 7, '#1a1420'); R(bx + 33, y + 1, Math.max(0, Math.round(78 * Math.min(1, v / max))), 5, c1); R(bx + 33, y + 1, Math.max(0, Math.round(78 * Math.min(1, v / max))), 1, c2); text(label, bx + 6, y - 1, '#fff', 7); };
  bar(by + 15, p.hp, d.maxHp, '#ff5f6d', '#ffb0b8', 'HP'); bar(by + 24, p.energy, d.maxEnergy, pl.ascend ? '#ffe066' : '#5cc8ff', '#ffffff', pl.stage ? 'A' + pl.stage : 'EN');
  R(bx + 33, by + 12, Math.round(78 * p.xp / C.xpToNext(p.level)), 1, '#9effa0');
  if (G.mode === 'hunt') { for (let i = 0; i < C.LILY_COUNT; i++) { ctx.globalAlpha = i < G.hunt.got.length ? 1 : 0.25; ctx.drawImage(A.orbs[i], VW - 80 - rx + i * 14, 8); } ctx.globalAlpha = 1; }
  else if (G.mode === 'story') { for (let i = 0; i < C.LILY_COUNT; i++) { ctx.globalAlpha = p.orbs.includes('orb' + (i + 1)) ? 1 : 0.22; ctx.drawImage(A.orbs[i], VW - 80 - rx + i * 14, 8); } ctx.globalAlpha = 1; text(`${p.bones} bones`, VW - 8 - rx, 24, '#fff4e0', 7, 'right'); ctx.drawImage(A.bone, Math.round(VW - 8 - rx - measure(`${p.bones} bones`) - 15), 23); }
  if (G.run) text(`${G.mode === 'rush' ? 'BOSS RUSH' : G.mode === 'tourney' ? 'TOURNEY' : 'HUNT'}  ${fmtTime(performance.now() - G.run.t0)}  deaths ${G.run.deaths}`, VW - 8 - rx, G.mode === 'hunt' ? 24 : 8, '#ffe066', 8, 'right');
  const b = G.boss; if (b && b.st !== 'intro' && b.st !== 'down') { const w = Math.min(220, VW - 40), x = (VW - w) / 2, y = VH - 18; R(x - 1, y - 1, w + 2, 9, '#1a1420'); R(x, y, Math.round(w * b.hp / b.max), 7, '#d8a050'); R(x, y, Math.round(w * b.hp / b.max), 2, '#f6e0b0'); text('CATE', x, y - 10, '#f6e0b0', 8); }
}
function drawDialog() {
  const d = G.dialog, [name, line] = d.lines[d.i], w = Math.min(VW - 12, 360), h = 56, x = Math.floor((VW - w) / 2), y = VH - h - 6;
  panel(x, y, w, h); if (name) { panel(x + 6, y - 12, Math.min(140, name.length * 6 + 14), 15); text(name, x + 13, y - 8, '#ffe066', 8); }
  wrap(line.slice(0, Math.floor(d.ch)), w - 20, 8).slice(0, 4).forEach((l, i) => text(l, x + 10, y + 9 + i * 11, '#fff8e8', 8));
  if (d.ch >= line.length && Math.floor(G.t * 3) % 2) R(x + w - 12, y + h - 10, 5, 3, '#ffe066');
}
function drawMenu() {
  const m = G.menu, items = m._items || (typeof m.items === 'function' ? m.items() : m.items); const info = m.info ? m.info().filter(Boolean).flatMap((l) => wrap(l, Math.min(VW - 12, 330) - 20)) : [];
  if (m.titleScreen) { const w = 130, x = Math.floor((VW - w) / 2), y = Math.min(VH - 60, G.titleMenuY || Math.floor(VH * 0.62)); items.forEach((it, i) => { const sel = i === m.sel; text((sel ? '> ' : '  ') + it.label, x + 10, y + i * 13, sel ? '#ffe066' : '#fff', 9); }); return; }
  const w = Math.min(VW - 12, 330), lineH = 12, h = 22 + info.length * 10 + items.length * lineH + (items[m.sel]?.sub ? 20 : 6), x = Math.floor((VW - w) / 2), y = Math.max(4, Math.floor((VH - h) / 2));
  ctx.fillStyle = 'rgba(10,8,20,.55)'; ctx.fillRect(0, 0, VW, VH); panel(x, y, w, h); text(m.title, x + 10, y + 7, '#ffe066', 9);
  if (G.shiba && /Pond Network|clear!|complete!/.test(m.title)) { G.shibaC ||= G.shiba.canvas(1); const c = G.shibaC; ctx.drawImage(c, x + w - c.width - 6, y + 4); text(G.shiba.profile.name, x + w - 6 - c.width / 2, y + 8 + c.height, '#ffe066', 6, 'center'); } // your Inu Verse Shiba (shared profile)
  info.forEach((l, i) => text(l, x + 10, y + 20 + i * 10, /^(DEMO|KIBBLE launching|LIVE)/.test(l) ? '#ff9ac8' : '#cfc6e6', 7));
  const iy = y + 22 + info.length * 10; items.forEach((it, i) => { const sel = i === m.sel; if (sel) R(x + 5, iy + i * lineH - 2, w - 10, lineH, '#4a4068'); text((sel ? '> ' : '  ') + it.label, x + 10, iy + i * lineH, it.disabled ? '#8a84a0' : sel ? '#ffe066' : '#fff8e8', 8); });
  const sub = items[m.sel]?.sub; if (sub) wrap(sub, w - 20, 7).slice(0, 2).forEach((l, i) => text(l, x + 10, iy + items.length * lineH + 3 + i * 9, '#9effa0', 7));
}
const stars = Array.from({ length: 70 }, (_, i) => [(i * 97) % 997 / 997, (i * 61) % 613 / 613, i % 3]);
function drawTitle() {
  const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#1c1440'); g.addColorStop(0.6, '#6a2c70'); g.addColorStop(1, '#f08a5d'); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  for (const [sx, sy, s] of stars) if ((G.t * 2 + sx * 10) % 3 > 0.4) R(sx * VW, sy * VH * 0.6, s ? 1 : 2, s ? 1 : 2, '#fff8e8');
  ctx.fillStyle = '#3a1f4a'; ctx.beginPath(); ctx.moveTo(0, VH); for (let x = 0; x <= VW; x += 8) ctx.lineTo(x, VH * 0.72 - Math.abs(Math.sin(x / 47)) * 40 - (x > VW * 0.4 && x < VW * 0.6 ? 30 - Math.abs(x - VW / 2) / 3 : 0)); ctx.lineTo(VW, VH); ctx.fill();
  const toad = A.toad[Math.floor(G.t) % 5 === 0 ? 1 : 0]; ctx.globalAlpha = 0.9; ctx.drawImage(toad, Math.round(VW / 2 - 60), Math.round(VH * 0.06 - 14 + Math.sin(G.t * 1.5) * 3)); ctx.globalAlpha = 1;
  const ty = Math.round(VH * 0.06 + 70); const sz = Math.min(34, Math.floor(VW / 8));
  const ls = Math.max(2, Math.min(5, Math.floor(VW / 60))); drawText(ctx, GAME_TITLE.toUpperCase(), VW / 2, ty, '#ffe066', ls, 'center', '#1a1420', true);
  drawText(ctx, GAME_SUBTITLE.toUpperCase(), VW / 2, ty + 9 * ls + 2, '#e0a060', Math.max(1, ls - 2), 'center', '#1a1420', true); void sz; { const tgY = ty + 9 * ls + 9 * Math.max(1, ls - 2) + 6; text('AN INU PACK ADVENTURE  -  $KIBBLE COSMETICS', VW / 2, tgY, '#f6c94c', 7, 'center'); paw(VW / 2 - measure('AN INU PACK ADVENTURE  -  $KIBBLE COSMETICS') / 2 - 10, tgY, '#f6c94c'); paw(VW / 2 + measure('AN INU PACK ADVENTURE  -  $KIBBLE COSMETICS') / 2 + 4, tgY, '#f6c94c'); G.titleMenuY = tgY + 14; }
  for (let i = 0; i < 9; i++) { const px2 = Math.round(VW * 0.24 + i * VW * 0.055), py2 = Math.round(VH * 0.8 + (i % 2 ? 3 : -3)); if ((G.t * 3 - i) % 12 > 0) paw(px2, py2, 'rgba(26,20,32,.45)'); } // pawprint trail
  const hero = heroFrame('golden', Math.floor(G.t / 2.5) % 4, 'right', Math.floor(G.t * 8) % 4, 'walk', HERO_EQ.hoodie); { const st = Math.floor(G.t / 2.5) % 4; if (st) drawAura(Math.round(VW * 0.18) + 16, Math.round(VH * 0.8), st, STAGES[st].aura); ctx.drawImage(hero, Math.round(VW * 0.18), Math.round(VH * 0.8) - FORM_H + 2); if (st >= 2) drawBolts(Math.round(VW * 0.18) + 16, Math.round(VH * 0.8), 2); }
  const cate = A.cate[Math.floor(G.t * 4) % 2]; ctx.drawImage(cate, Math.round(VW * 0.82) - 32, Math.round(VH * 0.8) - 56);
  if (Math.floor(G.t * 2) % 2) text(document.body.classList.contains('touch') ? 'Tap to start' : 'Press J / tap to start', VW / 2, VH - 14, '#fff8e8', 7, 'center');
  text('Original game. Pond Network features are simulated in demo mode.', VW / 2, VH - 24, '#e8c8e8', 6, 'center', null);
}
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false; ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  if (G.state === 'title') drawTitle(); else { drawWorld(); drawHUD(); }
  if (G.banner) { const a = Math.min(1, G.banner.t * 2); ctx.globalAlpha = a; const w = Math.min(VW - 20, G.banner.text.length * 7 + 30); panel((VW - w) / 2, VH * 0.2, w, 20); text(G.banner.text, VW / 2, VH * 0.2 + 6, '#ffe066', 9, 'center'); ctx.globalAlpha = 1; }
  if (G.dialog) drawDialog();
  if (G.menu) drawMenu();
  if (G.toast) { const ls = wrap(G.toast.msg, VW - 40).slice(0, 4), w = Math.min(VW - 20, Math.max(...ls.map((l) => measure(l))) + 20), h = 8 + ls.length * 10, y = VH - h - 10; // long wallet errors wrap instead of running off-screen
    panel((VW - w) / 2, y, w, h); ls.forEach((l, i) => text(l, VW / 2, y + 4 + i * 10, '#fff8e8', 7, 'center')); }
  if (G.fade > 0) { ctx.fillStyle = `rgba(10,8,20,${G.fade})`; ctx.fillRect(0, 0, VW, VH); }
}
// ---------------- loop ----------------
let last = performance.now();
function frame(now) { const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; try { update(dt); render(); } catch (e) { console.error(e); window.__pbErr = String(e.stack || e); } for (const k in pressed) pressed[k] = false; requestAnimationFrame(frame); }
resize(); toTitle(); requestAnimationFrame(frame);
cv.addEventListener('pointerdown', (e) => { Audio8.unlock(); if (G.state === 'title' && G.menu?.titleScreen) {
  const r = cv.getBoundingClientRect(), gy = (e.clientY - r.top) * DPR / SCALE, y0 = Math.min(VH - 60, G.titleMenuY || Math.floor(VH * 0.62)), m = G.menu, n = (m._items || (typeof m.items === 'function' ? m.items() : m.items)).length, i = Math.floor((gy - y0 + 3) / 13);
  if (i >= 0 && i < n) m.sel = i; press('atk'); setTimeout(() => release('atk'), 50); } });
setInterval(() => { document.body.classList.toggle('title', G.state === 'title'); document.body.classList.toggle('vault', !!G.menu && VAULT_MENUS.includes(G.menu.title)); }, 150);
G.enterArea = enterArea; G.stepCut = updateCut; G.startTourney = startTourney; G.tourneyResult = tourneyResult; G.startTransform = startTransform; G.STAGES = STAGES; G.heroFrame = heroFrame; G.startBoss = startBoss; G.saveGame = saveGame; G.giveOrb = giveOrb; G.LILY_COUNT = C.LILY_COUNT; G.GAME_TITLE = GAME_TITLE;
// 🏠 Back to Inu Verse hooks (kibble-pay mountHome): confirm mid-match, save first.
globalThis.__inuHome = { busy: () => G.state !== 'title' ? 'Go back to Inu Verse? Your story is saved first.' : false, save: () => { try { saveGame(true); } catch {} } };
