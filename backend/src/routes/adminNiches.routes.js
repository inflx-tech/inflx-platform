'use strict';

/**
 * adminNiches.routes.js — the "Other" niche queue. Mounted at /v1/admin/niches.
 * Contract: features/registration-and-profile · spec §9A.3
 * Gated by the approvals capability: resolving a creator's niche is part of approving her.
 */

const { Router } = require('express');
const { authenticate, requireCapability } = require('../middleware/auth');
const ctrl = require('../controllers/adminNiches.controller');

const router = Router();
const adminAuth = [authenticate, requireCapability('approvals')];

router.get ('/other',                     ...adminAuth, ctrl.listOther);
router.post('/other/:influencerId/map',   ...adminAuth, ctrl.mapToExisting);
router.post('/',                          ...adminAuth, ctrl.createNiche);

module.exports = router;
