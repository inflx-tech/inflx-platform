'use strict';

/**
 * Item 6 — the admin numbers the rules depend on (rules v1.18 §7B, N22).
 * Contract: features/item6-negotiation · gap report §10
 *
 *   negotiation_rounds   2   1–5   copied onto a negotiation when it starts
 *   pool_lifetime_days   30  7–90  copied onto a pool entry when it is created
 *   min_shoppable_posts  1   1–10  copied onto an invitation when it is sent
 *
 * NEVER RETROACTIVE by construction: readers copy the value onto the row they create and read
 * the row afterwards. Cached in-process for 60 seconds like paymentConfig, busted on write.
 * Every change writes one audit row per changed key (who, when, old, new).
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');

const DEFAULTS = Object.freeze({
  // The master switch (features/subscriptions-master-switch). 1 = plan limits apply, 0 = nothing
  // is restricted. 'switch' tells the admin page to draw it as a switch, not a number box.
  subscriptions_enforced: { value: 1, min: 0, max: 1, unit: 'on/off', label: 'Subscription plans', kind: 'switch' },
  negotiation_rounds: { value: 2, min: 1, max: 5, unit: 'rounds', label: 'Negotiation rounds' },
  pool_lifetime_days: { value: 30, min: 7, max: 90, unit: 'days', label: 'Pool entry lifetime' },
  min_shoppable_posts: { value: 1, min: 1, max: 10, unit: 'post', label: 'Minimum shoppable posts' },
  // Item 7 (rules v1.20 §3, §9) — both stamped onto the agreement at generation.
  campaign_fee_pct: { value: 8, min: 0, max: 30, unit: 'percent', label: 'INFLX campaign fee' },
  remote_return_days: { value: 7, min: 1, max: 60, unit: 'days', label: 'Remote return window' },
  // Item 8 (rules v1.21 §8) — both stamped when they are applied.
  pitch_response_days: { value: 30, min: 7, max: 90, unit: 'days', label: 'Pitch response period' },
  pitch_cooldown_days: { value: 30, min: 0, max: 90, unit: 'days', label: 'Pitch rejection cooldown' },
  // Item 10 (rules v1.24 §11.1, §7B) — stamped onto the shoot row when she marks attended.
  shoot_auto_confirm_days: { value: 3, min: 1, max: 30, unit: 'days', label: 'Store visit auto-confirm' },
  // Item 11 (rules v1.27 §11.2, §25) — the ONE new number. Stamped on the RETURN when it is
  // delivered to the branch (or when she marks a no-courier return sent), never re-read.
  // The existing remote_return_days above is unchanged.
  remote_return_autoconfirm_days: { value: 7, min: 1, max: 30, unit: 'days', label: 'Remote return auto-confirm' },
  // Item 12 (rules v1.29 §12.2, C17) — the two new numbers, then the waiting period MOVED here from
  // payment_config (approval Q4). Each is stamped at the moment it starts to matter, never re-read.
  content_change_rounds: { value: 2, min: 1, max: 5, unit: 'rounds', label: 'Content change requests' },
  content_report_silence_days: { value: 7, min: 1, max: 30, unit: 'days', label: 'Brand silence before the Creator may report' },
  final_payment_wait_days: { value: 7, min: 1, max: 60, unit: 'days', label: 'Final payment waiting period' },
  // Item 14 (rules v1.30 §12.1, A1) — stamped when she marks her social posts posted, never re-read.
  sale_live_autoconfirm_days: { value: 7, min: 1, max: 30, unit: 'days', label: 'Pay for Sale confirms itself after' },
  // post-links-codes (rules v1.5 §4.14) — stamped on each tap as the end of its window.
  link_channel_window_days: { value: 30, min: 1, max: 90, unit: 'days', label: 'Link channel window' },
  // follower-app-v2 (rules v1.7 §5.12) — the feed's numbers, read on every feed request.
  feed_near_km: { value: 50, min: 5, max: 500, unit: 'km', label: 'Near range' },
  feed_new_share_pct: { value: 15, min: 0, max: 50, unit: 'percent', label: 'Places for new posts' },
  feed_new_hours: { value: 48, min: 6, max: 168, unit: 'hours', label: 'A post counts as new for' },
  feed_repeat_days: { value: 30, min: 1, max: 90, unit: 'days', label: 'Seen posts stay out of the feed for' },
  feed_learning_on: { value: 0, min: 0, max: 1, unit: 'on/off', label: 'Feed that learns', kind: 'switch' },
  feed_w_does: { value: 40, min: 0, max: 100, unit: 'weight', label: 'Dial: what she does' },
  feed_w_recent: { value: 25, min: 0, max: 100, unit: 'weight', label: 'Dial: how recent' },
  feed_w_near: { value: 15, min: 0, max: 100, unit: 'weight', label: 'Dial: how near' },
  feed_w_performs: { value: 20, min: 0, max: 100, unit: 'weight', label: 'Dial: how it performs' },
});
const KEYS = Object.freeze(Object.keys(DEFAULTS));

/** N22 — the plain description under each setting, with its range and the never-retroactive fact. */
const DESCRIPTION = Object.freeze({
  negotiation_rounds: 'How many counters a single negotiation may hold. After the last one, the side receiving it can only accept or decline. Between 1 and 5. A negotiation keeps the number it started with, so changing this never affects one already running.',
  pool_lifetime_days: "How long a creator stays in a brand's pool after agreeing terms but asking for a different date or mode. When it runs out the entry closes and the creator is told. Between 7 and 90 days.",
  min_shoppable_posts: 'The least number of shoppable posts a creator must make in a Pay for Sale or Hybrid collaboration. Shown to both sides on the terms and never negotiated. Between 1 and 10. Stamped on each invitation when it is sent.',
  campaign_fee_pct: "What INFLX charges the brand on a Pay for Content collaboration, as a percentage of the fee. Charged once, to the brand, when the funds lock at the brand's signature. It is never deducted from a creator payment, and no campaign fee is charged on a Hybrid fixed amount. Between 0 and 30. Stamped on each agreement when it is generated.",
  remote_return_days: 'How long a creator has to send back anything she does not keep after a Remote shoot, counted from posting. The brand pays the return shipping. Between 1 and 60 days. Printed in every Remote agreement and stamped on it when it is generated.',
  pitch_response_days: "How long a brand has to give a creator its first answer on a pitch. She is told the date when she sends it, and the brand is reminded after seven days and again after twenty-one. Between 7 and 90 days. Stamped on each pitch when it is sent, so changing this never moves one already waiting. Once the brand has answered, this clock has done its job and the conversation runs until her proposed date comes too close for a set to be built.",
  pitch_cooldown_days: 'How long a creator must wait before pitching the same brand again after a rejection. It is a pause, not a refusal: it never stops the brand inviting her and never stops her accepting. Counted per brand, not per Aim. Between 0 and 90 days. Stamped on the rejection when it is made. A brand that wants no further contact blocks her instead.',
  remote_return_autoconfirm_days: 'How long a brand has to confirm a Remote return after it reaches the branch. If the brand does nothing, the return confirms itself and the record says it was automatic — unless the brand has reported an item missing or damaged, in which case it waits. Between 1 and 30 days. Stamped on the return when it is delivered, so changing this never moves a date already promised. Where couriers cannot collect from her pincode and she posts the items back herself, it is stamped when she marks them sent.',
  shoot_auto_confirm_days: "How long a brand has to confirm a store visit after the creator marks that she attended. If the brand does nothing, the visit confirms itself and her content step opens — safe because completing a shoot moves no money. Between 1 and 30 days. Stamped on the visit when she marks it, so changing this never moves a date already promised.",
  content_change_rounds: "How many times a Brand may ask for changes to a creator's content before a further rejection becomes a dispute. On the last allowed round the Brand is warned; after it they can only approve or report it to INFLX. Between 1 and 5. Stamped on the collaboration when the Creator first submits, so changing this never affects one already under way.",
  content_report_silence_days: "Pay for Content and Hybrid: how long after the Creator confirms she has posted the Brand may stay silent before she can tell INFLX. There is no automatic confirmation where confirming pays money — the money is the Brand's — so this is her way to be heard. Telling INFLX records a dispute and moves no money. Between 1 and 30 days. Stamped when she confirms she posted.",
  link_channel_window_days: "How long a tap on a creator's links decides which channel an order counts under (Instagram, YouTube, WhatsApp, Facebook, Other or Post code). With no tap in the window the order counts as 'In INFLX'. Reporting only: it never changes who is paid, the commission or the INFLX fee. Between 1 and 90 days. Stamped on each tap when it is made, so changing this applies to new taps only.",
  final_payment_wait_days: "The delay before the final 50% of a Pay for Content fee or a Hybrid fixed amount is released, counted from the Brand's confirmation that it is live. Paid on that day at the release time. Between 1 and 60 days. Stamped on the payment at the Brand's confirmation, so changing this never moves a date already promised. This replaces the waiting period that used to sit on the Payments page.",
  sale_live_autoconfirm_days: "After a Pay for Sale creator marks her social posts posted, how long the Brand has to confirm they are live or tell INFLX something is wrong. If it does neither, the collaboration is confirmed live by itself — safe because nothing is paid at that moment on Pay for Sale. Never applies to Hybrid, where confirming releases money. Between 1 and 30 days. Stamped when she marks them posted, so changing this never moves a date already promised.",
  feed_near_km: "How far from where a shopper is (her phone's location, or her city's centre when location is off) a creator or a brand store still counts as near her. Near posts come right after the creators she follows. Between 5 and 500 km. Applies to the next feed she opens.",
  feed_new_share_pct: 'The share of places in every feed kept for brand-new posts, so a new post is seen and can earn a score. Between 0 and 50 percent.',
  feed_new_hours: 'How long after going live a post counts as new for those places. Between 6 and 168 hours.',
  feed_repeat_days: 'How long a post a shopper has seen stays out of her Home and Play feeds. Seen means at least half on screen for one second. When she has seen everything, seen posts come back, the one she saw longest ago first, so the feed is never empty. It never hides a post from stores, search, Saved or its link. Between 1 and 90 days.',
  feed_learning_on: 'When this is on, Home and Play are ordered by the feed that learns: each post gets a score from the four dials below. When it is off, the rules feed orders them: creators she follows, then near her, then everything else, newest first. The fixed rules (no creator twice in a row, places for new posts, never repeat) apply either way. Check the readiness panel and the preview on the Feed page before switching it on.',
  feed_w_does: "How much a shopper's own actions count: purchases most, then add to bag, save, like, a finished video, time spent, a plain view, on the post's creator, brand, category, theme, offer type and price band. Older actions fade by half every 14 days. Between 0 and 100; only matters when the feed that learns is on.",
  feed_w_recent: "How much a post's freshness counts. Freshness halves every 3 days. Between 0 and 100; only matters when the feed that learns is on.",
  feed_w_near: 'How much being near her counts: full within the near range, falling with distance beyond it. Between 0 and 100; only matters when the feed that learns is on.',
  feed_w_performs: "How much a post's results across all shoppers count: shop taps, saves, likes and finished videos per view, adjusted so a few lucky views cannot jump to the top. Recalculated every hour. Between 0 and 100; only matters when the feed that learns is on.",
  subscriptions_enforced: 'When this is off, no plan limit applies to any brand: every quota is unlimited and every feature is included. Your tiers, prices and per-brand overrides are kept exactly as they are and apply again the moment you switch it back on. Billing is not affected — brands on a paid plan keep their plan and are still charged. A brand can go past its plan while this is off; when you switch it back on nothing is deleted and nothing stops working, she simply cannot add more.',
});

