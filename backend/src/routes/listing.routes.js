'use strict';

/**
 * listing.routes.js — drill-down listing engine
 * (contract: features/listing-drilldown-taxonomy-engine).
 *
 * publicRouter (mounted at /listing):
 *   GET  /listing/tree?vertical=fashion
 *   GET  /listing/nodes/:id/facets
 * brandRouter (mounted at /brands/me, authenticated brand):
 *   POST /brands/me/products/batch
 */

const { Router } = require('express');
const multer = require('multer');
const ctrl = require('../controllers/listing.controller');
const { authenticate, requireRole } = require('../middleware/auth');

// In-memory upload for the Excel/CSV bulk import (parsed, never persisted to disk).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const publicRouter = Router();
publicRouter.get('/tree', ctrl.getTree);
publicRouter.get('/nodes/:id/facets', ctrl.getNodeFacets);
publicRouter.get('/nodes/:id/template.xlsx', ctrl.downloadTemplate);   // contract: listing-excel-bulk
publicRouter.post('/nodes/:id/import', authenticate, requireRole('brand'), upload.single('file'), ctrl.importProducts);
publicRouter.get('/brands', ctrl.getBrands);

const brandRouter = Router();
brandRouter.use(authenticate);
brandRouter.use(requireRole('brand'));
brandRouter.post('/products/batch', ctrl.batchCreate);

module.exports = { publicRouter, brandRouter };
