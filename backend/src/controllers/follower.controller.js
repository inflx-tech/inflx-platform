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
const sectionEngine = require('../services/sectionEngine.service');
const sectionLibrary = require('../services/sectionLibrary.service');
const { runRule, etaFromDistanceKm, OFFER_BEST_PCT, offerFieldsFromPct, OFFER_LIVE_GATE, OFFER_APPLIES } = require('../services/sectionRules.service');
const categoryTaxonomy = require('../services/categoryTaxonomy.service');
const brandOffersAdapter = require('../services/brandOffers.adapter');
// retire-google (20 Sep 2026): a coordinate becomes a city by nearest offered city centre.
const ref = require('../services/referenceLists.service');
const paymentConfigSvc = require('../services/paymentConfig.service');

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
    `SELECT * FROM follower_addresses
      WHERE follower_id = $1 AND deleted_at IS NULL
      ORDER BY is_default DESC`,
    [follower.id]
  );

  return success(res, { follower, addresses });
});

// ── POST /follower/touch ──────────────────────────────────────────────────────
// Attribution "touch": a logged-in follower tapped an influencer's link or entered
// their store. Opens/refreshes the 30-day brand-scoped attribution window for
// (this follower, this influencer, this brand) — the "click-opens-window" path for
// known app users (anonymous web clicks still fall back to purchase-opens).
// Body: { brand_id, influencer_id? , handle? }. Refreshes an active window if one
// exists, else inserts one.
const recordTouch = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  if (!follower) throw new AppError('NOT_FOUND', 'Follower profile not found. Please register first.', 404);

  let { influencer_id, handle, brand_id, campaign_id, campaign_influencer_id } = req.body || {};
  // Way-4 "click-opens-window" — a deep link carries the 4 IDs (cid/iid). Resolve
  // the influencer + brand from the campaign chain so a click (not just a
  // purchase) opens the window for that campaign's brand.
  if (campaign_influencer_id && (!brand_id || !influencer_id)) {
    const { rows } = await db.query(
      `SELECT ci.influencer_id, c.brand_id
         FROM campaign_influencers ci
         JOIN campaign_sets cs ON cs.id = ci.set_id
         JOIN campaigns c ON c.id = cs.campaign_id
        WHERE ci.id = $1`, [campaign_influencer_id]
    );
    if (rows[0]) { influencer_id = influencer_id || rows[0].influencer_id; brand_id = brand_id || rows[0].brand_id; }
  }
  if (!brand_id && campaign_id) {
    const { rows } = await db.query(`SELECT brand_id FROM campaigns WHERE id = $1`, [campaign_id]);
    brand_id = rows[0]?.brand_id || null;
  }
  if (!influencer_id && handle) {
    const { rows } = await db.query(
      `SELECT id FROM influencers WHERE LOWER(instagram_handle) = LOWER($1) LIMIT 1`, [handle]
    );
    influencer_id = rows[0]?.id || null;
  }
  if (!brand_id) throw new AppError('VALIDATION_ERROR', 'brand_id (or campaign_id / campaign_influencer_id) is required', 422, 'brand_id');
  if (!influencer_id) throw new AppError('VALIDATION_ERROR', 'influencer_id, handle, or campaign_influencer_id is required', 422, 'influencer_id');

  // Way-4 — admin-configurable window length (migration 120); falls back to 30.
  let awDays = 30;
  try { const n = parseInt((await paymentConfigSvc.getConfig()).attributionWindowDays, 10); if (Number.isFinite(n) && n > 0) awDays = n; } catch (_) { /* default 30 */ }

  const upd = await db.query(
    `UPDATE attribution_clicks SET expires_at = now() + make_interval(days => $4)
      WHERE follower_id = $1 AND influencer_id = $2 AND brand_id = $3 AND expires_at > now()`,
    [follower.id, influencer_id, brand_id, awDays]
  );
  if (upd.rowCount === 0) {
    await db.query(
      `INSERT INTO attribution_clicks (follower_id, influencer_id, brand_id, expires_at)
       VALUES ($1, $2, $3, now() + make_interval(days => $4))`,
      [follower.id, influencer_id, brand_id, awDays]
    );
  }
  return success(res, { touched: true });
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

  const { label, line1, line2, city, pincode, is_default,
          receiver_name, receiver_phone, landmark } = req.body;
  if (!line1) throw new AppError('VALIDATION_ERROR', 'line1 is required', 422, 'line1');

  if (is_default) {
    await db.query(
      `UPDATE follower_addresses SET is_default = false WHERE follower_id = $1`,
      [follower.id]
    );
  }

  // retire-google: prefer client-sent coords ("use current location"); otherwise the typed
  // city's centre from our own list. No Google. An address with neither is refused.
  let lat = Number.isFinite(parseFloat(req.body.lat)) ? parseFloat(req.body.lat) : null;
  let lng = Number.isFinite(parseFloat(req.body.lng)) ? parseFloat(req.body.lng) : null;
  if (lat == null || lng == null) {
    const centre = await ref.cityCentreForName(city);
    if (centre) { lat = centre.lat; lng = centre.lng; }
  }
  if (lat == null || lng == null) {
    throw new AppError('VALIDATION_ERROR',
      "We couldn't place that address. Pick your city from the list, or use 'Current location'.",
      422, 'city');
  }

  const { rows } = await db.query(
    `INSERT INTO follower_addresses
       (follower_id, label, line1, line2, city, pincode, is_default, lat, lng,
        receiver_name, receiver_phone, landmark)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [follower.id, label || null, line1, line2 || null, city || null, pincode || null, !!is_default, lat, lng,
     receiver_name || null, receiver_phone || null, landmark || null]
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
    `SELECT * FROM follower_addresses
      WHERE follower_id = $1 AND deleted_at IS NULL
      ORDER BY is_default DESC`,
    [follower.id]
  );

  return success(res, { addresses: rows });
});

const updateAddress = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  if (!follower) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);

  const { id } = req.params;

  const { rows: existing } = await db.query(
    `SELECT * FROM follower_addresses
      WHERE id = $1 AND follower_id = $2 AND deleted_at IS NULL`,
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

// ── DELETE /followers/addresses/:id (Slice 1) ────────────────────────────────
// SOFT delete. follower_orders.address_id references this table with no ON
// DELETE clause, so a hard delete would either fail on the FK or destroy the
// shipping address of a past order. Order history must keep resolving where it
// actually shipped; the follower just stops seeing the address.
const deleteAddress = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  if (!follower) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);

  const { id } = req.params;

  // Already-deleted reads as not-found: deleting twice is idempotent from the
  // caller's point of view, and we never confirm the existence of a row that
  // isn't theirs.
  const { rows: existing } = await db.query(
    `SELECT id, is_default FROM follower_addresses
      WHERE id = $1 AND follower_id = $2 AND deleted_at IS NULL`,
    [id, follower.id]
  );
  if (!existing[0]) throw new AppError('NOT_FOUND', 'Address not found', 404);

  await db.query(
    `UPDATE follower_addresses SET deleted_at = now(), is_default = false WHERE id = $1`,
    [id]
  );

  // Never leave the follower pointing at a deleted default — checkout reads it.
  const { rows: promoted } = await db.query(
    `SELECT id FROM follower_addresses
      WHERE follower_id = $1 AND deleted_at IS NULL
      ORDER BY is_default DESC, id
      LIMIT 1`,
    [follower.id]
  );
  const nextDefault = promoted[0]?.id || null;
  if (nextDefault) {
    await db.query(`UPDATE follower_addresses SET is_default = true WHERE id = $1`, [nextDefault]);
  }
  await db.query(
    `UPDATE followers SET default_address_id = $1 WHERE id = $2`,
    [nextDefault, follower.id]
  );

  return success(res, { deleted: true, default_address_id: nextDefault });
});

// ── PATCH /followers/me (Slice 1) ────────────────────────────────────────────
// Followers were the only role without this — brand, influencer and agency all
// have PATCH /me, and the mobile client has been calling a route that did not
// exist. The editable fields live on `users` (the followers table holds only
// id / user_id / default_address_id). Phone is the login identity: never here.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const updateMe = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  if (!follower) throw new AppError('NOT_FOUND', 'Follower profile not found', 404);

  const hasName  = Object.prototype.hasOwnProperty.call(req.body || {}, 'name');
  const hasEmail = Object.prototype.hasOwnProperty.call(req.body || {}, 'email');
  if (!hasName && !hasEmail) {
    throw new AppError('VALIDATION_ERROR', 'Nothing to update', 422);
  }

  let name = null;
  if (hasName) {
    name = String(req.body.name ?? '').trim();
    if (name.length < 2 || name.length > 100) {
      throw new AppError('VALIDATION_ERROR', 'Name must be 2-100 characters', 422, 'name');
    }
  }

  // Explicit null/'' clears the email; anything else must be a valid address.
  let email = null;
  let clearEmail = false;
  if (hasEmail) {
    const raw = req.body.email;
    if (raw === null || String(raw).trim() === '') {
      clearEmail = true;
    } else {
      email = String(raw).trim().toLowerCase();
      if (!EMAIL_RE.test(email) || email.length > 200) {
        throw new AppError('VALIDATION_ERROR', 'Enter a valid email address', 422, 'email');
      }
    }
  }

  let rows;
  try {
    ({ rows } = await db.query(
      `UPDATE users SET
         name       = COALESCE($1, name),
         email      = CASE WHEN $3::boolean THEN NULL ELSE COALESCE($2, email) END,
         updated_at = now()
       WHERE id = $4
       RETURNING id, name, email, phone, city, state`,
      [name, email, clearEmail, req.user.sub]
    ));
  } catch (e) {
    // users.email is UNIQUE — surface it as a field error, never a raw 500.
    if (e.code === '23505') {
      throw new AppError('VALIDATION_ERROR', 'That email is already in use', 422, 'email');
    }
    throw e;
  }

  return success(res, { follower: { ...follower, ...rows[0], id: follower.id, user_id: req.user.sub } });
});

// ── GET /follower/feed (legacy) ──────────────────────────────────────────────

const getFeed = asyncHandler(async (req, res) => {
  // Public access — a follower may browse without signing in (sign-in is
  // only required to complete a purchase, not to browse). Signed-in →
  // personalised (their follows + their city); anonymous → location-based
  // (client-supplied ?city). Mirrors the getHomeFeed anonymous pattern.
  const follower = req.user?.sub
    ? await getFollowerByUserId(req.user.sub).catch(() => null)
    : null;
  const city = follower?.user_city || req.query.city || null;

  const feed = await followerService.getFeed(follower?.id || null, city);
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

// ── GET /follower/store-offer/:id ─────────────────────────────────────────────
// Detail fetch for a LIBRARY offer tapped from a feed shelf (store-direct or
// engagement showcase). These have no campaign_offers row and may have no
// creator handle, so /store/:handle/products cannot serve them (contract:
// features/sprint1-offer-pipeline). Pairs with POST /follower/store-offer/pay.
const getStoreOfferDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await db.query(
    `SELECT bo.id, bo.name, bo.offer_type::text AS offer_type, bo.offer_config_json,
            bo.availing_modes, bo.store_ends_at,
            b.id AS brand_id, b.business_name AS brand_name, b.category AS brand_category,
            b.locality AS brand_locality, u_b.city AS brand_city,
            NULL::uuid AS influencer_id, NULL::text AS handle,
            NULL::text AS influencer_name, NULL::text AS profile_pic_url
     FROM brand_offers bo
     JOIN brands b ON b.id = bo.brand_id
     JOIN users u_b ON u_b.id = b.user_id
     WHERE bo.id = $1 AND bo.status = 'active'`,
    [id]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Offer not found or no longer active', 404);
  const row = rows[0];
  const offer = brandOffersAdapter.toFeedItem(
    brandOffersAdapter.normalizeLibraryOffer(row, 'store')
  );

  // Products: explicit refs from the offer config when present, else the
  // brand's active products (category-scoped when the config says so).
  const cfg = row.offer_config_json && typeof row.offer_config_json === 'object' ? row.offer_config_json : {};
  const refIds = [];
  const pushRef = (p) => {
    const pid = p && (typeof p === 'string' ? p : (p.id || p.product_id));
    if (pid) refIds.push(pid);
  };
  (Array.isArray(cfg.products) ? cfg.products : []).forEach(pushRef);
  pushRef(cfg.buy_product);
  pushRef(cfg.get_product);
  (Array.isArray(cfg.offers) ? cfg.offers : []).forEach(o => { pushRef(o && o.main); pushRef(o && o.gift); });

  let products;
  if (refIds.length) {
    const r = await db.query(
      `SELECT id, name, price, image_url, description, section, variants_json
       FROM brand_products
       WHERE id = ANY($1) AND brand_id = $2 AND is_active = true`,
      [[...new Set(refIds)], row.brand_id]
    );
    products = r.rows;
  } else {
    const params = [row.brand_id];
    let catSql = '';
    if (cfg.scope === 'category' && cfg.category_node_id) {
      params.push(cfg.category_node_id);
      catSql = ` AND category_node_id IN (
        WITH RECURSIVE sub AS (
          SELECT id FROM category_nodes WHERE id = $2
          UNION ALL
          SELECT cn.id FROM category_nodes cn JOIN sub ON cn.parent_id = sub.id
        ) SELECT id FROM sub)`;
    } else if (cfg.scope === 'category' && cfg.category) {
      params.push(cfg.category);
      catSql = ' AND section = $2';
    }
    const r = await db.query(
      `SELECT id, name, price, image_url, description, section, variants_json
       FROM brand_products
       WHERE brand_id = $1 AND is_active = true${catSql}
       ORDER BY created_at DESC
       LIMIT 12`,
      params
    );
    products = r.rows;
  }

  return success(res, {
    offer,
    brand: { id: row.brand_id, name: row.brand_name, category: row.brand_category, city: row.brand_city, locality: row.brand_locality },
    products,
  });
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
              -- collab-part1-corrections §1.2 — ci.commission_pct used to be the
              -- last COALESCE leg. Worse here than on the storefront: the value
              -- lands in discountPct below and is applied as a real percentage
              -- off, so a 10% commission became a 10% customer discount the
              -- brand never agreed to fund. Commission is not a discount.
              COALESCE(co.discount_value,
                       NULLIF(ci.offer_config_json->>'value','')::numeric)
                                                 AS discount_value,
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
         -- collab-part4 §4.2 — an allocation is enough; an offer is not required.
         -- offer_type stays for legacy rows with no allocation yet (transitional).
         AND (ci.alloc_scope IS NOT NULL OR ci.offer_type IS NOT NULL)
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
         -- collab-part4 §4.2 — an allocation is enough; an offer is not required.
         -- offer_type stays for legacy rows with no allocation yet (transitional).
         AND (ci.alloc_scope IS NOT NULL OR ci.offer_type IS NOT NULL)
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
  const superCats = await listingService.getSuperCategories();

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

  // Resolve legacy tile keys (eat/shop/...) to the active launch-tile keys so a
  // not-yet-updated app request still finds its tile instead of 404ing (2.5a transition).
  const resolvedKey = categoryTaxonomy.resolveTileKey(super_category);
  const tiles = await listingService.getSuperCategories();
  const superCat = tiles.find(s => s.key === resolvedKey) || tiles.find(s => s.key === super_category);
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

  // Wave 5 — attach aggregate ratings in one batch query so cards show a
  // real score (or null → "New" badge) instead of a hardcoded placeholder.
  const ratingMap = await followerService.getBrandRatings(
    storesWithProducts.map(s => s.id)
  );
  const storesRated = storesWithProducts.map(s => {
    const rt = ratingMap[s.id] || { avg_rating: null, review_count: 0 };
    return { ...s, avg_rating: rt.avg_rating, review_count: rt.review_count };
  });

  return success(res, { stores: storesRated, super_category: superCat });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /follower/creators-eating-now
// Wave 5C — recent creator-attributed restaurant activity. Powers the
// DiningHome "Creators eating now" strip (the live social-proof loop that
// Swiggy structurally cannot replicate). Window is 48h so the strip stays
// populated in a low-traffic pilot; tighten to 6-12h once volume is real.
// ─────────────────────────────────────────────────────────────────────────────

const creatorsEatingNow = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT DISTINCT ON (i.id, b.id)
        i.id                AS influencer_id,
        i.instagram_handle,
        i.profile_image_url AS profile_pic_url,
        ui.name             AS influencer_name,
        b.id                AS brand_id,
        b.business_name,
        b.cover_image_url,
        b.listing_data,
        ft.created_at,
        ci.id               AS campaign_influencer_id,
        cs.id               AS set_id,
        c.id                AS campaign_id
       FROM follower_transactions ft
       JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c      ON c.id  = cs.campaign_id
       JOIN influencers i    ON i.id  = ci.influencer_id
       JOIN users ui         ON ui.id = i.user_id
       JOIN brands b         ON b.id  = ft.brand_id
      WHERE b.category = 'restaurant'
        AND ft.created_at >= now() - interval '48 hours'
        AND ft.status IN ('completed', 'initiated')
      ORDER BY i.id, b.id, ft.created_at DESC
      LIMIT 30`
  );

  const now = Date.now();
  const items = rows
    .map(r => {
      const ld = r.listing_data || {};
      const mins = Math.max(1, Math.round((now - new Date(r.created_at).getTime()) / 60000));
      return {
        influencer_id:   r.influencer_id,
        instagram_handle: r.instagram_handle,
        influencer_name: r.influencer_name,
        profile_pic_url: r.profile_pic_url || null,
        brand_id:        r.brand_id,
        business_name:   r.business_name,
        cover_image_url: r.cover_image_url || ld.cover_image_url || null,
        minutes_ago:     mins,
        when_text:       mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)}h ago`,
        tracking: {
          campaign_id:            r.campaign_id,
          set_id:                 r.set_id,
          campaign_influencer_id: r.campaign_influencer_id,
          influencer_id:          r.influencer_id,
          influencer_handle:      r.instagram_handle,
          influencer_name:        r.influencer_name,
        },
      };
    })
    .sort((a, b) => a.minutes_ago - b.minutes_ago)
    .slice(0, 12);

  return success(res, { creators_eating_now: items });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /follower/search?q=&super=eat&veg=1
// Path C-3 — real search across brands + dishes within a super-category.
// Powers the working search screen (replaces the decorative bars).
// ─────────────────────────────────────────────────────────────────────────────

const search = asyncHandler(async (req, res) => {
  const { q, super: superKey = 'eat', veg } = req.query;
  const term = (q || '').trim();
  if (term.length < 2) {
    return success(res, { brands: [], dishes: [] });
  }

  const superCat = (await listingService.getSuperCategories()).find(s => s.key === superKey);
  const categoryKeys = superCat ? superCat.sub_categories : ['restaurant'];
  if (!categoryKeys.length) return success(res, { brands: [], dishes: [] });

  const like = `%${term.replace(/[%_]/g, m => '\\' + m)}%`;
  const vegOnly = veg === '1' || veg === 'true';

  // Brands — name / cuisines / vibes match, approved, in-category.
  const { rows: brands } = await db.query(
    `SELECT DISTINCT b.id, b.business_name, b.category, b.cover_image_url,
            b.cost_for_two, b.locality, b.listing_data, u.city
       FROM brands b
       JOIN users u ON u.id = b.user_id
      WHERE u.status = 'approved'
        AND b.category = ANY($1::text[])
        AND (
          b.business_name ILIKE $2
          OR (b.listing_data->'cuisines')::text ILIKE $2
          OR b.vibes::text ILIKE $2
        )
        ${vegOnly ? `AND EXISTS (SELECT 1 FROM brand_products bp
                       WHERE bp.brand_id = b.id AND bp.is_active = true
                         AND bp.veg_flag = 'veg')` : ''}
      LIMIT 20`,
    [categoryKeys, like]
  );

  // Dishes — product name match within approved in-category brands.
  const { rows: dishes } = await db.query(
    `SELECT bp.id, bp.name, bp.price, bp.image_url, bp.section, bp.veg_flag,
            b.id AS brand_id, b.business_name, b.category
       FROM brand_products bp
       JOIN brands b ON b.id = bp.brand_id
       JOIN users u  ON u.id = b.user_id
      WHERE u.status = 'approved'
        AND b.category = ANY($1::text[])
        AND bp.is_active = true
        AND bp.name ILIKE $2
        ${vegOnly ? `AND bp.veg_flag = 'veg'` : ''}
      ORDER BY bp.name
      LIMIT 25`,
    [categoryKeys, like]
  );

  const brandsOut = brands.map(b => {
    const ld = b.listing_data || {};
    return {
      id: b.id,
      business_name: b.business_name,
      category: b.category,
      cover_image_url: b.cover_image_url || ld.cover_image_url || null,
      cuisines: Array.isArray(ld.cuisines) ? ld.cuisines : [],
      cost_for_two: b.cost_for_two != null ? Number(b.cost_for_two) : (ld.cost_for_two || null),
      locality: b.locality || ld.locality_or_neighborhood || b.city || null,
    };
  });
  const dishesOut = dishes.map(d => ({
    id: d.id,
    name: d.name,
    price: Number(d.price || 0),
    image_url: d.image_url,
    section: d.section,
    veg_flag: d.veg_flag,
    brand_id: d.brand_id,
    business_name: d.business_name,
  }));

  return success(res, { brands: brandsOut, dishes: dishesOut });
});

// ── Section Engine feeds (Creator Vibe, Phase A) ─────────────────────────────
// Public (authenticateOptional): a follower JWT adds city + follow-graph
// personalization; anonymous callers pass ?city=. Every actionable item carries
// its 4-ID tracking block. Contract: features/follower-section-engine/.

async function resolveFollowerContext(req) {
  const follower = req.user?.sub
    ? await getFollowerByUserId(req.user.sub).catch(() => null)
    : null;
  // Coordinates for distance ranking: prefer the request (device/selected area
  // passed as ?lat&lng), else the follower's stored last known location.
  const qLat = parseFloat(req.query.lat);
  const qLng = parseFloat(req.query.lng);
  const lat = Number.isFinite(qLat) ? qLat : (follower?.last_lat != null ? Number(follower.last_lat) : null);
  const lng = Number.isFinite(qLng) ? qLng : (follower?.last_lng != null ? Number(follower.last_lng) : null);
  return {
    followerId: follower?.id || null,
    city: follower?.user_city || req.query.city || null,
    lat, lng,
  };
}

// POST /v1/follower/location  { lat, lng } — store device/selected location +
// reverse-geocode the area name (throttled: skip the geocode when the follower
// hasn't moved much and the area name is still fresh). Returns { area_name }.
const updateLocation = asyncHandler(async (req, res) => {
  const follower = await getFollowerByUserId(req.user.sub);
  if (!follower) throw new AppError('NOT_FOUND', 'follower not found', 404);
  const lat = parseFloat(req.body.lat);
  const lng = parseFloat(req.body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new AppError('VALIDATION_ERROR', 'valid lat/lng required', 422, 'lat');
  }

  // Throttle: reuse the stored area name unless we moved > ~400 m or it's stale.
  let areaName = follower.area_name || null;
  const movedFar = follower.last_lat == null || follower.last_lng == null ||
    Math.abs(Number(follower.last_lat) - lat) > 0.004 || Math.abs(Number(follower.last_lng) - lng) > 0.004;
  const stale = !follower.location_updated_at ||
    (Date.now() - new Date(follower.location_updated_at).getTime()) > 24 * 60 * 60 * 1000;
  if (!areaName || movedFar || stale) {
    const near = await ref.nearestCity(lat, lng);
    if (near) areaName = near.name;
  }

  await db.query(
    `UPDATE followers SET last_lat=$2, last_lng=$3, area_name=$4, location_updated_at=now() WHERE id=$1`,
    [follower.id, lat, lng, areaName]
  );
  return success(res, { area_name: areaName, lat, lng });
});

// GET /v1/follower/reverse-geocode?lat&lng → { area_name, city, city_id } (public; the follower
// app's "current location" label). retire-google: the nearest offered city, from our own
// coordinates (migration 190) — no Google. Null when the point is far from every offered city.
const reverseGeocode = asyncHandler(async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new AppError('VALIDATION_ERROR', 'lat/lng required', 422, 'lat');
  }
  const near = await ref.nearestCity(lat, lng);
  return success(res, { area_name: near ? near.name : null, city: near ? near.name : null, city_id: near ? near.id : null, state: near ? near.stateName : null, km: near ? near.km : null });
});

// GET /v1/follower/home
const getHomeSections = asyncHandler(async (req, res) => {
  const { followerId, city, lat, lng } = await resolveFollowerContext(req);
  const data = await sectionEngine.buildSections({ screen: 'home', city, followerId, lat, lng });
  // Area name for the Home header — the nearest offered city (retire-google).
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const near = await ref.nearestCity(lat, lng);
    data.area_name = near ? near.name : null;
  }
  return success(res, data);
});

// GET /v1/follower/section/category/:key
const getCategorySections = asyncHandler(async (req, res) => {
  const { followerId, city, lat, lng } = await resolveFollowerContext(req);
  const key = req.params.key;
  const data = await sectionEngine.buildSections({
    screen: 'category', scopeType: 'vertical', scopeValue: key,
    categoryKey: key, city, followerId, lat, lng,
  });
  return success(res, data);
});

// GET /v1/follower/business/:brand_id/sections
// App Builder Phase 4 — the business page as an admin-composed section stack.
// Resolves the brand's WORLD (category → tile key) and renders the 'business'
// scope for that vertical with brandId in context (so creator/offers sections
// auto-scope to this brand). The Menu section is a vertical-specific marker the
// mobile screen renders from its own store payload.
const getBusinessSections = asyncHandler(async (req, res) => {
  const { followerId, city, lat, lng } = await resolveFollowerContext(req);
  const brandId = req.params.brand_id;
  const { rows } = await db.query(`SELECT category FROM brands WHERE id = $1`, [brandId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Business not found', 404, 'brand_id');
  const tile = await categoryTaxonomy.tileForBusinessType(rows[0].category);
  const worldKey = tile?.key || null;
  const data = await sectionEngine.buildSections({
    screen: 'business', scopeType: 'vertical', scopeValue: worldKey,
    categoryKey: worldKey, brandId, city, followerId, lat, lng,
  });
  return success(res, data);
});

// GET /v1/follower/section/offers
const getOffersSections = asyncHandler(async (req, res) => {
  const { followerId, city, lat, lng } = await resolveFollowerContext(req);
  const data = await sectionEngine.buildSections({ screen: 'offers', city, followerId, lat, lng });
  return success(res, data);
});

// GET /v1/follower/section/creator/:handle
const getCreatorSections = asyncHandler(async (req, res) => {
  const { followerId, city } = await resolveFollowerContext(req);
  const influencer = await sectionEngine.resolveInfluencerByHandle(req.params.handle);
  if (!influencer) throw new AppError('NOT_FOUND', 'Creator not found', 404);
  const data = await sectionEngine.buildSections({
    screen: 'creator_store', city, followerId, influencer,
  });
  return success(res, data);
});

// GET /v1/follower/section/creator/:handle/category/:cat
const getCreatorCategorySections = asyncHandler(async (req, res) => {
  const { followerId, city } = await resolveFollowerContext(req);
  const influencer = await sectionEngine.resolveInfluencerByHandle(req.params.handle);
  if (!influencer) throw new AppError('NOT_FOUND', 'Creator not found', 404);
  const data = await sectionEngine.buildSections({
    screen: 'creator_category', city, followerId, influencer,
    categoryKey: req.params.cat,
  });
  return success(res, data);
});

// GET /v1/follower/page/:key/sections
// App Builder — an admin-created GLOBAL custom page as an admin-composed section
// stack (the 3rd tap-destination ③). Resolves the page registry row by key
// (title/subtitle + enabled gate), then renders its stack via the same engine.
// Disabled / unknown key → { page:null, sections:[] } (200, never 500) so a stale
// tap_destination reference degrades to a friendly empty state on mobile.
const getPageSections = asyncHandler(async (req, res) => {
  const { followerId, city, lat, lng } = await resolveFollowerContext(req);
  const key = req.params.key;
  const { rows } = await db.query(
    `SELECT key, label, title, subtitle FROM follower_pages WHERE key = $1 AND enabled = true`,
    [key]
  );
  if (!rows[0]) return success(res, { page: null, sections: [] });
  const data = await sectionEngine.buildSections({
    screen: 'page', scopeType: 'vertical', scopeValue: key,
    categoryKey: key, city, followerId, lat, lng,
  });
  return success(res, { page: rows[0], sections: data.sections });
});

// GET /v1/follower/products/:product_id — full single-product detail for the PDP.
// A shelf/Results tap passes only the card fields (id/name/price/image); this returns
// the listing detail the brand entered: description, facets (schema attributes),
// variants_json (cover_images + per-colour images + sizes), section, tags, return policy.
const getProductDetail = asyncHandler(async (req, res) => {
  const { product_id } = req.params;
  const { rows } = await db.query(
    `SELECT bp.id, bp.name, bp.price, bp.image_url, bp.description, bp.section,
            bp.variants_json, bp.facets, bp.tags, bp.category_node_id,
            bp.return_policy_days, bp.veg_flag, bp.stock, bp.badge,
            ${OFFER_BEST_PCT} AS offer_pct
       FROM brand_products bp
      WHERE bp.id = $1 AND bp.is_active = true`,
    [product_id]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Product not found', 404);
  const { offer_pct, ...rest } = rows[0];

  // Concept P3 — the PDP finally carries offer truth itself (previously the
  // discount only arrived via whatever card the follower tapped through):
  // struck-price fields from the best live discount + the full list of live
  // offers that APPLY to this product (all 5 types), same gate the cards use.
  const offerFields = offerFieldsFromPct(offer_pct, rest.price != null ? Number(rest.price) : null);
  const { rows: offerRows } = await db.query(
    `SELECT bo.id, bo.name, bo.offer_type::text AS offer_type,
            bo.offer_config_json, bo.availing_modes, bo.store_ends_at
       FROM brand_offers bo
       JOIN brand_products bp ON bp.id = $1
      WHERE ${OFFER_LIVE_GATE} AND ${OFFER_APPLIES}
      ORDER BY bo.created_at DESC`,
    [product_id]
  );
  const offers = offerRows.map(o => ({
    id: o.id,
    name: o.name,
    offer_type: o.offer_type,
    sub_type: o.offer_config_json?.sub_type || null,
    value: o.offer_config_json?.value != null ? Number(o.offer_config_json.value) : null,
    availing_modes: o.availing_modes || [],
    store_ends_at: o.store_ends_at,
  }));
  const product = { ...rest, ...offerFields, offers };

  // Food World P1 — nested customisation groups for the ＋ popup + dish-detail
  // popup. ONE model: variation groups (single/is_variation, set base price) +
  // add-on groups (multi, +delta). Empty array for non-food / uncustomised dishes.
  const { rows: groupRows } = await db.query(
    `SELECT id, name, selection_type, is_variation, is_required,
            min_select, max_select, sort_order
       FROM product_addon_groups
      WHERE product_id = $1
      ORDER BY sort_order, name`,
    [product_id]
  );
  let addonGroups = [];
  if (groupRows.length) {
    const groupIds = groupRows.map(g => g.id);
    const { rows: itemRows } = await db.query(
      `SELECT id, group_id, name, price, is_default, sort_order
         FROM product_addon_items
        WHERE group_id = ANY($1::uuid[]) AND is_active = true
        ORDER BY sort_order, name`,
      [groupIds]
    );
    const itemsByGroup = {};
    for (const it of itemRows) {
      (itemsByGroup[it.group_id] = itemsByGroup[it.group_id] || []).push({
        id: it.id,
        name: it.name,
        price: parseFloat(it.price || 0),
        is_default: it.is_default === true,
        sort_order: it.sort_order,
      });
    }
    addonGroups = groupRows.map(g => ({
      id: g.id,
      name: g.name,
      selection_type: g.selection_type,
      is_variation: g.is_variation === true,
      is_required: g.is_required === true,
      min_select: g.min_select,
      max_select: g.max_select,
      sort_order: g.sort_order,
      items: itemsByGroup[g.id] || [],
    }));
  }

  return success(res, { product: { ...product, addon_groups: addonGroups } });
});

// GET /v1/follower/section-results — the shared "View all" full list for one shelf's rule.
// Re-runs the shelf's rule with the SAME surface context (creator/category/brand/city) but a
// larger limit. Generic: the app passes the shelf's rule + config + its context. v1 = capped
// list (no offset pagination — the rules have no OFFSET). Also the Phase-6 banner-gateway target.
const getSectionResults = asyncHandler(async (req, res) => {
  const { followerId, city, lat, lng } = await resolveFollowerContext(req);
  const { rule, library_section_id, category_key, creator_handle, brand_id } = req.query;
  if (!rule) throw new AppError('VALIDATION_ERROR', 'rule is required', 422, 'rule');

  const limit = Math.min(parseInt(req.query.limit, 10) || 60, 100);
  const influencer = creator_handle
    ? await sectionEngine.resolveInfluencerByHandle(creator_handle)
    : null;

  // library/collection-member shelves carry their rule definition + business in the
  // library section. The section's OWN business_type scopes results when the surface
  // passed no category (e.g. a section/banner/tile placed on Home) — mirrors
  // sectionEngine.buildSections so "Under ₹1999" / "On Sale Now" stay fashion-only
  // instead of leaking every industry.
  let ruleDef = null;
  let sectionBusinessType = null;
  if (library_section_id) {
    const lib = await sectionLibrary.getRuleJson(library_section_id);
    ruleDef = lib ? lib.rule : {};
    sectionBusinessType = (lib && lib.business_type && lib.business_type !== 'ALL') ? lib.business_type : null;
  }

  // Inline rule (App Builder Frame banner) — the banner carries its OWN rule_json
  // (any of: price_min/max, min_discount_pct, brand, subcategory_node_id, tags,
  // has_offer) + business_type (the world it was placed in), instead of wiring to
  // a saved library section. Generic conditions; none mandatory.
  if (!ruleDef && req.query.rule_json) {
    try {
      const parsed = JSON.parse(req.query.rule_json);
      if (parsed && typeof parsed === 'object') {
        ruleDef = parsed;
        if (parsed.business_type && parsed.business_type !== 'ALL') sectionBusinessType = parsed.business_type;
      }
    } catch { /* ignore malformed rule_json — falls through to an empty rule */ }
  }

  let categoryKey = category_key || null;
  let categoryCats = null;
  if (categoryKey || sectionBusinessType) {
    const maps = await categoryTaxonomy.getMaps();
    if (categoryKey) categoryCats = maps.membersByKey[categoryKey] || null;
    // No surface category → fall back to the section's own business_type.
    if (!categoryCats && sectionBusinessType) {
      categoryCats = maps.membersByKey[sectionBusinessType] || null;
      categoryKey = categoryKey || sectionBusinessType;
    }
  }

  const ctx = {
    city, followerId,
    followedIds: await sectionEngine.getFollowedIds(followerId),
    categoryKey,
    categoryCats,
    influencer,
    brandId: brand_id || null,
    ruleDef,
    limit,
    lat, lng,
  };

  const items = await runRule(rule, ctx);
  return success(res, { items, item_type: req.query.item_type || null, capped: items.length >= limit });
});

// GET /follower/cart-recommendations?product_ids=a,b&limit=8
// "You might also like" at checkout — live products in the SAME categories
// (section) as the cart items, ranked by markdown then newest, excluding what's
// already in the cart. Cross-sell rule; no fabricated data.
const getCartRecommendations = asyncHandler(async (req, res) => {
  const ids = String(req.query.product_ids || '').split(',').map((s) => s.trim()).filter(Boolean);
  const limit = Math.min(parseInt(req.query.limit, 10) || 8, 20);
  if (!ids.length) return success(res, { items: [] });
  const { rows: cats } = await db.query(
    `SELECT DISTINCT section FROM brand_products WHERE id = ANY($1::uuid[]) AND section IS NOT NULL AND section <> ''`,
    [ids]
  );
  const sections = cats.map((c) => c.section).filter(Boolean);
  if (!sections.length) return success(res, { items: [] });
  const { rows } = await db.query(
    `SELECT bp.id, bp.name, bp.price, ${OFFER_BEST_PCT} AS offer_pct, bp.image_url, bp.section,
            b.id AS brand_id, b.business_name AS brand_name, b.category AS brand_category
       FROM brand_products bp
       JOIN brands b ON b.id = bp.brand_id
       JOIN users u ON u.id = b.user_id
      WHERE u.status = 'approved' AND bp.is_active = true AND bp.pushed_to_store = true
        AND bp.section = ANY($1) AND NOT (bp.id = ANY($2::uuid[]))
      ORDER BY COALESCE(${OFFER_BEST_PCT}, 0) DESC,
               bp.created_at DESC NULLS LAST
      LIMIT $3`,
    [sections, ids, limit]
  );
  const items = rows.map((r) => {
    const price = r.price != null ? parseFloat(r.price) : null;
    return {
      entity_type: 'product', id: r.id, name: r.name, price,
      ...offerFieldsFromPct(r.offer_pct, price),
      image_url: r.image_url, section: r.section,
      brand: { id: r.brand_id, name: r.brand_name, category: r.brand_category },
    };
  });
  return success(res, { items });
});

// Follower v2 home — world switcher tabs + their "What's on your mind?" rails.
// Public (auth-optional). CONVERGED on the "one brain": the world tabs ARE the
// active follower_categories tiles (food/fashion/furniture/beauty/car_rental),
// already wired to real businesses via categoryTaxonomy. image_url (mig 111) =
// the 3D tab image. The dish rail is the genuinely-new follower_vertical_
// categories, keyed by tile key. (Replaces the duplicate follower_verticals.)
const getVerticals = asyncHandler(async (req, res) => {
  const { rows: verts } = await db.query(
    `SELECT key, label AS name, icon, image_url
       FROM follower_categories WHERE status = 'active' ORDER BY sort_order, label`
  );
  const { rows: cats } = await db.query(
    `SELECT vertical_key, key, name, icon, image_url
       FROM follower_vertical_categories WHERE enabled = true ORDER BY sort_order, name`
  );
  const byVert = {};
  for (const c of cats) {
    (byVert[c.vertical_key] = byVert[c.vertical_key] || []).push(
      { key: c.key, name: c.name, icon: c.icon, image_url: c.image_url }
    );
  }
  const verticals = verts.map((v) => ({ ...v, categories: byVert[v.key] || [] }));
  return success(res, { verticals });
});

// ── Dish groups (food discovery tiles) ───────────────────────────────────────
// GET /follower/dish-groups — the active tiles for the food home rail.
const getDishGroups = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, name, image_url FROM dish_groups WHERE status='active' ORDER BY sort_order, name`
  );
  return success(res, { groups: rows });
});

