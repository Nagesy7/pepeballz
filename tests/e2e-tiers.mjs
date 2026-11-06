// Power tiers / power-up upgrades / collar look e2e (pad-navigated menu, stats, combos, prize neutrality, migration, phone FPS).
// Usage: node tests/e2e-tiers.mjs [baseUrl] [shotDir]
import { chromium } from 'playwright'; import { mkdirSync } from 'node:fs';
const BASE = process.argv[2] || 'http://localhost:8123/'; const OUT = process.argv[3] || '/tmp/pb-tiers'; mkdirSync(OUT, { recursive: true });
const LOCAL = /localhost|127\.0\.0\.1/.test(BASE);
const results = []; const check = (name, cond, extra = '') => { results.push({ name, ok: !!cond }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
const MOCK = () => {
  window.__pads = [null, null, null, null];
  Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value() { return window.__pads; } });
  const mk = (id, index) => ({ id, index, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) });
  window.__plug = (id, index = 0) => { const p = mk(id, index); window.__pads[index] = p; const e = new Event('gamepadconnected'); Object.defineProperty(e, 'gamepad', { value: p }); dispatchEvent(e); };
  window.__btn = (i, on, index = 0) => { const b = window.__pads[index].buttons[i]; b.pressed = on; b.value = on ? 1 : 0; };
};
const B = { A: 0, B: 1, START: 9, UP: 12, DOWN: 13 };
const S = (page) => page.evaluate(() => { const G = window.__pb; return { state: G.state, menu: G.menu?.title ?? null, sel: G.menu?.sel, toast: G.toast?.msg || '', mode: G.mode, bones: G.p?.bones }; });
const btn = async (page, i, ms = 70) => { await page.evaluate((i) => window.__btn(i, true), i); await page.waitForTimeout(ms); await page.evaluate((i) => window.__btn(i, false), i); await page.waitForTimeout(80); };
const labels = (page) => page.evaluate(() => (window.__pb.menu?._items || []).map((i) => i.label));
async function navTo(page, re) { const ls = await labels(page), want = ls.findIndex((l) => re.test(l)); if (want < 0) return false; let sel = (await S(page)).sel;
  for (let n = 0; n < 30 && sel !== want; n++) { await btn(page, want > sel ? B.DOWN : B.UP, 50); sel = (await S(page)).sel; } return sel === want; }
const watch = (page, errs) => { page.on('pageerror', (e) => errs.push('pageerror ' + e.message)); page.on('console', (m) => { if (m.type() === 'error' && !(LOCAL && /404|Failed to load resource/.test(m.text()))) errs.push('console ' + m.text()); }); };
const ready = (page) => page.waitForFunction(() => window.__pb && window.__pb.state === 'title', null, { timeout: 20000 });
const story = (page) => page.evaluate(() => { const G = window.__pb; G.newGame(); G.dialog = null; G.menu = null; G.cut = null; G.state = 'play'; G.enemies.length = 0; });
const setPow = (page, o) => page.evaluate((o) => { const G = window.__pb, p = G.p, PW = G.PW; PW.ensure(p); Object.assign(p, o.p || {}); if (o.owned) { p.powers.owned = [...o.owned]; p.powers.eq = o.eq || o.owned[0]; }
  if (o.tiers) p.powers.tiers = { ...o.tiers }; if (o.pu) p.powers.pu = { ...o.pu }; if (o.look != null) p.powers.look = o.look; G.cds = {}; }, o);
const ALL3 = { spin: 3, pounce: 3, bark: 3 }, ALLPU = { zoomies: 3, shield: 3, magnet: 3, bloom: 3, berry: 3 };
const clipHero = async (page, w = 260, h = 220) => { const c = await page.evaluate(() => window.__camDbg); const s = await page.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x, y: r.y }; });
  return { x: Math.max(0, s.x + c.px - w / 2 + 40), y: Math.max(0, s.y + c.py - h / 2 + 30), width: w, height: h }; };
