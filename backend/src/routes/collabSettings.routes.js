'use strict';

/**
 * collabSettings.routes.js — Item 2: pitch & invitation settings, blocks, reference lists.
 * Contract: features/item2-pitch-invitation-settings
 *
 * Mounted at '/' BEFORE brand.routes and influencer.routes (see routes/index.js) so the
 * fixed /me/... paths here can never be shadowed by a parameterised route there.
 */

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/collabSettings.controller');

const router = Router();
const brand   = [authenticate, requireRole('brand')];
const creator = [authenticate, requireRole('influencer')];

// A1 — brand pitch settings
router.get ('/brands/me/pitch-settings', ...brand, ctrl.getBrandPitchSettings);
router.put ('/brands/me/pitch-settings', ...brand, ctrl.putBrandPitchSettings);

// A3 — brand blocked creators
router.get   ('/brands/me/blocked-creators',               ...brand, ctrl.listBlockedCreators);
router.post  ('/brands/me/blocked-creators',               ...brand, ctrl.blockCreator);
router.delete('/brands/me/blocked-creators/:influencerId', ...brand, ctrl.unblockCreator);

// A2 — creator invitation settings
router.get ('/influencers/me/invitation-settings', ...creator, ctrl.getCreatorInvitationSettings);
router.put ('/influencers/me/invitation-settings', ...creator, ctrl.putCreatorInvitationSettings);

// A4 — creator blocked brands
router.get   ('/influencers/me/blocked-brands',          ...creator, ctrl.listBlockedBrands);
router.post  ('/influencers/me/blocked-brands',          ...creator, ctrl.blockBrand);
router.delete('/influencers/me/blocked-brands/:brandId', ...creator, ctrl.unblockBrand);

// A8 — reference lists (any signed-in role)
router.get('/reference/creator-niches',   authenticate, ctrl.getCreatorNiches);
router.get('/reference/languages',        authenticate, ctrl.getLanguages);
router.get('/reference/brand-categories', authenticate, ctrl.getBrandCategories);
router.get('/reference/states',           authenticate, ctrl.getStates);

module.exports = router;
