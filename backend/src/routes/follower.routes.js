'use strict';

const { Router } = require('express');
const { authenticate, requireRole, authenticateOptional } = require('../middleware/auth');
const ctrl = require('../controllers/follower.controller');
const reviewCtrl = require('../controllers/review.controller');
const walletCtrl = require('../controllers/followerWallet.controller');

const router = Router();

const followerAuth = [authenticate, requireRole('follower')];

// ── Registration + profile ────────────────────────────────────────────────────
router.post('/register', authenticate, requireRole('follower'), ctrl.register);
router.get('/me',        authenticate, requireRole('follower'), ctrl.getMe);

// ── Follow / unfollow (auth required) ────────────────────────────────────────
router.post('/follows',              ...followerAuth, ctrl.followInfluencer);
router.delete('/follows/:influencer_id', ...followerAuth, ctrl.unfollowInfluencer);

// ── Location (auth required) — device/selected coords + reverse-geocoded area ──
router.post('/location', ...followerAuth, ctrl.updateLocation);
// Public reverse-geocode (location switcher "current location" label).
router.get('/reverse-geocode', authenticateOptional, ctrl.reverseGeocode);
// Public forward-geocode (verify/locate a typed address before save).
router.get('/geocode', authenticateOptional, ctrl.geocodeQuery);
// Places Autocomplete + Details proxy (Swiggy-style area search).
router.get('/places/autocomplete', authenticateOptional, ctrl.placesAutocomplete);
router.get('/places/details', authenticateOptional, ctrl.placeDetails);

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

// ── Section Engine feeds (Creator Vibe, Phase A — public, auth optional) ─────
// Backend-driven { sections:[...] }; admin-controlled via section_config.
// Contract: features/follower-section-engine/.
router.get('/home',                                  authenticateOptional, ctrl.getHomeSections);
router.get('/section/category/:key',                 authenticateOptional, ctrl.getCategorySections);
router.get('/section/offers',                        authenticateOptional, ctrl.getOffersSections);
router.get('/section/creator/:handle',               authenticateOptional, ctrl.getCreatorSections);
router.get('/section/creator/:handle/category/:cat', authenticateOptional, ctrl.getCreatorCategorySections);

// ── Wave 5 — Reviews + ratings ───────────────────────────────────────────────
// List is public (followers read reviews before visiting); create +
// reviewable require follower auth + a qualifying completed transaction.
router.get ('/reviews',       authenticateOptional, reviewCtrl.listBrandReviews);
router.post('/reviews',       ...followerAuth,      reviewCtrl.createReview);
router.get ('/me/reviewable', ...followerAuth,      reviewCtrl.getReviewable);

// ── Wave 5C — Creators eating now (public discovery social-proof) ────────────
router.get('/creators-eating-now', authenticateOptional, ctrl.creatorsEatingNow);

// ── Path C-3 — working search (public) ───────────────────────────────────────
router.get('/search', authenticateOptional, ctrl.search);

// ── Path C-2 — Follower wallet (auth required) ───────────────────────────────
router.get('/wallet',              ...followerAuth, walletCtrl.getWallet);
router.get('/wallet/transactions', ...followerAuth, walletCtrl.listWalletTransactions);

module.exports = router;
