'use strict';

/**
 * discovery.routes.js — Item 3: Discover creators, Worked with, Find brands, place
 * resolution, branches, brand products, reference cities.
 * Contract: features/item3-discovery-profiles-groups
 *
 * Mounted at '/' BEFORE brand.routes and influencer.routes (routes/index.js) so the fixed
 * /brands/me/... and /brands/:id/products paths are never shadowed.
 */

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/discovery.controller');

const router = Router();
const brand   = [authenticate, requireRole('brand')];
const creator = [authenticate, requireRole('influencer')];

// A5, A7 — brand finds creators
router.get('/brands/me/discover-creators', ...brand, ctrl.discoverCreators);
router.get('/brands/me/worked-with',       ...brand, ctrl.workedWith);

// A2 — branches
router.get   ('/brands/me/branches',               ...brand, ctrl.listBranches);
router.post  ('/brands/me/branches',               ...brand, ctrl.createBranch);
router.put   ('/brands/me/branches/:id',           ...brand, ctrl.updateBranch);
router.post  ('/brands/me/branches/:id/make-main', ...brand, ctrl.makeMainBranch);
router.delete('/brands/me/branches/:id',           ...brand, ctrl.removeBranch);

// A9 — creator finds brands
router.get('/influencers/me/find-brands', ...creator, ctrl.findBrands);

// A11 — a brand's published products (creator or the brand itself)
router.get('/brands/:id/products',            authenticate, ctrl.listBrandProducts);
router.get('/brands/:id/products/:productId', authenticate, ctrl.brandProductDetail);

// A3 — Google place → canonical state + city (adds the city when new)
router.post('/places/resolve', authenticate, ctrl.resolvePlace);

// A13 — cities by id
router.get('/reference/cities', authenticate, ctrl.citiesByIds);

module.exports = router;
