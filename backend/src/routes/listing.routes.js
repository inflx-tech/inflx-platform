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
publicRouter.get('/nodes/:id/children', ctrl.getNodeChildren);   // contract: listing-category-browser (Type-1 rail)
publicRouter.get('/nodes/:id/products', ctrl.getNodeProducts);   // contract: listing-category-browser (Type-1 grid + filters)
publicRouter.get('/nodes/:id/template.xlsx', ctrl.downloadTemplate);   // contract: listing-excel-bulk
publicRouter.post('/nodes/:id/import', authenticate, requireRole('brand'), upload.single('file'), ctrl.importProducts);
publicRouter.post('/ingest-image', authenticate, requireRole('brand'), ctrl.ingestImage);   // contract: listing-image-urls
publicRouter.post('/products/:id/cover-photos', authenticate, requireRole('brand'), ctrl.setProductCoverPhotos);
publicRouter.get('/brands', ctrl.getBrands);

const brandRouter = Router();
brandRouter.use(authenticate);
brandRouter.use(requireRole('brand'));
brandRouter.post('/products/batch', ctrl.batchCreate);
// contract: listing-fashion-inventory-browse — brand's own inventory browse
brandRouter.get('/listing-tree', ctrl.getMyListingTree);
brandRouter.get('/listing-nodes/:id/products', ctrl.getMyNodeProducts);
// contract: listing-bulk-move-and-offer — bulk re-file products under another
// item type. Declared before the /:id routes so "move" is never read as an id.
brandRouter.post('/listing-products/move', ctrl.moveListingProducts);
// contract: listing-product-edit — view + edit one drill-down product
brandRouter.get('/listing-products/:id', ctrl.getListingProduct);
brandRouter.patch('/listing-products/:id', ctrl.updateListingProduct);

module.exports = { publicRouter, brandRouter };
