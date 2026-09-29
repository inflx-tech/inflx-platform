'use strict';

/**
 * shopperFeed.service.js — how Home and Play are ordered, and the Home circles (follower-app-v2).
 * Contract: features/follower-app-v2 · boards F2, F5 · rules v1.7 §5.5, §5.12, §5.14
 *
 * Stage A (on from launch): creators she follows → near her → everything else, newest first; posts
 * matching the styles she picked move up a little (treated as one day newer).
 * Stage B (built, OFF until admin switches it on): a score from four admin dials — what she does,
 * how recent, how near, how it performs.
 * Fixed rules either way: never the same creator twice in a row · a share of places for brand-new
 * posts · never repeat a post she has seen for N days; when she has seen everything, seen posts come
 * back, the one she saw longest ago first ("You're all caught up") — the feed is never empty.
 *
 * The page is worked out afresh on every request from what the phone says it has already shown
 * this session (served), so nothing about the session is stored on the server.
 */

const db = require('../config/db');
const settings = require('./platformSettings.service');
const sp = require('./shopperPosts.service');
const { MSG } = require('./shopperCopy');

const PAGE = 12;
const STYLE_LIFT_MS = 24 * 3600 * 1000;
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

// 5.12 Stage B — how much each kind of action says about what she likes.
const ACTION_WEIGHT = {
  purchase: 10, add_to_bag: 6, save: 4, save_product: 4, tap_shop: 3, like: 3, share: 3, comment: 3,
  complete: 2, dwell: 1.5, open: 1, view: 1, tap_product: 1,
};
const HALF_LIFE_ACTION_DAYS = 14;
const HALF_LIFE_FRESH_DAYS = 3;
const PERF_PRIOR_VIEWS = 20;          // a post needs about this many views before its own rate dominates

async function numbers() {
  const all = await settings.getAll();
  const v = (k) => Number(all[k] ? all[k].value : settings.DEFAULTS[k].value);
  return {
    nearKm: v('feed_near_km'), newPct: v('feed_new_share_pct'), newHours: v('feed_new_hours'),
    repeatDays: v('feed_repeat_days'), learning: v('feed_learning_on') === 1,
    w: { does: v('feed_w_does'), recent: v('feed_w_recent'), near: v('feed_w_near'), performs: v('feed_w_performs') },
  };
}

/* ───────────────────────────────────────────── what she has seen, whom she follows */

/** post id → when she last saw it, within the repeat window. A post she saw earlier counts as unseen. */
async function seenOf(who, postIds, repeatDays) {
  const out = new Map();
  if (!postIds.length || (!who.followerId && !who.deviceId)) return out;
  const { rows } = await db.query(
    `SELECT post_id, max(created_at) AS last FROM post_events
      WHERE event_type = 'impression' AND post_id = ANY($1::uuid[]) AND created_at > now() - ($2::int * interval '1 day')
        AND ((follower_id IS NOT NULL AND follower_id = $3) OR device_id = $4)
      GROUP BY post_id`, [postIds, repeatDays, who.followerId, who.deviceId || '']);
  for (const r of rows) out.set(r.post_id, new Date(r.last));
  return out;
}

async function followsOf(who) {
  const set = new Set(who.follows || []);
  if (who.followerId) {
    const { rows } = await db.query(`SELECT influencer_id FROM follower_follows WHERE follower_id = $1`, [who.followerId]);
    for (const r of rows) set.add(r.influencer_id);
  }
  return set;
}

/* ───────────────────────────────────────────── Stage B: the four dials */

