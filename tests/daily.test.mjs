import test from 'node:test'; import assert from 'node:assert/strict';
import * as D from '../src/daily.js'; import * as K from '../src/kibble.js';
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };
const dates = (start, n) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(...start) + i * 864e5).toISOString().slice(0, 10));
test('rotation is deterministic, never repeats two days in a row, covers all challenges every 8 days', () => {
  const ds = dates([2026, 0, 1], 400);
  for (const d of ds) assert.equal(D.challengeFor(d).id, D.challengeFor(d).id);
  for (let i = 1; i < ds.length; i++) assert.notEqual(D.challengeFor(ds[i]).id, D.challengeFor(ds[i - 1]).id, ds[i]);
  for (let i = 0; i + 8 <= ds.length; i += 8) assert.equal(new Set(ds.slice(i, i + 8).map((d) => D.challengeFor(d).id)).size, D.CHALLENGES.length);
});
test('day boundary follows Australia/Sydney (AEDT = UTC+11), not UTC', () => {
  assert.equal(D.sydneyDate(Date.parse('2026-11-03T12:59:59Z')), '2026-11-03');
  assert.equal(D.sydneyDate(Date.parse('2026-11-03T13:00:00Z')), '2026-11-04');
  assert.equal(D.sydneyDate(Date.parse('2026-06-15T13:59:59Z')), '2026-06-15'); // AEST = UTC+10
  assert.equal(D.sydneyDate(Date.parse('2026-06-15T14:00:00Z')), '2026-06-16');
  const s = mem(); const a = D.load(s, Date.parse('2026-11-03T12:00:00Z')); D.save(s, a);
  const b = D.load(s, Date.parse('2026-11-03T13:30:00Z')); assert.equal(b.date, '2026-11-04'); assert.equal(b.n, 0);
});
test('progress + rewards: bank once, cosmetic unlocked once, wrong events ignored', () => {
  const s = D.fresh('2026-11-03'); const c = D.current(s); assert.equal(c.id, 'kits');
  assert.equal(D.track(s, 'boar'), null); assert.equal(D.progress(s), 0);
  for (let i = 0; i < c.goal - 1; i++) assert.equal(D.track(s, 'kit'), null);
  const r = D.track(s, 'kit'); assert.ok(r); assert.equal(r.bones, c.bones); assert.equal(r.cosmetic, c.reward); assert.ok(r.newCosmetic);
  assert.equal(D.track(s, 'kit'), null, 'completes only once'); assert.equal(s.bank, c.bones); assert.deepEqual(s.unlocked, [c.reward]);
  const p = { bones: 5 }; assert.equal(D.claimBank(s, p), c.bones); assert.equal(p.bones, 5 + c.bones); assert.equal(D.claimBank(s, p), 0);
});
test('uniq challenges count distinct keys', () => {
  const d = dates([2026, 0, 1], 16).find((x) => D.challengeFor(x).id === 'friends'); const s = D.fresh(d);
  D.track(s, 'talk', 1, 'elder'); D.track(s, 'talk', 1, 'elder'); assert.equal(D.progress(s), 1);
  D.track(s, 'talk', 1, 'a'); D.track(s, 'talk', 1, 'b'); assert.ok(D.track(s, 'talk', 1, 'c')); assert.equal(D.progress(s), 4);
});
test('rollover keeps unlocks + unclaimed bones, corrupt data starts fresh', () => {
  const s = mem(); const a = D.load(s, Date.parse('2026-11-03T01:00:00Z')); a.bank = 35; a.unlocked = ['daily_kits']; D.save(s, a);
  const b = D.load(s, Date.parse('2026-11-04T01:00:00Z')); assert.equal(b.bank, 35); assert.deepEqual(b.unlocked, ['daily_kits']);
  s.setItem(D.DAILY_KEY, '{bad json'); assert.equal(D.load(s).n, 0);
});
test('rewards are bones + cosmetics only: every reward exists, is daily-only and has no stats or $KIBBLE price', () => {
  for (const c of D.CHALLENGES) {
    const k = K.COSMETICS[c.reward]; assert.ok(k, c.reward); assert.equal(k.daily, true);
    assert.ok(!k.price && !k.stats && !k.bonus, c.reward); assert.ok(c.bones > 0 && c.bones <= 60);
    assert.deepEqual(Object.keys(c).sort(), ['bones', 'desc', 'ev', 'goal', 'id', 'name', 'reward', ...(c.uniq ? ['uniq'] : [])].sort());
  }
});
