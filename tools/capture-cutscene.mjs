// Deterministic cutscene + stage captures (freezes the sim between frames). Usage: node tools/capture-cutscene.mjs [url]
import { chromium, devices } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:8123/';
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 960, height: 540 } });
const tap = async (k) => { await page.keyboard.down(k); await page.waitForTimeout(50); await page.keyboard.up(k); await page.waitForTimeout(60); };
await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(500); await tap('KeyJ'); await page.waitForTimeout(300); for (let i = 0; i < 6; i++) await tap('KeyJ');
await page.evaluate(() => { const G = window.__pb; G.p.energy = 999; G.p.level = 15; G.banner = null; });
const clip = { x: 330, y: 120, width: 300, height: 260 };
await page.screenshot({ path: 'proof/stage-0.png', clip });
await page.evaluate(() => { const G = window.__pb; G.freeze = true; G.startTransform(1); G.stepCut(0.75); G.shake = 0; }); await page.waitForTimeout(80); await page.screenshot({ path: 'proof/cutscene-1-powerup.png' });
await page.evaluate(() => { const G = window.__pb; G.stepCut(0.26); G.flash = 0.7; G.shake = 0; }); await page.waitForTimeout(80); await page.screenshot({ path: 'proof/cutscene-2-flash.png' });
await page.evaluate(() => { const G = window.__pb; G.flash = 0; G.craters.forEach((c) => (c.t = 0.2)); for (const p of G.parts) { p.x += p.vx * 0.15; p.y += p.vy * 0.15; } G.stepCut(0.01); G.shake = 0; }); await page.waitForTimeout(80); await page.screenshot({ path: 'proof/cutscene-3-crater.png' });
for (const st of [1, 2, 3]) { await page.evaluate((st) => { const G = window.__pb; G.state = 'play'; G.cut = null; G.craters.length = 0; G.parts.length = 0; G.pl.stage = st; G.banner = null; G.freeze = false; }, st); await page.waitForTimeout(500);
  await page.evaluate(() => { window.__pb.freeze = true; }); await page.screenshot({ path: `proof/stage-${st}.png`, clip }); await page.evaluate(() => { window.__pb.freeze = false; }); }
await page.screenshot({ path: 'proof/primal-howl-full.png' });
await b.close();
