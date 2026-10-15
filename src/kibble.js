// $KIBBLE network layer for PepeBallz. Real kibble-pay wallet by default (purchases show 'KIBBLE launching soon' until the
// $KIBBLE mint is set); SimWallet + local ledger ONLY in demo mode (?demo=1), clearly labelled.
// Patterns and fee math follow Inu Verse src/mall.js + src/leaderboards.js:
//   amounts are integer micro-KIBBLE (1 KIBBLE = 1,000,000 u, "millionths") so every split is exact.
//   2% fee on Wish Shop purchases: 1% treasury (OWNER_WALLET), 0.25% daily, 0.5% weekly, 0.25% monthly pool.
// Prize pools are paid by leaderboard RANK only. No random draws, no wagering, no paid entry.
// Bones are the free in-game currency (healing, upgrades) and are never convertible to KIBBLE.
// Purchases and holder tiers only unlock cosmetics; nothing here touches combat stats.
//
// Wallet adapter: the real module in /workspace/kibble-pay should expose the same shape as SimWallet:
//   { id, simulated, connect(): Promise<string address>, address, balanceU(): Promise<int>,
//     holdingsU(): Promise<int>, transfer({ to, amountU, memo }): Promise<{ ok, sig }>, burn({ amountU, memo }): Promise<{ ok, sig }> }
// and be installed with setWallet(adapter). settle() is the only place money moves.
export const U = 1_000_000;
export const OWNER_WALLET = 'BzLYTFAfUsjzQ5x8bx5BbPK4DFtaHrLCuferkvkxTNGJ'; // treasury (multisig later). Display only while simulated.
export const FEE_BPS = { owner: 100, daily: 25, weekly: 50, monthly: 25 };
export const FEE_TOTAL_BPS = 200;
export const toU = (k) => Math.round(k * U);
export const fmtK = (u) => (u / U).toFixed(u % 10000 ? 4 : 2);
export function feeSplit(priceU) {
  const fee = Math.floor(priceU * FEE_TOTAL_BPS / 10000);
  const daily = Math.floor(priceU * FEE_BPS.daily / 10000), weekly = Math.floor(priceU * FEE_BPS.weekly / 10000), monthly = Math.floor(priceU * FEE_BPS.monthly / 10000);
  // FEE-INCLUSIVE (same rule as kibble-pay): the player pays exactly priceU; the 2% split is carved out of it.
  return { price: priceU, fee, owner: fee - daily - weekly - monthly, daily, weekly, monthly, total: priceU };
}
// ---------- wallet adapter ----------
export class SimWallet {
  constructor(store = {}) { this.id = 'sim'; this.simulated = true; this.s = store; this.s.balU ??= toU(250); this.s.holdU ??= toU(1500); this.address = null; }
  async connect() { this.address = 'SIM' + 'x'.repeat(4) + 'PepeBallzDemo'; return this.address; }
  async balanceU() { return this.s.balU; }
  async holdingsU() { return this.s.holdU; }
  async burn({ amountU }) { if (amountU > this.s.balU) return { ok: false, reason: 'Insufficient simulated KIBBLE' }; this.s.balU -= amountU; return { ok: true, sig: 'SIMBURN-' + Date.now().toString(36) }; }
  async transfer({ amountU }) { if (amountU > this.s.balU) return { ok: false, reason: 'Insufficient simulated KIBBLE' }; this.s.balU -= amountU; return { ok: true, sig: 'SIMULATED-' + Date.now().toString(36) }; }
}
export const GAME = 'pepeballz';
export const SOON_MSG = 'KIBBLE launching soon: purchases open at launch.';
export const DEMO = typeof location !== 'undefined' && new URLSearchParams(location.search).get('demo') === '1';
export let mode = DEMO ? 'demo' : 'loading', kp = null, serverPools = null, serverBoards = {}, serverBurnedU = 0, glue = null;
// placeholder while kibble-pay loads: never fakes a balance
export const pendingWallet = () => ({ id: 'pending', simulated: false, live: false, address: null, async connect() { throw new Error('Wallet still loading, try again'); }, async balanceU() { return 0; }, async holdingsU() { return 0; }, async transfer() { return { ok: false, reason: SOON_MSG }; }, async burn() { return { ok: false, reason: SOON_MSG }; } });
// real kibble-pay adapter (catalog ids pepeballz:<id>, fee-inclusive; amounts come from the server catalog)
export function realWallet(sdk) { const w = sdk.asPepeBallzWallet(), live = () => !!sdk.cfg?.provisioned;
  return { id: 'kibble-pay', simulated: false, get live() { return live(); }, get address() { return sdk.session ? sdk.address : null; },
    connect: () => w.connect(), balanceU: async () => (live() ? w.balanceU() : 0), holdingsU: async () => (live() ? w.holdingsU() : 0),
    async transfer(o) { return live() ? w.transfer({ itemId: o.itemId || o.memo }) : { ok: false, reason: SOON_MSG }; },
    async burn(o) { return live() ? w.burn(o) : { ok: false, reason: SOON_MSG }; },
    async inventory() { return (await sdk.inventory(GAME))?.[GAME] || {}; } }; }
