'use strict';

/**
 * adminTemplates.controller.js — Experience Templates (Creator Experience Engine
 * Phase 5, features/experience-templates/, migrations 133-134). Admin CRUD +
 * place/unplace over experience_templates. Admin-only via 'sections' capability.
 */

const templates = require('../services/template.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// GET /v1/admin/experience-templates?world_key=&status=
const list = asyncHandler(async (req, res) => {
  const rows = await templates.listTemplates({ world_key: req.query.world_key, status: req.query.status });
  return success(res, { templates: rows });
});

// GET /v1/admin/experience-templates/:id
const getOne = asyncHandler(async (req, res) => {
  const t = await templates.getTemplate(req.params.id);
  if (!t) throw new AppError('NOT_FOUND', 'template not found', 404);
  return success(res, { template: t });
});

// POST /v1/admin/experience-templates
const create = asyncHandler(async (req, res) => {
  let t;
  try { t = await templates.createTemplate(req.body || {}); }
  catch (e) { throw new AppError('VALIDATION_ERROR', e.message, 422, e.field); }
  return success(res, { template: t }, 201);
});

// PATCH /v1/admin/experience-templates/:id
const update = asyncHandler(async (req, res) => {
  let t;
  try { t = await templates.updateTemplate(req.params.id, req.body || {}); }
  catch (e) { throw new AppError('VALIDATION_ERROR', e.message, 422, e.field); }
  if (!t) throw new AppError('NOT_FOUND', 'template not found', 404);
  return success(res, { template: t });
});

// POST /v1/admin/experience-templates/:id/place
const place = asyncHandler(async (req, res) => {
  const out = await templates.placeTemplate(req.params.id);
  if (out.notFound) throw new AppError('NOT_FOUND', 'template not found', 404);
  return success(res, { section: out.section }, 200, { note: 'renders empty until creators publish experiences (Phase 6)' });
});

// POST /v1/admin/experience-templates/:id/unplace
const unplace = asyncHandler(async (req, res) => {
  const out = await templates.unplaceTemplate(req.params.id);
  if (out.notFound) throw new AppError('NOT_FOUND', 'template not found', 404);
  return success(res, { unplaced: true });
});

module.exports = { list, getOne, create, update, place, unplace };
