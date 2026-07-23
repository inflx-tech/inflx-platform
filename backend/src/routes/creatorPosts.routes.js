'use strict';

/**
 * creatorPosts.routes.js — creator posts API (Post/Concept P2, mig 140).
 * Mounted at /v1/influencers. Contract: features/concept-p2-posts/.
 */

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/creatorPosts.controller');

const router = Router();
const creatorAuth = [authenticate, requireRole('influencer')];

router.get('/me/post-scope',        ...creatorAuth, ctrl.getPostScope);
router.post('/me/posts/picker',     ...creatorAuth, ctrl.picker);
router.post('/me/posts/upload-url', ...creatorAuth, ctrl.uploadUrl);
router.post('/me/posts',            ...creatorAuth, ctrl.create);
router.get('/me/posts',             ...creatorAuth, ctrl.listMine);

module.exports = router;
