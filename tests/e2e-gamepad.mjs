// Gamepad e2e with a mocked navigator.getGamepads (standard mapping). Usage: node tests/e2e-gamepad.mjs [baseUrl] [shotDir]
import { chromium, devices } from 'playwright'; import { mkdirSync } from 'node:fs';
const BASE = process.argv[2] || 'http://localhost:8123/'; const OUT = process.argv[3] || '/tmp/pb-gamepad'; mkdirSync(OUT, { recursive: true });
const LOCAL = /localhost|127\.0\.0\.1/.test(BASE);
const results = []; const check = (name, cond, extra = '') => { results.push({ name, ok: !!cond }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
const PS_ID = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', XB_ID = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)';
const MOCK = () => {
  window.__pads = [null, null, null, null]; window.__gpCalls = 0;
  Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value() { window.__gpCalls++; return window.__pads; } });
  const mk = (id, index) => ({ id, index, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) });
  const ev = (type, p) => { const e = new Event(type); Object.defineProperty(e, 'gamepad', { value: p }); dispatchEvent(e); };
  window.__plug = (id, index = 0, silent = false) => { const p = mk(id, index); window.__pads[index] = p; if (!silent) ev('gamepadconnected', p); return true; };
  window.__unplug = (index = 0, silent = false) => { const p = window.__pads[index]; window.__pads[index] = null; if (p && !silent) ev('gamepaddisconnected', p); return true; };
  window.__btn = (i, on, index = 0) => { const b = window.__pads[index].buttons[i]; b.pressed = on; b.value = on ? 1 : 0; };
  window.__axes = (x, y, index = 0) => { window.__pads[index].axes[0] = x; window.__pads[index].axes[1] = y; };
};
const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const S = (page) => page.evaluate(() => { const G = window.__pb; return { state: G.state, menu: G.menu?.title ?? null, sel: G.menu?.sel, dialog: !!G.dialog, x: G.pl.x, y: G.pl.y, mode: G.mode, toast: G.toast?.msg || '', pad: G.pad, en: G.p?.energy, dashCD: G.pl.dashCD }; });
const btn = async (page, i, ms = 70) => { await page.evaluate((i) => window.__btn(i, true), i); await page.waitForTimeout(ms); await page.evaluate((i) => window.__btn(i, false), i); await page.waitForTimeout(60); };
const labels = (page) => page.evaluate(() => (window.__pb.menu._items || []).map((i) => i.label));
async function navTo(page, re) { const ls = await labels(page), want = ls.findIndex((l) => re.test(l)); if (want < 0) return false; let sel = (await S(page)).sel;
  for (let n = 0; n < 30 && sel !== want; n++) { await btn(page, want > sel ? B.DOWN : B.UP, 50); sel = (await S(page)).sel; } return sel === want; }
