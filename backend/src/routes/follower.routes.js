'use strict';

const { Router } = require('express');
const { authenticate, requireRole, authenticateOptional } = require('../middleware/auth');
const ctrl = require('../controllers/follower.controller');

const router = Router();

const followerAuth = [authenticate, requireRole('follower')];

// ── Registration + profile ────────────────────────────────────────────────────
router.post('/register', authenticate, requireRole('follower'), ctrl.register);
router.get('/me',        authenticate, requireRole('follower'), ctrl.getMe);

// ── Follow / unfollow (auth required) ────────────────────────────────────────
router.post('/follows',              ...followerAuth, ctrl.followInfluencer);
router.delete('/follows/:influencer_id', ...followerAuth, ctrl.unfollowInfluencer);

// ── Addresses (auth required) ────────────────────────────────────────────────
router.post('/addresses',     ...followerAuth, ctrl.createAddress);
router.get('/addresses',      ...followerAuth, ctrl.listAddresses);
router.patch('/addresses/:id',...followerAuth, ctrl.updateAddress);

// ── Feed & browse (public — auth optional for personalization) ───────────────
router.get('/feed',      authenticateOptional, ctrl.getFeed);       // legacy
router.get('/home-feed', authenticateOptional, ctrl.getHomeFeed);   // product-centric
router.get('/deals',     authenticateOptional, ctrl.getDeals);      // category browse
router.get('/following', ...followerAuth, ctrl.getFollowing);       // auth required (personal)

// ── Listing Engine endpoints (public) ────────────────────────────────────────
router.get('/stories',    authenticateOptional, ctrl.getStories);    // Influencer story circles
router.get('/categories', authenticateOptional, ctrl.getCategories); // Super-category browser

module.exports = router;