/** Her taste: attribute → weight, from her own recent actions, fading by half every 14 days. */
async function tasteOf(who) {
  const taste = new Map();
  if (!who.followerId && !who.deviceId) return taste;
  const { rows } = await db.query(
    `SELECT e.event_type, e.dwell_ms, e.created_at, cp.influencer_id, cp.brand_id, cp.category_node_ids, cp.theme_tag_ids,
            cp.price_band_id, o.offer_type
       FROM post_events e JOIN creator_posts cp ON cp.id = e.post_id LEFT JOIN brand_offers o ON o.id = cp.offer_id
      WHERE e.created_at > now() - interval '90 days' AND e.event_type <> 'impression'
        AND ((e.follower_id IS NOT NULL AND e.follower_id = $1) OR e.device_id = $2)
      ORDER BY e.created_at DESC LIMIT 5000`, [who.followerId, who.deviceId || '']);
  const buys = who.followerId ? (await db.query(
    `SELECT ft.created_at, cp.influencer_id, cp.brand_id, cp.category_node_ids, cp.theme_tag_ids, cp.price_band_id, o.offer_type
       FROM follower_transactions ft
       JOIN creator_posts cp ON cp.id = ft.via_post_id LEFT JOIN brand_offers o ON o.id = cp.offer_id
      WHERE ft.follower_id = $1 AND ft.status = 'completed' AND ft.created_at > now() - interval '180 days'`, [who.followerId])).rows : [];
  const now = Date.now();
  const add = (key, w) => taste.set(key, (taste.get(key) || 0) + w);
  const feed = (r, type) => {
    let w = ACTION_WEIGHT[type] || 0;
    if (type === 'dwell' && !(Number(r.dwell_ms) >= 10000)) w = 0;
    if (!w) return;
    w *= 0.5 ** ((now - new Date(r.created_at).getTime()) / DAY / HALF_LIFE_ACTION_DAYS);
    add(`c:${r.influencer_id}`, w);
    add(`b:${r.brand_id}`, w);
    for (const l of r.category_node_ids || []) add(`l:${l}`, w / Math.max(1, (r.category_node_ids || []).length));
    for (const t of r.theme_tag_ids || []) add(`t:${t}`, w / Math.max(1, (r.theme_tag_ids || []).length));
    if (r.offer_type) add(`o:${r.offer_type}`, w);
    if (r.price_band_id) add(`p:${r.price_band_id}`, w);
  };
  for (const r of rows) feed(r, r.event_type);
  for (const r of buys) feed(r, 'purchase');
  return taste;
}

function doesOf(p, taste) {
  if (!taste.size) return 0;
  const g = (k) => taste.get(k) || 0;
  const maxOf = (xs) => (xs.length ? Math.max(...xs) : 0);
  return g(`c:${p.influencer_id}`) + g(`b:${p.brand_id}`)
    + maxOf((p.category_node_ids || []).map((l) => g(`l:${l}`)))
    + maxOf((p.theme_tag_ids || []).map((t) => g(`t:${t}`)))
    + (p.offer_type ? g(`o:${p.offer_type}`) : 0)
    + (p.price_band_id ? g(`p:${p.price_band_id}`) : 0);
}

async function performanceOf(ids) {
  if (!ids.length) return new Map();
  const { rows } = await db.query(`SELECT post_id, score FROM post_performance WHERE post_id = ANY($1::uuid[])`, [ids]);
  return new Map(rows.map((r) => [r.post_id, Number(r.score)]));
}

/** Each post's score for her (0–1 per dial, weighted by the admin dials). */
async function scores(pool, who, n, dist) {
  const taste = await tasteOf(who);
  const perf = await performanceOf(pool.map((p) => p.id));
  const does = new Map(pool.map((p) => [p.id, doesOf(p, taste)]));
  const maxDoes = Math.max(0, ...does.values()) || 1;
  const maxPerf = Math.max(0, ...perf.values()) || 1;
  const now = Date.now();
  const sum = (n.w.does + n.w.recent + n.w.near + n.w.performs) || 1;
  const out = new Map();
  for (const p of pool) {
    const d = dist.get(p.id);
    const dial = {
      does: does.get(p.id) / maxDoes,
      recent: 0.5 ** ((now - p.live_at.getTime()) / DAY / HALF_LIFE_FRESH_DAYS),
      near: d == null ? 0 : d <= n.nearKm ? 1 : n.nearKm / d,
      performs: (perf.get(p.id) || 0) / maxPerf,
    };
    out.set(p.id, { score: (n.w.does * dial.does + n.w.recent * dial.recent + n.w.near * dial.near + n.w.performs * dial.performs) / sum, dial });
  }
  return out;
}

/* ───────────────────────────────────────────── the fixed rules */

/** Moves the next post by a different creator up whenever two by the same creator would touch. */
function noCreatorTwice(list, lastCreator = null) {
  const out = [...list];
  for (let i = 0; i < out.length; i += 1) {
    const prev = i === 0 ? lastCreator : out[i - 1].influencer_id;
    if (!prev || out[i].influencer_id !== prev) continue;
    const j = out.findIndex((p, k) => k > i && p.influencer_id !== prev);
    if (j === -1) break;                        // only one creator left: nothing to swap with
    const [moved] = out.splice(j, 1);
    out.splice(i, 0, moved);
  }
  return out;
}

