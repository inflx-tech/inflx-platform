'use strict';

const { Router } = require('express');
const { authenticate, requireAdminRole, requireAnyAdminRole, requireCapability } = require('../middleware/auth');
const ctrl = require('../controllers/admin.controller');
const orderCtrl = require('../controllers/shopperOrders.controller');
const verificationCtrl = require('../controllers/creatorVerification.controller');
const invitationCtrl = require('../controllers/creatorInvitation.controller');
const masterDishCtrl = require('../controllers/adminMasterDish.controller');
const dishQueueCtrl = require('../controllers/adminDishQueue.controller');
const escrowFeeTiersCtrl = require('../controllers/escrowFeeTiers.controller');
const adminOrdersCtrl = require('../controllers/adminOrders.controller');
const shopperCtrl = require('../controllers/shopper.controller');

const router = Router();

// ── B-2 capability/permission model (admin sections) ─────────────────────────
// Section routes are gated by requireCapability('<key>') from the canonical
// catalog in config/adminCapabilities.js (exposed via GET /admin/capabilities).
// superadmin bypasses every capability check; deactivated admins are 403'd.
// Generic dashboard/landing reads (GET /stats) stay on requireAnyAdminRole so
// every admin can render the shell + badges. requireAdminRole/requireAnyAdminRole
// remain in use here and untouched in the other route files.

// Caller introspection + capability catalog (any admin).
router.get('/me',           authenticate, requireAnyAdminRole, ctrl.getMe);
router.get('/capabilities', authenticate, requireAnyAdminRole, ctrl.getCapabilityCatalog);

// Order Fulfillment Engine Unit 3 — platform-wide order oversight.
// Shopper app config — video autoplay/sound defaults and COD, read by the app at launch, changed
// without an update (admin → Follower App). Kept through follower-app-v2.
router.patch('/app-config',       authenticate, requireCapability('settings'), shopperCtrl.updateAppConfig);

router.get('/orders',             authenticate, requireCapability('orders'), adminOrdersCtrl.listOrders);
router.get('/commerce-summary',   authenticate, requireCapability('orders'), adminOrdersCtrl.getCommerceSummary);
router.patch('/orders/:id/status', authenticate, requireCapability('orders'), orderCtrl.adminStatus);   // shopper-ordering: forward only
router.post('/orders/lines/:id/cancel', authenticate, requireCapability('orders'), orderCtrl.adminCancel);

// All admin routes require a valid admin JWT
// Section access is specified per-route via requireCapability (B-2).

// Approval queues — 'approvals'
router.get('/queue/brands',      authenticate, requireCapability('approvals'), ctrl.getBrandQueue);
router.get('/queue/influencers', authenticate, requireCapability('approvals'), ctrl.getInfluencerQueue);

// Status changes — 'approvals'
router.patch('/brands/:id/status',      authenticate, requireCapability('approvals'), ctrl.updateBrandStatus);
router.patch('/influencers/:id/status', authenticate, requireCapability('approvals'), ctrl.updateInfluencerStatus);

// Agency approval (Contract 3a) — 'approvals'
router.get('/queue/agencies',        authenticate, requireCapability('approvals'), ctrl.getAgencyQueue);
router.patch('/agencies/:id/status', authenticate, requireCapability('approvals'), ctrl.updateAgencyStatus);

// Agency directory (referral-agency-admin) — 'referrals'
router.get('/agencies',              authenticate, requireCapability('referrals'), ctrl.getAgencies);

// Platform stats — any admin role (dashboard landing + nav badges)
router.get('/stats', authenticate, requireAnyAdminRole, ctrl.getStats);

// INFLX Meals — platform settings (radius + tolerance + lead time).
// Any admin can read; any admin can update (founder's daily account
// is not always superadmin per the admin-role-gate memory).

// Escrow management — 'escrow'
router.get('/escrow',          authenticate, requireCapability('escrow'), ctrl.getEscrowOverview);
router.post('/escrow/:id/release', authenticate, requireCapability('escrow'), ctrl.adminReleaseEscrow);

