'use strict';

const { Router } = require('express');

const authRoutes        = require('./auth.routes');
const brandRoutes       = require('./brand.routes');
const influencerRoutes  = require('./influencer.routes');
const agencyRoutes      = require('./agency.routes');
const referralRoutes    = require('./referral.routes');
const adminRoutes       = require('./admin.routes');
const adminSectionsRoutes = require('./adminSections.routes');
const adminWorldRulesRoutes = require('./adminWorldRules.routes');
const adminPagesRoutes = require('./adminPages.routes');
const adminDesignSystemRoutes = require('./adminDesignSystem.routes');
const adminThemesRoutes = require('./adminThemes.routes');
const adminDesignLayoutsRoutes = require('./adminDesignLayouts.routes');
const adminExperiencePreviewRoutes = require('./adminExperiencePreview.routes');
const adminTemplatesRoutes = require('./adminTemplates.routes');
const influencerExperiencesRoutes = require('./influencerExperiences.routes');
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

// Campaign Command Center Phase 2 + 3 — store-clicks rollup + per-creator
// date-change request/approve flow (contract: campaign-command-center)
const dateChangeRoutes      = require('./dateChange.routes');

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
const referralAdminRoutes  = require('./referralAdmin.routes');

// Fashion-1 — product variants (brand-side SKU CRUD) + returns workflow
const productVariantsRoutes = require('./productVariants.routes');
const returnsRoutes         = require('./returns.routes');

// Food World P2 — product add-on/variation authoring (brand-side)
const productAddonsRoutes   = require('./productAddons.routes');

// Offer Engine — brand-side reusable offer library (Sub-contract A)
const brandOfferRoutes      = require('./brandOffer.routes');

// F-5 — server-persisted influencer groups (brand-scoped saved groups)
const influencerGroupRoutes = require('./influencerGroup.routes');

// Fashion-2 — creator-curated lookbooks (outfit collections)
const lookbooksRoutes       = require('./lookbooks.routes');

// INFLX Meals — planned-meal marketplace (P1 vertical slice)
const mealsRoutes           = require('./meals.routes');

// Listing Engine — drill-down taxonomy (fashion/furniture): tree + facets + batch-add
const listingRoutes         = require('./listing.routes');

// Phase 4 — no-auth public store/category controllers
const followerCtrl      = require('../controllers/follower.controller');
const { authenticateOptional, authenticate } = require('../middleware/auth');

// Wave 1 (Dining) — geocoding for the restaurant listing wizard's
// google_maps_link field type
const geocodingCtrl     = require('../controllers/geocoding.controller');
const mediaAssetCtrl    = require('../controllers/mediaAsset.controller');

// Phase A6 — public subscription tier catalog (no auth)
const subscriptionCtrl  = require('../controllers/subscription.controller');

const router = Router();

// ── Webhooks (no auth — verified by signature) ───────────────────────────────
router.use('/webhooks', webhookRoutes);

// ── Internal ingest (X-Ingest-Token authenticated; not for end-users) ────────
router.use('/internal/ingest', ingestRoutes);

// ── Marketing Engine admin API (JWT-authenticated, admin only) ───────────────
router.use('/admin/marketing', marketingAdminRoutes);

// ── Referral admin API (JWT-authenticated, admin only) ───────────────────────
router.use('/admin/referrals', referralAdminRoutes);

// ── Section Manager admin API (Creator Vibe Phase B — admin only) ────────────
router.use('/admin/sections', adminSectionsRoutes);

// ── World Rules admin API (Phase 3, mig 126 — admin only) ────────────────────
router.use('/admin/world-rules', adminWorldRulesRoutes);

// ── Custom-page registry admin API (App Builder — admin only) ────────────────
router.use('/admin/pages', adminPagesRoutes);

// ── Design System admin API (Creator Experience Engine Phase 1, mig 127-128) ──
router.use('/admin/design-system', adminDesignSystemRoutes);

// ── Theme Library admin API (Creator Experience Engine Phase 2, mig 129-130) ──
router.use('/admin/themes', adminThemesRoutes);

// ── Design Library admin API (Creator Experience Engine Phase 3, mig 131-132) ──
router.use('/admin', adminDesignLayoutsRoutes);   // /admin/design-layouts + /admin/section-styles

// ── Adaptive Renderer preview API (Creator Experience Engine Phase 4a) ────────
router.use('/admin', adminExperiencePreviewRoutes);   // /admin/experience-preview

