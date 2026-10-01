'use strict';

const { Router } = require('express');
const { authenticate, requireRole, requireApproved, requireApprovedFor } = require('../middleware/auth');
const ctrl = require('../controllers/influencer.controller');
const offerCtrl = require('../controllers/offer.controller');
const withdrawalCtrl = require('../controllers/withdrawal.controller');
const mediaCtrl = require('../controllers/mediaAsset.controller');
const analyticsCtrl = require('../controllers/creatorAnalytics.controller');
const storeCtrl = require('../controllers/influencerStore.controller');
const { requireAnyAdminRole } = require('../middleware/auth');

const router = Router();

// ── Brand/Admin search endpoints (must come BEFORE /me/* to avoid shadowing) ─
router.get('/search',    authenticate, requireRole('brand', 'admin'), requireApproved, ctrl.search);
// Distinct tagged states + their cities — drives the State → City dropdowns.
router.get('/locations', authenticate, requireRole('brand', 'admin'), requireApproved, ctrl.getLocations);

// ── Brand-side market analytics dashboard data (one fat aggregate response) ─
router.get('/analytics', authenticate, requireRole('brand', 'admin'), requireApproved, analyticsCtrl.getMarketAnalytics);

// ── Influencer self-service routes ───────────────────────────────────────────
router.post('/register',  authenticate, requireRole('influencer'), ctrl.register);
router.get('/me',         authenticate, requireRole('influencer'), ctrl.getMe);
router.patch('/me',       authenticate, requireRole('influencer'), ctrl.updateMe);
// registration-and-profile §6: her account reaches the admin queue when she submits it; this is
// also the creator resubmit path after a rejection (§6.4).
router.post('/me/submit-for-review', authenticate, requireRole('influencer'), ctrl.submitForReview);
// Her own photo — the only route by which a picture of a creator is ever set.
// Contract: features/creator-photo-and-reach
router.post('/me/profile-image/upload-url', authenticate, requireRole('influencer'), ctrl.getProfileImageUploadUrl);

// ── Offer inbox (Block B) ─────────────────────────────────────────────────────
router.get('/me/offers',   authenticate, requireRole('influencer'), offerCtrl.getMyOffers);
// The creator's old Discover arranger (concept rows) went with the old shopper app (29 Sep 2026).

// ── Earnings overview (Phase 3 — Block E) ─────────────────────────────────────
router.get('/me/earnings', authenticate, requireRole('influencer'), ctrl.getEarnings);

// ── Earnings ledger (Money G-5) — paginated forward-only statement ────────────
router.get('/me/ledger',   authenticate, requireRole('influencer'), ctrl.getLedger);

// ── Refer & Earn (Contract 4) — own referral code + earnings ─────────────────
router.get('/me/referral', authenticate, requireRole('influencer'), ctrl.getReferralInfo);

// ── Stage 0 — what needs her, and what step each collaboration is on ─────────
// The brand has had its half of this since the inbox summary shipped. The creator
// never had one, so her app had no source for the step number and would have had to
// invent it. Both sides now read collabCounts. Nothing renders it until Stage 1.
// Contract: features/stage-0-clear-the-decks.
router.get('/me/needs-you', authenticate, requireRole('influencer'), ctrl.getNeedsYou);

// ── My Campaigns (HIGH #6) ───────────────────────────────────────────────────
router.get('/me/campaigns',                          authenticate, requireRole('influencer'), ctrl.getMyCampaigns);
router.get('/me/campaigns/:campaign_influencer_id',  authenticate, requireRole('influencer'), ctrl.getMyCampaignDetail);

// ── Withdrawals (Phase 5) ─────────────────────────────────────────────────────
// registration-and-profile §6.3: a pending creator now reaches the app, so every creator
// action here answers ACCOUNT_PENDING until admin approves — the same middleware the brand
// side has used all along.
// Item 17 (rules v1.31 §17A, W5): a withdrawal is a REQUEST now — on hold, paid by INFLX from its
// bank, then marked processed. The automatic RazorpayX payout and its retry are retired; these three
// old addresses answer through the one model so an older app build cannot reach the old path.
router.post('/me/withdraw',              authenticate, requireRole('influencer'), requireApproved, withdrawalCtrl.requestV17);
router.get('/me/withdrawals',            authenticate, requireRole('influencer'), withdrawalCtrl.listV17);
router.post('/me/withdrawals/:id/retry', authenticate, requireRole('influencer'), requireApproved, withdrawalCtrl.retiredRetry);

// ── TDS Certificate (Phase F) ─────────────────────────────────────────────────
router.get('/me/tds-certificate', authenticate, requireRole('influencer'), ctrl.getTdsCertificate);

// ── Transaction feed — influencer sees all follower transactions
router.get('/me/transactions', authenticate, requireRole('influencer'), ctrl.getMyTransactions);

// ── Campaign products — products assigned to influencer via campaign ─────────
router.get('/me/campaigns/:campaign_influencer_id/products', authenticate, requireRole('influencer'), ctrl.getCampaignProducts);

// ── Store preview — influencer sees their store as followers see it ───────────
router.get('/me/store-preview', authenticate, requireRole('influencer'), ctrl.storePreview);

// ── Influencer storefront stocking (contract: influencer-store-foundation) ────
// Shelve products from contracted brands (contract-gate enforced in the service).
router.get('/me/store/items',        authenticate, requireRole('influencer'), storeCtrl.listMyStore);
router.get('/me/store/stockable',    authenticate, requireRole('influencer'), storeCtrl.listStockable);
router.post('/me/store/items',       authenticate, requireRole('influencer'), storeCtrl.stockItem);
router.delete('/me/store/items/:id', authenticate, requireRole('influencer'), storeCtrl.unstockItem);

// ── Aggregate contracts list for the My Contracts gallery screen ─────────────
router.get('/me/contracts', authenticate, requireRole('influencer'), mediaCtrl.listInfluencerContracts);

// ── Public profile view (brand + admin) ──────────────────────────────────────
// registration-and-profile §6.5 (founder decision 18): a pending brand is inside the app now and
// may reach home, profile and wallet only — campaigns, creators, groups, pitches and the pool
// answer ACCOUNT_PENDING until admin approves.
router.get('/:id',            authenticate, requireRole('brand', 'admin'), requireApprovedFor('brand'), ctrl.getPublicById);

// ── Admin: trigger Instagram rescrape ────────────────────────────────────────
router.post('/:id/rescrape',  authenticate, requireAnyAdminRole,           ctrl.rescrape);

module.exports = router;
