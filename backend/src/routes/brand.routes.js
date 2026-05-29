'use strict';

const { Router } = require('express');
const { authenticate, authenticateWithQuery, requireRole, requireAdminRole, requireApproved } = require('../middleware/auth');
const { checkQuota } = require('../middleware/quotaCheck');
const ctrl = require('../controllers/brand.controller');
const subCtrl = require('../controllers/subscription.controller');

const walletRoutes = require('./wallet.routes');
const { getBrandEscrow, getCampaignEscrow } = require('../controllers/escrow.controller');
const enquiryCtrl = require('../controllers/enquiry.controller');
const commissionCtrl = require('../controllers/commission.controller');
const transactionCtrl = require('../controllers/transaction.controller');
const inboxCtrl = require('../controllers/brandInbox.controller');
const bookingsCtrl = require('../controllers/brandBookings.controller');
const mediaCtrl = require('../controllers/mediaAsset.controller');
const linkCtrl = require('../controllers/referenceLink.controller');
const invitationCtrl = require('../controllers/creatorInvitation.controller');
const payoutCtrl = require('../controllers/payoutAccount.controller');

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

const router = Router();

// Brand self-service routes (require brand role)
router.post('/register',  authenticate, requireRole('brand'), ctrl.register);
router.get('/me',         authenticate, requireRole('brand'), ctrl.getMe);
router.patch('/me',       authenticate, requireRole('brand'), ctrl.updateMe);
router.post('/resubmit',  authenticate, requireRole('brand'), ctrl.resubmit);

// Brand inbox — items waiting on brand action (negotiations, reviews, signatures)
router.get('/me/inbox-summary',  authenticate, requireRole('brand'), inboxCtrl.getSummary);
router.get('/me/negotiations',   authenticate, requireRole('brand'), inboxCtrl.listNegotiations);
router.get('/me/deliverables',   authenticate, requireRole('brand'), inboxCtrl.listDeliverables);
router.get('/me/failures',       authenticate, requireRole('brand'), inboxCtrl.listFailures);
router.get('/me/applications',   authenticate, requireRole('brand'), inboxCtrl.listApplications);

// Escrow overview (Phase 3 — Block E)
router.get('/me/escrow', authenticate, requireRole('brand'), getBrandEscrow);

// Campaign-specific escrow breakdown
router.get('/me/campaigns/:campaign_id/escrow', authenticate, requireRole('brand'), getCampaignEscrow);

// Phase 4 — Enquiry leads
router.get('/me/enquiries',         authenticate, requireRole('brand'), enquiryCtrl.listEnquiries);
router.patch('/me/enquiries/:id',   authenticate, requireRole('brand'), enquiryCtrl.updateEnquiry);

// Wave 2 — BookingsInbox: incoming follower_bookings with creator attribution.
// Brand confirms/rejects; rejecting also flips the underlying booking_status
// to 'cancelled'. See brandBookings.controller.js for the brand_status model.
router.get ('/me/bookings',              authenticate, requireRole('brand'), bookingsCtrl.list);
router.post('/me/bookings/:id/confirm',  authenticate, requireRole('brand'), bookingsCtrl.confirm);
router.post('/me/bookings/:id/reject',   authenticate, requireRole('brand'), bookingsCtrl.reject);

// Online orders — brand-side order management
router.get('/me/orders',                       authenticate, requireRole('brand'), ctrl.listBrandOrders);
// All transactions (pay_at_store + prebook + online_order) with filters
router.get('/me/transactions',                 authenticate, requireRole('brand'), ctrl.listAllTransactions);
router.patch('/me/orders/:id/status',          authenticate, requireRole('brand'), transactionCtrl.updateOrderStatus);

// Phase 4 — Brand conversion analytics
router.get('/me/campaigns/:campaign_id/conversions', authenticate, requireRole('brand'), commissionCtrl.getConversions);

// Category schema (drives dynamic product form)
router.get('/me/schema',            authenticate, requireRole('brand'), ctrl.getCategorySchema);

// Listing engine endpoints
router.get('/me/listing-config',    authenticate, requireRole('brand'), ctrl.getListingConfig);
router.get('/me/quality-score',     authenticate, requireRole('brand'), ctrl.getQualityScore);
router.get('/me/listing-preview',   authenticate, requireRole('brand'), ctrl.getListingPreview);

// Master catalogue — pre-seeded vehicles/services for car_rental and salon
router.get('/me/master-catalogue',  authenticate, requireRole('brand'), ctrl.getMasterCatalogue);

