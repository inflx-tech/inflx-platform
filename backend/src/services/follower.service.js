'use strict';

/**
 * follower.service.js
 * Phase 4 — Block A (Updated for Follower App Redesign)
 *
 * resolveStore          — influencer store with notes + date gating
 * resolveBusinessStore  — brand full catalog + active offers
 * resolveCategoryStore  — category + city filtered listing
 * getFeed              — legacy feed (kept for backward compat)
 * getHomeFeed          — NEW: product-centric deduped feed
 * getDealsByCategory   — NEW: category-filtered deals
 * getFollowing         — NEW: followed influencers with deal counts
 * getInfluencerStorePreview — NEW: influencer previews their own store
 * getBrandStorePreview — NEW: brand previews their own store
 */

const db = require('../config/db');
const listingService = require('./listing.service');
const categoryTaxonomy = require('./categoryTaxonomy.service');
// collab-part4 §4.3 display side — the one product-card offer evaluator, shared with
// the discovery shelves and wishlist. Lives in its own dependency-free module so
// requiring it here cannot close the sectionRules → sectionLibrary → follower.service
// cycle.
const { OFFER_BEST_PCT, offerFieldsFromPct } = require('./offerDisplay.sql');

// ── Open/closed status helper ────────────────────────────────────────────────
// hours_json shape (per WeeklyScheduleEditor):
//   { mon: { open: "09:00", close: "20:00" } | null, tue: {...}, ..., sun: null }
// Returns null when no hours data; otherwise:
//   { is_open: boolean, status_text: string, closes_at?, opens_at? }
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function formatTimeDisplay(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return '';
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  if (isNaN(h)) return '';
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function computeOpenStatus(hoursJson, now = new Date()) {
  if (!hoursJson || typeof hoursJson !== 'object') return null;
  const todayKey = DAY_KEYS[now.getDay()];
  const today = hoursJson[todayKey];
  if (!today || !today.open || !today.close) {
    return { is_open: false, status_text: 'Closed today' };
  }
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const [oh, om = 0] = today.open.split(':').map(Number);
  const [ch, cm = 0] = today.close.split(':').map(Number);
  const openMin = oh * 60 + om;
  let closeMin = ch * 60 + cm;
  // Past-midnight close ("02:00") — treat as next-day close
  if (closeMin <= openMin) closeMin += 24 * 60;

  if (currentMin >= openMin && currentMin < closeMin) {
    return {
      is_open:    true,
      status_text:`Open · Closes ${formatTimeDisplay(today.close)}`,
      closes_at:  today.close,
    };
  }
  if (currentMin < openMin) {
    return {
      is_open:    false,
      status_text:`Closed · Opens ${formatTimeDisplay(today.open)}`,
      opens_at:   today.open,
    };
  }
  return { is_open: false, status_text: 'Closed' };
}


// Shared SQL fragment for "active campaign_influencer with offer" + DATE GATING
const ACTIVE_CI_QUERY = `
  SELECT
    ci.id                 AS campaign_influencer_id,
    ci.coupon_code,
    ci.commission_pct,
    ci.influencer_id,
    ci.offer_type         AS ci_offer_type,
    ci.offer_config_json  AS ci_offer_config,
    -- collab-part4 §4.1 — allocation is its own axis, not the offer's scope.
    ci.alloc_scope,
    ci.alloc_category_node_id,
    ci.alloc_category,
    ci.alloc_product_ids,
    ci.offer_valid_until,
    cs.id                 AS set_id,
    cs.campaign_id,
    c.brand_id,
    c.name                AS campaign_name,
    c.start_date,
    c.end_date,
    b.business_name       AS brand_name,
    b.id                  AS brand_id,
    b.category            AS brand_category,
    u_b.city              AS brand_city,
    co.id                 AS offer_id,
    COALESCE(co.offer_type::text, ci.offer_type::text) AS offer_type,
    -- collab-part1-corrections §1.2 — ci.commission_pct was the third COALESCE
    -- leg here. Commission is what the BRAND pays the creator; it is not a
    -- customer discount. A sales collab with 10% commission and no discount was
    -- advertising "10% off" that checkout never applied. No discount now means
    -- no discount is reported.
    COALESCE(co.discount_value, NULLIF(ci.offer_config_json->>'value','')::numeric) AS discount_value,
    co.availing_modes,
    co.products_json,
    co.bundle_price,
    co.volume_threshold,
    co.prebook_advance
  FROM campaign_influencers ci
  JOIN campaign_sets cs          ON cs.id = ci.set_id
  JOIN campaigns c               ON c.id  = cs.campaign_id
  JOIN brands b                  ON b.id  = c.brand_id
  JOIN users u_b                 ON u_b.id = b.user_id
  LEFT JOIN campaign_offers co   ON co.set_id = cs.id AND co.is_active = true
  WHERE ci.status IN ('contracted', 'active', 'completed')
    AND c.status  IN ('published', 'active', 'live')
    AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
    -- collab-part4 §4.2 — this used to require an OFFER to exist. That made
    -- full-price commission-only selling impossible: no offer meant no scope,
    -- which meant no products, so the creator was hidden. Now an ALLOCATION is
    -- enough. The offer_type leg stays only for legacy rows that have no
    -- allocation yet and still derive one from the offer (transitional; drop it
    -- with the resolver fallback). A creator with neither is still hidden — we do
    -- not surface empty storefronts (W8).
    AND (ci.alloc_scope IS NOT NULL OR co.id IS NOT NULL OR ci.offer_type IS NOT NULL)
`;

// Extended query that also fetches influencer details + product notes
const FEED_QUERY = `
  SELECT
    ci.id                 AS campaign_influencer_id,
    ci.coupon_code,
    ci.commission_pct,
    ci.influencer_id,
    ci.offer_type         AS ci_offer_type,
    ci.offer_config_json  AS ci_offer_config,
    -- collab-part4 §4.1 — allocation is its own axis, not the offer's scope.
    ci.alloc_scope,
    ci.alloc_category_node_id,
    ci.alloc_category,
    ci.alloc_product_ids,
    ci.offer_valid_until,
    cs.id                 AS set_id,
    cs.campaign_id,
    c.brand_id,
    c.name                AS campaign_name,
    c.start_date,
    c.end_date,
    b.business_name       AS brand_name,
    b.category            AS brand_category,
    u_b.city              AS brand_city,
    co.id                 AS offer_id,
    COALESCE(co.offer_type::text, ci.offer_type::text) AS offer_type,
    -- collab-part1-corrections §1.2 — ci.commission_pct was the third COALESCE
    -- leg here. Commission is what the BRAND pays the creator; it is not a
    -- customer discount. A sales collab with 10% commission and no discount was
    -- advertising "10% off" that checkout never applied. No discount now means
    -- no discount is reported.
    COALESCE(co.discount_value, NULLIF(ci.offer_config_json->>'value','')::numeric) AS discount_value,
    co.availing_modes,
    co.products_json,
    co.prebook_advance,
    i.instagram_handle,
    i.followers_count,
    i.engagement_rate,
    i.profile_image_url   AS profile_pic_url,
    u_i.name              AS influencer_name
  FROM campaign_influencers ci
  JOIN campaign_sets cs          ON cs.id = ci.set_id
  JOIN campaigns c               ON c.id  = cs.campaign_id
  JOIN brands b                  ON b.id  = c.brand_id
  JOIN users u_b                 ON u_b.id = b.user_id
  LEFT JOIN campaign_offers co   ON co.set_id = cs.id AND co.is_active = true
  JOIN influencers i             ON i.id = ci.influencer_id
  JOIN users u_i                 ON u_i.id = i.user_id
  WHERE ci.status IN ('contracted', 'active', 'completed')
    AND c.status  IN ('published', 'active', 'live')
    AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
    -- collab-part4 §4.2 — this used to require an OFFER to exist. That made
    -- full-price commission-only selling impossible: no offer meant no scope,
    -- which meant no products, so the creator was hidden. Now an ALLOCATION is
    -- enough. The offer_type leg stays only for legacy rows that have no
    -- allocation yet and still derive one from the offer (transitional; drop it
    -- with the resolver fallback). A creator with neither is still hidden — we do
    -- not surface empty storefronts (W8).
    AND (ci.alloc_scope IS NOT NULL OR co.id IS NOT NULL OR ci.offer_type IS NOT NULL)
`;

// Category → business linkage for the deals tab now comes from the single source
// (categoryTaxonomy.service / follower_categories). The old local CATEGORY_MAP was a
// duplicate, smaller, inconsistently-keyed copy — removed in contract 2.5a.

/**
 * Resolve influencer + active offers for GET /store/:handle
 * Now includes influencer product notes and date gating
 */
// Phase 2b — product IDs ALLOCATED to a creator by a single live offer:
// the offer-config snapshot's product arrays ∪ the campaign set's products_json.
// Covers discount/volume/bundle (products/d_prods/v_prods/bnd_prods), bogo
// (buy_product/get_product), and free_gift (offers[].main/gift).
function allocatedProductIds(ciCfg, setProductsJson) {
  const ids = new Set();
  const add = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const x of arr) {
      const id = typeof x === 'string' ? x : (x && (x.product_id || x.id));
      if (id) ids.add(id);
    }
  };
  if (ciCfg && typeof ciCfg === 'object') {
    add(ciCfg.products); add(ciCfg.d_prods); add(ciCfg.v_prods); add(ciCfg.bnd_prods);
    if (ciCfg.buy_product && ciCfg.buy_product.id) ids.add(ciCfg.buy_product.id);
    if (ciCfg.get_product && ciCfg.get_product.id) ids.add(ciCfg.get_product.id);
    if (Array.isArray(ciCfg.offers)) {
      for (const o of ciCfg.offers) {
        if (o && o.main && o.main.id) ids.add(o.main.id);
        if (o && o.gift && o.gift.id) ids.add(o.gift.id);
      }
    }
  }
  if (setProductsJson) {
    try {
      const pj = typeof setProductsJson === 'string' ? JSON.parse(setProductsJson) : setProductsJson;
      add(pj);
    } catch { /* malformed → ignore */ }
  }
  return Array.from(ids);
}

