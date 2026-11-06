// First-run power guide: one-time tooltips + "new upgrade" badge. Pure module (no DOM) so unit tests can import it.
// Story mode only. Never touches economy, prize boards, or Hunt/Boss Rush/Tourney builds.
import { ABILITY_IDS, POWERUP_IDS, PU_MAX, PU_UPGRADES, nextTier, puLevel, ensure, COLLARS } from './powers.js';

export const KEYS = {
  upgrades: 'inu.guide.upgrades',
  collar: 'inu.guide.collar',
  badge: 'inu.guide.badge',
  skip: 'inu.guide.skip',
};

// Plain, friendly copy. No urgency / prize words. No Dragon Ball terms. No $KIBBLE needed.
export const COPY = {
  upgrades: {
    id: 'upgrades',
    title: 'Powers upgrades',
    body: 'When you level up, open Menu and tap Powers. Spend Bones you earned in play to upgrade moves and power-ups. Story mode only — Hunt, Boss Rush and Tourney keep a shared build.',
  },
  collar: {
    id: 'collar',
    title: 'Collar looks',
    body: 'As you upgrade, your look steps up: Plain Pup, then Bronze, Silver, Gold Collar, and Moonstone Coat. Looks only — they never change how hard you hit.',
  },
  ok: 'Got it',
  skip: 'Skip tips',
  badge: 'new',
};

// Soft ban list for tip copy (urgency / prize / Dragon Ball). Kept local so tests can assert.
export const BANNED = /hurry|limited|last chance|don't miss|guarantee|profit|prize|aura|saiyan|transform|power level|kamehameha|scouter|ki blast/i;

export function seen(store, id) {
  try {
    if (store?.getItem(KEYS.skip)) return true;
    return !!store?.getItem(KEYS[id] || id);
  } catch { return true; } // storage blocked: stay quiet
}

export function markSeen(store, id) {
  try { store?.setItem(KEYS[id] || id, '1'); } catch {}
}

export function skipAll(store) {
  try {
    store?.setItem(KEYS.skip, '1');
    store?.setItem(KEYS.upgrades, '1');
    store?.setItem(KEYS.collar, '1');
    store?.removeItem(KEYS.badge);
  } catch {}
}

export function badgeOn(store) {
  try { return store?.getItem(KEYS.badge) === '1'; } catch { return false; }
}

export function setBadge(store, on = true) {
  try {
    if (on) store?.setItem(KEYS.badge, '1');
    else store?.removeItem(KEYS.badge);
  } catch {}
}

export function clearBadge(store) { setBadge(store, false); }

// True when the player can buy at least one move tier or power-up upgrade right now.
export function hasAffordableUpgrade(p) {
  if (!p) return false;
  ensure(p);
  const lv = p.level || 1, bones = p.bones || 0;
  for (const id of ABILITY_IDS) {
    const n = nextTier(p, id);
    if (n && lv >= n.level && bones >= n.bones) return true;
  }
  for (const id of POWERUP_IDS) {
    const l = puLevel(p, id);
    if (l >= PU_MAX) continue;
    const n = PU_UPGRADES[id][l];
    if (n && lv >= n.level && bones >= n.bones) return true;
  }
  return false;
}

// Collar tier names in order (for tip body / tests).
export const COLLAR_NAMES = COLLARS.map((c) => c.name);

export function tipFor(id) {
  return id === 'collar' ? COPY.collar : COPY.upgrades;
}

// Should we offer the upgrades tip after a level-up? (caller still decides pause timing)
export function shouldOfferUpgrades(store, p, { leveled = false } = {}) {
  if (!leveled || !p || seen(store, 'upgrades')) return false;
  return hasAffordableUpgrade(p);
}

export function shouldOfferCollar(store, fromTier, toTier) {
  if (seen(store, 'collar')) return false;
  return (toTier | 0) > (fromTier | 0) && (toTier | 0) >= 1;
}
