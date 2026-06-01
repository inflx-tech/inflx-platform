'use strict';

/**
 * Referral controller (non-admin) — the code-redeem flow.
 * Contract: features/referral-agency-role (Contract 3a).
 *
 * A referred entity (brand or influencer) redeems a referrer's code to create
 * the referral edge. The signup UI that calls this lands in Contract 3b; until
 * then admin-created edges (Contract 2) also attach referrals.
 */

const db = require('../config/db');
const referralService = require('../services/referral.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Resolve the caller's referred entity (brand/influencer) from their user id.
async function resolveCallerEntity(user) {
  if (user.role === 'brand') {
    const { rows } = await db.query(`SELECT id FROM brands WHERE user_id = $1`, [user.sub]);
    if (rows[0]) return { referredType: 'brand', referredId: rows[0].id };
  } else if (user.role === 'influencer') {
    const { rows } = await db.query(`SELECT id FROM influencers WHERE user_id = $1`, [user.sub]);
    if (rows[0]) return { referredType: 'influencer', referredId: rows[0].id };
  }
  return null;
}

// POST /referrals/redeem  { code }
const redeemCode = asyncHandler(async (req, res) => {
  const code = (req.body?.code || '').trim();
  if (!code) throw new AppError('VALIDATION_ERROR', 'code is required', 422, 'code');

  const entity = await resolveCallerEntity(req.user);
  if (!entity) {
    throw new AppError('VALIDATION_ERROR', 'Only a registered brand or influencer can redeem a referral code', 422);
  }

  const codeRow = await referralService.lookupCode(code);
  if (!codeRow) throw new AppError('NOT_FOUND', 'Referral code not found', 404, 'code');

  // pct defaults to the global setting (Contract 2).
  const { rows: cfg } = await db.query(`SELECT default_pct FROM referral_settings WHERE id = 1`);
  const pct = cfg[0] ? parseFloat(cfg[0].default_pct) : 25.00;

  try {
    const edge = await referralService.createEdge({
      referrerType: codeRow.referrer_type,
      referrerId: codeRow.referrer_id,
      referredType: entity.referredType,
      referredId: entity.referredId,
      pct,
      source: 'signup',
      codeId: codeRow.id,
    });
    return success(res, {
      edge_id: edge.id,
      referrer_type: edge.referrer_type,
      pct: parseFloat(edge.pct),
      started_at: edge.started_at,
      expires_at: edge.expires_at,
    }, 201);
  } catch (err) {
    if (err && err.code === '23505') {
      throw new AppError('VALIDATION_ERROR', 'You already have an active referrer — a code can only be applied once.', 409);
    }
    throw err; // self/circular/validation AppError passes through
  }
});

module.exports = { redeemCode };
