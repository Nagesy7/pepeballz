// Playwright: KIBBLE network features with real keyboard input (menus) + a live Tournament of Paws match.
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:8123/'; const res = []; const check = (n, c, x = '') => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); };
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; page.on('pageerror', (e) => errs.push(e.stack));
const tap = async (k, ms = 50) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); await page.waitForTimeout(60); };
const G = (f, a) => page.evaluate(f, a);
const openNet = async (label) => { await G(() => { window.__pb.menu = null; }); await tap('Enter'); await tap('ArrowDown'); await tap('ArrowDown'); await tap('KeyJ');
  const idx = await G((l) => window.__pb.menu._items.findIndex((i) => i.label.startsWith(l)), label); for (let i = 0; i < idx; i++) await tap('ArrowDown'); await tap('KeyJ'); await page.waitForTimeout(250); };
await page.goto(BASE); await G(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(600); await tap('KeyJ'); await page.waitForTimeout(300); for (let i = 0; i < 6; i++) await tap('KeyJ');
await G(async () => { const w = window.__pb.K.getWallet(); await w.connect(); w.s.holdU = window.__pb.K.toU(150000); window.__pb.net.pools.weekly = 5000000; });
// 1) aura skins + golden orb in cosmetics
await openNet('Cosmetics'); await tap('ArrowRight'); await tap('ArrowDown'); await tap('ArrowRight'); await page.waitForTimeout(200);
const cos = await G(() => window.__pb.p.cosmetics); check('aura skin + bolt skin equipped via menu', !!cos.aura && !!cos.bolt, JSON.stringify(cos));
for (let i = 0; i < 4; i++) await tap('ArrowDown'); await tap('KeyJ'); check('golden orb toggled on (Shogun holder)', await G(() => window.__pb.net.useGolden === true)); await page.screenshot({ path: 'proof/kibble-01-cosmetics-skins-golden-orb.png' });
await G(() => { const g = window.__pb; g.menu = null; g.p.energy = 999; g.p.flags.cateDown = true; }); await tap('KeyQ'); await page.waitForTimeout(1900); await tap('KeyQ'); await page.waitForTimeout(1900); await page.screenshot({ path: 'proof/kibble-02-storm-howl-skinned-aura.png' }); await tap('KeyQ');
// 2) golden pepe
const st0 = await G(() => JSON.stringify(window.__pb.p.stats));
await G(() => { const g = window.__pb; for (let i = 1; i <= 7; i++) g.C.addOrb(g.p, 'orb' + i); g.enterArea('village', 20, 6.5); g.pl.dir = 1; }); await page.waitForTimeout(400); await tap('KeyJ'); await page.waitForTimeout(2600);
await page.screenshot({ path: 'proof/kibble-03-golden-pepe.png' }); check('golden Pepe summon grants unique title', await G(() => window.__pb.wish?.golden && window.__pb.net.owned.includes('title_golden') && window.__pb.p.cosmetics.title === 'title_golden'));
check('golden summon does not change stats', st0 === await G(() => JSON.stringify(window.__pb.p.stats)));
for (let i = 0; i < 10 && await G(() => !!window.__pb.dialog); i++) await tap('KeyJ'); await tap('KeyJ'); for (let i = 0; i < 6; i++) await tap('KeyJ'); await page.waitForTimeout(1800);
await G(() => window.__pb.saveGame(true));
// 3) tournament
await openNet('Tournament'); await page.screenshot({ path: 'proof/kibble-04-tournament-menu.png' }); await tap('KeyJ'); await page.waitForTimeout(800);
check('tournament match vs ghost starts', await G(() => window.__pb.mode === 'tourney' && window.__pb.enemies.some((e) => e.type === 'ghost')));
await G(() => { window.__pb.p.stats.str = 30; }); // speeds the live fight; ghost uses its own normalised build
for (let i = 0; i < 40 && await G(() => window.__pb.enemies.some((e) => e.type === 'ghost' && !e.dead)); i++) { await G(() => { const g = window.__pb, e = g.enemies.find((x) => x.type === 'ghost'); if (e) { g.pl.x = e.x - 16; g.pl.y = e.y; g.pl.dir = 3; g.p.hp = Math.max(g.p.hp, 200); } }); await tap('KeyJ', 30); if (i === 3) await page.screenshot({ path: 'proof/kibble-05-tournament-fight.png' }); await page.waitForTimeout(120); }
check('beat a ghost with real attacks', await G(() => Object.values(window.__pb.tour.res).includes('you')));
await G(() => { const g = window.__pb; g.tourneyResult(false); }); await page.waitForTimeout(1300); for (let i = 0; i < 20 && await G(() => window.__pb.menu?.title !== 'Tournament of Paws'); i++) { await G(() => window.__pb.tourneyResult(false)); await page.waitForTimeout(1200); }
await page.screenshot({ path: 'proof/kibble-06-tournament-result.png' }); check('bracket finishes with placement', await G(() => window.__pb.net.tourney?.place >= 0));
await tap('KeyJ'); await page.waitForTimeout(500);
// 4) bounty
await G(() => { const g = window.__pb; for (let i = 0; i < 120; i++) g.K.contribute(g.root, 'cate_defeats', 'you'); });
await openNet('Cate Bounty'); await page.screenshot({ path: 'proof/kibble-07-bounty-board.png' }); const bal0 = await G(() => window.__pb.net.wallet.balU); await tap('KeyJ'); await page.waitForTimeout(300);
check('bounty settles and pays you by contribution', (await G(() => window.__pb.net.wallet.balU)) > bal0);
// 5) launches
await openNet('Fighter Launches'); const t0 = await G(() => window.__pb.net.treasuryU); await tap('KeyJ'); await page.waitForTimeout(300); await page.screenshot({ path: 'proof/kibble-08-fighter-launch.png' });
check('launch listing: fee + 1% to treasury', (await G(() => window.__pb.net.treasuryU)) - t0 === 25250000);
// 6) seasons
await openNet('Seasons'); await tap('KeyJ'); await page.waitForTimeout(300); await page.screenshot({ path: 'proof/kibble-09-seasons.png' }); check('season item bought', await G(() => window.__pb.net.owned.includes('s1_cap')));
// 7) burn
await openNet('Burn for Legends'); const pb0 = await G(() => window.__pb.K.publicBurned(window.__pb.root)); await tap('KeyJ'); await page.waitForTimeout(300); await page.screenshot({ path: 'proof/kibble-10-burn-legends.png' });
check('burn raises public counter by 50', (await G(() => window.__pb.K.publicBurned(window.__pb.root))) - pb0 === 50000000);
check('no page errors', errs.length === 0, errs[0] || '');
await b.close(); console.log(`\n${res.filter(Boolean).length}/${res.length} kibble checks passed`); process.exit(res.every(Boolean) ? 0 : 1);
