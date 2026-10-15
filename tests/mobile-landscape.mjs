// Smoke: phone landscape (touch). Usage: node tests/mobile-landscape.mjs [baseUrl]
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:8123/'; let fail = 0;
const ck = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + ' ' + x); if (!c) fail++; };
const b = await chromium.launch();
for (const [w, h] of [[844, 390], [740, 360]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
  ck(`${w}x${h} controls hidden on title`, !(await p.locator('#btns').isVisible()));
  await p.touchscreen.tap(w / 2, h - 20); await p.waitForTimeout(400);
  ck(`${w}x${h} tap starts game`, await p.evaluate(() => window.__pb.state === 'play'));
  await p.waitForTimeout(300); ck(`${w}x${h} controls shown in play`, await p.locator('#btns').isVisible());
  const r = await p.evaluate(() => { const a = document.getElementById('btns').getBoundingClientRect(), s = document.getElementById('stick').getBoundingClientRect(); return [a.right, a.bottom, s.left, s.bottom, innerWidth, innerHeight]; });
  ck(`${w}x${h} controls on screen`, r[0] <= r[4] && r[1] <= r[5] && r[2] >= 0 && r[3] <= r[5]);
  ck(`${w}x${h} no page errors`, errs.length === 0, errs.join('|')); await ctx.close();
}
await b.close(); process.exit(fail ? 1 : 0);
