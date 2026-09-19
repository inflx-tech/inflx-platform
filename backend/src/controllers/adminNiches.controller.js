'use strict';

/**
 * adminNiches.controller.js — the "Other" niche queue (spec §3.3, §9A.3).
 * Contract: features/registration-and-profile
 *
 * A creator who chose Other typed what she makes. Admin either maps her to a niche that
 * already exists, or adds a new niche to the reference list and maps her to it. That is the
 * only way the niche list grows. Until she is mapped she is matched by every rule that does
 * not filter on niche and by none that do.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const ref = require('../services/referenceLists.service');

const CODE_RE = /^[a-z][a-z0-9_]{1,39}$/;

// GET /admin/niches/other — every creator still on Other, oldest first
const listOther = asyncHandler(async (_req, res) => {
  const { rows } = await db.query(
    `SELECT i.id AS influencer_id, COALESCE(i.full_name, u.name) AS full_name, i.instagram_handle, i.youtube_handle,
            i.niche_other, i.created_at, rc.name AS city_name, rs.name AS state_name, u.status AS user_status
       FROM influencers i
       JOIN users u ON u.id = i.user_id
       LEFT JOIN ref_cities rc ON rc.id = i.city_id
       LEFT JOIN ref_states rs ON rs.id = i.state_id
      WHERE i.niche_other IS NOT NULL AND i.niche_other_resolved_at IS NULL AND i.niche @> ARRAY['other']::varchar[]
      ORDER BY i.created_at ASC`);
  return success(res, { items: rows, niches: await ref.creatorNiches() });
});

async function mapCreator(influencerId, code, adminId) {
  const { rows } = await db.query(`SELECT id, niche, niche_other FROM influencers WHERE id = $1`, [influencerId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Creator not found', 404);
  await db.query(
    `UPDATE influencers SET niche = ARRAY[$2]::varchar[], niche_other_resolved_at = now(), updated_at = now() WHERE id = $1`,
    [influencerId, code]);
  return { influencer_id: influencerId, niche: [code], was: rows[0].niche_other };
}

// POST /admin/niches/other/:influencerId/map { code }
const mapToExisting = asyncHandler(async (req, res) => {
  const code = String(req.body.code || '').trim();
  if (!code || code === 'other') throw new AppError('VALIDATION_ERROR', 'Pick a niche from the list.', 422, 'code');
  const bad = ref.unknownCodes([code], await ref.creatorNiches());
  if (bad.length) throw new AppError('VALIDATION_ERROR', 'Pick a niche from the list.', 422, 'code');
  return success(res, await mapCreator(req.params.influencerId, code, req.user.sub));
});

// POST /admin/niches { code, label, influencer_id? } — add a niche; map the creator when given
const createNiche = asyncHandler(async (req, res) => {
  const label = String(req.body.label || '').trim();
  let code = String(req.body.code || '').trim().toLowerCase();
  if (!label) throw new AppError('VALIDATION_ERROR', 'Give the new niche a name.', 422, 'label');
  if (!code) code = label.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  if (!CODE_RE.test(code)) throw new AppError('VALIDATION_ERROR', 'The code must be letters, digits and underscores, starting with a letter.', 422, 'code');
  if (code === 'other') throw new AppError('VALIDATION_ERROR', "'other' is reserved.", 422, 'code');
  const { rows: dup } = await db.query(`SELECT code FROM ref_creator_niches WHERE code = $1 OR lower(label) = lower($2)`, [code, label]);
  if (dup.length) throw new AppError('CONFLICT', 'That niche already exists.', 409, 'code');
  const { rows: mx } = await db.query(`SELECT COALESCE(MAX(sort), 0)::int AS m FROM ref_creator_niches WHERE code <> 'other'`);
  const { rows } = await db.query(
    `INSERT INTO ref_creator_niches (code, label, sort, active) VALUES ($1, $2, $3, true) RETURNING code, label, sort`,
    [code, label, mx[0].m + 1]);
  ref.invalidate();
  const out = { niche: rows[0] };
  if (req.body.influencer_id) out.mapped = await mapCreator(req.body.influencer_id, code, req.user.sub);
  return success(res, out, 201);
});

module.exports = { listOther, mapToExisting, createNiche };
