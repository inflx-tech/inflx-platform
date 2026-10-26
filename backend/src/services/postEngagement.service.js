'use strict';

/**
 * postEngagement.service.js — what shoppers did with a post inside INFLX, counted from the tables the
 * shopper app already fills (post_events, post_likes, post_saves, post_comments). All-time since the
 * post went live, counted at read; never the feed's 30-day roll-up (post_performance stays the ranker's).
 * Contract: features/post-engagement-stats · rules §4.15 · spec P1–P3
 *
 *   views        the post opened ('open'; 'view' kept for an older bundle) — guests count
 *   likes        rows in post_likes (accounts; a like taken back is gone)
 *   comments     shoppers' visible comments (her replies and hidden ones are not counted)
 *   shares       share taps inside INFLX — guests count
 *   saves        rows in post_saves (accounts; a guest's save lands here at sign-in)
 *   shop_taps    Shop and product taps — guests count
 *   bag_adds     added to bag — guests count
 *   finished     the video watched to the end — guests count; null for a photo post
 */

const db = require('../config/db');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EVENTS_SQL = `
  SELECT p.id,
         COALESCE((SELECT count(*) FILTER (WHERE e.event_type IN ('open', 'view')) FROM post_events e WHERE e.post_id = p.id), 0)::int AS views,
         COALESCE((SELECT count(*) FILTER (WHERE e.event_type = 'share') FROM post_events e WHERE e.post_id = p.id), 0)::int AS shares,
         COALESCE((SELECT count(*) FILTER (WHERE e.event_type IN ('tap_shop', 'tap_product')) FROM post_events e WHERE e.post_id = p.id), 0)::int AS shop_taps,
         COALESCE((SELECT count(*) FILTER (WHERE e.event_type = 'add_to_bag') FROM post_events e WHERE e.post_id = p.id), 0)::int AS bag_adds,
         COALESCE((SELECT count(*) FILTER (WHERE e.event_type = 'complete') FROM post_events e WHERE e.post_id = p.id), 0)::int AS finished,
         (SELECT count(*)::int FROM post_likes l WHERE l.post_id = p.id) AS likes,
         (SELECT count(*)::int FROM post_saves s WHERE s.post_id = p.id) AS saves,
         (SELECT count(*)::int FROM post_comments c WHERE c.post_id = p.id AND c.status = 'visible' AND c.author_kind = 'follower') AS comments,
         cp.media_kind
    FROM unnest($1::uuid[]) AS p(id) JOIN creator_posts cp ON cp.id = p.id`;

/** The whole block for one post (since = the post's live_since, which the post row carries), or null when unknown. */
async function numbersOf(postId, { since = null } = {}) {
  if (!UUID.test(String(postId || ''))) return null;
  const { rows: [r] } = await db.query(EVENTS_SQL, [[postId]]);
  if (!r) return null;
  return {
    since: since || null,
    views: r.views, likes: r.likes, comments: r.comments, shares: r.shares, saves: r.saves,
    shop_taps: r.shop_taps, bag_adds: r.bag_adds,
    finished: r.media_kind === 'video' ? r.finished : null,
  };
}

/** The three the list rows and Post status print, for many posts at once: Map id → { views, likes, comments }. */
async function threeOf(ids) {
  const clean = [...new Set((ids || []).filter((x) => UUID.test(String(x))))];
  const out = new Map();
  if (!clean.length) return out;
  const { rows } = await db.query(EVENTS_SQL, [clean]);
  for (const r of rows) out.set(r.id, { views: r.views, likes: r.likes, comments: r.comments });
  return out;
}

async function threeOne(postId) {
  return (await threeOf([postId])).get(postId) || { views: 0, likes: 0, comments: 0 };
}

module.exports = { numbersOf, threeOf, threeOne };
