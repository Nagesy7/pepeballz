// Hero abilities + temporary field power-ups (pure rules, no DOM). Original Inu moves; nothing here is sold for $KIBBLE.
// Abilities unlock through normal play OR with free in-game Bones. Prize runs (Hunt / Boss Rush / Tourney) use the fixed
// build with abilities and power-ups switched off, so the prize boards stay identical for everyone and skill-only.
export const ABILITIES = {
  spin:   { name: 'Tail Spin', desc: 'Whirl your tail: hits every foe around you.', cd: 3, dmg: 0.9, radius: 26, kb: 150, playUnlock: 'Reach level 3', bones: 40 },
  pounce: { name: 'Pounce Dash', desc: 'Leap forward and land a paw-slam.', cd: 4.5, dmg: 1.3, radius: 20, kb: 190, range: 70, playUnlock: 'Defeat 12 Catnip Kits', bones: 80 },
  bark:   { name: 'Bark Shockwave', desc: 'A big BORK: pushes foes back, stuns them, pops enemy shots.', cd: 8, dmg: 0.6, radius: 60, kb: 220, stun: 1.2, playUnlock: 'Find 3 Pond Lilies', bones: 120 },
};
export const ABILITY_IDS = Object.keys(ABILITIES);
// Save migration: older saves have no tiers / pu fields; every learned move starts at tier 1, every power-up at upgrade 0.
export function ensure(p) { p.powers ||= { owned: [], eq: '' }; const pw = p.powers; pw.owned ||= []; pw.tiers ||= {}; pw.pu ||= {}; p.flags ||= {};
  for (const id of pw.owned) if (!(pw.tiers[id] >= 1)) pw.tiers[id] = 1; return pw; }
export function playUnlocked(p, id) {
  if (id === 'spin') return (p.level || 1) >= 3;
  if (id === 'pounce') return (p.flags?.kitsDefeated || 0) >= 12;
  if (id === 'bark') return (p.orbs?.length || 0) >= 3;
  return false;
}
// Grant any abilities earned through play. Returns the newly unlocked ids (first one is auto-equipped).
export function checkUnlocks(p) { const pw = ensure(p), out = [];
  for (const id of ABILITY_IDS) if (!pw.owned.includes(id) && playUnlocked(p, id)) { pw.owned.push(id); pw.tiers[id] = 1; out.push(id); }
  if (!pw.eq && pw.owned.length) pw.eq = pw.owned[0]; return out; }
export function buyAbility(p, id) { const a = ABILITIES[id], pw = ensure(p); if (!a || pw.owned.includes(id)) return { ok: false, reason: 'Already learned' };
  if ((p.bones || 0) < a.bones) return { ok: false, reason: `Need ${a.bones} bones` }; p.bones -= a.bones; pw.owned.push(id); pw.tiers[id] = 1; if (!pw.eq) pw.eq = id; return { ok: true }; }
export function equip(p, id) { const pw = ensure(p); if (!pw.owned.includes(id)) return false; pw.eq = id; return true; }
export function cycle(p) { const pw = ensure(p); if (!pw.owned.length) return ''; const i = pw.owned.indexOf(pw.eq); pw.eq = pw.owned[(i + 1) % pw.owned.length]; return pw.eq; }
// cooldowns: plain object id -> seconds left
export function tryUse(cds, id, cd) { const a = ABILITIES[id]; if (!a || (cds[id] || 0) > 0) return false; cds[id] = cd ?? a.cd; return true; }
export function tickCds(cds, dt) { for (const k in cds) cds[k] = Math.max(0, cds[k] - dt); return cds; }
export const abilityDamage = (base, id, mult) => Math.max(1, Math.round(base * (mult ?? ABILITIES[id]?.dmg ?? 1)));

