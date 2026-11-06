// First-run power guide: storage flags, affordable detection, copy rules.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as GD from '../src/guide.js';
import * as P from '../src/powers.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };
const pup = (o = {}) => ({ level: 1, bones: 0, orbs: [], ...o });

test('copy is plain/friendly and has no banned words', () => {
  for (const [k, v] of Object.entries(GD.COPY)) {
    const s = typeof v === 'string' ? v : `${v.title} ${v.body}`;
    assert.doesNotMatch(s, GD.BANNED, k);
    assert.doesNotMatch(s, /\$KIBBLE|hurry|limited|prize|aura|saiyan|transform|power level/i, k);
  }
  assert.equal(GD.COPY.ok, 'Got it');
  assert.equal(GD.COPY.skip, 'Skip tips');
  assert.match(GD.COPY.upgrades.body, /Menu|Powers|Bones/);
  assert.match(GD.COPY.collar.body, /Plain Pup/);
  assert.match(GD.COPY.collar.body, /Moonstone Coat/);
});

test('collar names match powers table', () => {
  assert.deepEqual(GD.COLLAR_NAMES, ['Plain Pup', 'Bronze Collar', 'Silver Collar', 'Gold Collar', 'Moonstone Coat']);
});

test('seen / mark / skipAll are localStorage-flagged and one-time', () => {
  const s = mem();
  assert.equal(GD.seen(s, 'upgrades'), false);
  assert.equal(GD.seen(s, 'collar'), false);
  GD.markSeen(s, 'upgrades');
  assert.equal(GD.seen(s, 'upgrades'), true);
  assert.equal(GD.seen(s, 'collar'), false);
  GD.skipAll(s);
  assert.equal(GD.seen(s, 'upgrades'), true);
  assert.equal(GD.seen(s, 'collar'), true);
  assert.equal(GD.badgeOn(s), false);
});

test('badge set and clear', () => {
  const s = mem();
  assert.equal(GD.badgeOn(s), false);
  GD.setBadge(s, true);
  assert.equal(GD.badgeOn(s), true);
  GD.clearBadge(s);
  assert.equal(GD.badgeOn(s), false);
});

test('hasAffordableUpgrade: level + Bones gates for moves and power-ups', () => {
  const p = pup({ level: 3, bones: 10 });
  assert.equal(GD.hasAffordableUpgrade(p), false, 'too few Bones / low level');
  p.bones = 50; p.level = 4;
  assert.equal(GD.hasAffordableUpgrade(p), true, 'Zoomies L1 at Lv4 for 30 bones (moves not required)');
  // max every power-up so only move tiers remain
  for (const id of P.POWERUP_IDS) for (let i = 0; i < 3; i++) { p.level = 12; p.bones = 999; P.upgradePowerup(p, id); }
  p.level = 4; p.bones = 1000; P.buyAbility(p, 'spin');
  assert.equal(GD.hasAffordableUpgrade(p), false, 'spin T2 needs Lv5');
  p.level = 5;
  assert.equal(GD.hasAffordableUpgrade(p), true);
  p.bones = 10;
  assert.equal(GD.hasAffordableUpgrade(p), false);
});

test('shouldOfferUpgrades only on level-up when affordable and unseen', () => {
  const s = mem();
  const p = pup({ level: 5, bones: 1000 });
  P.buyAbility(p, 'spin');
  assert.equal(GD.shouldOfferUpgrades(s, p, { leveled: false }), false);
  assert.equal(GD.shouldOfferUpgrades(s, p, { leveled: true }), true);
  GD.markSeen(s, 'upgrades');
  assert.equal(GD.shouldOfferUpgrades(s, p, { leveled: true }), false);
});

test('shouldOfferCollar on first step-up only', () => {
  const s = mem();
  assert.equal(GD.shouldOfferCollar(s, 0, 0), false);
  assert.equal(GD.shouldOfferCollar(s, 0, 1), true);
  assert.equal(GD.shouldOfferCollar(s, 1, 2), true);
  GD.markSeen(s, 'collar');
  assert.equal(GD.shouldOfferCollar(s, 0, 1), false);
});

test('storage blocked stays quiet (seen=true, no throw)', () => {
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(GD.seen(bad, 'upgrades'), true);
  assert.doesNotThrow(() => GD.markSeen(bad, 'upgrades'));
  assert.doesNotThrow(() => GD.skipAll(bad));
  assert.equal(GD.badgeOn(bad), false);
});

test('game wires guide: tip DOM, badge, story-only, no Mememon / rename', () => {
  const game = readFileSync(new URL('../src/game.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  assert.match(game, /import \* as GD from '\.\/guide\.js'/);
  assert.match(game, /maybeGuideUpgrades\(true\)/);
  assert.match(game, /maybeGuideCollar/);
  assert.match(game, /GD\.clearBadge\(STORE\)/);
  assert.match(game, /· new/);
  assert.match(game, /hideGuideTip\(\); G\.guideQ = null/);
  assert.match(html, /id="guideTip"/);
  assert.match(html, /id="guideOk"/);
  assert.match(html, /id="guideSkip"/);
  assert.match(css, /\.guideTip/);
  assert.match(css, /#menuBtn\.guide-badge/);
  assert.doesNotMatch(game + html, /Mememon/);
  assert.match(html, /Ribbit Nugs/);
});
