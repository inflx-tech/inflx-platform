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

const updateMe = asyncHandler(async (req, res) => {
  const brand = await getBrandByUserId(req.user.sub);
  if (!brand) throw new AppError('NOT_FOUND', 'Brand profile not found. Please register first.', 404);

  // Whitelist of updatable fields
  const allowed = ['business_name', 'category', 'gstin', 'address_line', 'pincode', 'logo_url'];
  const updates = {};
  allowed.forEach(field => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

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

module.exports = {
  register, getMe, updateMe, getById, updateStatus, resubmit,
  getCategorySchema, getMasterCatalogue,
  listProducts, createProduct, updateProduct, deleteProduct,
  listBrandOrders, getPublicProfile, storePreview,
};
