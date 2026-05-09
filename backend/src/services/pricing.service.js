'use strict';

/**
 * pricing.service.js
 *
 * Central pricing engine for the 3-layer revenue model.
 *
 *   Layer 1 — SaaS subscription tiers           (Phase B3, not yet implemented)
 *   Layer 2 — Campaign Protection (escrow) fee  (this file, Phase B1)
 *   Layer 3 — Marketplace fee per category      (Phase B2, not yet implemented)
 *
 * All fee math goes through this service so that admin-edited rates flow
 * everywhere consistently and there is exactly one place to audit when a
 * fee value looks wrong.
 *
 * Caches escrow_fee_tiers in memory for 60s; admin updates bust the cache.
 */

const db = require('../config/db');

let _tierCache     = null;
let _tierCacheTime = 0;
const CACHE_TTL_MS = 60_000;

// ─────────────────────────────────────────────────────────────────────────────
// Layer 2 — Campaign Protection Fee
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load all escrow_fee_tiers ordered by min_amount_inr ascending.
 * Cached 60s.
 */
async function _loadTiers() {
  const now = Date.now();
  if (_tierCache && (now - _tierCacheTime) < CACHE_TTL_MS) return _tierCache;

  const { rows } = await db.query(
    `SELECT tier_key, min_amount_inr, max_amount_inr, fee_pct
       FROM escrow_fee_tiers
       ORDER BY min_amount_inr ASC`
  );
  _tierCache     = rows.map(r => ({
    tier_key:       r.tier_key,
    min_amount_inr: parseFloat(r.min_amount_inr),
    max_amount_inr: r.max_amount_inr == null ? null : parseFloat(r.max_amount_inr),
    fee_pct:        parseFloat(r.fee_pct),
  }));
  _tierCacheTime = now;
  return _tierCache;
}

function bustEscrowTierCache() {
  _tierCache     = null;
  _tierCacheTime = 0;
}

/**
 * Find the escrow fee tier whose [min, max] band contains the given amount.
 * Returns null if no tier matches (defensive — should never happen with
 * properly configured tiers covering [0, ∞)).
 */
async function lookupEscrowFeeTier(amount) {
  const tiers = await _loadTiers();
  const a = parseFloat(amount) || 0;
  for (const t of tiers) {
    const minOk = a >= t.min_amount_inr;
    const maxOk = t.max_amount_inr == null || a <= t.max_amount_inr;
    if (minOk && maxOk) return t;
  }
  return null;
}

/**
 * Resolve the L2 fee rate for a campaign at publish time.
 *
 * Precedence:
 *   1. Per-brand override (brands.escrow_fee_override_pct), if set.
 *   2. Tier lookup based on the engagement+hybrid base amount.
 *   3. Null on total failure (caller must fall back / error).
 *
 * @param {object} args
 * @param {number} args.baseAmountInr        — sum of engagement+hybrid set_budgets
 * @param {number|null} args.brandOverridePct — brands.escrow_fee_override_pct (nullable)
 * @returns {{ fee_pct: number, tier_key: string|null, source: 'brand_override'|'tier_lookup' }}
 */
async function resolveEscrowFeePct({ baseAmountInr, brandOverridePct }) {
  if (brandOverridePct != null && !Number.isNaN(parseFloat(brandOverridePct))) {
    return {
      fee_pct:  parseFloat(brandOverridePct),
      tier_key: null,
      source:   'brand_override',
    };
  }
  const tier = await lookupEscrowFeeTier(baseAmountInr);
  if (!tier) return { fee_pct: 0, tier_key: null, source: 'tier_lookup' };
  return {
    fee_pct:  tier.fee_pct,
    tier_key: tier.tier_key,
    source:   'tier_lookup',
  };
}

/**
 * Compute the L2 base for a campaign — sum of set_budget across engagement
 * and hybrid sets only. Pure conversion sets contribute nothing.
 *
 * @param {object} client    — pg client (transaction-bound or pool)
 * @param {string} campaignId
 * @returns {number} base amount in rupees
 */
async function computeEscrowFeeBase(client, campaignId) {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(
       CASE WHEN goal IN ('engagement', 'hybrid')
            THEN COALESCE(set_budget, 0)
            ELSE 0 END
     ), 0) AS base
       FROM campaign_sets
       WHERE campaign_id = $1`,
    [campaignId]
  );
  return parseFloat(rows[0].base) || 0;
}

/**
 * Lock the L2 fee on a campaign at publish time. Idempotent: if already
 * locked, returns existing values without overwriting.
 *
 * Sets campaigns.escrow_fee_pct_locked, escrow_fee_base_inr, escrow_fee_locked_at.
 *
 * @param {object} client    — pg client (must be inside transaction)
 * @param {string} campaignId
 * @param {string} brandId
 * @returns {{ fee_pct: number, base_inr: number, tier_key: string|null, source: string, already_locked: boolean }}
 */
async function lockEscrowFeeAtPublish(client, campaignId, brandId) {
  const { rows: existing } = await client.query(
    `SELECT escrow_fee_pct_locked, escrow_fee_base_inr
       FROM campaigns WHERE id = $1`,
    [campaignId]
  );
  if (existing[0]?.escrow_fee_pct_locked != null) {
    return {
      fee_pct:        parseFloat(existing[0].escrow_fee_pct_locked),
      base_inr:       parseFloat(existing[0].escrow_fee_base_inr),
      tier_key:       null,
      source:         'already_locked',
      already_locked: true,
    };
  }

  const baseInr = await computeEscrowFeeBase(client, campaignId);

  const { rows: brandRows } = await client.query(
    `SELECT escrow_fee_override_pct FROM brands WHERE id = $1`,
    [brandId]
  );
  const brandOverridePct = brandRows[0]?.escrow_fee_override_pct;

  const resolved = await resolveEscrowFeePct({
    baseAmountInr:    baseInr,
    brandOverridePct,
  });

  await client.query(
    `UPDATE campaigns
        SET escrow_fee_pct_locked = $1,
            escrow_fee_base_inr   = $2,
            escrow_fee_locked_at  = now()
      WHERE id = $3`,
    [resolved.fee_pct, baseInr, campaignId]
  );

  return {
    fee_pct:        resolved.fee_pct,
    base_inr:       baseInr,
    tier_key:       resolved.tier_key,
    source:         resolved.source,
    already_locked: false,
  };
}

/**
 * Read the locked L2 fee % for a campaign. Returns null if the campaign was
 * published before M037 (legacy path) — caller should fall back to
 * payment_config.platform_fee_pct in that case.
 */
async function getLockedEscrowFeePct(client, campaignId) {
  const { rows } = await client.query(
    `SELECT escrow_fee_pct_locked FROM campaigns WHERE id = $1`,
    [campaignId]
  );
  if (!rows[0] || rows[0].escrow_fee_pct_locked == null) return null;
  return parseFloat(rows[0].escrow_fee_pct_locked);
}

module.exports = {
  // L2 — escrow / Campaign Protection Fee
  lookupEscrowFeeTier,
  resolveEscrowFeePct,
  computeEscrowFeeBase,
  lockEscrowFeeAtPublish,
  getLockedEscrowFeePct,
  bustEscrowTierCache,
};
