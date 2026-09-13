'use strict';

/**
 * Item 5 — the input validators every door that creates an invitation shares: allocation
 * (what she may sell), a library or inline offer, promoted offers, deliverable rows, channels,
 * and the coupon generator. Moved here from campaign.controller.js unchanged so the batch
 * send (item 5) and the legacy brief (`POST …/invite`) validate through ONE set of functions.
 * Contract: features/item5-invitations · APPROVAL.md §4.2
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const {
  validateOfferConfig,
  normalizeOfferType,
  backfillDiscountSubType,
} = require('./offerConfig.validator');
const campaignChannels = require('./campaignChannels');

// Must match the deliverable_type enum — deliverables are auto-created from
// formats_json at brand-sign, so an invalid type here would otherwise surface
// as a deferred 500 at signing (contract:
// features/backend-defect-set-format-enum-validation).
const VALID_FORMAT_TYPES = ['reel', 'post', 'story', 'youtube_video', 'youtube_short'];
function assertValidFormats(formatsJson) {
  if (formatsJson == null) return;
  if (!Array.isArray(formatsJson)) {
    throw new AppError('VALIDATION_ERROR', 'formats_json must be an array', 422, 'formats_json');
  }
  for (const f of formatsJson) {
    if (!f || !VALID_FORMAT_TYPES.includes(f.type)) {
      throw new AppError('VALIDATION_ERROR', `formats_json type "${f && f.type}" is invalid — must be one of: ${VALID_FORMAT_TYPES.join(', ')}`, 422, 'formats_json');
    }
    if (f.count != null && (!Number.isInteger(Number(f.count)) || Number(f.count) < 1)) {
      throw new AppError('VALIDATION_ERROR', 'formats_json count must be an integer >= 1', 422, 'formats_json');
    }
  }
}

/** stage-2 §5.3 / ledger #69 — the sales-set mirror of formats_json (rule in services/campaignChannels). */
function assertValidChannels(goal, channels) {
  const v = campaignChannels.validateChannels(goal, channels);
  if (!v.ok) throw new AppError('VALIDATION_ERROR', v.message, 422, v.field);
}

async function generateUniqueCouponCode(prefix, firstName) {
  const base = `${prefix.toUpperCase()}_${firstName.toUpperCase().split(' ')[0]}`;
  let code = base;
  let attempt = 0;
  while (attempt < 10) {
    const { rows } = await db.query(
      `SELECT 1 FROM campaign_influencers WHERE coupon_code = $1`,
      [code]
    );
    if (!rows[0]) return code;
    attempt++;
    code = `${base}${attempt}`;
  }
  throw new AppError('INTERNAL_ERROR', 'Could not generate unique coupon code', 500);
}

// If brand_offer_id is given, snapshot that library offer onto the assignment
// (the library row is authoritative — its config wins, and a later edit to the
// library never mutates this attachment) and record provenance. allocation is
// derived from the set goal: engagement => 'promotional' (no commission/tracking);
// conversion|hybrid => 'commissioned'. Returns the effective offer to persist.
async function resolveOfferAttachment({ brandId, goal, brand_offer_id, offer_type, offer_config_json }) {
  let effType = normalizeOfferType(offer_type);
  let effConfig = backfillDiscountSubType(offer_type, offer_config_json || null);
  let brandOfferId = null;

  if (brand_offer_id) {
    const { rows } = await db.query(
      `SELECT id, offer_type, offer_config_json, status
         FROM brand_offers WHERE id = $1 AND brand_id = $2`,
      [brand_offer_id, brandId]
    );
    if (!rows[0]) throw new AppError('NOT_FOUND', 'Offer not found in your library', 404, 'brand_offer_id');
    if (rows[0].status === 'archived') throw new AppError('VALIDATION_ERROR', 'Cannot attach an archived offer', 422, 'brand_offer_id');
    brandOfferId = rows[0].id;
    effType = rows[0].offer_type;            // snapshot — library is authoritative
    effConfig = rows[0].offer_config_json;   // jsonb → JS object
  } else if (effType) {
    // collab-part1-corrections §1.1 — the inline path runs the same validator the library
    // uses. Library offers skip it deliberately: they were validated when created.
    const check = await validateOfferConfig({
      offerType: effType, offerConfig: effConfig, brandId, db,
    });
    if (!check.ok) {
      throw new AppError('VALIDATION_ERROR', check.message, 422, check.field);
    }
  }

  const allocation = effType ? (goal === 'engagement' ? 'promotional' : 'commissioned') : null;
  return { effType, effConfig, brandOfferId, allocation };
}

