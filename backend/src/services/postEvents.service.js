'use strict';

/**
 * postEvents.service.js — the follower behaviour log for posts (Slice 0).
 * Contract: features/follower-event-log/
 *
 * follower-app-v2 (rules v1.7 §5.14): the shopper app records what she sees and
 * does here. Readers: the feed's never-repeat rule and the learning feed
 * (shopperFeed.service), and the hourly post_performance refresh.
 *
 * Two deliberate choices:
 *   · BATCH ONLY. One HTTP call per impression would be absurd; the client
 *     buffers and flushes. The cap is enforced here, not trusted from the app.
 *   · Guests are first-class. follower_id is NULL and device_id carries the
 *     identity, because browsing without an account is the normal path
 *     (follower-guest-first law).
 */

const db = require('../config/db');

async function followerIdForUser(userId) {
  if (!userId) return null;
  const { rows } = await db.query(`SELECT id FROM followers WHERE user_id = $1`, [userId]);
  return rows[0] ? rows[0].id : null;
}

// Locked at v1. A typo must be LOUD in development, not silently swallowed —
// an event vocabulary that quietly drifts produces stats nobody can trust.
const EVENT_TYPES = new Set([
  'impression', 'view', 'complete', 'tap_shop', 'tap_product',
  'share', 'save', 'unsave', 'like', 'unlike', 'add_to_bag',
  // follower-app-v2 (5.14): opening, time on a photo, watching, load pauses, taps, comments.
  'open', 'dwell', 'watch', 'pause', 'sound_on', 'sound_off', 'replay', 'buffer',
  'tap_creator', 'tap_brand', 'comment', 'save_product', 'unsave_product',
]);

const SURFACES = new Set([
  'discover', 'posts_tab', 'videos_tab', 'concept', 'creator_store',
  'wishlist', 'search', 'share_link',
  'home', 'play', 'post', 'brand_store', 'offers', 'saved', 'collection', 'link',
]);

const MAX_BATCH = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates the whole batch before a single row is written — a batch with one
 * bad event writes NOTHING, so a client bug can't leave half-truths in the log.
 * Throws Error(message) with `.field` set; the controller maps it to 422.
 */
function validateBatch(body) {
  const deviceId = typeof body?.device_id === 'string' ? body.device_id.trim() : '';
  if (!deviceId) { const e = new Error('device_id is required'); e.field = 'device_id'; throw e; }
  if (deviceId.length > 128) { const e = new Error('device_id is too long'); e.field = 'device_id'; throw e; }

  const events = body?.events;
  if (!Array.isArray(events) || events.length === 0) {
    const e = new Error('events must be a non-empty array'); e.field = 'events'; throw e;
  }
  if (events.length > MAX_BATCH) {
    const e = new Error(`events may not exceed ${MAX_BATCH} per batch`); e.field = 'events'; throw e;
  }

  const clean = events.map((ev, i) => {
    const at = `events[${i}]`;
    if (!ev || typeof ev !== 'object') { const e = new Error(`${at} must be an object`); e.field = 'events'; throw e; }
    if (!UUID_RE.test(String(ev.post_id || ''))) {
      const e = new Error(`${at}.post_id must be a uuid`); e.field = 'post_id'; throw e;
    }
    if (!EVENT_TYPES.has(ev.event_type)) {
      const e = new Error(`${at}.event_type '${ev.event_type}' is not a known event`); e.field = 'event_type'; throw e;
    }
    if (!SURFACES.has(ev.surface)) {
      const e = new Error(`${at}.surface '${ev.surface}' is not a known surface`); e.field = 'surface'; throw e;
    }
    if (ev.product_id != null && !UUID_RE.test(String(ev.product_id))) {
      const e = new Error(`${at}.product_id must be a uuid`); e.field = 'product_id'; throw e;
    }
    const position = ev.position == null ? null : Number(ev.position);
    if (position != null && (!Number.isInteger(position) || position < 0)) {
      const e = new Error(`${at}.position must be a non-negative integer`); e.field = 'position'; throw e;
    }
    const dwellMs = ev.dwell_ms == null ? null : Number(ev.dwell_ms);
    if (dwellMs != null && (!Number.isFinite(dwellMs) || dwellMs < 0)) {
      const e = new Error(`${at}.dwell_ms must be a non-negative number`); e.field = 'dwell_ms'; throw e;
    }
    return {
      post_id: ev.post_id,
      event_type: ev.event_type,
      surface: ev.surface,
      position,
      product_id: ev.product_id || null,
      dwell_ms: dwellMs == null ? null : Math.round(dwellMs),
      meta: ev.meta && typeof ev.meta === 'object' ? ev.meta : {},
    };
  });

  return {
    deviceId,
    sessionId: typeof body.session_id === 'string' ? body.session_id.slice(0, 128) : null,
    events: clean,
  };
}

/**
 * Writes a validated batch. Events naming a post that no longer exists are
 * SKIPPED rather than fatal — a post deleted while sitting in a client buffer
 * is normal, not a client error.
 */
async function ingest({ userId, deviceId, sessionId, events }) {
  const followerId = userId ? await followerIdForUser(userId) : null;

  const ids = [...new Set(events.map(e => e.post_id))];
  const { rows: live } = await db.query(
    `SELECT id FROM creator_posts WHERE id = ANY($1::uuid[])`, [ids]);
  const liveIds = new Set(live.map(r => r.id));

  const keep = events.filter(e => liveIds.has(e.post_id));
  const skipped = events.length - keep.length;
  if (keep.length === 0) return { accepted: 0, skipped };

  const params = [];
  const tuples = keep.map((e) => {
    const base = params.length;
    params.push(e.post_id, followerId, deviceId, sessionId, e.event_type,
      e.surface, e.position, e.product_id, e.dwell_ms, JSON.stringify(e.meta));
    return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},`
         + `$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10}::jsonb)`;
  });

  await db.query(
    `INSERT INTO post_events
       (post_id, follower_id, device_id, session_id, event_type,
        surface, position, product_id, dwell_ms, meta)
     VALUES ${tuples.join(',')}`,
    params);

  return { accepted: keep.length, skipped };
}

module.exports = { validateBatch, ingest, EVENT_TYPES, SURFACES, MAX_BATCH };
