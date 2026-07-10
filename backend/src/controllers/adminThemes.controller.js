'use strict';

/**
 * adminThemes.controller.js — Theme Library (Creator Experience Engine Phase 2,
 * features/theme-library/, migrations 129-130). Admin CRUD + publish over
 * experience_themes. Admin-only via the 'sections' capability (same
 * engine-authoring surface as Phase 1 / App Builder). Reuses theme.service.
 */

const themes = require('../services/theme.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// GET /v1/admin/themes?world_key=&status=
const list = asyncHandler(async (req, res) => {
  const rows = await themes.listThemes({ world_key: req.query.world_key, status: req.query.status });
  return success(res, { themes: rows });
});

// GET /v1/admin/themes/blueprints?world_key=
const blueprints = asyncHandler(async (req, res) => {
  const rows = await themes.listBlueprints({ world_key: req.query.world_key });
  return success(res, { blueprints: rows });
});

// GET /v1/admin/themes/:id
const getOne = asyncHandler(async (req, res) => {
  const t = await themes.getTheme(req.params.id);
  if (!t) throw new AppError('NOT_FOUND', 'theme not found', 404);
  return success(res, { theme: t });
});

// POST /v1/admin/themes   { world_key, from_blueprint_key?, ...overrides }
const create = asyncHandler(async (req, res) => {
  let t;
  try { t = await themes.createTheme(req.body || {}); }
  catch (e) { throw new AppError('VALIDATION_ERROR', e.message, 422, e.field); }
  return success(res, { theme: t }, 201);
});

// PATCH /v1/admin/themes/:id
const update = asyncHandler(async (req, res) => {
  const t = await themes.updateTheme(req.params.id, req.body || {});
  if (!t) throw new AppError('NOT_FOUND', 'theme not found (or is a blueprint)', 404);
  return success(res, { theme: t });
});

// POST /v1/admin/themes/:id/publish
const publish = asyncHandler(async (req, res) => {
  const out = await themes.publishTheme(req.params.id);
  if (out.notFound) throw new AppError('NOT_FOUND', 'theme not found', 404);
  if (out.error) throw new AppError('VALIDATION_ERROR', out.error.message, 422, out.error.field);
  return success(res, { theme: out.theme });
});

module.exports = { list, blueprints, getOne, create, update, publish };
