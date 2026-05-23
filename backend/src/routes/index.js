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

// Production coordination (Phase P)
const productionRoutes = require('./production.routes');

// Influencer proposals (Phase Q)
const proposalRoutes = require('./proposal.routes');

// Media uploads
const uploadRoutes = require('./upload.routes');

// OTA JS bundle updates for installed mobile apps
const otaRoutes = require('./ota.routes');

// Webhooks
const webhookRoutes = require('./webhook.routes');

// Internal ingest (token-authenticated push from Marketing Automation)
const ingestRoutes = require('./ingest.routes');

// Marketing Engine admin API (admin-only, JWT-authenticated)
const marketingAdminRoutes = require('./marketingAdmin.routes');

// Fashion-1 — product variants (brand-side SKU CRUD) + returns workflow
const productVariantsRoutes = require('./productVariants.routes');
const returnsRoutes         = require('./returns.routes');

// Fashion-2 — creator-curated lookbooks (outfit collections)
const lookbooksRoutes       = require('./lookbooks.routes');

// INFLX Meals — planned-meal marketplace (P1 vertical slice)
const mealsRoutes           = require('./meals.routes');

// Phase 4 — no-auth public store/category controllers
const followerCtrl      = require('../controllers/follower.controller');
const { authenticateOptional, authenticate } = require('../middleware/auth');

// Wave 1 (Dining) — geocoding for the restaurant listing wizard's
// google_maps_link field type
const geocodingCtrl     = require('../controllers/geocoding.controller');

const router = Router();

// ── Webhooks (no auth — verified by signature) ───────────────────────────────
router.use('/webhooks', webhookRoutes);

// ── Internal ingest (X-Ingest-Token authenticated; not for end-users) ────────
router.use('/internal/ingest', ingestRoutes);

// ── Marketing Engine admin API (JWT-authenticated, admin only) ───────────────
router.use('/admin/marketing', marketingAdminRoutes);

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
router.use('/',              productionRoutes);   // /contracts/:id/production + /production-events/:id/*
router.use('/',              proposalRoutes);     // /influencers/me/* + /brands/me/proposals* + /admin/proposals
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

// ── INFLX Meals — planned-meal marketplace (P1) ──────────────────────────────
router.use('/meals', mealsRoutes);

// ── Phase 4 — Public store endpoints (no auth required) ──────────────────────
router.get('/store/:influencer_handle/products', authenticateOptional, followerCtrl.getStoreProducts);
router.get('/store/:influencer_handle',           authenticateOptional, followerCtrl.getInfluencerStore);
router.get('/business/:brand_id/store',            authenticateOptional, followerCtrl.getBusinessStore);
router.get('/business/:brand_id',                 authenticateOptional, followerCtrl.getBusinessStore);
router.get('/category/:category_key',             authenticateOptional, followerCtrl.getCategoryStore);

// ── Listing Engine — category stores with inline products ────────────────────
router.get('/category/:super_category/stores',    authenticateOptional, followerCtrl.getCategoryStores);

// ── Wave 1 (Dining) — geocoding for restaurant listing wizard ────────────────
// Authenticated: any logged-in user (brand on web). Mock mode in dev returns
// fixed Vijayawada coords; prod hits Google Geocoding API.
router.post('/internal/geocode-maps-url',         authenticate, geocodingCtrl.geocodeMapsUrl);

// ── Fashion-1 — product variants (brand-side) + returns workflow ─────────────
router.use('/brands/me', productVariantsRoutes);
router.use('/follower',  returnsRoutes.followerRouter);
router.use('/admin',     returnsRoutes.adminRouter);

// ── Fashion-2 — creator lookbooks (creator authoring + public viewing) ───────
router.use('/',           lookbooksRoutes.publicRouter);    // /store/:handle/lookbooks
router.use('/influencer', lookbooksRoutes.creatorRouter);   // /influencer/lookbooks*

module.exports = router;
