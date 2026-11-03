// Shop / For devs links (spec: cabal-meme-maker-shots/discover/game-specs.md). Pure module: no DOM, so tests can import it.
// Copy is word for word from the spec. $KIBBLE is never needed to play, and these links never touch the wallet.
import { KIBBLE_SITE, GAME } from './kibble.js';
export const SITE = GAME; // 'pepeballz'
export const SHOP_URL = `${KIBBLE_SITE}/pay?utm_source=${SITE}&utm_medium=menu#shop-h`;
// The spec gives one shop URL (utm_medium=menu) and no results variant, so the run-end nudge uses the same URL.
export const NUDGE_SHOP_URL = SHOP_URL;
export const FOR_DEVS_URL = `${KIBBLE_SITE}/for-devs.html?utm_source=${SITE}&utm_medium=menu`; // not shown: the pause menu has no about/more/footer row
export const COPY = {
  shop: '🛍️ Shop',
  shopTitle: 'Optional cosmetics. $KIBBLE is never needed to play.',
  forDevs: '🛠️ For devs',
  nudge: 'Like your look? Outfits, pets and cars for every Inu game are in the Kibble Pay shop. Optional, and never needed to play.',
  nudgeYes: 'Visit the shop →',
  nudgeNo: 'Not now',
};
export const BANNED = /hurry|limited|last chance|don't miss|guarantee|moon|profit|prize/i;
export const NUDGE_KEY = 'inu.shopNudge';
// analytics payload: product + where it was clicked + site. Never wallet, mint, name or score.
export const paidLinkEvent = (product, where) => ({ name: 'paid_link_click', data: { product, from: `${SITE}-${where}`, site: SITE } });
export function trackPaidLink(product, where, w = globalThis.window) { const ev = paidLinkEvent(product, where); try { w && w.va && w.va('event', ev); } catch {} return ev; }
// once per session: shown the first time a run ends, then never again until the tab is closed
export function nudgeAllowed(store) { try { return !store?.getItem(NUDGE_KEY); } catch { return false; } }
export function markNudge(store, state = 'shown') { try { store?.setItem(NUDGE_KEY, state); } catch {} }
