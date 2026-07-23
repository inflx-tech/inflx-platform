'use strict';

/**
 * adminConcepts.controller.js — Concept Template Manager + Collections
 * vocabulary (Post/Concept P1, mig 139). Contract: features/concept-p1-engine/.
 * Thin wrappers over concepts.service; validation errors → 422.
 */

const concepts = require('../services/concepts.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// GET /v1/admin/concept-templates?kind=&include_hidden=1
const listTemplates = asyncHandler(async (req, res) => {
  const templates = await concepts.listTemplates({
    kind: req.query.kind || null,
    includeHidden: req.query.include_hidden === '1',
  });
  return success(res, { templates });
});

// POST /v1/admin/concept-templates
const createTemplate = asyncHandler(async (req, res) => {
  let template;
  try { template = await concepts.createTemplate(req.body || {}); }
  catch (e) {
    if (e.code === '23505') throw new AppError('VALIDATION_ERROR', 'a template with this name already exists', 422);
    throw new AppError('VALIDATION_ERROR', e.message, 422);
  }
  return success(res, { template }, 201);
});

// PATCH /v1/admin/concept-templates/:id
const updateTemplate = asyncHandler(async (req, res) => {
  let template;
  try { template = await concepts.updateTemplate(req.params.id, req.body || {}); }
  catch (e) { throw new AppError('VALIDATION_ERROR', e.message, 422); }
  if (!template) throw new AppError('NOT_FOUND', 'template not found', 404);
  return success(res, { template });
});

// POST /v1/admin/concepts/preview  { template_id, category_node_id? }
const previewConcept = asyncHandler(async (req, res) => {
  let result;
  try {
    result = await concepts.previewConcept({
      template_id: req.body && req.body.template_id,
      category_node_id: (req.body && req.body.category_node_id) || null,
    });
  } catch (e) { throw new AppError('VALIDATION_ERROR', e.message, 422); }
  return success(res, result);
});

// GET /v1/admin/collections?include_hidden=1
const listCollections = asyncHandler(async (req, res) => {
  const collections = await concepts.listCollections({
    includeHidden: req.query.include_hidden === '1',
  });
  return success(res, { collections });
});

// POST /v1/admin/collections
const createCollection = asyncHandler(async (req, res) => {
  let collection;
  try { collection = await concepts.createCollection(req.body || {}); }
  catch (e) {
    if (e.code === '23505') throw new AppError('VALIDATION_ERROR', 'a collection with this name already exists', 422);
    throw new AppError('VALIDATION_ERROR', e.message, 422);
  }
  return success(res, { collection }, 201);
});

// PATCH /v1/admin/collections/:id
const updateCollection = asyncHandler(async (req, res) => {
  let collection;
  try { collection = await concepts.updateCollection(req.params.id, req.body || {}); }
  catch (e) { throw new AppError('VALIDATION_ERROR', e.message, 422); }
  if (!collection) throw new AppError('NOT_FOUND', 'collection not found', 404);
  return success(res, { collection });
});

module.exports = {
  listTemplates, createTemplate, updateTemplate, previewConcept,
  listCollections, createCollection, updateCollection,
};
