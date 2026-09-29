'use strict';

const { Router } = require('express');

const authRoutes        = require('./auth.routes');
const brandRoutes       = require('./brand.routes');
const influencerRoutes  = require('./influencer.routes');
const adminRoutes       = require('./admin.routes');
const adminSectionsRoutes = require('./adminSections.routes');
const adminWorldRulesRoutes = require('./adminWorldRules.routes');
// registration-and-profile — the Other niche queue (spec §9A.3)
const adminNichesRoutes = require('./adminNiches.routes');
const adminPagesRoutes = require('./adminPages.routes');
const adminConceptsRoutes = require('./adminConcepts.routes');
const creatorPostsRoutes = require('./creatorPosts.routes');
const shoppablePostsRoutes = require('./shoppablePosts.routes');
const adminPostsRoutes = require('./adminPosts.routes');
const creatorPostsController = require('../controllers/creatorPosts.controller');
const brandCreatorImagesRoutes = require('./brandCreatorImages.routes');
const campaignRoutes    = require('./campaign.routes');
const offerRoutes       = require('./offer.routes');
const negotiationRoutes = require('./negotiation.routes');
const contractRoutes    = require('./contract.routes');
const deliverableRoutes = require('./deliverable.routes');

// Phase 4
const followerRoutes    = require('./follower.routes');
const transactionRoutes = require('./transaction.routes');
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
// collab-part2 — the other half of the handshake: brand -> creator requests, the
// creator's inbox and preferences, and the admin-editable limits.

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

// Food World P2 — product add-on/variation authoring (brand-side)
const productAddonsRoutes   = require('./productAddons.routes');

// Offer Engine — brand-side reusable offer library (Sub-contract A)
const brandOfferRoutes      = require('./brandOffer.routes');

// F-5 — server-persisted influencer groups (brand-scoped saved groups)
const influencerGroupRoutes = require('./influencerGroup.routes');
// Stage 1 — reading the negotiation history. Everything has been recorded since
// migration 152; nothing could read it back until now.
const collabDiaryRoutes = require('./collabDiary.routes');

// Fashion-2 — creator-curated lookbooks (outfit collections)

// INFLX Meals — planned-meal marketplace (P1 vertical slice)

// Listing Engine — drill-down taxonomy (fashion/furniture): tree + facets + batch-add
const listingRoutes         = require('./listing.routes');

// Phase 4 — no-auth public store/category controllers
const followerCtrl      = require('../controllers/follower.controller');
const { authenticateOptional, authenticate } = require('../middleware/auth');

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

// ── Section Manager admin API (Creator Vibe Phase B — admin only) ────────────
router.use('/admin/sections', adminSectionsRoutes);

// ── World Rules admin API (Phase 3, mig 126 — admin only) ────────────────────
router.use('/admin/world-rules', adminWorldRulesRoutes);

// ── Other-niche queue (registration-and-profile) ─────────────────────────────
router.use('/admin/niches', adminNichesRoutes);

// ── Custom-page registry admin API (App Builder — admin only) ────────────────
router.use('/admin/pages', adminPagesRoutes);

// ── Creator Experience Engine (System B) RETIRED — Concept P0 (2026-07-23).
// design-system/themes/design-layouts/experience-preview/experience-templates/
// creator-experience routes deleted; tables ship empty and are dropped in a
// later phase. creatorImagery (brand-side creator-image approval) is KEPT —
// it seeds the Phase-2 creator media pipeline.

// ── Concept engine admin API (Post/Concept P1, mig 139) ──────────────────────
router.use('/admin', adminConceptsRoutes);   // /admin/concept-templates + /admin/concepts/preview + /admin/collections

// ── Creator posts (Post/Concept P2, mig 140) ─────────────────────────────────
router.use('/influencers', shoppablePostsRoutes); // shoppable-posts-v2: Create tab, posts, collections
router.use('/influencers', creatorPostsRoutes);   // /me/post-scope + /me/posts*
router.use('/admin/posts', adminPostsRoutes);     // moderation queue
router.get('/media/post/:id', creatorPostsController.servePostMedia);   // public slide serve

// ── Creator imagery: brand approval + display source (Phase 7a, mig 136-137) ──
router.use('/brands/me', brandCreatorImagesRoutes);        // /brands/me/creator-images + /products/:id/image-source

// ── Item 2 — pitch & invitation settings, blocks, reference lists ──────────
// Mounted BEFORE brandRoutes / influencerRoutes so /brands/me/pitch-settings and
// /influencers/me/invitation-settings can never be shadowed by a parameterised route.
// Contract: features/item2-pitch-invitation-settings
const collabSettingsRoutes = require('./collabSettings.routes');
router.use('/', collabSettingsRoutes);

// ── Item 3 — Discover creators, Worked with, Find brands, branches, brand products,
// place resolution, reference cities. Same reason for mounting here: fixed paths first.
// Contract: features/item3-discovery-profiles-groups
const discoveryRoutes = require('./discovery.routes');
router.use('/', discoveryRoutes);
// Item 3b — social numbers (Instagram/YouTube through Apify). Fixed paths under
// /influencers/me/social and /admin/social; mounted before influencer.routes' /:id.
// Contract: features/item3b-social-numbers
const socialRoutes = require('./social.routes');
router.use('/', socialRoutes);
// Item 5 — the creator's invitations under /influencers/me/invitations; mounted before
// influencer.routes' /:id for the same reason. Contract: features/item5-invitations
const invitationRoutes = require('./invitation.routes');
router.use('/', invitationRoutes);
// Item 6 — negotiation, the move request, the pool, the platform settings. Fixed paths first.
// Contract: features/item6-negotiation
const item6Routes = require('./item6.routes');
router.use('/', item6Routes);
// Item 7 — the agreement, the two signatures, the standard terms. Fixed paths first.
// Contract: features/item7-agreement
const item7Routes = require('./item7.routes');
router.use('/', item7Routes);
// Item 8 — the creator's pitch, and its thread on item 6's engine. Fixed paths first.
// Contract: features/item8-pitch
const item8Routes = require('./item8.routes');
router.use('/', item8Routes);
// Item 10 — the Store Visit shoot plan, and its time thread on item 6's engine.
// Contract: features/item10-store-visit
const item10Routes = require('./item10.routes');
router.use('/', item10Routes);
// Item 11 — the Remote shoot: her address, the products, the parcel, the return.
// Contract: features/item11-remote
const item11Routes = require('./item11.routes');
router.use('/', item11Routes);

// Contract: features/item12-content
const item12Routes = require('./item12.routes');
router.use('/', item12Routes);

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

// ── retire-google (20 Sep 2026): /internal/geocode-maps-url, geocode-health and places-health
// are gone with the Google key. Nothing live for fashion depended on them.

// ── Fashion-1 — product variants (brand-side) + returns workflow ─────────────
router.use('/brands/me', productVariantsRoutes);
router.use('/brands/me', productAddonsRoutes);
router.use('/brands/me', returnsRoutes.brandRouter);   // GET /brands/me/returns (read-only)

// ── Offer Engine — brand-side reusable offer library (Sub-contract A) ────────
router.use('/brands/me', brandOfferRoutes);

// ── F-5 — server-persisted influencer groups (brand-scoped) ──────────────────
router.use('/brands/me', influencerGroupRoutes);

// ── Stage 1 — "what happened here", the same page for both sides ─────────────
router.use('/collab-diary', collabDiaryRoutes);
router.use('/follower',  returnsRoutes.followerRouter);
router.use('/admin',     returnsRoutes.adminRouter);

// ── Fashion-2 — creator lookbooks (creator authoring + public viewing) ───────

module.exports = router;
