'use strict';

const { Router } = require('express');

const authRoutes        = require('./auth.routes');
const brandRoutes       = require('./brand.routes');
const influencerRoutes  = require('./influencer.routes');
const adminRoutes       = require('./admin.routes');
const campaignRoutes    = require('./campaign.routes');
const offerRoutes       = require('./offer.routes');
const negotiationRoutes = require('./negotiation.routes');
const contractRoutes    = require('./contract.routes');
const deliverableRoutes = require('./deliverable.routes');

// Phase 4
const followerRoutes    = require('./follower.routes');
const transactionRoutes = require('./transaction.routes');
const enquiryRoutes     = require('./enquiry.routes');
const commissionRoutes  = require('./commission.routes');

// Phase 5
const engagementRoutes      = require('./engagement.routes');
const notificationRoutes    = require('./notification.routes');

// Follower App Redesign
const savedRoutes           = require('./saved.routes');
const productNoteRoutes     = require('./productNote.routes');

// Media uploads
const uploadRoutes = require('./upload.routes');

// OTA JS bundle updates for installed mobile apps
const otaRoutes = require('./ota.routes');

// Webhooks
const webhookRoutes = require('./webhook.routes');

// Phase 4 — no-auth public store/category controllers
const followerCtrl      = require('../controllers/follower.controller');
const { authenticateOptional } = require('../middleware/auth');

const router = Router();

// ── Webhooks (no auth — verified by signature) ───────────────────────────────
router.use('/webhooks', webhookRoutes);

// ── Phase 1-3 ────────────────────────────────────────────────────────────────
router.use('/auth',          authRoutes);
router.use('/brands',        brandRoutes);
router.use('/influencers',   influencerRoutes);
router.use('/admin',         adminRoutes);
router.use('/campaigns',     campaignRoutes);
router.use('/offers',        offerRoutes);
router.use('/negotiations',  negotiationRoutes);
router.use('/contracts',     contractRoutes);
router.use('/deliverables',  deliverableRoutes);
router.use('/uploads',       uploadRoutes);
router.use('/ota',           otaRoutes);

// ── Phase 4 — Follower identity + follow + addresses + feed ──────────────────
// Note: /followers/* uses 'followers' (plural) for register/me
//       /follower/*  uses 'follower'  (singular) for transactional endpoints
router.use('/followers', followerRoutes);
router.use('/follower',  followerRoutes);

// ── Phase 4 — Transactions (pay-at-store, prebook, orders) ───────────────────
router.use('/follower', transactionRoutes);

// ── Phase 4 — Enquiry (follower submits) ─────────────────────────────────────
router.use('/follower', enquiryRoutes);

// ── Phase 4 — Commission tracker (influencer) ────────────────────────────────
router.use('/influencers', commissionRoutes);

// ── Follower App Redesign — Saved offers + Influencer product notes ──────────
router.use('/follower', savedRoutes);
router.use('/influencers', productNoteRoutes);

// ── Phase 5 — Engagement analytics (brand) ───────────────────────────────────
router.use('/brands', engagementRoutes);

// ── Phase 6 — Notifications (any authenticated user) ─────────────────────────
router.use('/notifications', notificationRoutes);

// ── Phase 4 — Public store endpoints (no auth required) ──────────────────────
router.get('/store/:influencer_handle/products', authenticateOptional, followerCtrl.getStoreProducts);
router.get('/store/:influencer_handle',           authenticateOptional, followerCtrl.getInfluencerStore);
router.get('/business/:brand_id/store',            authenticateOptional, followerCtrl.getBusinessStore);
router.get('/business/:brand_id',                 authenticateOptional, followerCtrl.getBusinessStore);
router.get('/category/:category_key',             authenticateOptional, followerCtrl.getCategoryStore);

// ── Listing Engine — category stores with inline products ────────────────────
router.get('/category/:super_category/stores',    authenticateOptional, followerCtrl.getCategoryStores);

module.exports = router;
