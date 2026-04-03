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

const getInfluencerStore = asyncHandler(async (req, res) => {
  const { influencer_handle } = req.params;
  const { cid, sid, oid, iid } = req.query;

  const storeData = await followerService.resolveStore(influencer_handle);
  if (!storeData) throw new AppError('NOT_FOUND', 'Influencer not found', 404);

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
  const storeData = await followerService.resolveBusinessStore(req.params.brand_id);
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
  const follower = await getFollowerByUserId(req.user.sub);
  if (!follower) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);

  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);

  const data = await followerService.getHomeFeed(follower.id, follower.user_city, page, limit);
  return success(res, data, 200, { page: data.page, total: data.total, limit: data.limit });
});

// ── GET /follower/deals — NEW category browse ────────────────────────────────

const getDeals = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  if (!follower) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);

  const { category } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);

  const data = await followerService.getDealsByCategory(
    category || 'all', follower.user_city, follower.id, page, limit
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
  const { offer_id } = req.query;

  const { rows: infRows } = await db.query(
    `SELECT i.id, i.instagram_handle, u.name
     FROM influencers i JOIN users u ON u.id = i.user_id
     WHERE i.instagram_handle = $1`,
    [influencer_handle]
  );
  if (!infRows[0]) throw new AppError('NOT_FOUND', 'Influencer not found', 404);
  const inf = infRows[0];

  let brandId;
  let discountPct = 0;
  let campaignId = null;

  if (offer_id) {
    const { rows: offerRows } = await db.query(
      `SELECT co.*, c.brand_id, c.id AS campaign_id
       FROM campaign_offers co
       JOIN campaigns c ON c.id = co.campaign_id
       WHERE co.id = $1`,
      [offer_id]
    );
    if (offerRows[0]) {
      brandId = offerRows[0].brand_id;
      campaignId = offerRows[0].campaign_id;
      discountPct = parseFloat(offerRows[0].discount_value || 0);
    }
  }

  if (!brandId) {
    const { rows: ciRows } = await db.query(
      `SELECT c.brand_id, c.id AS campaign_id FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c ON c.id = cs.campaign_id
       WHERE ci.influencer_id = $1 AND ci.status IN ('contracted','active')
       LIMIT 1`,
      [inf.id]
    );
    if (!ciRows[0]) throw new AppError('NOT_FOUND', 'No active campaign found', 404);
    brandId = ciRows[0].brand_id;
    campaignId = ciRows[0].campaign_id;
  }

  const { rows: products } = await db.query(
    `SELECT * FROM brand_products WHERE brand_id = $1 AND is_active = true ORDER BY section, name`,
    [brandId]
  );

  // Get influencer notes for this campaign
  const { rows: noteRows } = await db.query(
    `SELECT product_id, note_text FROM influencer_product_notes
     WHERE influencer_id = $1 AND campaign_id = $2`,
    [inf.id, campaignId]
  );
  const noteMap = {};
  for (const n of noteRows) noteMap[n.product_id] = n.note_text;

  const productsWithDiscount = products.map(p => {
    const pricePaise = Math.round(parseFloat(p.price || 0) * 100);
    const discountedPrice = Math.floor(pricePaise * (1 - discountPct / 100));
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      price: pricePaise,
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
};
