'use strict';

/**
 * influencerExperiences.controller.js — Creator Experience Studio API
 * (Creator Experience Engine Phase 6a, features/creator-experiences/, mig 135).
 * Auth: requireRole('influencer'). Creator instantiates a placed Template into
 * a live Experience (template + products + featured image), then publishes.
 */

const db = require('../config/db');
const svc = require('../services/experience.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

async function getInfluencerId(userId) {
  const { rows } = await db.query(`SELECT id FROM influencers WHERE user_id = $1`, [userId]);
  return rows[0]?.id || null;
}
async function meId(req) {
  const id = await getInfluencerId(req.user.sub);
  if (!id) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  return id;
}

// GET /v1/influencers/me/experience-templates?world_key=
const listTemplates = asyncHandler(async (req, res) => {
  await meId(req);
  return success(res, { templates: await svc.listAvailableTemplates(req.query.world_key || 'fashion') });
});

// GET /v1/influencers/me/experience-stockable?world_key=
const listStockable = asyncHandler(async (req, res) => {
  const id = await meId(req);
  return success(res, { products: await svc.listStockable(id, req.query.world_key || 'fashion') });
});

// POST /v1/influencers/me/experiences  { template_id, product_ids[], featured_image_url }
const create = asyncHandler(async (req, res) => {
  const id = await meId(req);
  let e;
  try { e = await svc.createExperience(id, req.body || {}); }
  catch (x) { throw new AppError('VALIDATION_ERROR', x.message, 422, x.field); }
  return success(res, { experience: e }, 201);
});

// POST /v1/influencers/me/experiences/:id/publish
const publish = asyncHandler(async (req, res) => {
  const id = await meId(req);
  const out = await svc.publishExperience(req.params.id, id);
  if (out.notFound) throw new AppError('NOT_FOUND', 'experience not found', 404);
  if (out.error) throw new AppError('VALIDATION_ERROR', out.error.message, 422, out.error.field);
  return success(res, { experience: out.experience });
});

// GET /v1/influencers/me/experiences
const listMine = asyncHandler(async (req, res) => {
  const id = await meId(req);
  return success(res, { experiences: await svc.listMyExperiences(id) });
});

module.exports = { listTemplates, listStockable, create, publish, listMine };
