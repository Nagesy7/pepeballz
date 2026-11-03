// Playwright: Shop link in the #menuBtn menu + once-per-session run-end cosmetics nudge (desktop 1280x800, phone landscape 844x390 touch).
// Usage: node tests/e2e-shop.mjs [baseUrl] [screenshotDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.argv[2] || 'http://localhost:8123/', OUT = (process.argv[3] || 'proof/').replace(/\/?$/, '/'); mkdirSync(OUT, { recursive: true });
const SHOP = 'https://kibbleinu.com/pay?utm_source=pepeballz&utm_medium=menu#shop-h', BANNED = /hurry|limited|last chance|don't miss|guarantee|moon|profit|prize/i;
const res = []; const check = (n, c, x = '') => { res.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); };
const b = await chromium.launch();
// every visible <a>/<button> that is not one of ours; ours must not overlap any of them (or each other) and must sit on screen
const layout = (p) => p.evaluate(() => { const vis = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0 ? r : null; };
  const mine = [...document.querySelectorAll('.menuDom.on')].map((el) => ({ id: el.id, r: vis(el) })).filter((x) => x.r), others = [...document.querySelectorAll('button, a, [role=button]')].filter((el) => !el.classList.contains('menuDom') && !el.closest('.menuDom')).map((el) => ({ id: el.id || el.className || el.tagName, el, r: vis(el) })).filter((x) => x.r);
  const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5, out = [];
  for (const m of mine) { if (m.r.left < 0 || m.r.top < 0 || m.r.right > innerWidth || m.r.bottom > innerHeight) out.push(m.id + ' offscreen');
    for (const o of others) if (hit(m.r, o.r)) out.push(`${m.id} x ${o.id}`); for (const n of mine) if (n !== m && n.id < m.id && hit(m.r, n.r)) out.push(`${m.id} x ${n.id}`); }
  return { on: mine.map((m) => m.id), overlaps: out }; });
