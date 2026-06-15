'use strict';

/**
 * adminCollectionLibrary.controller.js — admin CRUD for the Collection Library
 * (Phase 4b). Contract: features/merch-engine-p4b-collection-builder.
 * requireAnyAdminRole. A collection = {name, business_type?, image_url?, ordered
 * section_ids[]}; placed via App Sections, rendered by the 4a engine.
 */

const collectionLibrary = require('../services/collectionLibrary.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// GET /v1/admin/collection-library
const list = asyncHandler(async (req, res) => {
  const collections = await collectionLibrary.listCollections();
  return success(res, { collections });
});

// POST /v1/admin/collection-library
const create = asyncHandler(async (req, res) => {
  let collection;
  try { collection = await collectionLibrary.createCollection(req.body || {}); }
  catch (e) { throw new AppError('VALIDATION_ERROR', e.message, 422); }
  return success(res, { collection }, 201);
});

// PATCH /v1/admin/collection-library/:id
const update = asyncHandler(async (req, res) => {
  let collection;
  try { collection = await collectionLibrary.updateCollection(req.params.id, req.body || {}); }
  catch (e) { throw new AppError('VALIDATION_ERROR', e.message, 422); }
  if (!collection) throw new AppError('NOT_FOUND', 'collection not found', 404);
  return success(res, { collection });
});

module.exports = { list, create, update };
