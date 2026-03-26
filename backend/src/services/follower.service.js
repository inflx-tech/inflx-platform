'use strict';

/**
 * follower.service.js
 * Phase 4 — Block A
 *
 * resolveStore   — resolve influencer + active offers for store endpoint
 * resolveBusinessStore — brand store grouped by influencer
 * resolveCategoryStore — category + city filtered listing
 * getFeed        — follower home feed
 */

const db = require('../config/db');

// Shared SQL fragment for "active campaign_influencer with offer"
const ACTIVE_CI_QUERY = `
  SELECT
    ci.id                 AS campaign_influencer_id,
    ci.coupon_code,
    ci.commission_pct,
    ci.influencer_id,
    cs.id                 AS set_id,
    cs.campaign_id,
    c.brand_id,
    c.name                AS campaign_name,
    c.end_date,
    b.business_name       AS brand_name,
    b.id                  AS brand_id,
    b.category            AS brand_category,
    u_b.city              AS brand_city,
    co.id                 AS offer_id,
    co.offer_type,
    co.discount_value,
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
  JOIN campaign_offers co        ON co.set_id = cs.id AND co.is_active = true
  WHERE ci.status IN ('contracted', 'active', 'completed')
    AND c.status  IN ('published', 'active', 'live')
    AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
`;

/**
 * Resolve influencer + active offers for GET /store/:handle
 */
async function resolveStore(handle) {
  // Get influencer
  const { rows: infRows } = await db.query(
    `SELECT i.*, u.name, u.status AS user_status, u.phone
     FROM influencers i
     JOIN users u ON u.id = i.user_id
     WHERE i.instagram_handle = $1`,
    [handle]
  );
  if (!infRows[0]) return null;
  const inf = infRows[0];

  // Get active offers
  const { rows: offerRows } = await db.query(
    ACTIVE_CI_QUERY + ` AND ci.influencer_id = $1`,
    [inf.id]
  );

  return {
    influencer: {
      id: inf.id,
      instagram_handle: inf.instagram_handle,
      name: inf.name,
      followers_count: inf.followers_count,
      engagement_rate: inf.engagement_rate,
    },
    offers: offerRows.map(r => ({
      campaign_influencer_id: r.campaign_influencer_id,
      set_id: r.set_id,
      campaign_id: r.campaign_id,
      offer_id: r.offer_id,
      brand_name: r.brand_name,
      brand_id: r.brand_id,
      brand_category: r.brand_category,
      offer_type: r.offer_type,
      discount_value: r.discount_value,
      availing_modes: r.availing_modes,
      coupon_code: r.coupon_code,
      commission_pct: r.commission_pct,
      prebook_advance: r.prebook_advance,
    })),
  };
}

/**
 * Resolve brand store — all active offers by this brand grouped by influencer
 */
async function resolveBusinessStore(brandId) {
  const { rows: brandRows } = await db.query(
    `SELECT b.*, u.name, u.city FROM brands b JOIN users u ON u.id = b.user_id WHERE b.id = $1`,
    [brandId]
  );
  if (!brandRows[0]) return null;
  const brand = brandRows[0];

  const { rows } = await db.query(
    ACTIVE_CI_QUERY + ` AND c.brand_id = $1`,
    [brandId]
  );

  // Group by influencer
  const byInfluencer = {};
  for (const r of rows) {
    if (!byInfluencer[r.influencer_id]) {
      const { rows: infRows } = await db.query(
        `SELECT i.*, u.name FROM influencers i JOIN users u ON u.id = i.user_id WHERE i.id = $1`,
        [r.influencer_id]
      );
      byInfluencer[r.influencer_id] = {
        influencer_id: r.influencer_id,
        name: infRows[0]?.name,
        instagram_handle: infRows[0]?.instagram_handle,
        offers: [],
      };
    }
    byInfluencer[r.influencer_id].offers.push({
      offer_id: r.offer_id,
      campaign_influencer_id: r.campaign_influencer_id,
      offer_type: r.offer_type,
      discount_value: r.discount_value,
      availing_modes: r.availing_modes,
      coupon_code: r.coupon_code,
      commission_pct: r.commission_pct,
    });
  }

  return {
    brand: { id: brand.id, business_name: brand.business_name, category: brand.category },
    influencers: Object.values(byInfluencer),
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
 * Follower home feed:
 *  - Followed influencers' active offers (priority)
 *  - Nearby offers (brand.city matches follower.city)
 *  - Deduped, max 20 results
 */
async function getFeed(followerId, followerCity) {
  // Followed influencer offers
  const { rows: followedRows } = await db.query(
    ACTIVE_CI_QUERY + `
      AND ci.influencer_id IN (
        SELECT influencer_id FROM follower_follows WHERE follower_id = $1
      )
    `,
    [followerId]
  );

  // Nearby offers
  const { rows: nearbyRows } = await db.query(
    ACTIVE_CI_QUERY + `
      AND LOWER(u_b.city) = LOWER($1)
      ORDER BY (SELECT followers_count FROM influencers WHERE id = ci.influencer_id) DESC NULLS LAST
      LIMIT 20
    `,
    [followerCity || '']
  );

  // Merge: followed first, then nearby (dedupe by campaign_influencer_id)
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

module.exports = { resolveStore, resolveBusinessStore, resolveCategoryStore, getFeed };
