// Live E2E: title -> start -> collect 5 lilies (elder + real pickups + boss-drop lily) -> restore pond -> weekly hunt run -> finish -> score.
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'https://pepeballz.vercel.app/', OUT = process.argv[3] || 'proof/';
let fails = 0; const ck = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) fails++; };
const b = await chromium.launch();
for (const [name, opts] of [['desktop', { viewport: { width: 1280, height: 800 } }], ['landscape', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }]]) {
  for (const demo of [false, true]) {
    const tag = name + (demo ? '-demo' : ''); const ctx = await b.newContext(opts); const p = await ctx.newPage();
    const errs = [], reqs = []; p.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    p.on('response', (r) => { if (/\/api\/(game|score)/.test(r.url()) && r.request().method() === 'POST') reqs.push(r.status()); });
    const S = () => p.evaluate(() => { const G = window.__pb; return { state: G.state, menu: G.menu?.title ?? null, dialog: !!G.dialog, orbs: G.p?.orbs?.length, mode: G.mode, info: G.menu?.info ? G.menu.info().join(' | ') : '' }; });
    const act = async (a) => { if (name === 'desktop') { const k = { atk: 'KeyJ', menu: 'Enter' }[a]; await p.keyboard.down(k); await p.waitForTimeout(60); await p.keyboard.up(k); } else await p.locator(`[data-act=${a}]`).tap(); await p.waitForTimeout(70); };
    const skip = async () => { for (let i = 0; i < 40 && (await S()).dialog; i++) await act('atk'); };
    await p.goto(BASE + (demo ? '?demo=1' : '')); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1500);
    const title = await p.title(); ck(`${tag}: page title`, title === "PepeNugs: Cate's Fury", title); ck(`${tag}: title screen`, (await S()).state === 'title');
    if (!demo) await p.screenshot({ path: `${OUT}live-title-${name}.png` });
    // start a run (story)
    if (name === 'desktop') await act('menu'); else await p.touchscreen.tap(422, 380); await p.waitForTimeout(800); ck(`${tag}: new game starts`, (await S()).state === 'play'); await skip();
    // lily 1 from the elder
    await p.evaluate(() => { const G = window.__pb, n = G.area.npcs.find((q) => q.id === 'elder'); n.tx = null; n.tm = 99; G.pl.x = n.x * 16; G.pl.y = n.y * 16 + 14; G.pl.dir = 1; }); await act('atk'); await p.waitForTimeout(400); await skip();
    // lilies 2-4: walk onto the real pickups
    for (const [area, x, y] of [['village', 35, 26], ['forest', 11, 27], ['forest', 44, 26]]) { await p.evaluate(([a, x, y]) => { const G = window.__pb; if (G.area.id !== a) G.enterArea(a, x, y - 1); G.enemies.length = 0; G.pl.x = x * 16; G.pl.y = (y - 1) * 16; }, [area, x, y]);
      await p.waitForTimeout(150); await p.evaluate(([x, y]) => { const G = window.__pb; G.pl.x = x * 16; G.pl.y = y * 16; }, [x, y]); await p.waitForTimeout(400); }
    if (!demo) { await p.waitForTimeout(200); await p.screenshot({ path: `${OUT}live-gameplay-${name}.png` }); }
    // lily 5: Cate drops it on defeat (spawn the drop as the boss does, then walk onto it)
    await p.evaluate(() => { const G = window.__pb; G.enterArea('mountain', 20, 9); G.enemies.length = 0; G.p.flags.cateDown = true; G.area.pickups.push({ key: 'orb5', kind: 'orb', n: 5, x: 20, y: 7 }); G.pl.y = 7 * 16; }); await p.waitForTimeout(500);
    ck(`${tag}: collected all 5 lilies`, (await S()).orbs === 5, String((await S()).orbs));
    // restore the pond at the basin
    await p.evaluate(() => { const G = window.__pb; G.banner = null; G.enterArea('village', 20, 6.5); G.pl.dir = 1; }); await p.waitForTimeout(400); await act('atk'); await p.waitForTimeout(2800);
    ck(`${tag}: pond restoration scene`, (await S()).state === 'wish'); await skip(); await p.waitForTimeout(400);
    ck(`${tag}: pond restored, no wish menu`, await p.evaluate(() => window.__pb.p.flags.pondRestored && !window.__pb.menu));
    if (!demo) await p.screenshot({ path: `${OUT}live-pond-restored-${name}.png` }); await p.waitForTimeout(1800);
    // finish a run: weekly hunt, collect its 5 seeded lilies, set them in the basin
    await p.evaluate(() => window.__pb.startRun('hunt')); await p.waitForTimeout(500);
    const hunt = await p.evaluate(() => window.__pb.hunt.orbs.map((o) => [o.area, o.x, o.y])); ck(`${tag}: hunt has 5 lilies`, hunt.length === 5);
    for (const [a, x, y] of hunt) { await p.evaluate(([a, x, y]) => { const G = window.__pb; if (G.area.id !== a) G.enterArea(a, x, y); G.enemies.length = 0; G.pl.x = x * 16; G.pl.y = y * 16; }, [a, x, y]); await p.waitForTimeout(250); }
    ck(`${tag}: hunt lilies collected`, await p.evaluate(() => window.__pb.hunt.got.length) === 5);
    await p.evaluate(() => { const G = window.__pb; G.enterArea('village', 20, 6.5); G.pl.dir = 1; }); await p.waitForTimeout(300); await act('atk'); await p.waitForTimeout(2800); await skip(); await p.waitForTimeout(2500);
    const end = await S(); ck(`${tag}: run finished`, end.menu === 'Hunt complete!', end.menu);
    if (demo) { ck(`${tag}: score appears with rank on the board`, /Your rank: #\d+ of \d+/.test(end.info), end.info.slice(0, 120));
      const onBoard = await p.evaluate(() => { const G = window.__pb; return (G.net.huntRuns || []).some((r) => r.id === 'you'); }); ck(`${tag}: run stored in leaderboard`, onBoard); }
    else { console.log(`  ${tag}: score status: ${end.info.split(' | ')[1]} ; POST /api/game responses: ${JSON.stringify(reqs)}`); }
    await p.screenshot({ path: `${OUT}live-score-${tag}.png` });
    ck(`${tag}: zero console/page errors`, errs.length === 0, errs.slice(0, 4).join(' || '));
    await ctx.close();
  }
}
await b.close(); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