// GET /follower/dish-groups/:id/restaurants?lat&lng — restaurants near the user
// serving any dish in the group (explicit member master_dishes OR the group's
// name keyword), ranked by distance then 30-day popularity. Each card carries
// the restaurant's matching varieties + "from ₹X" + rating + delivery info.
// Shared matcher: approved restaurants (in-store) serving any of `memberIds`
// (master_dish) OR matching `keyword` on dish name — distance-ranked with
// rating / ETA / free-delivery / from-price / varieties. Used by both the
// dish-group endpoint and the category-tile (Home Builder) discovery endpoint.
async function restaurantsServing({ memberIds = [], keyword = '', lat, lng }) {
  const kw = (keyword || '').trim();
  if (!memberIds.length && !kw) return [];
  const geo = Number.isFinite(lat) && Number.isFinite(lng);
  const params = [];
  let p = 0;
  const memIdx = ++p; params.push(memberIds.length ? memberIds : [0]); // int[] (0 matches nothing)
  const kwIdx  = ++p; params.push(kw);                                 // '' when no keyword
  let latIdx, lngIdx;
  if (geo) { latIdx = ++p; params.push(lat); lngIdx = ++p; params.push(lng); }

  const distSel = geo
    ? `CASE WHEN b.lat IS NOT NULL AND b.lng IS NOT NULL THEN
         (6371 * acos(LEAST(1, GREATEST(-1,
           cos(radians($${latIdx}))*cos(radians(b.lat))*cos(radians(b.lng)-radians($${lngIdx}))
           + sin(radians($${latIdx}))*sin(radians(b.lat)))))) END`
    : `NULL::numeric`;
  const matchClause =
    `(bp.master_dish_id = ANY($${memIdx}::int[]) OR ($${kwIdx} <> '' AND bp.name ILIKE '%' || $${kwIdx} || '%'))`;

  const { rows } = await db.query(
    `SELECT b.id AS brand_id, b.business_name, u.city, b.lat, b.lng, b.listing_data,
            ${distSel} AS dist_km,
            (SELECT COUNT(*) FROM follower_transactions ft
               WHERE ft.brand_id = b.id AND ft.created_at >= now() - interval '30 days')::int AS score,
            MIN(bp.price) AS from_price,
            (array_agg(DISTINCT bp.name))[1:4] AS varieties
       FROM brands b
       JOIN users u ON u.id = b.user_id
       JOIN brand_products bp ON bp.brand_id = b.id AND bp.is_active = true AND bp.pushed_to_store = true
      WHERE u.status = 'approved' AND b.category = 'restaurant'
        AND ${matchClause}
      GROUP BY b.id, b.business_name, u.city, b.lat, b.lng, b.listing_data
      ORDER BY dist_km ASC NULLS LAST, score DESC, b.business_name
      LIMIT 50`,
    params
  );

  const ratingMap = await followerService.getBrandRatings(rows.map(r => r.brand_id));
  return rows.map(r => {
    const ld = r.listing_data || {};
    const rt = ratingMap[r.brand_id] || { avg_rating: null, review_count: 0 };
    const eta = etaFromDistanceKm(r.dist_km); // distance-derived (founder 2026-06-22)
    return {
      brand_id: r.brand_id,
      business_name: r.business_name,
      city: r.city,
      avg_rating: rt.avg_rating,
      review_count: rt.review_count,
      distance_km: r.dist_km != null ? Math.round(Number(r.dist_km) * 10) / 10 : null,
      free_delivery: ld.free_delivery === true,
      eta_min_mins: eta.min,
      eta_max_mins: eta.max,
      from_price: r.from_price != null ? parseFloat(r.from_price) : null,
      varieties: r.varieties || [],
    };
  });
}