// ── Allocation: what a creator MAY SELL ──────────────────────────────────────
// collab-part4-offers-allocation §4.1.
//
// This used to read the OFFER's scope (offer_config_json.scope) to decide what a
// creator could sell. That one read was the conflation behind three faults: no
// offer meant no products (so full-price commission-only selling was impossible),
// editing an offer silently rewrote what the creator was allowed to sell, and
// "whole store allocated, one category discounted" was inexpressible because both
// meanings shared a field.
//
// Allocation now has its own scope, independent of the offer:
//   'store'    → every currently-published product. New products AUTO-JOIN
//                (founder's explicit choice).
//   'category' → the node's recursive subtree (or legacy section name). New
//                products in it auto-join.
//   'products' → a FIXED list. Nothing auto-joins.
//
// Resolved live rather than snapshotted, so unpublishing is the brand's lever: an
// unpublished product leaves the store and therefore leaves every store/category
// allocation automatically.
//
// TRANSITIONAL legacy fallback: when alloc_scope is NULL we fall back to the
// offer's scope, as before. This exists purely to survive the deploy window —
// rows written by the old code (and any created between the backfill and the
// deploy) have no allocation, and without this the 19 live collaborations would
// resolve to zero products and every creator storefront would go blank. It logs
// so the remaining volume is visible, and it should be deleted once
// alloc_scope IS NULL returns nothing. It is NOT part of the model.
/**
 * Build the allocation object from any row that selected the alloc_* columns.
 * One place, so every call site agrees on the shape.
 */
