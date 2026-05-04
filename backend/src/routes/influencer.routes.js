'use strict';

const { Router } = require('express');
const { authenticate, requireRole, requireApproved } = require('../middleware/auth');
const ctrl = require('../controllers/influencer.controller');
const offerCtrl = require('../controllers/offer.controller');
const withdrawalCtrl = require('../controllers/withdrawal.controller');
const mediaCtrl = require('../controllers/mediaAsset.controller');
const analyticsCtrl = require('../controllers/creatorAnalytics.controller');
const { requireAnyAdminRole } = require('../middleware/auth');

const router = Router();

// ── Brand/Admin search endpoints (must come BEFORE /me/* to avoid shadowing) ─
router.get('/search',    authenticate, requireRole('brand', 'admin'), requireApproved, ctrl.search);

// ── Brand-side market analytics dashboard data (one fat aggregate response) ─
router.get('/analytics', authenticate, requireRole('brand', 'admin'), requireApproved, analyticsCtrl.getMarketAnalytics);

// ── Influencer self-service routes ───────────────────────────────────────────
router.post('/register',  authenticate, requireRole('influencer'), ctrl.register);
router.get('/me',         authenticate, requireRole('influencer'), ctrl.getMe);
router.patch('/me',       authenticate, requireRole('influencer'), ctrl.updateMe);

// ── Offer inbox (Block B) ─────────────────────────────────────────────────────
router.get('/me/offers',   authenticate, requireRole('influencer'), offerCtrl.getMyOffers);

// ── Earnings overview (Phase 3 — Block E) ─────────────────────────────────────
router.get('/me/earnings', authenticate, requireRole('influencer'), ctrl.getEarnings);

// ── My Campaigns (HIGH #6) ───────────────────────────────────────────────────
router.get('/me/campaigns',                          authenticate, requireRole('influencer'), ctrl.getMyCampaigns);
router.get('/me/campaigns/:campaign_influencer_id',  authenticate, requireRole('influencer'), ctrl.getMyCampaignDetail);

// ── Withdrawals (Phase 5) ─────────────────────────────────────────────────────
router.post('/me/withdraw',              authenticate, requireRole('influencer'), withdrawalCtrl.initiateWithdrawal);
router.get('/me/withdrawals',            authenticate, requireRole('influencer'), withdrawalCtrl.listWithdrawals);
router.post('/me/withdrawals/:id/retry', authenticate, requireRole('influencer'), withdrawalCtrl.retryWithdrawal);

// ── TDS Certificate (Phase F) ─────────────────────────────────────────────────
router.get('/me/tds-certificate', authenticate, requireRole('influencer'), ctrl.getTdsCertificate);

// ── Transaction feed — influencer sees all follower transactions
router.get('/me/transactions', authenticate, requireRole('influencer'), ctrl.getMyTransactions);

// ── Campaign products — products assigned to influencer via campaign ─────────
router.get('/me/campaigns/:campaign_influencer_id/products', authenticate, requireRole('influencer'), ctrl.getCampaignProducts);

// ── Store preview — influencer sees their store as followers see it ───────────
router.get('/me/store-preview', authenticate, requireRole('influencer'), ctrl.storePreview);

// ── Aggregate contracts list for the My Contracts gallery screen ─────────────
router.get('/me/contracts', authenticate, requireRole('influencer'), mediaCtrl.listInfluencerContracts);

// ── Public profile view (brand + admin) ──────────────────────────────────────
router.get('/:id',            authenticate, requireRole('brand', 'admin'), ctrl.getPublicById);

// ── Admin: trigger Instagram rescrape ────────────────────────────────────────
router.post('/:id/rescrape',  authenticate, requireAnyAdminRole,           ctrl.rescrape);

module.exports = router;
