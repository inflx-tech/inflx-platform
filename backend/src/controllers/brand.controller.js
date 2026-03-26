'use strict';

const db = require('../config/db');
const notificationService = require('../services/notification.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

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

module.exports = { register, getMe, updateMe, getById, updateStatus, resubmit };
