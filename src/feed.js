// Real-activity feed: recent Ribbit Nugs scores straight from the kibble-pay prize board (wallet-signed runs only).
// Never fabricates entries: on no data it says so, on a network error it says that instead.
export const FEED_API = 'https://kibble-pay.vercel.app/api/game?action=scores&game=pepeballz&pool=';
export const EMPTY = 'No recent runs yet';
export const ERROR = 'Recent runs unavailable right now';
export const shortAddr = (w) => { const s = String(w || ''); return s.length > 10 ? `${s.slice(0, 4)}..${s.slice(-4)}` : s; };
// Build feed rows from the daily board first, then the weekly board (deduped by wallet). Only real API entries are used.
export function buildFeed(daily, weekly, max = 5) {
  const out = [], seen = new Set();
  for (const [label, b] of [['today', daily], ['this week', weekly]]) for (const e of (b?.entries || [])) {
    if (!e || typeof e.wallet !== 'string' || !Number.isFinite(Number(e.score)) || seen.has(e.wallet)) continue;
    seen.add(e.wallet); out.push({ wallet: shortAddr(e.wallet), score: Number(e.score), when: label, rank: e.rank }); if (out.length >= max) return out; }
  return out;
}
export async function fetchFeed(fetchFn = globalThis.fetch, base = FEED_API) {
  try {
    const get = async (pool) => { const r = await fetchFn(base + pool, { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
    const [d, w] = await Promise.all([get('daily'), get('weekly')]);
    const rows = buildFeed(d, w); return { status: rows.length ? 'ok' : 'empty', rows, source: 'kibble-pay /api/game?action=scores (daily + weekly, game=pepeballz)', at: Date.now() };
  } catch (e) { return { status: 'error', rows: [], error: String(e?.message || e), at: Date.now() }; }
}
export const feedLines = (f) => !f ? ['Loading recent runs...'] : f.status === 'ok' ? f.rows.map((r) => `${r.wallet}  ${r.score}  ${r.when}`) : [f.status === 'error' ? ERROR : EMPTY];
