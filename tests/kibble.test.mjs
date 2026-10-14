import test from 'node:test'; import assert from 'node:assert';
import * as K from '../src/kibble.js'; import * as C from '../src/core.js';
test('2% fee split in millionths is exact and matches spec', () => {
  const q = K.feeSplit(K.toU(10)); assert.deepStrictEqual([q.fee, q.owner, q.daily, q.weekly, q.monthly, q.total], [200000, 100000, 25000, 50000, 25000, 10200000]);
  for (const p of [1, 3, 777, 1234567, K.toU(9.5), K.toU(0.0001)]) { const s = K.feeSplit(p); assert.strictEqual(s.owner + s.daily + s.weekly + s.monthly, s.fee); assert.ok(s.owner >= s.daily); }
});
test('buyWish settles to treasury + pools and never changes stats', async () => {
  const s = {}, p = C.init(C.newPlayer()), before = JSON.stringify({ st: p.stats, l: p.level, i: p.inventory, hp: p.hp });
  const w = new K.SimWallet({}); await w.connect(); const b0 = await w.balanceU();
  const r = await K.buyWish(s, 'outfit_tux', w); assert.ok(r.ok);
  assert.strictEqual(b0 - await w.balanceU(), K.toU(12.24)); assert.strictEqual(s.net.treasuryU, 120000);
  assert.deepStrictEqual(s.net.pools, { daily: 30000, weekly: 60000, monthly: 30000 }); assert.strictEqual(s.net.ledger[0].to, K.OWNER_WALLET);
  assert.strictEqual((await K.buyWish(s, 'outfit_tux', w)).ok, false); assert.strictEqual((await K.buyWish(s, 'aura_gold', w)).ok, false);
  assert.strictEqual(JSON.stringify({ st: p.stats, l: p.level, i: p.inventory, hp: p.hp }), before);
});
test('runs rank by time, then deaths, then submission time', () => {
  const r = K.rankRuns([{ id: 'a', name: 'A', timeMs: 500, deaths: 2, at: 1 }, { id: 'b', name: 'B', timeMs: 500, deaths: 0, at: 9 }, { id: 'c', name: 'C', timeMs: 400, deaths: 5, at: 5 }, { id: 'd', name: 'D', timeMs: 500, deaths: 0, at: 3 }]);
  assert.deepStrictEqual(r.map((x) => x.id), ['c', 'd', 'b', 'a']); assert.deepStrictEqual(r.map((x) => x.rank), [1, 2, 3, 4]);
});
test('pool payout by rank is exact, deterministic, top-3 only', () => {
  const ranked = K.rankRuns([1, 2, 3, 4].map((i) => ({ id: 'p' + i, name: 'P' + i, timeMs: i * 10, deaths: 0 })));
  const out = K.payoutByRank(1000001, ranked); assert.deepStrictEqual(out.map((o) => o.amountU), [500001, 300000, 200000]);
  assert.strictEqual(out.reduce((a, o) => a + o.amountU, 0), 1000001); assert.deepStrictEqual(K.payoutByRank(1000001, ranked), out);
  assert.deepStrictEqual(K.payoutByRank(99, ranked.slice(0, 1)).map((o) => o.amountU), [99]);
  const s = {}; K.ensureNet(s).pools.daily = 500; assert.strictEqual(K.awardPool(s, 'daily', ranked, 1).length, 3); assert.strictEqual(s.net.pools.daily, 0);
});
test('weekly hunt is seeded: same week same orbs, different weeks differ', () => {
  const spots = Array.from({ length: 40 }, (_, i) => ({ area: 'forest', x: i, y: i }));
  const a = K.huntOrbs(42, spots), b = K.huntOrbs(42, spots), c = K.huntOrbs(43, spots);
  assert.deepStrictEqual(a, b); assert.strictEqual(new Set(a.map((o) => o.x)).size, 7); assert.notDeepStrictEqual(a.map((o) => o.x), c.map((o) => o.x));
});
test('tiers unlock cosmetics only; packs, cup, raid, export', () => {
  assert.strictEqual(K.tierFor(0).name, 'Pup'); assert.strictEqual(K.tierFor(K.toU(1000)).name, 'Hound'); assert.strictEqual(K.tierFor(K.toU(250000)).name, 'Shogun');
  assert.ok(K.unlockedByTier(K.toU(10000)).includes('aura_violet')); assert.ok(!K.unlockedByTier(K.toU(10000)).includes('aura_jade'));
  for (const c of Object.values(K.COSMETICS)) assert.ok(!('stats' in c) && !('str' in c));
  assert.ok(K.validTag('SHIBA')); assert.ok(!K.validTag('toolongtag'));
  const s = {}; K.ensureNet(s).pack.tag = 'INU'; assert.strictEqual(K.addPackPoints(s, 'rushClear'), 20);
  assert.deepStrictEqual(K.kibbleCup([{ tag: 'B', points: 5 }, { tag: 'A', points: 9 }]).map((p) => p.tag), ['A', 'B']);
  const raid = K.resolveRaid([{ id: 1, damage: 30000 }, { id: 2, damage: 25000 }]); assert.ok(raid.won && raid.rewards.every((r) => r.bones === 120));
  assert.strictEqual(K.exportCosmetics(s, C.newPlayer()).format, 'inu-verse-cosmetics/v0');
  assert.ok(!Object.keys(K).some((k) => /bones?To|cashout|wager|raffle|lottery/i.test(k)));
});
