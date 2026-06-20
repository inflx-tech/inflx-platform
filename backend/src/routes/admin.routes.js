'use strict';

const { Router } = require('express');
const { authenticate, requireAdminRole, requireAnyAdminRole } = require('../middleware/auth');
const ctrl = require('../controllers/admin.controller');
const verificationCtrl = require('../controllers/creatorVerification.controller');
const invitationCtrl = require('../controllers/creatorInvitation.controller');
const masterDishCtrl = require('../controllers/adminMasterDish.controller');
const dishQueueCtrl = require('../controllers/adminDishQueue.controller');
const escrowFeeTiersCtrl = require('../controllers/escrowFeeTiers.controller');
const adminOrdersCtrl = require('../controllers/adminOrders.controller');

const router = Router();

// Order Fulfillment Engine Unit 3 — platform-wide order oversight (any admin role).
router.get('/orders',             authenticate, requireAnyAdminRole, adminOrdersCtrl.listOrders);
router.patch('/orders/:id/status', authenticate, requireAnyAdminRole, adminOrdersCtrl.updateStatus);

// All admin routes require a valid admin JWT
// Minimum role is specified per-route based on the permission matrix (spec Section 5.2)

// Approval queues — reviewer+
router.get('/queue/brands',      authenticate, requireAdminRole('reviewer'), ctrl.getBrandQueue);
router.get('/queue/influencers', authenticate, requireAdminRole('reviewer'), ctrl.getInfluencerQueue);

// Status changes — reviewer+
router.patch('/brands/:id/status',      authenticate, requireAdminRole('reviewer'), ctrl.updateBrandStatus);
router.patch('/influencers/:id/status', authenticate, requireAdminRole('reviewer'), ctrl.updateInfluencerStatus);

// Agency approval (Contract 3a) — reviewer+
router.get('/queue/agencies',        authenticate, requireAdminRole('reviewer'), ctrl.getAgencyQueue);
router.patch('/agencies/:id/status', authenticate, requireAdminRole('reviewer'), ctrl.updateAgencyStatus);

// Agency directory (referral-agency-admin) — any admin can view
router.get('/agencies',              authenticate, requireAnyAdminRole,          ctrl.getAgencies);

// Platform stats — any admin role
router.get('/stats', authenticate, requireAnyAdminRole, ctrl.getStats);

// INFLX Meals — platform settings (radius + tolerance + lead time).
// Any admin can read; any admin can update (founder's daily account
// is not always superadmin per the admin-role-gate memory).
const mealsCtrl = require('../controllers/meals.controller');
router.get('/meals/settings',  authenticate, requireAnyAdminRole, mealsCtrl.adminGetSettings);
router.put('/meals/settings',  authenticate, requireAnyAdminRole, mealsCtrl.adminPutSettings);

// Escrow management — finance+
router.get('/escrow',          authenticate, requireAdminRole('finance'), ctrl.getEscrowOverview);
router.post('/escrow/:id/release', authenticate, requireAdminRole('finance'), ctrl.adminReleaseEscrow);

// Influencer bulk upload — reviewer+
// ctrl.bulkUploadInfluencers is [multerMiddleware, asyncHandler] — spread into route
router.post('/influencers/bulk-upload', authenticate, requireAdminRole('reviewer'), ...ctrl.bulkUploadInfluencers);

// Admin user management — superadmin only
router.get('/users',  authenticate, requireAdminRole('superadmin'), ctrl.getAdminUsers);
router.post('/users', authenticate, requireAdminRole('superadmin'), ctrl.createAdminUser);

// Payment config — superadmin only (GET readable by all admins)
router.get('/config/payments',   authenticate, requireAnyAdminRole,           ctrl.getPaymentConfig);
router.patch('/config/payments', authenticate, requireAdminRole('superadmin'), ctrl.updatePaymentConfig);

// Brand directory — reviewer+
router.get('/brands', authenticate, requireAdminRole('reviewer'), ctrl.getBrands);

// Per-brand platform fee override — finance+
router.patch('/brands/:id/platform-fee', authenticate, requireAdminRole('finance'), ctrl.setBrandPlatformFee);

// L2 Campaign Protection Fee tiers — read by any admin, write by superadmin
router.get   ('/escrow-fee-tiers',           authenticate, requireAnyAdminRole,           escrowFeeTiersCtrl.list);
router.post  ('/escrow-fee-tiers',           authenticate, requireAdminRole('superadmin'), escrowFeeTiersCtrl.create);
router.patch ('/escrow-fee-tiers/:tierKey',  authenticate, requireAdminRole('superadmin'), escrowFeeTiersCtrl.update);
router.delete('/escrow-fee-tiers/:tierKey',  authenticate, requireAdminRole('superadmin'), escrowFeeTiersCtrl.remove);