export async function initKibble(apiBase = 'https://kibble-pay.vercel.app') {
  glue = await import(apiBase + '/inu-games.js'); glue.mountFooter(DEMO ? 'demo' : 'soon');
  if (DEMO) return { mode };
  const K = await glue.initKibble({ game: GAME, apiBase }); mode = K.mode; document.getElementById('inu-legal')?.remove(); glue.mountFooter(K.mode);
  if (K.kp) { kp = K.kp; setWallet(realWallet(kp)); refreshServer().catch(() => {}); } return K; }
export async function refreshServer() { if (!kp) return; const P = await kp.pools(); serverPools = P.pools; serverBurnedU = Number(P.burnedAllBaseUnits || 0);
  for (const pool of ['daily', 'weekly', 'monthly']) serverBoards[pool] = (await kp.scores(GAME, pool)).entries; }
// wallet-owned cosmetics: purchases (pepeballz:<id>) and opt-in burns (burn:<id>) from /api/inventory
export function syncOwned(s, inv) { const n = ensureNet(s); for (const k of Object.keys(inv || {})) { if (!(inv[k] > 0)) continue; const id = k.startsWith('burn:') ? k.slice(5) : k.startsWith(GAME + ':') ? k.slice(GAME.length + 1) : null; if (id && COSMETICS[id] && !n.owned.includes(id)) n.owned.push(id); } return n.owned; }
// run score for the shared prize board (higher = better): faster clear, fewer deaths
export const runScore = (timeMs, deaths) => Math.max(1, Math.min(100000, Math.round(1e6 / Math.max(10, timeMs / 1000)) - deaths * 100));
export async function postRun(timeMs, deaths) { const w = wallet; if (!kp || !w?.address || w.simulated) return null; const sc = runScore(timeMs, deaths); const r = await kp.submitScore(GAME, sc, timeMs); refreshServer().catch(() => {}); return { ...r, score: sc }; }
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
  // Ascend aura skins (holders, cosmetic only). forms = which Ascend stages show it
  skin_kibble: { kind: 'aura', name: '$KIBBLE Gold Flame', color: '#f6c94c', tier: 'hound', forms: [1, 2, 3] },
  bolt_pepe: { kind: 'bolt', name: 'Pepe-Green Lightning', color: '#58ff7a', tier: 'hound', forms: [2, 3] },
  skin_storm: { kind: 'aura', name: 'Tide Sapphire', color: '#7fb8ff', tier: 'alpha', forms: [2, 3] },
  bolt_violet: { kind: 'bolt', name: 'Violet Crackle', color: '#d0a0ff', tier: 'alpha', forms: [2, 3] },
  skin_primal: { kind: 'aura', name: 'Wild Ember Ruff', color: '#ff6a2a', tier: 'shogun', forms: [3] },
  title_golden: { kind: 'title', name: 'Golden Wishbearer', unique: true },
  // Burn for legends (no fee: the whole amount is burned)
  legend_obsidian: { kind: 'aura', name: 'Obsidian Legend Aura', color: '#40304a', burn: 50 },
  legend_starfall: { kind: 'bolt', name: 'Starfall Lightning', color: '#fff6a0', burn: 120 },
  legend_title: { kind: 'title', name: 'Legend of the Burn', burn: 250 },
  // Season sets (limited per saga chapter)
  s1_cap: { kind: 'outfit', name: 'Fang Peak Climber', equip: { top: 'jacket_black', bottom: 'chinos', feet: 'sneakers_red', hat: 'cap_red' }, season: 'ch1', shop: 5 },
  s1_aura: { kind: 'aura', name: 'Catnip Pink Aura', color: '#ff8fc8', season: 'ch1', shop: 4 },
  // Pepe Wish shop exclusives (bought, never tier-gated)
  aura_frog: { kind: 'aura', name: 'Pepe Swamp Aura', color: '#58c45a', shop: 6 }, beam_rainbow: { kind: 'beam', name: 'Seven-Lily Wave', color: 'rainbow', shop: 9.5 },
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
export const WISH_SHOP = Object.entries(COSMETICS).filter(([, c]) => c.shop && !c.season).map(([id, c]) => ({ id, ...c }));
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
  const r = await w.transfer({ to: OWNER_WALLET, amountU: q.total, memo: 'pepeballz:' + id, itemId: 'pepeballz:' + id }); if (!r.ok) return r;
  if (w.simulated) settle(n, q, id, r.sig); n.owned.push(id); return { ok: true, quote: q };
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

