// Hero abilities + temporary field power-ups (pure rules, no DOM). Original Inu moves; nothing here is sold for $KIBBLE.
// Abilities unlock through normal play OR with free in-game Bones. Prize runs (Hunt / Boss Rush / Tourney) use the fixed
// build with abilities and power-ups switched off, so the prize boards stay identical for everyone and skill-only.
export const ABILITIES = {
  spin:   { name: 'Tail Spin', desc: 'Whirl your tail: hits every foe around you.', cd: 3, dmg: 0.9, radius: 26, kb: 150, playUnlock: 'Reach level 3', bones: 40 },
  pounce: { name: 'Pounce Dash', desc: 'Leap forward and land a paw-slam.', cd: 4.5, dmg: 1.3, radius: 20, kb: 190, range: 70, playUnlock: 'Defeat 12 Catnip Kits', bones: 80 },
  bark:   { name: 'Bark Shockwave', desc: 'A big BORK: pushes foes back, stuns them, pops enemy shots.', cd: 8, dmg: 0.6, radius: 60, kb: 220, stun: 1.2, playUnlock: 'Find 3 Pond Lilies', bones: 120 },
};
export const ABILITY_IDS = Object.keys(ABILITIES);
export function ensure(p) { p.powers ||= { owned: [], eq: '' }; p.powers.owned ||= []; p.flags ||= {}; return p.powers; }
export function playUnlocked(p, id) {
  if (id === 'spin') return (p.level || 1) >= 3;
  if (id === 'pounce') return (p.flags?.kitsDefeated || 0) >= 12;
  if (id === 'bark') return (p.orbs?.length || 0) >= 3;
  return false;
}
// Grant any abilities earned through play. Returns the newly unlocked ids (first one is auto-equipped).
export function checkUnlocks(p) { const pw = ensure(p), out = [];
  for (const id of ABILITY_IDS) if (!pw.owned.includes(id) && playUnlocked(p, id)) { pw.owned.push(id); out.push(id); }
  if (!pw.eq && pw.owned.length) pw.eq = pw.owned[0]; return out; }
export function buyAbility(p, id) { const a = ABILITIES[id], pw = ensure(p); if (!a || pw.owned.includes(id)) return { ok: false, reason: 'Already learned' };
  if ((p.bones || 0) < a.bones) return { ok: false, reason: `Need ${a.bones} bones` }; p.bones -= a.bones; pw.owned.push(id); if (!pw.eq) pw.eq = id; return { ok: true }; }
export function equip(p, id) { const pw = ensure(p); if (!pw.owned.includes(id)) return false; pw.eq = id; return true; }
export function cycle(p) { const pw = ensure(p); if (!pw.owned.length) return ''; const i = pw.owned.indexOf(pw.eq); pw.eq = pw.owned[(i + 1) % pw.owned.length]; return pw.eq; }
// cooldowns: plain object id -> seconds left
export function tryUse(cds, id) { const a = ABILITIES[id]; if (!a || (cds[id] || 0) > 0) return false; cds[id] = a.cd; return true; }
export function tickCds(cds, dt) { for (const k in cds) cds[k] = Math.max(0, cds[k] - dt); return cds; }
export const abilityDamage = (base, id) => Math.max(1, Math.round(base * (ABILITIES[id]?.dmg || 1)));

// ---- temporary power-ups (dropped in the field / by foes in story mode) ----
export const POWERUPS = {
  zoomies: { name: 'Zoomies', desc: 'Speed burst', dur: 8, col: '#ffb13d', speed: 1.45 },
  shield:  { name: 'Bone Shield', desc: 'Blocks the next 3 hits', dur: 12, col: '#f6e7c8', hits: 3 },
  magnet:  { name: 'Kibble Magnet', desc: 'Pulls pickups in, +50% bones', dur: 12, col: '#d8a050', radius: 90, boneMult: 1.5 },
  bloom:   { name: 'Lily Bloom', desc: 'Heals 35% now + regen', dur: 5, col: '#ff8fb8', heal: 0.35, regen: 4 },
};
export const POWERUP_IDS = Object.keys(POWERUPS);
// active: { id: { t: secondsLeft, max, hits? } }. Picking one up again refreshes its timer.
export function applyPowerup(active, id) { const d = POWERUPS[id]; if (!d) return null; active[id] = { t: d.dur, max: d.dur, ...(d.hits ? { hits: d.hits } : {}) }; return active[id]; }
export function tickPowerups(active, dt) { const ended = []; for (const k of Object.keys(active)) { active[k].t -= dt; if (active[k].t <= 0 || active[k].hits === 0) { delete active[k]; ended.push(k); } } return ended; }
export const has = (active, id) => !!active[id] && active[id].t > 0;
// Bone Shield: returns true when it soaked the hit.
export function shieldBlock(active) { const s = active.shield; if (!s || s.t <= 0 || !s.hits) return false; s.hits--; if (s.hits <= 0) delete active.shield; return true; }
// deterministic-ish pick for drops (rng injected for tests)
export const pickPowerup = (rng = Math.random) => POWERUP_IDS[Math.min(POWERUP_IDS.length - 1, Math.floor(rng() * POWERUP_IDS.length))];
export const DROP_CHANCE = 0.08;
