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

module.exports = router;