function allocFromRow(r) {
  if (!r) return null;
  return {
    scope:            r.alloc_scope || null,
    category_node_id: r.alloc_category_node_id || null,
    category:         r.alloc_category || null,
    product_ids:      Array.isArray(r.alloc_product_ids) ? r.alloc_product_ids : null,
  };
}

async function resolveAllocatedProductIds({ alloc, ciCfg, offerProductsJson, brandId }) {
  const cfg = ciCfg && typeof ciCfg === 'object' ? ciCfg : {};

  const a = alloc && typeof alloc === 'object' ? alloc : {};
  let scope  = String(a.scope || '').toLowerCase();
  let nodeId = a.category_node_id || null;
  let catLabel = a.category || null;
  let fixedIds = Array.isArray(a.product_ids) ? a.product_ids : null;

  if (!scope) {
    // Legacy row — derive from the offer exactly as the old code did.
    scope    = String(cfg.scope || '').toLowerCase();
    nodeId   = cfg.category_node_id || null;
    catLabel = cfg.category || null;
    fixedIds = null;
    if (scope) {
      console.log('[allocation] legacy fallback — alloc_scope NULL, derived from offer scope:', scope);
    }
  }

  if (scope === 'products') {
    // A fixed list. Still filtered by live listing state so an unpublished
    // product disappears here too — otherwise a product-scoped creator could
    // keep selling something the brand pulled.
    if (!fixedIds || fixedIds.length === 0) return allocatedProductIds(cfg, offerProductsJson);
    const { rows } = await db.query(
      `SELECT id FROM brand_products
        WHERE id = ANY($1::uuid[]) AND brand_id = $2
          AND is_active = true AND pushed_to_store = true`,
      [fixedIds, brandId]
    );
    return rows.map(r => r.id);
  }

  if (brandId && (scope === 'store' || (scope === 'category' && (nodeId || catLabel)))) {
    const params = [brandId];
    let sql = `SELECT id FROM brand_products
                WHERE brand_id = $1 AND is_active = true AND pushed_to_store = true`;
    if (scope === 'category') {
      if (nodeId) {
        params.push(nodeId);
        sql += ` AND category_node_id IN (
          WITH RECURSIVE sub AS (
            SELECT id FROM category_nodes WHERE id = $2
            UNION ALL
            SELECT cn.id FROM category_nodes cn JOIN sub ON cn.parent_id = sub.id
          ) SELECT id FROM sub)`;
      } else {
        params.push(catLabel);
        sql += ` AND section = $2`;
      }
    }
    const { rows } = await db.query(sql, params);
    return rows.map(r => r.id);
  }

  // No allocation and no legacy offer scope → nothing to sell. The caller must
  // not surface this creator (contract W8: no empty storefronts).
  return allocatedProductIds(cfg, offerProductsJson);
}

async function resolveStore(handle) {
  const { rows: infRows } = await db.query(
    `SELECT i.*, u.name, u.status AS user_status, u.phone
     FROM influencers i
     JOIN users u ON u.id = i.user_id
     WHERE i.instagram_handle = $1`,
    [handle]
  );
  if (!infRows[0]) return null;
  const inf = infRows[0];

  // Get active offers (date-gated)
  const { rows: offerRows } = await db.query(
    ACTIVE_CI_QUERY + ` AND ci.influencer_id = $1`,
    [inf.id]
  );

  // Get all product notes for this influencer
  const { rows: noteRows } = await db.query(
    `SELECT ipn.product_id, ipn.campaign_id, ipn.note_text
     FROM influencer_product_notes ipn
     WHERE ipn.influencer_id = $1`,
    [inf.id]
  );
  const noteMap = {};
  for (const n of noteRows) {
    noteMap[`${n.product_id}_${n.campaign_id}`] = n.note_text;
  }

  // Fetch products — prioritize published products (with notes), then fill from brand catalog
  const offersWithProducts = [];
  for (const r of offerRows) {
    // Phase 2b — show the products ALLOCATED to this creator by the live offer,
    // automatically. Any influencer note is an optional annotation, never a
    // visibility gate. Phase 0: allocation requires pushed_to_store. Phase 4b:
    // store/category-scoped offers resolve LIVE (new products auto-flow);
    // hand-picked lists stay frozen.
    const ciCfg = r.ci_offer_config || {};
    const allocatedIds = await resolveAllocatedProductIds({
      alloc: allocFromRow(r), ciCfg, offerProductsJson: r.products_json, brandId: r.brand_id,
    });

    let products = [];
    if (allocatedIds.length > 0) {
      const { rows } = await db.query(
        // collab-part4 §4.3 display side — OFFER_BEST_PCT is the SAME evaluator the
        // discovery shelves, wishlist and product cards use. Without it a product
        // could be CHARGED a published global discount at checkout while its tile in
        // the creator's store advertised full price. Simple discounts only: a tile
        // has no cart, so volume/bundle/BOGO cannot be expressed as a % here.
        `SELECT bp.id, bp.name, bp.price, bp.image_url, bp.section, bp.veg_flag,
                bp.description, bp.variants_json,
                ${OFFER_BEST_PCT} AS offer_pct
         FROM brand_products bp
         WHERE bp.id = ANY($1) AND bp.is_active = true AND bp.pushed_to_store = true
         ORDER BY bp.section, bp.name`,
        [allocatedIds]
      );
      // Map the raw pct into the same { discount_value, offer_price } shape every
      // other product card in the app uses, so a creator's tile and a shelf tile
      // advertise a discount identically.
      products = rows.map(({ offer_pct, ...p }) => ({
        ...p,
        ...offerFieldsFromPct(offer_pct, p.price != null ? parseFloat(p.price) : null),
      }));
    }
    const hasAssignedProducts = allocatedIds.length > 0;

    offersWithProducts.push({
      campaign_influencer_id: r.campaign_influencer_id,
      set_id: r.set_id,
      campaign_id: r.campaign_id,
      offer_id: r.offer_id,
      brand_name: r.brand_name,
      brand_id: r.brand_id,
      brand_category: r.brand_category,
      brand_city: r.brand_city,
      offer_type: r.offer_type,
      discount_value: r.discount_value,
      availing_modes: r.availing_modes || ['pay_at_store', 'prebook'],
      coupon_code: r.coupon_code,
      commission_pct: r.commission_pct,
      prebook_advance: r.prebook_advance,
      start_date: r.start_date,
      end_date: r.end_date,
      has_assigned_products: hasAssignedProducts,
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        price: parseFloat(p.price || 0),
        image_url: p.image_url,
        section: p.section,
        veg_flag: p.veg_flag,
        description: p.description,
        variants_json: p.variants_json,
        // collab-part4 §4.3 display side — this projection is a field WHITELIST, so
        // computing the offer fields above was not enough: they were being dropped
        // here and never reached the client. Without these two the tile shows full
        // price while checkout charges the global discount, which is the exact
        // asymmetry §4.3 was supposed to close.
        discount_value: p.discount_value ?? null,
        offer_price: p.offer_price ?? null,
        influencer_note: noteMap[`${p.id}_${r.campaign_id}`] || null,
      })),
    });
  }

  return {
    influencer: {
      id: inf.id,
      instagram_handle: inf.instagram_handle,
      name: inf.name,
      followers_count: inf.followers_count,
      engagement_rate: inf.engagement_rate,
    },
    offers: offersWithProducts,
  };
}