const watch = (page, errs) => { page.on('pageerror', (e) => errs.push('pageerror ' + e.message)); page.on('console', (m) => { if (m.type() === 'error' && !(LOCAL && /404|Failed to load resource/.test(m.text()))) errs.push('console ' + m.text()); }); };
const ready = (page) => page.waitForFunction(() => window.__pb && window.__pb.state === 'title', null, { timeout: 20000 });
const browser = await chromium.launch();
{ const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); await ctx.addInitScript(MOCK); const page = await ctx.newPage(); const errs = []; watch(page, errs);
  await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page); await page.waitForTimeout(800);
  const idle = await page.evaluate(async () => { const c0 = window.__gpCalls; await new Promise((r) => setTimeout(r, 1000)); return window.__gpCalls - c0; });
  check('phone-light: no per-frame polling while no pad is connected', idle <= 1, `${idle} calls/s`);
  // hot-plug PS5
  await page.evaluate((id) => window.__plug(id), PS_ID); await page.waitForTimeout(250); let s = await S(page);
  check('hot-plug: DualSense detected as PS', s.pad?.kind === 'ps'); check('toast: PlayStation connected + button hints with glyphs', /PlayStation controller connected/.test(s.toast) && /\{a\}attack/.test(s.toast) && /\{b\}dodge/.test(s.toast) && /\{st\}menu/.test(s.toast), s.toast);
  await page.screenshot({ path: `${OUT}/toast-ps.png` });
  const busy = await page.evaluate(async () => { const c0 = window.__gpCalls; await new Promise((r) => setTimeout(r, 1000)); return window.__gpCalls - c0; });
  check('polls each frame while a pad is connected', busy > 20, `${busy} calls/s`);
  // title menu by pad
  const sel0 = (await S(page)).sel; await btn(page, B.DOWN); const sel1 = (await S(page)).sel; await btn(page, B.UP);
  check('title: D-pad moves the menu cursor', sel1 !== sel0 && (await S(page)).sel === sel0);
  await page.evaluate(() => window.__axes(0, 0.95)); await page.waitForTimeout(120); await page.evaluate(() => window.__axes(0, 0)); await page.waitForTimeout(80);
  check('title: left stick also navigates', (await S(page)).sel !== sel0); await btn(page, B.UP);
  // Pond Network > Pond Shop
  check('title: navigate to Pond Network', await navTo(page, /Pond Network/)); await btn(page, B.A); await page.waitForTimeout(150); check('pad A opens Pond Network', (await S(page)).menu === 'Pond Network');
  check('Pond Shop reachable by pad', await navTo(page, /Pond Shop/)); await btn(page, B.A); await page.waitForTimeout(150); check('pad A opens Pond Shop', (await S(page)).menu === 'Pond Shop');
  await btn(page, B.B); await page.waitForTimeout(100); check('pad B backs out of Pond Shop', (await S(page)).menu === 'Pond Network'); await btn(page, B.B); await page.waitForTimeout(100);
  // new game + dialog
  await navTo(page, /New Game/); await btn(page, B.A); await page.waitForTimeout(300); check('pad A starts a new game (dialog)', (await S(page)).dialog);
  for (let i = 0; i < 40 && (await S(page)).dialog; i++) await btn(page, B.A, 40); check('pad A advances + closes dialogs', !(await S(page)).dialog);
  await page.evaluate(() => { const G = window.__pb; G.enemies.length = 0; G.pl.x = 20.5 * 16; G.pl.y = 18 * 16; }); await page.waitForTimeout(100);
  // movement
  let p0 = await S(page); await page.evaluate(() => window.__axes(1, 0)); await page.waitForTimeout(500); await page.evaluate(() => window.__axes(0, 0)); let p1 = await S(page);
  check('left stick moves the hero', p1.x - p0.x > 20, `dx ${(p1.x - p0.x).toFixed(1)}`);
  await page.evaluate(() => window.__btn(14, true)); await page.waitForTimeout(400); await page.evaluate(() => window.__btn(14, false)); let p2 = await S(page);
  check('D-pad moves the hero', p1.x - p2.x > 15, `dx ${(p2.x - p1.x).toFixed(1)}`);
  await page.evaluate(() => window.__axes(0.15, 0.12)); await page.waitForTimeout(400); const p3 = await S(page); await page.evaluate(() => window.__axes(0, 0));
  check('deadzone: stick drift (0.15) does not move', Math.abs(p3.x - p2.x) < 0.5 && Math.abs(p3.y - p2.y) < 0.5);
  // buttons
  await btn(page, B.B); check('B / Circle = dodge (dash)', (await S(page)).dashCD > 0); await page.waitForTimeout(500);
  const e0 = (await S(page)).en; await btn(page, B.Y); check('Y / Triangle = Howl Wave', (await S(page)).en < e0);
  await page.evaluate(() => { const G = window.__pb; G.p.level = 3; G.checkPowerUnlocks(); G.p.powers.owned.push('pounce', 'bark'); G.p.powers.eq = 'spin'; G.cds = {}; });
  await btn(page, B.X); let lp = await page.evaluate(() => ({ lp: window.__pb.lastPower, cd: window.__pb.cds.spin })); check('X / Square = use power (Tail Spin)', lp.lp?.id === 'spin' && lp.cd > 2);
  await btn(page, B.X); check('X again respects cooldown', (await page.evaluate(() => window.__pb.lastPower.t)) === lp.lp.t);
  await btn(page, B.RB); check('RB / R1 = swap power', (await page.evaluate(() => window.__pb.p.powers.eq)) === 'pounce');
  await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/play-prompts-ps.png` });
  // Start = pause, menus
  await btn(page, B.START); await page.waitForTimeout(120); check('Start / Options pauses (pause menu)', (await S(page)).menu === 'Menu' || !!(await S(page)).menu, (await S(page)).menu);
  check('pause: navigate to Sound & feel', await navTo(page, /Sound & feel/)); await btn(page, B.A); await page.waitForTimeout(120); check('Sound & feel opened by pad', (await S(page)).menu === 'Sound & feel');
  await navTo(page, /Stick deadzone/); await btn(page, B.RIGHT); const dz = await page.evaluate(() => window.__pb.settings.padDeadzone); check('D-pad right adjusts stick deadzone (default 0.2 -> 0.25)', dz === 0.25, String(dz));
  await page.waitForTimeout(150); await page.screenshot({ path: `${OUT}/menu-pad.png` });
  await btn(page, B.LEFT); await btn(page, B.B); await page.waitForTimeout(100); const pm = (await S(page)).menu; check('B backs to pause menu', pm && pm !== 'Sound & feel', pm);
  if (await navTo(page, /^Powers/)) { await btn(page, B.A); await page.waitForTimeout(120); check('Powers menu opened by pad', (await S(page)).menu === 'Powers'); await btn(page, B.DOWN); await btn(page, B.B); await page.waitForTimeout(100); }
  await btn(page, B.START); await page.waitForTimeout(120); check('Start closes the menus and resumes', (await S(page)).menu === null && (await S(page)).state === 'play');
  // end screen (noBack): pad navigates, Start cannot dismiss it
  await page.evaluate(() => window.__pb.die()); await page.waitForTimeout(200); let es = await S(page);
  check('end screen shown', /fainted/i.test(es.menu || ''), es.menu); await btn(page, B.START); await page.waitForTimeout(100); check('Start does not dismiss an end screen', /fainted/i.test((await S(page)).menu || ''));
  await btn(page, B.DOWN); check('end screen: D-pad navigates', (await S(page)).sel === 1); await btn(page, B.UP); await btn(page, B.A); await page.waitForTimeout(300);
  check('end screen: A picks Continue', (await S(page)).menu === null && (await S(page)).state === 'play');
  // hot-unplug while holding the stick: movement stops
  await page.evaluate(() => window.__axes(1, 0)); await page.waitForTimeout(200); await page.evaluate(() => window.__unplug()); await page.waitForTimeout(150); s = await S(page);
  check('hot-unplug: disconnected toast + pad cleared', /controller disconnected/.test(s.toast) && !s.pad, s.toast); await page.waitForTimeout(150); const u0 = await S(page); await page.waitForTimeout(300);
  check('hot-unplug: held stick released (hero stops)', Math.abs((await S(page)).x - u0.x) < 0.5);
  // keyboard still works
  const k0 = await S(page); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(300); await page.keyboard.up('ArrowRight'); check('keyboard still moves the hero', (await S(page)).x - k0.x > 10);
  // Xbox hot-plug
  await page.evaluate((id) => window.__plug(id, 1), XB_ID); await page.waitForTimeout(250); s = await S(page);
  check('hot-plug: Xbox detected + Xbox toast', s.pad?.kind === 'xbox' && /Xbox controller connected/.test(s.toast), s.toast); await page.screenshot({ path: `${OUT}/toast-xbox.png` });
  await page.evaluate(() => { window.__btn(0, true, 1); }); await page.waitForTimeout(80); await page.evaluate(() => { window.__btn(0, false, 1); }); await page.waitForTimeout(50);
  check('second slot pad drives the game', (await page.evaluate(() => window.__pb.pl.atk > 0 || window.__pb.pl.comboT > 0)));
  // generic pad via polling fallback (no connect event)
  await page.evaluate(() => { window.__unplug(1); }); await page.waitForTimeout(200);
  await page.evaluate(() => window.__plug('8BitDo SN30 Pro (Vendor: 2dc8)', 2, true)); await page.waitForTimeout(2400);
  check('hot-plug: polling fallback finds a pad without an event (generic glyphs)', (await S(page)).pad?.kind === 'generic');
  await page.evaluate(() => window.__unplug(2, true)); await page.waitForTimeout(200); check('polling notices a silent unplug', !(await S(page)).pad);

  // ---- fairness: prize run (Hunt), same speed / no turbo / same cooldown / powers off ----
  await page.evaluate((id) => window.__plug(id), PS_ID); await page.waitForTimeout(100);
  await page.evaluate(() => { const G = window.__pb; G.startRun('hunt'); G.dialog = null; G.menu = null; }); await page.waitForTimeout(400);
  const place = () => page.evaluate(() => { const G = window.__pb; G.enemies.length = 0; G.pl.x = 20.5 * 16; G.pl.y = 9 * 16; G.pl.dashCD = 0; G.pl.dash = 0; });
  await place(); await page.waitForTimeout(100); let a = await S(page); await page.keyboard.down('ArrowDown'); await page.waitForTimeout(600); await page.keyboard.up('ArrowDown'); const kd = (await S(page)).y - a.y;
  await place(); await page.waitForTimeout(100); a = await S(page); await page.evaluate(() => window.__axes(0, 1)); await page.waitForTimeout(600); await page.evaluate(() => window.__axes(0, 0)); const pd = (await S(page)).y - a.y;
  await place(); await page.waitForTimeout(100); a = await S(page); await page.evaluate(() => window.__axes(0.7071, 0.7071)); await page.waitForTimeout(600); await page.evaluate(() => window.__axes(0, 0)); const dd = Math.hypot((await S(page)).x - a.x, (await S(page)).y - a.y);
  check('fairness: pad full-tilt speed == keyboard speed (within 10%)', kd > 20 && Math.abs(pd - kd) / kd < 0.1, `key ${kd.toFixed(1)} pad ${pd.toFixed(1)}`);
  check('fairness: diagonal stick not faster than keys', dd <= kd * 1.1, `diag ${dd.toFixed(1)}`);
  const swings = (fn) => page.evaluate(async (fn) => { const G = window.__pb; let n = 0, prev = G.pl.atk; const t0 = performance.now(); await new Promise((r) => { const f = () => { if (G.pl.atk > prev + 0.01) n++; prev = G.pl.atk; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); return n; }, fn);
  await place(); let sp = swings(); await page.keyboard.down('KeyJ'); const kn = await sp; await page.keyboard.up('KeyJ'); await page.waitForTimeout(400);
  await place(); sp = swings(); await page.evaluate(() => window.__btn(0, true)); const pn = await sp; await page.evaluate(() => window.__btn(0, false)); await page.waitForTimeout(400);
  check('fairness: holding A = one attack, same as holding J (no turbo / auto-fire)', pn === kn && pn === 1, `key ${kn} pad ${pn}`);
  await place(); await page.keyboard.down('Space'); await page.waitForTimeout(40); await page.keyboard.up('Space'); const kcd = (await S(page)).dashCD; await page.waitForTimeout(600);
  await place(); await btn(page, B.B, 40); const pcd = (await S(page)).dashCD;
  check('fairness: pad dodge cooldown == keyboard dodge cooldown', Math.abs(kcd - pcd) < 0.12 && pcd > 0.2, `key ${kcd.toFixed(2)} pad ${pcd.toFixed(2)}`);
  const lp0 = await page.evaluate(() => window.__pb.lastPower); await btn(page, B.X); s = await S(page);
  check('fairness: powers stay off in prize runs on pad too', JSON.stringify(await page.evaluate(() => window.__pb.lastPower)) === JSON.stringify(lp0) && /off in prize runs/.test(s.toast), s.toast);
  check('desktop: no console errors', errs.length === 0, errs.slice(0, 3).join(' / ')); await ctx.close(); }
// phone landscape: touch still works with a pad attached, then pad toast
{ const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 } }); await ctx.addInitScript(MOCK); const page = await ctx.newPage(); const errs = []; watch(page, errs);
  await page.goto(BASE); await ready(page); await page.waitForTimeout(600);
  await page.evaluate(() => { const G = window.__pb; G.newGame(); G.dialog = null; G.menu = null; }); await page.waitForTimeout(200);
  await page.evaluate((id) => window.__plug(id), PS_ID); await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/phone-toast-ps.png` });
  const t0 = await S(page); const box = await page.locator('#stick').boundingBox();
  if (box) { await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); }
  check('phone: touch input switches prompts off pad', !(await page.evaluate(() => window.__pb.PAD.active)));
  check('phone: pad toast on touch device', t0.pad?.kind === 'ps');
  check('phone: no console errors', errs.length === 0, errs.slice(0, 3).join(' / ')); await ctx.close(); }
await browser.close();
const bad = results.filter((r) => !r.ok); console.log(`${results.length - bad.length}/${results.length} checks passed`); process.exit(bad.length ? 1 : 0);