const getDishGroupRestaurants = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) throw new AppError('VALIDATION_ERROR', 'bad id', 422);
  const { rows: g } = await db.query(
    `SELECT id, name, keyword FROM dish_groups WHERE id=$1 AND status='active'`, [id]);
  if (!g[0]) throw new AppError('NOT_FOUND', 'dish group not found', 404);
  const group = g[0];
  const { rows: mem } = await db.query(
    `SELECT master_dish_id FROM dish_group_dishes WHERE dish_group_id=$1`, [id]);
  const memberIds = mem.map(m => m.master_dish_id);

  const { lat, lng } = await resolveFollowerContext(req);
  const restaurants = await restaurantsServing({ memberIds, keyword: group.keyword, lat, lng });
  return success(res, { group: { id: group.id, name: group.name }, restaurants });
});

// GET /follower/category-restaurants?name=&lat&lng — restaurants serving a
// Home-Builder category tile (follower_vertical_categories). Cleanup 2026-06-22:
// the craving rail is now driven by these tiles, not dish_groups. For precise
// matching we reuse a same-named dish_group's members+keyword when one exists;
// otherwise keyword = the tile name (dish-name match).
const getCategoryRestaurants = asyncHandler(async (req, res) => {
  const name = String(req.query.name || req.query.category || '').trim();
  if (!name) throw new AppError('VALIDATION_ERROR', 'name is required', 422, 'name');
  const { rows: dg } = await db.query(
    `SELECT id, keyword FROM dish_groups
      WHERE status='active' AND (name ILIKE $1 OR keyword ILIKE $1)
      ORDER BY name LIMIT 1`, [name]);
  let memberIds = [];
  let keyword = name;
  if (dg[0]) {
    const { rows: mem } = await db.query(
      `SELECT master_dish_id FROM dish_group_dishes WHERE dish_group_id=$1`, [dg[0].id]);
    memberIds = mem.map(m => m.master_dish_id);
    keyword = (dg[0].keyword || name).trim();
  }
  const { lat, lng } = await resolveFollowerContext(req);
  const restaurants = await restaurantsServing({ memberIds, keyword, lat, lng });
  return success(res, { category: { name }, restaurants });
});