/** Keeps a share of places for brand-new posts (not already placed by follow). */
function withNewPlaces(ordered, isNew, pct, followed) {
  if (!pct) return ordered;
  const fresh = ordered.filter((p) => isNew(p) && !followed.has(p.influencer_id));
  const freshIds = new Set(fresh.map((p) => p.id));
  const rest = ordered.filter((p) => !freshIds.has(p.id));
  const out = [];
  let placed = 0;
  while (fresh.length || rest.length) {
    const want = Math.round(((out.length + 1) * pct) / 100);
    if (fresh.length && (placed < want || !rest.length)) { out.push(fresh.shift()); placed += 1; } else out.push(rest.shift());
  }
  return out;
}

/* ───────────────────────────────────────────── the feed */

/**
 * One page of Home (mode 'home') or Play (mode 'play', videos only). `served` = the post ids the
 * phone has already shown this session. `start` = a post to put first (a video tapped in Home).
 * Returns { posts, more, stage } — each post says whether it is coming back after she caught up.
 */
async function feed(who, { mode = 'home', served = [], start = null, size = PAGE, forceStage = null } = {}) {
  const n = await numbers();
  const stage = forceStage || (n.learning ? 'B' : 'A');
  const servedIds = sp.cleanIds(served);
  const skip = new Set(servedIds);
  const all = await sp.livePool({ segments: who.shopFor || [], videosOnly: mode === 'play' });
  const pool = all.filter((p) => !skip.has(p.id));
  const [followed, seen, point] = await Promise.all([
    followsOf(who), seenOf(who, pool.map((p) => p.id), n.repeatDays), sp.pointOf(who),
  ]);
  const places = point ? await sp.placesOf(pool) : null;
  const dist = new Map(pool.map((p) => [p.id, point ? sp.distanceOf(p, point, places) : null]));
  const styles = new Set(who.styleIds || []);
  const isNew = (p) => Date.now() - p.live_at.getTime() < n.newHours * HOUR;

  const unseen = pool.filter((p) => !seen.has(p.id));
  let ordered;
  let scored = null;
  if (stage === 'B') {
    scored = await scores(unseen, who, n, dist);
    ordered = [...unseen].sort((a, b) => scored.get(b.id).score - scored.get(a.id).score || b.live_at - a.live_at);
  } else {
    const group = (p) => (followed.has(p.influencer_id) ? 0 : (dist.get(p.id) != null && dist.get(p.id) <= n.nearKm) ? 1 : 2);
    const t = (p) => p.live_at.getTime() + ((p.theme_tag_ids || []).some((x) => styles.has(x)) ? STYLE_LIFT_MS : 0);
    ordered = [...unseen].sort((a, b) => group(a) - group(b) || t(b) - t(a) || (a.id < b.id ? -1 : 1));
  }
  ordered = withNewPlaces(ordered, isNew, n.newPct, followed);
  // Caught up: what she has seen comes back, the one she saw longest ago first.
  const again = pool.filter((p) => seen.has(p.id)).sort((a, b) => seen.get(a.id) - seen.get(b.id));
  if (start && sp.cleanIds([start]).length) {
    const i = ordered.findIndex((p) => p.id === start);
    const j = again.findIndex((p) => p.id === start);
    const first = i >= 0 ? ordered.splice(i, 1)[0] : j >= 0 ? again.splice(j, 1)[0] : null;
    if (first) ordered.unshift(first);
  }
  const lastServed = servedIds.length ? all.find((p) => p.id === servedIds[servedIds.length - 1]) : null;
  const sequence = noCreatorTwice([...ordered, ...again], lastServed ? lastServed.influencer_id : null);
  const page = sequence.slice(0, size);
  const list = await sp.cards(page.map((p) => p.id), who);
  const againIds = new Set(again.map((p) => p.id));
  return {
    stage,
    posts: list.map((c) => ({
      ...c,
      again: againIds.has(c.id),
      near_km: dist.get(c.id) == null ? null : Math.round(dist.get(c.id)),
      ...(scored && scored.get(c.id) ? { score: scored.get(c.id) } : {}),
    })),
    caught_up_line: MSG.CAUGHT_UP,
    more: sequence.length > size,
  };
}

/* ───────────────────────────────────────────── Home circles (5.5) */

/**
 * Creators: followed → engaged → popular near her. Brands: bought from or visited → near her →
 * popular. Only those with live posts. A ring = a post that went live since her last visit
 * (`since`, kept on the phone); ringed circles come first.
 */
