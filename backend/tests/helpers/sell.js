'use strict';

/**
 * creator-terms-v2 — test fixtures that invite a Pay for Sale / Hybrid creator.
 *
 * The item 5 send now takes what a creator can sell as offers + products without offers (rules §2);
 * the old { scope: 'store' } is refused. Suites whose subject is something else (negotiation,
 * agreement, shoots, pitches…) only need an invitation that sends, so their "whole store" fixture
 * becomes its closest new equivalent: ALL products without offers — with one published product
 * made for the brand if it has none. The assertions of those suites are unchanged.
 */

const { query } = require('./db');

async function ensureFreeProduct(brandId) {
  const { rows } = await query(
    `SELECT id FROM brand_products bp WHERE bp.brand_id = $1 AND bp.is_active AND bp.pushed_to_store
       AND NOT EXISTS (SELECT 1 FROM offer_pool_items i WHERE i.product_id = bp.id AND i.removed_at IS NULL) LIMIT 1`, [brandId]);
  if (rows[0]) return rows[0].id;
  const { rows: [p] } = await query(
    `INSERT INTO brand_products (brand_id, name, price, is_active, pushed_to_store) VALUES ($1, 'Test kurta', 1299, true, true) RETURNING id`, [brandId]);
  return p.id;
}

/**
 * Old-style selling terms → new ones. Anything already in the new shape passes through.
 *
 * Item 21 (rules v1.34 §7A): a Pay for Content invitation now carries what she POSTS ABOUT and the
 * number of shoppable posts, the same way — so a content fixture that names neither becomes its
 * closest new equivalent: ONE shoppable post, on all products without offers. Suites whose subject
 * is the content package itself get that first post made and approved by `markShootDone`
 * (helpers/item12), because the package waits for it (D4). A fixture that says `shoppablePosts: null`
 * is left alone (it is proving the refusal).
 */
async function sellable(brandId, terms) {
  if (!terms) return terms;
  const content = terms.fee !== undefined && terms.commissionPct === undefined && terms.commission_pct === undefined && terms.deliverables !== undefined;
  if (content) {
    if (terms.offers !== undefined || terms.productsWithoutOffers !== undefined || terms.shoppablePosts === null) return terms;
    await ensureFreeProduct(brandId);
    return { ...terms, shoppablePosts: terms.shoppablePosts === undefined ? 1 : terms.shoppablePosts, productsWithoutOffers: { mode: 'all' } };
  }
  if (terms.commissionPct === undefined && terms.commission_pct === undefined) return terms;
  if (terms.offers !== undefined || terms.productsWithoutOffers !== undefined) return terms;
  const { scope, alloc_scope, categoryNodeId, category, productIds, offer, ...rest } = terms;
  await ensureFreeProduct(brandId);
  return { ...rest, productsWithoutOffers: { mode: 'all' } };
}

/**
 * A product a suite creates AFTER the invitation went out, treated as listed before it: added to the
 * frozen list of this brand's new-terms collaborations that were given "all products without offers".
 * The list is frozen at sending (founder Q2), so without this a product made later is — correctly —
 * not hers. Suites about shoots use it so their products are ones she can sell; nothing is asserted
 * about the list itself.
 */
async function listedBeforeSending(brandId, productId) {
  await query(
    `UPDATE campaign_influencers ci SET sell_product_ids = array_append(ci.sell_product_ids, $2::uuid)
       FROM campaign_sets s JOIN campaigns c ON c.id = s.campaign_id
      WHERE ci.set_id = s.id AND c.brand_id = $1 AND ci.sell_v2 AND ci.sell_mode = 'all'
        AND NOT ($2::uuid = ANY(ci.sell_product_ids))`, [brandId, productId]);
}

module.exports = { sellable, ensureFreeProduct, listedBeforeSending };
