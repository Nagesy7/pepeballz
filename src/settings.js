// Player settings (sound + game feel), persisted locally. Old saves don't have it: defaults apply.
export const SETTINGS_KEY = 'pepeballz.settings.v1';
export const DEFAULTS = { muted: false, volume: 0.7, ambience: true, shake: true, hitstop: true, fx: 'auto' };
export function load(storage) { let s = null; try { s = JSON.parse(storage.getItem(SETTINGS_KEY) || 'null'); } catch {} const o = { ...DEFAULTS, ...(s && typeof s === 'object' ? s : {}) };
  o.volume = Math.max(0, Math.min(1, Math.round(Number(o.volume) * 10) / 10 || 0)); if (!Number.isFinite(o.volume)) o.volume = DEFAULTS.volume; return o; }
export const save = (storage, s) => storage.setItem(SETTINGS_KEY, JSON.stringify(s));