// ---- move tiers (bought with Bones earned in story play, gated by player level; never $KIBBLE) ----
// Values are the TOTAL change vs tier 1. Tier 1 = the move as learned.
export const MAX_TIER = 3;
export const ABILITY_TIERS = {
  spin: { 2: { level: 5, bones: 60, dmg: 1.25, radius: 5, cd: -0.4, note: 'Wider whirl, faster recharge' },
          3: { level: 10, bones: 140, dmg: 1.55, radius: 10, cd: -0.8, kb: 1.2, deflect: true, note: 'Also swats away enemy shots' } },
  pounce: { 2: { level: 5, bones: 80, dmg: 1.25, radius: 4, range: 15, cd: -0.5, note: 'Longer leap, bigger slam' },
            3: { level: 10, bones: 160, dmg: 1.55, radius: 8, range: 25, cd: -1, kb: 1.2, stun: 0.6, note: 'Landing dazes foes 0.6s' } },
  bark: { 2: { level: 6, bones: 100, dmg: 1.2, radius: 10, stun: 0.3, cd: -1, note: 'Bigger rings, longer stun' },
          3: { level: 12, bones: 200, dmg: 1.45, radius: 20, stun: 0.6, cd: -2, kb: 1.2, heal: 0.05, note: 'Huge rings; heals you 5%' } },
};
export const tierOf = (p, id) => { const pw = ensure(p); return pw.owned.includes(id) ? Math.max(1, Math.min(MAX_TIER, pw.tiers[id] || 1)) : 0; };
export const nextTier = (p, id) => { const t = tierOf(p, id); return t && t < MAX_TIER ? { tier: t + 1, ...ABILITY_TIERS[id][t + 1] } : null; };
// Effective stats for a move at the player's tier (pure; the game only calls this in story mode).
export function abilityStats(p, id) { const a = ABILITIES[id]; if (!a) return null; const t = Math.max(1, tierOf(p, id)), m = t > 1 ? ABILITY_TIERS[id][t] : {};
  return { ...a, tier: t, dmg: +(a.dmg * (m.dmg || 1)).toFixed(3), radius: a.radius + (m.radius || 0), cd: +(a.cd + (m.cd || 0)).toFixed(2), kb: Math.round(a.kb * (m.kb || 1)),
    range: (a.range || 0) + (m.range || 0), stun: +((a.stun || 0) + (m.stun || 0)).toFixed(2), deflect: !!m.deflect, heal: m.heal || 0 }; }
export function upgradeAbility(p, id) { const pw = ensure(p), t = tierOf(p, id); if (!t) return { ok: false, reason: 'Learn it first' };
  const n = nextTier(p, id); if (!n) return { ok: false, reason: 'Max tier' };
  if ((p.level || 1) < n.level) return { ok: false, reason: `Reach level ${n.level}` };
  if ((p.bones || 0) < n.bones) return { ok: false, reason: `Need ${n.bones} bones` };
  p.bones -= n.bones; pw.tiers[id] = n.tier; return { ok: true, tier: n.tier }; }

// ---- combos (story only) ----
// Paw Twister: press the power button again within COMBO_WINDOW s of a Pounce landing to finish with a Tail Spin (needs Tail Spin learned).
// Stun Pounce: a Pounce landing on a foe dazed by Bark Shockwave deals x1.5.
export const COMBO_WINDOW = 0.7;
export const COMBOS = {
  twister: { name: 'Paw Twister', how: 'Pounce, then press power again on landing', dmg: 1.6, radius: 6 },
  stunPounce: { name: 'Stun Pounce', how: 'Pounce a foe dazed by Bark', dmg: 1.5 },
};
export const canTwister = (p, sinceLand) => sinceLand >= 0 && sinceLand <= COMBO_WINDOW && tierOf(p, 'spin') > 0;

// ---- temporary power-ups (dropped in the field / by foes in story mode) ----
export const POWERUPS = {
  zoomies: { name: 'Zoomies', desc: 'Speed burst', dur: 8, col: '#ffb13d', speed: 1.45 },
  shield:  { name: 'Bone Shield', desc: 'Blocks the next 3 hits', dur: 12, col: '#f6e7c8', hits: 3 },
  magnet:  { name: 'Kibble Magnet', desc: 'Pulls pickups in, +50% bones', dur: 12, col: '#d8a050', radius: 90, boneMult: 1.5 },
  bloom:   { name: 'Lily Bloom', desc: 'Heals 35% now + regen', dur: 5, col: '#ff8fb8', heal: 0.35, regen: 4 },
  berry:   { name: 'Wildberry Snack', desc: '+30% attack damage', dur: 8, col: '#a05ad8', dmgMult: 1.3 },
};
// Power-up upgrades: levels 1-3, bought with play-earned Bones, gated by player level. Values are TOTAL bonus at that level.
export const PU_MAX = 3;
export const PU_UPGRADES = {
  zoomies: [{ level: 4, bones: 30, dur: 2, speed: 0.05 }, { level: 8, bones: 60, dur: 4, speed: 0.1 }, { level: 12, bones: 100, dur: 6, speed: 0.15 }],
  shield:  [{ level: 4, bones: 30, hits: 1 }, { level: 8, bones: 60, hits: 1, dur: 4 }, { level: 12, bones: 100, hits: 2, dur: 6 }],
  magnet:  [{ level: 4, bones: 30, radius: 20 }, { level: 8, bones: 60, radius: 35, boneMult: 0.1 }, { level: 12, bones: 100, radius: 50, boneMult: 0.25, dur: 4 }],
  bloom:   [{ level: 4, bones: 30, heal: 0.05 }, { level: 8, bones: 60, heal: 0.1, regen: 2 }, { level: 12, bones: 100, heal: 0.15, regen: 4, dur: 2 }],
  berry:   [{ level: 4, bones: 30, dur: 2 }, { level: 8, bones: 60, dur: 3, dmgMult: 0.05 }, { level: 12, bones: 100, dur: 4, dmgMult: 0.1 }],
};
export const puLevel = (p, id) => Math.max(0, Math.min(PU_MAX, ensure(p).pu[id] || 0));
export function puStats(p, id) { const d = POWERUPS[id]; if (!d) return null; const l = p ? puLevel(p, id) : 0, u = l ? PU_UPGRADES[id][l - 1] : {}, o = { ...d, lv: l };
  for (const k of ['dur', 'speed', 'hits', 'radius', 'boneMult', 'heal', 'regen', 'dmgMult']) if (u[k] != null && o[k] != null) o[k] = +(o[k] + u[k]).toFixed(3); return o; }