// L3 Marketplace fee categories (Phase A7-admin) — read by any admin, write by superadmin
const categoriesCtrl = require('../controllers/categories.controller');
router.get   ('/categories',              authenticate, requireAnyAdminRole,           categoriesCtrl.list);
router.post  ('/categories',              authenticate, requireAdminRole('superadmin'), categoriesCtrl.create);
router.patch ('/categories/:categoryKey', authenticate, requireAdminRole('superadmin'), categoriesCtrl.update);
router.delete('/categories/:categoryKey', authenticate, requireAdminRole('superadmin'), categoriesCtrl.remove);

// Per-brand L2 escrow fee override — finance+
router.patch('/brands/:id/escrow-fee-override', authenticate, requireAdminRole('finance'), ctrl.setBrandEscrowFeeOverride);

// Per-brand L3 commerce commission override — finance+ (Wave 1)
router.patch('/brands/:id/commerce-commission-override', authenticate, requireAdminRole('finance'), ctrl.setBrandCommerceCommissionOverride);

// Per-influencer TDS controls (override + exempt) — finance+ (Wave 1)
router.patch('/influencers/:id/tax-controls', authenticate, requireAdminRole('finance'), ctrl.setInfluencerTaxControls);

// Withdrawal / payout management — finance+
router.get('/withdrawals',             authenticate, requireAdminRole('finance'), ctrl.getWithdrawals);
router.post('/withdrawals/:id/process', authenticate, requireAdminRole('finance'), ctrl.processWithdrawal);

// Brand wallet withdrawals (Wave 2 commit 2) — finance+
router.get('/brand-withdrawals',             authenticate, requireAdminRole('finance'), ctrl.getBrandWithdrawals);
router.post('/brand-withdrawals/:id/process', authenticate, requireAdminRole('finance'), ctrl.processBrandWithdrawal);

// Monthly tax summary (Wave 4 — compliance reporting) — finance+
router.get('/tax-summary', authenticate, requireAdminRole('finance'), ctrl.getTaxSummary);

// Analytics — any admin role
router.get('/analytics', authenticate, requireAnyAdminRole, ctrl.getAnalytics);

// Production queue — flag stuck production events to admin (Phase P.3)
router.get('/production/queue', authenticate, requireAnyAdminRole, ctrl.getProductionQueue);

// Influencer Instagram rescrape — already in influencer.routes.js (/influencers/:id/rescrape)

// ── Creator verification queue (claimed creator_profiles) — reviewer+ ────────
router.get('/creator-verifications',                 authenticate, requireAdminRole('reviewer'), verificationCtrl.listQueue);
router.post('/creator-verifications/:id/verify',     authenticate, requireAdminRole('reviewer'), verificationCtrl.verify);
router.post('/creator-verifications/:id/reject',     authenticate, requireAdminRole('reviewer'), verificationCtrl.reject);
router.post('/creator-verifications/:id/reset',      authenticate, requireAdminRole('reviewer'), verificationCtrl.reset);

// ── Creator invitations (brand → unclaimed creators outreach queue) ──────────
router.get('/creator-invitations',                   authenticate, requireAdminRole('reviewer'), invitationCtrl.adminListInvitations);
router.post('/creator-invitations/:id/contacted',    authenticate, requireAdminRole('reviewer'), invitationCtrl.adminMarkContacted);
router.post('/creator-invitations/:id/expire',       authenticate, requireAdminRole('reviewer'), invitationCtrl.adminExpire);

// ── Master dishes CRUD (restaurant catalogue admin tool) ─────────────────────
router.get   ('/master-dishes',           authenticate, requireAdminRole('reviewer'), masterDishCtrl.listMasterDishes);
router.get   ('/master-dishes/cuisines',  authenticate, requireAdminRole('reviewer'), masterDishCtrl.listCuisines);
// Dish Review Queue (flywheel) — registered before '/master-dishes/:id' so the
// two-segment '/queue' paths aren't shadowed by the single-segment ':id' route.
router.get   ('/master-dishes/queue',     authenticate, requireAdminRole('reviewer'), dishQueueCtrl.listQueue);
router.patch ('/master-dishes/queue/:id', authenticate, requireAdminRole('reviewer'), dishQueueCtrl.resolveQueueItem);
router.post  ('/master-dishes/stock-upload-url', authenticate, requireAdminRole('reviewer'), masterDishCtrl.getStockUploadUrl);
router.post  ('/master-dishes',           authenticate, requireAdminRole('reviewer'), masterDishCtrl.createMasterDish);
router.patch ('/master-dishes/:id',       authenticate, requireAdminRole('reviewer'), masterDishCtrl.updateMasterDish);
router.delete('/master-dishes/:id',       authenticate, requireAdminRole('reviewer'), masterDishCtrl.deleteMasterDish);

// ── Features catalog + tier_features + subscription_prices — Phase A10 ───────
const featuresCtrl = require('../controllers/features.controller');
router.get   ('/features',                       authenticate, requireAnyAdminRole,            featuresCtrl.listFeatures);
router.post  ('/features',                       authenticate, requireAdminRole('superadmin'), featuresCtrl.createFeature);
router.patch ('/features/:feature_key',          authenticate, requireAdminRole('superadmin'), featuresCtrl.updateFeature);
router.delete('/features/:feature_key',          authenticate, requireAdminRole('superadmin'), featuresCtrl.softDeleteFeature);

