'use strict';

/**
 * Item 5 — the terms a brand agrees creator by creator, validated per Aim with the exact §7
 * messages. One function, used by every door that creates an invitation (rules v1.16 §7A:
 * "These rules apply to every door", APPROVAL.md Q6).
 * Contract: features/item5-invitations
 *
 *   Pay for Sale (conversion)   commission (required, 0 < x ≤ 100, one decimal), selling scope,
 *                               optional follower offer, the shoppable-post minimum (read-only)
 *   Pay for Content (engagement) fee (whole rupees > 0), deliverables (≥ 1 row, 1–20, no repeat
 *                               type), optional note, optional usage rights
 *   Hybrid                      fixed fee (> 0) plus everything for Pay for Sale; no content package
 *
 * `mode`:
 *   'strict'  — the item 5 send: everything the Aim requires must be present.
 *   'legacy'  — the legacy brief door (`POST …/invite`): whatever IS present is held to the same
 *               rules, but a missing commission, fee or deliverables list is not refused, because
 *               the brief screen and fourteen legacy suites never supplied them. Founder Q6 asked
 *               to be told before the brief is made to fail; see the item 5 summary.
 */

const AppError = require('../utils/AppError');
const { MSG, DELIVERABLE_TYPES, USAGE_PLACES, USAGE_DURATIONS } = require('./invitationCopy');

const SELLING = ['conversion', 'hybrid'];
const TYPE_CODES = DELIVERABLE_TYPES.map(t => t.code);
const PLACE_CODES = USAGE_PLACES.map(p => p.code);