// ── POST /follower/resolve-coupon ─────────────────────────────────────────────
// follower-creator-attribution Slice 2 (the "code door"). Resolves a creator's
// coupon code → the creator + the products they were allocated, so the cart can
// apply the discount AND attribute the sale to that creator WITHOUT the follower
// arriving via the creator's link. Code scope = the creator's allocated products
// for that brand only (founder-locked). Mirrors validateTracking's guards.
const resolveCoupon = asyncHandler(async (req, res) => {
  const code = String(req.body?.code || '').trim();
  if (!code) throw new AppError('VALIDATION_ERROR', 'code is required', 422, 'code');

  const { rows } = await db.query(
    `SELECT ci.id AS campaign_influencer_id, ci.status AS ci_status,
            ci.offer_type, ci.offer_config_json, ci.commission_pct,
            -- collab-part4 §4.1/§4.4 — allocation is its own axis; offer_valid_until
            -- is the DISCOUNT deadline (not offer_expires_at, the invite clock).
            ci.alloc_scope, ci.alloc_category_node_id, ci.alloc_category,
            ci.alloc_product_ids, ci.offer_valid_until,
            cs.id AS set_id, co.products_json,
            c.id AS campaign_id, c.status AS campaign_status, c.end_date,
            b.id AS brand_id, b.business_name AS brand_name,
            inf.instagram_handle AS creator_handle,
            co.id AS offer_id
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c      ON c.id  = cs.campaign_id
       JOIN brands b         ON b.id  = c.brand_id
       JOIN influencers inf  ON inf.id = ci.influencer_id
       LEFT JOIN campaign_offers co ON co.set_id = cs.id
      WHERE LOWER(ci.coupon_code) = LOWER($1)
      LIMIT 1`,
    [code]
  );
  const r = rows[0];
  if (!r) throw new AppError('NOT_FOUND', 'That code is not valid.', 404, 'code');

  const UNAVAILABLE = (msg) => new AppError('OFFER_UNAVAILABLE', msg, 409, 'code');
  if (!['contracted', 'active', 'completed'].includes(r.ci_status)) throw UNAVAILABLE('This creator code is not active.');
  if (!['published', 'active', 'live'].includes(r.campaign_status)) throw UNAVAILABLE('This creator code is not active.');
  if (r.end_date && new Date(r.end_date) < new Date()) throw UNAVAILABLE('This creator code has expired.');
  // Mirror validateTracking: a shoppable code needs a typed offer or a set offer.
  // collab-part4 §4.2 — a code used to need a typed offer or a set offer to be
  // shoppable. That is what blocked full-price selling at the coupon door: a
  // creator on commission alone got "this code can't be used for orders" even
  // though they had products to sell. An allocation now makes a code shoppable.
  // A creator with neither an allocation nor an offer still cannot be used —
  // there is nothing they are entitled to sell.
  if (!r.alloc_scope && !r.offer_type && !r.offer_id) {
    throw UNAVAILABLE('This code can’t be used for orders.');
  }

  // Phase 4b — scope-aware LIVE allocation (also fixes the genuine defect here:
  // this query selected cs.products_json, a column that has never existed on
  // campaign_sets — every coupon resolve 500'd. The offer's own products_json
  // (co.) was always the intended source.)
  const allocatedIds = await followerService.resolveAllocatedProductIds({
    alloc: followerService.allocFromRow(r),
    ciCfg: r.offer_config_json || {}, offerProductsJson: r.products_json, brandId: r.brand_id,
  });

  // Light preview label only — placeOrder re-prices authoritatively at checkout.
  const cfg = r.offer_config_json || {};
  const type = String(r.offer_type || '').toLowerCase();
  const val = Number(cfg.value ?? cfg.discount_value ?? 0) || 0;
  let label = 'Creator offer';
  if (['discount', 'percentage', 'flat'].includes(type)) {
    const dt = String(cfg.discount_type || cfg.type || (type === 'flat' ? 'flat' : '')).toLowerCase();
    label = (dt === 'flat' || dt === 'amount') ? `Flat ₹${val} off` : (val ? `${val}% off` : 'Creator discount');
  } else if (type) {
    label = type.replace(/_/g, ' ');
  }

  return success(res, {
    campaign_influencer_id: r.campaign_influencer_id,
    campaign_id: r.campaign_id,
    set_id: r.set_id,
    offer_id: r.offer_id || null,
    brand_id: r.brand_id,
    brand_name: r.brand_name,
    creator_handle: r.creator_handle,
    coupon_code: code.toUpperCase(),
    offer: {
      type: r.offer_type || null,
      label,
      // For a discount-type offer the cart can preview the saving over the
      // claimed lines; placeOrder remains authoritative.
      discount_type: String(cfg.discount_type || cfg.type || (type === 'flat' ? 'flat' : '')).toLowerCase() || null,
      value: val || null,
      max_discount: Number(cfg.max_discount ?? cfg.cap ?? 0) || null,
    },
    allocated_product_ids: allocatedIds,
  });
});

