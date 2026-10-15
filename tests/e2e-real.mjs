// Playwright: REAL mode (no ?demo=1). kibble-pay SDK loads, mint not set -> "KIBBLE launching soon", no fake balance,
// real prize board/pools, sim payouts blocked, Terms/Prize Rules footer, phone landscape.
import { chromium, devices } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:8123/'; const res = []; const check = (n, c, x = '') => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); };
const b = await chromium.launch();
for (const [name, opts] of [['desktop', { viewport: { width: 1280, height: 720 } }], ['iphone-landscape', devices['iPhone 13 landscape']]]) {
  const ctx = await b.newContext(opts), page = await ctx.newPage(), errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForFunction(() => /launching soon|live/i.test(document.getElementById('inu-legal')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => window.__pb.K.mode !== 'loading', null, { timeout: 20000 }).catch(() => {});
  check(`${name}: footer with Terms + Prize Rules`, /Terms.*Prize Rules/.test(await page.evaluate(() => document.getElementById('inu-legal')?.textContent || '')));
  check(`${name}: mode is soon (mint not set)`, (await page.evaluate(() => window.__pb.K.mode)) === 'soon');
  const buy = await page.evaluate(async () => { const g = window.__pb; return g.K.buyWish(g.root, 'aura_frog'); });
  check(`${name}: wish purchase -> KIBBLE launching soon, nothing owned`, /launching soon/i.test(buy.reason || '') && !(await page.evaluate(() => window.__pb.net.owned.includes('aura_frog'))), JSON.stringify(buy));
  const burn = await page.evaluate(async () => { const g = window.__pb; return g.K.burnForLegend(g.root, 'legend_obsidian'); });
  check(`${name}: opt-in burn -> launching soon`, /launching soon/i.test(burn.reason || ''), JSON.stringify(burn));
  check(`${name}: no fake balance`, (await page.evaluate(() => window.__pb.K.getWallet().balanceU())) === 0);
  check(`${name}: burn counter is real (no 48,210 base)`, (await page.evaluate(() => window.__pb.K.publicBurned(window.__pb.root))) < 1000);
  await page.evaluate(() => { const g = window.__pb; g.p = g.p || g.C.init(g.C.newPlayer()); });
  await page.waitForFunction(() => !!window.__pb.K.serverPools, null, { timeout: 15000 }).catch(() => {});
  check(`${name}: real pools loaded from kibble-pay`, await page.evaluate(() => !!window.__pb.K.serverPools?.weekly));
  await page.screenshot({ path: `proof/real-${name}-title-footer.png` });
  check(`${name}: no page errors`, errs.length === 0, errs.join(' | ')); await ctx.close();
}
await b.close(); console.log(res.every(Boolean) ? 'ALL PASS' : 'SOME FAILED'); process.exit(res.every(Boolean) ? 0 : 1);
