'use strict';

/**
 * follower.routes.js — the shopper app. Mounted at /followers and /follower.
 * Contract: features/follower-app-v2 · rules v1.7 §5
 *
 * 29 Sep 2026: the old shopper app's routes (section engine, concepts and Discover layouts, deals,
 * campaign feeds, v1 posts, food search, coupons, saved offers, the wallet, the product-only
 * wishlist, stored location) were removed with the old app. Kept: the account, addresses (for
 * checkout), reviews (after an order), app config and the event log.
 */

const { Router } = require('express');
const { authenticate, requireRole, authenticateOptional } = require('../middleware/auth');
const acct = require('../controllers/followerAccount.controller');
const shop = require('../controllers/shopper.controller');
const reviewCtrl = require('../controllers/review.controller');
const postEventsCtrl = require('../controllers/postEvents.controller');
const orderCtrl = require('../controllers/shopperOrders.controller');

const router = Router();

const followerAuth = [authenticate, requireRole('follower')];
const anyone = [authenticateOptional];

// ── Account ──────────────────────────────────────────────────────────────────
router.post('/register', ...followerAuth, acct.register);
router.get('/me', ...followerAuth, acct.getMe);
router.patch('/me', ...followerAuth, acct.updateMe);
router.get('/me/profile', ...followerAuth, shop.profile);               // F13
router.patch('/me/preferences', ...followerAuth, shop.preferences);     // F1, F13: city, Women/Men/Kids, styles
router.post('/me/merge', ...followerAuth, shop.merge);                  // sign-in: a guest's follows and saves move over
// The nearest offered city for a point from the phone. Used, never stored (5.3).
router.get('/reverse-geocode', ...anyone, acct.reverseGeocode);

// ── Addresses (kept for checkout) ────────────────────────────────────────────
router.post('/addresses', ...followerAuth, acct.createAddress);
router.get('/addresses', ...followerAuth, acct.listAddresses);
router.patch('/addresses/:id', ...followerAuth, acct.updateAddress);
router.delete('/addresses/:id', ...followerAuth, acct.deleteAddress);

// ── App config and what the app records (5.14) ───────────────────────────────
router.get('/app-config', ...anyone, shop.appConfig);
router.post('/events', ...anyone, postEventsCtrl.ingest);

// ── Welcome, feed, circles (F1, F2, F5) ──────────────────────────────────────
router.get('/welcome', ...anyone, shop.welcome);
router.post('/feed', ...anyone, shop.feed);
router.get('/circles', ...anyone, shop.circles);

// ── Posts (F3, F4, F6) ───────────────────────────────────────────────────────
router.get('/posts/:id', ...anyone, shop.post);
router.get('/posts/:id/more', ...anyone, shop.more);
router.get('/posts/:id/comments', ...anyone, shop.comments);
router.post('/posts/:id/comments', ...followerAuth, shop.addComment);
router.post('/comments/:id/report', ...followerAuth, shop.report);
router.post('/posts/:id/like', ...followerAuth, shop.like);
router.delete('/posts/:id/like', ...followerAuth, shop.unlike);
router.post('/posts/:id/save', ...followerAuth, shop.save);
router.delete('/posts/:id/save', ...followerAuth, shop.unsave);

// ── Search and codes (F12) ───────────────────────────────────────────────────
router.get('/search', ...anyone, shop.search);
router.get('/code/:code', ...anyone, shop.code);

// ── Saved (F11) ──────────────────────────────────────────────────────────────
router.get('/saved', ...followerAuth, shop.saved);
router.post('/saved/resolve', ...anyone, shop.resolveSaved);            // a guest's saves, kept on the phone
router.post('/saved/products', ...followerAuth, shop.saveProduct);
router.delete('/saved/products/:productId', ...followerAuth, shop.unsaveProduct);

// ── Following ────────────────────────────────────────────────────────────────
router.post('/follows', ...followerAuth, shop.follow);
router.delete('/follows/:influencer_id', ...followerAuth, shop.unfollow);
router.get('/following', ...anyone, shop.following);

// ── Stores and collections (F7–F10) ──────────────────────────────────────────
router.get('/creators/:id', ...anyone, shop.creatorStore);
router.get('/creators/:id/posts', ...anyone, shop.creatorPosts);
router.get('/creators/:id/collections', ...anyone, shop.creatorCollections);
router.get('/collections/:id', ...anyone, shop.collection);
router.get('/brands/:id', ...anyone, shop.brandStore);
router.get('/brands/:id/posts', ...anyone, shop.brandPosts);
router.get('/brands/:id/offers', ...anyone, shop.brandOffers);
router.get('/filters', ...anyone, shop.filters);

// ── Ordering (shopper-ordering, rules §6) ────────────────────────────────────
router.get('/posts/:id/deal', ...anyone, orderCtrl.deal);                   // D1, P, B, V, K, G
router.post('/posts/:id/deal/price', ...anyone, orderCtrl.dealPrice);       // the sticky bar, the review (D4)
router.post('/bag/price', ...anyone, orderCtrl.bagPrice);                   // a guest's bag, kept on the phone
router.get('/bag', ...followerAuth, orderCtrl.getBag);                      // O6, O7, D11
router.put('/bag', ...followerAuth, orderCtrl.putBag);
router.post('/bag/merge', ...followerAuth, orderCtrl.mergeBag);             // O8: the phone bag joins her account
router.post('/checkout/review', ...followerAuth, orderCtrl.review);         // O11, O12
router.post('/checkout/place', ...followerAuth, orderCtrl.place);           // Place order
router.post('/checkout/verify', ...followerAuth, orderCtrl.verify);         // Razorpay's answer
router.get('/checkouts/:id', ...followerAuth, orderCtrl.checkoutDetail);    // O13
router.get('/orders', ...followerAuth, orderCtrl.listOrders);               // O14
router.get('/orders/lines/:id', ...followerAuth, orderCtrl.lineDetail);     // O15
router.get('/orders/lines/:id/cancel', ...followerAuth, orderCtrl.cancelPreview); // O16
router.post('/orders/lines/:id/cancel', ...followerAuth, orderCtrl.cancel); // O16 → O17
router.get('/orders/lines/:id/return', ...followerAuth, orderCtrl.returnPreview);  // W14 — what a return takes, and until when
router.post('/orders/lines/:id/return', ...followerAuth, orderCtrl.returnRequest); // W14 — she asks; INFLX decides

// ── Reviews (after an order; kept for checkout) ──────────────────────────────
router.get('/reviews', ...anyone, reviewCtrl.listBrandReviews);
router.post('/reviews', ...followerAuth, reviewCtrl.createReview);
router.get('/me/reviewable', ...followerAuth, reviewCtrl.getReviewable);

module.exports = router;