/**
 * Resolve brand store — full product catalog + active offers by influencers.
 *
 * Phase Salon-2: accepts an optional `viaInfluencerId` (the influencer the
 * follower came in through, derived from tracking on the entry URL). When
 * present, the response embeds a top-level `creator` object that the
 * mobile sticky "Brought to you by [creator]" header renders.
 *
 * Lookup strategy for `creator`:
 *   1. If the via-influencer currently has active offers with this brand,
 *      reuse the row already loaded into `byInfluencer` — zero extra query.
 *   2. Else fall back to a direct influencers+users join. Tracking is
 *      attribution-of-entry; we credit the creator even when their offer
 *      with this brand has since ended.
 */
/**
 * Wave 5 — batch rating lookup. Returns a map keyed by brand_id:
 *   { [brandId]: { avg_rating: number, review_count: number } }
 * Brands with no published reviews are simply absent from the map; callers
 * default to { avg_rating: null, review_count: 0 } so the UI can show
 * "New" instead of a fake score.
 */
async function getBrandRatings(brandIds) {
  if (!Array.isArray(brandIds) || brandIds.length === 0) return {};
  const { rows } = await db.query(
    `SELECT brand_id,
            ROUND(AVG(rating)::numeric, 1) AS avg_rating,
            COUNT(*)::int                  AS review_count
       FROM restaurant_reviews
      WHERE brand_id = ANY($1::uuid[]) AND status = 'published'
      GROUP BY brand_id`,
    [brandIds]
  );
  const map = {};
  for (const r of rows) {
    map[r.brand_id] = {
      avg_rating: r.avg_rating != null ? Number(r.avg_rating) : null,
      review_count: r.review_count || 0,
    };
  }
  return map;
}