// Influencer bulk upload — 'influencers'
// ctrl.bulkUploadInfluencers is [multerMiddleware, asyncHandler] — spread into route
// The creator list. Same capability as the bulk upload it now sits beside.
// Contract: features/admin-account-review (item 2)
router.get('/influencers', authenticate, requireCapability('influencers'), ctrl.getInfluencers);
router.post('/influencers/bulk-upload', authenticate, requireCapability('influencers'), ...ctrl.bulkUploadInfluencers);

// Admin user management — superadmin only (privilege-escalation guard: only a
// superadmin can read/create/modify staff admins + grant capabilities).
router.get('/users',      authenticate, requireAdminRole('superadmin'), ctrl.getAdminUsers);
router.post('/users',     authenticate, requireAdminRole('superadmin'), ctrl.createAdminUser);
router.patch('/users/:id', authenticate, requireAdminRole('superadmin'), ctrl.updateAdminUser);

// Payment config — 'settings' (write); GET readable by all admins.
router.get('/config/payments',   authenticate, requireAnyAdminRole,             ctrl.getPaymentConfig);
router.patch('/config/payments', authenticate, requireCapability('settings'),   ctrl.updatePaymentConfig);

// Brand directory — 'brands'
router.get('/brands', authenticate, requireCapability('brands'), ctrl.getBrands);

// Per-brand platform fee override — 'brands' (finance-style edit, lives in brand directory)
router.patch('/brands/:id/platform-fee', authenticate, requireCapability('brands'), ctrl.setBrandPlatformFee);

// L2 Campaign Protection Fee tiers — 'pricing'
router.get   ('/escrow-fee-tiers',           authenticate, requireCapability('pricing'), escrowFeeTiersCtrl.list);
router.post  ('/escrow-fee-tiers',           authenticate, requireCapability('pricing'), escrowFeeTiersCtrl.create);
router.patch ('/escrow-fee-tiers/:tierKey',  authenticate, requireCapability('pricing'), escrowFeeTiersCtrl.update);
router.delete('/escrow-fee-tiers/:tierKey',  authenticate, requireCapability('pricing'), escrowFeeTiersCtrl.remove);

// L3 Marketplace fee categories (Phase A7-admin) — 'pricing'
const categoriesCtrl = require('../controllers/categories.controller');
router.get   ('/categories',              authenticate, requireCapability('pricing'), categoriesCtrl.list);
router.post  ('/categories',              authenticate, requireCapability('pricing'), categoriesCtrl.create);
router.patch ('/categories/:categoryKey', authenticate, requireCapability('pricing'), categoriesCtrl.update);
router.delete('/categories/:categoryKey', authenticate, requireCapability('pricing'), categoriesCtrl.remove);

// Per-brand L2 escrow fee override — 'brands'
router.patch('/brands/:id/escrow-fee-override', authenticate, requireCapability('brands'), ctrl.setBrandEscrowFeeOverride);

// Per-brand L3 commerce commission override — 'brands' (Wave 1)
router.patch('/brands/:id/commerce-commission-override', authenticate, requireCapability('brands'), ctrl.setBrandCommerceCommissionOverride);

// Per-influencer TDS controls (override + exempt) — 'tax' (Wave 1)
router.patch('/influencers/:id/tax-controls', authenticate, requireCapability('tax'), ctrl.setInfluencerTaxControls);

// Withdrawal / payout management — 'payouts'
router.get('/withdrawals',             authenticate, requireCapability('payouts'), ctrl.getWithdrawals);
router.post('/withdrawals/:id/process', authenticate, requireCapability('payouts'), ctrl.processWithdrawal);

// Brand wallet withdrawals (Wave 2 commit 2) — 'payouts'
router.get('/brand-withdrawals',             authenticate, requireCapability('payouts'), ctrl.getBrandWithdrawals);
router.post('/brand-withdrawals/:id/process', authenticate, requireCapability('payouts'), ctrl.processBrandWithdrawal);

// Monthly tax summary (Wave 4 — compliance reporting) — 'tax'
router.get('/tax-summary', authenticate, requireCapability('tax'), ctrl.getTaxSummary);

// Analytics — 'analytics'
router.get('/analytics', authenticate, requireCapability('analytics'), ctrl.getAnalytics);

