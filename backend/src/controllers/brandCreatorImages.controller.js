'use strict';

/**
 * brandCreatorImages.controller.js — brand approves creator product photos +
 * chooses whose photo shows in its own store (Creator Experience Engine Phase
 * 7a, features/creator-imagery/). Auth: requireRole('brand'). Flag-gated at the
 * resolver (CREATOR_IMAGERY) — approvals just set data until enabled.
 */

const db = require('../config/db');
const imagery = require('../services/creatorImagery.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

async function getBrandId(userId) {
  const { rows } = await db.query(`SELECT id FROM brands WHERE user_id = $1`, [userId]);
  return rows[0]?.id || null;
}
async function meBrand(req) {
  const id = await getBrandId(req.user.sub);
  if (!id) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  return id;
}

// GET /v1/brands/me/creator-images?status=pending
const queue = asyncHandler(async (req, res) => {
  const brandId = await meBrand(req);
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  return success(res, { images: await imagery.approvalQueue(brandId, status) });
});

// POST /v1/brands/me/creator-images/:id/approve  |  /reject
const approve = asyncHandler(async (req, res) => reviewHandler(req, res, true));
const reject = asyncHandler(async (req, res) => reviewHandler(req, res, false));
async function reviewHandler(req, res, ok) {
  const brandId = await meBrand(req);
  const out = await imagery.reviewImage(brandId, req.params.id, ok);
  if (out.notFound) throw new AppError('NOT_FOUND', 'creator image not found', 404);
  return success(res, { status: out.status });
}

// PATCH /v1/brands/me/products/:id/image-source  { influencer_id | null }
const setSource = asyncHandler(async (req, res) => {
  const brandId = await meBrand(req);
  const out = await imagery.setImageSource(brandId, req.params.id, (req.body && req.body.influencer_id) || null);
  if (out.notFound) throw new AppError('NOT_FOUND', 'product not found', 404);
  return success(res, { ok: true });
});

module.exports = { queue, approve, reject, setSource };
