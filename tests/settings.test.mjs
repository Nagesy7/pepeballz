import test from 'node:test'; import assert from 'node:assert/strict';
import * as S from '../src/settings.js';
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };
test('defaults for old saves (no settings key)', () => { assert.deepEqual(S.load(mem()), S.DEFAULTS); });
test('mute + volume persist and are clamped', () => {
  const m = mem(); const s = S.load(m); s.muted = true; s.volume = 0.3; S.save(m, s);
  const t = S.load(m); assert.equal(t.muted, true); assert.equal(t.volume, 0.3);
  m.setItem(S.SETTINGS_KEY, JSON.stringify({ volume: 7 })); assert.equal(S.load(m).volume, 1);
  m.setItem(S.SETTINGS_KEY, 'garbage'); assert.deepEqual(S.load(m), S.DEFAULTS);
});