// Production queue — flag stuck production events to admin (Phase P.3) — 'production'
// Item 11 (approval §3.3): its brand-web PAGE is retired; the endpoint stays because item 10's
// tests read it, and because the gate column and Delayed flag it gained in item 10 are useful.
router.get('/production/queue', authenticate, requireCapability('production'), ctrl.getProductionQueue);

// ── Item 11 · Test parcels (mockup R18) — a new 'shipping' capability ────────
// Admin plays the courier while the Shiprocket account does not exist. Every press goes
// through the SAME webhook handler a real provider will reach, and is logged with who and
// when (check 35). Contract: features/item11-remote §6.4
const testParcels = require('../controllers/testParcels.controller');
router.get ('/test-parcels',            authenticate, requireCapability('shipping'), testParcels.list);
router.get ('/test-parcels/:id/events', authenticate, requireCapability('shipping'), testParcels.events);
router.post('/test-parcels/:id/events', authenticate, requireCapability('shipping'), testParcels.inject);

// Influencer Instagram rescrape — already in influencer.routes.js (/influencers/:id/rescrape)

// ── Creator verification queue (claimed creator_profiles) — 'marketing' ──────
router.get('/creator-verifications',                 authenticate, requireCapability('marketing'), verificationCtrl.listQueue);
router.post('/creator-verifications/:id/verify',     authenticate, requireCapability('marketing'), verificationCtrl.verify);
router.post('/creator-verifications/:id/reject',     authenticate, requireCapability('marketing'), verificationCtrl.reject);
router.post('/creator-verifications/:id/reset',      authenticate, requireCapability('marketing'), verificationCtrl.reset);

// ── Creator invitations (brand → unclaimed creators outreach queue) — 'marketing' ─
router.get('/creator-invitations',                   authenticate, requireCapability('marketing'), invitationCtrl.adminListInvitations);
router.post('/creator-invitations/:id/contacted',    authenticate, requireCapability('marketing'), invitationCtrl.adminMarkContacted);
router.post('/creator-invitations/:id/expire',       authenticate, requireCapability('marketing'), invitationCtrl.adminExpire);

// ── Master dishes CRUD (restaurant catalogue admin tool) — 'master_data' ─────
router.get   ('/master-dishes',           authenticate, requireCapability('master_data'), masterDishCtrl.listMasterDishes);
router.get   ('/master-dishes/cuisines',  authenticate, requireCapability('master_data'), masterDishCtrl.listCuisines);
// Dish Review Queue (flywheel) — registered before '/master-dishes/:id' so the
// two-segment '/queue' paths aren't shadowed by the single-segment ':id' route.
router.get   ('/master-dishes/queue',     authenticate, requireCapability('master_data'), dishQueueCtrl.listQueue);
router.patch ('/master-dishes/queue/:id', authenticate, requireCapability('master_data'), dishQueueCtrl.resolveQueueItem);
router.post  ('/master-dishes/stock-upload-url', authenticate, requireCapability('master_data'), masterDishCtrl.getStockUploadUrl);
router.post  ('/master-dishes',           authenticate, requireCapability('master_data'), masterDishCtrl.createMasterDish);
router.patch ('/master-dishes/:id',       authenticate, requireCapability('master_data'), masterDishCtrl.updateMasterDish);
router.delete('/master-dishes/:id',       authenticate, requireCapability('master_data'), masterDishCtrl.deleteMasterDish);

// ── Dish groups (food discovery tiles) — 'master_data' ───────────────────────
// Static sub-paths (/suggest, /:id/members) declared around the ':id' route;
// '/suggest' before ':id' so it isn't shadowed.
const dishGroupsCtrl = require('../controllers/adminDishGroups.controller');
router.get   ('/dish-groups',             authenticate, requireCapability('master_data'), dishGroupsCtrl.listDishGroups);
router.get   ('/dish-groups/suggest',     authenticate, requireCapability('master_data'), dishGroupsCtrl.suggestMembers);
router.post  ('/dish-groups',             authenticate, requireCapability('master_data'), dishGroupsCtrl.createDishGroup);
router.get   ('/dish-groups/:id/members', authenticate, requireCapability('master_data'), dishGroupsCtrl.getGroupMembers);
router.put   ('/dish-groups/:id/members', authenticate, requireCapability('master_data'), dishGroupsCtrl.setGroupMembers);
router.patch ('/dish-groups/:id',         authenticate, requireCapability('master_data'), dishGroupsCtrl.updateDishGroup);
router.delete('/dish-groups/:id',         authenticate, requireCapability('master_data'), dishGroupsCtrl.deleteDishGroup);

