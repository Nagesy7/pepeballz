import test from 'node:test'; import assert from 'node:assert/strict';
import * as GP from '../src/gamepad.js';
const pad = (pressedIdx = [], axes = [0, 0, 0, 0], id = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)') =>
  ({ id, index: 0, connected: true, mapping: 'standard', axes, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressedIdx.includes(i), value: pressedIdx.includes(i) ? 1 : 0 })) });
test('controller kind from gamepad.id (vendor ids + names)', () => {
  assert.equal(GP.padKind('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'), 'ps');
  assert.equal(GP.padKind('054c-0ce6-Wireless Controller'), 'ps');
  assert.equal(GP.padKind('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)'), 'xbox');
  assert.equal(GP.padKind('045e-02ea-Controller'), 'xbox');
  assert.equal(GP.padKind('8BitDo SN30 Pro (Vendor: 2dc8)'), 'generic');
  assert.equal(GP.GLYPHS.ps.a, 'Cross'); assert.equal(GP.GLYPHS.xbox.a, 'A'); assert.equal(GP.GLYPHS.ps.st, 'Options');
});
test('deadzone ~0.2: drift ignored, full tilt = 1, diagonal never faster than keys', () => {
  assert.equal(GP.DEFAULT_DEADZONE, 0.2); assert.deepEqual(GP.applyDeadzone(0.15, 0.1), [0, 0]);
  const [x] = GP.applyDeadzone(1, 0); assert.equal(x, 1); const [a, b] = GP.applyDeadzone(1, 1); assert.ok(Math.hypot(a, b) <= 1 + 1e-9);
  assert.deepEqual(GP.applyDeadzone(0.3, 0, 0.35), [0, 0], 'configurable');
  const [h] = GP.applyDeadzone(0.6, 0); assert.ok(h > 0 && h < 1, 'analog ramp');
});
test('play mapping: A attack, B dodge, X power, Y howl, RB swap, LB rest, RT unleash, D-pad moves', () => {
  const r = GP.readPad(pad([0, 1, 2, 3, 4, 5, 7, 12, 15]));
  for (const a of ['atk', 'dash', 'power', 'blast', 'charge', 'swap', 'ascend', 'up', 'right']) assert.ok(r.held[a], a);
  assert.ok(!r.held.back && !r.held.menu); assert.ok(GP.readPad(pad([9])).start);
  const m = GP.readPad(pad([1]), { menu: true }); assert.ok(m.held.back && !m.held.dash, 'B is back in menus');
  const s = GP.readPad(pad([], [0.9, -0.1])); assert.ok(s.stick[0] > 0.8 && s.any);
  assert.ok(!GP.readPad(pad([], [0.1, 0.1])).any, 'stick drift is not input');
});
test('no turbo: holding a button gives exactly one press until released', () => {
  const e = GP.createEdges(); let presses = 0;
  for (let f = 0; f < 120; f++) presses += e({ atk: true }).pressed.atk ? 1 : 0; assert.equal(presses, 1);
  assert.ok(e({}).released.atk); assert.ok(e({ atk: true }).pressed.atk);
});
test('firstPad skips empty / disconnected slots (hot-plug)', () => {
  assert.equal(GP.firstPad([null, { connected: false }, null]), null); const p = pad(); p.index = 2; assert.equal(GP.firstPad([null, null, p]), p);
});