// ---------- 2) Pepe's Golden Orb (holders, cosmetic 8th orb) ----------
export const GOLDEN_ORB_TIER = 'alpha';
export const goldenOrbEligible = (holdU) => tierRank(tierFor(holdU).id) >= tierRank(GOLDEN_ORB_TIER);
export function goldenSummon(s, holdU) { const n = ensureNet(s); if (!goldenOrbEligible(holdU)) return { ok: false, reason: 'Alpha tier or higher' };
  if (!n.owned.includes('title_golden')) n.owned.push('title_golden'); n.goldenSummons = (n.goldenSummons || 0) + 1; return { ok: true, pepe: 'golden', title: 'title_golden' }; }
// ---------- 3) Tournament of Paws: weekly 1v1 bracket vs saved warrior ghosts ----------
// A ghost is a snapshot of a player's build. For fairness every ghost fights on the same stat budget:
// only the *shape* of the build (ratios) carries over, scaled to NORM_BUDGET.
export const NORM_BUDGET = 40;
export function ghostSnapshot(id, name, p) {
  const tot = Object.values(p.stats).reduce((a, b) => a + b, 0) || 1, st = {}; let used = 0; const keys = Object.keys(p.stats);
  keys.forEach((k) => { st[k] = Math.floor(p.stats[k] / tot * NORM_BUDGET); used += st[k]; }); st[keys[0]] += NORM_BUDGET - used;
  return { id, name, stats: st, level: 6, coat: p.coat || 'golden', aura: p.cosmetics?.aura || '', style: st.str >= st.def ? 'rush' : 'guard' };
}
const h32 = (str) => { let h = 2166136261; for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
// deterministic non-player match: stat-shape matchup, ties broken by a hash of the pairing + week (no prize draw; fixed per week)
export function simMatch(a, b, week) { const sc = (x, y) => x.stats.str * 1.2 + x.stats.vit + x.stats.def * 0.8 - y.stats.def * 0.5 + (x.style === 'rush' && y.style === 'guard' ? 1 : 0);
  const d = sc(a, b) - sc(b, a); return d > 0 ? a : d < 0 ? b : (h32(a.id + b.id + week) & 1 ? a : b); }
export function seedBracket(ghosts) { return [...ghosts].sort((a, b) => a.id.localeCompare(b.id)).slice(0, 8); }
// results: fn(a,b) -> winner for the player's real matches; returns placements [1st,2nd,3rd-4th x2]
export function runBracket(entrants, week, decide = simMatch) { let round = entrants.slice(), rounds = [], semisLosers = [];
  while (round.length > 1) { const next = [], log = []; for (let i = 0; i < round.length; i += 2) { const [a, b] = [round[i], round[i + 1]]; const w = decide(a, b, week); const l = w === a ? b : a; next.push(w); log.push({ a: a.id, b: b.id, w: w.id }); if (round.length === 4) semisLosers.push(l); if (round.length === 2) rounds.runnerUp = l; } rounds.push(log); round = next; }
  return { rounds, placements: [round[0], rounds.runnerUp, ...semisLosers] }; }
export const TOURNEY_BPS = [5000, 2500, 1250, 1250];
export function tourneyPayout(poolU, placements) { return payoutByRank(poolU, placements.map((p, i) => ({ ...p, rank: i < 2 ? i + 1 : 3 })), TOURNEY_BPS); }
// ---------- 4) Cate bounty board (community goals, split by contribution) ----------
export const BOUNTIES = [{ id: 'cate_defeats', name: 'Pop 300 Cates this week', goal: 300, shareBps: 2000 }, { id: 'hunt_orbs', name: 'Find 2,000 hunt lilies', goal: 2000, shareBps: 1000 }];
export function contribute(s, bountyId, who, n = 1) { const b = ensureNet(s); b.bounty ||= {}; const c = (b.bounty[bountyId] ||= {}); c[who] = (c[who] || 0) + n; return c[who]; }
export const bountyTotal = (contribs) => Object.values(contribs).reduce((a, b) => a + b, 0);
// pro-rata in millionths; remainder to the top contributor (ties by id) so the split is exact
export function splitByContribution(amountU, contribs) {
  const ids = Object.keys(contribs).filter((k) => contribs[k] > 0).sort((a, b) => contribs[b] - contribs[a] || a.localeCompare(b)); const tot = ids.reduce((a, k) => a + contribs[k], 0); if (!tot || !amountU) return [];
  const out = ids.map((id) => ({ id, contribution: contribs[id], amountU: Math.floor(amountU * contribs[id] / tot) })); out[0].amountU += amountU - out.reduce((a, o) => a + o.amountU, 0); return out; }
export function settleBounty(s, bounty, contribs, pool = 'weekly') { const n = ensureNet(s); if (bountyTotal(contribs) < bounty.goal) return { ok: false, reason: 'Goal not met yet' };
  const amt = Math.floor(n.pools[pool] * bounty.shareBps / 10000); const out = splitByContribution(amt, contribs); n.pools[pool] -= out.reduce((a, o) => a + o.amountU, 0);
  n.winners.unshift({ pool: 'bounty:' + bounty.id, payouts: out, simulated: true }); return { ok: true, payouts: out }; }
// ---------- 5) Fighter launches (stub): Launch Hall tokens sponsor a warrior skin ----------
export const LISTING_FEE = 25; // KIBBLE, fee-inclusive: treasury keeps it minus the 1% pool share (DEMO-only stub; not in the live catalog)
export function listingQuote() { const q = feeSplit(toU(LISTING_FEE)), t = q.price - q.daily - q.weekly - q.monthly; return { ...q, owner: t, treasuryTotal: t }; }
export async function listFighter(s, { token, skin }, w = wallet) { const n = ensureNet(s); if (!/^\$?[A-Z0-9]{2,10}$/.test(token || '')) return { ok: false, reason: 'Bad token ticker' };
  if (!w) return { ok: false, reason: 'Connect a wallet' }; const q = listingQuote(); const r = await w.transfer({ to: OWNER_WALLET, amountU: q.total, memo: 'pepeballz:launch:' + token }); if (!r.ok) return r;
  n.treasuryU += q.owner; n.pools.daily += q.daily; n.pools.weekly += q.weekly; n.pools.monthly += q.monthly; n.launches ||= []; const L = { token, skin, status: 'pending review (stub)', sig: r.sig, simulated: true }; n.launches.unshift(L);
  n.ledger.unshift({ item: 'launch:' + token, ...q, to: OWNER_WALLET, sig: r.sig, simulated: true }); return { ok: true, listing: L, quote: q }; }
// ---------- 6) Seasons ----------
export const SEASONS = [
  { id: 'ch1', name: "Season 1: Cate's Fury", start: Date.UTC(2026, 9, 1), end: Date.UTC(2027, 0, 1), set: ['s1_cap', 's1_aura'] },
  { id: 'ch2', name: 'Season 2: (coming soon)', start: Date.UTC(2027, 0, 1), end: Date.UTC(2027, 3, 1), set: [] },
];
export const EARLY_ACCESS_MS = 2 * 864e5; // holder early-access weekend
export function seasonAccess(season, ms, holdU) { const holder = tierRank(tierFor(holdU).id) >= 1;
  if (ms >= season.start && ms < season.end) return { open: true, early: false };
  if (holder && ms >= season.start - EARLY_ACCESS_MS && ms < season.start) return { open: true, early: true }; return { open: false, early: false }; }
export const currentSeason = (ms) => SEASONS.find((x) => ms >= x.start && ms < x.end) || SEASONS[0];
export async function buySeasonItem(s, id, ms, holdU, w = wallet) { const c = COSMETICS[id], se = SEASONS.find((x) => x.id === c?.season); if (!se) return { ok: false, reason: 'Not a season item' };
  if (!seasonAccess(se, ms, holdU).open) return { ok: false, reason: 'Season not open' }; const n = ensureNet(s); if (n.owned.includes(id)) return { ok: false, reason: 'Already owned' };
  const q = feeSplit(toU(c.shop)); const r = await w.transfer({ to: OWNER_WALLET, amountU: q.total, memo: 'pepeballz:' + id, itemId: 'pepeballz:' + id }); if (!r.ok) return r; if (w.simulated) settle(n, q, id, r.sig); n.owned.push(id); return { ok: true, quote: q }; }
// ---------- 7) Burn for legends ----------
export async function burnForLegend(s, id, w = wallet) { const c = COSMETICS[id], n = ensureNet(s); if (!c?.burn) return { ok: false, reason: 'Not a legend' }; if (n.owned.includes(id)) return { ok: false, reason: 'Already unlocked' };
  if (!w) return { ok: false, reason: 'Connect a wallet' }; const amt = toU(c.burn); const r = await w.burn({ amountU: amt, memo: 'pepeballz:legend:' + id, itemId: id }); if (!r.ok) return r;
  n.burnedU = (n.burnedU || 0) + amt; n.owned.push(id); n.ledger.unshift({ item: 'burn:' + id, burned: amt, sig: r.sig, simulated: !!w.simulated }); return { ok: true, burnedU: amt }; }
// real total of opt-in burns across all Inu games (kibble-pay); demo mode = only your own demo burns. No invented base.
export const publicBurned = (s) => (kp && !DEMO ? serverBurnedU : ensureNet(s).burnedU || 0);
