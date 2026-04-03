'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/saved.controller');

const router = Router();
const followerAuth = [authenticate, requireRole('follower')];

router.post('/saved',             ...followerAuth, ctrl.saveOffer);
router.delete('/saved/:offer_id', ...followerAuth, ctrl.unsaveOffer);
router.get('/saved',              ...followerAuth, ctrl.listSaved);

module.exports = router;
