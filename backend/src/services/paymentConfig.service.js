'use strict';

/**
 * paymentConfig.service.js
 *
 * Single source of truth for all runtime-configurable payment values.
 * Reads from the payment_config table (singleton row id=1).
 * Falls back to env defaults if DB is unavailable.
 * Caches for 60 seconds to avoid per-request DB hits.
 */

const db  = require('../config/db');
const env = require('../config/env');

let _cache     = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 60_000; // 60 s

/**
 * Get the current payment config.
 * Returns a plain object with numeric values.
 */
async function getConfig() {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < CACHE_TTL_MS) return _cache;

  try {
    const { rows } = await db.query(
      `SELECT platform_fee_pct, tranche_1_pct, tranche_2_pct, tranche_3_pct,
              tds_pct, agency_tds_pct, offer_expiry_hours, return_window_days,
              min_withdrawal_inr, allow_commission_negotiation
       FROM payment_config WHERE id = 1`
    );
    if (rows[0]) {
      _cache = {
        platformFeePct:   parseFloat(rows[0].platform_fee_pct),
        tranche1Pct:      parseFloat(rows[0].tranche_1_pct),
        tranche2Pct:      parseFloat(rows[0].tranche_2_pct),
        tranche3Pct:      parseFloat(rows[0].tranche_3_pct),
        tdsPct:           parseFloat(rows[0].tds_pct),
        agencyTdsPct:     rows[0].agency_tds_pct != null ? parseFloat(rows[0].agency_tds_pct) : 5,
        offerExpiryHours: parseInt(rows[0].offer_expiry_hours, 10),
        returnWindowDays: parseInt(rows[0].return_window_days, 10),
        minWithdrawalInr: parseFloat(rows[0].min_withdrawal_inr),
        allowCommissionNegotiation: rows[0].allow_commission_negotiation !== false,
      };
      _cacheTime = now;
      return _cache;
    }
  } catch (err) {
    console.warn('[PAYMENT_CONFIG] DB read failed, using env defaults:', err.message);
  }

  // Env fallback
  return {
    platformFeePct:   env.PLATFORM_FEE_PCT   ?? 8,
    tranche1Pct:      25,
    tranche2Pct:      25,
    tranche3Pct:      50,
    tdsPct:           env.TDS_PCT            ?? 10,
    agencyTdsPct:     env.AGENCY_TDS_PCT     ?? 5,
    offerExpiryHours: env.OFFER_EXPIRY_HOURS ?? 48,
    returnWindowDays: env.RETURN_WINDOW_DAYS ?? 30,
    minWithdrawalInr: 100,
    allowCommissionNegotiation: true,
  };
}

/**
 * Update the payment config (admin only).
 * Busts the in-memory cache immediately.
 */
async function updateConfig(fields, adminUserId) {
  const allowed = [
    'platform_fee_pct', 'tranche_1_pct', 'tranche_2_pct', 'tranche_3_pct',
    'tds_pct', 'offer_expiry_hours', 'return_window_days', 'min_withdrawal_inr',
    'allow_commission_negotiation',
  ];

  const updates = {};
  allowed.forEach(k => {
    if (fields[k] !== undefined && fields[k] !== null && fields[k] !== '') {
      updates[k] = fields[k];
    }
  });

  if (!Object.keys(updates).length) {
    throw new Error('No valid fields to update');
  }

  // Validate tranche splits must sum to 100
  const t1 = parseFloat(updates.tranche_1_pct ?? 'x');
  const t2 = parseFloat(updates.tranche_2_pct ?? 'x');
  const t3 = parseFloat(updates.tranche_3_pct ?? 'x');
  if (!isNaN(t1) && !isNaN(t2) && !isNaN(t3)) {
    const sum = t1 + t2 + t3;
    if (Math.abs(sum - 100) > 0.01) {
      throw new Error(`Tranche splits must sum to 100 (got ${sum.toFixed(2)})`);
    }
  }

  const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`);
  setClauses.push(`updated_at = now()`);
  setClauses.push(`updated_by = $${Object.keys(updates).length + 1}`);

  await db.query(
    `UPDATE payment_config SET ${setClauses.join(', ')} WHERE id = 1`,
    [...Object.values(updates), adminUserId]
  );

  // Bust cache
  _cache     = null;
  _cacheTime = 0;
}

module.exports = { getConfig, updateConfig };
