// Shop / For devs links (spec: game-specs.md, Ribbit Nugs). Copy word for word, no banned words, wallet-free analytics.
import test from 'node:test'; import assert from 'node:assert'; import { readFileSync } from 'node:fs';
import * as SH from '../src/shop.js';
const game = readFileSync(new URL('../src/game.js', import.meta.url), 'utf8'), html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
test('shop link exists: kibbleinu.com shop URL, menu item + DOM link with new tab + noopener', () => {
  assert.strictEqual(SH.SHOP_URL, 'https://kibbleinu.com/pay?utm_source=pepeballz&utm_medium=menu#shop-h');
  assert.strictEqual(SH.FOR_DEVS_URL, 'https://kibbleinu.com/for-devs.html?utm_source=pepeballz&utm_medium=menu');
  assert.match(html, /<a id="shopLink"[^>]*target="_blank"[^>]*rel="noopener"/); assert.match(html, /<a id="nudgeShop"[^>]*target="_blank"[^>]*rel="noopener"/);
  assert.match(html, /id="nudgeNo"/); assert.match(html, /id="shopNudge"/);
  assert.match(game, /label: 'Close', act: closeMenu },\s*\{ label: 'Shop', dom: 'shopLink'/, 'Shop is the last pause-menu item');
});
test('copy is word for word and has no banned words', () => {
  assert.deepStrictEqual(SH.COPY, { shop: '🛍️ Shop', shopTitle: 'Optional cosmetics. $KIBBLE is never needed to play.', forDevs: '🛠️ For devs',
    nudge: 'Like your look? Outfits, pets and cars for every Inu game are in the Kibble Pay shop. Optional, and never needed to play.', nudgeYes: 'Visit the shop →', nudgeNo: 'Not now' });
  for (const [k, v] of Object.entries(SH.COPY)) assert.doesNotMatch(v, /hurry|limited|last chance|don't miss|guarantee|moon|profit|prize/i, k);
});
test('paid_link_click event props are wallet-free', () => {
  const sent = []; const w = { va: (...a) => sent.push(a) };
  SH.trackPaidLink('shop', 'menu', w); SH.trackPaidLink('shop', 'results', w); SH.trackPaidLink('for-devs', 'menu', w);
  assert.deepStrictEqual(sent[0], ['event', { name: 'paid_link_click', data: { product: 'shop', from: 'pepeballz-menu', site: 'pepeballz' } }]);
  assert.deepStrictEqual(sent[1][1].data, { product: 'shop', from: 'pepeballz-results', site: 'pepeballz' });
  for (const [, ev] of sent) { assert.deepStrictEqual(Object.keys(ev.data).sort(), ['from', 'product', 'site']); assert.doesNotMatch(JSON.stringify(ev.data), /wallet|mint|name|score|[1-9A-HJ-NP-Za-km-z]{32,44}/i); }
  assert.doesNotThrow(() => SH.trackPaidLink('shop', 'menu', {})); // no va loaded: silent
});
test('nudge shows at most once per session', () => {
  const m = new Map(), ss = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
  assert.ok(SH.nudgeAllowed(ss)); SH.markNudge(ss); assert.strictEqual(m.get('inu.shopNudge'), 'shown'); assert.ok(!SH.nudgeAllowed(ss));
  assert.ok(!SH.nudgeAllowed({ getItem() { throw new Error('blocked'); } }), 'storage blocked: stay quiet');
});
