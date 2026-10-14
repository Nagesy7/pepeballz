// Fetch Fashion: clothing catalog + wardrobe logic (headless, no DOM).
export const SLOTS = ['hat', 'eyes', 'neck', 'top', 'bottom', 'feet'];
export const SLOT_NAMES = { hat: 'Hat', eyes: 'Eyewear', neck: 'Neck', top: 'Top', bottom: 'Bottoms', feet: 'Shoes' };
// look: drawing hints consumed by src/sprite.js
export const OUTFITS = {
  cap_red:      { slot: 'hat', name: 'Red Cap', price: 60, look: { kind: 'cap', c: '#c8282e', d: '#8e1a20' } },
  top_hat:      { slot: 'hat', name: 'Top Hat', price: 140, look: { kind: 'tophat', c: '#1b1b22', d: '#0c0c10', band: '#d4a640' } },
  shades:       { slot: 'eyes', name: 'Sunglasses', price: 50, look: { c: '#15151c', frame: '#15151c' } },
  gold_shades:  { slot: 'eyes', name: 'Gold Shades', price: 110, look: { c: '#15151c', frame: '#e3b341' } },
  tie_red:      { slot: 'neck', name: 'Red Tie', price: 40, look: { kind: 'tie', c: '#c8282e' } },
  bowtie:       { slot: 'neck', name: 'Bow Tie', price: 40, look: { kind: 'bow', c: '#111' } },
  chain_gold:   { slot: 'neck', name: 'Gold Chain', price: 150, look: { kind: 'chain', c: '#f0c24b' } },
  suit_navy:    { slot: 'top', name: 'Navy Suit Jacket', price: 220, look: { kind: 'suit', c: '#1f2d5c', d: '#141e40', shirt: '#f4f1ea', pin: '#e3b341' } },
  tux_black:    { slot: 'top', name: 'Black Tuxedo', price: 260, look: { kind: 'suit', c: '#1a1a20', d: '#0e0e12', shirt: '#ffffff', pin: '#e3b341' } },
  hoodie_maroon:{ slot: 'top', name: 'Maroon Paw Hoodie', price: 120, look: { kind: 'hoodie', c: '#7c1e2c', d: '#58131e', accent: '#e3b341', hair: { c: '#a8321e', d: '#6e1c10', l: '#d0502c' } } },
  jacket_black: { slot: 'top', name: 'Black Jacket', price: 160, look: { kind: 'jacket', c: '#202026', d: '#121216', accent: '#e3b341', hair: { c: '#3a2418', d: '#22140c', l: '#5a3a26' } } },
  hawaiian:     { slot: 'top', name: 'Hawaiian Shirt', price: 90, look: { kind: 'hawaiian', c: '#1c2a52', d: '#121c3a', accent: '#e3b341' } },
  gown_white:   { slot: 'top', name: 'White & Gold Gown', price: 300, full: true, look: { kind: 'gown', c: '#f6f1e4', d: '#d9cfb8', accent: '#e3b341', hair: { long: true, c: '#e9c25a', d: '#b88a2a', l: '#f8e08a' } } },
  gold_suit:    { slot: 'top', name: 'Gold Designer Suit', price: 999, mall: true, look: { kind: 'suit', c: '#d4a640', d: '#9c7424', shirt: '#121a36', pin: '#ffffff' } },
  velvet_gown:  { slot: 'top', name: 'Midnight Velvet Gown', price: 999, mall: true, full: true, look: { kind: 'gown', c: '#24305c', d: '#121a36', accent: '#f2cc68', hair: { long: true, c: '#3a2418', d: '#22140c', l: '#6a4a30' } } },
  crown:        { slot: 'hat', name: 'Little Gold Crown', price: 999, mall: true, look: { kind: 'tophat', c: '#e3b341', d: '#9c7424', band: '#d8425a' } },
  diamond_chain:{ slot: 'neck', name: 'Diamond Paw Chain', price: 999, mall: true, look: { kind: 'chain', c: '#cfe8ff' } },
  plat_shades:  { slot: 'eyes', name: 'Platinum Shades', price: 999, mall: true, look: { c: '#15151c', frame: '#dfe4ea' } },
  slacks_navy:  { slot: 'bottom', name: 'Navy Slacks', price: 90, look: { c: '#1f2d5c', d: '#141e40' } },
  slacks_black: { slot: 'bottom', name: 'Black Slacks', price: 90, look: { c: '#1a1a20', d: '#0e0e12' } },
  jeans_ripped: { slot: 'bottom', name: 'Ripped Jeans', price: 70, look: { c: '#4a6fa5', d: '#34507c', rip: '#c9d6e8' } },
  chinos:       { slot: 'bottom', name: 'Chinos', price: 60, look: { c: '#d8c8a2', d: '#b7a57c' } },
  sneakers_red: { slot: 'feet', name: 'Red Sneakers', price: 80, look: { c: '#b3202c', sole: '#f4f1ea' } },
  sneakers_gold:{ slot: 'feet', name: 'Black & Gold Sneakers', price: 120, look: { c: '#18181e', sole: '#e3b341' } },
  loafers:      { slot: 'feet', name: 'Shiny Loafers', price: 70, look: { c: '#141418', sole: '#3a3a44' } },
};

const fail = (reason) => ({ ok: false, reason });
export function ensureWardrobe(s) {
  if (!s.wardrobe || typeof s.wardrobe !== 'object') s.wardrobe = {};
  if (!Array.isArray(s.wardrobe.owned)) s.wardrobe.owned = [];
  if (!s.wardrobe.equipped || typeof s.wardrobe.equipped !== 'object') s.wardrobe.equipped = {};
  s.wardrobe.owned = s.wardrobe.owned.filter((id) => OUTFITS[id]);
  for (const [slot, id] of Object.entries(s.wardrobe.equipped)) if (!OUTFITS[id] || OUTFITS[id].slot !== slot || !s.wardrobe.owned.includes(id)) delete s.wardrobe.equipped[slot];
  return s.wardrobe;
}
export const owns = (s, id) => !!s.wardrobe?.owned?.includes(id);
export function buyOutfit(s, id) {
  const d = OUTFITS[id]; if (!d) return fail('Unknown item');
  if (d.mall) return fail('Sold at Kibble Mall');
  const w = ensureWardrobe(s);
  if (w.owned.includes(id)) return fail('Already owned');
  if (s.bones < d.price) return fail('Not enough bones');
  s.bones -= d.price; w.owned.push(id); return { ok: true };
}
export function equipOutfit(s, id) {
  const d = OUTFITS[id]; if (!d) return fail('Unknown item');
  const w = ensureWardrobe(s);
  if (!w.owned.includes(id)) return fail('Buy it at Fetch Fashion first');
  w.equipped[d.slot] = id;
  if (d.full) delete w.equipped.bottom; // gowns replace bottoms
  if (d.slot === 'bottom' && OUTFITS[w.equipped.top]?.full) delete w.equipped.top;
  return { ok: true };
}
export function unequipSlot(s, slot) {
  const w = ensureWardrobe(s);
  if (!w.equipped[slot]) return fail('Nothing equipped');
  delete w.equipped[slot]; return { ok: true };
}
// resolved look for rendering: { slot: lookObject }
export function outfitLook(equipped = {}) {
  const o = {}; for (const [slot, id] of Object.entries(equipped || {})) if (OUTFITS[id]) o[slot] = { id, full: !!OUTFITS[id].full, ...OUTFITS[id].look };
  return o;
}
