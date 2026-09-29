'use strict';

/**
 * shoppablePosts.routes.js — shoppable posts and collections (Level 3). Mounted at /v1/influencers.
 * Contract: features/shoppable-posts-v2.
 */

const { Router } = require('express');
const { authenticate, requireApproved, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/shoppablePosts.controller');
const links = require('../controllers/postLinks.controller');

const router = Router();
const creator = [authenticate, requireRole('influencer')];
const acting = [...creator, requireApproved];

router.get('/me/create', ...creator, ctrl.home);
router.get('/me/shoppable-posts/brands', ...creator, ctrl.brands);
router.get('/me/shoppable-posts/collaborations', ...creator, ctrl.collaborations);
router.get('/me/shoppable-posts', ...creator, ctrl.list);
router.post('/me/shoppable-posts', ...acting, ctrl.create);
router.get('/me/shoppable-posts/:postId', ...creator, ctrl.get);
router.get('/me/shoppable-posts/:postId/options', ...creator, ctrl.options);
// post-links-codes (L2–L6): a post's code and links, its stats; her store and collection links.
router.get('/me/shoppable-posts/:postId/share', ...creator, links.share);
router.get('/me/shoppable-posts/:postId/stats', ...creator, links.stats);
router.get('/me/links', ...creator, links.myLinks);
router.patch('/me/shoppable-posts/:postId', ...acting, ctrl.update);
router.post('/me/shoppable-posts/:postId/upload-url', ...acting, ctrl.uploadUrl);
router.post('/me/shoppable-posts/:postId/submit', ...acting, ctrl.submit);
router.post('/me/shoppable-posts/:postId/take-down', ...acting, ctrl.takeDown);
router.delete('/me/shoppable-posts/:postId', ...acting, ctrl.remove);

router.get('/me/collections/options', ...creator, ctrl.collectionOptions);
router.get('/me/collections', ...creator, ctrl.collectionList);
router.post('/me/collections', ...acting, ctrl.collectionCreate);
router.get('/me/collections/:collectionId', ...creator, ctrl.collectionGet);
router.patch('/me/collections/:collectionId', ...acting, ctrl.collectionUpdate);
router.delete('/me/collections/:collectionId', ...acting, ctrl.collectionRemove);

module.exports = router;
