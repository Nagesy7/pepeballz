import test from 'node:test'; import assert from 'node:assert/strict';
import * as P from '../src/powers.js'; import * as C from '../src/core.js';
const pup = (o = {}) => ({ level: 1, bones: 0, orbs: [], ...o });
test('move tier purchase: level gate, Bones deduction, max tier', () => {
  const p = pup({ level: 4, bones: 1000 }); assert.equal(P.upgradeAbility(p, 'spin').reason, 'Learn it first');
  assert.ok(P.buyAbility(p, 'spin').ok); assert.equal(P.tierOf(p, 'spin'), 1); assert.equal(p.bones, 960);
  let r = P.upgradeAbility(p, 'spin'); assert.equal(r.ok, false); assert.equal(r.reason, 'Reach level 5'); assert.equal(p.bones, 960, 'no charge when gated');
  p.level = 5; p.bones = 59; assert.equal(P.upgradeAbility(p, 'spin').reason, 'Need 60 bones'); assert.equal(p.bones, 59);
  p.bones = 1000; assert.deepEqual(P.upgradeAbility(p, 'spin'), { ok: true, tier: 2 }); assert.equal(p.bones, 940);
  assert.equal(P.upgradeAbility(p, 'spin').reason, 'Reach level 10'); p.level = 10;
  assert.deepEqual(P.upgradeAbility(p, 'spin'), { ok: true, tier: 3 }); assert.equal(p.bones, 800); assert.equal(P.upgradeAbility(p, 'spin').reason, 'Max tier'); assert.equal(p.bones, 800);
});
test('every move has tiers 2-3 with rising level gates and costs', () => {
  for (const id of P.ABILITY_IDS) { const t = P.ABILITY_TIERS[id]; assert.ok(t[2].level >= 5 && t[3].level >= 10 && t[3].level > t[2].level, id); assert.ok(t[3].bones > t[2].bones && t[2].bones > 0, id); }
});
test('stats scale per tier: more damage and reach, shorter cooldown (never below 2s)', () => {
  for (const id of P.ABILITY_IDS) { const p = pup({ level: 20, bones: 9999 }); P.buyAbility(p, id); const s1 = P.abilityStats(p, id); P.upgradeAbility(p, id); const s2 = P.abilityStats(p, id); P.upgradeAbility(p, id); const s3 = P.abilityStats(p, id);
    assert.deepEqual([s1.tier, s2.tier, s3.tier], [1, 2, 3]); assert.equal(s1.cd, P.ABILITIES[id].cd); assert.equal(s1.dmg, P.ABILITIES[id].dmg);
    assert.ok(s3.dmg > s2.dmg && s2.dmg > s1.dmg, id); assert.ok(s3.radius > s2.radius && s2.radius > s1.radius, id); assert.ok(s3.cd < s2.cd && s2.cd < s1.cd && s3.cd >= 2, id); }
  const p = pup({ level: 20, bones: 9999 }); P.buyAbility(p, 'spin'); P.upgradeAbility(p, 'spin'); P.upgradeAbility(p, 'spin'); assert.ok(P.abilityStats(p, 'spin').deflect);
  const cds = {}; assert.ok(P.tryUse(cds, 'spin', P.abilityStats(p, 'spin').cd)); assert.equal(cds.spin, 2.2);
  assert.equal(P.abilityDamage(100, 'spin', P.abilityStats(p, 'spin').dmg), 140); assert.equal(P.abilityDamage(100, 'spin'), 90);
});
test('power-up upgrades: gated, cost Bones, add duration/strength', () => {
  const p = pup({ level: 3, bones: 500 }); assert.equal(P.upgradePowerup(p, 'zoomies').reason, 'Reach level 4'); assert.equal(p.bones, 500);
  p.level = 12; for (let i = 1; i <= 3; i++) assert.deepEqual(P.upgradePowerup(p, 'zoomies'), { ok: true, lv: i }); assert.equal(p.bones, 500 - 190); assert.equal(P.upgradePowerup(p, 'zoomies').reason, 'Max level');
  const a = {}; P.applyPowerup(a, 'zoomies', p); assert.equal(a.zoomies.t, 14); assert.equal(a.zoomies.speed, 1.6);
  const b = {}; P.applyPowerup(b, 'zoomies'); assert.equal(b.zoomies.t, 8); assert.equal(b.zoomies.speed, 1.45, 'no save = base stats');
  for (const id of P.POWERUP_IDS) { const q = pup({ level: 12, bones: 999 }); const base = P.puStats(q, id); P.upgradePowerup(q, id); P.upgradePowerup(q, id); P.upgradePowerup(q, id); const up = P.puStats(q, id);
    assert.ok(Object.keys(base).some((k) => typeof base[k] === 'number' && up[k] > base[k]), id); assert.equal(P.PU_UPGRADES[id].length, 3, id); }
  const s = {}; const q = pup({ level: 12, bones: 999 }); P.upgradePowerup(q, 'shield'); P.applyPowerup(s, 'shield', q); assert.equal([1, 2, 3, 4, 5].map(() => P.shieldBlock(s)).join(), 'true,true,true,true,false');
});
test('new original power-up: Wildberry Snack boosts damage, droppable', () => {
  assert.ok(P.POWERUP_IDS.includes('berry')); const a = {}; P.applyPowerup(a, 'berry'); assert.equal(a.berry.dmgMult, 1.3);
  assert.equal(P.pickPowerup(() => 0.99), 'berry');
});
test('combos: Paw Twister window needs Tail Spin; Stun Pounce multiplier', () => {
  const p = pup({ level: 5, bones: 999 }); P.buyAbility(p, 'pounce'); assert.ok(!P.canTwister(p, 0.2), 'needs spin learned');
  P.buyAbility(p, 'spin'); assert.ok(P.canTwister(p, 0.2)); assert.ok(!P.canTwister(p, P.COMBO_WINDOW + 0.1)); assert.ok(P.COMBOS.stunPounce.dmg > 1);
});
test('collar look per total tier: Plain > Bronze > Silver > Gold > Moonstone', () => {
  assert.deepEqual(P.COLLARS.map((c) => c.name), ['Plain Pup', 'Bronze Collar', 'Silver Collar', 'Gold Collar', 'Moonstone Coat']);
  const p = pup({ level: 20, bones: 99999 }); const seen = [P.collarTier(p)];
  for (const id of P.ABILITY_IDS) { P.buyAbility(p, id); seen.push(P.collarTier(p)); }
  for (const id of P.ABILITY_IDS) for (let i = 0; i < 2; i++) { P.upgradeAbility(p, id); seen.push(P.collarTier(p)); }
  for (const id of P.POWERUP_IDS) for (let i = 0; i < 3; i++) { P.upgradePowerup(p, id); seen.push(P.collarTier(p)); }
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] >= seen[i - 1], 'never goes down');
  assert.deepEqual([...new Set(seen)], [0, 1, 2, 3, 4]); assert.equal(P.powerScore(p), 24);
  for (const c of P.COLLARS.slice(1)) { for (const k of ['collar', 'shade', 'gem', 'trail']) assert.match(c[k], /^#[0-9a-f]{6}$/); assert.deepEqual(Object.keys(c.coat).sort(), ['base', 'dark', 'ear', 'light']); }
  assert.equal(new Set(P.COLLARS.slice(1).map((c) => c.collar)).size, 4, 'each tier has its own collar colour');
});
test('look tiers are cosmetic only: no stats on the collar table, prize build unaffected', () => {
  for (const c of P.COLLARS) for (const k of ['dmg', 'cd', 'radius', 'speed', 'str', 'def', 'hp', 'power', 'guard', 'kibble', 'price']) assert.ok(!(k in c), `${c.id}.${k}`);
  const fresh = C.init(C.newPlayer()), maxed = C.init(C.newPlayer()); maxed.level = 20; maxed.bones = 99999;
  for (const id of P.ABILITY_IDS) { P.buyAbility(maxed, id); P.upgradeAbility(maxed, id); P.upgradeAbility(maxed, id); }
  // a prize run builds a fresh fixed player and copies only cosmetics + the look number from the story save
  const run = (story) => { const r = C.init(C.newPlayer()); r.level = 6; r.cosmetics = { ...story.cosmetics }; r.lookTier = P.collarTier(story); return r; };
  const a = run(fresh), b = run(maxed); assert.equal(a.lookTier, 0); assert.ok(b.lookTier > 0);
  assert.deepEqual(C.derived(a), C.derived(b)); assert.equal(C.attackDamage(a, 1, {}), C.attackDamage(b, 1, {}));
});
test('save migration: old saves load at tier 1 / upgrade 0 and keep working', () => {
  const old = { v: 1, t: 1, p: { ...C.newPlayer(), level: 7, bones: 90, powers: { owned: ['spin', 'bark'], eq: 'bark' } } };
  const p = C.deserialize(JSON.stringify(old)); const pw = P.ensure(p);
  assert.deepEqual(pw.tiers, { spin: 1, bark: 1 }); assert.deepEqual(pw.pu, {}); assert.equal(pw.eq, 'bark');
  assert.equal(P.abilityStats(p, 'bark').cd, P.ABILITIES.bark.cd); assert.equal(P.collarTier(p), 0);
  const ancient = C.deserialize(JSON.stringify({ v: 1, t: 1, p: { ...C.newPlayer(), powers: undefined } })); assert.deepEqual(P.ensure(ancient), { owned: [], eq: '', tiers: {}, pu: {} });
  P.upgradeAbility(p, 'spin'); const back = C.deserialize(C.serialize(p)); assert.equal(P.tierOf(back, 'spin'), 2, 'tiers survive save/load');
});
test('no $KIBBLE on tiers/upgrades and no forbidden naming', async () => {
  for (const id of P.ABILITY_IDS) for (const t of Object.values(P.ABILITY_TIERS[id])) assert.ok(!('kibble' in t) && !('price' in t));
  for (const id of P.POWERUP_IDS) for (const u of P.PU_UPGRADES[id]) assert.ok(!('kibble' in u) && !('price' in u));
  const src = await (await import('node:fs/promises')).readFile(new URL('../src/powers.js', import.meta.url), 'utf8');
  assert.ok(!/super|ultra|majin|buu|saiyan|kaio|scouter|power level|aura|flame|lightning|beam|scream/i.test(src));
});