const browser = await chromium.launch();
{ const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); await ctx.addInitScript(MOCK); const page = await ctx.newPage(); const errs = []; watch(page, errs);
  await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page); await page.waitForTimeout(600);
  await page.evaluate(() => { window.__pb.GD.skipAll(localStorage); window.__pb.dismissGuide?.(true); }); // first-run tip covered by e2e-guide.mjs
  await story(page); await page.evaluate(() => window.__plug('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)')); await page.waitForTimeout(200);
  await setPow(page, { p: { level: 4, bones: 1000 }, owned: [], look: 0 });
  // ---- controller: Start > Powers > learn > Upgrade moves (gated, then bought) ----
  await btn(page, B.START); await page.waitForTimeout(120); check('pad: Start opens the pause menu', (await S(page)).menu !== null);
  check('pad: Powers item reachable', await navTo(page, /^Powers/)); await btn(page, B.A); await page.waitForTimeout(120); check('pad: Powers menu opens', (await S(page)).menu === 'Powers');
  const pl = await labels(page); check('Powers menu lists upgrades + combos', pl.some((l) => /Upgrade moves/.test(l)) && pl.some((l) => /Upgrade power-ups/.test(l)) && pl.some((l) => /Combos/.test(l)), pl.join(' | '));
  await navTo(page, /^Tail Spin/); await btn(page, B.A); let s = await S(page); check('pad: learn Tail Spin with Bones (1000 -> 960)', s.bones === 960, `bones ${s.bones}`);
  check('Powers info: Bones only, never $KIBBLE', await page.evaluate(() => window.__pb.menu.info().join(' ').includes('Never sold for $KIBBLE')));
  await navTo(page, /^Upgrade moves/); await btn(page, B.A); await page.waitForTimeout(100); check('pad: Move Tiers menu opens', (await S(page)).menu === 'Move Tiers');
  check('gated tier shown as Lv5 needed', (await labels(page))[0].includes('Lv5 needed'), (await labels(page))[0]);
  await navTo(page, /^Tail Spin/); await btn(page, B.A); s = await S(page); check('level gate: Lv4 cannot buy Tier 2 (no Bones taken)', s.bones === 960 && (await page.evaluate(() => window.__pb.PW.tierOf(window.__pb.p, 'spin'))) === 1);
  await page.evaluate(() => { window.__pb.p.level = 12; }); await btn(page, B.A); s = await S(page);
  check('pad: buy Tail Spin Tier 2 at Lv12 (-60 Bones)', s.bones === 900 && (await page.evaluate(() => window.__pb.PW.tierOf(window.__pb.p, 'spin'))) === 2, `bones ${s.bones}`);
  await btn(page, B.A); check('pad: buy Tier 3 (-140 Bones)', (await S(page)).bones === 760 && (await page.evaluate(() => window.__pb.PW.tierOf(window.__pb.p, 'spin'))) === 3);
  await btn(page, B.DOWN); await page.waitForTimeout(150); await page.screenshot({ path: `${OUT}/menu-move-tiers.png` });
  await btn(page, B.B); await page.waitForTimeout(100); check('pad: B backs out to Powers', (await S(page)).menu === 'Powers');
  await page.screenshot({ path: `${OUT}/menu-powers.png` });
  await navTo(page, /^Upgrade power-ups/); await btn(page, B.A); await page.waitForTimeout(100); check('pad: Power-up Upgrades opens', (await S(page)).menu === 'Power-up Upgrades');
  await btn(page, B.A); check('pad: Zoomies L1 bought (-30 Bones)', (await page.evaluate(() => window.__pb.PW.puLevel(window.__pb.p, 'zoomies'))) === 1 && (await S(page)).bones === 730);
  await page.screenshot({ path: `${OUT}/menu-powerup-upgrades.png` });
  await btn(page, B.B); await btn(page, B.B); await btn(page, B.B); await page.waitForTimeout(150);
  check('pad: backs all the way out to play', (await S(page)).menu === null && (await S(page)).state === 'play');
  // ---- stat scaling in play (story) ----
  const use = (page, id) => page.evaluate((id) => { const G = window.__pb; G.p.powers.eq = id; G.cds = {}; G.lastLand = null; G.usePower(); return { lp: G.lastPower, cd: G.cds[id] }; }, id);
  await setPow(page, { owned: ['spin', 'pounce', 'bark'], tiers: { spin: 1, pounce: 1, bark: 1 } }); const t1 = await use(page, 'spin');
  await setPow(page, { tiers: ALL3 }); const t3 = await use(page, 'spin');
  check('Tail Spin T3 vs T1: bigger radius, more damage, shorter cooldown', t3.lp.radius > t1.lp.radius && t3.lp.dmg > t1.lp.dmg && t3.cd < t1.cd, `T1 r${t1.lp.radius} d${t1.lp.dmg} cd${t1.cd} / T3 r${t3.lp.radius} d${t3.lp.dmg} cd${t3.cd}`);
  await page.waitForTimeout(500); const b1 = await page.evaluate(() => { const G = window.__pb; G.p.powers.tiers.bark = 1; G.p.powers.eq = 'bark'; G.cds = {}; G.usePower(); return { r: G.rings[G.rings.length - 1].r, cd: G.cds.bark }; });
  await page.waitForTimeout(600); const b3 = await page.evaluate(() => { const G = window.__pb; G.p.powers.tiers.bark = 3; G.cds = {}; G.usePower(); return { r: G.rings[G.rings.length - 1].r, tier: G.rings[G.rings.length - 1].tier, cd: G.cds.bark }; });
  check('Bark Shockwave T3: wider coloured rings + shorter cooldown', b3.r > b1.r && b3.tier === 3 && b3.cd < b1.cd, JSON.stringify({ b1, b3 }));
  // ---- combo: Pounce landing -> Paw Twister ----
  await page.waitForTimeout(600); await page.evaluate(() => { const G = window.__pb; G.p.powers.eq = 'pounce'; G.cds = {}; G.lastCombo = null; G.usePower(); }); await page.waitForTimeout(420);
  const combo = await page.evaluate(() => { const G = window.__pb; G.usePower(); return G.lastCombo?.id; }); check('combo: Pounce then power on landing = Paw Twister', combo === 'twister', combo);
  // ---- tier-3 power in use (screenshot with foes) ----
  await page.waitForTimeout(1800); await page.evaluate(() => { const G = window.__pb; for (let i = 0; i < 4; i++) G.spawnEnemyAt?.('kitten', G.pl.x + Math.cos(i * 1.6) * 30, G.pl.y + Math.sin(i * 1.6) * 20); G.p.powers.eq = 'spin'; G.cds = {}; G.lastLand = null; G.usePower(); });
  await page.waitForTimeout(140); await page.screenshot({ path: `${OUT}/tier3-tail-spin.png`, clip: await clipHero(page, 360, 260) });
  await page.waitForTimeout(700); await page.evaluate(() => { const G = window.__pb; G.p.powers.eq = 'bark'; G.cds = {}; G.usePower(); }); await page.waitForTimeout(160);
  await page.screenshot({ path: `${OUT}/tier3-bark-shockwave.png`, clip: await clipHero(page, 420, 300) });
  await page.evaluate(() => { const G = window.__pb; G.enemies.length = 0; G.shots && (G.shots.length = 0); });
  // ---- collar look per tier ----
  const looks = [];
  const tierSets = [{ owned: [], tiers: {}, pu: {} }, { owned: ['spin', 'pounce', 'bark'], tiers: { spin: 1, pounce: 1, bark: 1 }, pu: {} }, { owned: ['spin', 'pounce', 'bark'], tiers: { spin: 2, pounce: 2, bark: 2 }, pu: { zoomies: 1 } },
    { owned: ['spin', 'pounce', 'bark'], tiers: ALL3, pu: { zoomies: 1, shield: 1, magnet: 1 } }, { owned: ['spin', 'pounce', 'bark'], tiers: ALL3, pu: ALLPU }];
  for (let i = 0; i < tierSets.length; i++) { await setPow(page, { ...tierSets[i], look: 4 }); await page.waitForTimeout(80);
    const info = await page.evaluate(() => { const G = window.__pb, t = G.lookTier(), img = G.lookImg(G.heroFrame('golden', 0, 'down', 0, 'walk', {}), t); const g = img.getContext('2d'); let collar = null;
      if (t) { const c = G.PW.COLLARS[t].collar; const d = g.getImageData(0, 0, img.width, img.height).data; for (let k = 0; k < d.length; k += 4) if ('#' + [d[k], d[k + 1], d[k + 2]].map((v) => v.toString(16).padStart(2, '0')).join('') === c) { collar = c; break; } }
      return { t, name: G.PW.COLLARS[t].name, collar, trail: G.PW.COLLARS[t].trail }; }); looks.push(info);
    await page.evaluate(() => { window.__pb.paws.length = 0; }); const dir = i % 2 ? 'ArrowLeft' : 'ArrowRight'; await page.keyboard.down(dir); await page.waitForTimeout(450); await page.keyboard.up(dir); info.paws = await page.evaluate(() => window.__pb.paws.slice(-3).map((w) => w.col)); await page.waitForTimeout(100);
    await page.screenshot({ path: `${OUT}/pup-tier-${i}-${info.name.toLowerCase().replace(/ /g, '-')}.png`, clip: await clipHero(page, 240, 200) }); }
  check('look tiers step Plain > Bronze > Silver > Gold > Moonstone', looks.map((l) => l.t).join() === '0,1,2,3,4', looks.map((l) => l.name).join(' > '));
  check('each look paints its own collar colour on the pup', looks.slice(1).every((l) => l.collar));
  check('paw-print trail in the look colour while walking', looks.slice(1).every((l) => l.paws.length && l.paws.every((c) => c === l.trail)) && looks[0].paws.length === 0, JSON.stringify(looks.map((l) => l.paws[0] || '-')));
  // side-by-side lineup (big)
  await page.evaluate(() => { const G = window.__pb, c = document.createElement('canvas'), S = 6; c.id = 'lineup'; c.width = 5 * 40 * S; c.height = 56 * S; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#2a3a2a'; g.fillRect(0, 0, c.width, c.height);
    for (let t = 0; t <= 4; t++) { const im = G.lookImg(G.heroFrame('golden', 0, 'down', 0, 'walk', {}), t); g.drawImage(im, t * 40 * S + 3 * S, 2 * S, im.width * S, im.height * S); g.fillStyle = '#fff8e8'; g.font = `bold ${3.2 * S}px monospace`; g.textAlign = 'center'; g.fillText(G.PW.COLLARS[t].name, t * 40 * S + 20 * S, 52 * S); }
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: 99999, width: c.width / 2 + 'px' }); document.body.appendChild(c); });
  await page.locator('#lineup').screenshot({ path: `${OUT}/collar-lineup.png` }); await page.evaluate(() => document.getElementById('lineup').remove());
  // ---- tier-up paw-burst ----
  await setPow(page, { owned: ['spin', 'pounce', 'bark'], tiers: { spin: 3, pounce: 3, bark: 3 }, pu: { zoomies: 3, shield: 3, magnet: 2 }, look: 3, p: { bones: 500, level: 12 } });
  check('score 17 = Gold Collar', await page.evaluate(() => window.__pb.lookTier()) === 3);
  await page.evaluate(() => { const G = window.__pb; G.puUpMenu(); G.menu.items()[2].act(); });
  const fx = await page.evaluate(() => ({ fx: window.__pb.tierFx?.tier, banner: window.__pb.banner?.text })); check('tier-up: buying the step fires a paw-burst + banner', fx.fx === 4 && /Moonstone Coat/.test(fx.banner), JSON.stringify(fx));
  await page.evaluate(() => { window.__pb.menu = null; }); await page.waitForTimeout(260); await page.screenshot({ path: `${OUT}/tier-up-paw-burst.png`, clip: await clipHero(page, 320, 240) });
  await page.waitForTimeout(1400); check('paw-burst is one-shot (gone after 1.4s)', await page.evaluate(() => window.__pb.tierFx === null));
  // ---- power-up upgrades apply in story ----
  const pu = await page.evaluate(() => { const G = window.__pb; G.pu = {}; G.grabPowerup('zoomies'); G.grabPowerup('shield'); return { z: G.pu.zoomies, s: G.pu.shield }; });
  check('upgraded Zoomies/Bone Shield last longer and are stronger in story', pu.z.t === 14 && pu.z.speed === 1.6 && pu.s.hits === 5, JSON.stringify(pu));
  // ---- prize neutrality: maxed story vs fresh story give identical Hunt runs; look shows, stats don't ----
  const prize = async (maxed) => { await story(page); if (maxed) await setPow(page, { owned: ['spin', 'pounce', 'bark'], tiers: ALL3, pu: ALLPU, p: { level: 20, bones: 5000 } });
    return page.evaluate(async () => { const G = window.__pb; G.startRun('hunt'); G.dialog = null; G.menu = null; G.enemies.length = 0; await new Promise((r) => setTimeout(r, 300));
      const before = G.lastPower; G.usePower(); const used = G.lastPower !== before; G.grabPowerup && G.spawnPowerup; const d = G.C.derived(G.p); const x0 = G.pl.x;
      return { used, cds: JSON.stringify(G.cds), pu: JSON.stringify(G.pu), d: JSON.stringify(d), atk: G.C.attackDamage(G.p, 1, {}), powers: G.p.powers?.owned?.length || 0, look: G.lookTier(), x0 }; }); };
  const fr = await prize(false), mx = await prize(true);
  check('prize run: powers stay OFF (no move fires)', !fr.used && !mx.used && mx.cds === '{}' && mx.pu === '{}');
  check('prize run: identical stats + damage with or without story tiers', fr.d === mx.d && fr.atk === mx.atk && mx.powers === 0, `${fr.atk} vs ${mx.atk}`);
  check('prize run: collar look shows as cosmetic only', fr.look === 0 && mx.look === 4, `${fr.look} / ${mx.look}`);
  let spot = null; const sp = async () => { spot = spot || await page.evaluate(() => ({ x: window.__pb.pl.x, y: window.__pb.pl.y }));
    const r = await page.evaluate(async (spot) => { const G = window.__pb; G.pl.x = spot.x; G.pl.y = spot.y; G.enemies.length = 0; const ks = new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true });
      dispatchEvent(ks); const t0 = performance.now(), x0 = G.pl.x; await new Promise((r) => setTimeout(r, 400)); const v = (x0 - G.pl.x) / (performance.now() - t0) * 1000;
      const ku = new KeyboardEvent('keyup', { key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true }); dispatchEvent(ku); return v; }, spot); return r; };
  const dMax = await sp(); await page.screenshot({ path: `${OUT}/prize-run-look-cosmetic.png`, clip: await clipHero(page, 260, 200) });
  await prize(false); const dFresh = await sp(); check('prize run: same walk speed with maxed tiers (no Zoomies edge)', dFresh > 20 && Math.abs(dMax - dFresh) / dFresh < 0.15, `${dMax.toFixed(1)} vs ${dFresh.toFixed(1)} px/s`);
  // ---- save migration: old save (no tiers) continues fine ----
  await page.evaluate(() => { const G = window.__pb; const p = { ...G.C.newPlayer(), level: 7, bones: 90, powers: { owned: ['spin'], eq: 'spin' } }; localStorage.setItem(G.C.SAVE_KEY ?? 'pepeballz.save.v1', JSON.stringify({ v: 1, t: Date.now(), p })); });
  await page.reload(); await ready(page); await page.waitForTimeout(400);
  const mig = await page.evaluate(async () => { const G = window.__pb; const it = G.menu._items.find((i) => /Continue/.test(i.label)); it.act(); await new Promise((r) => setTimeout(r, 300)); G.dialog = null;
    return { tiers: G.p.powers.tiers, pu: G.p.powers.pu, cd: G.PW.abilityStats(G.p, 'spin').cd, look: G.lookTier(), lv: G.p.level }; });
  check('old save: loads at Tier 1 / no upgrades / Plain look', mig.tiers.spin === 1 && JSON.stringify(mig.pu) === '{}' && mig.cd === 3 && mig.look === 0 && mig.lv === 7, JSON.stringify(mig));
  check('desktop: no console errors', errs.length === 0, errs.slice(0, 3).join(' / ')); await ctx.close(); }
{ // phone landscape: Moonstone + paw trail + tier-3 moves stay ~60 FPS
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); const page = await ctx.newPage(); const errs = []; watch(page, errs);
  await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page); await page.waitForTimeout(500);
  await page.evaluate(() => { window.__pb.GD.skipAll(localStorage); window.__pb.dismissGuide?.(true); });
  await story(page);
  await setPow(page, { owned: ['spin', 'pounce', 'bark'], tiers: ALL3, pu: ALLPU, look: 4, p: { level: 20 } });
  await page.evaluate(() => { const G = window.__pb; let n = 0; G.__iv = setInterval(() => { G.cds = {}; G.p.powers.eq = ['spin', 'bark'][n++ % 2]; G.usePower(); }, 450); });
  await page.keyboard.down('ArrowRight');
  const f = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const fr = (t) => { n++; if (t - t0 < 4000) requestAnimationFrame(fr); else res(+(n * 1000 / (t - t0)).toFixed(1)); }; requestAnimationFrame(fr); }));
  await page.keyboard.up('ArrowRight'); await page.evaluate(() => clearInterval(window.__pb.__iv));
  check('phone 844x390: ~60 FPS with Moonstone look + tier-3 moves', f >= 50, `${f} fps`); console.log('FPS phone 844x390 tiers:', f);
  await page.screenshot({ path: `${OUT}/phone-moonstone.png` });
  check('phone: no console errors', errs.length === 0, errs.slice(0, 3).join(' / ')); await ctx.close(); }
await browser.close();
const bad = results.filter((r) => !r.ok); console.log(`${results.length - bad.length}/${results.length} checks passed`); process.exit(bad.length ? 1 : 0);