async function resolveBusinessStore(brandId, viaInfluencerId = null) {
  // Visibility guard (paired with build-while-pending): a brand that has not
  // been admin-approved must NOT be reachable by followers, even though it may
  // have built its listing while pending. Unapproved → treated as not found.
  const { rows: brandRows } = await db.query(
    `SELECT b.*, u.name, u.city FROM brands b JOIN users u ON u.id = b.user_id
      WHERE b.id = $1 AND u.status = 'approved'`,
    [brandId]
  );
  if (!brandRows[0]) return null;
  const brand = brandRows[0];

  // Full product catalog
  const { rows: products } = await db.query(
    `SELECT * FROM brand_products WHERE brand_id = $1 AND is_active = true AND pushed_to_store = true ORDER BY section, name`,
    [brandId]
  );

  // Fashion-1b — variants per product, fetched in one batch query so the
  // /business/:brand_id/store endpoint can render the variant_selector
  // section without an N+1 fetch. Each variant row is the SKU-level
  // {id, size, color, sku, price_override, stock, image_url}.
  const productIds = products.map(p => p.id);
  const variantsByProduct = {};
  if (productIds.length > 0) {
    const { rows: variants } = await db.query(
      `SELECT id, product_id, size, color, sku, price_override, stock, image_url
         FROM product_variants
        WHERE product_id = ANY($1::uuid[]) AND is_active = true
        ORDER BY product_id, size NULLS LAST, color NULLS LAST`,
      [productIds]
    );
    for (const v of variants) {
      if (!variantsByProduct[v.product_id]) variantsByProduct[v.product_id] = [];
      variantsByProduct[v.product_id].push({
        id: v.id,
        size: v.size,
        color: v.color,
        sku: v.sku,
        price_override: v.price_override != null ? parseFloat(v.price_override) : null,
        stock: v.stock,
        image_url: v.image_url,
      });
    }
  }

  // Active campaign offers for this brand
  const { rows } = await db.query(
    FEED_QUERY + ` AND c.brand_id = $1`,
    [brandId]
  );

  // Group offers by influencer
  const byInfluencer = {};
  for (const r of rows) {
    if (!byInfluencer[r.influencer_id]) {
      byInfluencer[r.influencer_id] = {
        influencer_id: r.influencer_id,
        name: r.influencer_name,
        instagram_handle: r.instagram_handle,
        followers_count: r.followers_count,
        profile_pic_url: r.profile_pic_url,
        offers: [],
      };
    }
    byInfluencer[r.influencer_id].offers.push({
      offer_id: r.offer_id,
      campaign_influencer_id: r.campaign_influencer_id,
      set_id: r.set_id,
      campaign_id: r.campaign_id,
      offer_type: r.offer_type,
      discount_value: r.discount_value,
      availing_modes: r.availing_modes,
      coupon_code: r.coupon_code,
      commission_pct: r.commission_pct,
    });
  }

  // Phase Salon-2 — resolve the via-creator for the sticky header.
  let creator = null;
  if (viaInfluencerId) {
    const fromOffers = byInfluencer[viaInfluencerId];
    if (fromOffers) {
      creator = {
        id: fromOffers.influencer_id,
        name: fromOffers.name,
        instagram_handle: fromOffers.instagram_handle,
        profile_pic_url: fromOffers.profile_pic_url || null,
        has_active_offer: true,
      };
    } else {
      // Defensive — influencer no longer has active offers with this brand,
      // but tracking still credits them. Fetch profile directly.
      // Column is `profile_image_url` on the influencers table (aliased as
      // profile_pic_url everywhere downstream to match FEED_QUERY shape).
      const { rows: pRows } = await db.query(
        `SELECT i.id, i.instagram_handle, i.profile_image_url AS profile_pic_url, u.name
           FROM influencers i
           JOIN users u ON u.id = i.user_id
          WHERE i.id = $1`,
        [viaInfluencerId]
      );
      if (pRows[0]) {
        creator = {
          id: pRows[0].id,
          name: pRows[0].name,
          instagram_handle: pRows[0].instagram_handle,
          profile_pic_url: pRows[0].profile_pic_url || null,
          has_active_offer: false,
        };
      }
    }
  }

  // Phase E — creator's published "picks" for this brand. When the buyer
  // arrived via a creator link, surface a horizontal strip of dishes the
  // creator has personally recommended (joined from influencer_product_notes
  // → brand_products for this brand only). Empty array when the creator
  // hasn't published anything for this brand, or no viaInfluencerId.
  let creatorPicks = [];
  if (viaInfluencerId) {
    const { rows: pickRows } = await db.query(
      `SELECT bp.id, bp.name, bp.price, bp.image_url, bp.section, bp.veg_flag,
              bp.description, ipn.note_text
       FROM   influencer_product_notes ipn
       JOIN   brand_products bp ON bp.id = ipn.product_id
       WHERE  ipn.influencer_id = $1
         AND  bp.brand_id = $2
         AND  bp.is_active = true
       ORDER  BY ipn.updated_at DESC NULLS LAST, ipn.created_at DESC
       LIMIT  20`,
      [viaInfluencerId, brandId]
    );
    creatorPicks = pickRows.map(p => ({
      id: p.id,
      name: p.name,
      price: parseFloat(p.price || 0),
      image_url: p.image_url,
      section: p.section,
      veg_flag: p.veg_flag,
      description: p.description,
      influencer_note: p.note_text,
    }));
  }

  // Phase 1 (Dining) — load the schema template so BrandStoreScreen can
  // render brand_config.actions (Book Table / Pay at Restaurant) via the
  // BrandActionRow component. Defensive lookup: unknown categories return
  // null and the screen falls back to the legacy contact buttons.
  const template = listingService.loadSchema(brand.category) || null;

  // Phase 1 (Dining) — derive open/closed status from listing_data.hours_json
  // so cards and detail headers can show "Open · Closes 11 PM" trust signals.
  const listingData = brand.listing_data || {};
  const openStatus = computeOpenStatus(listingData.hours_json);

  // Wave 5 — attach aggregate rating so the detail header + cards show a
  // real score (or null → "New" when the place has no reviews yet).
  const ratingMap = await getBrandRatings([brandId]);
  const rating = ratingMap[brandId] || { avg_rating: null, review_count: 0 };

  // Offer Engine (D): store-published offers — brand-direct, NO influencer.
  // Returned in a distinct `store_offers` array (current mobile reads
  // `influencers[].offers`, so this is dormant until D3 wires the STORE DEAL UI
  // + the store-direct purchase path).
  const { rows: storeOfferRows } = await db.query(
    `SELECT id, name, offer_type, offer_config_json, availing_modes
       FROM brand_offers
      WHERE brand_id = $1 AND published_to_store = true AND status = 'active'
        AND (store_starts_at IS NULL OR store_starts_at <= now())
        AND (store_ends_at   IS NULL OR store_ends_at   >= now())
      ORDER BY created_at DESC`,
    [brandId]
  );
  const storeOffers = storeOfferRows.map(o => ({
    brand_offer_id: o.id,
    name: o.name,
    offer_type: o.offer_type,
    offer_config_json: o.offer_config_json,
    availing_modes: o.availing_modes,
    offer_source: 'store',
  }));

  return {
    brand: {
      id: brand.id,
      business_name: brand.business_name,
      category: brand.category,
      city: brand.city,
      avg_rating:   rating.avg_rating,
      review_count: rating.review_count,
      // Phase 1 surfaces — only present when the brand has filled the
      // corresponding listing fields. Mobile renders conditionally.
      cover_image_url:           listingData.cover_image_url || null,
      cost_for_two:              listingData.cost_for_two != null ? Number(listingData.cost_for_two) : null,
      locality_or_neighborhood:  listingData.locality_or_neighborhood || null,
      cuisines:                  Array.isArray(listingData.cuisines) ? listingData.cuisines : [],
      // Food World P1 — restaurant storefront header. ETA + free-delivery ride
      // in listing_data (consistent with cuisines/cost_for_two) — no brands
      // schema change. Owner fills these in the Phase-2 editor; display-only now.
      free_delivery:             listingData.free_delivery === true,
      delivery_eta_min_mins:     listingData.delivery_eta_min_mins != null ? Number(listingData.delivery_eta_min_mins) : null,
      delivery_eta_max_mins:     listingData.delivery_eta_max_mins != null ? Number(listingData.delivery_eta_max_mins) : null,
      open_status:               openStatus,
      // Pass through full listing_data so BrandActionRow's visible_if
      // expressions (e.g. "brand_data.accepts_table_booking == true") can
      // evaluate. brand_data on mobile reads from this.
      listing_data:              listingData,
    },
    products: products.map(p => ({
      id: p.id,
      name: p.name,
      price: parseFloat(p.price || 0),
      image_url: p.image_url,
      section: p.section,
      veg_flag: p.veg_flag,
      description: p.description,
      is_bookable: p.is_bookable,
      // Fashion-1b — return policy + variants surfaced for the new
      // detail-screen return_policy_notice + variant_selector sections
      return_policy_days: p.return_policy_days || 0,
      variants: variantsByProduct[p.id] || [],
    })),
    influencers: Object.values(byInfluencer),
    store_offers: storeOffers,                            // Offer Engine (D) — brand-direct store offers (dormant until D3 mobile)
    creator,                                              // null when no via param or unknown influencer
    creator_picks: creatorPicks,                          // Phase E — published dishes when viewed via creator link
    template,                                             // Phase 1 (Dining) — drives BrandActionRow CTAs
  };
}

