'use strict';

/**
 * adminWorldRules.routes.js — Phase 3 World Rules (mig 126).
 * Mounted at /v1/admin/world-rules. Admin-only via the sections capability
 * (world rules govern the same section engine the App Builder composes).
 * Contract: features/phase3-world-rules/.
 */

const { Router } = require('express');
const { authenticate, requireCapability } = require('../middleware/auth');
const ctrl = require('../controllers/adminWorldRules.controller');

const router = Router();
const adminAuth = [authenticate, requireCapability('sections')];

router.get('/',                 ...adminAuth, ctrl.listWorldRules);
router.put('/:world_key',       ...adminAuth, ctrl.saveWorldRules);
router.delete('/:world_key',    ...adminAuth, ctrl.deleteWorldRules);

module.exports = router;