// Excel bulk upload
router.get('/me/listing-template/download',  authenticate, requireRole('brand'), ctrl.downloadListingTemplate);
router.get('/me/listing-template/columns',   authenticate, requireRole('brand'), ctrl.getTemplateColumns);
router.post('/me/products/bulk-upload',      authenticate, requireRole('brand'), requireApproved, upload.single('file'), ctrl.bulkUploadProducts);

// Brand products — full CRUD with category-aware validation
router.get('/me/products',        authenticate, requireRole('brand'), ctrl.listProducts);
router.post('/me/products',       authenticate, requireRole('brand'), requireApproved, checkQuota('createProduct'), ctrl.createProduct);

// ── Phase A6 — Subscription / billing (brand self-service) ────────────────────
router.get('/me/subscription',          authenticate, requireRole('brand'), subCtrl.getSubscription);
router.post('/me/subscription/upgrade', authenticate, requireRole('brand'), subCtrl.upgrade);
router.get('/me/billing/invoices',      authenticate, requireRole('brand'), subCtrl.listInvoices);
router.get('/me/billing/invoices/:id/pdf', authenticateWithQuery, requireRole('brand'), subCtrl.getInvoicePdf);
router.get('/me/quota-preflight',       authenticate, requireRole('brand'), subCtrl.quotaPreflight);  // Phase A12.1.5
router.patch('/me/products/:pid', authenticate, requireRole('brand'), ctrl.updateProduct);
router.delete('/me/products/:pid',authenticate, requireRole('brand'), ctrl.deleteProduct);

// Wallet sub-router — all routes under /brands/me/wallet/*
// Auth is applied here so wallet routes don't need to repeat it
router.use('/me/wallet', authenticate, requireRole('brand'), walletRoutes);

// Wave 3 — commerce settlement: brand payout-account (Razorpay Route) onboarding
router.get ('/me/payout-account', authenticate, requireRole('brand'), payoutCtrl.getPayoutAccount);
router.post('/me/payout-account', authenticate, requireRole('brand'), payoutCtrl.createPayoutAccount);

// Media Gallery — brand asset library (logos, creatives, brand kits)
router.post  ('/me/media-assets/upload-url',        authenticate, requireRole('brand'), mediaCtrl.getUploadUrl);
router.get   ('/me/media-assets/usage',             authenticate, requireRole('brand'), mediaCtrl.getUsage);
router.get   ('/me/media-assets',                   authenticate, requireRole('brand'), mediaCtrl.listAssets);
router.post  ('/me/media-assets',                   authenticate, requireRole('brand'), mediaCtrl.createAsset);
router.get   ('/me/media-assets/:id/download-url',  authenticate, requireRole('brand'), mediaCtrl.getDownloadUrl);
router.patch ('/me/media-assets/:id',               authenticate, requireRole('brand'), mediaCtrl.updateAsset);
router.delete('/me/media-assets/:id',               authenticate, requireRole('brand'), mediaCtrl.deleteAsset);

// Reference Links — URLs (YouTube / Drive / Figma / Notion) kept alongside
// uploaded assets. Zero storage cost — only the URL is persisted.
router.get   ('/me/reference-links',      authenticate, requireRole('brand'), linkCtrl.listLinks);
router.post  ('/me/reference-links',      authenticate, requireRole('brand'), linkCtrl.createLink);
router.patch ('/me/reference-links/:id',  authenticate, requireRole('brand'), linkCtrl.updateLink);
router.delete('/me/reference-links/:id',  authenticate, requireRole('brand'), linkCtrl.deleteLink);

// Aggregate contracts list for the gallery Contracts tab
router.get('/me/contracts', authenticate, requireRole('brand'), mediaCtrl.listBrandContracts);

// Store preview — brand sees their store as followers see it
router.get('/me/store-preview', authenticate, requireRole('brand'), ctrl.storePreview);

// Public brand profile (any authenticated user — influencers viewing brand info from offers)
router.get('/:id/public', authenticate, ctrl.getPublicProfile);

// ── Creator invitations (brand → unclaimed scraped creators) ────────────────
// Brand invites a non-onboarded creator → admin queue picks it up and runs outreach.
router.post('/me/creator-invitations',         authenticate, requireRole('brand'), requireApproved, invitationCtrl.createInvitation);
router.get('/me/creator-invitations',          authenticate, requireRole('brand'), invitationCtrl.listMyInvitations);
router.delete('/me/creator-invitations/:id',   authenticate, requireRole('brand'), invitationCtrl.withdrawInvitation);

// Admin routes (reviewer+ can view, approve, reject)
router.get('/:id',         authenticate, requireAdminRole('reviewer'), ctrl.getById);
router.patch('/:id/status', authenticate, requireAdminRole('reviewer'), ctrl.updateStatus);

module.exports = router;