/**
 * collab-part4 §4.1 — validate + normalise the ALLOCATION a brand is giving a
 * creator: what they may SELL, independent of any offer.
 *
 *   store    → every published product; new ones auto-join
 *   category → that node's subtree (or a legacy section label); new ones auto-join
 *   products → a fixed list of this brand's products; nothing auto-joins
 *
 * Returns null when nothing was sent, which leaves the row on the transitional
 * legacy fallback (derive from the offer) rather than silently clearing an
 * existing allocation.
 */
const VALID_ALLOC_SCOPES = ['store', 'category', 'products'];

async function resolveAllocation({ brandId, alloc_scope, alloc_category_node_id, alloc_category, alloc_product_ids }) {
  if (alloc_scope == null || alloc_scope === '') return null;

  const scope = String(alloc_scope).trim().toLowerCase();
  if (!VALID_ALLOC_SCOPES.includes(scope)) {
    throw new AppError('VALIDATION_ERROR', `alloc_scope must be one of: ${VALID_ALLOC_SCOPES.join(', ')}`, 422, 'alloc_scope');
  }

  if (scope === 'store') {
    return { scope, node_id: null, category: null, product_ids: null };
  }

  if (scope === 'category') {
    if (!alloc_category_node_id && !alloc_category) {
      throw new AppError('VALIDATION_ERROR', 'alloc_category_node_id or alloc_category is required when alloc_scope is "category"', 422, 'alloc_category_node_id');
    }
    if (alloc_category_node_id) {
      const { rows } = await db.query(`SELECT id, name FROM category_nodes WHERE id = $1`, [alloc_category_node_id]);
      if (!rows[0]) throw new AppError('VALIDATION_ERROR', 'alloc_category_node_id is not a known category', 422, 'alloc_category_node_id');
      return { scope, node_id: rows[0].id, category: alloc_category || rows[0].name, product_ids: null };
    }
    return { scope, node_id: null, category: String(alloc_category), product_ids: null };
  }

  // products — must be a non-empty list, and every product must be this brand's
  // and published. Same rule as offers (§1.1): never allocate something no
  // customer can see.
  const ids = Array.isArray(alloc_product_ids) ? [...new Set(alloc_product_ids.filter(Boolean))] : [];
  if (ids.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'alloc_product_ids must contain at least one product when alloc_scope is "products"', 422, 'alloc_product_ids');
  }
  const { rows } = await db.query(
    `SELECT id, name, pushed_to_store FROM brand_products WHERE id = ANY($1::uuid[]) AND brand_id = $2`,
    [ids, brandId]
  );
  const owned = new Map(rows.map(r => [r.id, r]));
  const foreign = ids.find(id => !owned.has(id));
  if (foreign) {
    throw new AppError('VALIDATION_ERROR', 'one or more allocated products do not belong to your catalogue', 422, 'alloc_product_ids');
  }
  const unpublished = ids.map(id => owned.get(id)).filter(p => p.pushed_to_store === false);
  if (unpublished.length > 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      `cannot allocate products that are not published to your store: ${unpublished.map(p => p.name || p.id).join(', ')}`,
      422, 'alloc_product_ids'
    );
  }
  return { scope, node_id: null, category: null, product_ids: ids };
}

// Offer Engine: validate the engagement "promoted offers" multi-select — every id
// must belong to this brand and not be archived. Returns a de-duped uuid[] or null.
async function validatePromotedOffers(brandId, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return null;
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return null;
  const { rows } = await db.query(
    `SELECT id FROM brand_offers WHERE id = ANY($1::uuid[]) AND brand_id = $2 AND status <> 'archived'`,
    [uniq, brandId]
  );
  if (rows.length !== uniq.length) {
    throw new AppError('VALIDATION_ERROR', 'One or more selected offers are not in your library', 422, 'promoted_brand_offer_ids');
  }
  return uniq;
}

module.exports = {
  VALID_FORMAT_TYPES, assertValidFormats, assertValidChannels,
  generateUniqueCouponCode,
  resolveOfferAttachment,
  VALID_ALLOC_SCOPES, resolveAllocation,
  validatePromotedOffers,
};
