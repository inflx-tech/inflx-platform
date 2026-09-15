'use strict';

/**
 * handshakeSettings.service.js — the admin-controlled limits for the handshake.
 * Contract: features/collab-part2-precampaign-handshake
 *
 * Founder, 2026-08-11: *"we add these limits not hardcoded, we keep admin control one."*
 *
 * Before this, the creator-side limits were constants in proposal.service —
 * RATE_LIMITS { 5 active, 3/day, 10/week }, PROPOSAL_TTL_DAYS 7,
 * COOLDOWN_DAYS_AFTER_REJECT 30 — so changing any of them needed a deploy. And the
 * brand side had no limits at all, because brand outreach never existed.
 *
 * BOTH sides live here now. Leaving creator limits frozen in code while brand limits
 * became editable would be baffling to whoever operates it.
 *
 * FALLBACK IS DELIBERATE. Every read falls back to today's constants, so a missing or
 * unreadable settings row degrades to current behaviour instead of disabling the flow
 * or removing every cap. A settings table that can take the feature down is worse than
 * a hardcoded one.
 *
 * Cached briefly: these are read on every send and every eligibility check, and they
 * change perhaps monthly. A short TTL keeps an admin edit felt quickly without hitting
 * the database on every request.
 */

const db = require('../config/db');

/** Today's hardcoded values — the fallback, and what migration 149 seeds. */
const DEFAULTS = Object.freeze({
  creator_max_active:       5,
  creator_max_per_day:      3,
  creator_max_per_week:     10,
  brand_max_active:         12,
  brand_max_per_day:        10,
  brand_max_per_week:       40,
  request_ttl_days:         7,
  decline_cooldown_days:    30,
  // Item 8 — counter_rounds_per_side is gone. A pitch's rounds come from item 6's
  // `negotiation_rounds`, stamped on the thread when it starts, which is the only
  // round limit left in the product. The column stays on the table; nothing reads it.
  broadcast_max_recipients: 30,
  agreement_expiry_days:    90,
});

const CACHE_MS = 60_000;
let cache = null;
let cachedAt = 0;

/**
 * Read the settings row, falling back to DEFAULTS for anything missing.
 * Never throws — a settings failure must not break a send.
 */
async function get({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cachedAt < CACHE_MS) return cache;
  try {
    const { rows } = await db.query(`SELECT * FROM handshake_settings WHERE id = 1`);
    const row = rows[0] || {};
    const merged = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS)) {
      if (row[key] != null) merged[key] = Number(row[key]);
    }
    cache = Object.freeze(merged);
    cachedAt = Date.now();
    return cache;
  } catch (err) {
    // Table absent (pre-migration) or unreadable → today's behaviour, loudly.
    console.warn('[handshakeSettings] falling back to defaults:', err.message);
    return DEFAULTS;
  }
}

/** Limits for one side, so callers do not re-derive the naming each time. */
async function limitsFor(side) {
  const s = await get();
  if (side === 'brand') {
    return { maxActive: s.brand_max_active, maxPerDay: s.brand_max_per_day, maxPerWeek: s.brand_max_per_week };
  }
  return { maxActive: s.creator_max_active, maxPerDay: s.creator_max_per_day, maxPerWeek: s.creator_max_per_week };
}

/** Admin write. Only known keys, all positive integers. */
async function update(patch, adminUserId) {
  const allowed = Object.keys(DEFAULTS);
  const sets = [];
  const params = [];

  for (const [key, value] of Object.entries(patch || {})) {
    if (!allowed.includes(key)) continue;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) {
      const err = new Error(`${key} must be a positive whole number`);
      err.field = key;
      throw err;
    }
    params.push(n);
    sets.push(`${key} = $${params.length}`);
  }
  if (sets.length === 0) {
    const err = new Error('no valid settings to update');
    err.field = 'settings';
    throw err;
  }

  params.push(adminUserId || null);
  sets.push(`updated_by = $${params.length}`);
  sets.push(`updated_at = now()`);

  const { rows } = await db.query(
    `INSERT INTO handshake_settings (id) VALUES (1)
     ON CONFLICT (id) DO UPDATE SET ${sets.join(', ')}
     RETURNING *`,
    params
  );
  cache = null;                      // an admin edit should be felt immediately
  cachedAt = 0;
  return rows[0];
}

module.exports = { get, limitsFor, update, DEFAULTS, invalidate: () => { cache = null; cachedAt = 0; } };
