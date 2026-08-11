'use strict';

/**
 * Apply migration 148 (creator allocation scope + offer expiry) to PRODUCTION,
 * then BACKFILL the allocation for every existing collaboration.
 * Contract: features/collab-part4-offers-allocation (§4.1, workflow W6)
 *
 * The backfill is here rather than in SQL on purpose: deriving each row's scope
 * means collecting product ids out of five different offer_config_json shapes
 * (products / d_prods / v_prods / bnd_prods / bogo buy+get / free-gift pairs).
 * That logic already exists as offerConfig.validator.collectProductIds, and a
 * second copy in SQL is exactly the drift Part 1 had to clean up for the offer
 * vocabulary.
 *
 * W6 is asserted, not assumed: the product set every collaboration resolves to
 * is captured BEFORE the change and compared AFTER, per row, using the real
 * resolver from the application. A single mismatch fails the script — a
 * mis-migrated scope would silently widen or narrow a live creator's storefront,
 * which is the worst outcome available here.
 *
 * Env must be loaded before requiring the app, so config/db points at prod.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('supabase')) {
  console.error('ABORT: not prod (.env.prod-backup).');
  process.exit(1);
}
console.log(`Target: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);

const fs = require('fs');
const db = require('../src/config/db');
const followerService = require('../src/services/follower.service');
const { collectProductIds, normalizeOfferType } = require('../src/services/offerConfig.validator');

const setEq = (a, b) => {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  return b.every(x => sa.has(x));
};

/** Derive the allocation a legacy row implies from its offer config. */
function deriveAlloc(offerType, cfgRaw) {
  const cfg = cfgRaw && typeof cfgRaw === 'object' ? cfgRaw : {};
  const declared = String(cfg.scope || '').toLowerCase();

  // Same inference the resolver and the offer validator already use: an explicit
  // scope wins; otherwise a non-empty product list means 'products', else 'store'.
  const ids = collectProductIds(normalizeOfferType(offerType) || '', cfg);
  const scope = declared || (ids.length > 0 ? 'products' : 'store');

  if (scope === 'category') {
    return {
      scope: 'category',
      category_node_id: cfg.category_node_id || null,
      category: cfg.category || null,
      product_ids: null,
    };
  }
  if (scope === 'products') {
    return { scope: 'products', category_node_id: null, category: null, product_ids: ids };
  }
  return { scope: 'store', category_node_id: null, category: null, product_ids: null };
}

(async () => {
  // ── 1. BEFORE: capture what every collaboration currently resolves to ──────
  // Read without the alloc_* columns — they may not exist yet.
  const { rows: before } = await db.query(
    `SELECT ci.id, ci.offer_type, ci.offer_config_json, c.brand_id,
            co.products_json
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c      ON c.id  = cs.campaign_id
       LEFT JOIN campaign_offers co ON co.set_id = cs.id AND co.is_active = true
      ORDER BY ci.id`
  );
  console.log(`Collaborations to check: ${before.length}`);

  const baseline = new Map();
  for (const r of before) {
    // alloc omitted → the resolver's legacy path, i.e. today's behaviour.
    const ids = await followerService.resolveAllocatedProductIds({
      ciCfg: r.offer_config_json || {}, offerProductsJson: r.products_json, brandId: r.brand_id,
    });
    baseline.set(r.id, ids);
  }

  // ── 2. DDL ────────────────────────────────────────────────────────────────
  await db.query(fs.readFileSync(path.join(__dirname, '../migrations', '148_creator_allocation_scope.sql'), 'utf8'));
  console.log('Migration 148 applied (additive DDL).');

  // ── 3. Backfill ───────────────────────────────────────────────────────────
  let filled = 0;
  const byScope = {};
  for (const r of before) {
    if (!r.offer_type && !r.offer_config_json) continue;   // nothing to derive from
    const a = deriveAlloc(r.offer_type, r.offer_config_json);
    await db.query(
      `UPDATE campaign_influencers
          SET alloc_scope = $2, alloc_category_node_id = $3,
              alloc_category = $4, alloc_product_ids = $5::jsonb
        WHERE id = $1 AND alloc_scope IS NULL`,
      [r.id, a.scope, a.category_node_id, a.category,
       a.product_ids ? JSON.stringify(a.product_ids) : null]
    );
    byScope[a.scope] = (byScope[a.scope] || 0) + 1;
    filled++;
  }
  console.log(`Backfilled ${filled} row(s):`, byScope);

  // ── 4. AFTER: assert nothing moved ────────────────────────────────────────
  const { rows: after } = await db.query(
    `SELECT ci.id, ci.offer_type, ci.offer_config_json, c.brand_id, co.products_json,
            ci.alloc_scope, ci.alloc_category_node_id, ci.alloc_category, ci.alloc_product_ids
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c      ON c.id  = cs.campaign_id
       LEFT JOIN campaign_offers co ON co.set_id = cs.id AND co.is_active = true
      ORDER BY ci.id`
  );

  const mismatches = [];
  for (const r of after) {
    const now = await followerService.resolveAllocatedProductIds({
      alloc: followerService.allocFromRow(r),
      ciCfg: r.offer_config_json || {}, offerProductsJson: r.products_json, brandId: r.brand_id,
    });
    const was = baseline.get(r.id) || [];
    if (!setEq(was, now)) {
      mismatches.push({ id: r.id, scope: r.alloc_scope, before: was.length, after: now.length });
    }
  }

  if (mismatches.length) {
    console.error(`FAILED — ${mismatches.length} collaboration(s) resolve to a DIFFERENT product set:`);
    console.error(mismatches);
    console.error('Migration DDL is additive and already applied; the alloc_* values need review.');
    await db.close?.();
    process.exit(1);
  }

  console.log(`OK — all ${after.length} collaborations resolve to the same product set as before.`);

  const { rows: remaining } = await db.query(
    `SELECT count(*)::int AS n FROM campaign_influencers
      WHERE alloc_scope IS NULL AND offer_type IS NOT NULL`
  );
  console.log(`Rows still on the transitional legacy fallback: ${remaining[0].n} (target 0).`);

  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