const fail = (message, field) => { throw new AppError('VALIDATION_ERROR', message, 422, field); };
const has = (v) => v !== undefined && v !== null && v !== '';
const num = (v) => (has(v) && Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * Accepts the app's camelCase terms or the API's snake_case row fields and returns one shape.
 * Unknown keys are dropped.
 */
function normalizeTerms(raw = {}) {
  const t = raw || {};
  const pick = (...keys) => { for (const k of keys) if (t[k] !== undefined) return t[k]; return undefined; };
  const offerIn = t.offer !== undefined ? t.offer : null;
  let offer = null;
  if (offerIn && typeof offerIn === 'object') {
    offer = {
      brandOfferId: offerIn.brandOfferId || offerIn.brand_offer_id || null,
      offerType: offerIn.offerType || offerIn.offer_type || null,
      offerConfigJson: offerIn.offerConfigJson || offerIn.offer_config_json || null,
      name: offerIn.name || null,
      saveToLibrary: !!(offerIn.saveToLibrary || offerIn.save_to_library),
    };
  } else if (offerIn === null && (t.brand_offer_id || t.offer_type)) {
    offer = { brandOfferId: t.brand_offer_id || null, offerType: t.offer_type || null, offerConfigJson: t.offer_config_json || null, name: null, saveToLibrary: false };
  }
  const usage = pick('usageRights', 'usage_rights_json');
  return {
    commissionPct: pick('commissionPct', 'commission_pct'),
    fee: pick('fee', 'agreed_fee'),
    scope: pick('scope', 'alloc_scope'),
    categoryNodeId: pick('categoryNodeId', 'alloc_category_node_id'),
    category: pick('category', 'alloc_category'),
    productIds: pick('productIds', 'alloc_product_ids'),
    deliverables: pick('deliverables', 'formats_json'),
    note: pick('note', 'brand_note'),
    usageRights: usage === undefined ? undefined : (usage && typeof usage === 'object'
      ? { on: !!usage.on, durationDays: usage.durationDays !== undefined ? usage.durationDays : (usage.duration_days !== undefined ? usage.duration_days : null), places: usage.places || [] }
      : null),
    offer,
    offerValidFrom: pick('offerValidFrom', 'offer_valid_from'),
    offerValidUntil: pick('offerValidUntil', 'offer_valid_until'),
  };
}

/** One decimal, the way the rule says it ("to one decimal place"). */
const oneDecimal = (x) => Math.round(Number(x) * 10) / 10;

/**
 * @param {string} goal   the set's Aim: conversion | engagement | hybrid
 * @param {object} raw    terms in either spelling
 * @param {object} [opts] { mode: 'strict' | 'legacy' }
 * @returns the normalised terms to store (camelCase), never mutating the input
 */
function validateTerms(goal, raw, { mode = 'strict' } = {}) {
  const strict = mode !== 'legacy';
  const t = normalizeTerms(raw);
  const selling = SELLING.includes(goal);
  const out = {
    commissionPct: null, fee: null,
    scope: null, categoryNodeId: null, category: null, productIds: null,
    deliverables: null, note: null, usageRights: null,
    offer: null, offerValidFrom: null, offerValidUntil: null,
  };

  // ── Money ────────────────────────────────────────────────────────────────
  if (selling) {
    const c = num(t.commissionPct);
    if (!has(t.commissionPct)) { if (strict) fail(MSG.COMMISSION_REQUIRED, 'commission_pct'); }
    else if (c == null) fail(MSG.COMMISSION_REQUIRED, 'commission_pct');
    else if (c <= 0 || c > 100) fail(MSG.COMMISSION_RANGE, 'commission_pct');
    else out.commissionPct = oneDecimal(c);
  }
  if (goal === 'engagement') {
    const f = num(t.fee);
    if (!has(t.fee)) { if (strict) fail(MSG.FEE_REQUIRED, 'agreed_fee'); }
    else if (f == null || f <= 0 || !Number.isInteger(f)) fail(MSG.FEE_REQUIRED, 'agreed_fee');
    else out.fee = f;
  }
  if (goal === 'hybrid') {
    const f = num(t.fee);
    if (!has(t.fee)) { if (strict) fail(MSG.HYBRID_FEE, 'agreed_fee'); }
    else if (f == null || f <= 0 || !Number.isInteger(f)) fail(MSG.HYBRID_FEE, 'agreed_fee');
    else out.fee = f;
  }

  // ── Selling scope (Pay for Sale, Hybrid) ────────────────────────────────
  if (selling) {
    const scope = has(t.scope) ? String(t.scope).trim().toLowerCase() : (strict ? 'store' : null);
    if (scope) {
      if (!['store', 'category', 'products'].includes(scope)) fail(MSG.SCOPE_CATEGORIES, 'alloc_scope');
      if (scope === 'category' && !has(t.categoryNodeId) && !has(t.category)) fail(MSG.SCOPE_CATEGORIES, 'alloc_category_node_id');
      const ids = Array.isArray(t.productIds) ? [...new Set(t.productIds.filter(Boolean))] : [];
      if (scope === 'products' && ids.length === 0) fail(MSG.SCOPE_PRODUCTS, 'alloc_product_ids');
      out.scope = scope;
      out.categoryNodeId = scope === 'category' ? (t.categoryNodeId || null) : null;
      out.category = scope === 'category' ? (t.category || null) : null;
      out.productIds = scope === 'products' ? ids : null;
    }
  }

  // ── Deliverables (Pay for Content only; Hybrid has no content package) ───
  if (goal === 'engagement') {
    const rows = t.deliverables;
    if (!has(rows) || (Array.isArray(rows) && rows.length === 0)) { if (strict) fail(MSG.DELIVERABLES_EMPTY, 'formats_json'); }
    else {
      if (!Array.isArray(rows)) fail(MSG.DELIVERABLES_EMPTY, 'formats_json');
      const seen = new Set();
      out.deliverables = rows.map((r) => {
        const type = r && r.type;
        if (!TYPE_CODES.includes(type)) fail(MSG.DELIVERABLES_EMPTY, 'formats_json');
        const count = num(r.count == null ? 1 : r.count);
        if (count == null || !Number.isInteger(count) || count < 1 || count > 20) fail(MSG.DELIVERABLE_COUNT, 'formats_json');
        if (seen.has(type)) fail(MSG.DELIVERABLE_DUP, 'formats_json');
        seen.add(type);
        return { type, count };
      });
    }
  }

  // ── Note (any Aim; the mockups show it on Pay for Content) ───────────────
  if (has(t.note)) {
    const note = String(t.note).trim();
    if (note.length > 300) fail(MSG.NOTE_LONG, 'brand_note');
    out.note = note || null;
  }

  // ── Usage rights (Pay for Content only) ──────────────────────────────────
  if (goal === 'engagement' && t.usageRights && t.usageRights.on) {
    const d = t.usageRights.durationDays == null ? null : num(t.usageRights.durationDays);
    if (!USAGE_DURATIONS.includes(d)) fail(MSG.USAGE_PLACE, 'usage_rights_json');
    const places = [...new Set((t.usageRights.places || []).filter(p => PLACE_CODES.includes(p)))];
    if (!places.length) fail(MSG.USAGE_PLACE, 'usage_rights_json');
    out.usageRights = { on: true, duration_days: d, places };
  }

  // ── Follower offer (Pay for Sale, Hybrid) — shape only; the engine validates the config ──
  if (selling && t.offer && (t.offer.brandOfferId || t.offer.offerType)) {
    out.offer = {
      brandOfferId: t.offer.brandOfferId || null,
      offerType: t.offer.brandOfferId ? null : (t.offer.offerType || null),
      offerConfigJson: t.offer.brandOfferId ? null : (t.offer.offerConfigJson || null),
      name: t.offer.name || null,
      saveToLibrary: !!t.offer.saveToLibrary,
    };
    if (has(t.offerValidFrom)) out.offerValidFrom = t.offerValidFrom;
    if (has(t.offerValidUntil)) out.offerValidUntil = t.offerValidUntil;
    if (out.offerValidFrom && out.offerValidUntil && new Date(out.offerValidUntil) < new Date(out.offerValidFrom)) fail(MSG.OFFER_DATES, 'offer_valid_until');
  }

  return out;
}

/** The engine's config errors, said in the §7 words the brand reads. */
function offerMessageFor(check) {
  const f = String(check.field || '');
  if (/value|sub_type|tiers|pct_off|min_spend|min_qty|buy_qty|free_qty/.test(f)) return MSG.OFFER_AMOUNT;
  if (/scope|category|products|product\b/.test(f)) return MSG.OFFER_SCOPE;
  return check.message;
}

module.exports = { normalizeTerms, validateTerms, offerMessageFor, SELLING };
