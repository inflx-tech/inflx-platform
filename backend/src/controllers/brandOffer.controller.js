'use strict';

/**
 * brandOffer.controller.js — Offer Engine Sub-contract A.
 *
 * Brand-side CRUD over the reusable offer library (brand_offers, migration 084).
 * Auth: authenticated brand user; every query is scoped to the caller's brand_id.
 *
 * Routes (mounted under /brands/me in brandOffer.routes.js):
 *   GET    /brands/me/offers           — list this brand's offers (+ filters)
 *   POST   /brands/me/offers           — create an offer
 *   GET    /brands/me/offers/:id       — fetch one (404 if not this brand)
 *   PATCH  /brands/me/offers/:id       — update name/config/modes/status
 *   DELETE /brands/me/offers/:id       — soft-archive (status='archived')
 *
 * The offer_config_json shape is validated by offerConfig.validator.js — the
 * single shared validator. Distribution (publish-to-store, per-influencer
 * campaign attach) is Sub-contracts C/D; this contract only owns the library.
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const {
  validateOfferConfig,
  validateAvailingModes,
} = require('../services/offerConfig.validator');
const bulkActions = require('../services/listingBulkActions.service');

const RETURNING = `id, brand_id, name, offer_type, offer_config_json,
  availing_modes, status, published_to_store, store_starts_at, store_ends_at,
  created_at, updated_at`;

async function getBrandIdByUserId(userId) {
  const { rows } = await db.query(`SELECT id FROM brands WHERE user_id = $1`, [userId]);
  return rows[0]?.id || null;
}

// ── GET /brands/me/offers ────────────────────────────────────────────────────
const listOffers = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdByUserId(req.user.sub);
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  // offer-builder-v2 (spec D14): this is the OLD builder's list, kept for old clients. Offers from
  // the new builder are listed only through ?engine=2, so they can never reach the copy path.
  const where = ['brand_id = $1', 'engine = 1'];
  const params = [brandId];
  if (req.query.status) { params.push(req.query.status); where.push(`status = $${params.length}`); }
  if (req.query.type)   { params.push(req.query.type);   where.push(`offer_type = $${params.length}`); }
  if (req.query.q)      { params.push(`%${req.query.q}%`); where.push(`name ILIKE $${params.length}`); }

  const { rows } = await db.query(
    `SELECT ${RETURNING},
            (SELECT count(*)::int FROM campaign_influencers ci
              WHERE ci.brand_offer_id = brand_offers.id
                 OR brand_offers.id = ANY(ci.promoted_brand_offer_ids)) AS attached_count
       FROM brand_offers
      WHERE ${where.join(' AND ')}
      ORDER BY created_at DESC`,
    params
  );

  // Status counts (unfiltered by status, still brand-scoped) for the tab badges.
  const { rows: countRows } = await db.query(
    `SELECT status, count(*)::int AS n FROM brand_offers WHERE brand_id = $1 AND engine = 1 GROUP BY status`,
    [brandId]
  );
  const counts = { all: 0, draft: 0, active: 0, archived: 0 };
  for (const r of countRows) { counts[r.status] = r.n; counts.all += r.n; }

  return success(res, { offers: rows, counts });
});

// ── POST /brands/me/offers ───────────────────────────────────────────────────
// Body: { name, offer_type, offer_config_json, availing_modes?,
//         store_starts_at?, store_ends_at? }
//
// stage-2-offers-parity — the two dates used to be PATCH-only, so a brand could not give
// an offer a validity window while creating it; they had to save it and then edit it. The
// columns, and the checkout rule that refuses an offer outside them, both predate this.
const createOffer = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdByUserId(req.user.sub);
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const { name, offer_type, offer_config_json, availing_modes,
          store_starts_at, store_ends_at } = req.body || {};

  if (!name || !String(name).trim()) {
    throw new AppError('VALIDATION_ERROR', 'name is required', 422, 'name');
  }

  const modeCheck = validateAvailingModes(availing_modes);
  if (!modeCheck.ok) throw new AppError('VALIDATION_ERROR', modeCheck.message, 422, modeCheck.field);

  const check = await validateOfferConfig({ offerType: offer_type, offerConfig: offer_config_json, brandId, db });
  if (!check.ok) throw new AppError('VALIDATION_ERROR', check.message, 422, check.field);

  // Only include availing_modes when provided — otherwise omit the column so the
  // NOT NULL DEFAULT ('{pay_at_store,online_order}') applies (explicit NULL would
  // violate the constraint).
  const cols = ['brand_id', 'name', 'offer_type', 'offer_config_json'];
  const vals = [brandId, String(name).trim(), offer_type, JSON.stringify(offer_config_json)];
  if (availing_modes && availing_modes.length) {
    cols.push('availing_modes'); vals.push(availing_modes);
  }

  // The window. Either end may be omitted, and omitted means no limit — the same meaning
  // NULL already carries in the column and at checkout. An end before the start is a typo
  // rather than a policy, so it is refused here rather than stored and puzzled over later.
  if (store_starts_at && store_ends_at && new Date(store_ends_at) < new Date(store_starts_at)) {
    throw new AppError('VALIDATION_ERROR',
      'The offer ends before it starts.', 422, 'store_ends_at');
  }
  if (store_starts_at) { cols.push('store_starts_at'); vals.push(store_starts_at); }
  if (store_ends_at)   { cols.push('store_ends_at');   vals.push(store_ends_at); }
  const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');

  const { rows } = await db.query(
    `INSERT INTO brand_offers (${cols.join(', ')})
     VALUES (${placeholders})
     RETURNING ${RETURNING}`,
    vals
  );
  return success(res, { offer: rows[0] }, 201);
});

// ── GET /brands/me/offers/:id ────────────────────────────────────────────────
const getOffer = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdByUserId(req.user.sub);
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const { rows } = await db.query(
    `SELECT ${RETURNING} FROM brand_offers WHERE id = $1 AND brand_id = $2`,
    [req.params.id, brandId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Offer not found', 404);
  return success(res, { offer: rows[0] });
});

// ── GET /brands/me/offers/:id/attachments ────────────────────────────────────
// Where this offer is used: each influencer it's attached to + the campaign.
// Covers BOTH attach styles — conversion single (brand_offer_id) and engagement
// promoted (promoted_brand_offer_ids array).
const getOfferAttachments = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdByUserId(req.user.sub);
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const { rows: own } = await db.query(
    `SELECT id FROM brand_offers WHERE id = $1 AND brand_id = $2`,
    [req.params.id, brandId]
  );
  if (!own[0]) throw new AppError('NOT_FOUND', 'Offer not found', 404);

  const { rows } = await db.query(
    `SELECT ci.id AS campaign_influencer_id, ci.status, ci.allocation,
            i.instagram_handle, u.name AS influencer_name,
            c.id AS campaign_id, c.name AS campaign_name, c.status AS campaign_status,
            cs.name AS set_name, cs.goal
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c      ON c.id  = cs.campaign_id
       JOIN influencers i    ON i.id  = ci.influencer_id
       JOIN users u          ON u.id  = i.user_id
      WHERE c.brand_id = $2
        AND (ci.brand_offer_id = $1 OR $1 = ANY(ci.promoted_brand_offer_ids))
      ORDER BY c.created_at DESC, u.name`,
    [req.params.id, brandId]
  );
  return success(res, { attachments: rows });
});

// ── POST /brands/me/offers/:id/products ──────────────────────────────────────
// Contract: listing-bulk-move-and-offer. Add N products to an offer's scope,
// driven from the Inventory bulk bar ("these 12 products, put them on the
// Monsoon Sale") rather than from inside the offer builder.
//
// Offers have no product join table — scope lives in offer_config_json.products,
// which only discount/volume offers resolve through (see offer.service.js
// resolveScope/filterItemsByScope). listingBulkActions.offerAcceptsProducts()
// owns that rule and explains every refusal; the merged config then goes through
// the SAME shared validator as create/update, so this path can't write a config
// the offer builder would reject.
const attachOfferProducts = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdByUserId(req.user.sub);
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const ids = Array.isArray(req.body?.product_ids) ? req.body.product_ids.filter(Boolean) : [];
  if (!ids.length) throw new AppError('VALIDATION_ERROR', 'Select at least one product', 422, 'product_ids');

  const { rows: orows } = await db.query(
    `SELECT id, offer_type, offer_config_json FROM brand_offers WHERE id = $1 AND brand_id = $2`,
    [req.params.id, brandId]
  );
  const offer = orows[0];
  if (!offer) throw new AppError('NOT_FOUND', 'Offer not found', 404);

  const verdict = bulkActions.offerAcceptsProducts(offer);
  if (!verdict.ok) throw new AppError('VALIDATION_ERROR', verdict.reason, 422, 'offer_id');

  // Brand-scoped: another brand's product id never comes back, so it can never
  // be attached. Ids that vanish are reported, not silently dropped.
  const { rows: products } = await db.query(
    `SELECT id, name, price FROM brand_products WHERE brand_id = $1 AND id = ANY($2::uuid[])`,
    [brandId, ids]
  );
  const found = new Map(products.map((p) => [p.id, p]));
  const skipped = ids
    .filter((id) => !found.has(id))
    .map((id) => ({ id, name: null, reason: 'Product not found in your listing.' }));

  const { config, added, already } = bulkActions.mergeOfferProducts(
    offer.offer_config_json, ids.map((id) => found.get(id)).filter(Boolean)
  );

  const check = await validateOfferConfig({
    offerType: offer.offer_type, offerConfig: config, brandId, db,
  });
  if (!check.ok) {
    throw new AppError('VALIDATION_ERROR', check.error?.message || 'Offer config invalid after attach', 422,
      check.error?.field || 'offer_config_json');
  }

  const { rows } = await db.query(
    `UPDATE brand_offers SET offer_config_json = $1::jsonb, updated_at = now()
      WHERE id = $2 AND brand_id = $3 RETURNING ${RETURNING}`,
    [JSON.stringify(config), offer.id, brandId]
  );

  return success(res, {
    offer: rows[0],
    attached_count: added.length,
    attached: added,
    already_attached: already,
    skipped,
  });
});

// ── PATCH /brands/me/offers/:id ──────────────────────────────────────────────
// Body: partial { name?, offer_config_json?, availing_modes?, status? }
// offer_type is immutable here — to change the mechanic, create a new offer.
const updateOffer = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdByUserId(req.user.sub);
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const { rows: existingRows } = await db.query(
    `SELECT offer_type FROM brand_offers WHERE id = $1 AND brand_id = $2`,
    [req.params.id, brandId]
  );
  if (!existingRows[0]) throw new AppError('NOT_FOUND', 'Offer not found', 404);
  const offerType = existingRows[0].offer_type;

  const sets = [];
  const params = [];
  const body = req.body || {};

  if (body.name !== undefined) {
    if (!String(body.name).trim()) throw new AppError('VALIDATION_ERROR', 'name cannot be empty', 422, 'name');
    params.push(String(body.name).trim()); sets.push(`name = $${params.length}`);
  }

  if (body.offer_config_json !== undefined) {
    const check = await validateOfferConfig({ offerType, offerConfig: body.offer_config_json, brandId, db });
    if (!check.ok) throw new AppError('VALIDATION_ERROR', check.message, 422, check.field);
    params.push(JSON.stringify(body.offer_config_json)); sets.push(`offer_config_json = $${params.length}`);
  }

  if (body.availing_modes !== undefined) {
    const modeCheck = validateAvailingModes(body.availing_modes);
    if (!modeCheck.ok) throw new AppError('VALIDATION_ERROR', modeCheck.message, 422, modeCheck.field);
    params.push(body.availing_modes); sets.push(`availing_modes = $${params.length}`);
  }

  if (body.status !== undefined) {
    if (!['draft', 'active', 'archived'].includes(body.status)) {
      throw new AppError('VALIDATION_ERROR', 'status must be draft, active, or archived', 422, 'status');
    }
    params.push(body.status); sets.push(`status = $${params.length}`);
  }

  // Offer Engine (D): publish-to-store distribution. Consumed by
  // resolveBusinessStore (surfacing) + the store-direct purchase path (D2).
  if (body.published_to_store !== undefined) {
    params.push(!!body.published_to_store); sets.push(`published_to_store = $${params.length}`);
  }
  if (body.store_starts_at !== undefined) {
    params.push(body.store_starts_at || null); sets.push(`store_starts_at = $${params.length}`);
  }
  if (body.store_ends_at !== undefined) {
    params.push(body.store_ends_at || null); sets.push(`store_ends_at = $${params.length}`);
  }

  if (sets.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'No updatable fields provided', 422);
  }
  sets.push(`updated_at = now()`);

  params.push(req.params.id, brandId);
  const { rows } = await db.query(
    `UPDATE brand_offers SET ${sets.join(', ')}
      WHERE id = $${params.length - 1} AND brand_id = $${params.length}
      RETURNING ${RETURNING}`,
    params
  );
  return success(res, { offer: rows[0] });
});

// ── DELETE /brands/me/offers/:id ─────────────────────────────────────────────
// Soft-archive (never hard-deleted while it may be referenced by a snapshot).
const archiveOffer = asyncHandler(async (req, res) => {
  const brandId = await getBrandIdByUserId(req.user.sub);
  if (!brandId) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const { rows } = await db.query(
    `UPDATE brand_offers SET status = 'archived', updated_at = now()
      WHERE id = $1 AND brand_id = $2
      RETURNING ${RETURNING}`,
    [req.params.id, brandId]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Offer not found', 404);
  return success(res, { offer: rows[0] });
});

module.exports = {
  listOffers,
  createOffer,
  getOffer,
  getOfferAttachments,
  attachOfferProducts,
  updateOffer,
  archiveOffer,
};
