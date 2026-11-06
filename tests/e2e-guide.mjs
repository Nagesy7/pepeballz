// Playwright: first-run power guide (tooltips + Powers badge). Desktop 1280x800 + phone landscape 844x390 touch.
// Usage: node tests/e2e-guide.mjs [baseUrl] [screenshotDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:8123/';
const OUT = (process.argv[3] || 'proof/guide/').replace(/\/?$/, '/');
mkdirSync(OUT, { recursive: true });
const BANNED = /hurry|limited|last chance|don't miss|guarantee|profit|prize|aura|saiyan|transform|power level/i;
const res = [];
const check = (n, c, x = '') => { res.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); };

const layoutGuide = (p) => p.evaluate(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0 ? r : null; };
  const tip = document.getElementById('guideTip');
  const tr = tip && tip.classList.contains('on') && !tip.hidden ? vis(tip) : null;
  const others = [...document.querySelectorAll('#menuBtn, #muteBtn, #powBtn, #stick, #btns .b, #vaultLink, .menuDom.on, #inu-wallet, #inu-home')]
    .map((el) => ({ id: el.id || el.className, r: vis(el) })).filter((x) => x.r);
  const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  const overlaps = [];
  if (tr) {
    if (tr.left < 0 || tr.top < 0 || tr.right > innerWidth || tr.bottom > innerHeight) overlaps.push('guideTip offscreen');
    for (const o of others) if (hit(tr, o.r)) overlaps.push(`guideTip x ${o.id}`);
  }
  return { on: !!tr, overlaps, title: document.getElementById('guideTitle')?.textContent || '', body: document.getElementById('guideBody')?.textContent || '',
    ok: document.getElementById('guideOk')?.textContent || '', skip: document.getElementById('guideSkip')?.textContent || '' };
});

