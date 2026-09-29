'use strict';

/**
 * creatorPosts.routes.js — creator posts API (Post/Concept P2, mig 140).
 * Mounted at /v1/influencers. Contract: features/concept-p2-posts/.
 */

const { Router } = require('express');
const { authenticate, requireApproved, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/creatorPosts.controller');
const { retired } = require('../controllers/shoppablePosts.controller');

const router = Router();
const creatorAuth = [authenticate, requireRole('influencer')];

// shoppable-posts-v2 (rules 4.8): the July composer — one, several or all brands, a concept or an
// admin collection — is retired. A post now belongs to one collaboration: /me/shoppable-posts.
router.get('/me/post-scope',        ...creatorAuth, retired);
router.post('/me/posts/picker',     ...creatorAuth, retired);
router.post('/me/posts/upload-url', ...creatorAuth, retired);
// registration-and-profile §6.3: a pending creator now reaches the app, so every creator
// action here answers ACCOUNT_PENDING until admin approves — the same middleware the brand
// side has used all along.
router.post('/me/posts',            ...creatorAuth, requireApproved, retired);
router.get('/me/posts',             ...creatorAuth, ctrl.listMine);

module.exports = router;