// ── Experience Templates admin API (Creator Experience Engine Phase 5, mig 133-134)
router.use('/admin/experience-templates', adminTemplatesRoutes);

// ── Creator Experience Studio API (Creator Experience Engine Phase 6a, mig 135)
router.use('/influencers', influencerExperiencesRoutes);   // /influencers/me/experience*

// ── Phase 1-3 ────────────────────────────────────────────────────────────────
router.use('/auth',          authRoutes);
router.use('/brands',        brandRoutes);
router.use('/agencies',      agencyRoutes);
router.use('/referrals',     referralRoutes);
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

// ── Command Center Phase 2 + 3 — clicks rollup + date-change flow ────────────
router.use('/brands',               dateChangeRoutes.brandRouter);   // /brands/me/campaigns/:id/clicks + /date-change-requests
router.use('/campaign-influencers', dateChangeRoutes.ciRouter);      // /campaign-influencers/:id/date-change*

// ── Phase 6 — Notifications (any authenticated user) ─────────────────────────
router.use('/notifications', notificationRoutes);

// ── INFLX Meals — planned-meal marketplace (P1) ──────────────────────────────
router.use('/meals', mealsRoutes);

// ── Listing Engine — drill-down taxonomy tree + facets (public read) + batch-add ──
router.use('/listing',   listingRoutes.publicRouter);
router.use('/brands/me', listingRoutes.brandRouter);

// ── Phase 4 — Public store endpoints (no auth required) ──────────────────────
router.get('/store/:influencer_handle/products', authenticateOptional, followerCtrl.getStoreProducts);
// Library-offer detail (store-direct / showcase taps — no creator handle needed).
// Contract: features/sprint1-offer-pipeline. Pairs with POST /follower/store-offer/pay.
router.get('/follower/store-offer/:id', authenticateOptional, followerCtrl.getStoreOfferDetail);
router.get('/store/:influencer_handle',           authenticateOptional, followerCtrl.getInfluencerStore);
router.get('/business/:brand_id/store',            authenticateOptional, followerCtrl.getBusinessStore);
router.get('/business/:brand_id',                 authenticateOptional, followerCtrl.getBusinessStore);

// Public media re-sign endpoint — stable URLs for uploaded images (dish photos,
// brand covers, admin stock). Re-signs the real R2 URL on each view; only brand
// media assets are reachable (never contracts/KYC). See mediaAsset.controller.
router.get('/media/assets/:id',                   mediaAssetCtrl.serveAsset);
router.get('/media/stock/*',                      mediaAssetCtrl.serveStockImage);
router.get('/category/:category_key',             authenticateOptional, followerCtrl.getCategoryStore);

// ── Listing Engine — category stores with inline products ────────────────────
router.get('/category/:super_category/stores',    authenticateOptional, followerCtrl.getCategoryStores);

// ── Phase A6 — Subscription tier catalog (public read; admin edits via /admin/pricing/tiers in Phase A7)
router.get('/subscription-tiers', subscriptionCtrl.listTiers);

// ── Wave 1 (Dining) — geocoding for restaurant listing wizard ────────────────
// Authenticated: any logged-in user (brand on web). Mock mode in dev returns
// fixed Vijayawada coords; prod hits Google Geocoding API.
router.post('/internal/geocode-maps-url',         authenticate, geocodingCtrl.geocodeMapsUrl);
router.get('/internal/geocode-health',            geocodingCtrl.geocodeHealth);
router.get('/internal/places-health',             geocodingCtrl.placesHealth);

// ── Fashion-1 — product variants (brand-side) + returns workflow ─────────────
router.use('/brands/me', productVariantsRoutes);
router.use('/brands/me', productAddonsRoutes);
router.use('/brands/me', returnsRoutes.brandRouter);   // GET /brands/me/returns (read-only)

// ── Offer Engine — brand-side reusable offer library (Sub-contract A) ────────
router.use('/brands/me', brandOfferRoutes);

// ── F-5 — server-persisted influencer groups (brand-scoped) ──────────────────
router.use('/brands/me', influencerGroupRoutes);
router.use('/follower',  returnsRoutes.followerRouter);
router.use('/admin',     returnsRoutes.adminRouter);

// ── Fashion-2 — creator lookbooks (creator authoring + public viewing) ───────
router.use('/',           lookbooksRoutes.publicRouter);    // /store/:handle/lookbooks
router.use('/influencer', lookbooksRoutes.creatorRouter);   // /influencer/lookbooks*

module.exports = router;