async function circles(who, { since = null, limit = 20 } = {}) {
  const n = await numbers();
  const pool = await sp.livePool({ segments: who.shopFor || [] });
  const sinceAt = since && !Number.isNaN(new Date(since).getTime()) ? new Date(since) : null;
  const followed = await followsOf(who);
  const point = await sp.pointOf(who);
  const places = point ? await sp.placesOf(pool) : null;
  const byCreator = new Map();
  const byBrand = new Map();
  for (const p of pool) {
    const d = point ? sp.distanceOf(p, point, places) : null;
    for (const [map, key] of [[byCreator, p.influencer_id], [byBrand, p.brand_id]]) {
      const x = map.get(key) || { id: key, posts: 0, newest: 0, near: false };
      x.posts += 1;
      x.newest = Math.max(x.newest, p.live_at.getTime());
      if (d != null && d <= n.nearKm) x.near = true;
      map.set(key, x);
    }
  }
  const engagedCreators = new Map();
  const visitedBrands = new Map();
  if (who.followerId || who.deviceId) {
    const { rows } = await db.query(
      `SELECT cp.influencer_id, cp.brand_id, e.event_type, e.surface, max(e.created_at) AS at FROM post_events e
         JOIN creator_posts cp ON cp.id = e.post_id
        WHERE e.event_type IN ('like', 'save', 'save_product', 'complete', 'tap_shop', 'open', 'tap_brand', 'add_to_bag', 'comment', 'share')
          AND ((e.follower_id IS NOT NULL AND e.follower_id = $1) OR e.device_id = $2) AND e.created_at > now() - interval '90 days'
        GROUP BY 1, 2, 3, 4`, [who.followerId, who.deviceId || '']);
    for (const r of rows) {
      if (r.event_type !== 'tap_brand') engagedCreators.set(r.influencer_id, Math.max(engagedCreators.get(r.influencer_id) || 0, new Date(r.at).getTime()));
      if (r.event_type === 'tap_brand' || r.surface === 'brand_store') visitedBrands.set(r.brand_id, Math.max(visitedBrands.get(r.brand_id) || 0, new Date(r.at).getTime()));
    }
  }
  if (who.followerId) {
    const { rows } = await db.query(
      `SELECT cp.brand_id, max(ft.created_at) AS at FROM follower_transactions ft
         JOIN creator_posts cp ON cp.id = ft.via_post_id WHERE ft.follower_id = $1 GROUP BY 1`, [who.followerId]);
    for (const r of rows) visitedBrands.set(r.brand_id, Math.max(visitedBrands.get(r.brand_id) || 0, new Date(r.at).getTime() + DAY * 365));
  }
  const { rows: fc } = await db.query(
    `SELECT influencer_id, count(*)::int AS n FROM follower_follows WHERE influencer_id = ANY($1::uuid[]) GROUP BY 1`, [[...byCreator.keys()]]);
  const fans = new Map(fc.map((r) => [r.influencer_id, r.n]));
  const ring = (x) => !!(sinceAt && x.newest > sinceAt.getTime());
  const rank = (x, groupOf, within) => ({ x, ring: ring(x), group: groupOf(x), within: within(x) });
  const order = (list) => list.sort((a, b) => Number(b.ring) - Number(a.ring) || a.group - b.group || b.within - a.within).slice(0, limit);

  const creatorList = order([...byCreator.values()].map((x) => rank(x,
    (c) => (followed.has(c.id) ? 0 : engagedCreators.has(c.id) ? 1 : c.near ? 2 : 3),
    (c) => (followed.has(c.id) ? c.newest : engagedCreators.has(c.id) ? engagedCreators.get(c.id) : fans.get(c.id) || 0))));
  const brandList = order([...byBrand.values()].map((x) => rank(x,
    (b) => (visitedBrands.has(b.id) ? 0 : b.near ? 1 : 2),
    (b) => (visitedBrands.has(b.id) ? visitedBrands.get(b.id) : b.posts))));
  const [cm, bm] = await Promise.all([sp.creatorsById(creatorList.map((r) => r.x.id)), sp.brandsById(brandList.map((r) => r.x.id))]);
  return {
    creators: creatorList.map((r) => ({ ...cm.get(r.x.id), ring: r.ring, following: followed.has(r.x.id), live_posts: r.x.posts })).filter((c) => c.id),
    brands: brandList.map((r) => ({ ...bm.get(r.x.id), ring: r.ring, live_posts: r.x.posts })).filter((b) => b.id),
  };
}

/* ───────────────────────────────────────────── Stage B upkeep and admin */