const lastEvent = (p) => p.evaluate(() => JSON.stringify((window.vaq || []).map((a) => Array.from(a)).filter((a) => a[0] === 'event').slice(-1)[0] || null));
for (const dev of [{ name: 'desktop', vp: { width: 1280, height: 800 }, opt: {} }, { name: 'phone-landscape', vp: { width: 844, height: 390 }, opt: { deviceScaleFactor: 3, isMobile: true, hasTouch: true } }]) {
  const ctx = await b.newContext({ viewport: dev.vp, ...dev.opt }); await ctx.route(/kibbleinu\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>shop stub</title>' }));
  const p = await ctx.newPage(), errs = [], t = dev.name; p.on('pageerror', (e) => errs.push(e.message));
  const G = (f, a) => p.evaluate(f, a), tap = async (k) => { await p.keyboard.down(k); await p.waitForTimeout(50); await p.keyboard.up(k); await p.waitForTimeout(70); };
  const popup = async (fn) => { const [pg] = await Promise.all([ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null), fn()]); if (!pg) return null; await pg.waitForLoadState().catch(() => {}); const u = pg.url(), op = await pg.evaluate(() => window.opener === null).catch(() => null); await pg.close(); return { u, op }; };
  await p.goto(BASE); await G(() => { localStorage.clear(); sessionStorage.clear(); }); await p.reload(); await p.waitForTimeout(900);
  if (dev.opt.hasTouch) await p.tap('#game'); else await tap('KeyJ'); await p.waitForTimeout(500);
  await G(() => { const g = window.__pb; g.dialog = null; g.menu = null; g.cut = null; }); await p.waitForTimeout(300);
  check(`${t}: in play`, await G(() => window.__pb.state === 'play' && !window.__pb.menu));
  check(`${t}: no shop link / nudge during gameplay`, (await layout(p)).on.length === 0);
  // 1) the menu opened by #menuBtn (tap on phone; Enter = same 'menu' action on desktop, where the touch button is hidden)
  if (dev.opt.hasTouch) await p.tap('#menuBtn'); else await tap('Enter'); await p.waitForTimeout(300);
  const m = await G(() => { const g = window.__pb, it = g.menu?._items || []; return { title: g.menu?.title, last: it[it.length - 1]?.dom, n: it.length }; });
  check(`${t}: #menuBtn menu has Shop as last item`, m.title === 'Menu' && m.last === 'shopLink', JSON.stringify(m));
  const a = await G(() => { const el = document.getElementById('shopLink'); return { text: el.textContent, title: el.title, href: el.href, target: el.target, rel: el.rel, vis: el.classList.contains('on') }; });
  check(`${t}: Shop link text/tooltip/URL word for word`, a.text === '🛍️ Shop' && a.title === 'Optional cosmetics. $KIBBLE is never needed to play.' && a.href === SHOP, JSON.stringify(a));
  check(`${t}: Shop link opens a new tab with rel=noopener`, a.vis && a.target === '_blank' && a.rel === 'noopener');
  check(`${t}: no For devs link (menu has no about/more/footer row)`, await G(() => !document.querySelector('a[href*="for-devs"]')));
  let L = await layout(p); check(`${t}: Shop link on screen, overlaps nothing`, L.overlaps.length === 0, L.overlaps.join(', '));
  await p.screenshot({ path: `${OUT}${t}-01-menu-shop-link.png` });
  const viaTap = await popup(() => (dev.opt.hasTouch ? p.tap('#shopLink') : p.click('#shopLink')));
  check(`${t}: ${dev.opt.hasTouch ? 'tapping' : 'clicking'} Shop opens the shop URL (no opener)`, viaTap?.u === SHOP && viaTap.op === true, JSON.stringify(viaTap));
  const ev = await lastEvent(p); check(`${t}: menu click event is wallet-free`, ev === JSON.stringify(['event', { name: 'paid_link_click', data: { product: 'shop', from: 'pepeballz-menu', site: 'pepeballz' } }]), ev);
  if (!dev.opt.hasTouch) { await G(() => { window.__pb.menu.sel = window.__pb.menu._items.length - 1; }); const viaKey = await popup(() => tap('KeyJ')); check(`${t}: keyboard select on Shop row opens the shop`, viaKey?.u === SHOP, JSON.stringify(viaKey)); }
  await G(() => { window.__pb.menu = null; }); await p.waitForTimeout(200); check(`${t}: shop link hidden once the menu closes`, (await layout(p)).on.length === 0);
  // 2) run end: nudge once per session
  await G(() => window.__pb.startRun('rush')); await p.waitForTimeout(400); check(`${t}: no nudge during a run`, (await layout(p)).on.length === 0);
  await G(() => { window.__pb.finishRun(); }); await p.waitForTimeout(1100);
  const r = await G(() => ({ title: window.__pb.menu?.title, nudge: window.__pb.menu?.nudge, ss: sessionStorage.getItem('inu.shopNudge'), text: document.getElementById('shopNudgeText').textContent, yes: document.getElementById('nudgeShop').textContent, no: document.getElementById('nudgeNo').textContent, href: document.getElementById('nudgeShop').href, rel: document.getElementById('nudgeShop').rel, target: document.getElementById('nudgeShop').target, labels: window.__pb.menu?._items.map((i) => i.label) }));
  check(`${t}: run-end screen shows the nudge`, r.title === 'Boss Rush clear!' && r.nudge && r.ss === 'shown', JSON.stringify({ title: r.title, ss: r.ss }));
  check(`${t}: nudge copy word for word`, r.text === 'Like your look? Outfits, pets and cars for every Inu game are in the Kibble Pay shop. Optional, and never needed to play.' && r.yes === 'Visit the shop →' && r.no === 'Not now');
  check(`${t}: nudge copy has no banned words`, ![r.text, r.yes, r.no].some((s) => BANNED.test(s)));
  check(`${t}: nudge link = shop URL, new tab, noopener`, r.href === SHOP && r.target === '_blank' && r.rel === 'noopener');
  check(`${t}: restart rows stay first`, r.labels[0] === 'View leaderboards' && r.labels[1] === 'Return to story', r.labels.join(' | '));
  L = await layout(p); check(`${t}: nudge copy + both buttons on screen, overlap nothing`, ['shopNudge', 'nudgeShop', 'nudgeNo'].every((id) => L.on.includes(id)) && L.overlaps.length === 0, L.overlaps.join(', ') || L.on.join(','));
  const fit = await G(() => { const n = document.getElementById('shopNudge').getBoundingClientRect(), y = document.getElementById('nudgeShop').getBoundingClientRect(); return n.bottom <= y.top + 1 ? true : `${n.bottom} > ${y.top}`; });
  check(`${t}: nudge copy ends above its buttons`, fit === true, String(fit));
  await p.screenshot({ path: `${OUT}${t}-02-run-end-nudge.png` });
  const viaNudge = await popup(() => (dev.opt.hasTouch ? p.tap('#nudgeShop') : p.click('#nudgeShop')));
  check(`${t}: Visit the shop → opens the shop URL`, viaNudge?.u === SHOP && viaNudge.op === true, JSON.stringify(viaNudge));
  const ev2 = await lastEvent(p); check(`${t}: results click event is wallet-free`, ev2 === JSON.stringify(['event', { name: 'paid_link_click', data: { product: 'shop', from: 'pepeballz-results', site: 'pepeballz' } }]), ev2);
  check(`${t}: after the click the nudge closes, results stay`, await G(() => !window.__pb.menu.nudge && window.__pb.menu.title === 'Boss Rush clear!' && sessionStorage.getItem('inu.shopNudge') === 'clicked'));
  // 3) Not now path: fresh session (new tab state), second run must show no nudge
  await G(() => { sessionStorage.clear(); window.__pb.menu = null; }); await G(() => window.__pb.startRun('rush')); await p.waitForTimeout(300); await G(() => window.__pb.finishRun()); await p.waitForTimeout(1100);
  check(`${t}: nudge again in a fresh session`, await G(() => window.__pb.menu?.nudge === true));
  if (dev.opt.hasTouch) await p.tap('#nudgeNo'); else await p.click('#nudgeNo'); await p.waitForTimeout(250);
  const nn = await G(() => ({ nudge: window.__pb.menu?.nudge, title: window.__pb.menu?.title, ss: sessionStorage.getItem('inu.shopNudge'), sel: window.__pb.menu?.sel, n: window.__pb.menu?._items.length }));
  check(`${t}: Not now hides the nudge, results stay`, nn.nudge === false && nn.title === 'Boss Rush clear!' && nn.ss === 'dismissed' && nn.n === 2 && nn.sel < 2, JSON.stringify(nn));
  check(`${t}: Not now leaves no nudge DOM`, (await layout(p)).on.length === 0);
  await p.screenshot({ path: `${OUT}${t}-03-run-end-after-not-now.png` });
  // restart is never blocked: keyboard/gamepad path picks "Return to story"
  await G(() => { window.__pb.menu.sel = 1; }); await tap('KeyJ'); await p.waitForTimeout(400);
  check(`${t}: Return to story works after the nudge`, await G(() => !window.__pb.menu && window.__pb.mode === 'story' && window.__pb.state === 'play'));
  await G(() => window.__pb.startRun('rush')); await p.waitForTimeout(300); await G(() => window.__pb.finishRun()); await p.waitForTimeout(1100);
  const s2 = await G(() => ({ title: window.__pb.menu?.title, nudge: window.__pb.menu?.nudge, labels: window.__pb.menu?._items.map((i) => i.label) }));
  check(`${t}: second run in the same session: no nudge`, s2.title === 'Boss Rush clear!' && s2.nudge === false && s2.labels.length === 2 && (await layout(p)).on.length === 0, JSON.stringify(s2));
  await p.screenshot({ path: `${OUT}${t}-04-second-run-no-nudge.png` });
  check(`${t}: no page errors`, errs.length === 0, errs[0] || '');
  await ctx.close();
}
await b.close(); console.log(`\n${res.filter(Boolean).length}/${res.length} shop checks passed`); process.exit(res.every(Boolean) ? 0 : 1);
