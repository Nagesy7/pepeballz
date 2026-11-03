import test from 'node:test'; import assert from 'node:assert/strict';
import * as P from '../src/powers.js';
test('power-up pickup, refresh and expiry', () => {
  const a = {}; P.applyPowerup(a, 'zoomies'); assert.ok(P.has(a, 'zoomies'));
  assert.deepEqual(P.tickPowerups(a, 5), []); P.applyPowerup(a, 'zoomies'); assert.equal(a.zoomies.t, P.POWERUPS.zoomies.dur, 'pickup refreshes');
  assert.deepEqual(P.tickPowerups(a, P.POWERUPS.zoomies.dur + 0.01), ['zoomies']); assert.ok(!P.has(a, 'zoomies'));
  assert.equal(P.applyPowerup(a, 'nope'), null);
  for (const id of P.POWERUP_IDS) { const b = {}; P.applyPowerup(b, id); P.tickPowerups(b, P.POWERUPS[id].dur + 0.1); assert.ok(!P.has(b, id), id); }
});
test('Bone Shield blocks exactly 3 hits then breaks', () => {
  const a = {}; P.applyPowerup(a, 'shield'); assert.equal([1, 2, 3, 4].map(() => P.shieldBlock(a)).join(), 'true,true,true,false'); assert.ok(!a.shield);
});
test('ability cooldowns gate reuse and tick down', () => {
  const cds = {}; assert.ok(P.tryUse(cds, 'spin')); assert.ok(!P.tryUse(cds, 'spin'), 'on cooldown');
  P.tickCds(cds, P.ABILITIES.spin.cd - 0.1); assert.ok(!P.tryUse(cds, 'spin')); P.tickCds(cds, 0.2); assert.equal(cds.spin, 0); assert.ok(P.tryUse(cds, 'spin'));
  assert.ok(P.tryUse(cds, 'bark'), 'independent cooldowns'); assert.ok(!P.tryUse(cds, 'nope'));
  for (const id of P.ABILITY_IDS) assert.ok(P.ABILITIES[id].cd >= 3, id);
});
test('abilities unlock through play or free Bones only', () => {
  const p = { level: 1, bones: 0, orbs: [] }; assert.deepEqual(P.checkUnlocks(p), []);
  p.level = 3; assert.deepEqual(P.checkUnlocks(p), ['spin']); assert.equal(p.powers.eq, 'spin');
  p.flags.kitsDefeated = 12; p.orbs = [1, 2, 3]; assert.deepEqual(P.checkUnlocks(p), ['pounce', 'bark']);
  const q = { level: 1, bones: 50 }; assert.equal(P.buyAbility(q, 'pounce').ok, false); assert.equal(q.bones, 50);
  assert.ok(P.buyAbility(q, 'spin').ok); assert.equal(q.bones, 10); assert.equal(P.buyAbility(q, 'spin').ok, false);
  assert.equal(P.cycle(p), 'pounce'); assert.ok(!P.equip(q, 'bark'));
});
test('no $KIBBLE price anywhere and no Dragon Ball-style names', async () => {
  const src = await (await import('node:fs/promises')).readFile(new URL('../src/powers.js', import.meta.url), 'utf8');
  for (const d of [...Object.values(P.ABILITIES), ...Object.values(P.POWERUPS)]) { assert.ok(!('kibble' in d) && !('price' in d)); }
  assert.ok(!/kamehameha|super saiyan|scouter|power level|ki blast|aura/i.test(src));
});