const RANGE_MESSAGE = (min, max) => `Enter a number between ${min} and ${max}.`;

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 60_000;

/** Map key → { key, value, min, max, unit, label, description, updatedAt, updatedBy }. */
async function getAll({ fresh = false } = {}) {
  const now = Date.now();
  if (!fresh && _cache && now - _cacheTime < CACHE_TTL_MS) return _cache;
  const out = {};
  try {
    const { rows } = await db.query(`SELECT key, value, min_value, max_value, unit, label, updated_at, updated_by FROM platform_settings`);
    for (const r of rows) {
      out[r.key] = { key: r.key, value: Number(r.value), min: Number(r.min_value), max: Number(r.max_value), unit: r.unit, label: r.label, kind: (DEFAULTS[r.key] || {}).kind || 'number', description: DESCRIPTION[r.key] || '', updatedAt: r.updated_at, updatedBy: r.updated_by || null };
    }
  } catch (e) {
    // The table arrives with migration 182; before it, or if the read fails, the defaults stand.
    console.error('[platformSettings] read failed, using defaults:', e.message);
  }
  for (const k of KEYS) if (!out[k]) out[k] = { key: k, ...DEFAULTS[k], description: DESCRIPTION[k], updatedAt: null, updatedBy: null };
  _cache = out; _cacheTime = now;
  return out;
}

