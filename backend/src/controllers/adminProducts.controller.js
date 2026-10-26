'use strict';

/**
 * adminProducts.controller.js — the Product Queue (features/product-approval-switch, spec §5).
 * Mounted at /v1/admin/products. Admin-only, capability `approvals`, like the Post Queue.
 */

const productApproval = require('../services/productApproval.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// GET /v1/admin/products?status=pending|approved|rejected&limit=&offset=
const list = asyncHandler(async (req, res) => {
  let result;
  try {
    result = await productApproval.listQueue({ status: req.query.status || 'pending', limit: req.query.limit, offset: req.query.offset });
  } catch (e) { throw new AppError('VALIDATION_ERROR', e.message, 422, 'status'); }
  return success(res, result);
});

// POST /v1/admin/products/:id/approve
const approve = asyncHandler(async (req, res) => {
  const product = await productApproval.decide(req.params.id, req.user.sub, true, null);
  if (!product) throw new AppError('NOT_FOUND', 'Product not found or not waiting for approval', 404);
  return success(res, { product });
});

// POST /v1/admin/products/:id/reject  { reason }  — the reason is required (D10)
const reject = asyncHandler(async (req, res) => {
  const reason = String((req.body && req.body.reason) || '').trim();
  if (!reason) throw new AppError('VALIDATION_ERROR', 'Give the brand a reason.', 422, 'reason');
  const product = await productApproval.decide(req.params.id, req.user.sub, false, reason);
  if (!product) throw new AppError('NOT_FOUND', 'Product not found or not waiting for approval', 404);
  return success(res, { product });
});

module.exports = { list, approve, reject };
