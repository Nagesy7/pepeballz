import test from 'node:test'; import assert from 'node:assert';
import * as K from '../src/kibble.js'; import * as C from '../src/core.js';
const holder = (k) => K.toU(k);
test('aura skins are holder-gated cosmetics bound to forms', () => {
  assert.ok(K.unlockedByTier(holder(1000)).includes('skin_kibble')); assert.ok(!K.unlockedByTier(holder(0)).includes('skin_kibble'));
  assert.ok(K.unlockedByTier(holder(100000)).includes('skin_primal')); assert.deepStrictEqual(K.COSMETICS.skin_primal.forms, [3]);
});
test('golden orb: alpha+ only, unique title, no stat change', () => {
  const s = {}; assert.strictEqual(K.goldenSummon(s, holder(1000)).ok, false); const p = C.init(C.newPlayer()), st = JSON.stringify(p.stats);
  assert.ok(K.goldenSummon(s, holder(10000)).ok); assert.ok(s.net.owned.includes('title_golden')); K.goldenSummon(s, holder(10000)); assert.strictEqual(s.net.owned.filter((x) => x === 'title_golden').length, 1); assert.strictEqual(JSON.stringify(p.stats), st);
});
test('tournament: ghosts normalised to the same budget, bracket deterministic, placement payout exact', () => {
  const a = C.newPlayer(); a.stats = { str: 90, def: 2, vit: 5, enr: 3 }; const b = C.newPlayer();
  const ga = K.ghostSnapshot('a', 'A', a), gb = K.ghostSnapshot('b', 'B', b); for (const g of [ga, gb]) assert.strictEqual(Object.values(g.stats).reduce((x, y) => x + y, 0), K.NORM_BUDGET);
  const ents = K.seedBracket('abcdefgh'.split('').map((c, i) => K.ghostSnapshot(c, c.toUpperCase(), { stats: { str: 5 + i, def: 9 - i, vit: 5, enr: 5 } })));
  const r1 = K.runBracket(ents, 40), r2 = K.runBracket(ents, 40); assert.deepStrictEqual(r1.placements.map((p) => p.id), r2.placements.map((p) => p.id)); assert.strictEqual(r1.placements.length, 4); assert.strictEqual(r1.rounds.length, 3);
  const pay = K.tourneyPayout(1000003, r1.placements); assert.deepStrictEqual(pay.map((x) => x.amountU), [500003, 250000, 125000, 125000]);
});
test('bounty: settles only when goal met, split by contribution exactly', () => {
  const s = {}; K.ensureNet(s).pools.weekly = 1000000; const B = { id: 'x', goal: 10, shareBps: 2000 };
  assert.strictEqual(K.settleBounty(s, B, { you: 3, mochi: 4 }).ok, false);
  const r = K.settleBounty(s, B, { you: 3, mochi: 4, kuro: 3 }); assert.ok(r.ok); assert.deepStrictEqual(r.payouts.map((p) => [p.id, p.amountU]), [['mochi', 80000], ['kuro', 60000], ['you', 60000]]);
  assert.strictEqual(s.net.pools.weekly, 800000); assert.strictEqual(K.contribute(s, 'cate_defeats', 'you', 2), 2);
});
test('fighter launch: listing fee to treasury plus the 2% split', async () => {
  const q = K.listingQuote(); assert.deepStrictEqual([q.total, q.treasuryTotal, q.daily, q.weekly, q.monthly], [25000000, 24750000, 62500, 125000, 62500]);
  const s = {}, w = new K.SimWallet({ balU: K.toU(100) }); assert.strictEqual((await K.listFighter(s, { token: 'bad token!', skin: 'x' }, w)).ok, false);
  const r = await K.listFighter(s, { token: 'WOOF', skin: 'aura_violet' }, w); assert.ok(r.ok); assert.strictEqual(s.net.treasuryU, 24750000); assert.strictEqual(await w.balanceU(), K.toU(100) - 25000000);
});
test('seasons: open window and holder early access weekend', async () => {
  const S1 = K.SEASONS[0], before = S1.start - 864e5;
  assert.deepStrictEqual(K.seasonAccess(S1, before, 0), { open: false, early: false }); assert.deepStrictEqual(K.seasonAccess(S1, before, holder(1000)), { open: true, early: true });
  assert.strictEqual(K.seasonAccess(S1, S1.start + 1, 0).open, true); const s = {}, w = new K.SimWallet({});
  assert.ok((await K.buySeasonItem(s, 's1_aura', S1.start + 1, 0, w)).ok); assert.strictEqual((await K.buySeasonItem(s, 's1_aura', S1.start + 1, 0, w)).ok, false);
});
test('burn for legends: full amount burned, public counter rises, no fee', async () => {
  const s = {}, w = new K.SimWallet({ balU: K.toU(100) }), before = K.publicBurned(s);
  const r = await K.burnForLegend(s, 'legend_obsidian', w); assert.ok(r.ok); assert.strictEqual(K.publicBurned(s) - before, K.toU(50)); assert.strictEqual(await w.balanceU(), K.toU(50));
  assert.strictEqual(s.net.treasuryU, 0); assert.strictEqual((await K.burnForLegend(s, 'legend_title', w)).ok, false);
});
