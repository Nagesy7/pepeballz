// Gamepad support (Bluetooth / USB PS5 DualSense, Xbox and generic pads) via the standard Gamepad API mapping.
// Pure helpers (no DOM) so they can be unit-tested. Pads only feed the same digital actions + a normalised stick as the
// keyboard / touch stick: no turbo, no auto-fire, no aim assist, same speed and cooldowns (prize runs stay fair).
export const DEFAULT_DEADZONE = 0.2;
export const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
// PS: 054c = Sony vendor id; Xbox: 045e = Microsoft vendor id.
export function padKind(id = '') { const s = String(id).toLowerCase();
  if (/054c|sony|dualsense|dualshock|playstation|ps[345]/.test(s)) return 'ps';
  if (/045e|xbox|xinput|microsoft/.test(s)) return 'xbox'; return 'generic'; }
export const KIND_NAME = { ps: 'PlayStation', xbox: 'Xbox', generic: 'Gamepad' };
// glyph labels per kind (the game draws PS shapes as icons; these names are for text / aria / tests)
export const GLYPHS = {
  ps: { a: 'Cross', b: 'Circle', x: 'Square', y: 'Triangle', lb: 'L1', rb: 'R1', lt: 'L2', rt: 'R2', st: 'Options', bk: 'Create' },
  xbox: { a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT', st: 'Menu', bk: 'View' },
  generic: { a: '1', b: '2', x: '3', y: '4', lb: 'L1', rb: 'R1', lt: 'L2', rt: 'R2', st: 'Start', bk: 'Select' },
};
// Play-mode mapping (button -> game action). B/Circle = dodge (the game's dash). In menus/dialogs B = back.
export const PLAY_MAP = { [BTN.A]: 'atk', [BTN.B]: 'dash', [BTN.X]: 'power', [BTN.Y]: 'blast', [BTN.LB]: 'charge', [BTN.RB]: 'swap',
  [BTN.LT]: 'dash', [BTN.RT]: 'ascend', [BTN.BACK]: 'mute', [BTN.UP]: 'up', [BTN.DOWN]: 'down', [BTN.LEFT]: 'left', [BTN.RIGHT]: 'right' };
export const MENU_MAP = { ...PLAY_MAP, [BTN.B]: 'back', [BTN.LT]: 'back', [BTN.X]: 'power', [BTN.RB]: 'swap' };
// Radial deadzone, rescaled so movement starts smoothly at the edge; magnitude never exceeds 1 (same as keys).
export function applyDeadzone(x = 0, y = 0, dz = DEFAULT_DEADZONE) {
  const m = Math.hypot(x, y); if (!(m > dz)) return [0, 0]; const k = Math.min(1, (m - dz) / (1 - dz)) / m; return [x * k, y * k]; }
const down = (b) => !!b && (typeof b === 'object' ? b.pressed || b.value > 0.5 : b > 0.5);
// Read one pad into { stick:[x,y], held:{action:true}, start:boolean, any:boolean }
export function readPad(pad, { menu = false, deadzone = DEFAULT_DEADZONE } = {}) {
  const map = menu ? MENU_MAP : PLAY_MAP, held = {}; let any = false;
  (pad.buttons || []).forEach((b, i) => { if (down(b)) { any = true; const a = map[i]; if (a) held[a] = true; } });
  const [sx, sy] = applyDeadzone(pad.axes?.[0] || 0, pad.axes?.[1] || 0, deadzone); if (sx || sy) any = true;
  return { stick: [sx, sy], held, start: down(pad.buttons?.[BTN.START]), any };
}
// Pick the first connected standard pad from navigator.getGamepads()
export const firstPad = (list) => [...(list || [])].find((p) => p && p.connected !== false) || null;
// Edge detector: turns held states into one press per physical press (no repeat / turbo while held).
export function createEdges() { let prev = {}; return (held) => { const pressed = {}, released = {};
  for (const a in held) if (held[a] && !prev[a]) pressed[a] = true; for (const a in prev) if (prev[a] && !held[a]) released[a] = true; prev = { ...held }; return { pressed, released }; }; }
