// Playwright checks with real keyboard / touch input. Usage: node tests/e2e.mjs [baseUrl]
import { chromium, devices } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:8123/';
const results = []; const check = (name, cond, extra = '') => { results.push({ name, ok: !!cond, extra }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
const S = (page) => page.evaluate(() => { const G = window.__pb; return { state: G.state, menu: G.menu?.title ?? null, dialog: !!G.dialog, area: G.area?.id, x: G.pl.x, y: G.pl.y, dir: G.pl.dir, walk: G.pl.walk, hp: G.p?.hp, en: G.p?.energy, lvl: G.p?.level, xp: G.p?.xp, orbs: G.p?.orbs.length, asc: G.pl.ascend, enemies: G.enemies.length, boss: G.boss ? G.boss.hp : null, shots: G.shots.length, mode: G.mode, wish: G.wish?.phase }; });
const tap = async (page, key, ms = 60) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(40); };
async function skipDialog(page) { for (let i = 0; i < 30 && (await S(page)).dialog; i++) await tap(page, 'KeyJ', 40); }
const browser = await chromium.launch();

// ---------------- desktop ----------------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(700);
  await page.screenshot({ path: 'proof/desktop-01-title.png' }); check('desktop: title screen', (await S(page)).state === 'title');
  await tap(page, 'Enter'); await page.waitForTimeout(300); check('desktop: new game starts with typewriter dialog', (await S(page)).dialog);
  await page.waitForTimeout(900); await page.screenshot({ path: 'proof/desktop-02-dialog.png' }); await skipDialog(page);
  // walk with real arrow keys, check stride frames advance and position changes in 4 directions
  const s0 = await S(page); await page.keyboard.down('ArrowUp'); await page.waitForTimeout(250); await page.screenshot({ path: 'proof/desktop-03-walk-up.png' }); await page.waitForTimeout(500); await page.keyboard.up('ArrowUp');
  const s1 = await S(page); check('desktop: walking up moves + faces up', s1.y < s0.y - 20 && s1.dir === 1, `dy=${(s1.y - s0.y).toFixed(1)}`);
  check('desktop: stride animation advances', s1.walk > s0.walk + 0.4);
  for (const [k, d] of [['ArrowLeft', 2], ['ArrowRight', 3], ['ArrowDown', 0]]) { await page.keyboard.down(k); await page.waitForTimeout(250); await page.keyboard.up(k); check(`desktop: face ${k}`, (await S(page)).dir === d); }
  // talk to elder at altar (walk north)
  await page.evaluate(() => { const G = window.__pb; G.pl.x = 21.5 * 16; G.pl.y = 9.6 * 16; G.pl.dir = 1; }); await tap(page, 'KeyJ'); await page.waitForTimeout(700);
  check('desktop: NPC dialog via action key', (await S(page)).dialog); await page.screenshot({ path: 'proof/desktop-04-npc.png' }); await skipDialog(page); await page.waitForTimeout(200);
  check('desktop: elder gives Wish Orb 1', (await S(page)).orbs === 1);
  // travel to forest by walking out the east exit
  await page.evaluate(() => { const G = window.__pb; G.pl.x = 37.5 * 16; G.pl.y = 15 * 16; }); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(700); await page.keyboard.up('ArrowRight'); await page.waitForTimeout(500);
  check('desktop: east exit leads to Whisker Woods', (await S(page)).area === 'forest');
  // combat: place a kitten in front and attack with a 3-hit combo
  await page.evaluate(() => { const G = window.__pb; G.enemies.length = 0; G.pl.x = 6 * 16; G.pl.y = 15 * 16; G.pl.dir = 3; });
  await page.waitForTimeout(100); await page.evaluate(() => { const G = window.__pb; G.enemies.push({ type: 'kitten', x: G.pl.x + 16, y: G.pl.y, hp: 200, max: 200, T: { hp: 22, dmg: 0, xp: 7, bones: 3, speed: 0, r: 7, art: 'kitten' }, vx: 0, vy: 0, kb: 0, flash: 0, cd: 9, st: 'wander', t: 0, wx: 0, wy: 0 }); });
  await tap(page, 'KeyJ', 40); await page.waitForTimeout(150); await page.screenshot({ path: 'proof/desktop-05-combo.png' }); await tap(page, 'KeyJ', 40); await page.waitForTimeout(150); await tap(page, 'KeyJ', 40); await page.waitForTimeout(300);
  let hp = await page.evaluate(() => window.__pb.enemies[0]?.hp); check('desktop: melee combo damages enemy', hp < 200, `enemy hp ${hp}`);
  const e0 = (await S(page)).en; await tap(page, 'KeyK'); await page.waitForTimeout(60); await page.screenshot({ path: 'proof/desktop-06-blast.png' }); const sb = await S(page);
  check('desktop: Howl Blast spends energy', sb.en < e0); await page.waitForTimeout(400);
  await page.keyboard.down('KeyC'); await page.waitForTimeout(800); await page.screenshot({ path: 'proof/desktop-07-charge.png' }); await page.keyboard.up('KeyC'); check('desktop: charging restores energy', (await S(page)).en > sb.en);
  const xd = (await S(page)).x; await page.keyboard.down('ArrowLeft'); await tap(page, 'Space'); await page.keyboard.up('ArrowLeft'); check('desktop: dash moves quickly', xd - (await S(page)).x > 25);
  await page.evaluate(() => { const G = window.__pb; G.p.energy = 200; }); await tap(page, 'KeyQ'); await page.waitForTimeout(300); check('desktop: transform cutscene plays', (await S(page)).state === 'cut'); await page.waitForTimeout(1600); await page.screenshot({ path: 'proof/desktop-08-ascend.png' });
  const sa = await S(page); check('desktop: Ascend transform on', sa.asc); await page.waitForTimeout(800); check('desktop: Ascend drains energy', (await S(page)).en < sa.en);
  // XP: kill weak kitten
  await page.evaluate(() => { const G = window.__pb; G.enemies.forEach((e) => (e.dead = true)); G.pl.dir = 3; }); await page.waitForTimeout(50);
  await page.evaluate(() => { const G = window.__pb; G.enemies.push({ type: 'kitten', x: G.pl.x + 15, y: G.pl.y, hp: 3, max: 22, T: { hp: 22, dmg: 0, xp: 40, bones: 3, speed: 0, r: 7, art: 'kitten' }, vx: 0, vy: 0, kb: 0, flash: 0, cd: 9, st: 'wander', t: 0, wx: 0, wy: 0 }); });
  const lv0 = await S(page); await tap(page, 'KeyJ'); await page.waitForTimeout(400); const lv1 = await S(page);
  check('desktop: kill grants XP / level up', lv1.lvl > lv0.lvl || lv1.xp > lv0.xp, `lvl ${lv0.lvl}->${lv1.lvl}`); await page.screenshot({ path: 'proof/desktop-09-levelup.png' }); await tap(page, 'KeyQ');
  // ---- Ascend stages, cutscene frames, poses ----
  await tap(page, 'KeyQ'); await page.waitForTimeout(200); check('desktop: Ascend released back to base', (await S(page)).asc === false);
  await page.evaluate(() => { const G = window.__pb; G.enemies.forEach((e) => (e.dead = true)); G.enterArea('village', 20.5, 18); G.p.energy = 999; G.craters.length = 0; G.parts.length = 0; G.pl.charge = false; }); await page.waitForTimeout(500);
  const stageShot = async (n) => { const b = await page.evaluate(() => { const G = window.__pb, c = document.getElementById('game'), r = c.getBoundingClientRect(), k = r.width / c.width * (c.width / Math.ceil(c.width / Math.max(1, Math.floor(Math.min(c.width, c.height) / 230)))); return { x: (G.pl.x - G.cam.x) * k, y: (G.pl.y - G.cam.y) * k, k }; });
    await page.screenshot({ path: `proof/stage-${n}.png`, clip: { x: Math.max(0, b.x - 45 * b.k), y: Math.max(0, b.y - 80 * b.k), width: 90 * b.k, height: 92 * b.k } }); };
  await stageShot(0);
  await tap(page, 'KeyQ'); await page.waitForTimeout(450); await page.screenshot({ path: 'proof/cutscene-1-powerup.png' }); await page.waitForTimeout(560); await page.screenshot({ path: 'proof/cutscene-2-flash.png' });
  await page.waitForTimeout(250); await page.screenshot({ path: 'proof/cutscene-3-crater.png' }); await page.waitForTimeout(900);
  check('desktop: Golden Howl (stage 1)', (await page.evaluate(() => window.__pb.pl.stage)) === 1); await stageShot(1);
  await tap(page, 'KeyQ'); await page.waitForTimeout(200); check('desktop: Storm Howl locked before Cate (press releases)', (await page.evaluate(() => window.__pb.pl.stage)) === 0);
  await page.evaluate(() => { const G = window.__pb; G.p.flags.cateDown = true; G.p.energy = 999; }); await tap(page, 'KeyQ'); await page.waitForTimeout(1900); await tap(page, 'KeyQ'); await page.waitForTimeout(1900);
  check('desktop: Storm Howl unlocked after Cate (stage 2)', (await page.evaluate(() => window.__pb.pl.stage)) === 2); await stageShot(2);
  const drain = async () => { const a = (await S(page)).en; await page.waitForTimeout(500); return a - (await S(page)).en; }; const d2 = await drain();
  await page.evaluate(() => { const G = window.__pb; G.p.level = 15; G.p.energy = 999; }); await tap(page, 'KeyQ'); await page.waitForTimeout(1900);
  check('desktop: Primal Howl at level 15 (stage 3)', (await page.evaluate(() => window.__pb.pl.stage)) === 3); await stageShot(3); await page.screenshot({ path: 'proof/desktop-21-primal-howl.png' });
  const d3 = await drain(); check('desktop: higher stage drains faster', d3 > d2, `${d2.toFixed(1)} < ${d3.toFixed(1)}`);
  await page.evaluate(() => { window.__pb.pl.dir = 3; }); await tap(page, 'KeyJ', 30); await page.waitForTimeout(60); await page.screenshot({ path: 'proof/pose-punch.png' });
  await page.waitForTimeout(150); await tap(page, 'KeyJ', 30); await page.waitForTimeout(220); await tap(page, 'KeyJ', 30); await page.waitForTimeout(80); await page.screenshot({ path: 'proof/pose-kick.png' }); check('desktop: kick on 3rd combo hit', (await page.evaluate(() => window.__pb.pl.combo)) === 2);
  await page.waitForTimeout(400); await tap(page, 'KeyK', 30); await page.waitForTimeout(60); await page.screenshot({ path: 'proof/pose-beam.png' }); check('desktop: beam pose', (await page.evaluate(() => window.__pb.pl.beamT)) > 0);
  await page.evaluate(() => { const G = window.__pb; G.pl.x = 21 * 16; G.pl.y = 22 * 16; }); await page.waitForTimeout(500); await page.screenshot({ path: 'proof/human-spark.png' });
  const npcMoved = await page.evaluate(() => window.__pb.area.npcs.some((n) => n.hx != null && Math.hypot(n.x - n.hx, n.y - n.hy) > 0.2)); check('desktop: NPCs walk around', npcMoved);
  await tap(page, 'KeyQ'); await page.evaluate(() => { const G = window.__pb; G.p.level = 4; G.p.flags.cateDown = false; G.enterArea('forest', 6, 15); });
  await page.waitForTimeout(300);
  // menu: items & stats
  await tap(page, 'Enter'); await page.waitForTimeout(200); check('desktop: pause menu', (await S(page)).menu === 'Menu');
  await tap(page, 'KeyJ'); await page.waitForTimeout(250); await page.screenshot({ path: 'proof/desktop-10-items.png' }); check('desktop: inventory opens', (await S(page)).menu === 'Items');
  await page.evaluate(() => { window.__pb.p.hp = 10; }); const h0 = (await S(page)).hp; await tap(page, 'KeyJ'); check('desktop: healing item restores HP', (await S(page)).hp > h0);
  await tap(page, 'KeyX'); await tap(page, 'ArrowDown'); await tap(page, 'KeyJ'); await page.waitForTimeout(200); check('desktop: stats screen', (await S(page)).menu === 'Stats');
  const st0 = await page.evaluate(() => window.__pb.p.stats.str); await tap(page, 'KeyJ'); const st1 = await page.evaluate(() => window.__pb.p.stats.str);
  check('desktop: spend stat point', st1 === st0 + 1 || (await page.evaluate(() => window.__pb.p.points)) === 0); await page.screenshot({ path: 'proof/desktop-11-stats.png' });
  await tap(page, 'KeyX'); await tap(page, 'KeyX'); await page.waitForTimeout(150);
  // save + reload + continue
  await page.evaluate(() => window.__pb.saveGame(true)); const before = await S(page); await page.reload(); await page.waitForTimeout(700); await page.screenshot({ path: 'proof/desktop-12-continue.png' });
  await tap(page, 'KeyJ'); await page.waitForTimeout(400); const after = await S(page);
  check('desktop: localStorage save -> Continue restores', after.area === before.area && after.lvl === before.lvl && after.orbs === before.orbs, `${after.area} lv${after.lvl}`);
  // boss fight: walk into arena on Fang Peak
  await page.evaluate(() => window.__pb.enterArea('mountain', 20, 17)); await page.waitForTimeout(600); await page.keyboard.down('ArrowUp'); await page.waitForTimeout(700); await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(400); check('desktop: Cate boss intro triggers', (await S(page)).boss === 700 && (await S(page)).dialog); await page.screenshot({ path: 'proof/desktop-13-cate-intro.png' }); await skipDialog(page);
  await page.evaluate(() => { const G = window.__pb; G.p.hp = 9999; G.p.stats.vit = 200; G.p.stats.str = 40; }); // hardy test hero so the fight finishes quickly
  for (let i = 0; i < 70 && (await S(page)).boss > 0; i++) { await page.evaluate(() => { const G = window.__pb, b = G.boss; if (!b) return; G.pl.x = b.x; G.pl.y = b.y + 24; G.pl.dir = 1; G.p.hp = Math.max(G.p.hp, 500); G.p.energy = 100; });
    await tap(page, i % 4 === 3 ? 'KeyK' : 'KeyJ', 30); if (i === 8) await page.screenshot({ path: 'proof/desktop-14-cate-fight.png' }); await page.waitForTimeout(90); }
  const bs = await S(page); check('desktop: Cate form 1 defeated by real attacks', bs.boss === 0 || bs.boss === null, `boss hp ${bs.boss}`); await page.waitForTimeout(300); await skipDialog(page); await page.waitForTimeout(300);
  await page.screenshot({ path: 'proof/desktop-15-cate-down.png' });
  // collect orbs -> Pepe wish
  await page.evaluate(() => { const G = window.__pb; for (let i = 1; i <= 7; i++) G.C.addOrb(G.p, 'orb' + i); G.enterArea('village', 20, 6.5); G.pl.dir = 1; }); await page.waitForTimeout(400);
  await tap(page, 'KeyJ'); await page.waitForTimeout(2600); await page.screenshot({ path: 'proof/desktop-16-pepe.png' }); check('desktop: Pepe summoned with 7 orbs', (await S(page)).state === 'wish');
  await skipDialog(page); await page.waitForTimeout(200); check('desktop: wish menu', (await S(page)).menu === 'Make a wish'); await page.screenshot({ path: 'proof/desktop-17-wish-menu.png' });
  await tap(page, 'ArrowDown'); const str0 = await page.evaluate(() => window.__pb.C.derived(window.__pb.p).str); await tap(page, 'KeyJ'); await page.waitForTimeout(200);
  check('desktop: wish reward granted (Golden Fang)', (await page.evaluate(() => window.__pb.C.derived(window.__pb.p).str)) === str0 + 6); await skipDialog(page); await page.waitForTimeout(1800);
  // network: shop + leaderboards + hunt
  await tap(page, 'Enter'); await tap(page, 'ArrowDown'); await tap(page, 'ArrowDown'); await tap(page, 'KeyJ'); await page.waitForTimeout(200); check('desktop: Wish Network menu', (await S(page)).menu === 'Wish Network');
  await tap(page, 'KeyJ'); await page.waitForTimeout(200); for (let i = 0; i < 4; i++) await tap(page, 'ArrowDown'); await tap(page, 'KeyJ'); await page.waitForTimeout(200);
  const statsBefore = await page.evaluate(() => JSON.stringify(window.__pb.p.stats)); await tap(page, 'KeyJ'); await page.waitForTimeout(300); await page.screenshot({ path: 'proof/desktop-18-wish-shop.png' });
  const net = await page.evaluate(() => window.__pb.net); check('desktop: Wish Shop purchase splits 2% fee', net.owned.length === 1 && net.treasuryU === 60000 && net.pools.weekly === 30000, JSON.stringify(net.pools));
  check('desktop: purchase does not change stats', statsBefore === (await page.evaluate(() => JSON.stringify(window.__pb.p.stats))));
  await tap(page, 'KeyX'); await tap(page, 'ArrowUp'); await tap(page, 'KeyJ'); await page.waitForTimeout(200); await tap(page, 'ArrowRight'); await page.waitForTimeout(200); await page.screenshot({ path: 'proof/desktop-19-leaderboards.png' });
  check('desktop: leaderboards', (await S(page)).menu === 'Leaderboards'); await tap(page, 'KeyX'); await page.waitForTimeout(100);
  await tap(page, 'ArrowUp'); await tap(page, 'ArrowUp'); await page.waitForTimeout(100); await tap(page, 'KeyJ'); await page.waitForTimeout(600);
  const hs = await S(page); check('desktop: weekly hunt starts with seeded orbs', hs.mode === 'hunt', hs.mode); await page.screenshot({ path: 'proof/desktop-20-hunt.png' });
  check('desktop: no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

// ---------------- mobile ----------------
async function mobile(label, device, landscape) {
  const vp = landscape ? { width: device.viewport.height, height: device.viewport.width } : device.viewport;
  const ctx = await browser.newContext({ ...device, viewport: vp, isMobile: true, hasTouch: true }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(800);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
  const box = async (sel) => { const b = await page.locator(sel).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2, b]; };
  const tapBtn = async (sel, ms = 80) => { const [x, y] = await box(sel); await touch('touchStart', [[x, y]]); await page.waitForTimeout(ms); await touch('touchEnd', []); await page.waitForTimeout(60); };
  check(`${label}: touch controls visible`, await page.locator('#stick').isVisible() && await page.locator('[data-act=atk]').isVisible());
  await page.screenshot({ path: `proof/${label}-01-title.png` });
  await tapBtn('[data-act=atk]'); await page.waitForTimeout(400); check(`${label}: A button starts game`, (await S(page)).state === 'play');
  for (let i = 0; i < 12 && (await S(page)).dialog; i++) await tapBtn('[data-act=atk]', 50);
  // drag the thumb stick up
  const [sx, sy] = await box('#stick'); const s0 = await S(page);
  await touch('touchStart', [[sx, sy]]); await touch('touchMove', [[sx, sy - 25]]); await touch('touchMove', [[sx, sy - 55]]); await page.waitForTimeout(400); await page.screenshot({ path: `proof/${label}-02-stick-walk.png` }); await page.waitForTimeout(300);
  // multi-touch: hold stick + tap A
  const [ax, ay] = await box('[data-act=atk]'); await touch('touchMove', [[sx, sy - 55], [ax, ay]]); await page.waitForTimeout(80); await touch('touchMove', [[sx, sy - 55]]); await touch('touchEnd', []);
  const s1 = await S(page); check(`${label}: thumb stick walks`, s1.y < s0.y - 15, `dy=${(s1.y - s0.y).toFixed(1)}`);
  await page.evaluate(() => { const G = window.__pb; G.p.energy = 200; }); await tapBtn('[data-act=ascend]'); await page.waitForTimeout(1900); check(`${label}: Ascend button`, (await S(page)).asc);
  const e0 = (await S(page)).en; await tapBtn('[data-act=blast]'); check(`${label}: Blast button`, (await S(page)).en < e0); await page.waitForTimeout(80); await page.screenshot({ path: `proof/${label}-03-ascend-blast.png` });
  const x0 = await S(page); await tapBtn('[data-act=dash]'); await page.waitForTimeout(200); const x1 = await S(page); check(`${label}: Dash button`, Math.hypot(x1.x - x0.x, x1.y - x0.y) > 20);
  await tapBtn('#menuBtn'); await page.waitForTimeout(200); check(`${label}: menu button`, (await S(page)).menu === 'Menu'); await page.screenshot({ path: `proof/${label}-04-menu.png` }); await tapBtn('[data-act=blast]');
  const L = await page.evaluate(() => { const cs = getComputedStyle(document.body); const c = document.getElementById('game').getBoundingClientRect(); return { sy: scrollY, sh: document.documentElement.scrollHeight, ih: innerHeight, us: cs.userSelect || cs.webkitUserSelect, th: cs.webkitTapHighlightColor, cw: c.width, ch: c.height, bw: document.getElementById('game').width, scale: window.__pb && 0 }; });
  check(`${label}: no page scroll`, L.sy === 0 && L.sh <= L.ih + 1, `${L.sh}/${L.ih}`); check(`${label}: no text selection / tap highlight`, L.us === 'none' && /0\)|transparent/.test(L.th), `${L.us} ${L.th}`);
  const inside = await page.evaluate(() => [...document.querySelectorAll('#stick,.b')].every((el) => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }));
  check(`${label}: all controls inside viewport`, inside);
  await page.touchscreen.tap(10, 10); await page.waitForTimeout(100); check(`${label}: still no scroll after touches`, (await page.evaluate(() => scrollY)) === 0);
  if (label.includes('portrait')) { await page.evaluate(() => { const G = window.__pb; G.menu = null; for (let i = 1; i <= 7; i++) G.C.addOrb(G.p, 'orb' + i); G.enterArea('village', 20, 6.5); G.pl.dir = 1; }); await page.waitForTimeout(400);
    await tapBtn('[data-act=atk]'); await page.waitForTimeout(2700); await page.screenshot({ path: `proof/${label}-05-pepe.png` });
    const fit = await page.evaluate(() => { const G = window.__pb; const left = 20 * 16 - 60 - G.cam.x; return left >= 0 && left + 120 <= Math.ceil(document.getElementById('game').width / Math.max(1, Math.floor(Math.min(document.getElementById('game').width, document.getElementById('game').height) / 230))); });
    check(`${label}: Pepe fits on screen`, fit); }
  check(`${label}: no page errors`, errs.length === 0, errs.slice(0, 2).join(' | ')); await ctx.close();
}
await mobile('iphone13-portrait', devices['iPhone 13'], false);
await mobile('iphone13-landscape', devices['iPhone 13'], true);
await mobile('pixel7-landscape', devices['Pixel 7'], true);
await browser.close();
const fails = results.filter((r) => !r.ok); console.log(`\n${results.length - fails.length}/${results.length} checks passed`); process.exit(fails.length ? 1 : 0);
