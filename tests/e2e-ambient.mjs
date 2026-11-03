// Ambient life / daily / feed / mute / powers / power-ups / game-feel checks + FPS. Usage: node tests/e2e-ambient.mjs [baseUrl] [shotDir]
import { chromium, devices } from 'playwright'; import { mkdirSync } from 'node:fs';
import * as DY from '../src/daily.js'; import * as FD from '../src/feed.js';
const BASE = process.argv[2] || 'http://localhost:8123/'; const OUT = process.argv[3] || '/tmp/pb-ambient'; mkdirSync(OUT, { recursive: true });
const LOCAL = /localhost|127\.0\.0\.1/.test(BASE);
const results = []; const check = (name, cond, extra = '') => { results.push({ name, ok: !!cond }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
const url = (q = '') => BASE + (q ? (BASE.includes('?') ? '&' : '?') + q : '');
const watch = (page, errs) => { page.on('pageerror', (e) => errs.push('pageerror ' + e.message)); page.on('console', (m) => { if (m.type() === 'error' && !(LOCAL && /404|Failed to load resource/.test(m.text()))) errs.push('console ' + m.text()); }); };
const ready = (page) => page.waitForFunction(() => window.__pb && window.__pb.state === 'title', null, { timeout: 20000 });
const story = (page) => page.evaluate(() => { const G = window.__pb; G.newGame(); G.dialog = null; G.menu = null; });
const byPond = (page) => page.evaluate(() => { const G = window.__pb, w = G.amb.water; if (!w.length) return false;
  const cx = w.reduce((a, p) => a + p[0], 0) / w.length, my = Math.max(...w.map((p) => p[1])); G.pl.x = cx * 16 + 8; G.pl.y = (my + 2) * 16; return true; });
const fps = (page, ms = 5000) => page.evaluate((ms) => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = (t) => { n++; if (t - t0 < ms) requestAnimationFrame(f); else res({ fps: +(n * 1000 / (t - t0)).toFixed(1), q: window.__pb.perf.q }); }; requestAnimationFrame(f); }), ms);
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}` });
const browser = await chromium.launch(); const report = {};
// real board state straight from the API (to prove the in-game feed matches it, never fake)
let apiEntries = null; try { const g = async (p) => (await (await fetch(FD.FEED_API + p)).json()).entries?.length || 0; apiEntries = (await g('daily')) + (await g('weekly')); } catch { apiEntries = null; }

// ---------- desktop ----------
{ const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage(); const errs = []; watch(page, errs);
  await page.goto(url('time=day')); await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page);
  await page.waitForFunction(() => window.__pb.feed && window.__pb.feed.status, null, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(1200);
  const t = await page.evaluate(() => { const G = window.__pb; return { id: G.daily.id, date: G.daily.date, feed: G.feed && { status: G.feed.status, rows: G.feed.rows, source: G.feed.source } }; });
  const today = DY.sydneyDate(); check('daily: challenge matches deterministic Sydney rotation', t.id === DY.challengeFor(today).id && t.date === today, `${today} -> ${t.id}`);
  check('feed: status loaded', ['ok', 'empty', 'error'].includes(t.feed?.status), t.feed?.status);
  if (apiEntries === 0) check('feed: real boards empty -> honest empty state', t.feed.status === 'empty' && t.feed.rows.length === 0);
  if (apiEntries > 0) check('feed: real boards have runs -> real rows with short wallets', t.feed.status === 'ok' && t.feed.rows.every((r) => /^.{4}\.\..{4}$/.test(r.wallet)));
  report.feed = { status: t.feed?.status, rows: t.feed?.rows?.length, apiEntries, source: t.feed?.source }; await shot(page, 'title-daily.png');
  // mute toggle persists
  await page.click('#muteBtn'); let m = await page.evaluate(() => ({ s: window.__pb.settings.muted, ls: JSON.parse(localStorage.getItem('pepeballz.settings.v1') || '{}').muted, a: document.getElementById('muteBtn').getAttribute('aria-pressed') }));
  check('mute: button mutes + saves', m.s === true && m.ls === true && m.a === 'true');
  await page.reload(); await ready(page); m = await page.evaluate(() => ({ s: window.__pb.settings.muted, a: document.getElementById('muteBtn').getAttribute('aria-pressed'), txt: document.getElementById('muteBtn').textContent }));
  check('mute: survives reload', m.s === true && m.a === 'true' && m.txt.includes('\u{1F507}'));
  await page.click('#muteBtn'); await page.waitForTimeout(100);
  check('mute: toggles back on', (await page.evaluate(() => window.__pb.settings.muted)) === false);
  // village critters
  await story(page); await byPond(page); await page.waitForTimeout(2500);
  const amb = await page.evaluate(() => { const A = window.__pb.amb; return { drag: A.drag.length, fly: A.fly.length, leaf: A.leaf.length, ripple: A.ripple.length, bird: A.bird.length, area: window.__pb.area.id }; });
  check('ambient: village has dragonflies + butterflies + drifting leaves', amb.drag > 0 && amb.fly > 0 && amb.leaf > 0, JSON.stringify(amb)); await shot(page, 'village-critters.png');
  report.fpsDesktop = await fps(page);
  // power-up pickup + HUD + expiry
  await page.evaluate(() => { const G = window.__pb; G.spawnPowerup('zoomies', G.pl.x + 3, G.pl.y); G.spawnPowerup('shield', G.pl.x - 3, G.pl.y); }); await page.waitForTimeout(500);
  let pu = await page.evaluate(() => Object.keys(window.__pb.pu)); check('power-up: walking onto Zoomies + Bone Shield picks them up', pu.includes('zoomies') && pu.includes('shield'), pu.join());
  await page.waitForTimeout(400); await shot(page, 'powerup-active.png');
  await page.evaluate(() => { window.__pb.pu.zoomies.t = 0.2; }); await page.waitForTimeout(600);
  pu = await page.evaluate(() => Object.keys(window.__pb.pu)); check('power-up: expires when timer ends', !pu.includes('zoomies') && pu.includes('shield'));
  // abilities + cooldowns
  await page.evaluate(() => { const G = window.__pb; G.p.level = 3; G.checkPowerUnlocks(); G.p.powers.owned.push('pounce', 'bark'); G.p.powers.eq = 'spin'; });
  await page.keyboard.down('KeyE'); await page.waitForTimeout(50); await page.keyboard.up('KeyE'); await page.waitForTimeout(100); const c1 = await page.evaluate(() => ({ cd: window.__pb.cds.spin, lp: window.__pb.lastPower }));
  check('ability: Tail Spin fires + starts cooldown', c1.lp?.id === 'spin' && c1.cd > 2.5, `cd ${c1.cd?.toFixed(2)}`);
  await page.keyboard.down('KeyE'); await page.waitForTimeout(50); await page.keyboard.up('KeyE'); await page.waitForTimeout(80); const c2 = await page.evaluate(() => ({ cd: window.__pb.cds.spin, lp: window.__pb.lastPower }));
  check('ability: blocked while on cooldown', c2.lp.t === c1.lp.t && c2.cd < c1.cd);
  await page.evaluate(() => { window.__pb.cds.spin = 0.1; }); await page.waitForTimeout(300); await page.keyboard.down('KeyE'); await page.waitForTimeout(50); await page.keyboard.up('KeyE'); await page.waitForTimeout(60);
  check('ability: usable again after cooldown', (await page.evaluate(() => window.__pb.lastPower.t)) > c1.lp.t);
  await page.keyboard.down('KeyR'); await page.waitForTimeout(80); await page.keyboard.up('KeyR'); await page.waitForTimeout(40); check('ability: R swaps equipped power', (await page.evaluate(() => window.__pb.p.powers.eq)) === 'pounce');
  // forest battle: hit effect + bark shockwave
  await page.evaluate(() => { const G = window.__pb; G.pu = {}; G.enterArea('forest', 8, 15); G.enemies.length = 0; G.pl.dir = 3; }); await page.waitForTimeout(300);
  await page.evaluate(() => { const G = window.__pb; G.spawnEnemyAt('kitten', G.pl.x + 15, G.pl.y); }); await page.waitForTimeout(100);
  await page.keyboard.down('KeyJ'); await page.waitForFunction(() => window.__pb.lastHit > 0 && window.__pb.sparks.length > 0, null, { timeout: 3000 }).catch(() => {}); await page.keyboard.up('KeyJ');
  await page.waitForTimeout(30); await page.evaluate(() => { window.__pb.freeze = true; });
  const hit = await page.evaluate(() => ({ sparks: window.__pb.sparks.length, hurt: window.__pb.enemies.some((e) => e.hurt > 0) || window.__pb.corpses.length > 0 }));
  check('feel: melee hit makes sparks + enemy hurt squash', hit.sparks > 0 && hit.hurt, JSON.stringify(hit)); await shot(page, 'battle-hit.png');
  await page.evaluate(() => { const G = window.__pb; G.freeze = false; G.enemies.length = 0; for (const [dx, dy] of [[30, 0], [-28, 8], [6, -30], [0, 30]]) G.spawnEnemyAt('kitten', G.pl.x + dx, G.pl.y + dy); G.p.powers.eq = 'bark'; G.cds = {}; });
  await page.waitForTimeout(150); await page.keyboard.down('KeyE'); await page.waitForTimeout(50); await page.keyboard.up('KeyE'); await page.waitForTimeout(140); await page.evaluate(() => { window.__pb.freeze = true; });
  const bk = await page.evaluate(() => ({ rings: window.__pb.rings.length, stunned: window.__pb.enemies.filter((e) => e.stun > 0).length }));
  check('ability: Bark Shockwave rings + stuns foes', bk.rings > 0 && bk.stunned > 0, JSON.stringify(bk)); await shot(page, 'power-in-use.png');
  await page.evaluate(() => { window.__pb.freeze = false; });
  // prize runs stay fair: powers + power-ups off
  const fair = await page.evaluate(() => { const G = window.__pb; const m = G.mode; G.mode = 'hunt'; const before = G.lastPower; G.cds = {}; G.usePower?.(); const r = { same: G.lastPower === before }; G.mode = m; return r; });
  check('fairness: powers do nothing in prize runs', fair.same);
  // activity feed panel
  await page.evaluate(() => { const G = window.__pb; G.pauseMenu(); G.dailyMenu(); }); await page.waitForTimeout(500);
  const info = await page.evaluate(() => { const m = window.__pb.menu; return [m?.title, ...(typeof m?.info === 'function' ? m.info() : m?.info || [])].join(' | '); });
  check('feed: daily & recent runs panel shows real state', apiEntries === 0 ? info.includes(FD.EMPTY) : info.length > 0, info.slice(0, 160)); await shot(page, 'activity-feed.png');
  check('desktop: no console errors', errs.length === 0, errs.slice(0, 3).join(' / ')); await ctx.close(); }

// ---------- night forest (fireflies) ----------
{ const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage(); const errs = []; watch(page, errs);
  await page.goto(url('time=night')); await ready(page); await story(page);
  await page.evaluate(() => { const G = window.__pb; G.enterArea('forest', 30, 15); G.enemies.length = 0; G.pl.x = G.amb.water.length ? G.amb.water[0][0] * 16 - 24 : G.pl.x; }); await page.waitForTimeout(2500);
  const a = await page.evaluate(() => ({ ff: window.__pb.amb.ff.length, fly: window.__pb.amb.fly.length, flowers: window.__pb.amb.flowers.length, ripple: window.__pb.amb.ripple.length, leaf: window.__pb.amb.leaf.length }));
  check('ambient: no butterflies at night (fireflies only)', a.fly === 0 && a.flowers > 0, JSON.stringify(a));
  check('ambient: forest at dusk/night has fireflies', a.ff > 0, JSON.stringify(a)); await shot(page, 'forest-night-ambient.png');
  check('night: no console errors', errs.length === 0, errs.slice(0, 3).join(' / ')); await ctx.close(); }

// ---------- phone landscape 844x390 ----------
{ const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 } }); const page = await ctx.newPage(); const errs = []; watch(page, errs);
  await page.goto(url('time=day')); await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page); await page.waitForTimeout(1500);
  await shot(page, 'phone-landscape-title.png');
  await page.tap('canvas').catch(() => {}); await story(page); await byPond(page);
  await page.evaluate(() => { const G = window.__pb; G.p.level = 3; G.checkPowerUnlocks(); G.enterArea('village', G.pl.x / 16, G.pl.y / 16); }); await page.waitForTimeout(1500);
  const lay = await page.evaluate(() => { const r = (id) => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, vis: getComputedStyle(e).display !== 'none' && b.width > 0 }; };
    const others = [...document.querySelectorAll('#btns .b')].filter((e) => e.id !== 'powBtn' && getComputedStyle(e).display !== 'none').map((e) => e.getBoundingClientRect());
    const ov = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.w && a.y < b.y + b.height && b.y < a.y + a.h; const pw = r('powBtn'), mu = r('muteBtn');
    return { pw, mu, overlapPw: others.some((o) => ov(pw, o)), overlapMu: others.some((o) => ov(mu, o)) }; });
  const inView = (b) => b && b.vis && b.x >= 0 && b.y >= 0 && b.x + b.w <= 844 && b.y + b.h <= 390;
  check('phone: power button visible, on screen, not overlapping', inView(lay.pw) && !lay.overlapPw, JSON.stringify(lay.pw));
  check('phone: mute button visible, on screen, not overlapping', inView(lay.mu) && !lay.overlapMu, JSON.stringify(lay.mu));
  await page.tap('#powBtn'); await page.waitForTimeout(120); check('phone: tapping power button uses ability', (await page.evaluate(() => window.__pb.lastPower?.id)) === 'spin');
  await page.waitForTimeout(500); await shot(page, 'phone-landscape.png');
  report.fpsPhone = await fps(page);
  check('phone: no console errors', errs.length === 0, errs.slice(0, 3).join(' / ')); await ctx.close(); }

await browser.close();
console.log('FPS desktop 1280x800:', JSON.stringify(report.fpsDesktop), ' phone 844x390:', JSON.stringify(report.fpsPhone));
console.log('FEED', JSON.stringify(report.feed));
const bad = results.filter((r) => !r.ok); console.log(`${results.length - bad.length}/${results.length} checks passed`); process.exit(bad.length ? 1 : 0);