export function upgradePowerup(p, id) { const pw = ensure(p), l = puLevel(p, id); if (!POWERUPS[id]) return { ok: false, reason: 'Unknown' };
  if (l >= PU_MAX) return { ok: false, reason: 'Max level' }; const n = PU_UPGRADES[id][l];
  if ((p.level || 1) < n.level) return { ok: false, reason: `Reach level ${n.level}` };
  if ((p.bones || 0) < n.bones) return { ok: false, reason: `Need ${n.bones} bones` };
  p.bones -= n.bones; pw.pu[id] = l + 1; return { ok: true, lv: l + 1 }; }

// ---- collar tiers: purely cosmetic look that follows total move tiers + power-up upgrades ----
// Original look: coat tint + collar band + paw-print trail. No glow column, no hair change, no pose.
export const COLLARS = [
  { id: 'plain', name: 'Plain Pup', min: 0 },
  { id: 'bronze', name: 'Bronze Collar', min: 3, collar: '#b87333', shade: '#7a4a20', gem: '#f0b080', trail: '#d08a4a', coat: { base: '#dc9a58', dark: '#a86a34', light: '#f8e4c8', ear: '#eab48a' } },
  { id: 'silver', name: 'Silver Collar', min: 7, collar: '#c8d0dc', shade: '#7a8494', gem: '#ffffff', trail: '#b8d4f0', coat: { base: '#dcc8ac', dark: '#a0928a', light: '#fbf8f4', ear: '#ead8ca' } },
  { id: 'gold', name: 'Gold Collar', min: 12, collar: '#e8c040', shade: '#a07a18', gem: '#ff7a9a', trail: '#ffd870', coat: { base: '#f0d09a', dark: '#c8964e', light: '#fffaf0', ear: '#f8dcb4' } },
  { id: 'moonstone', name: 'Moonstone Coat', min: 18, collar: '#8ab4d8', shade: '#4a6a9a', gem: '#c8fff4', trail: '#b8c8ff', coat: { base: '#c8d4ec', dark: '#8a94bc', light: '#f4f6ff', ear: '#dce2f6' } },
];
export const powerScore = (p) => { const pw = ensure(p); return pw.owned.reduce((s, id) => s + tierOf(p, id), 0) + POWERUP_IDS.reduce((s, id) => s + puLevel(p, id), 0); };
export const collarTier = (p) => { if (!p) return 0; const sc = powerScore(p); let t = 0; COLLARS.forEach((c, i) => { if (sc >= c.min) t = i; }); return t; };
export const POWERUP_IDS = Object.keys(POWERUPS);
// active: { id: { t: secondsLeft, max, hits? } }. Picking one up again refreshes its timer.
// active: { id: { t, max, hits?, ...effective stats } }. Pass the story save to apply its upgrades.
export function applyPowerup(active, id, p) { const d = puStats(p, id); if (!d) return null; const { name, desc, col, dur, lv, ...fx } = d; active[id] = { ...fx, t: dur, max: dur, lv }; return active[id]; }
export function tickPowerups(active, dt) { const ended = []; for (const k of Object.keys(active)) { active[k].t -= dt; if (active[k].t <= 0 || active[k].hits === 0) { delete active[k]; ended.push(k); } } return ended; }
export const has = (active, id) => !!active[id] && active[id].t > 0;
// Bone Shield: returns true when it soaked the hit.
export function shieldBlock(active) { const s = active.shield; if (!s || s.t <= 0 || !s.hits) return false; s.hits--; if (s.hits <= 0) delete active.shield; return true; }
// deterministic-ish pick for drops (rng injected for tests)
export const pickPowerup = (rng = Math.random) => POWERUP_IDS[Math.min(POWERUP_IDS.length - 1, Math.floor(rng() * POWERUP_IDS.length))];
export const DROP_CHANCE = 0.08;