/** Hourly: each post's results across all shoppers, smoothed so a few lucky views can't top the list. */
async function refreshPerformance() {
  const { rows } = await db.query(
    `SELECT post_id,
            count(*) FILTER (WHERE event_type = 'impression')::int AS seen,
            count(*) FILTER (WHERE event_type IN ('open', 'view'))::int AS opens,
            count(*) FILTER (WHERE event_type = 'tap_shop')::int AS shop_taps,
            count(*) FILTER (WHERE event_type IN ('save', 'save_product'))::int AS saves,
            count(*) FILTER (WHERE event_type = 'like')::int AS likes,
            count(*) FILTER (WHERE event_type = 'complete')::int AS completes
       FROM post_events WHERE created_at > now() - interval '30 days' GROUP BY post_id`);
  const good = (r) => 3 * r.shop_taps + 2 * r.saves + r.likes + r.completes;
  const totalSeen = rows.reduce((a, r) => a + r.seen, 0);
  const prior = totalSeen ? rows.reduce((a, r) => a + good(r), 0) / totalSeen : 0;
  for (const r of rows) {
    const score = (good(r) + prior * PERF_PRIOR_VIEWS) / (r.seen + PERF_PRIOR_VIEWS);
    await db.query(
      `INSERT INTO post_performance (post_id, seen, opens, shop_taps, saves, likes, completes, score, refreshed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (post_id) DO UPDATE SET seen = $2, opens = $3, shop_taps = $4, saves = $5, likes = $6, completes = $7, score = $8, refreshed_at = now()`,
      [r.post_id, r.seen, r.opens, r.shop_taps, r.saves, r.likes, r.completes, Math.round(score * 1e6) / 1e6]);
  }
  return { posts: rows.length, prior };
}

/** The readiness panel: is there enough real behaviour to switch the learning feed on? */
async function readiness() {
  const n = await numbers();
  const { rows: [r] } = await db.query(
    `SELECT count(*) FILTER (WHERE event_type <> 'impression')::int AS actions,
            count(*) FILTER (WHERE event_type = 'impression')::int AS seen,
            min(created_at) AS first_at
       FROM post_events WHERE created_at > now() - interval '90 days'`);
  const { rows: [s] } = await db.query(
    `SELECT count(*)::int AS shoppers FROM (
       SELECT COALESCE(follower_id::text, device_id) AS who FROM post_events
        WHERE event_type <> 'impression' AND created_at > now() - interval '90 days'
        GROUP BY 1 HAVING count(*) >= 20) x`);
  const { rows: [a] } = await db.query(
    `SELECT count(DISTINCT COALESCE(follower_id::text, device_id))::int AS n FROM post_events WHERE created_at > now() - interval '30 days'`);
  const days = r.first_at ? Math.max(1, Math.round((Date.now() - new Date(r.first_at).getTime()) / DAY)) : 0;
  return {
    learning_on: n.learning,
    shoppers_20_actions: s.shoppers, active_shoppers_30d: a.n, actions: r.actions, posts_seen: r.seen, days_of_data: days,
    line: `${s.shoppers} shopper${s.shoppers === 1 ? '' : 's'} with 20+ actions each · ${r.actions.toLocaleString('en-IN')} actions in ${days} day${days === 1 ? '' : 's'}`,
    guide: 'Guide: a few hundred active shoppers and 3–4 weeks of data. Check the preview before switching it on.',
  };
}

/** The preview: for one shopper, "feed today" beside "feed if learning were on". */
async function preview({ followerId = null, phone = null } = {}) {
  let f = null;
  if (followerId) f = (await db.query(`SELECT f.id, f.user_id FROM followers f WHERE f.id = $1`, [followerId])).rows[0];
  else if (phone) {
    const digits = String(phone).replace(/\D/g, '').slice(-10);
    f = (await db.query(`SELECT f.id, f.user_id FROM followers f JOIN users u ON u.id = f.user_id WHERE right(regexp_replace(u.phone, '\\D', '', 'g'), 10) = $1 LIMIT 1`, [digits])).rows[0];
  }
  if (!f) return { found: false };
  const who = await sp.resolveWho({ userId: f.user_id, followerId: null, deviceId: null, lat: null, lng: null, cityId: null, shopFor: [], styleIds: [], follows: [] });
  const line = (p, i) => ({ position: i + 1, id: p.id, title: p.title, creator: p.creator.name, brand: p.brand.name, again: p.again, score: p.score ? Math.round(p.score.score * 1000) / 1000 : null });
  const [a, b] = await Promise.all([feed(who, { size: 20, forceStage: 'A' }), feed(who, { size: 20, forceStage: 'B' })]);
  return { found: true, follower_id: f.id, today: a.posts.map(line), learning: b.posts.map(line) };
}

module.exports = { PAGE, ACTION_WEIGHT, numbers, feed, circles, refreshPerformance, readiness, preview, noCreatorTwice, withNewPlaces };
