'use strict';

const { Router } = require('express');
const { authenticate, requireAdminRole, requireAnyAdminRole } = require('../middleware/auth');
const ctrl = require('../controllers/admin.controller');
const verificationCtrl = require('../controllers/creatorVerification.controller');
const invitationCtrl = require('../controllers/creatorInvitation.controller');

const router = Router();

// All admin routes require a valid admin JWT
// Minimum role is specified per-route based on the permission matrix (spec Section 5.2)

// Approval queues — reviewer+
router.get('/queue/brands',      authenticate, requireAdminRole('reviewer'), ctrl.getBrandQueue);
router.get('/queue/influencers', authenticate, requireAdminRole('reviewer'), ctrl.getInfluencerQueue);

// Status changes — reviewer+
router.patch('/brands/:id/status',      authenticate, requireAdminRole('reviewer'), ctrl.updateBrandStatus);
router.patch('/influencers/:id/status', authenticate, requireAdminRole('reviewer'), ctrl.updateInfluencerStatus);

// Platform stats — any admin role
router.get('/stats', authenticate, requireAnyAdminRole, ctrl.getStats);

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

// Withdrawal / payout management — finance+
router.get('/withdrawals',             authenticate, requireAdminRole('finance'), ctrl.getWithdrawals);
router.post('/withdrawals/:id/process', authenticate, requireAdminRole('finance'), ctrl.processWithdrawal);

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

module.exports = router;
