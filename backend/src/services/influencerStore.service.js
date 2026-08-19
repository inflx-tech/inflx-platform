'use strict';

/**
 * influencerStore.service.js — the influencer storefront stocking layer
 * (contract: influencer-store-foundation).
 *
 * The contract matrix is enforced HERE, at stock time: an influencer may only
 * shelve a product whose brand they hold an active contract with. "Active
 * contract with brand B" is DERIVED (there is no influencer_brand_contracts
 * table) as: a campaign_influencers row with status contracted/active/completed
 * on any of brand B's campaigns. This is the same gate the transaction path uses.
 *
 * Also exposes `resolveStoreContext` — used later by the attribution wiring to
 * confirm a purchase genuinely happened inside a creator's store (product is
 * stocked + influencer still contracted), so store-context can't be hijacked.
 */

const db = require('../config/db');

// Brands an influencer holds an active contract with (DISTINCT, derived from CIs).
async function getContractedBrandIds(influencerId, client = db) {
  const { rows } = await client.query(
    `SELECT DISTINCT c.brand_id
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c      ON c.id  = cs.campaign_id
      WHERE ci.influencer_id = $1
        AND ci.status IN ('contracted','active','completed')`,
    [influencerId]
  );
  return rows.map(r => r.brand_id);
}

// Is (influencer, brand) under an active contract? (the stock-time gate)
async function isContractedWithBrand(influencerId, brandId, client = db) {
  const { rows } = await client.query(
    `SELECT 1
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c      ON c.id  = cs.campaign_id
      WHERE ci.influencer_id = $1
        AND c.brand_id      = $2
        AND ci.status IN ('contracted','active','completed')
      LIMIT 1`,
    [influencerId, brandId]
  );
  return rows.length > 0;
}

// Shelve a product. Throws { code, message } on a contract-gate violation.
async function stockProduct(influencerId, productId, note, client = db) {
  const { rows: prodRows } = await client.query(
    `SELECT id, brand_id FROM brand_products WHERE id = $1 AND is_active = true`,
    [productId]
  );
  const product = prodRows[0];
  if (!product) return { ok: false, code: 'NOT_FOUND', message: 'Product not found or inactive' };

  const contracted = await isContractedWithBrand(influencerId, product.brand_id, client);
  if (!contracted) {
    return { ok: false, code: 'FORBIDDEN', message: 'You can only stock products from brands you are contracted with' };
  }

  const { rows } = await client.query(
    `INSERT INTO influencer_store_inventory (influencer_id, brand_id, product_id, note, status)
       VALUES ($1, $2, $3, $4, 'active')
     ON CONFLICT (influencer_id, product_id)
       DO UPDATE SET status = 'active', note = COALESCE(EXCLUDED.note, influencer_store_inventory.note), updated_at = now()
     RETURNING id, influencer_id, brand_id, product_id, note, status, created_at, updated_at`,
    [influencerId, product.brand_id, productId, note || null]
  );
  return { ok: true, item: rows[0] };
}

// Remove (archive) a stocked product the influencer owns.
async function unstockProduct(influencerId, itemId, client = db) {
  const { rows } = await client.query(
    `UPDATE influencer_store_inventory
        SET status = 'archived', updated_at = now()
      WHERE id = $1 AND influencer_id = $2
      RETURNING id`,
    [itemId, influencerId]
  );
  return { ok: rows.length > 0 };
}

// An influencer's stocked store (active items + product/brand detail).
async function listStore(influencerId, client = db) {
  const { rows } = await client.query(
    `SELECT isi.id, isi.note, isi.created_at,
            bp.id AS product_id, bp.name AS product_name, bp.price, bp.image_url, bp.section,
            b.id AS brand_id, b.business_name AS brand_name, b.category AS brand_category
       FROM influencer_store_inventory isi
       JOIN brand_products bp ON bp.id = isi.product_id
       JOIN brands b          ON b.id  = isi.brand_id
      WHERE isi.influencer_id = $1 AND isi.status = 'active' AND bp.is_active = true
      ORDER BY isi.created_at DESC`,
    [influencerId]
  );
  return rows;
}

// Products the influencer is ALLOWED to stock (active products of contracted
// brands), flagged with whether each is already stocked — powers the stocking UI.
async function listStockable(influencerId, client = db) {
  const { rows } = await client.query(
    // collab-phase1 — carries the product's own kind so her shelf can be grouped.
    `SELECT bp.id AS product_id, bp.name AS product_name, bp.price, bp.image_url, bp.section,
            bp.category_key, bp.super_category, bp.category_node_id,
            b.id AS brand_id, b.business_name AS brand_name, b.category AS brand_category,
            EXISTS (
              SELECT 1 FROM influencer_store_inventory isi
               WHERE isi.influencer_id = $1 AND isi.product_id = bp.id AND isi.status = 'active'
            ) AS stocked
       FROM brand_products bp
       JOIN brands b ON b.id = bp.brand_id
      WHERE bp.is_active = true
        AND b.id IN (
          SELECT DISTINCT c.brand_id
            FROM campaign_influencers ci
            JOIN campaign_sets cs ON cs.id = ci.set_id
            JOIN campaigns c      ON c.id  = cs.campaign_id
           WHERE ci.influencer_id = $1
             AND ci.status IN ('contracted','active','completed')
        )
      ORDER BY b.business_name, bp.name`,
    [influencerId]
  );
  return rows;
}

/**
 * resolveStoreContext — confirm a purchase genuinely happened inside an
 * influencer's store (anti-hijack): the product must be ACTIVELY stocked by
 * that influencer AND the influencer must still be contracted with the
 * product's brand. Returns the influencer_id when valid, else null.
 * Used by the attribution wiring (store beats window). DORMANT until wired.
 */
async function resolveStoreContext({ influencerId, productId, brandId }, client = db) {
  if (!influencerId || !productId) return null;
  const { rows } = await client.query(
    `SELECT 1
       FROM influencer_store_inventory isi
      WHERE isi.influencer_id = $1 AND isi.product_id = $2 AND isi.status = 'active'`,
    [influencerId, productId]
  );
  if (!rows.length) return null;
  // brandId optional — when provided, double-check the contract still holds.
  if (brandId && !(await isContractedWithBrand(influencerId, brandId, client))) return null;
  return influencerId;
}

module.exports = {
  getContractedBrandIds,
  isContractedWithBrand,
  stockProduct,
  unstockProduct,
  listStore,
  listStockable,
  resolveStoreContext,
};
