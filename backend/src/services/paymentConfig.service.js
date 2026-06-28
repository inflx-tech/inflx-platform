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
              min_withdrawal_inr, allow_commission_negotiation,
              gst_pct, tcs_pct, tcs_active, tcs_active_from_date,
              platform_gstin, platform_business_name, platform_business_address,
              platform_state_code, invoice_prefix_subscription, invoice_prefix_commerce,
              tranche_3_release_after_days, tranche_3_release_time_ist,
              attribution_window_days, delivery_ref_km, delivery_ref_days
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
        // Wave 1 — tax + identity (migration 072)
        gstPct:                  rows[0].gst_pct != null ? parseFloat(rows[0].gst_pct) : 18,
        tcsPct:                  rows[0].tcs_pct != null ? parseFloat(rows[0].tcs_pct) : 1,
        tcsActive:               rows[0].tcs_active === true,
        tcsActiveFromDate:       rows[0].tcs_active_from_date || null,
        platformGstin:           rows[0].platform_gstin || null,
        platformBusinessName:    rows[0].platform_business_name || null,
        platformBusinessAddress: rows[0].platform_business_address || null,
        platformStateCode:       rows[0].platform_state_code || null,
        invoicePrefixSubscription: rows[0].invoice_prefix_subscription || 'INF-SUB',
        invoicePrefixCommerce:     rows[0].invoice_prefix_commerce || 'INF-COM',
        // Wave 1 — T3 release timing (migration 074)
        tranche3ReleaseAfterDays: rows[0].tranche_3_release_after_days != null
          ? parseInt(rows[0].tranche_3_release_after_days, 10) : 30,
        tranche3ReleaseTimeIst:   rows[0].tranche_3_release_time_ist || '03:00:00',
        // Way-4 — creator attribution "cookie" window (migration 120).
        attributionWindowDays: rows[0].attribution_window_days != null
          ? parseInt(rows[0].attribution_window_days, 10) : 30,
        // Delivery ETA rule (migration 121): ref distance + days; scaled by store↔address distance.
        deliveryRefKm:   rows[0].delivery_ref_km != null ? parseInt(rows[0].delivery_ref_km, 10) : 100,
        deliveryRefDays: rows[0].delivery_ref_days != null ? parseInt(rows[0].delivery_ref_days, 10) : 2,
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
    // Wave 1 — tax + identity (migration 072) safe defaults
    gstPct:                  18,
    tcsPct:                  1,
    tcsActive:               false,
    tcsActiveFromDate:       null,
    platformGstin:           null,
    platformBusinessName:    null,
    platformBusinessAddress: null,
    platformStateCode:       null,
    invoicePrefixSubscription: 'INF-SUB',
    invoicePrefixCommerce:     'INF-COM',
    // Wave 1 — T3 release timing (migration 074) safe defaults
    tranche3ReleaseAfterDays: 30,
    tranche3ReleaseTimeIst:   '03:00:00',
    // Way-4 — attribution window (migration 120) safe default
    attributionWindowDays: parseInt(env.ATTRIBUTION_WINDOW_DAYS || '30', 10),
    // Delivery ETA rule (migration 121) safe defaults
    deliveryRefKm:   100,
    deliveryRefDays: 2,
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
    // Wave 1 — tax + identity (migration 072)
    'gst_pct', 'tcs_pct', 'tcs_active', 'tcs_active_from_date',
    'platform_gstin', 'platform_business_name', 'platform_business_address',
    'platform_state_code', 'invoice_prefix_subscription', 'invoice_prefix_commerce',
    // Wave 1 — T3 release timing (migration 074)
    'tranche_3_release_after_days', 'tranche_3_release_time_ist',
    // Way-4 — attribution window (migration 120)
    'attribution_window_days',
    // Delivery ETA rule (migration 121)
    'delivery_ref_km', 'delivery_ref_days',
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
