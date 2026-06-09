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
const ctrl = require('../controllers/listing.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const publicRouter = Router();
publicRouter.get('/tree', ctrl.getTree);
publicRouter.get('/nodes/:id/facets', ctrl.getNodeFacets);

const brandRouter = Router();
brandRouter.use(authenticate);
brandRouter.use(requireRole('brand'));
brandRouter.post('/products/batch', ctrl.batchCreate);

module.exports = { publicRouter, brandRouter };
