'use strict';

const { Router } = require('express');
const { authenticate, requireRole, requireAdminRole } = require('../middleware/auth');
const ctrl = require('../controllers/brand.controller');

const walletRoutes = require('./wallet.routes');
const { getBrandEscrow, getCampaignEscrow } = require('../controllers/escrow.controller');
const enquiryCtrl = require('../controllers/enquiry.controller');
const commissionCtrl = require('../controllers/commission.controller');
const transactionCtrl = require('../controllers/transaction.controller');

const router = Router();

// Brand self-service routes (require brand role)
router.post('/register',  authenticate, requireRole('brand'), ctrl.register);
router.get('/me',         authenticate, requireRole('brand'), ctrl.getMe);
router.patch('/me',       authenticate, requireRole('brand'), ctrl.updateMe);
router.post('/resubmit',  authenticate, requireRole('brand'), ctrl.resubmit);

// Escrow overview (Phase 3 — Block E)
router.get('/me/escrow', authenticate, requireRole('brand'), getBrandEscrow);

// Campaign-specific escrow breakdown
router.get('/me/campaigns/:campaign_id/escrow', authenticate, requireRole('brand'), getCampaignEscrow);

// Phase 4 — Enquiry leads
router.get('/me/enquiries',         authenticate, requireRole('brand'), enquiryCtrl.listEnquiries);
router.patch('/me/enquiries/:id',   authenticate, requireRole('brand'), enquiryCtrl.updateEnquiry);

// Online orders — brand-side order management
router.get('/me/orders',                       authenticate, requireRole('brand'), ctrl.listBrandOrders);
router.patch('/me/orders/:id/status',          authenticate, requireRole('brand'), transactionCtrl.updateOrderStatus);

// Phase 4 — Brand conversion analytics
router.get('/me/campaigns/:campaign_id/conversions', authenticate, requireRole('brand'), commissionCtrl.getConversions);

// Category schema (drives dynamic product form)
router.get('/me/schema',            authenticate, requireRole('brand'), ctrl.getCategorySchema);

// Master catalogue — pre-seeded vehicles/services for car_rental and salon
router.get('/me/master-catalogue',  authenticate, requireRole('brand'), ctrl.getMasterCatalogue);

// Brand products — full CRUD with category-aware validation
router.get('/me/products',        authenticate, requireRole('brand'), ctrl.listProducts);
router.post('/me/products',       authenticate, requireRole('brand'), ctrl.createProduct);
router.patch('/me/products/:pid', authenticate, requireRole('brand'), ctrl.updateProduct);
router.delete('/me/products/:pid',authenticate, requireRole('brand'), ctrl.deleteProduct);

// Wallet sub-router — all routes under /brands/me/wallet/*
// Auth is applied here so wallet routes don't need to repeat it
router.use('/me/wallet', authenticate, requireRole('brand'), walletRoutes);

// Store preview — brand sees their store as followers see it
router.get('/me/store-preview', authenticate, requireRole('brand'), ctrl.storePreview);

// Public brand profile (any authenticated user — influencers viewing brand info from offers)
router.get('/:id/public', authenticate, ctrl.getPublicProfile);

// Admin routes (reviewer+ can view, approve, reject)
router.get('/:id',         authenticate, requireAdminRole('reviewer'), ctrl.getById);
router.patch('/:id/status', authenticate, requireAdminRole('reviewer'), ctrl.updateStatus);

module.exports = router;
