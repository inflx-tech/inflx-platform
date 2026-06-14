'use strict';

const db   = require('../config/db');
const notificationService = require('../services/notification.service');
const entitlementsService = require('../services/entitlements.service');
const { loadSchema, clearSchemaCache } = require('../services/schema.service');
const dishFlywheel = require('../services/dishFlywheel.service');
const tagsService = require('../services/tags.service');
const { success } = require('../utils/response');
const AppError    = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Category-aware validation using schema
function validateProductFields(schema, body) {
  const errors = [];
  if (!schema) return errors;
  for (const field of (schema.fields || [])) {
    if (field.required && (body[field.key] == null || body[field.key] === '')) {
      errors.push({ field: field.key, message: `${field.label} is required` });
    }
  }
  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getBrandByUserId(userId) {
  const { rows } = await db.query(
    `SELECT b.*, u.status AS user_status, u.phone, u.name, u.fcm_token
     FROM brands b
     JOIN users u ON u.id = b.user_id
     WHERE b.user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

async function getBrandById(brandId) {
  const { rows } = await db.query(
    `SELECT b.*, u.status AS user_status, u.phone, u.name, u.fcm_token
     FROM brands b
     JOIN users u ON u.id = b.user_id
     WHERE b.id = $1`,
    [brandId]
  );
  return rows[0] || null;
}

function sanitiseBrand(brand) {
  // Never return internal admin fields to non-admin callers.
  // The controller will pass the full row; routes for brands strip admin fields.
  const { fcm_token, ...safe } = brand;
  return safe;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /brands/register
// ─────────────────────────────────────────────────────────────────────────────

const register = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const {
    name,           // brand contact's real name; verify-otp wrote "Brand User" as a placeholder
    business_name,
    category,
    gstin,
    address_line,
    pincode,
    city,           // lives on users table
    state,          // lives on users table
    // Optional location capture (contract: features/brand-register-location-picker).
    // Sent by the registration form's search/maps-link modes; absent for manual.
    latitude,
    longitude,
    locality,
    formatted_address,
    google_maps_url,
  } = req.body;

  if (!business_name || !business_name.trim()) {
    throw new AppError('VALIDATION_ERROR', 'business_name is required', 422, 'business_name');
  }
  if (!category || !category.trim()) {
    throw new AppError('VALIDATION_ERROR', 'category is required', 422, 'category');
  }
  if (!name || !name.trim()) {
    throw new AppError('VALIDATION_ERROR', 'name is required', 422, 'name');
  }
  if (!city || !city.trim()) {
    throw new AppError('VALIDATION_ERROR', 'city is required', 422, 'city');
  }
  if (!state || !state.trim()) {
    throw new AppError('VALIDATION_ERROR', 'state is required', 422, 'state');
  }
  if (!address_line || !address_line.trim()) {
    throw new AppError('VALIDATION_ERROR', 'address_line is required', 422, 'address_line');
  }
  if (!pincode || !/^[0-9]{6}$/.test(String(pincode).trim())) {
    throw new AppError('VALIDATION_ERROR', 'pincode must be a 6-digit number', 422, 'pincode');
  }

  // Optional coordinates — validate when present; a Google Maps URL resolved
  // server-side is the source of truth and overrides client-sent coords.
  let lat = latitude != null ? parseFloat(latitude) : null;
  let lng = longitude != null ? parseFloat(longitude) : null;
  if ((lat != null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) ||
      (lng != null && (!Number.isFinite(lng) || lng < -180 || lng > 180))) {
    throw new AppError('VALIDATION_ERROR', 'latitude/longitude out of range', 422, 'latitude');
  }
  let loc = (locality && String(locality).trim()) || null;
  let fmtAddr = (formatted_address && String(formatted_address).trim()) || null;
  if (google_maps_url) {
    const r = await geocoding.resolveMapsUrl(google_maps_url, {
      name: business_name && business_name.trim(),
      city: city && city.trim(),
    });
    if (r && r.verified) {
      lat = r.lat; lng = r.lng;
      loc = r.locality || loc;
      fmtAddr = r.formatted_address || fmtAddr;
    }
  }

  // Idempotency: disallow duplicate registration
  const existing = await getBrandByUserId(userId);
  if (existing) {
    throw new AppError('CONFLICT', 'Brand profile already exists for this account', 409);
  }

  // Update the users row first — name + city + state live there. We do this
  // before the brand insert so a failed insert leaves the user's name updated
  // (better UX than rolling back to "Brand User").
  await db.query(
    `UPDATE users SET name = $2, city = $3, state = $4 WHERE id = $1`,
    [userId, name.trim(), city.trim(), state.trim()]
  );

  // lat/lng are the discovery columns (mig 051 reads these); latitude/longitude
  // are legacy — kept in sync exactly as updateMe does.
  const { rows } = await db.query(
    `INSERT INTO brands (user_id, business_name, category, gstin, address_line, pincode,
                         lat, lng, latitude, longitude, locality, formatted_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $7, $8, $9, $10)
     RETURNING *`,
    [userId, business_name.trim(), category.trim(), gstin || null, address_line.trim(), String(pincode).trim(),
     lat, lng, loc, fmtAddr]
  );

  const brand = rows[0];
  // Fetch with user status joined
  const full = await getBrandById(brand.id);

  return success(res, { brand: sanitiseBrand(full), user_status: full.user_status }, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/me
// ─────────────────────────────────────────────────────────────────────────────

const getMe = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  return success(res, { brand: sanitiseBrand(brand), user_status: brand.user_status });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /brands/me
// ─────────────────────────────────────────────────────────────────────────────

const locationService = require('../services/location.service');
const geocoding = require('../services/geocoding.service');

const updateMe = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found. Please register first.', 404);

  // Phase A12.6 — multi_branch_support gate.
  // brands.listing_data.branches is a jsonb array; branches[0] is the
  // Main Branch (auto-named by the UI), branches[1..] are additional
  // branches added via the profile editor's "+ Add Branch" button.
  // Free/Growth tiers may only save 1 branch (Main); Pro/Enterprise
  // unlimited.
  //
  // Grandfathering: the gate uses count-is-increasing logic — it fires
  // only when the patch is ADDING branches beyond the existing count.
  // Existing brands with multi-branch data saved (pre-M067) can still
  // edit other profile fields without being locked out, because the
  // frontend always re-sends the full listing_data on every save.
  // Reducing branch count is never gated.
  //
  // Defensive fail-open via requireFeature/is_enforced (pre-M067 the
  // gate is a no-op).
  const incomingBranches = req.body.listing_data?.branches;
  if (Array.isArray(incomingBranches) && incomingBranches.length > 1) {
    const existing      = brand.listing_data?.branches;
    const existingCount = Array.isArray(existing) ? existing.length : 0;
    if (incomingBranches.length > existingCount) {
      await entitlementsService.requireFeature(db, brand.id, 'multi_branch_support', {
        label: 'Multi-branch support',
      });
    }
  }

  // Whitelist of updatable fields. lat/lng are the CANONICAL distance columns
  // (mig 051 index + discovery rules read these); latitude/longitude are legacy.
  const allowed = ['business_name', 'category', 'gstin', 'address_line', 'pincode', 'logo_url', 'lat', 'lng', 'latitude', 'longitude', 'locality', 'formatted_address', 'listing_data', 'cover_image_url'];
  const updates = {};
  allowed.forEach(field => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  // Wave 2 (Dining) — mirror cover_image_url from nested listing_data into
  // the typed brands.cover_image_url column so discovery queries can SELECT
  // it without unpacking JSONB. publishDriver writes the wizard cover into
  // listing_data; this mirror keeps the typed column in sync without
  // requiring the driver to learn which keys are typed.
  if (req.body.listing_data?.cover_image_url !== undefined && updates.cover_image_url === undefined) {
    updates.cover_image_url = req.body.listing_data.cover_image_url;
  }

  // Resolve coordinates from a Google Maps URL (robust: short-link expand +
  // coord regex + forward-geocode by name). Writes the CANONICAL lat/lng (what
  // distance ranking reads) + locality/formatted_address, and keeps the legacy
  // latitude/longitude in sync. Replaces the old extractLatLng (which returned
  // null for the founder's maps.app.goo.gl share links → all brands had no coords).
  const mapsUrl = req.body.google_maps_url || req.body.listing_data?.google_maps_url;
  if (mapsUrl) {
    const r = await geocoding.resolveMapsUrl(mapsUrl, {
      name: req.body.business_name || brand.business_name,
      city: req.body.city || null,
    });
    if (r && r.verified && r.lat != null && r.lng != null) {
      updates.lat = r.lat; updates.lng = r.lng;
      updates.latitude = r.lat; updates.longitude = r.lng; // sync legacy columns
      if (r.locality) updates.locality = r.locality;
      if (r.formatted_address) updates.formatted_address = r.formatted_address;
    }
  }

  // Keep lat/lng <-> latitude/longitude consistent for manual (non-URL) entry.
  if (updates.lat == null && updates.latitude != null) { updates.lat = updates.latitude; }
  if (updates.lng == null && updates.longitude != null) { updates.lng = updates.longitude; }
  if (updates.latitude == null && updates.lat != null) { updates.latitude = updates.lat; }
  if (updates.longitude == null && updates.lng != null) { updates.longitude = updates.lng; }

  if (Object.keys(updates).length === 0) {
    throw new AppError('VALIDATION_ERROR', 'No valid fields provided to update', 422);
  }

  const setClauses = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`);
  const values = [brand.id, ...Object.values(updates)];

  await db.query(
    `UPDATE brands SET ${setClauses.join(', ')} WHERE id = $1`,
    values
  );

  const updated = await getBrandById(brand.id);
  return success(res, { brand: sanitiseBrand(updated) });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/:id  (admin only)
// ─────────────────────────────────────────────────────────────────────────────

const getById = asyncHandler(async (req, res) => {
  const brand = await getBrandById(req.params.id);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand not found', 404);

  return success(res, { brand });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /brands/:id/status  (admin approve / reject)
// ─────────────────────────────────────────────────────────────────────────────

const updateStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  const adminUserId = req.user.sub;

  if (!['approved', 'rejected', 'suspended'].includes(status)) {
    throw new AppError('VALIDATION_ERROR', 'status must be approved, rejected, or suspended', 422, 'status');
  }
  if (status === 'rejected' && !reason) {
    throw new AppError('VALIDATION_ERROR', 'reason is required when rejecting an account', 422, 'reason');
  }

  const brand = await getBrandById(req.params.id);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand not found', 404);

  // Update brand record
  if (status === 'approved') {
    await db.query(
      `UPDATE brands SET rejection_reason = NULL, approved_at = now(), approved_by = $2 WHERE id = $1`,
      [brand.id, adminUserId]
    );
  } else if (status === 'rejected') {
    await db.query(
      `UPDATE brands SET rejection_reason = $2, approved_at = NULL, approved_by = NULL WHERE id = $1`,
      [brand.id, reason]
    );
  }

  // Update user status
  await db.query(`UPDATE users SET status = $1 WHERE id = $2`, [status, brand.user_id]);

  const updated = await getBrandById(brand.id);

  // Send notification to brand user
  const templates = {
    approved: {
      type: 'account.approved',
      title: 'Account Approved',
      body: 'Your brand account is approved. Start creating campaigns!',
    },
    rejected: {
      type: 'account.rejected',
      title: 'Account Needs More Info',
      body: `Your account needs more info. Reason: ${reason}`,
    },
    suspended: {
      type: 'account.suspended',
      title: 'Account Suspended',
      body: 'Your account has been suspended. Please contact support.',
    },
  };

  const tpl = templates[status];
  await notificationService.send({
    userId: brand.user_id,
    type: tpl.type,
    title: tpl.title,
    body: tpl.body,
    data: { screen: 'brand_dashboard' },
    fcmToken: brand.fcm_token,
    sendSms: true,
    phone: brand.phone,
  });

  return success(res, { brand: updated, notification_sent: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /brands/resubmit
// ─────────────────────────────────────────────────────────────────────────────

const resubmit = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  if (brand.user_status !== 'rejected') {
    throw new AppError('CONFLICT', 'Account can only be resubmitted when in rejected status', 409);
  }

  await db.query(
    `UPDATE brands SET rejection_reason = NULL WHERE id = $1`,
    [brand.id]
  );
  await db.query(`UPDATE users SET status = 'pending' WHERE id = $1`, [brand.user_id]);

  return success(res, { user_status: 'pending', message: 'Account resubmitted for review' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Products CRUD  (brand_products table)
// GET  /brands/me/products
// POST /brands/me/products
// PATCH /brands/me/products/:pid
// DELETE /brands/me/products/:pid
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/me/schema  — return the category schema for the authenticated brand
// ─────────────────────────────────────────────────────────────────────────────

const getCategorySchema = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const schema = loadSchema(brand.category);
  if (!schema) throw new AppError('NOT_FOUND', `No schema found for category: ${brand.category}`, 404);

  return success(res, { schema });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/me/products
// ─────────────────────────────────────────────────────────────────────────────

const listProducts = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const { section, is_active } = req.query;
  const conditions = ['brand_id = $1'];
  const params = [brand.id];

  if (section) { params.push(section); conditions.push(`section = $${params.length}`); }
  if (is_active !== undefined) { params.push(is_active === 'true'); conditions.push(`is_active = $${params.length}`); }

  const { rows } = await db.query(
    `SELECT id, name, description, price, category_key, sku, section,
            veg_flag, duration_mins, variants_json, image_url,
            is_active, is_bookable, stock, availability_json,
            booking_config_json, tags, pushed_to_store, created_at, updated_at
     FROM brand_products
     WHERE ${conditions.join(' AND ')}
     ORDER BY section NULLS LAST, name ASC`,
    params
  );

  // Group by section for convenience
  const schema = loadSchema(brand.category);
  return success(res, { products: rows, schema, category: brand.category });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /brands/me/products
// ─────────────────────────────────────────────────────────────────────────────

const createProduct = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const schema = loadSchema(brand.category);

  const {
    name, description, price,
    section, veg_flag, duration_mins,
    variants_json, image_url, sku,
    is_bookable, stock,
    availability_json, booking_config_json,
    master_vehicle_id, master_service_id, master_dish_id,
    tags, pushed_to_store,
  } = req.body;

  // For master-catalogue activations, skip schema validation (name/image come from master)
  const isMasterActivation = master_vehicle_id != null || master_service_id != null || master_dish_id != null;
  if (!isMasterActivation) {
    const validationErrors2 = validateProductFields(schema, req.body);
    if (validationErrors2.length > 0) {
      throw new AppError('VALIDATION_ERROR', validationErrors2[0].message, 422, validationErrors2[0].field);
    }
  }

  if (!name || !name.trim()) throw new AppError('VALIDATION_ERROR', 'name is required', 422, 'name');

  const { rows } = await db.query(
    `INSERT INTO brand_products
       (brand_id, name, description, price, category_key, section,
        veg_flag, duration_mins, variants_json, image_url, sku,
        is_active, is_bookable, stock, availability_json, booking_config_json,
        master_vehicle_id, master_service_id, master_dish_id, tags, pushed_to_store)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,$13,$14,$15,$16,$17,$18,$19,$20)
     RETURNING *`,
    [
      brand.id,
      name.trim(),
      description || null,
      price != null ? parseFloat(price) : null,
      brand.category || null,
      section || null,
      veg_flag || 'na',
      duration_mins ? parseInt(duration_mins, 10) : null,
      variants_json ? JSON.stringify(variants_json) : null,
      image_url || null,
      sku || null,
      is_bookable === true || is_bookable === 'true',
      stock != null ? parseInt(stock, 10) : null,
      availability_json ? JSON.stringify(availability_json) : '{}',
      booking_config_json ? JSON.stringify(booking_config_json) : '{}',
      master_vehicle_id ? parseInt(master_vehicle_id, 10) : null,
      master_service_id ? parseInt(master_service_id, 10) : null,
      master_dish_id ? parseInt(master_dish_id, 10) : null,
      tagsService.sanitizeProductTags(tags),
      pushed_to_store !== false,
    ]
  );

  const product = rows[0];

  // Restaurant custom-dish flywheel: a dish typed without a canonical link
  // (master_dish_id null) is captured into the review queue. Best-effort —
  // a queue-capture failure must NEVER block the listing from going live.
  if ((brand.category || '').toLowerCase() === 'restaurant' && product.master_dish_id == null) {
    try {
      await dishFlywheel.capturePendingDish(db, {
        brand_id: brand.id,
        brand_product_id: product.id,
        raw_name: product.name,
        section: product.section,
      });
    } catch (e) {
      console.error('[dishFlywheel] capture failed (non-fatal):', e.message);
    }
  }

  return success(res, { product }, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/me/tag-options — fixed tag vocabulary for this brand's business
// (its own scope + cross-business 'ALL'). Drives the listing tag-picker.
// ─────────────────────────────────────────────────────────────────────────────

const getTagOptions = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  const options = await tagsService.listTagOptions(brand.category);
  return success(res, { options, scope: brand.category });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/me/dishes/search?q=  — restaurant dish typeahead (fuzzy)
// Returns canonical matches (>= 0.30 similarity) + allow_custom so the seller
// can always add their own wording. Non-restaurant verticals get an empty,
// custom-only response. Never blocks.
// ─────────────────────────────────────────────────────────────────────────────

const searchDishes = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const q = (req.query.q || '').trim();
  if ((brand.category || '').toLowerCase() !== 'restaurant' || q.length < 2) {
    return success(res, { matches: [], allow_custom: q.length > 0 });
  }

  let matches = [];
  try {
    matches = await dishFlywheel.searchMasterDishes(db, q, brand.id);
  } catch (e) {
    // pg_trgm/unaccent missing or query error → degrade to no suggestions.
    console.error('[dishFlywheel] search failed, degrading:', e.message);
  }
  return success(res, { matches, allow_custom: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /brands/me/products/:pid
// ─────────────────────────────────────────────────────────────────────────────

const updateProduct = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const { rows: existing } = await db.query(
    `SELECT id FROM brand_products WHERE id = $1 AND brand_id = $2`,
    [req.params.pid, brand.id]
  );
  if (!existing[0]) throw new AppError('NOT_FOUND', 'Product not found', 404);

  const ALLOWED = ['name','description','price','section','veg_flag','duration_mins',
                   'variants_json','image_url','sku','is_active','is_bookable','stock',
                   'availability_json','booking_config_json','pushed_to_store'];

  const updates = {};
  ALLOWED.forEach(f => {
    if (req.body[f] !== undefined) {
      if (['variants_json','availability_json','booking_config_json'].includes(f)) {
        updates[f] = JSON.stringify(req.body[f]);
      } else {
        updates[f] = req.body[f];
      }
    }
  });

  // tags is a text[] column — sanitize to slugs (mix of fixed + free), not JSON.
  if (req.body.tags !== undefined) {
    updates.tags = tagsService.sanitizeProductTags(req.body.tags);
  }

  if (!Object.keys(updates).length) throw new AppError('VALIDATION_ERROR', 'No valid fields to update', 422);

  updates.updated_at = new Date();
  const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
  await db.query(
    `UPDATE brand_products SET ${setClauses.join(', ')} WHERE id = $1`,
    [req.params.pid, ...Object.values(updates)]
  );

  const { rows } = await db.query(`SELECT * FROM brand_products WHERE id = $1`, [req.params.pid]);
  return success(res, { product: rows[0] });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /brands/me/products/:pid
// ─────────────────────────────────────────────────────────────────────────────

const deleteProduct = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  // Soft-delete: a hard DELETE fails the moment a product has been booked,
  // ordered, returned, or referenced by an influencer/lookbook. follower_*
  // tables hold FKs without ON DELETE SET NULL by design (we want to
  // preserve attribution + analytics history). Soft-delete (is_active=false)
  // hides the product from every active query (brand listing + follower
  // discovery + master_catalog joins all filter on is_active=true) while
  // keeping the row intact for the historical record.
  const { rows } = await db.query(
    `UPDATE brand_products SET is_active = false
      WHERE id = $1 AND brand_id = $2 AND is_active = true
      RETURNING id`,
    [req.params.pid, brand.id]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Product not found or already removed', 404);

  // Cascade soft-delete to product_variants (fashion SKUs). Variants stay
  // inactive so any pending returns referencing them keep their FK valid.
  await db.query(
    `UPDATE product_variants SET is_active = false
      WHERE product_id = $1 AND is_active = true`,
    [req.params.pid]
  );

  return success(res, { message: 'Product removed', soft_deleted: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/me/master-catalogue
// Returns master vehicles (car_rental) or master salon services (salon),
// each annotated with is_activated + the brand's product_id and price if active.
// ─────────────────────────────────────────────────────────────────────────────

const getMasterCatalogue = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const cat = (brand.category || '').toLowerCase();

  if (cat === 'car_rental') {
    const { rows } = await db.query(`
      SELECT
        mv.*,
        bp.id           AS product_id,
        bp.price        AS activated_price,
        bp.is_active    AS is_active,
        bp.variants_json,
        (bp.id IS NOT NULL) AS is_activated
      FROM master_vehicles mv
      LEFT JOIN brand_products bp
        ON bp.master_vehicle_id = mv.id AND bp.brand_id = $1
      ORDER BY mv.sort_order, mv.segment, mv.make
    `, [brand.id]);

    return success(res, { category: 'car_rental', items: rows });
  }

  if (cat === 'salon') {
    const { rows } = await db.query(`
      SELECT
        ms.*,
        bp.id           AS product_id,
        bp.price        AS activated_price,
        bp.duration_mins AS activated_duration,
        bp.is_active    AS is_active,
        (bp.id IS NOT NULL) AS is_activated
      FROM master_salon_services ms
      LEFT JOIN brand_products bp
        ON bp.master_service_id = ms.id AND bp.brand_id = $1
      ORDER BY ms.sort_order, ms.category, ms.name
    `, [brand.id]);

    return success(res, { category: 'salon', items: rows });
  }

  if (cat === 'restaurant') {
    // Phase-1 seed of 129 dishes across 8 cuisines (migration 035). Admin
    // owns content forever via the admin-web CRUD UI landing in the next
    // phase. Each row annotated with brand-specific activation status so the
    // restaurant_dish_picker can grey out already-added dishes.
    const { rows } = await db.query(`
      SELECT
        md.*,
        bp.id           AS product_id,
        bp.price        AS activated_price,
        bp.is_active    AS is_active,
        (bp.id IS NOT NULL) AS is_activated
      FROM master_dishes md
      LEFT JOIN brand_products bp
        ON bp.master_dish_id = md.id AND bp.brand_id = $1
      ORDER BY md.cuisine, md.section, md.sort_order, md.name
    `, [brand.id]);

    return success(res, { category: 'restaurant', items: rows });
  }

  throw new AppError('NOT_FOUND', `Master catalogue not available for category: ${cat}`, 404);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/me/orders  — Brand sees all follower online orders for their products
// ─────────────────────────────────────────────────────────────────────────────

const listBrandOrders = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const { status, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const conditions = ['ft.brand_id = $1'];
  const params = [brand.id];

  if (status) {
    params.push(status);
    conditions.push(`fo.order_status = $${params.length}`);
  }

  const where = conditions.join(' AND ');

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) FROM follower_orders fo
     JOIN follower_transactions ft ON ft.id = fo.transaction_id
     WHERE ${where}`,
    params
  );
  const total = parseInt(countRows[0].count, 10);

  params.push(limitNum, offset);
  const { rows } = await db.query(
    `SELECT
       fo.id, fo.order_status, fo.tracking_number, fo.delivery_address,
       fo.created_at, fo.dispatched_at, fo.delivered_at,
       ft.net_amount, ft.gross_amount,
       fo.items_json,
       u_f.name AS follower_name, u_f.phone AS follower_phone
     FROM follower_orders fo
     JOIN follower_transactions ft ON ft.id = fo.transaction_id
     JOIN followers f ON f.id = ft.follower_id
     JOIN users u_f ON u_f.id = f.user_id
     WHERE ${where}
     ORDER BY fo.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return success(res, { orders: rows }, 200, { page: pageNum, limit: limitNum, total });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/me/transactions — ALL transactions (pay_at_store + prebook + online_order)
// ─────────────────────────────────────────────────────────────────────────────

const listAllTransactions = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const { type, campaign_id, influencer_id, status, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const conditions = ['ft.brand_id = $1'];
  const params = [brand.id];

  if (type) { params.push(type); conditions.push(`ft.transaction_type = $${params.length}`); }
  if (campaign_id) { params.push(campaign_id); conditions.push(`ft.campaign_id = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`ft.status = $${params.length}`); }
  if (influencer_id) {
    params.push(influencer_id);
    conditions.push(`ci.influencer_id = $${params.length}`);
  }

  const where = conditions.join(' AND ');

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int FROM follower_transactions ft
     LEFT JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
     WHERE ${where}`,
    params
  );
  const total = countRows[0].count;

  params.push(limitNum, offset);
  const { rows } = await db.query(
    `SELECT
       ft.id, ft.transaction_type, ft.status, ft.gross_amount, ft.discount_amount,
       ft.net_amount, ft.influencer_commission, ft.marketplace_fee_amount AS platform_fee, ft.brand_net,
       ft.coupon_code_used, ft.razorpay_payment_id, ft.created_at,
       ft.campaign_id, ft.set_id, ft.campaign_influencer_id,
       c.name AS campaign_name,
       u_i.name AS influencer_name, i.instagram_handle,
       u_f.name AS follower_name, u_f.phone AS follower_phone,
       bp.name AS product_name, bp.section AS product_section,
       fb.booking_type,
       fb.booking_date, fb.booking_time,
       fb.pickup_date, fb.return_date, fb.duration_days, fb.pickup_type,
       fb.stylist_id, fb.notes AS booking_notes,
       fb.reference_code AS booking_ref,
       fo.order_status
     FROM follower_transactions ft
     LEFT JOIN campaign_influencers ci ON ci.id = ft.campaign_influencer_id
     LEFT JOIN influencers i ON i.id = ci.influencer_id
     LEFT JOIN users u_i ON u_i.id = i.user_id
     LEFT JOIN followers f ON f.id = ft.follower_id
     LEFT JOIN users u_f ON u_f.id = f.user_id
     LEFT JOIN campaigns c ON c.id = ft.campaign_id
     LEFT JOIN follower_bookings fb ON fb.transaction_id = ft.id
     LEFT JOIN follower_orders fo ON fo.transaction_id = ft.id
     LEFT JOIN follower_orders fo2 ON fo2.transaction_id = ft.id
     LEFT JOIN brand_products bp ON bp.id = CASE WHEN fo2.items_json IS NOT NULL THEN (fo2.items_json->0->>'product_id')::uuid ELSE NULL END
     WHERE ${where}
     ORDER BY ft.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  // Summary stats
  const { rows: summaryRows } = await db.query(
    `SELECT
       COUNT(*)::int AS total_transactions,
       COALESCE(SUM(ft.net_amount), 0)::bigint AS total_revenue,
       COALESCE(SUM(ft.influencer_commission), 0)::bigint AS total_commission,
       COALESCE(SUM(ft.marketplace_fee_amount), 0)::bigint AS total_platform_fee,
       COALESCE(SUM(ft.brand_net), 0)::bigint AS total_brand_net,
       COUNT(CASE WHEN ft.transaction_type = 'pay_at_store' THEN 1 END)::int AS pay_at_store_count,
       COUNT(CASE WHEN ft.transaction_type = 'prebook' THEN 1 END)::int AS prebook_count,
       COUNT(CASE WHEN ft.transaction_type = 'online_order' THEN 1 END)::int AS online_order_count
     FROM follower_transactions ft
     WHERE ft.brand_id = $1 AND ft.status = 'completed'`,
    [brand.id]
  );

  return success(res, {
    transactions: rows,
    summary: summaryRows[0],
  }, 200, { page: pageNum, limit: limitNum, total });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /brands/:id/public — Public brand profile (for influencers viewing brand info)
// ─────────────────────────────────────────────────────────────────────────────

const getPublicProfile = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT b.id, b.business_name, b.category, b.logo_url, b.address_line,
            b.created_at,
            (SELECT COUNT(*) FROM campaigns c
             WHERE c.brand_id = b.id AND c.status IN ('active', 'live', 'published'))::int AS active_campaigns_count
     FROM brands b
     WHERE b.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand not found', 404);

  return success(res, { brand: rows[0] });
});

// ── GET /brands/me/store-preview — brand sees their store as followers see it ─

const followerService = require('../services/follower.service');

const storePreview = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const data = await followerService.getBrandStorePreview(brand.id);
  if (!data) throw new AppError('NOT_FOUND', 'Store data not found', 404);

  return success(res, data);
});

// ─────────────────────────────────────────────────────────────────────────────
// Listing Engine endpoints
// ─────────────────────────────────────────────────────────────────────────────

const listingService = require('../services/listing.service');

// GET /brands/me/listing-config — full config including listing_steps, card_config, quality_rules
const getListingConfig = asyncHandler(async (req, res) => {
  // Always bust the schema cache — production observation: when a schema
  // file is updated on disk and the Render container reloads, the cache
  // can warm with the new content correctly, BUT if any orchestration
  // detail (deploy race, sleeper container, build caching) causes the
  // process to outlive the file change, the cache holds the old schema
  // indefinitely. The cost of fs.readFileSync on a 5KB JSON file per
  // brand request is microseconds; the cost of a stale schema is "user
  // sees 6 old steps instead of 9 new ones, files a bug." Trade-off is
  // obvious. Cache stays for non-brand-facing reads (getCategoryStores
  // etc.) where the schema is unchanged-during-session.
  listingService.clearSchemaCache();
  clearSchemaCache();

  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  // Augmenting variant — for restaurant, merges admin-managed master_dishes
  // cuisines into brand_config.fields.cuisines.options so admin additions
  // surface in the wizard's step 1 multi-select on the next request. Other
  // categories pass through unchanged.
  const config = await listingService.getAugmentedConfigForBrand(brand);
  if (!config) throw new AppError('NOT_FOUND', `No config for category: ${brand.category}`, 404);

  const isActive = listingService.isCategoryActive(brand.category);

  // Bug fix (issue 2 of brand-wizard skip): the response was missing the
  // brand's stored profile fields, so canSkipBrandSteps() in the brand-web
  // client always saw an empty listing_data and re-rendered the brand-info
  // steps on every "Add" tap. We now surface listing_data + the few brand
  // fields the wizard needs to reason about skipping + identity.
  return success(res, {
    config,
    listing_engine_active: isActive,
    current_phase: listingService.LISTING_ENGINE_PHASE,
    brand_id: brand.id,
    business_name: brand.business_name,
    category: brand.category,
    listing_data: brand.listing_data || {},
  });
});

// GET /brands/me/quality-score — quality score with breakdown and suggestions
const getQualityScore = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const result = await listingService.calculateQualityScore(brand.id, brand.category);
  return success(res, result);
});

// GET /brands/me/listing-preview — products + card_config for LivePreview component
const getListingPreview = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const cardConfig = listingService.getCardConfig(brand.category);
  const actionTypes = listingService.getActionTypes(brand.category);
  const qualityScore = await listingService.calculateQualityScore(brand.id, brand.category);

  // Fetch top products for preview
  const { rows: products } = await db.query(
    `SELECT id, name, price, image_url, section, veg_flag, description, variants_json
     FROM brand_products
     WHERE brand_id = $1 AND is_active = true
     ORDER BY section NULLS LAST, name ASC
     LIMIT 10`,
    [brand.id]
  );

  return success(res, {
    brand: {
      id: brand.id,
      business_name: brand.business_name,
      category: brand.category,
      city: brand.city,
    },
    card_config: cardConfig,
    action_types: actionTypes,
    quality_score: qualityScore,
    products,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Excel Bulk Upload endpoints
// ─────────────────────────────────────────────────────────────────────────────

const excelService = require('../services/excel.service');

// GET /brands/me/listing-template/download — download auto-generated Excel template
const downloadListingTemplate = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  let wb;
  try {
    wb = await excelService.generateTemplate(brand.category, brand.business_name);
  } catch (err) {
    if (err.code === 'EXCEL_UPLOAD_DISABLED') {
      throw new AppError('EXCEL_UPLOAD_DISABLED', err.message, 422);
    }
    throw err;
  }
  const schema = listingService.getConfigForCategory(brand.category);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=INFLX_${(schema?.label || brand.category).replace(/\s+/g, '_')}_Template.xlsx`);

  await wb.xlsx.write(res);
  res.end();
});

// POST /brands/me/products/bulk-upload — parse Excel and create products
//
// Per-category behaviors layered on the parsed rows:
//   · restaurant — try findMasterMatch(name, section) → set master_dish_id
//                  on the product so it inherits the catalogue's photo +
//                  cross-brand analytics
//   · salon      — same; sets master_service_id
//   · fashion    — for rows with sizes/colors, post-create one
//                  product_variants row per (size × color) with the row's
//                  stock_per_variant
//   · car_rental — endpoint blocked at parseUpload (schema's
//                  excel_upload: false) — surfaces clean error
const bulkUploadProducts = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  if (!req.file) throw new AppError('VALIDATION_ERROR', 'No file uploaded', 400);

  let parseResult;
  try {
    parseResult = await excelService.parseUpload(req.file.buffer, brand.category);
  } catch (err) {
    if (err.code === 'EXCEL_UPLOAD_DISABLED') {
      throw new AppError('EXCEL_UPLOAD_DISABLED', err.message, 422);
    }
    throw err;
  }
  const { rows, errors, totalParsed } = parseResult;

  if (errors.length > 0 && rows.length === 0) {
    return success(res, { created: 0, errors, totalParsed }, 400);
  }

  const products = excelService.rowsToProducts(rows, brand.category);
  const created = [];
  let mastersLinked = 0;
  let variantsCreated = 0;

  for (const product of products) {
    // Pull out the post-insert payloads (handled separately so the
    // brand_products INSERT signature stays stable).
    const fashionVariantSpec = product._fashion_variants;
    delete product._fashion_variants;

    // Master-catalogue linking — restaurant + salon.
    // When a row auto-links to a master row AND the row didn't provide its
    // own image_url, inherit the master's default photo. This is what
    // makes "bulk upload + auto-link" feel like a real onboarding shortcut
    // for brands without their own product photography.
    let masterDishId = null;
    let masterServiceId = null;
    if (brand.category === 'restaurant') {
      masterDishId = await excelService.findMasterMatch('restaurant', product.name, product.section);
      if (masterDishId) {
        mastersLinked++;
        if (!product.image_url) {
          const { rows: mdRows } = await db.query(
            `SELECT default_image_url FROM master_dishes WHERE id = $1`,
            [masterDishId]
          );
          if (mdRows[0]?.default_image_url) product.image_url = mdRows[0].default_image_url;
        }
      }
    } else if (brand.category === 'salon') {
      masterServiceId = await excelService.findMasterMatch('salon', product.name, product.section);
      if (masterServiceId) {
        mastersLinked++;
        if (!product.image_url) {
          const { rows: msRows } = await db.query(
            `SELECT image_url FROM master_salon_services WHERE id = $1`,
            [masterServiceId]
          );
          if (msRows[0]?.image_url) product.image_url = msRows[0].image_url;
        }
      }
    }

    const { rows: [newProd] } = await db.query(
      `INSERT INTO brand_products (
         brand_id, name, price, section, description, image_url, veg_flag,
         variants_json, stock, duration_mins,
         is_active, is_bookable, category_key,
         master_dish_id, master_service_id, return_policy_days
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, $12, $13, $14, $15)
       RETURNING id, name, price, section, master_dish_id, master_service_id`,
      [
        brand.id,
        product.name,
        product.price,
        product.section,
        product.description || '',
        product.image_url || '',
        product.veg_flag || 'na',
        product.variants_json ? JSON.stringify(product.variants_json) : null,
        product.stock,
        product.duration_mins || null,
        product.is_bookable || false,
        brand.category,
        masterDishId,
        masterServiceId,
        product.return_policy_days || null,
      ]
    );
    created.push(newProd);

    // Fashion variant decomposition — one product_variants row per (size × color)
    if (fashionVariantSpec && (fashionVariantSpec.sizes?.length || fashionVariantSpec.colors?.length)) {
      const variantRows = excelService.buildFashionVariantRows(newProd.id, fashionVariantSpec);
      for (const v of variantRows) {
        await db.query(
          `INSERT INTO product_variants (product_id, size, color, stock)
           VALUES ($1, $2, $3, $4)`,
          [v.product_id, v.size, v.color, v.stock]
        );
        variantsCreated++;
      }
    }
  }

  return success(res, {
    created: created.length,
    masters_linked: mastersLinked,
    variants_created: variantsCreated,
    products: created,
    errors,
    totalParsed,
  });
});

// GET /brands/me/listing-template/columns — get column definitions (for frontend preview)
const getTemplateColumns = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const columns = excelService.getColumnsForCategory(brand.category);
  return success(res, { columns, category: brand.category });
});

module.exports = {
  register, getMe, updateMe, getById, updateStatus, resubmit,
  getCategorySchema, getMasterCatalogue, searchDishes,
  listProducts, createProduct, updateProduct, deleteProduct, getTagOptions,
  listBrandOrders, listAllTransactions, getPublicProfile, storePreview,
  getListingConfig, getQualityScore, getListingPreview,
  downloadListingTemplate, bulkUploadProducts, getTemplateColumns,
};