/** One number. */
async function get(key) {
  const all = await getAll();
  const s = all[key];
  if (!s) throw new Error(`Unknown platform setting: ${key}`);
  return s.value;
}

/**
 * Admin write. `patch` = { key: value, … }. Out-of-range → 422 with the exact message; unknown
 * keys are ignored. One audit row per key whose value actually changed. Busts the cache.
 */
async function update(patch, adminUserId) {
  const current = await getAll({ fresh: true });
  const changes = [];
  for (const key of KEYS) {
    if (patch[key] === undefined || patch[key] === null || patch[key] === '') continue;
    const n = Number(patch[key]);
    const s = current[key];
    if (!Number.isInteger(n) || n < s.min || n > s.max) throw new AppError('VALIDATION_ERROR', RANGE_MESSAGE(s.min, s.max), 422, key);
    if (n !== s.value) changes.push({ key, old: s.value, value: n });
  }
  if (!changes.length) return { changed: [], settings: current };
  await db.withTransaction(async (tx) => {
    for (const ch of changes) {
      await tx.query(`UPDATE platform_settings SET value = $2, updated_at = now(), updated_by = $3 WHERE key = $1`, [ch.key, ch.value, adminUserId || null]);
      await tx.query(`INSERT INTO platform_settings_audit (key, old_value, new_value, changed_by) VALUES ($1, $2, $3, $4)`, [ch.key, ch.old, ch.value, adminUserId || null]);
    }
  });
  _cache = null; _cacheTime = 0;
  return { changed: changes, settings: await getAll({ fresh: true }) };
}

/** The audit trail, newest first, with the admin's name. */
async function audit({ limit = 20 } = {}) {
  const { rows } = await db.query(
    `SELECT a.id, a.key, a.old_value, a.new_value, a.changed_at, u.name AS changed_by_name, u.email AS changed_by_email
       FROM platform_settings_audit a LEFT JOIN users u ON u.id = a.changed_by
      ORDER BY a.changed_at DESC LIMIT $1`, [Math.min(100, Math.max(1, limit))]);
  return rows.map(r => ({ id: r.id, key: r.key, label: (DEFAULTS[r.key] || {}).label || r.key, oldValue: r.old_value, newValue: r.new_value, changedAt: r.changed_at, changedBy: r.changed_by_name || r.changed_by_email || null }));
}

/** Tests only. */
function _resetCache() { _cache = null; _cacheTime = 0; }

module.exports = { KEYS, DEFAULTS, DESCRIPTION, RANGE_MESSAGE, getAll, get, update, audit, _resetCache };