/**
 * Category + city filtered listing
 */
async function resolveCategoryStore(categoryKey, city) {
  let sql = ACTIVE_CI_QUERY + ` AND b.category = $1`;
  const params = [categoryKey];

  if (city) {
    sql += ` AND LOWER(u_b.city) = LOWER($2)`;
    params.push(city);
  }

  sql += ` ORDER BY (
    SELECT followers_count FROM influencers WHERE id = ci.influencer_id
  ) DESC NULLS LAST`;

  const { rows } = await db.query(sql, params);
  return rows.map(r => ({
    campaign_influencer_id: r.campaign_influencer_id,
    influencer_id: r.influencer_id,
    brand_name: r.brand_name,
    brand_id: r.brand_id,
    brand_category: r.brand_category,
    brand_city: r.brand_city,
    offer_id: r.offer_id,
    offer_type: r.offer_type,
    discount_value: r.discount_value,
    availing_modes: r.availing_modes,
    coupon_code: r.coupon_code,
    commission_pct: r.commission_pct,
  }));
}

/**
 * Legacy feed (kept for backward compat)
 */
async function getFeed(followerId, followerCity) {
  const { rows: followedRows } = await db.query(
    ACTIVE_CI_QUERY + `
      AND ci.influencer_id IN (
        SELECT influencer_id FROM follower_follows WHERE follower_id = $1
      )
    `,
    [followerId]
  );

  const { rows: nearbyRows } = await db.query(
    ACTIVE_CI_QUERY + `
      AND LOWER(u_b.city) = LOWER($1)
      ORDER BY (SELECT followers_count FROM influencers WHERE id = ci.influencer_id) DESC NULLS LAST
      LIMIT 20
    `,
    [followerCity || '']
  );

  const seen = new Set();
  const feed = [];

  for (const r of [...followedRows, ...nearbyRows]) {
    if (seen.has(r.campaign_influencer_id)) continue;
    seen.add(r.campaign_influencer_id);

    feed.push({
      influencer_id: r.influencer_id,
      brand_id: r.brand_id,
      brand_name: r.brand_name,
      brand_category: r.brand_category,
      offer: {
        id: r.offer_id,
        offer_type: r.offer_type,
        discount_value: r.discount_value,
        availing_modes: r.availing_modes,
      },
      coupon_code: r.coupon_code,
      commission_pct: r.commission_pct,
      campaign_influencer_id: r.campaign_influencer_id,
      set_id: r.set_id,
      campaign_id: r.campaign_id,
    });

    if (feed.length >= 20) break;
  }

  return feed;
}

/**
 * NEW: Product-centric home feed with deduplication
 * Same product promoted by N influencers → shown once with influencer_count
 * Prioritizes: followed influencers → same city → all
 */
async function getHomeFeed(followerId, followerCity, page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  // Get followed influencer IDs
  const { rows: followRows } = await db.query(
    `SELECT influencer_id FROM follower_follows WHERE follower_id = $1`,
    [followerId]
  );
  const followedIds = new Set(followRows.map(r => r.influencer_id));

  // Fetch all active offers with influencer details
  let sql = FEED_QUERY;
  const params = [];

  // Optional city filter for relevance
  if (followerCity) {
    sql += ` ORDER BY
      CASE WHEN LOWER(u_b.city) = LOWER($1) THEN 0 ELSE 1 END,
      i.followers_count DESC NULLS LAST`;
    params.push(followerCity);
  } else {
    sql += ` ORDER BY i.followers_count DESC NULLS LAST`;
  }

  sql += ` LIMIT 200`; // Fetch more than needed for dedup

  const { rows } = await db.query(sql, params);

  // Get saved offer IDs for this follower
  const { rows: savedRows } = await db.query(
    `SELECT offer_id FROM follower_saved_offers WHERE follower_id = $1`,
    [followerId]
  );
  const savedOfferIds = new Set(savedRows.map(r => r.offer_id));

  // Deduplicate by (brand_id, offer_id) — same offer from multiple influencers
  const deduped = new Map(); // key: `${brand_id}_${offer_id}`

  for (const r of rows) {
    const key = `${r.brand_id}_${r.offer_id}`;
    const isFollowed = followedIds.has(r.influencer_id);

    if (!deduped.has(key)) {
      // Fetch first product for display
      const { rows: products } = await db.query(
        `SELECT id, name, price, image_url, description
         FROM brand_products WHERE brand_id = $1 AND is_active = true
         ORDER BY section, name LIMIT 1`,
        [r.brand_id]
      );

      // Get influencer note for this campaign
      const { rows: notes } = await db.query(
        `SELECT note_text FROM influencer_product_notes
         WHERE influencer_id = $1 AND campaign_id = $2 LIMIT 1`,
        [r.influencer_id, r.campaign_id]
      );

      const product = products[0] || null;

      deduped.set(key, {
        brand: {
          id: r.brand_id,
          name: r.brand_name,
          category: r.brand_category,
          city: r.brand_city,
        },
        offer: {
          id: r.offer_id,
          offer_type: r.offer_type,
          discount_value: r.discount_value,
          availing_modes: r.availing_modes,
          prebook_advance: r.prebook_advance,
        },
        product: product ? {
          id: product.id,
          name: product.name,
          price: parseFloat(product.price || 0),
          image_url: product.image_url,
          description: product.description,
        } : null,
        // Primary influencer (first one, prefer followed)
        influencer: {
          id: r.influencer_id,
          name: r.influencer_name,
          handle: r.instagram_handle,
          followers_count: r.followers_count,
          note_text: notes[0]?.note_text || null,
          is_followed: isFollowed,
        },
        influencer_count: 1,
        influencers: [{
          id: r.influencer_id,
          name: r.influencer_name,
          handle: r.instagram_handle,
        }],
        tracking: {
          campaign_id: r.campaign_id,
          set_id: r.set_id,
          offer_id: r.offer_id,
          campaign_influencer_id: r.campaign_influencer_id,
        },
        is_saved: savedOfferIds.has(r.offer_id),
        has_followed_influencer: isFollowed,
        end_date: r.end_date,
      });
    } else {
      // Add this influencer to existing entry
      const entry = deduped.get(key);
      entry.influencer_count++;
      entry.influencers.push({
        id: r.influencer_id,
        name: r.influencer_name,
        handle: r.instagram_handle,
      });
      // Prefer followed influencer as primary
      if (isFollowed && !entry.has_followed_influencer) {
        const { rows: notes } = await db.query(
          `SELECT note_text FROM influencer_product_notes
           WHERE influencer_id = $1 AND campaign_id = $2 LIMIT 1`,
          [r.influencer_id, r.campaign_id]
        );
        entry.influencer = {
          id: r.influencer_id,
          name: r.influencer_name,
          handle: r.instagram_handle,
          followers_count: r.followers_count,
          note_text: notes[0]?.note_text || null,
          is_followed: true,
        };
        entry.has_followed_influencer = true;
        // Update tracking to point to followed influencer
        entry.tracking = {
          campaign_id: r.campaign_id,
          set_id: r.set_id,
          offer_id: r.offer_id,
          campaign_influencer_id: r.campaign_influencer_id,
        };
      }
    }
  }

  // Sort: followed influencer deals first, then by influencer_count desc
  const allItems = Array.from(deduped.values());
  allItems.sort((a, b) => {
    if (a.has_followed_influencer && !b.has_followed_influencer) return -1;
    if (!a.has_followed_influencer && b.has_followed_influencer) return 1;
    return b.influencer_count - a.influencer_count;
  });

  // Paginate
  const paginated = allItems.slice(offset, offset + limit);
  const total = allItems.length;

  return { feed: paginated, total, page, limit };
}