router.get   ('/tiers/:tier_key/features',       authenticate, requireAnyAdminRole,            featuresCtrl.listTierFeatures);
router.put   ('/tiers/:tier_key/features',       authenticate, requireAdminRole('superadmin'), featuresCtrl.upsertTierFeatures);

router.get   ('/tiers/:tier_key/prices',         authenticate, requireAnyAdminRole,            featuresCtrl.listTierPrices);
router.post  ('/tiers/:tier_key/prices',         authenticate, requireAdminRole('superadmin'), featuresCtrl.createPrice);
router.patch ('/prices/:price_id',               authenticate, requireAdminRole('superadmin'), featuresCtrl.updatePrice);
router.delete('/prices/:price_id',               authenticate, requireAdminRole('superadmin'), featuresCtrl.softDeletePrice);

// Phase A14 — per-brand feature overrides. requireAnyAdminRole on both —
// override changes are per-brand and trivially reversible (admin can flip
// back to tier default any time). Memory: feedback_admin_role_gates.
router.get   ('/brands/:id/overrides',           authenticate, requireAnyAdminRole,            featuresCtrl.listBrandOverrides);
router.put   ('/brands/:id/overrides',           authenticate, requireAnyAdminRole,            featuresCtrl.upsertBrandOverrides);

// ── Subscription admin (legacy A7-admin endpoints — finally wired in A10.5) ──
// These have existed in subscription.controller.js since commit 3920772 but
// were never mounted in any route file. Hence the empty tier list in prod.
const subscriptionCtrl = require('../controllers/subscription.controller');
router.get   ('/subscription-tiers',             authenticate, requireAnyAdminRole,            subscriptionCtrl.adminListTiers);
router.post  ('/subscription-tiers',             authenticate, requireAdminRole('superadmin'), subscriptionCtrl.adminCreateTier);
router.patch ('/subscription-tiers/:tierKey',    authenticate, requireAdminRole('superadmin'), subscriptionCtrl.adminUpdateTier);
router.get   ('/subscriptions',                  authenticate, requireAnyAdminRole,            subscriptionCtrl.adminListSubscriptions);
router.get   ('/subscription-invoices',          authenticate, requireAnyAdminRole,            subscriptionCtrl.adminListInvoices);

// ── Tag vocabulary (merch-engine Phase 1a) — any admin role (reversible) ─────
const tagVocabCtrl = require('../controllers/adminTagVocabulary.controller');
router.get   ('/tag-vocabulary',     authenticate, requireAnyAdminRole, tagVocabCtrl.listVocabulary);
router.post  ('/tag-vocabulary',     authenticate, requireAnyAdminRole, tagVocabCtrl.createTag);
router.patch ('/tag-vocabulary/:id', authenticate, requireAnyAdminRole, tagVocabCtrl.updateTag);
router.delete('/tag-vocabulary/:id', authenticate, requireAnyAdminRole, tagVocabCtrl.deleteTag);

// ── Follower category tiles (merch-engine Phase 1b) — any admin (reversible) ─
const followerCatCtrl = require('../controllers/adminFollowerCategories.controller');
router.get   ('/follower-categories',     authenticate, requireAnyAdminRole, followerCatCtrl.list);
router.post  ('/follower-categories',     authenticate, requireAnyAdminRole, followerCatCtrl.create);
router.patch ('/follower-categories/:id', authenticate, requireAnyAdminRole, followerCatCtrl.update);
router.delete('/follower-categories/:id', authenticate, requireAnyAdminRole, followerCatCtrl.remove);

// ── Section Library (merch-engine Phase 3b) — reusable data-driven sections ──
const sectionLibraryCtrl = require('../controllers/adminSectionLibrary.controller');
router.get   ('/section-library',         authenticate, requireAnyAdminRole, sectionLibraryCtrl.list);
router.post  ('/section-library',         authenticate, requireAnyAdminRole, sectionLibraryCtrl.create);
router.post  ('/section-library/preview', authenticate, requireAnyAdminRole, sectionLibraryCtrl.preview);
router.patch ('/section-library/:id',     authenticate, requireAnyAdminRole, sectionLibraryCtrl.update);

// ── Collection Library (merch-engine Phase 4b) — group of sections ──────────
const collectionLibraryCtrl = require('../controllers/adminCollectionLibrary.controller');
router.get   ('/collection-library',     authenticate, requireAnyAdminRole, collectionLibraryCtrl.list);
router.post  ('/collection-library',     authenticate, requireAnyAdminRole, collectionLibraryCtrl.create);
router.patch ('/collection-library/:id', authenticate, requireAnyAdminRole, collectionLibraryCtrl.update);

module.exports = router;
