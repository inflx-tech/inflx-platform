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
const { authenticate, requireRole, requireApproved } = require('../middleware/auth');
const ctrl = require('../controllers/discovery.controller');

const router = Router();
// registration-and-profile §6.5 (founder decision 18): a pending brand is inside the app now and
// may reach home, profile and wallet only — campaigns, creators, groups, pitches and the pool
// answer ACCOUNT_PENDING until admin approves.
const brand   = [authenticate, requireRole('brand'), requireApproved];
// Branches are profile, not an action: a pending brand keeps editing its address (spec §6.5).
const brandAny = [authenticate, requireRole('brand')];
const creator = [authenticate, requireRole('influencer')];

// A5, A7 — brand finds creators
router.get('/brands/me/discover-creators', ...brand, ctrl.discoverCreators);
router.get('/brands/me/worked-with',       ...brand, ctrl.workedWith);

// A2 — branches
router.get   ('/brands/me/branches',                        ...brandAny, ctrl.listBranches);
router.post  ('/brands/me/branches',                        ...brandAny, ctrl.createBranch);
router.put   ('/brands/me/branches/:id',                    ...brandAny, ctrl.updateBranch);
router.post  ('/brands/me/branches/:id/make-main',          ...brandAny, ctrl.makeMainBranch);
router.delete('/brands/me/branches/:id',                    ...brandAny, ctrl.removeBranch);

// A9 — creator finds brands
// registration-and-profile §6.3: a pending creator now reaches the app, so every creator
// action here answers ACCOUNT_PENDING until admin approves — the same middleware the brand
// side has used all along.
router.get('/influencers/me/find-brands', ...creator, requireApproved, ctrl.findBrands);

// A11 — a brand's published products (creator or the brand itself)
router.get('/brands/:id/products',            authenticate, ctrl.listBrandProducts);
router.get('/brands/:id/products/:productId', authenticate, ctrl.brandProductDetail);

// registration-and-profile §9: POST /places/resolve is retired — Google place search has left
// address entry in the brand and creator apps. (The follower app's location endpoints stay.)

// A13 — cities by id
router.get('/reference/cities', authenticate, ctrl.citiesByIds);

module.exports = router;
