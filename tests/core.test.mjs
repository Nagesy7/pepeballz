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
test('items, bones shop, orbs, wishes', () => {
  const p = C.init(C.newPlayer()); p.hp = 10; assert.ok(C.useItem(p, 'bone')); assert.strictEqual(p.hp, 50);
  assert.strictEqual(C.buyItem(p, 'bone'), false); p.bones = 20; assert.ok(C.buyItem(p, 'bone')); assert.strictEqual(p.bones, 5);
  assert.strictEqual(C.grantWish(p, 'fang'), false); for (let i = 1; i <= 7; i++) assert.ok(C.addOrb(p, 'orb' + i)); assert.strictEqual(C.addOrb(p, 'orb1'), false);
  const s = C.derived(p).str; assert.ok(C.grantWish(p, 'fang')); assert.strictEqual(C.derived(p).str, s + 6); assert.strictEqual(p.orbs.length, 0);
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
