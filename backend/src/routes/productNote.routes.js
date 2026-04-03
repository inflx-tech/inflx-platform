'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/productNote.controller');

const router = Router();
const influencerAuth = [authenticate, requireRole('influencer')];

router.post('/me/product-notes',              ...influencerAuth, ctrl.upsertNote);
router.get('/me/product-notes/:campaign_id',  ...influencerAuth, ctrl.getNotes);
router.delete('/me/product-notes/:id',        ...influencerAuth, ctrl.deleteNote);

module.exports = router;