// ── Features catalog + tier_features + subscription_prices — 'pricing' ───────
const featuresCtrl = require('../controllers/features.controller');
router.get   ('/features',                       authenticate, requireCapability('pricing'), featuresCtrl.listFeatures);
router.post  ('/features',                       authenticate, requireCapability('pricing'), featuresCtrl.createFeature);
router.patch ('/features/:feature_key',          authenticate, requireCapability('pricing'), featuresCtrl.updateFeature);
router.delete('/features/:feature_key',          authenticate, requireCapability('pricing'), featuresCtrl.softDeleteFeature);

router.get   ('/tiers/:tier_key/features',       authenticate, requireCapability('pricing'), featuresCtrl.listTierFeatures);
router.put   ('/tiers/:tier_key/features',       authenticate, requireCapability('pricing'), featuresCtrl.upsertTierFeatures);

router.get   ('/tiers/:tier_key/prices',         authenticate, requireCapability('pricing'), featuresCtrl.listTierPrices);
router.post  ('/tiers/:tier_key/prices',         authenticate, requireCapability('pricing'), featuresCtrl.createPrice);
router.patch ('/prices/:price_id',               authenticate, requireCapability('pricing'), featuresCtrl.updatePrice);
router.delete('/prices/:price_id',               authenticate, requireCapability('pricing'), featuresCtrl.softDeletePrice);

// Phase A14 — per-brand feature overrides — 'brands' (per-brand edit, reversible).
router.get   ('/brands/:id/overrides',           authenticate, requireCapability('brands'), featuresCtrl.listBrandOverrides);
router.put   ('/brands/:id/overrides',           authenticate, requireCapability('brands'), featuresCtrl.upsertBrandOverrides);

// ── Subscription admin (legacy A7-admin endpoints — finally wired in A10.5) ──
// These have existed in subscription.controller.js since commit 3920772 but
// were never mounted in any route file. Hence the empty tier list in prod.
const subscriptionCtrl = require('../controllers/subscription.controller');
router.get   ('/subscription-tiers',             authenticate, requireCapability('subscriptions'), subscriptionCtrl.adminListTiers);
router.post  ('/subscription-tiers',             authenticate, requireCapability('subscriptions'), subscriptionCtrl.adminCreateTier);
router.patch ('/subscription-tiers/:tierKey',    authenticate, requireCapability('subscriptions'), subscriptionCtrl.adminUpdateTier);
router.get   ('/subscriptions',                  authenticate, requireCapability('subscriptions'), subscriptionCtrl.adminListSubscriptions);
router.get   ('/subscription-invoices',          authenticate, requireCapability('subscriptions'), subscriptionCtrl.adminListInvoices);

// ── Tag vocabulary (merch-engine Phase 1a) — 'categories' ────────────────────
const tagVocabCtrl = require('../controllers/adminTagVocabulary.controller');
router.get   ('/tag-vocabulary',     authenticate, requireCapability('categories'), tagVocabCtrl.listVocabulary);
router.post  ('/tag-vocabulary',     authenticate, requireCapability('categories'), tagVocabCtrl.createTag);
router.patch ('/tag-vocabulary/:id', authenticate, requireCapability('categories'), tagVocabCtrl.updateTag);
router.delete('/tag-vocabulary/:id', authenticate, requireCapability('categories'), tagVocabCtrl.deleteTag);

// ── The old shopper app's admin (follower category tiles, home verticals, the Section Library)
// was removed with the old app on 29 Sep 2026 (follower-app-v2).

// Collection Library removed 2026-06-23 (dead/dormant — superseded by Section Library).

module.exports = router;
