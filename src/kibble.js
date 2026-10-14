// $KIBBLE network layer for PepeBallz. SIMULATED ONLY: no blockchain calls, no real money moves.
// Patterns and fee math follow Inu Verse src/mall.js + src/leaderboards.js:
//   amounts are integer micro-KIBBLE (1 KIBBLE = 1,000,000 u, "millionths") so every split is exact.
//   2% fee on Wish Shop purchases: 1% treasury (OWNER_WALLET), 0.25% daily, 0.5% weekly, 0.25% monthly pool.
// Prize pools are paid by leaderboard RANK only. No random draws, no wagering, no paid entry.
// Bones are the free in-game currency (healing, upgrades) and are never convertible to KIBBLE.
// Purchases and holder tiers only unlock cosmetics; nothing here touches combat stats.
//
// Wallet adapter: the real module in /workspace/kibble-pay should expose the same shape as SimWallet:
//   { id, simulated, connect(): Promise<string address>, address, balanceU(): Promise<int>,
//     holdingsU(): Promise<int>, transfer({ to, amountU, memo }): Promise<{ ok, sig }> }
// and be installed with setWallet(adapter). settle() is the only place money moves.
export const U = 1_000_000;
export const OWNER_WALLET = 'BzLYTFAfUsjzQ5x8bx5BbPK4DFtaHrLCuferkvkxTNGJ'; // treasury (multisig later). Display only while simulated.
export const POOL_WALLETS = { daily: 'DAILY_POOL_PLACEHOLDER', weekly: 'WEEKLY_POOL_PLACEHOLDER', monthly: 'MONTHLY_POOL_PLACEHOLDER' };
export const FEE_BPS = { owner: 100, daily: 25, weekly: 50, monthly: 25 };
export const FEE_TOTAL_BPS = 200;
export const toU = (k) => Math.round(k * U);
export const fmtK = (u) => (u / U).toFixed(u % 10000 ? 4 : 2);
export function feeSplit(priceU) {
  const fee = Math.floor(priceU * FEE_TOTAL_BPS / 10000);
  const daily = Math.floor(priceU * FEE_BPS.daily / 10000), weekly = Math.floor(priceU * FEE_BPS.weekly / 10000), monthly = Math.floor(priceU * FEE_BPS.monthly / 10000);
  return { price: priceU, fee, owner: fee - daily - weekly - monthly, daily, weekly, monthly, total: priceU + fee };
}
// ---------- wallet adapter ----------
export class SimWallet {
  constructor(store = {}) { this.id = 'sim'; this.simulated = true; this.s = store; this.s.balU ??= toU(250); this.s.holdU ??= toU(1500); this.address = null; }
  async connect() { this.address = 'SIM' + 'x'.repeat(4) + 'PepeBallzDemo'; return this.address; }
  async balanceU() { return this.s.balU; }
  async holdingsU() { return this.s.holdU; }
  async transfer({ amountU }) { if (amountU > this.s.balU) return { ok: false, reason: 'Insufficient simulated KIBBLE' }; this.s.balU -= amountU; return { ok: true, sig: 'SIMULATED-' + Date.now().toString(36) }; }
}
let wallet = null;
export const setWallet = (w) => { wallet = w; return w; };
export const getWallet = () => wallet;
// ---------- holder tiers (cosmetic unlocks only) ----------
export const TIERS = [
  { id: 'pup', name: 'Pup', minU: 0 }, { id: 'hound', name: 'Hound', minU: toU(1000) },
  { id: 'alpha', name: 'Alpha', minU: toU(10000) }, { id: 'shogun', name: 'Shogun', minU: toU(100000) },
];
export const tierFor = (holdU) => [...TIERS].reverse().find((t) => holdU >= t.minU);
export const COSMETICS = {
  aura_gold: { kind: 'aura', name: 'Gold Aura', color: '#ffe066', tier: 'pup' }, beam_cyan: { kind: 'beam', name: 'Cyan Howl', color: '#7ff0ff', tier: 'pup' },
  aura_ember: { kind: 'aura', name: 'Ember Aura', color: '#ff8a3c', tier: 'hound' }, beam_rose: { kind: 'beam', name: 'Rose Howl', color: '#ff7bd5', tier: 'hound' },
  title_hound: { kind: 'title', name: 'Hound of the Hills', tier: 'hound' },
  aura_violet: { kind: 'aura', name: 'Violet Aura', color: '#b98aff', tier: 'alpha' }, outfit_jacket: { kind: 'outfit', name: 'Black Jacket', equip: { top: 'jacket_black', bottom: 'slacks_black', feet: 'sneakers_gold' }, tier: 'alpha' },
  title_alpha: { kind: 'title', name: 'Pack Alpha', tier: 'alpha' },
  aura_jade: { kind: 'aura', name: 'Jade Shogun Aura', color: '#6ee07a', tier: 'shogun' }, outfit_gold: { kind: 'outfit', name: 'Gold Designer Suit', equip: { top: 'gold_suit', bottom: 'slacks_black', feet: 'sneakers_gold', neck: 'chain_gold' }, tier: 'shogun' },
  title_shogun: { kind: 'title', name: 'Shogun of Kibble', tier: 'shogun' },
  // Pepe Wish shop exclusives (bought, never tier-gated)
  aura_frog: { kind: 'aura', name: 'Pepe Swamp Aura', color: '#58c45a', shop: 6 }, beam_rainbow: { kind: 'beam', name: 'Seven-Orb Beam', color: 'rainbow', shop: 9.5 },
  outfit_tux: { kind: 'outfit', name: 'Wish Night Tux', equip: { top: 'tux_black', bottom: 'slacks_black', feet: 'loafers', neck: 'bowtie' }, shop: 12 },
  title_wish: { kind: 'title', name: 'Friend of Pepe', shop: 3 },
};
const tierRank = (id) => TIERS.findIndex((t) => t.id === id);
export const unlockedByTier = (holdU) => Object.keys(COSMETICS).filter((k) => COSMETICS[k].tier && tierRank(COSMETICS[k].tier) <= tierRank(tierFor(holdU).id));
// ---------- network state ----------
export function ensureNet(s) {
  s.net ||= {}; const n = s.net; n.v = 1; n.treasuryU ||= 0; n.pools ||= { daily: 0, weekly: 0, monthly: 0 }; n.ledger ||= []; n.winners ||= [];
  n.owned ||= []; n.hunt ||= {}; n.rush ||= []; n.pack ||= { tag: '', points: 0 }; n.raids ||= []; return n;
}
export const WISH_SHOP = Object.entries(COSMETICS).filter(([, c]) => c.shop).map(([id, c]) => ({ id, ...c }));
export const quote = (id) => (COSMETICS[id]?.shop ? feeSplit(toU(COSMETICS[id].shop)) : null);
export function settle(n, q, item, sig) {
  n.treasuryU += q.owner; n.pools.daily += q.daily; n.pools.weekly += q.weekly; n.pools.monthly += q.monthly;
  n.ledger.unshift({ item, ...q, to: OWNER_WALLET, sig, simulated: true }); if (n.ledger.length > 50) n.ledger.length = 50;
}
// Cosmetic wish purchase. Never touches p.stats / level / inventory.
export async function buyWish(s, id, w = wallet) {
  const n = ensureNet(s), q = quote(id); if (!q) return { ok: false, reason: 'Not for sale' };
  if (n.owned.includes(id)) return { ok: false, reason: 'Already owned' };
  if (!w) return { ok: false, reason: 'Connect a wallet' };
  const r = await w.transfer({ to: OWNER_WALLET, amountU: q.total, memo: 'pepeballz:' + id }); if (!r.ok) return r;
  settle(n, q, id, r.sig); n.owned.push(id); return { ok: true, quote: q };
}
// ---------- seeded weekly Wish Orb hunt ----------
const WEEK = 7 * 864e5, EPOCH = Date.UTC(2026, 0, 5); // a Monday
export const weekId = (ms) => Math.floor((ms - EPOCH) / WEEK);
export const dayId = (ms) => Math.floor((ms - EPOCH) / 864e5);
export const monthId = (ms) => { const d = new Date(ms); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// spots: [{area,x,y}] candidate tiles. Returns 7 distinct spots, identical for everyone in that week.
export function huntOrbs(week, spots) {
  const r = mulberry32(0x9e3779b9 ^ week), pool = spots.slice(), out = [];
  while (out.length < 7 && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out.map((s, i) => ({ ...s, id: `hunt${week}_${i + 1}`, n: i + 1 }));
}
// Rank: fastest time, then fewer deaths, then earliest submission, then name. Deterministic.
export const rankRuns = (rows) => [...rows].sort((a, b) => a.timeMs - b.timeMs || a.deaths - b.deaths || (a.at || 0) - (b.at || 0) || String(a.name).localeCompare(b.name)).map((r, i) => ({ ...r, rank: i + 1 }));
// ---------- prize pools by rank ----------
export const PAYOUT_BPS = [5000, 3000, 2000]; // top 3 share each pool; remainder (rounding) goes to rank 1
export function payoutByRank(poolU, ranked, bps = PAYOUT_BPS) {
  const winners = ranked.slice(0, bps.length); if (!poolU || !winners.length) return [];
  const used = bps.slice(0, winners.length), tot = used.reduce((a, b) => a + b, 0);
  const amts = used.map((b) => Math.floor(poolU * b / tot)); amts[0] += poolU - amts.reduce((a, b) => a + b, 0);
  return winners.map((w, i) => ({ rank: w.rank ?? i + 1, id: w.id, name: w.name, amountU: amts[i] }));
}
export const POOL_BOARDS = { daily: 'rush', weekly: 'hunt', monthly: 'cup' };
export function awardPool(s, pool, ranked, period) {
  const n = ensureNet(s), out = payoutByRank(n.pools[pool], ranked); if (!out.length) return [];
  n.pools[pool] = 0; n.winners.unshift({ pool, period, payouts: out, simulated: true }); if (n.winners.length > 30) n.winners.length = 30; return out;
}
// ---------- packs + Kibble Cup ----------
export const validTag = (t) => /^[A-Z0-9]{2,5}$/.test(t);
export const PACK_POINTS = { huntFinish: 50, huntTop3: 30, rushClear: 20, rushTop3: 20, raid: 15 };
export function addPackPoints(s, why) { const n = ensureNet(s); const pts = PACK_POINTS[why] || 0; if (n.pack.tag) n.pack.points += pts; return n.pack.tag ? pts : 0; }
export const kibbleCup = (packs) => [...packs].sort((a, b) => b.points - a.points || a.tag.localeCompare(b.tag)).map((p, i) => ({ ...p, rank: i + 1 }));
// ---------- free co-op Cate raid (stub) ----------
export const RAID = { name: 'Cate Swarm Raid', hp: 50000, entry: 'free', reward: { bones: 120, cosmetic: 'title_wish_raid' } };
export function resolveRaid(participants) {
  const dealt = participants.reduce((a, p) => a + p.damage, 0), won = dealt >= RAID.hp;
  return { won, dealt, rewards: participants.map((p) => ({ id: p.id, bones: won ? RAID.reward.bones : 30, badge: won ? 'Raid Victor' : 'Raid Helper' })) }; // everyone rewarded equally
}
// ---------- Inu Verse cosmetic carry-over (stub) ----------
export function exportCosmetics(s, p) {
  const n = ensureNet(s);
  return { format: 'inu-verse-cosmetics/v0', game: 'pepeballz', owned: [...n.owned], equipped: { aura: p.cosmetics.aura, beam: p.cosmetics.beam, outfit: p.cosmetics.outfit, title: p.cosmetics.title }, signature: 'UNSIGNED-STUB' };
}
// ---------- simulated rival rows (clearly flagged sample:true) ----------
const RIVALS = ['Mochi', 'Kuro', 'Hana', 'Taro', 'Yuzu', 'Goma', 'Sora'];
export function sampleRows(board, period) {
  const r = mulberry32(period * 31 + board.length * 7);
  return RIVALS.map((name) => ({ id: 'sim_' + name, name: name + ' (sim)', timeMs: Math.floor((board === 'rush' ? 70 : 600) * 1000 * (0.8 + r() * 0.9)), deaths: Math.floor(r() * 3), at: Math.floor(r() * 1e6), sample: true }));
}
