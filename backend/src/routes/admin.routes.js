'use strict';

const { Router } = require('express');
const { authenticate, requireAdminRole, requireAnyAdminRole } = require('../middleware/auth');
const ctrl = require('../controllers/admin.controller');

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

// Admin user management — superadmin only
router.get('/users',  authenticate, requireAdminRole('superadmin'), ctrl.getAdminUsers);
router.post('/users', authenticate, requireAdminRole('superadmin'), ctrl.createAdminUser);

module.exports = router;
