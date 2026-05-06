'use strict';

const fs   = require('fs');
const path = require('path');
const db   = require('../config/db');
const notificationService = require('../services/notification.service');
const { success } = require('../utils/response');
const AppError    = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// ─────────────────────────────────────────────────────────────────────────────
// Schema service — reads JSON from local public/schemas/{category_key}.json
// Falls back to a minimal schema for unknown categories.
// ─────────────────────────────────────────────────────────────────────────────

const schemaCache = new Map();

function loadSchema(categoryKey) {
  if (!categoryKey) return null;
  const key = categoryKey.toLowerCase().replace(/\s+/g, '_');
  if (schemaCache.has(key)) return schemaCache.get(key);

  const filePath = path.join(__dirname, '../../public/schemas', `${key}.json`);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const schema = JSON.parse(raw);
    schemaCache.set(key, schema);
    return schema;
  } catch {
    // Schema file not found — return a minimal generic schema
    const generic = {
      category_key: key,
      label: key.replace(/_/g, ' '),
      icon: '🏪',
      product_noun: 'Product',
      product_noun_plural: 'Products',
      features: { sections: false, veg_flag: false, duration_mins: false, stock: true, booking: false, enquiry_only: false },
      sections: [],
      availing_modes: ['pay_at_store'],
      fields: [
        { key: 'name',      label: 'Name',        type: 'text',     required: true  },
        { key: 'price',     label: 'Price (₹)',   type: 'number',   required: true  },
        { key: 'description', label: 'Description', type: 'textarea', required: false },
        { key: 'image_url', label: 'Image URL',   type: 'url',      required: false },
      ],
      buyer_config: { cta_label: 'Buy Now' },
    };
    schemaCache.set(key, generic);
    return generic;
  }
}

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
  const { business_name, category, gstin, address_line, pincode } = req.body;

  if (!business_name || !business_name.trim()) {
    throw new AppError('VALIDATION_ERROR', 'business_name is required', 422, 'business_name');
  }
  if (!category || !category.trim()) {
    throw new AppError('VALIDATION_ERROR', 'category is required', 422, 'category');
  }

  // Idempotency: disallow duplicate registration
  const existing = await getBrandByUserId(userId);
  if (existing) {
    throw new AppError('CONFLICT', 'Brand profile already exists for this account', 409);
  }

  const { rows } = await db.query(
    `INSERT INTO brands (user_id, business_name, category, gstin, address_line, pincode)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, business_name.trim(), category.trim(), gstin || null, address_line || null, pincode || null]
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

const updateMe = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found. Please register first.', 404);

  // Whitelist of updatable fields
  const allowed = ['business_name', 'category', 'gstin', 'address_line', 'pincode', 'logo_url', 'latitude', 'longitude', 'listing_data'];
  const updates = {};
  allowed.forEach(field => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  // Auto-extract lat/lng from Google Maps URL if provided
  if (req.body.google_maps_url) {
    const coords = locationService.extractLatLng(req.body.google_maps_url);
    if (coords) {
      updates.latitude = coords.latitude;
      updates.longitude = coords.longitude;
    }
  }

  // If listing_data has google_maps_url, extract from there too
  if (req.body.listing_data?.google_maps_url) {
    const coords = locationService.extractLatLng(req.body.listing_data.google_maps_url);
    if (coords) {
      updates.latitude = coords.latitude;
      updates.longitude = coords.longitude;
    }
  }

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
            booking_config_json, created_at, updated_at
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
    master_vehicle_id, master_service_id,
  } = req.body;

  // For master-catalogue activations, skip schema validation (name/image come from master)
  const isMasterActivation = master_vehicle_id != null || master_service_id != null;
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
        master_vehicle_id, master_service_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,$13,$14,$15,$16,$17)
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
    ]
  );

  return success(res, { product: rows[0] }, 201);
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
                   'availability_json','booking_config_json'];

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

  const { rows } = await db.query(
    `DELETE FROM brand_products WHERE id = $1 AND brand_id = $2 RETURNING id`,
    [req.params.pid, brand.id]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Product not found', 404);
  return success(res, { message: 'Product deleted' });
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
       ft.net_amount, ft.influencer_commission, ft.platform_fee, ft.brand_net,
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
       COALESCE(SUM(ft.platform_fee), 0)::bigint AS total_platform_fee,
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
  // In dev, clear both schema caches so file changes are picked up without restart
  if (process.env.NODE_ENV !== 'production') {
    listingService.clearSchemaCache();
    schemaCache.clear();
  }

  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  const config = listingService.getConfigForCategory(brand.category);
  if (!config) throw new AppError('NOT_FOUND', `No config for category: ${brand.category}`, 404);

  const isActive = listingService.isCategoryActive(brand.category);

  return success(res, {
    config,
    listing_engine_active: isActive,
    current_phase: listingService.LISTING_ENGINE_PHASE,
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

  const wb = await excelService.generateTemplate(brand.category, brand.business_name);
  const schema = listingService.getConfigForCategory(brand.category);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=INFLX_${(schema?.label || brand.category).replace(/\s+/g, '_')}_Template.xlsx`);

  await wb.xlsx.write(res);
  res.end();
});

// POST /brands/me/products/bulk-upload — parse Excel and create products
const bulkUploadProducts = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);

  if (!req.file) throw new AppError('VALIDATION_ERROR', 'No file uploaded', 400);

  const { rows, errors, totalParsed } = await excelService.parseUpload(req.file.buffer, brand.category);

  if (errors.length > 0 && rows.length === 0) {
    return success(res, { created: 0, errors, totalParsed }, 400);
  }

  // Convert parsed rows to product payloads and insert
  const products = excelService.rowsToProducts(rows, brand.category);
  const created = [];

  for (const product of products) {
    const { rows: [newProd] } = await db.query(
      `INSERT INTO brand_products (brand_id, name, price, section, description, image_url, veg_flag,
        variants_json, is_active, is_bookable, category_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10)
       RETURNING id, name, price, section`,
      [brand.id, product.name, product.price, product.section, product.description || '',
       product.image_url || '', product.veg_flag || 'na',
       product.variants_json || null, product.is_bookable || false, brand.category]
    );
    created.push(newProd);
  }

  return success(res, {
    created: created.length,
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
  getCategorySchema, getMasterCatalogue,
  listProducts, createProduct, updateProduct, deleteProduct,
  listBrandOrders, listAllTransactions, getPublicProfile, storePreview,
  getListingConfig, getQualityScore, getListingPreview,
  downloadListingTemplate, bulkUploadProducts, getTemplateColumns,
};
