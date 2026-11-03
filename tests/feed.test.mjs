import test from 'node:test'; import assert from 'node:assert/strict';
import * as F from '../src/feed.js';
const res = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });
const W1 = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', W2 = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
test('empty boards -> honest empty state, no rows', async () => {
  const f = await F.fetchFeed(async () => res({ entries: [] })); assert.equal(f.status, 'empty'); assert.deepEqual(f.rows, []);
  assert.deepEqual(F.feedLines(f), ['No recent runs yet']);
});
test('network/HTTP error -> unavailable message, never sample data', async () => {
  for (const fn of [async () => { throw new Error('offline'); }, async () => res({}, false, 500)]) {
    const f = await F.fetchFeed(fn); assert.equal(f.status, 'error'); assert.deepEqual(f.rows, []); assert.deepEqual(F.feedLines(f), [F.ERROR]);
  }
});
test('only real API entries are shown, shortened + deduped, junk rejected', async () => {
  const daily = { entries: [{ wallet: W1, score: 900, rank: 1 }, { wallet: 'bad', score: 'x' }, null] };
  const weekly = { entries: [{ wallet: W1, score: 1200 }, { wallet: W2, score: 700 }] };
  const f = await F.fetchFeed(async (u) => res(u.endsWith('daily') ? daily : weekly)); assert.equal(f.status, 'ok');
  assert.deepEqual(f.rows.map((r) => [r.wallet, r.score, r.when]), [['7xKX..gAsU', 900, 'today'], ['9WzD..AWWM', 700, 'this week']]);
  for (const l of F.feedLines(f)) assert.ok(!l.includes(W1) && !l.includes(W2), 'full addresses never shown');
});
test('feed source is the real kibble-pay board; module ships no demo/sample rows', async () => {
  assert.match(F.FEED_API, /^https:\/\/kibble-pay\.vercel\.app\/api\/game\?action=scores&game=pepeballz&pool=$/);
  const src = await (await import('node:fs/promises')).readFile(new URL('../src/feed.js', import.meta.url), 'utf8');
  assert.ok(!/demo|sample|fake|mock|placeholder/i.test(src.replace(/Never fabricates[^\n]*/g, '')));
  assert.equal(F.shortAddr(W1), '7xKX..gAsU'); assert.equal(F.shortAddr('short'), 'short'); assert.deepEqual(F.feedLines(null), ['Loading recent runs...']);
});
