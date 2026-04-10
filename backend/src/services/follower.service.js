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

// Shared SQL fragment for "active campaign_influencer with offer" + DATE GATING
const ACTIVE_CI_QUERY = `
  SELECT
    ci.id                 AS campaign_influencer_id,
    ci.coupon_code,
    ci.commission_pct,
    ci.influencer_id,
    ci.offer_type         AS ci_offer_type,
    ci.offer_config_json  AS ci_offer_config,
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
    COALESCE(co.discount_value, NULLIF(ci.offer_config_json->>'value','')::numeric, ci.commission_pct) AS discount_value,
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
    AND (co.id IS NOT NULL OR ci.offer_type IS NOT NULL)
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
    COALESCE(co.discount_value, NULLIF(ci.offer_config_json->>'value','')::numeric, ci.commission_pct) AS discount_value,
    co.availing_modes,
    co.products_json,
    co.prebook_advance,
    i.instagram_handle,
    i.followers_count,
    i.engagement_rate,
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
    AND (co.id IS NOT NULL OR ci.offer_type IS NOT NULL)
`;

// Category mapping for deals tab
const CATEGORY_MAP = {
  dining:   ['restaurant', 'bakery'],
  shopping: ['fashion_walkin', 'fashion_online', 'florist', 'packaged_food'],
  booking:  ['salon', 'car_rental', 'function_hall', 'wedding_planner'],
};

/**
 * Resolve influencer + active offers for GET /store/:handle
 * Now includes influencer product notes and date gating
 */
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
    // Get product IDs that have notes (published by this influencer for this campaign)
    const publishedIds = noteRows
      .filter(n => n.campaign_id === r.campaign_id)
      .map(n => n.product_id);

    let products;
    if (publishedIds.length > 0) {
      // Show ONLY published products (influencer chose to publish these)
      const { rows } = await db.query(
        `SELECT id, name, price, image_url, section, veg_flag, description, variants_json
         FROM brand_products WHERE id = ANY($1) AND is_active = true
         ORDER BY section, name`,
        [publishedIds]
      );
      products = rows;
    } else {
      // No published products — show brand catalog as preview
      const { rows } = await db.query(
        `SELECT id, name, price, image_url, section, veg_flag, description, variants_json
         FROM brand_products WHERE brand_id = $1 AND is_active = true
         ORDER BY section, name LIMIT 10`,
        [r.brand_id]
      );
      products = rows;
    }

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
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        price: Math.round(parseFloat(p.price || 0) * 100),
        image_url: p.image_url,
        section: p.section,
        veg_flag: p.veg_flag,
        description: p.description,
        variants_json: p.variants_json,
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
 * Resolve brand store — full product catalog + active offers by influencers
 */
async function resolveBusinessStore(brandId) {
  const { rows: brandRows } = await db.query(
    `SELECT b.*, u.name, u.city FROM brands b JOIN users u ON u.id = b.user_id WHERE b.id = $1`,
    [brandId]
  );
  if (!brandRows[0]) return null;
  const brand = brandRows[0];

  // Full product catalog
  const { rows: products } = await db.query(
    `SELECT * FROM brand_products WHERE brand_id = $1 AND is_active = true ORDER BY section, name`,
    [brandId]
  );

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

  return {
    brand: {
      id: brand.id,
      business_name: brand.business_name,
      category: brand.category,
      city: brand.city,
    },
    products: products.map(p => ({
      id: p.id,
      name: p.name,
      price: Math.round(parseFloat(p.price || 0) * 100),
      image_url: p.image_url,
      section: p.section,
      veg_flag: p.veg_flag,
      description: p.description,
      is_bookable: p.is_bookable,
    })),
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
          price: Math.round(parseFloat(product.price || 0) * 100),
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

  // Category filter
  if (category && category !== 'all' && CATEGORY_MAP[category]) {
    const cats = CATEGORY_MAP[category];
    const placeholders = cats.map((_, i) => `$${++paramIdx}`);
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
        price: Math.round(parseFloat(product.price || 0) * 100),
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
    // Get published product IDs (with notes)
    const publishedIds = noteRows
      .filter(n => n.campaign_id === r.campaign_id)
      .map(n => n.product_id);

    let products;
    if (publishedIds.length > 0) {
      const { rows } = await db.query(
        `SELECT id, name, price, image_url, section, veg_flag, description, variants_json
         FROM brand_products WHERE id = ANY($1) AND is_active = true
         ORDER BY section, name`,
        [publishedIds]
      );
      products = rows;
    } else {
      const { rows } = await db.query(
        `SELECT id, name, price, image_url, section, veg_flag, description, variants_json
         FROM brand_products WHERE brand_id = $1 AND is_active = true
         ORDER BY section, name`,
        [r.brand_id]
      );
      products = rows;
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
        price: Math.round(parseFloat(p.price || 0) * 100),
        image_url: p.image_url,
        section: p.section,
        description: p.description,
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
  getFeed,
  getHomeFeed,
  getDealsByCategory,
  getFollowing,
  getInfluencerStorePreview,
  getBrandStorePreview,
};