/**
 * NEW: Deals by category
 */
async function getDealsByCategory(category, followerCity, followerId, page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  let sql = FEED_QUERY;
  const params = [];
  let paramIdx = 0;

  // Category filter — members for the tile from the single taxonomy source.
  const cats = (category && category !== 'all') ? await categoryTaxonomy.membersFor(category) : null;
  if (cats && cats.length) {
    const placeholders = cats.map(() => `$${++paramIdx}`);
    sql += ` AND b.category IN (${placeholders.join(',')})`;
    params.push(...cats);
  }

  // City filter
  if (followerCity) {
    sql += ` ORDER BY CASE WHEN LOWER(u_b.city) = LOWER($${++paramIdx}) THEN 0 ELSE 1 END, i.followers_count DESC NULLS LAST`;
    params.push(followerCity);
  } else {
    sql += ` ORDER BY i.followers_count DESC NULLS LAST`;
  }

  sql += ` LIMIT 100`;

  const { rows } = await db.query(sql, params);

  // Get saved offers
  const { rows: savedRows } = await db.query(
    `SELECT offer_id FROM follower_saved_offers WHERE follower_id = $1`,
    [followerId]
  );
  const savedOfferIds = new Set(savedRows.map(r => r.offer_id));

  // Get followed
  const { rows: followRows } = await db.query(
    `SELECT influencer_id FROM follower_follows WHERE follower_id = $1`,
    [followerId]
  );
  const followedIds = new Set(followRows.map(r => r.influencer_id));

  // Build feed items (one per offer row — no dedup for deals, show per-influencer)
  const items = [];
  for (const r of rows) {
    const { rows: products } = await db.query(
      `SELECT id, name, price, image_url FROM brand_products
       WHERE brand_id = $1 AND is_active = true ORDER BY section, name LIMIT 1`,
      [r.brand_id]
    );

    const { rows: notes } = await db.query(
      `SELECT note_text FROM influencer_product_notes
       WHERE influencer_id = $1 AND campaign_id = $2 LIMIT 1`,
      [r.influencer_id, r.campaign_id]
    );

    const product = products[0] || null;

    items.push({
      brand: {
        id: r.brand_id,
        name: r.brand_name,
        category: r.brand_category,
        city: r.brand_city,
      },
      offer: {
        id: r.offer_id,
        offer_type: r.offer_type,
        discount_value: r.discount_value,
        availing_modes: r.availing_modes,
        prebook_advance: r.prebook_advance,
      },
      product: product ? {
        id: product.id,
        name: product.name,
        price: parseFloat(product.price || 0),
        image_url: product.image_url,
      } : null,
      influencer: {
        id: r.influencer_id,
        name: r.influencer_name,
        handle: r.instagram_handle,
        followers_count: r.followers_count,
        note_text: notes[0]?.note_text || null,
        is_followed: followedIds.has(r.influencer_id),
      },
      tracking: {
        campaign_id: r.campaign_id,
        set_id: r.set_id,
        offer_id: r.offer_id,
        campaign_influencer_id: r.campaign_influencer_id,
      },
      is_saved: savedOfferIds.has(r.offer_id),
      end_date: r.end_date,
    });
  }

  const paginated = items.slice(offset, offset + limit);
  return { deals: paginated, total: items.length, page, limit };
}

/**
 * NEW: Get followed influencers with active deal counts
 */
