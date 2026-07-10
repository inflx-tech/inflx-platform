'use strict';

/**
 * influencerExperiences.routes.js — Creator Experience Studio API
 * (Creator Experience Engine Phase 6a, features/creator-experiences/, mig 135).
 * Mounted under /v1/influencers. Auth: requireRole('influencer').
 */

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/influencerExperiences.controller');

const router = Router();
const creatorAuth = [authenticate, requireRole('influencer')];

router.get('/me/experience-templates', ...creatorAuth, ctrl.listTemplates);
router.get('/me/experience-stockable', ...creatorAuth, ctrl.listStockable);
router.get('/me/experiences',          ...creatorAuth, ctrl.listMine);
router.post('/me/experiences',         ...creatorAuth, ctrl.create);
router.post('/me/experiences/:id/publish', ...creatorAuth, ctrl.publish);

// Creator imagery (Phase 7a)
router.get('/me/assets',               ...creatorAuth, ctrl.listAssets);
router.post('/me/assets',              ...creatorAuth, ctrl.createAsset);
router.post('/me/assets/:id/tag-product', ...creatorAuth, ctrl.tagAsset);

module.exports = router;
