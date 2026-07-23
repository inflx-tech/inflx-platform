'use strict';

/**
 * adminConcepts.routes.js — Concept engine admin API (Post/Concept P1, mig 139).
 * Mounted at /v1/admin. Sections capability (concepts feed the same discovery
 * engine the App Builder composes). Contract: features/concept-p1-engine/.
 */

const { Router } = require('express');
const { authenticate, requireCapability } = require('../middleware/auth');
const ctrl = require('../controllers/adminConcepts.controller');

const router = Router();
const adminAuth = [authenticate, requireCapability('sections')];

router.get('/concept-templates',        ...adminAuth, ctrl.listTemplates);
router.post('/concept-templates',       ...adminAuth, ctrl.createTemplate);
router.patch('/concept-templates/:id',  ...adminAuth, ctrl.updateTemplate);
router.post('/concepts/preview',        ...adminAuth, ctrl.previewConcept);
router.get('/collections',              ...adminAuth, ctrl.listCollections);
router.post('/collections',             ...adminAuth, ctrl.createCollection);
router.patch('/collections/:id',        ...adminAuth, ctrl.updateCollection);

module.exports = router;
