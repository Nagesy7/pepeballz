// PepeBallz core rules: pure logic shared by the game and node tests (no DOM).
export const SAVE_KEY = 'pepeballz.save.v1';
export const ITEMS = {
  bone:  { name: 'Bone Biscuit', desc: 'Restores 40 HP', heal: 40, price: 15 },
  jerky: { name: 'Hero Jerky', desc: 'Restores 120 HP', heal: 120, price: 40 },
  tea:   { name: 'Spark Tea', desc: 'Restores 60 energy', energy: 60, price: 25 },
  fang:  { name: 'Golden Fang', desc: 'Wish relic: +6 STR', passive: { str: 6 } },
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
  return { str: s.str, def: s.def, maxHp: 60 + s.vit * 12 + p.level * 4, maxEnergy: 60 + s.enr * 8 };
}
export function init(p) { const d = derived(p); p.hp = d.maxHp; p.energy = d.maxEnergy; return p; }
// kind: 0..2 combo hit, or 'blast'
export function attackDamage(p, kind, o = {}) {
  const d = derived(p);
  let base = kind === 'blast' ? 6 + d.str * 1.6 : [4, 5, 9][kind] + d.str * 1.2;
  if (kind === 'blast' && o.charged) base *= 1.8;
  if (o.ascended) base *= 1.6;
  return Math.max(1, Math.round(base));
}
export function damageTaken(p, raw, o = {}) {
  let dmg = Math.max(1, Math.round(raw - derived(p).def * 0.6));
  if (o.ascended) dmg = Math.max(1, Math.round(dmg * 0.8));
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
export function addOrb(p, id) { if (p.orbs.includes(id)) return false; p.orbs.push(id); return true; }
export const WISHES = [
  { id: 'power', name: 'Power of the Pack', desc: '+2 levels' },
  { id: 'fang', name: 'Golden Fang', desc: 'Relic: +6 STR' },
  { id: 'feast', name: 'Endless Feast', desc: '5 Hero Jerky + 3 Spark Tea' },
];
export function grantWish(p, id) {
  if (p.orbs.length < 7) return false;
  if (id === 'power') { for (let i = 0; i < 2; i++) gainXp(p, xpToNext(p.level) - p.xp); }
  else if (id === 'fang') addItem(p, 'fang');
  else if (id === 'feast') { addItem(p, 'jerky', 5); addItem(p, 'tea', 3); }
  else return false;
  p.orbs = []; p.wishes++; p.flags.wished = true; init(p); return true;
}
export const serialize = (p, extra = {}) => JSON.stringify({ v: 1, t: Date.now(), p, ...extra });
export function deserialize(str) {
  try { const o = JSON.parse(str); if (!o || o.v !== 1 || !o.p?.stats) return null;
    const b = newPlayer(); return { ...b, ...o.p, stats: { ...b.stats, ...o.p.stats }, cosmetics: { ...b.cosmetics, ...(o.p.cosmetics || {}) } }; }
  catch { return null; }
}
export const save = (storage, p) => storage.setItem(SAVE_KEY, serialize(p));
export const load = (storage) => { const s = storage.getItem(SAVE_KEY); return s ? deserialize(s) : null; };