const browser = await chromium.launch();
for (const dev of [
  { name: 'desktop', vp: { width: 1280, height: 800 }, opt: {} },
  { name: 'phone-landscape', vp: { width: 844, height: 390 }, opt: { deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
]) {
  const ctx = await browser.newContext({ viewport: dev.vp, ...dev.opt });
  const p = await ctx.newPage();
  const errs = [];
  const t = dev.name;
  p.on('pageerror', (e) => errs.push(e.message));
  const G = (f, a) => p.evaluate(f, a);
  const tap = async (k) => { await p.keyboard.down(k); await p.waitForTimeout(50); await p.keyboard.up(k); await p.waitForTimeout(80); };

  await p.goto(BASE);
  await G(() => { localStorage.clear(); sessionStorage.clear(); });
  await p.reload();
  await p.waitForFunction(() => window.__pb && window.__pb.state === 'title', null, { timeout: 20000 });
  await p.waitForTimeout(500);
  if (dev.opt.hasTouch) await p.tap('#game'); else await tap('KeyJ');
  await p.waitForTimeout(400);
  await G(() => { const g = window.__pb; g.newGame(); g.dialog = null; g.menu = null; g.cut = null; g.state = 'play'; g.enemies.length = 0; g.boss = null; });
  await p.waitForTimeout(200);
  check(`${t}: in story play`, await G(() => window.__pb.state === 'play' && window.__pb.mode === 'story' && !window.__pb.guide));

  // --- upgrades tip after level-up with affordable upgrade ---
  await G(() => {
    const g = window.__pb, p = g.p, PW = g.PW;
    PW.ensure(p); p.level = 4; p.bones = 200; p.powers.owned = ['spin']; p.powers.tiers = { spin: 1 }; p.powers.eq = 'spin';
    // simulate the level-up hook (Lv4 -> Lv5 unlocks Tail Spin T2 for 60 bones)
    p.level = 5; g.maybeGuideUpgrades(true);
  });
  await p.waitForTimeout(120);
  // flush queue (update loop should pick it up)
  await G(() => { window.__pb.boss = null; window.__pb.menu = null; window.__pb.dialog = null; });
  await p.waitForTimeout(250);
  let tip = await layoutGuide(p);
  check(`${t}: upgrades tip shows`, tip.on && /Powers upgrades/i.test(tip.title), JSON.stringify(tip));
  check(`${t}: upgrades copy friendly`, tip.ok === 'Got it' && tip.skip === 'Skip tips' && !BANNED.test(tip.title + tip.body) && !/\$KIBBLE/.test(tip.body));
  check(`${t}: upgrades tip overlaps nothing`, tip.overlaps.length === 0, tip.overlaps.join(', '));
  check(`${t}: badge set when upgrade available`, await G(() => window.__pb.GD.badgeOn(localStorage) && document.getElementById('menuBtn').classList.contains('guide-badge')));
  await p.screenshot({ path: `${OUT}${t}-01-upgrades-tip.png` });

  // dismiss with keyboard (desktop) or tap Got it (phone)
  if (dev.opt.hasTouch) await p.tap('#guideOk'); else await tap('KeyJ');
  await p.waitForTimeout(200);
  tip = await layoutGuide(p);
  check(`${t}: upgrades tip dismissed`, !tip.on && await G(() => !window.__pb.guide && localStorage.getItem('inu.guide.upgrades') === '1'));

  // menu badge on Powers entry + menuBtn
  if (dev.opt.hasTouch) await p.tap('#menuBtn'); else await tap('Enter');
  await p.waitForTimeout(250);
  const menu = await G(() => {
    const items = window.__pb.menu?._items || [];
    const pow = items.find((i) => /^Powers/.test(i.label));
    return { title: window.__pb.menu?.title, powers: pow?.label || '', badge: document.getElementById('menuBtn').classList.contains('guide-badge') };
  });
  check(`${t}: Powers row shows new badge`, menu.title === 'Menu' && /\*/.test(menu.powers), JSON.stringify(menu));
  check(`${t}: menuBtn still badged`, menu.badge);
  await p.screenshot({ path: `${OUT}${t}-02-menu-badge.png` });

  // open Powers -> badge clears
  await G(() => {
    const items = window.__pb.menu._items || [];
    const i = items.findIndex((it) => /^Powers/.test(it.label));
    window.__pb.menu.sel = i; items[i].act();
  });
  await p.waitForTimeout(200);
  const cleared = await G(() => ({
    title: window.__pb.menu?.title,
    badgeStore: window.__pb.GD.badgeOn(localStorage),
    menuBadge: document.getElementById('menuBtn').classList.contains('guide-badge'),
    powersLabel: (window.__pb.menu?.parent?._items || []).find?.(() => false),
  }));
  // close back to pause menu to read Powers label
  await G(() => { window.__pb.closeMenu?.(); }); // may not exist
  await G(() => { const g = window.__pb; if (g.menu?.title === 'Powers') g.menu = g.menu.parent; });
  await p.waitForTimeout(100);
  // reopen pause to see label
  await G(() => { window.__pb.menu = null; window.__pb.pauseMenu(); });
  await p.waitForTimeout(150);
  const after = await G(() => {
    const items = window.__pb.menu?._items || [];
    const pow = items.find((i) => /^Powers/.test(i.label));
    return { powers: pow?.label || '', badgeStore: window.__pb.GD.badgeOn(localStorage), menuBadge: document.getElementById('menuBtn').classList.contains('guide-badge') };
  });
  check(`${t}: badge cleared after opening Powers`, !after.badgeStore && !after.menuBadge && !/\*/.test(after.powers), JSON.stringify(after));
  await p.screenshot({ path: `${OUT}${t}-03-badge-cleared.png` });
  await G(() => { window.__pb.menu = null; });

  // --- collar tip on first tier-up ---
  await G(() => {
    const g = window.__pb, p = g.p, PW = g.PW;
    PW.ensure(p); p.powers.look = 0; p.level = 20; p.bones = 9999;
    p.powers.owned = ['spin', 'pounce', 'bark'];
    p.powers.tiers = { spin: 1, pounce: 1, bark: 1 }; // score 3 -> Bronze
    g.collarCheck(true);
  });
  await p.waitForTimeout(300);
  tip = await layoutGuide(p);
  check(`${t}: collar tip shows on first tier-up`, tip.on && /Collar looks/i.test(tip.title), JSON.stringify({ title: tip.title, on: tip.on }));
  check(`${t}: collar copy lists Plain→Moonstone`, /Plain Pup/.test(tip.body) && /Moonstone Coat/.test(tip.body) && !BANNED.test(tip.title + tip.body));
  check(`${t}: collar tip overlaps nothing`, tip.overlaps.length === 0, tip.overlaps.join(', '));
  await p.screenshot({ path: `${OUT}${t}-04-collar-tip.png` });

  // gamepad-style dismiss via Escape / back
  if (dev.opt.hasTouch) await p.tap('#guideSkip'); else await tap('Escape');
  await p.waitForTimeout(200);
  tip = await layoutGuide(p);
  const skipped = await G(() => ({ guide: window.__pb.guide, up: localStorage.getItem('inu.guide.upgrades'), col: localStorage.getItem('inu.guide.collar'), skip: localStorage.getItem('inu.guide.skip') }));
  // Escape = Got it (not skip); Skip tips button sets skip. On desktop Escape dismisses as Got it.
  if (dev.opt.hasTouch) {
    check(`${t}: Skip tips marks all seen`, !tip.on && skipped.skip === '1' && skipped.col === '1');
  } else {
    check(`${t}: Escape dismisses collar tip`, !tip.on && skipped.col === '1' && !skipped.guide);
  }

  // prize run: no guide (powers off; tip must not appear)
  await G(() => {
    localStorage.removeItem('inu.guide.upgrades');
    localStorage.removeItem('inu.guide.collar');
    localStorage.removeItem('inu.guide.skip');
  });
  await G(() => {
    const g = window.__pb;
    g.startRun('rush');
    g.maybeGuideUpgrades(true);
    g.queueGuide('upgrades');
    g.queueGuide('collar');
  });
  await p.waitForTimeout(350);
  tip = await layoutGuide(p);
  check(`${t}: no guide tip in Boss Rush`, !tip.on && await G(() => window.__pb.mode === 'rush' && !window.__pb.guide && !window.__pb.guideQ));

  check(`${t}: no page errors`, errs.length === 0, errs[0] || '');
  await ctx.close();
}
await browser.close();
console.log(`\n${res.filter(Boolean).length}/${res.length} guide checks passed`);
process.exit(res.every(Boolean) ? 0 : 1);
