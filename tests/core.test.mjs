import test from 'node:test'; import assert from 'node:assert';
import * as C from '../src/core.js';
const mem = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };
test('combo damage rises across 3 hits; ascend and charge multiply', () => {
  const p = C.init(C.newPlayer()); const [a, b, c] = [0, 1, 2].map(i => C.attackDamage(p, i));
  assert.ok(a < b && b < c); assert.ok(C.attackDamage(p, 2, { ascended: true }) > c);
  assert.ok(C.attackDamage(p, 'blast', { charged: true }) > C.attackDamage(p, 'blast'));
});
test('defense reduces damage, floor 1; enemy death', () => {
  const p = C.init(C.newPlayer()); assert.strictEqual(C.damageTaken(p, 1), 1); assert.ok(C.damageTaken(p, 20) < 20);
  const e = { hp: 10 }; assert.strictEqual(C.enemyHit(e, 4), false); assert.strictEqual(C.enemyHit(e, 40), true); assert.strictEqual(e.hp, 0);
});
test('xp: levels, 3 points per level, refill, spend', () => {
  const p = C.init(C.newPlayer()); p.hp = 1; assert.strictEqual(C.gainXp(p, C.xpToNext(1) + C.xpToNext(2)), 2);
  assert.strictEqual(p.level, 3); assert.strictEqual(p.points, 6); assert.strictEqual(p.hp, C.derived(p).maxHp);
  const m = C.derived(p).maxHp; assert.ok(C.spendPoint(p, 'vit')); assert.ok(C.derived(p).maxHp > m); assert.strictEqual(C.spendPoint(p, 'luck'), false);
});
test('items, bones shop, 5 pond lilies with distinct buffs, pond restoration (no wishes)', () => {
  const p = C.init(C.newPlayer()); p.hp = 10; assert.ok(C.useItem(p, 'bone')); assert.strictEqual(p.hp, 50);
  assert.strictEqual(C.buyItem(p, 'bone'), false); p.bones = 20; assert.ok(C.buyItem(p, 'bone')); assert.strictEqual(p.bones, 5);
  assert.strictEqual(C.LILY_COUNT, 5); assert.strictEqual(new Set(C.LILIES.map((l) => l.col)).size, 5); assert.strictEqual(new Set(C.LILIES.map((l) => l.buff)).size, 5);
  assert.strictEqual(C.restorePond(p), false); assert.strictEqual(C.addOrb(p, 'orb6'), false);
  let d0 = C.derived(p); assert.ok(C.addOrb(p, 'orb1')); assert.strictEqual(C.derived(p).str, d0.str + 3); assert.strictEqual(C.addOrb(p, 'orb1'), false);
  d0 = C.derived(p); assert.ok(C.addOrb(p, 'orb4')); assert.strictEqual(C.derived(p).def, d0.def + 3);
  for (let i = 1; i <= 5; i++) C.addOrb(p, 'orb' + i); const tea = p.inventory.tea || 0;
  assert.ok(C.restorePond(p)); assert.ok(p.flags.pondRestored); assert.strictEqual(p.orbs.length, 5); assert.strictEqual(p.inventory.tea, tea + 2);
  assert.strictEqual(C.WISHES, undefined); assert.strictEqual(C.grantWish, undefined);
});
test('save round-trips and rejects junk', () => {
  const s = mem(), p = C.init(C.newPlayer()); C.gainXp(p, 100); C.addOrb(p, 'orb3'); p.area = 'forest';
  C.save(s, p); assert.deepStrictEqual(C.load(s), JSON.parse(JSON.stringify(p)));
  assert.strictEqual(C.deserialize('nope'), null); assert.strictEqual(C.deserialize('{"v":9}'), null); assert.strictEqual(C.load(mem()), null);
});

test('ascend stages scale power and drain and unlock by story/level', () => {
  const p = C.init(C.newPlayer()); const d = [0, 1, 2, 3].map((st) => C.attackDamage(p, 2, { stage: st }));
  assert.ok(d[0] < d[1] && d[1] < d[2] && d[2] < d[3], d.join());
  assert.ok(C.ASCEND_DRAIN[1] < C.ASCEND_DRAIN[2] && C.ASCEND_DRAIN[2] < C.ASCEND_DRAIN[3]);
  assert.ok(C.damageTaken(p, 40, { stage: 3 }) < C.damageTaken(p, 40, { stage: 1 }));
  assert.strictEqual(C.unlockedStage(p), 1); p.flags.cateDown = true; assert.strictEqual(C.unlockedStage(p), 2); p.level = 15; assert.strictEqual(C.unlockedStage(p), 3);
});

import { STAGES as FORMS } from '../src/forms.js';
test('IP: original form/item names (no golden-transformation / senzu-style names)', () => {
  const names = FORMS.map((f) => f.name).join('|') + '|' + Object.values(C.ITEMS).map((i) => i.name).join('|');
  for (const b of ['Golden', 'Super', 'Saiyan', 'Spark', 'Senzu', 'Orb']) assert.ok(!names.includes(b), b);
  for (const f of FORMS.slice(1)) assert.ok(!/^#ff[c-e]/.test(f.pal.base), 'no golden coat: ' + f.name);
});

test('old saves migrate: legacy orb6/orb7 dropped, wished -> pondRestored, old ids still load', () => {
  const old = C.newPlayer(); old.orbs = ['orb1', 'orb3', 'orb6', 'orb7']; old.flags.wished = true;
  const p = C.deserialize(JSON.stringify({ v: 1, p: old })); assert.deepStrictEqual(p.orbs, ['orb1', 'orb3']); assert.ok(p.flags.pondRestored);
});
test('IP: no Pepe / wish-granter / beam names in user-facing data', async () => {
  const K = await import('../src/kibble.js'); const all = JSON.stringify([C.ITEMS, C.LILIES, K.COSMETICS, FORMS.map((f) => f.name)]);
  for (const b of ['Pepe', 'Wish', 'Lightning', 'Seven', 'Kame', 'Power Level', 'Scouter', 'Saiyan']) assert.ok(!all.includes(b), b);
  const cfg = await import('../src/config.js'); assert.strictEqual(cfg.GAME_TITLE, 'PepeNugs');
});
