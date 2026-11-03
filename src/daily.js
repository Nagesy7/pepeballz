// Daily challenge: one rotating challenge per Sydney calendar date (Australia/Sydney), the same for every player.
// Rewards are Bones + cosmetic unlocks ONLY. No wagers, no fees, no $KIBBLE cost, no effect on prize boards or eligibility.
// Progress is saved locally under its own key (old saves are untouched) and works with no wallet.
export const DAILY_KEY = 'pepeballz.daily.v1';
export const TZ = 'Australia/Sydney';
// ev = event name the game reports; uniq = count distinct keys (areas visited, villagers met) instead of a running total.
export const CHALLENGES = [
  { id: 'fireflies', name: 'Firefly Night', desc: 'Catch 10 fireflies', ev: 'firefly', goal: 10, bones: 40, reward: 'daily_firefly' },
  { id: 'kits', name: 'Kit Patrol', desc: 'Defeat 5 Catnip Kits', ev: 'kit', goal: 5, bones: 35, reward: 'daily_kits' },
  { id: 'butterflies', name: 'Butterfly Chase', desc: 'Catch 6 butterflies', ev: 'butterfly', goal: 6, bones: 35, reward: 'daily_meadow' },
  { id: 'howl', name: 'Howl Practice', desc: 'Land 12 Howl Wave hits', ev: 'howl', goal: 12, bones: 40, reward: 'daily_howl' },
  { id: 'explore', name: 'Trail Sniffer', desc: 'Visit all 3 areas', ev: 'visit', goal: 3, uniq: true, bones: 30, reward: 'daily_trail' },
  { id: 'boars', name: 'Boar Bonk', desc: 'Defeat 3 Wild Boars', ev: 'boar', goal: 3, bones: 45, reward: 'daily_boar' },
  { id: 'friends', name: 'Good Neighbour', desc: 'Chat with 4 villagers', ev: 'talk', goal: 4, uniq: true, bones: 30, reward: 'daily_friend' },
  { id: 'bones', name: 'Bone Collector', desc: 'Earn 60 Bones', ev: 'bones', goal: 60, bones: 30, reward: 'daily_picnic' },
];
// Sydney calendar date as YYYY-MM-DD for a timestamp (DST handled by Intl).
export function sydneyDate(ms = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms));
  const g = (t) => parts.find((p) => p.type === t).value; return `${g('year')}-${g('month')}-${g('day')}`;
}
export const dayNumber = (date) => Math.round(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 864e5);
// Stride 3 is coprime with 8: every challenge appears once per 8 days and never twice in a row.
export const challengeFor = (date) => CHALLENGES[(((dayNumber(date) * 3 + 1) % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length];
export function fresh(date, prev = {}) {
  return { v: 1, date, id: challengeFor(date).id, n: 0, keys: [], done: false, bank: prev.bank || 0, unlocked: [...(prev.unlocked || [])], streak: prev.streak || 0, total: prev.total || 0, lastDone: prev.lastDone || null };
}
// Load (or roll over to today). Unknown / corrupt data starts fresh; unlocks + unclaimed bones always carry over.
export function load(storage, ms = Date.now()) {
  const date = sydneyDate(ms); let s = null; try { s = JSON.parse(storage.getItem(DAILY_KEY) || 'null'); } catch {}
  if (!s || s.v !== 1) return fresh(date);
  if (s.date !== date) return fresh(date, s);
  s.keys ||= []; s.unlocked ||= []; s.bank ||= 0; return s;
}
export const save = (storage, s) => storage.setItem(DAILY_KEY, JSON.stringify(s));
export const current = (s) => CHALLENGES.find((c) => c.id === s.id) || challengeFor(s.date);
export const progress = (s) => { const c = current(s); return Math.min(c.goal, c.uniq ? s.keys.length : s.n); };
// Report an event. Returns { completed: challenge } the moment the goal is reached (once per day), else null.
export function track(s, ev, amount = 1, key) {
  const c = current(s); if (s.done || c.ev !== ev) return null;
  if (c.uniq) { if (key == null || s.keys.includes(key)) return null; s.keys.push(key); } else s.n += Math.max(0, amount | 0 || 0);
  const have = c.uniq ? s.keys.length : s.n; if (have < c.goal) return null;
  s.done = true; s.bank += c.bones; s.total = (s.total || 0) + 1;
  const prevDay = s.lastDone ? dayNumber(s.lastDone) : -9; s.streak = prevDay === dayNumber(s.date) - 1 ? (s.streak || 0) + 1 : 1; s.lastDone = s.date;
  const isNew = !s.unlocked.includes(c.reward); if (isNew) s.unlocked.push(c.reward);
  return { completed: c, cosmetic: c.reward, newCosmetic: isNew, bones: c.bones };
}
// Hand banked Bones to the story player (bones are free, never cashed out). Returns the amount moved.
export function claimBank(s, player) { const b = s.bank || 0; if (!b || !player) return 0; player.bones = (player.bones || 0) + b; s.bank = 0; return b; }
