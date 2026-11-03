import test from 'node:test'; import assert from 'node:assert/strict';
import { createAmbient, nightFactor } from '../src/ambient.js';
// small outdoor test map: flowers, grass, a pond
const rows = ['..........', '.ff,,..~~.', '.ff,,..~~.', '..........'];
const area = { id: 'village', w: 10, h: 4, get: (x, y) => rows[y]?.[x] ?? '#' };
const env = (night, boost = false) => ({ pl: { x: 80, y: 32 }, cam: { x: 0, y: 0 }, VW: 300, VH: 200, q: 2, night, boost });
const run = (A, night, boost, secs = 3) => { for (let i = 0; i < secs * 30; i++) A.update(1 / 30, env(night, boost)); };
test('butterflies by day, none at dusk or night (fireflies only)', () => {
  const A = createAmbient(); A.reset(area); run(A, 0); assert.ok(A.fly.length > 0, 'day has butterflies'); assert.equal(A.ff.length, 0);
  run(A, 0.5); assert.equal(A.fly.length, 0, 'dusk clears butterflies'); assert.ok(A.ff.length > 0, 'dusk has fireflies');
  run(A, 1); assert.equal(A.fly.length, 0, 'night: no butterflies'); assert.ok(A.ff.length > 0, 'night: fireflies');
  run(A, 0.1, true); assert.equal(A.fly.length, 0, 'early dusk + Firefly Night boost: no butterflies');
  run(A, 0); assert.ok(A.fly.length > 0, 'butterflies return by day');
});
test('nightFactor: day 0, dusk ramps, night 1', () => {
  assert.equal(nightFactor(12), 0); assert.ok(nightFactor(18) > 0 && nightFactor(18) < 1); assert.equal(nightFactor(22), 1); assert.equal(nightFactor(3), 1);
});
