'use strict';

/**
 * follower.controller.js
 * Phase 4 — Block A (Updated for Follower App Redesign)
 *
 * Endpoints:
 *   POST   /followers/register
 *   GET    /followers/me
 *   POST   /follower/follows
 *   DELETE /follower/follows/:influencer_id
 *   GET    /store/:handle          (no auth — uses authenticateOptional)
 *   GET    /store/:handle/products (no auth)
 *   GET    /business/:brand_id     (no auth)
 *   GET    /business/:brand_id/store (no auth — full brand store)
 *   GET    /category/:category_key (no auth)
 *   POST   /follower/addresses
 *   GET    /follower/addresses
 *   PATCH  /follower/addresses/:id
 *   GET    /follower/feed          (legacy)
 *   GET    /follower/home-feed     (NEW — product-centric deduped)
 *   GET    /follower/deals         (NEW — category browse)
 *   GET    /follower/following     (NEW — followed influencers)
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const followerService = require('../services/follower.service');

// ── Helper: get follower row or throw ────────────────────────────────────────

async function getFollowerByUserId(userId) {
  const { rows } = await db.query(
    `SELECT f.*, u.name, u.city AS user_city, u.phone
     FROM followers f
     JOIN users u ON u.id = f.user_id
     WHERE f.user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

// ── POST /followers/register ──────────────────────────────────────────────────

const register = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const { name, city, state } = req.body;

  // Update user name/city/state
  if (name || city || state) {
    await db.query(
      `UPDATE users SET
         name  = COALESCE($1, name),
         city  = COALESCE($2, city),
         state = COALESCE($3, state)
       WHERE id = $4`,
      [name || null, city || null, state || null, userId]
    );
  }

  // Upsert followers row (also sync city to followers table)
  const { rows } = await db.query(
    `INSERT INTO followers (user_id, city) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET city = COALESCE(EXCLUDED.city, followers.city)
     RETURNING *`,
    [userId, city || null]
  );

  return success(res, { follower: rows[0] }, 201);
});

// ── GET /followers/me ─────────────────────────────────────────────────────────

const getMe = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  if (!follower) throw new AppError('NOT_FOUND', 'Follower profile not found. Please register first.', 404);

  const { rows: addresses } = await db.query(
    `SELECT * FROM follower_addresses WHERE follower_id = $1 ORDER BY is_default DESC`,
    [follower.id]
  );

  return success(res, { follower, addresses });
});

// ── POST /follower/follows ────────────────────────────────────────────────────

const followInfluencer = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  if (!follower) throw new AppError('NOT_FOUND', 'Follower profile not found. Please register first.', 404);

  const { influencer_id } = req.body;
  if (!influencer_id) throw new AppError('VALIDATION_ERROR', 'influencer_id is required', 422);

  await db.query(
    `INSERT INTO follower_follows (follower_id, influencer_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [follower.id, influencer_id]
  );

  return success(res, { following: true });
});

// ── DELETE /follower/follows/:influencer_id ───────────────────────────────────

const unfollowInfluencer = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  if (!follower) throw new AppError('NOT_FOUND', 'Follower profile not found. Please register first.', 404);

  await db.query(
    `DELETE FROM follower_follows WHERE follower_id = $1 AND influencer_id = $2`,
    [follower.id, req.params.influencer_id]
  );

  return success(res, { following: false });
});

// ── GET /store/:influencer_handle ────────────────────────────────────────────

const locationService = require('../services/location.service');

// Helper: add distance_km to offers that have brand lat/lng
async function attachDistance(offers, followerLat, followerLng) {
  if (!followerLat || !followerLng || !offers?.length) return offers;
  for (const offer of offers) {
    if (offer.brand_id) {
      const { rows } = await db.query('SELECT latitude, longitude FROM brands WHERE id = $1', [offer.brand_id]);
      if (rows[0]?.latitude && rows[0]?.longitude) {
        offer.distance_km = locationService.haversineKm(followerLat, followerLng, parseFloat(rows[0].latitude), parseFloat(rows[0].longitude));
        offer.distance_text = locationService.formatDistance(offer.distance_km);
      }
    }
  }
  return offers;
}

const getInfluencerStore = asyncHandler(async (req, res) => {
  const { influencer_handle } = req.params;
  const { cid, sid, oid, iid, lat, lng } = req.query;

  const storeData = await followerService.resolveStore(influencer_handle);
  if (!storeData) throw new AppError('NOT_FOUND', 'Influencer not found', 404);

  // Add distance if follower provided location
  if (lat && lng) {
    await attachDistance(storeData.offers, parseFloat(lat), parseFloat(lng));
  }

  const { influencer, offers } = storeData;

  // Build tracking IDs
  let tracking = null;
  if (offers.length > 0) {
    const firstOffer = offers[0];
    if (cid && sid && oid && iid) {
      const matchingOffer = offers.find(o =>
        o.campaign_id === cid &&
        o.set_id === sid &&
        o.offer_id === oid &&
        o.campaign_influencer_id === iid
      );
      if (matchingOffer) {
        tracking = {
          campaign_id: cid,
          set_id: sid,
          offer_id: oid,
          campaign_influencer_id: iid,
        };
      }
    }
    if (!tracking) {
      tracking = {
        campaign_id: firstOffer.campaign_id,
        set_id: firstOffer.set_id,
        offer_id: firstOffer.offer_id,
        campaign_influencer_id: firstOffer.campaign_influencer_id,
      };
    }
  }

  return success(res, { influencer, offers, tracking });
});

// ── GET /business/:brand_id ───────────────────────────────────────────────────

const getBusinessStore = asyncHandler(async (req, res) => {
  // Phase Salon-2: optional `?via=<influencer_id>` lets the mobile client
  // render a "Brought to you by [creator]" header. The query param is
  // user-supplied so we validate the shape (UUID-ish) but the service
  // returns null `creator` for any unresolvable value — never errors.
  const viaRaw = typeof req.query.via === 'string' ? req.query.via.trim() : null;
  const via = viaRaw && /^[0-9a-fA-F-]{8,}$/.test(viaRaw) ? viaRaw : null;

  const storeData = await followerService.resolveBusinessStore(req.params.brand_id, via);
  if (!storeData) throw new AppError('NOT_FOUND', 'Brand not found', 404);
  return success(res, storeData);
});

// ── GET /category/:category_key ──────────────────────────────────────────────

const getCategoryStore = asyncHandler(async (req, res) => {
  const { category_key } = req.params;
  const { city } = req.query;
  const offers = await followerService.resolveCategoryStore(category_key, city);
  return success(res, { offers });
});

// ── Follower Addresses ────────────────────────────────────────────────────────

const createAddress = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  if (!follower) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);

  const { label, line1, line2, city, pincode, is_default } = req.body;
  if (!line1) throw new AppError('VALIDATION_ERROR', 'line1 is required', 422, 'line1');

  if (is_default) {
    await db.query(
      `UPDATE follower_addresses SET is_default = false WHERE follower_id = $1`,
      [follower.id]
    );
  }

  const { rows } = await db.query(
    `INSERT INTO follower_addresses (follower_id, label, line1, line2, city, pincode, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [follower.id, label || null, line1, line2 || null, city || null, pincode || null, !!is_default]
  );

  if (is_default) {
    await db.query(
      `UPDATE followers SET default_address_id = $1 WHERE id = $2`,
      [rows[0].id, follower.id]
    );
  }

  return success(res, { address: rows[0] }, 201);
});

const listAddresses = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  if (!follower) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);

  const { rows } = await db.query(
    `SELECT * FROM follower_addresses WHERE follower_id = $1 ORDER BY is_default DESC`,
    [follower.id]
  );

  return success(res, { addresses: rows });
});

const updateAddress = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  if (!follower) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);

  const { id } = req.params;

  const { rows: existing } = await db.query(
    `SELECT * FROM follower_addresses WHERE id = $1 AND follower_id = $2`,
    [id, follower.id]
  );
  if (!existing[0]) throw new AppError('NOT_FOUND', 'Address not found', 404);

  const { label, line1, line2, city, pincode, is_default } = req.body;

  if (is_default) {
    await db.query(
      `UPDATE follower_addresses SET is_default = false WHERE follower_id = $1`,
      [follower.id]
    );
  }

  const { rows } = await db.query(
    `UPDATE follower_addresses SET
       label      = COALESCE($1, label),
       line1      = COALESCE($2, line1),
       line2      = COALESCE($3, line2),
       city       = COALESCE($4, city),
       pincode    = COALESCE($5, pincode),
       is_default = COALESCE($6, is_default)
     WHERE id = $7
     RETURNING *`,
    [label || null, line1 || null, line2 || null, city || null, pincode || null,
      is_default !== undefined ? is_default : null, id]
  );

  if (is_default) {
    await db.query(`UPDATE followers SET default_address_id = $1 WHERE id = $2`, [id, follower.id]);
  }

  return success(res, { address: rows[0] });
});

// ── GET /follower/feed (legacy) ──────────────────────────────────────────────

const getFeed = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  if (!follower) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);

  const feed = await followerService.getFeed(follower.id, follower.user_city);
  return success(res, { feed });
});

// ── GET /follower/home-feed — NEW product-centric deduped feed ───────────────

const getHomeFeed = asyncHandler(async (req, res) => {
  // Public access — follower may not be logged in
  const follower = req.user?.sub ? await getFollowerByUserId(req.user.sub).catch(() => null) : null;
  const city = follower?.user_city || req.query.city || null;
  const followerId = follower?.id || null;

  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);

  const data = await followerService.getHomeFeed(followerId, city, page, limit);
  return success(res, data, 200, { page: data.page, total: data.total, limit: data.limit });
});

// ── GET /follower/deals — NEW category browse ────────────────────────────────

const getDeals = asyncHandler(async (req, res) => {
  // Public access — follower may not be logged in
  const follower = req.user?.sub ? await getFollowerByUserId(req.user.sub).catch(() => null) : null;
  const city = follower?.user_city || req.query.city || null;
  const followerId = follower?.id || null;

  const { category } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);

  const data = await followerService.getDealsByCategory(
    category || 'all', city, followerId, page, limit
  );
  return success(res, data, 200, { page: data.page, total: data.total, limit: data.limit });
});

// ── GET /follower/following — NEW followed influencers with deal counts ──────

const getFollowing = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  if (!follower) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);

  const following = await followerService.getFollowing(follower.id);
  return success(res, { following });
});

// ── GET /store/:handle/products ───────────────────────────────────────────────

const getStoreProducts = asyncHandler(async (req, res) => {
  const { influencer_handle } = req.params;
  const { offer_id, ci_id } = req.query;

  // Either offer_id (set-level campaign_offers row) OR ci_id (per-influencer
  // campaign_influencer row) is REQUIRED. Without either, the old behaviour
  // silently picked the first active CI via LIMIT 1 and returned ALL
  // products from that brand — which leaked unrelated cars onto a restaurant
  // tap. Most conversion-test campaigns today have NO campaign_offers row
  // (offer is defined per-influencer via offer_config_json), so ci_id is the
  // robust identifier; offer_id is accepted for legacy set-level offers.
  if (!offer_id && !ci_id) {
    throw new AppError(
      'VALIDATION_ERROR',
      'offer_id or ci_id is required so we know which brand and product subset to return.',
      422,
      'offer_id'
    );
  }

  const { rows: infRows } = await db.query(
    `SELECT i.id, i.instagram_handle, u.name
     FROM influencers i JOIN users u ON u.id = i.user_id
     WHERE i.instagram_handle = $1`,
    [influencer_handle]
  );
  if (!infRows[0]) throw new AppError('NOT_FOUND', 'Influencer not found', 404);
  const inf = infRows[0];

  // Resolve the scope → brand, campaign, set, discount, and the per-CI
  // offer_config_json for this creator. The per-CI config carries the
  // per-influencer product picks for Discount/Volume/Bundle offers.
  // We support either entry point: ci_id (preferred — always present) or
  // offer_id (legacy — for set-level offers).
  let offerRows;
  if (ci_id) {
    const r = await db.query(
      `SELECT co.id            AS offer_id,
              COALESCE(co.discount_value,
                       NULLIF(ci.offer_config_json->>'value','')::numeric,
                       ci.commission_pct)         AS discount_value,
              co.products_json,
              cs.id            AS set_id,
              c.id             AS campaign_id,
              c.brand_id,
              ci.id            AS campaign_influencer_id,
              ci.offer_config_json
       FROM   campaign_influencers ci
       JOIN   campaign_sets cs ON cs.id = ci.set_id
       JOIN   campaigns c ON c.id = cs.campaign_id
       LEFT   JOIN campaign_offers co
              ON co.set_id = cs.id AND co.is_active = true
       WHERE  ci.id = $1 AND ci.influencer_id = $2`,
      [ci_id, inf.id]
    );
    offerRows = r.rows;
  } else {
    const r = await db.query(
      `SELECT co.id          AS offer_id,
              co.discount_value,
              co.products_json,
              co.set_id,
              c.id           AS campaign_id,
              c.brand_id,
              ci.id          AS campaign_influencer_id,
              ci.offer_config_json
       FROM   campaign_offers co
       JOIN   campaigns c ON c.id = co.campaign_id
       JOIN   campaign_sets cs ON cs.id = co.set_id
       LEFT   JOIN campaign_influencers ci
              ON ci.set_id = cs.id AND ci.influencer_id = $2
       WHERE  co.id = $1`,
      [offer_id, inf.id]
    );
    offerRows = r.rows;
  }
  if (!offerRows[0]) throw new AppError('NOT_FOUND', ci_id ? 'Campaign assignment not found' : 'Offer not found', 404);

  const offer = offerRows[0];
  const brandId = offer.brand_id;
  const campaignId = offer.campaign_id;
  const discountPct = parseFloat(offer.discount_value || 0);

  // Resolution order — same as getCampaignProducts on the influencer side:
  //   1. Per-influencer offer_config (d_prods / v_prods / bnd_prods / products)
  //   2. Set-level campaign_offers.products_json
  //   3. Published influencer_product_notes
  //   4. Full brand catalogue (true brand-level offer)
  const ciCfg = offer.offer_config_json || {};
  let productIds = [];

  function collect(arr) {
    if (!Array.isArray(arr)) return;
    for (const p of arr) {
      const pid = typeof p === 'string' ? p : (p.product_id || p.id);
      if (pid) productIds.push(pid);
    }
  }
  collect(ciCfg.products);
  collect(ciCfg.d_prods);
  collect(ciCfg.v_prods);
  collect(ciCfg.bnd_prods);

  if (productIds.length === 0 && offer.products_json) {
    try {
      const pj = typeof offer.products_json === 'string' ? JSON.parse(offer.products_json) : offer.products_json;
      if (Array.isArray(pj)) {
        for (const p of pj) {
          const pid = typeof p === 'string' ? p : (p.product_id || p.id);
          if (pid) productIds.push(pid);
        }
      }
    } catch {}
  }

  if (productIds.length === 0) {
    const { rows: noteRows } = await db.query(
      `SELECT product_id FROM influencer_product_notes
       WHERE influencer_id = $1 AND campaign_id = $2`,
      [inf.id, campaignId]
    );
    productIds = noteRows.map(n => n.product_id);
  }

  let products;
  if (productIds.length > 0) {
    const { rows } = await db.query(
      `SELECT * FROM brand_products
       WHERE brand_id = $1 AND id = ANY($2) AND is_active = true
       ORDER BY section, name`,
      [brandId, productIds]
    );
    products = rows;
  } else {
    // True brand-level offer (no specific products assigned anywhere)
    const { rows } = await db.query(
      `SELECT * FROM brand_products
       WHERE brand_id = $1 AND is_active = true
       ORDER BY section, name`,
      [brandId]
    );
    products = rows;
  }

  // Get influencer notes for this campaign so we can attach the creator's
  // recommendation to each product card.
  const { rows: noteRows } = await db.query(
    `SELECT product_id, note_text FROM influencer_product_notes
     WHERE influencer_id = $1 AND campaign_id = $2`,
    [inf.id, campaignId]
  );
  const noteMap = {};
  for (const n of noteRows) noteMap[n.product_id] = n.note_text;

  const productsWithDiscount = products.map(p => {
    const price = parseFloat(p.price || 0);
    const discountedPrice = parseFloat((price * (1 - discountPct / 100)).toFixed(2));
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      price,
      discounted_price: discountedPrice,
      image_url: p.image_url,
      is_active: p.is_active,
      section: p.section,
      variants_json: p.variants_json,
      veg_flag: p.veg_flag,
      influencer_note: noteMap[p.id] || null,
    };
  });

  return success(res, { products: productsWithDiscount });
});

// ─────────────────────────────────────────────────────────────────────────────
// Listing Engine — new follower endpoints
// ─────────────────────────────────────────────────────────────────────────────

const listingService = require('../services/listing.service');

// GET /follower/stories — influencers with active deals for story circle row
const getStories = asyncHandler(async (req, res) => {
  // Public access — if not logged in, show top influencers with deals
  const follower = req.user?.sub ? await getFollowerByUserId(req.user.sub).catch(() => null) : null;

  let rows;
  if (follower) {
    // Logged in: show followed influencers
    const result = await db.query(
      `SELECT
         i.id, u.name, i.instagram_handle,
         i.followers_count, i.niche,
         COUNT(DISTINCT ci.id)::int AS active_deal_count,
         MAX(ci.created_at) AS latest_deal_at
       FROM follower_follows ff
       JOIN influencers i ON i.id = ff.influencer_id
       JOIN users u ON u.id = i.user_id
       LEFT JOIN campaign_influencers ci ON ci.influencer_id = i.id
         AND ci.status IN ('contracted', 'active', 'completed')
         AND (ci.offer_type IS NOT NULL)
       LEFT JOIN campaign_sets cs ON cs.id = ci.set_id
       LEFT JOIN campaigns c ON c.id = cs.campaign_id
         AND c.status IN ('published', 'active', 'live')
         AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
       WHERE ff.follower_id = $1
       GROUP BY i.id, u.name, i.instagram_handle, i.followers_count, i.niche
       ORDER BY active_deal_count DESC, u.name ASC`,
      [follower.id]
    );
    rows = result.rows;
  } else {
    // Not logged in: show top influencers with active deals
    const result = await db.query(
      `SELECT
         i.id, u.name, i.instagram_handle,
         i.followers_count, i.niche,
         COUNT(DISTINCT ci.id)::int AS active_deal_count,
         MAX(ci.created_at) AS latest_deal_at
       FROM influencers i
       JOIN users u ON u.id = i.user_id
       JOIN campaign_influencers ci ON ci.influencer_id = i.id
         AND ci.status IN ('contracted', 'active', 'completed')
         AND (ci.offer_type IS NOT NULL)
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c ON c.id = cs.campaign_id
         AND c.status IN ('published', 'active', 'live')
         AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
       GROUP BY i.id, u.name, i.instagram_handle, i.followers_count, i.niche
       ORDER BY active_deal_count DESC, i.followers_count DESC
       LIMIT 10`
    );
    rows = result.rows;
  }

  const stories = rows.map(r => ({
    id: r.id,
    name: r.name,
    handle: r.instagram_handle,
    followers_count: r.followers_count,
    niche: r.niche,
    active_deals: r.active_deal_count,
    latest_deal_at: r.latest_deal_at,
    ring_state: r.active_deal_count > 0
      ? (r.latest_deal_at && new Date(r.latest_deal_at) > new Date(Date.now() - 24 * 60 * 60 * 1000) ? 'pulse' : 'ring')
      : 'grey',
  }));

  return success(res, { stories });
});

// GET /follower/categories — super-categories with deal counts
const getCategories = asyncHandler(async (req, res) => {
  const superCats = listingService.getSuperCategories();

  // Get deal counts per super_category
  const { rows } = await db.query(
    `SELECT b.category, COUNT(DISTINCT co.id)::int AS deal_count
     FROM campaign_offers co
     JOIN campaign_sets cs ON cs.id = co.set_id
     JOIN campaigns c ON c.id = cs.campaign_id
     JOIN brands b ON b.id = c.brand_id
     WHERE co.is_active = true
       AND c.status IN ('published', 'active', 'live')
       AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
     GROUP BY b.category`
  );

  const countMap = {};
  for (const r of rows) {
    const schema = listingService.loadSchema(r.category);
    if (schema?.super_category) {
      countMap[schema.super_category] = (countMap[schema.super_category] || 0) + r.deal_count;
    }
  }

  const result = superCats.map(sc => ({
    ...sc,
    deal_count: countMap[sc.key] || 0,
  }));

  return success(res, { categories: result });
});

// GET /category/:super_category/stores — stores with inline products for CategoryListScreen
const getCategoryStores = asyncHandler(async (req, res) => {
  const { super_category } = req.params;
  const {
    sort, sub_category, page, lat, lng,
    // Wave 1 (Dining) — schema-driven filter params from
    // restaurant.json.buyer_config.filters[]. All optional. Each filter is
    // applied as an additional WHERE clause; SQL parameter ordering builds
    // up dynamically. Vibes / cuisines are jsonb-containment; cost_bucket
    // maps to one of the schema's bucket ranges; open_now is computed in
    // JS after the SQL fetch (depends on per-brand timezone + current
    // wall time which is brittle in SQL); has_offers is implicit in
    // deal_count > 0; creator_trusted is influencer-count >= 3.
    vibes, cuisines, cost_bucket, open_now, has_offers, creator_trusted, veg_only,
  } = req.query;
  const pageNum = parseInt(page || '1', 10);
  const limit = 10;
  const offset = (pageNum - 1) * limit;

  const superCat = listingService.getSuperCategories().find(s => s.key === super_category);
  if (!superCat) throw new AppError('NOT_FOUND', `Unknown super-category: ${super_category}`, 404);

  // Filter by sub_category or all sub_categories
  const categoryKeys = sub_category ? [sub_category] : superCat.sub_categories;
  if (!categoryKeys.length) return success(res, { stores: [], total: 0 });

  // Get brands in these categories with active deals
  const placeholders = categoryKeys.map((_, i) => `$${i + 1}`).join(',');
  const hasLocation = lat && lng;
  const followerLat = hasLocation ? parseFloat(lat) : null;
  const followerLng = hasLocation ? parseFloat(lng) : null;

  // Build dynamic WHERE for new filter params. Append each clause + push
  // its bind param after the fixed categoryKeys list. limit/offset are
  // appended at the very end so their indexes are dynamic.
  const params = [...categoryKeys];
  const extraWhere = [];

  // vibes — multi-select via jsonb containment. ?vibes=rooftop,family
  if (vibes && typeof vibes === 'string') {
    const arr = vibes.split(',').map(v => v.trim()).filter(Boolean);
    if (arr.length > 0) {
      params.push(JSON.stringify(arr));
      extraWhere.push(`b.vibes @> $${params.length}::jsonb`);
    }
  }

  // cuisines — multi-select. Cuisines live in listing_data.cuisines (jsonb)
  // for now; later move to a typed column. ?cuisines=Italian,Mexican
  if (cuisines && typeof cuisines === 'string') {
    const arr = cuisines.split(',').map(v => v.trim()).filter(Boolean);
    if (arr.length > 0) {
      // Containment requires the listing_data.cuisines key to be a JSON array
      params.push(JSON.stringify(arr));
      extraWhere.push(`(b.listing_data->'cuisines') @> $${params.length}::jsonb`);
    }
  }

  // cost_bucket — under_300 / 300_800 / 800_plus per schema buckets
  if (cost_bucket === 'under_300') {
    extraWhere.push(`b.cost_for_two < 300`);
  } else if (cost_bucket === '300_800') {
    extraWhere.push(`b.cost_for_two >= 300 AND b.cost_for_two < 800`);
  } else if (cost_bucket === '800_plus') {
    extraWhere.push(`b.cost_for_two >= 800`);
  }

  // has_offers — restrict to brands with at least one active offer. The
  // deal_count subquery already exists; HAVING is awkward with DISTINCT ON,
  // so we filter via EXISTS instead.
  if (has_offers === 'true' || has_offers === '1') {
    extraWhere.push(`EXISTS (
      SELECT 1 FROM campaign_offers co
      JOIN   campaign_sets cs ON cs.id = co.set_id
      JOIN   campaigns c2 ON c2.id = cs.campaign_id
      WHERE  c2.brand_id = b.id AND co.is_active = true
        AND  c2.status IN ('published','active','live')
        AND  (c2.end_date IS NULL OR c2.end_date >= CURRENT_DATE)
    )`);
  }

  // creator_trusted — brands with 3+ distinct creators on active offers
  if (creator_trusted === 'true' || creator_trusted === '1') {
    extraWhere.push(`(
      SELECT COUNT(DISTINCT ci2.influencer_id)
      FROM   campaign_influencers ci2
      JOIN   campaign_sets cs2 ON cs2.id = ci2.set_id
      JOIN   campaigns c3 ON c3.id = cs2.campaign_id
      WHERE  c3.brand_id = b.id
        AND  ci2.status IN ('contracted','active','completed')
        AND  c3.status IN ('published','active','live')
    ) >= 3`);
  }

  // veg_only — brand has at least one veg-flag product. Lets the dining
  // home filter to pure-veg restaurants or restaurants with veg options.
  if (veg_only === 'true' || veg_only === '1') {
    extraWhere.push(`EXISTS (
      SELECT 1 FROM brand_products bp
      WHERE  bp.brand_id = b.id AND bp.is_active = true AND bp.veg_flag = 'veg'
    )`);
  }

  const whereClause = extraWhere.length > 0
    ? ` AND ${extraWhere.join(' AND ')}`
    : '';

  params.push(limit, offset);
  const limitIdx  = params.length - 1;
  const offsetIdx = params.length;

  const { rows: stores } = await db.query(
    `SELECT DISTINCT ON (b.id)
       b.id, b.business_name, b.category, u.city,
       b.listing_score, b.latitude, b.longitude, b.listing_data,
       b.vibes, b.cost_for_two, b.locality, b.cover_image_url,
       b.lat, b.lng, b.accepts_table_booking, b.pay_at_store_supported,
       b.online_order_supported, b.enquiry_enabled,
       (SELECT COUNT(*)::int FROM campaign_offers co
        JOIN campaign_sets cs ON cs.id = co.set_id
        JOIN campaigns c ON c.id = cs.campaign_id
        WHERE c.brand_id = b.id AND co.is_active = true
          AND c.status IN ('published', 'active', 'live')
          AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
       ) AS deal_count
     FROM brands b
     JOIN users u ON u.id = b.user_id
     WHERE b.category IN (${placeholders})
       AND u.status = 'approved'${whereClause}
     ORDER BY b.id, deal_count DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  // Wave 1 (Dining) — surface listing fields the dining card needs. Prefer
  // typed columns (post migration 051) over listing_data JSONB fallbacks.
  // Other categories also get these — harmless when columns are NULL.
  for (const store of stores) {
    const ld = store.listing_data || {};
    store.cover_image_url          = store.cover_image_url || ld.cover_image_url || null;
    store.cost_for_two             = store.cost_for_two != null
                                       ? Number(store.cost_for_two)
                                       : (ld.cost_for_two != null ? Number(ld.cost_for_two) : null);
    store.locality_or_neighborhood = store.locality || ld.locality_or_neighborhood || ld.locality || null;
    store.vibes                    = Array.isArray(store.vibes) ? store.vibes
                                       : (Array.isArray(ld.vibes) ? ld.vibes : []);
    store.cuisines                 = Array.isArray(ld.cuisines) ? ld.cuisines : [];
    store.open_status              = followerService.computeOpenStatus
      ? followerService.computeOpenStatus(ld.hours_json)
      : null;
    // Prefer typed-column lat/lng (hot fields), fall back to legacy
    // latitude/longitude columns when not populated yet.
    if (store.lat != null) store.latitude  = store.lat;
    if (store.lng != null) store.longitude = store.lng;
    delete store.listing_data; // don't ship the full blob on list endpoints
    delete store.lat; delete store.lng; // de-dupe with latitude/longitude
  }

  // Open-now filter — applied AFTER fetch since the compute depends on
  // current wall time and is brittle in SQL. Drops stores whose hours_json
  // declares them closed right now.
  const filteredStores = (open_now === 'true' || open_now === '1')
    ? stores.filter(s => s.open_status && s.open_status.is_open)
    : stores;

  // Calculate distance for each store
  if (hasLocation) {
    for (const store of filteredStores) {
      if (store.latitude && store.longitude) {
        store.distance_km = locationService.haversineKm(followerLat, followerLng, parseFloat(store.latitude), parseFloat(store.longitude));
        store.distance_text = locationService.formatDistance(store.distance_km);
      }
    }
    // Sort by distance
    filteredStores.sort((a, b) => (a.distance_km || 9999) - (b.distance_km || 9999));
  }

  // For each store, fetch top products + card_config
  const storesWithProducts = await Promise.all(filteredStores.map(async (store) => {
    const { rows: products } = await db.query(
      `SELECT id, name, price, image_url, section, veg_flag, description
       FROM brand_products
       WHERE brand_id = $1 AND is_active = true
       ORDER BY section NULLS LAST, name ASC
       LIMIT 6`,
      [store.id]
    );

    const cardConfig = listingService.getCardConfig(store.category);

    // Fetch active offers for this store. We expose instagram_handle and
    // campaign_influencer_id so the mobile CategoryListScreen can navigate
    // to ProductDetail with full tracking — previously these were missing
    // and the detail screen 500'd with "Missing creator handle".
    const { rows: offers } = await db.query(
      `SELECT co.id AS offer_id, co.offer_type, co.discount_value, co.availing_modes,
              ci.id  AS campaign_influencer_id,
              cs.id  AS set_id,
              c.id   AS campaign_id,
              ci.influencer_id,
              u_inf.name AS influencer_name,
              i.instagram_handle
       FROM campaign_offers co
       JOIN campaign_sets cs ON cs.id = co.set_id
       JOIN campaigns c ON c.id = cs.campaign_id
       JOIN campaign_influencers ci ON ci.set_id = cs.id
         AND ci.status IN ('contracted', 'active', 'completed')
       JOIN influencers i ON i.id = ci.influencer_id
       JOIN users u_inf ON u_inf.id = i.user_id
       WHERE c.brand_id = $1 AND co.is_active = true
         AND c.status IN ('published', 'active', 'live')
         AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
       LIMIT 5`,
      [store.id]
    );

    return {
      ...store,
      card_config: cardConfig,
      products: products.map(p => ({
        ...p,
        price: parseFloat(p.price || 0),   // rupees — brand_products.price is already rupees
      })),
      offers,
    };
  }));

  return success(res, { stores: storesWithProducts, super_category: superCat });
});

module.exports = {
  register,
  getMe,
  followInfluencer,
  unfollowInfluencer,
  getInfluencerStore,
  getBusinessStore,
  getCategoryStore,
  createAddress,
  listAddresses,
  updateAddress,
  getFeed,
  getHomeFeed,
  getDeals,
  getFollowing,
  getStoreProducts,
  getStories,
  getCategories,
  getCategoryStores,
};
