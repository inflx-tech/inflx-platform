'use strict';

const { Router } = require('express');
const { requireIngestToken } = require('../middleware/ingestAuth');
const ingestCtrl = require('../controllers/ingest.controller');

const router = Router();

// All ingest endpoints require X-Ingest-Token header.
router.use(requireIngestToken);

router.post('/creator-metrics', ingestCtrl.upsertCreatorMetrics);
router.post('/posts',           ingestCtrl.upsertPosts);
router.get( '/health',          ingestCtrl.health);

// ── Marketing Engine v2 (migrations 040–043) ──────────────────────────────
router.post('/brand-metrics',         ingestCtrl.upsertBrandMetrics);
router.post('/brand-collabs',         ingestCtrl.updateBrandCollabs);
router.post('/caption-insights',      ingestCtrl.upsertCaptionInsights);
router.post('/collab-map',            ingestCtrl.upsertCollabMap);
router.post('/insight-log',           ingestCtrl.insertInsightLog);
router.get( '/profile-bundle/:ig_handle', ingestCtrl.profileBundle);
router.get( '/refresh-due',           ingestCtrl.refreshDue);
router.get( '/settings',              ingestCtrl.getSettings);

module.exports = router;
