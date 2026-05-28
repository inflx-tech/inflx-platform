'use strict';

/**
 * tax.service.js — Wave 1 of the Tax/Settlement Roadmap.
 *
 * Centralized tax math + identity helpers. Replaces the hardcoded
 * `GST_PCT = 18.00` in subscription.controller + webhook.controller
 * and lays the foundation for Wave 2 (GST on Protection Fee) and
 * Wave 3 (TCS on commerce settlement).
 *
 * All helpers are defensive: if payment_config DB read fails OR new
 * columns are not yet present (pre-migration), they fall back to the
 * same safe default values that were hardcoded pre-Wave-1.
 *
 *   gstOn(amount)               → ₹ GST on amount (2dp)
 *   withTax(base)               → { base, gst, total }   (3 numbers)
 *   tcsOn(brandPortion[, asOf]) → ₹ TCS deducted from brand portion
 *                                 (0 if tcs_active=false or before activeFromDate)
 *   getTcsConfig()              → { pct, active, activeFrom }
 *   getInvoiceIdentity()        → { gstin, businessName, address,
 *                                   stateCode, prefixSub, prefixCom }
 *   getTrancheReleaseTimeIst()  → 'HH:MM:SS' (default '03:00:00')
 *   getTrancheReleaseAfterDays()→ int (default 30)
 *
 * Contract: features/wave1-tax-config-foundation/.
 */

const paymentConfigSvc = require('./paymentConfig.service');

const FALLBACK_GST_PCT = 18.00;
const FALLBACK_TCS_PCT = 1.00;
const FALLBACK_T3_DAYS = 30;
const FALLBACK_T3_TIME = '03:00:00';

function _round2(n) {
  return parseFloat(parseFloat(n).toFixed(2));
}

async function getGstPct() {
  try {
    const cfg = await paymentConfigSvc.getConfig();
    return parseFloat(cfg.gstPct ?? FALLBACK_GST_PCT);
  } catch (err) {
    console.warn('[tax.service] getGstPct fell back:', err.message);
    return FALLBACK_GST_PCT;
  }
}

async function gstOn(amount) {
  const pct = await getGstPct();
  return _round2((parseFloat(amount) || 0) * pct / 100);
}

async function withTax(base) {
  const b = _round2(base);
  const gst = await gstOn(b);
  return { base: b, gst, total: _round2(b + gst) };
}

async function getTcsConfig() {
  try {
    const cfg = await paymentConfigSvc.getConfig();
    return {
      pct:        parseFloat(cfg.tcsPct ?? FALLBACK_TCS_PCT),
      active:     !!cfg.tcsActive,
      activeFrom: cfg.tcsActiveFromDate || null,
    };
  } catch {
    return { pct: FALLBACK_TCS_PCT, active: false, activeFrom: null };
  }
}

/**
 * Compute TCS to deduct from a brand's settlement portion under
 * Sec 52 CGST (default 1%). Returns 0 if TCS is not active OR the
 * effective date hasn't been reached.
 *
 * Per the founder + spec: TCS is deducted from the BRAND'S PORTION
 * (the seller's settlement), not the customer's payment.
 */
async function tcsOn(brandPortion, asOf = new Date()) {
  const { pct, active, activeFrom } = await getTcsConfig();
  if (!active) return 0;
  if (activeFrom && new Date(asOf) < new Date(activeFrom)) return 0;
  return _round2((parseFloat(brandPortion) || 0) * pct / 100);
}

async function getInvoiceIdentity() {
  try {
    const cfg = await paymentConfigSvc.getConfig();
    return {
      gstin:        cfg.platformGstin || null,
      businessName: cfg.platformBusinessName || null,
      address:      cfg.platformBusinessAddress || null,
      stateCode:    cfg.platformStateCode || null,
      prefixSub:    cfg.invoicePrefixSubscription || 'INF-SUB',
      prefixCom:    cfg.invoicePrefixCommerce || 'INF-COM',
    };
  } catch {
    return {
      gstin: null, businessName: null, address: null, stateCode: null,
      prefixSub: 'INF-SUB', prefixCom: 'INF-COM',
    };
  }
}

async function getTrancheReleaseTimeIst() {
  try {
    const cfg = await paymentConfigSvc.getConfig();
    return cfg.tranche3ReleaseTimeIst || FALLBACK_T3_TIME;
  } catch {
    return FALLBACK_T3_TIME;
  }
}

async function getTrancheReleaseAfterDays() {
  try {
    const cfg = await paymentConfigSvc.getConfig();
    return parseInt(cfg.tranche3ReleaseAfterDays ?? FALLBACK_T3_DAYS, 10);
  } catch {
    return FALLBACK_T3_DAYS;
  }
}

module.exports = {
  gstOn,
  withTax,
  getGstPct,
  getTcsConfig,
  tcsOn,
  getInvoiceIdentity,
  getTrancheReleaseTimeIst,
  getTrancheReleaseAfterDays,
  FALLBACK_GST_PCT,
  FALLBACK_TCS_PCT,
  FALLBACK_T3_DAYS,
  FALLBACK_T3_TIME,
};