async function getFollowing(followerId) {
  const { rows } = await db.query(
    `SELECT
       i.id,
       i.instagram_handle,
       i.followers_count,
       i.engagement_rate,
       u.name,
       ff.followed_at,
       (
         SELECT COUNT(DISTINCT co.id)
         FROM campaign_influencers ci2
         JOIN campaign_sets cs2 ON cs2.id = ci2.set_id
         JOIN campaigns c2 ON c2.id = cs2.campaign_id
         JOIN campaign_offers co ON co.set_id = cs2.id AND co.is_active = true
         WHERE ci2.influencer_id = i.id
           AND ci2.status IN ('contracted','active','completed')
           AND c2.status IN ('published','active','live')
           AND (c2.start_date IS NULL OR c2.start_date <= CURRENT_DATE)
           AND (c2.end_date IS NULL OR c2.end_date >= CURRENT_DATE)
       )::int AS active_deals
     FROM follower_follows ff
     JOIN influencers i ON i.id = ff.influencer_id
     JOIN users u ON u.id = i.user_id
     WHERE ff.follower_id = $1
     ORDER BY ff.followed_at DESC`,
    [followerId]
  );

  return rows;
}

/**
 * NEW: Influencer previews their own store (as followers see it)
 */
async function getInfluencerStorePreview(influencerId) {
  const { rows: infRows } = await db.query(
    `SELECT i.*, u.name FROM influencers i JOIN users u ON u.id = i.user_id WHERE i.id = $1`,
    [influencerId]
  );
  if (!infRows[0]) return null;
  const inf = infRows[0];

  // Get active offers (date-gated)
  const { rows: offerRows } = await db.query(
    ACTIVE_CI_QUERY + ` AND ci.influencer_id = $1`,
    [influencerId]
  );

  // Get notes
  const { rows: noteRows } = await db.query(
    `SELECT product_id, campaign_id, note_text FROM influencer_product_notes WHERE influencer_id = $1`,
    [influencerId]
  );
  const noteMap = {};
  for (const n of noteRows) {
    noteMap[`${n.product_id}_${n.campaign_id}`] = n.note_text;
  }

  const offersWithProducts = [];
  for (const r of offerRows) {
    // Phase 2b — same allocation source as the follower-facing resolveStore so
    // the creator's preview matches what followers see. (Was: notes-gated with a
    // full brand-catalogue ELSE fallback that leaked every product when the
    // creator hadn't hand-picked anything.) Phase 4b: scope-aware + live.
    const allocatedIds = await resolveAllocatedProductIds({
      alloc: allocFromRow(r), ciCfg: r.ci_offer_config || {},
      offerProductsJson: r.products_json, brandId: r.brand_id,
    });
    let products = [];
    if (allocatedIds.length > 0) {
      const { rows } = await db.query(
        // collab-part4 §4.3 display side — OFFER_BEST_PCT is the SAME evaluator the
        // discovery shelves, wishlist and product cards use. Without it a product
        // could be CHARGED a published global discount at checkout while its tile in
        // the creator's store advertised full price. Simple discounts only: a tile
        // has no cart, so volume/bundle/BOGO cannot be expressed as a % here.
        `SELECT bp.id, bp.name, bp.price, bp.image_url, bp.section, bp.veg_flag,
                bp.description, bp.variants_json,
                ${OFFER_BEST_PCT} AS offer_pct
         FROM brand_products bp
         WHERE bp.id = ANY($1) AND bp.is_active = true AND bp.pushed_to_store = true
         ORDER BY bp.section, bp.name`,
        [allocatedIds]
      );
      // Map the raw pct into the same { discount_value, offer_price } shape every
      // other product card in the app uses, so a creator's tile and a shelf tile
      // advertise a discount identically.
      products = rows.map(({ offer_pct, ...p }) => ({
        ...p,
        ...offerFieldsFromPct(offer_pct, p.price != null ? parseFloat(p.price) : null),
      }));
    }

    offersWithProducts.push({
      brand_name: r.brand_name,
      brand_id: r.brand_id,
      brand_category: r.brand_category,
      offer_type: r.offer_type,
      discount_value: r.discount_value,
      availing_modes: r.availing_modes || ['pay_at_store', 'prebook'],
      coupon_code: r.coupon_code,
      end_date: r.end_date,
      campaign_influencer_id: r.campaign_influencer_id,
      set_id: r.set_id,
      campaign_id: r.campaign_id,
      offer_id: r.offer_id,
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        price: parseFloat(p.price || 0),
        image_url: p.image_url,
        section: p.section,
        description: p.description,
        // collab-part4 §4.3 display side — see the sibling projection above: this is
        // a field whitelist, so without these two the computed offer fields are
        // silently dropped and the tile advertises full price while checkout charges
        // the global discount.
        discount_value: p.discount_value ?? null,
        offer_price: p.offer_price ?? null,
        influencer_note: noteMap[`${p.id}_${r.campaign_id}`] || null,
        has_note: !!noteMap[`${p.id}_${r.campaign_id}`],
      })),
    });
  }

  return {
    influencer: {
      id: inf.id,
      instagram_handle: inf.instagram_handle,
      name: inf.name,
      followers_count: inf.followers_count,
      engagement_rate: inf.engagement_rate,
    },
    offers: offersWithProducts,
  };
}

/**
 * NEW: Brand previews their store (as followers see it)
 */
async function getBrandStorePreview(brandId) {
  return resolveBusinessStore(brandId);
}

module.exports = {
  resolveStore,
  resolveBusinessStore,
  resolveCategoryStore,
  getBrandRatings,
  getFeed,
  getHomeFeed,
  getDealsByCategory,
  getFollowing,
  getInfluencerStorePreview,
  getBrandStorePreview,
  computeOpenStatus,        // Phase 1 (Dining) — exported so controllers can reuse the helper
  allocatedProductIds,      // Phase 3a — reused by sectionLibrary for creator-surface stacking
  resolveAllocatedProductIds, // Phase 4b — scope-aware LIVE allocation (store/category)
  allocFromRow,               // collab-part4 §4.1 — one shape for the allocation object
};
