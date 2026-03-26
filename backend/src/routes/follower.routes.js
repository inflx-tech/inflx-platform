'use strict';

const { Router } = require('express');
const { authenticate, requireRole, authenticateOptional } = require('../middleware/auth');
const ctrl = require('../controllers/follower.controller');

const router = Router();

const followerAuth = [authenticate, requireRole('follower')];

// ── Registration + profile ────────────────────────────────────────────────────
router.post('/register', authenticate, requireRole('follower'), ctrl.register);
router.get('/me',        authenticate, requireRole('follower'), ctrl.getMe);

// ── Follow / unfollow ─────────────────────────────────────────────────────────
router.post('/follows',              ...followerAuth, ctrl.followInfluencer);
router.delete('/follows/:influencer_id', ...followerAuth, ctrl.unfollowInfluencer);

// ── Addresses ─────────────────────────────────────────────────────────────────
router.post('/addresses',     ...followerAuth, ctrl.createAddress);
router.get('/addresses',      ...followerAuth, ctrl.listAddresses);
router.patch('/addresses/:id',...followerAuth, ctrl.updateAddress);

// ── Feed ──────────────────────────────────────────────────────────────────────
router.get('/feed', ...followerAuth, ctrl.getFeed);

module.exports = router;
