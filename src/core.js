// Core rules (game title lives in config.js): pure logic shared by the game and node tests (no DOM).
export const SAVE_KEY = 'pepeballz.save.v1';
export const ITEMS = {
  bone:  { name: 'Bone Biscuit', desc: 'Restores 40 HP', heal: 40, price: 15 },
  jerky: { name: 'Hero Jerky', desc: 'Restores 120 HP', heal: 120, price: 40 },
  tea:   { name: 'Lily Tea', desc: 'Restores 60 energy', energy: 60, price: 25 },
  fang:  { name: 'Lucky Fang', desc: 'Pond relic: +6 STR', passive: { str: 6 } },
};
export const xpToNext = (level) => Math.floor(20 * Math.pow(level, 1.5));
export function newPlayer() {
  return { level: 1, xp: 0, points: 0, stats: { str: 5, def: 4, vit: 5, enr: 5 }, hp: 0, energy: 0,
    inventory: { bone: 3, tea: 1 }, bones: 0, orbs: [], wishes: 0, deaths: 0, playTime: 0,
    area: 'village', x: 20 * 16 + 8, y: 18 * 16, flags: {}, cosmetics: { owned: [], aura: 'gold', beam: 'cyan', outfit: 'hoodie', title: '' } };
}
export function derived(p) {
  const s = { ...p.stats };
  for (const k in p.inventory) { const it = ITEMS[k]; if (it?.passive && p.inventory[k] > 0) for (const q in it.passive) s[q] += it.passive[q]; }
  for (const L of LILIES) if (p.orbs?.includes(L.id)) for (const q in L.passive) s[q] += L.passive[q]; // each Pond Lily is a permanent buff
  return { str: s.str, def: s.def, maxHp: 60 + s.vit * 12 + p.level * 4, maxEnergy: 60 + s.enr * 8 };
}
export function init(p) { const d = derived(p); p.hp = d.maxHp; p.energy = d.maxEnergy; return p; }
// Unleash stages (internal 'ascend'): 0 base, 1 Moon Howl, 2 Tide Howl, 3 Wild Howl. Higher = more power, faster drain.
export const ASCEND_POWER = [1, 1.6, 2.0, 2.5], ASCEND_GUARD = [1, 0.8, 0.7, 0.6], ASCEND_DRAIN = [0, 7, 12, 18], ASCEND_COST = 30;
const stageOf = (o) => o.stage ?? (o.ascended ? 1 : 0);
// Ascend 1 from the start, Ascend 2 after defeating Cate, Ascend 3 at level 15 (or the Chapter 2 story flag).
export const unlockedStage = (p) => (p.flags.primal || p.level >= 15 ? 3 : p.flags.cateDown ? 2 : 1);
// kind: 0..2 combo hit, or 'blast'
export function attackDamage(p, kind, o = {}) {
  const d = derived(p);
  let base = kind === 'blast' ? 6 + d.str * 1.6 : [4, 5, 9][kind] + d.str * 1.2;
  if (kind === 'blast' && o.charged) base *= 1.8;
  base *= ASCEND_POWER[stageOf(o)];
  return Math.max(1, Math.round(base));
}
export function damageTaken(p, raw, o = {}) {
  let dmg = Math.max(1, Math.round(raw - derived(p).def * 0.6));
  const st = stageOf(o); if (st) dmg = Math.max(1, Math.round(dmg * ASCEND_GUARD[st]));
  return dmg;
}
export function enemyHit(e, dmg) { e.hp = Math.max(0, e.hp - dmg); return e.hp === 0; }
export function gainXp(p, amt) {
  p.xp += amt; let ups = 0;
  while (p.xp >= xpToNext(p.level)) { p.xp -= xpToNext(p.level); p.level++; p.points += 3; ups++; }
  if (ups) init(p);
  return ups;
}
export function spendPoint(p, stat) {
  if (p.points <= 0 || !(stat in p.stats)) return false;
  const a = derived(p); p.stats[stat]++; p.points--; const b = derived(p);
  p.hp += b.maxHp - a.maxHp; p.energy += b.maxEnergy - a.maxEnergy; return true;
}
export function addItem(p, id, n = 1) { p.inventory[id] = (p.inventory[id] || 0) + n; }
export function buyItem(p, id) { const it = ITEMS[id]; if (!it?.price || p.bones < it.price) return false; p.bones -= it.price; addItem(p, id); return true; }
export function useItem(p, id) {
  const it = ITEMS[id]; if (!it || !p.inventory[id] || it.passive) return false;
  const d = derived(p);
  if (it.heal) { if (p.hp >= d.maxHp) return false; p.hp = Math.min(d.maxHp, p.hp + it.heal); }
  if (it.energy) { if (p.energy >= d.maxEnergy) return false; p.energy = Math.min(d.maxEnergy, p.energy + it.energy); }
  if (--p.inventory[id] <= 0) delete p.inventory[id];
  return true;
}
// Pond Lilies: 5 different colours, each a distinct permanent buff. Ids keep the old 'orb1..5' save keys.
export const LILY_COUNT = 5;
export const LILIES = [
  { id: 'orb1', name: 'Rose Lily', col: '#ff6b8a', buff: '+3 STR', passive: { str: 3 } },
  { id: 'orb2', name: 'Sun Lily', col: '#ffc83d', buff: '+3 VIT (max HP)', passive: { vit: 3 } },
  { id: 'orb3', name: 'Sky Lily', col: '#5cc8ff', buff: '+3 ENR (max energy)', passive: { enr: 3 } },
  { id: 'orb4', name: 'Moss Lily', col: '#6ee07a', buff: '+3 DEF', passive: { def: 3 } },
  { id: 'orb5', name: 'Dusk Lily', col: '#b07bff', buff: '+2 STR +2 DEF', passive: { str: 2, def: 2 } },
];
export const lily = (id) => LILIES.find((l) => l.id === id);
export function addOrb(p, id) { if (!lily(id) || p.orbs.includes(id)) return false; p.orbs.push(id); return true; }
// Restoring the pond: needs all 5 lilies. Full heal + a thank-you gift; the lilies (and their buffs) are kept. No wishes.
export function restorePond(p) {
  if (LILIES.some((l) => !p.orbs.includes(l.id))) return false;
  p.wishes = (p.wishes || 0) + 1; p.flags.pondRestored = true; addItem(p, 'tea', 2); init(p); return true;
}
// Old saves: drop legacy orb6/orb7, map the old 'wished' flag to pondRestored.
export function migrate(p) {
  p.orbs = (p.orbs || []).filter((id) => lily(id)); if (p.flags?.wished) p.flags.pondRestored = true; return p;
}
export const serialize = (p, extra = {}) => JSON.stringify({ v: 1, t: Date.now(), p, ...extra });
export function deserialize(str) {
  try { const o = JSON.parse(str); if (!o || o.v !== 1 || !o.p?.stats) return null;
    const b = newPlayer(); return migrate({ ...b, ...o.p, stats: { ...b.stats, ...o.p.stats }, cosmetics: { ...b.cosmetics, ...(o.p.cosmetics || {}) } }); }
  catch { return null; }
}
export const save = (storage, p) => storage.setItem(SAVE_KEY, serialize(p));
export const load = (storage) => { const s = storage.getItem(SAVE_KEY); return s ? deserialize(s) : null; };
