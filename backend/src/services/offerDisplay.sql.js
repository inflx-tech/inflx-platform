'use strict';

/**
 * offerDisplay.sql.js — the ONE definition of "what discount does this product
 * advertise?", as reusable static SQL fragments plus the mapper for a card.
 *
 * Extracted from sectionRules.service.js by collab-part4-offers-allocation (§4.3
 * display side). Nothing about the SQL changed — it moved.
 *
 * WHY IT MOVED
 * The creator storefront needs the same evaluator the discovery shelves, wishlist
 * and product cards already use, otherwise a product can be CHARGED a global
 * discount at checkout without having ADVERTISED it on the tile. But
 * follower.service cannot require sectionRules.service: that would close the cycle
 * sectionRules → sectionLibrary → follower.service, and Node would hand
 * sectionLibrary a half-initialised follower.service whose exports are still
 * undefined. Hoisting the fragments into a module with NO dependencies of its own
 * lets every consumer share one definition without the cycle.
 *
 * sectionRules.service still re-exports these names so existing importers keep
 * working unchanged.
 *
 * These are STATIC fragments with no parameter indices. They reference `bp`
 * (brand_products) and `bo` (brand_offers) in the surrounding query, so any query
 * using them must alias brand_products AS bp.
 *
 * MRP is retired everywhere, so the only struck price / "% off" a card shows comes
 * from a live PUBLISHED `discount` offer that applies to the product. Cart-shaped
 * mechanics (volume, bundle, bogo, free_gift) are deliberately excluded — a tile has
 * no cart to evaluate a threshold or a multi-product set against, and promising a
 * bundle price on a single product would be a lie. They belong on a card as an
 * availability badge, not a price.
 */

const OFFER_LIVE_GATE = `bo.brand_id = bp.brand_id AND bo.status = 'active' AND bo.published_to_store = true
      AND (bo.store_starts_at IS NULL OR bo.store_starts_at <= now())
      AND (bo.store_ends_at IS NULL OR bo.store_ends_at >= now())`;

const OFFER_EFF_SCOPE = `COALESCE(bo.offer_config_json->>'scope',
      CASE WHEN jsonb_typeof(bo.offer_config_json->'products') = 'array'
             AND jsonb_array_length(bo.offer_config_json->'products') > 0 THEN 'products' ELSE 'store' END)`;

const OFFER_APPLIES = `(
      ${OFFER_EFF_SCOPE} = 'store'
      OR (${OFFER_EFF_SCOPE} = 'category' AND (
            CASE WHEN bo.offer_config_json->>'category_node_id' IS NOT NULL
              -- Hierarchy-aware: the product's node is in the subtree of the
              -- offer's category node, at any depth.
              THEN bp.category_node_id IN (
                WITH RECURSIVE sub AS (
                  SELECT (bo.offer_config_json->>'category_node_id')::uuid AS id
                  UNION ALL
                  SELECT cn.id FROM category_nodes cn JOIN sub ON cn.parent_id = sub.id
                ) SELECT id FROM sub)
              ELSE bp.section IS NOT DISTINCT FROM bo.offer_config_json->>'category'
            END))
      OR (${OFFER_EFF_SCOPE} = 'products' AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(bo.offer_config_json->'products', '[]'::jsonb)) e
             WHERE e->>'id' = bp.id::text)))`;

const OFFER_NUM_VAL = `CASE WHEN bo.offer_config_json->>'value' ~ '^[0-9]+(\\.[0-9]+)?$'
      THEN (bo.offer_config_json->>'value')::numeric ELSE NULL END`;

const OFFER_DISC_PCT = `(CASE WHEN bo.offer_config_json->>'sub_type' = 'pct' THEN ${OFFER_NUM_VAL}
      WHEN bo.offer_config_json->>'sub_type' = 'flat' AND bp.price > 0 THEN ${OFFER_NUM_VAL} / bp.price * 100
      ELSE NULL END)`;

/** Scalar subquery: best applicable live discount % for this product's card. */
const OFFER_BEST_PCT = `(SELECT MAX(${OFFER_DISC_PCT}) FROM brand_offers bo
      WHERE ${OFFER_LIVE_GATE} AND bo.offer_type = 'discount' AND ${OFFER_APPLIES})`;

/** Map a raw offer_pct column → { discount_value, offer_price } for a card. */
function offerFieldsFromPct(rawPct, price) {
  const pct = rawPct != null ? Math.round(Number(rawPct)) : null;
  if (!(pct > 0) || price == null) return { discount_value: null, offer_price: null };
  return { discount_value: pct, offer_price: Math.round(price * (1 - pct / 100)) };
}

module.exports = {
  OFFER_LIVE_GATE,
  OFFER_EFF_SCOPE,
  OFFER_APPLIES,
  OFFER_NUM_VAL,
  OFFER_DISC_PCT,
  OFFER_BEST_PCT,
  offerFieldsFromPct,
};
