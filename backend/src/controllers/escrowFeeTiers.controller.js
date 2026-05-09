'use strict';

/**
 * escrowFeeTiers.controller.js  —  Phase B1 (M037)
 *
 * Admin CRUD for L2 Campaign Protection Fee tiers.
 *
 * Endpoints (mounted under /admin via admin.routes.js):
 *   GET    /admin/escrow-fee-tiers
 *   POST   /admin/escrow-fee-tiers           (superadmin)
 *   PATCH  /admin/escrow-fee-tiers/:tierKey  (superadmin)
 *   DELETE /admin/escrow-fee-tiers/:tierKey  (superadmin)
 */

const db             = require('../config/db');
const pricingService = require('../services/pricing.service');
const { success }    = require('../utils/response');
const AppError       = require('../utils/AppError');
const asyncHandler   = require('../utils/asyncHandler');

function _validateTierBody(body, { partial = false } = {}) {
  const errors = [];
  if (!partial || body.tier_key !== undefined) {
    if (!body.tier_key || typeof body.tier_key !== 'string' || body.tier_key.length > 40) {
      errors.push('tier_key must be a non-empty string up to 40 chars');
    }
  }
  if (!partial || body.min_amount_inr !== undefined) {
    const m = parseFloat(body.min_amount_inr);
    if (isNaN(m) || m < 0) errors.push('min_amount_inr must be ≥ 0');
  }
  if (body.max_amount_inr !== undefined && body.max_amount_inr !== null && body.max_amount_inr !== '') {
    const x = parseFloat(body.max_amount_inr);
    if (isNaN(x) || x < 0) errors.push('max_amount_inr must be ≥ 0 or null');
  }
  if (!partial || body.fee_pct !== undefined) {
    const p = parseFloat(body.fee_pct);
    if (isNaN(p) || p < 0 || p > 50) errors.push('fee_pct must be 0–50');
  }
  return errors;
}

const list = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, tier_key, min_amount_inr, max_amount_inr, fee_pct, description,
            sort_order, updated_at, updated_by
       FROM escrow_fee_tiers
       ORDER BY sort_order ASC, min_amount_inr ASC`
  );
  return success(res, { tiers: rows });
});

const create = asyncHandler(async (req, res) => {
  const errs = _validateTierBody(req.body);
  if (errs.length) throw new AppError('VALIDATION_ERROR', errs.join('; '), 422);

  const {
    tier_key, min_amount_inr, max_amount_inr, fee_pct,
    description = null, sort_order = 0,
  } = req.body;

  const maxVal = (max_amount_inr === null || max_amount_inr === '' || max_amount_inr === undefined)
    ? null : parseFloat(max_amount_inr);

  const { rows } = await db.query(
    `INSERT INTO escrow_fee_tiers
       (tier_key, min_amount_inr, max_amount_inr, fee_pct, description, sort_order, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [tier_key, parseFloat(min_amount_inr), maxVal, parseFloat(fee_pct), description, parseInt(sort_order, 10) || 0, req.user.sub]
  ).catch(err => {
    if (err.code === '23505') throw new AppError('VALIDATION_ERROR', `tier_key '${tier_key}' already exists`, 422, 'tier_key');
    throw err;
  });

  pricingService.bustEscrowTierCache();
  return success(res, { tier: rows[0] });
});

const update = asyncHandler(async (req, res) => {
  const { tierKey } = req.params;
  const errs = _validateTierBody(req.body, { partial: true });
  if (errs.length) throw new AppError('VALIDATION_ERROR', errs.join('; '), 422);

  const allowed = ['min_amount_inr', 'max_amount_inr', 'fee_pct', 'description', 'sort_order'];
  const sets = [];
  const params = [];
  for (const k of allowed) {
    if (req.body[k] !== undefined) {
      params.push(k === 'max_amount_inr' && (req.body[k] === null || req.body[k] === '')
        ? null
        : req.body[k]);
      sets.push(`${k} = $${params.length}`);
    }
  }
  if (!sets.length) throw new AppError('VALIDATION_ERROR', 'No editable fields supplied', 422);
  sets.push(`updated_at = now()`);
  params.push(req.user.sub);
  sets.push(`updated_by = $${params.length}`);
  params.push(tierKey);

  const { rows } = await db.query(
    `UPDATE escrow_fee_tiers SET ${sets.join(', ')} WHERE tier_key = $${params.length} RETURNING *`,
    params
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', `Tier '${tierKey}' not found`, 404);

  pricingService.bustEscrowTierCache();
  return success(res, { tier: rows[0] });
});

const remove = asyncHandler(async (req, res) => {
  const { tierKey } = req.params;
  const { rows } = await db.query(
    `DELETE FROM escrow_fee_tiers WHERE tier_key = $1 RETURNING tier_key`,
    [tierKey]
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', `Tier '${tierKey}' not found`, 404);

  pricingService.bustEscrowTierCache();
  return success(res, { deleted: rows[0].tier_key });
});

module.exports = { list, create, update, remove };