// POST /v1/follower/section-event — per-section engagement capture (P5,
// features/section-analytics-city/). Fire-and-forget from the app: ALWAYS 204,
// invalid payloads are dropped silently (an analytics write must never surface
// an error to a follower). follower_id captured when a JWT is present.
const EVENT_KINDS = new Set(['tap', 'see_all']);
const recordSectionEvent = asyncHandler(async (req, res) => {
  try {
    const b = req.body || {};
    const key = String(b.section_key || '').trim().slice(0, 120);
    const screen = String(b.screen || '').trim().slice(0, 40);
    const event = String(b.event || '').trim();
    if (key && screen && EVENT_KINDS.has(event)) {
      const follower = req.user?.sub ? await getFollowerByUserId(req.user.sub).catch(() => null) : null;
      await db.query(
        `INSERT INTO section_events (section_key, screen, scope_value, city, event, entity_type, entity_id, follower_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [key, screen,
         b.scope_value ? String(b.scope_value).slice(0, 60) : null,
         b.city ? String(b.city).toLowerCase().slice(0, 60) : null,
         event,
         b.entity_type ? String(b.entity_type).slice(0, 30) : null,
         b.entity_id ? String(b.entity_id).slice(0, 80) : null,
         follower?.id || null]
      );
    }
  } catch (e) { console.warn('[section-event] dropped:', e.message); }
  return res.status(204).end();
});

module.exports = {
  recordSectionEvent,
  resolveCoupon,
  getVerticals,
  getDishGroups,
  getDishGroupRestaurants,
  getCategoryRestaurants,
  creatorsEatingNow,
  getSectionResults,
  getCartRecommendations,
  getProductDetail,
  search,
  register,
  getMe,
  getStoreOfferDetail,
  recordTouch,
  followInfluencer,
  unfollowInfluencer,
  getInfluencerStore,
  getBusinessStore,
  getCategoryStore,
  createAddress,
  listAddresses,
  updateAddress,
  deleteAddress,
  updateMe,
  getFeed,
  getHomeFeed,
  getDeals,
  getFollowing,
  getStoreProducts,
  getStories,
  getCategories,
  getCategoryStores,
  updateLocation,
  reverseGeocode,
  getHomeSections,
  getCategorySections,
  getBusinessSections,
  getOffersSections,
  getCreatorSections,
  getCreatorCategorySections,
  getPageSections,
};
