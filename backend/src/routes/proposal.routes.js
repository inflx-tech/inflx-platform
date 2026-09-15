'use strict';

/**
 * proposal.routes.js — Phase Q
 *
 * Three audiences:
 *   /v1/influencers/me/discover-brands
 *   /v1/influencers/me/proposals/*
 *   /v1/brands/:id/proposal-criteria   (any auth)
 *   /v1/brands/me/proposal-settings
 *   /v1/brands/me/proposals/*
 *   /v1/admin/proposals/*
 */

const { Router } = require('express');
const { authenticate, requireRole, requireAnyAdminRole } = require('../middleware/auth');
const ctrl = require('../controllers/proposal.controller');

const router = Router();

// ── Influencer ─────────────────────────────────────────────────────────────
router.get   ('/influencers/me/discover-brands',           authenticate, requireRole('influencer'), ctrl.discoverBrands);
router.get   ('/influencers/me/discover-brands/:id/products', authenticate, requireRole('influencer'), ctrl.discoverBrandProducts);
// Item 8 — sending, withdrawing, countering and answering a counter moved to
// routes/item8.routes (/influencers/me/pitches/*), the only door that has the
// mode, the response deadline, item 4's date floor and item 6's thread.
router.get   ('/influencers/me/proposals',                 authenticate, requireRole('influencer'), ctrl.listMyProposals);
router.get   ('/influencers/me/proposals/:id',             authenticate, requireRole('influencer'), ctrl.getMyProposal);

// ── Brand criteria (any authenticated user can read; influencer needs it) ──
router.get   ('/brands/:id/proposal-criteria',  authenticate, ctrl.getProposalCriteria);

// ── Brand inbox + settings ────────────────────────────────────────────────
router.get   ('/brands/me/proposal-settings',     authenticate, requireRole('brand'), ctrl.getBrandSettings);
router.patch ('/brands/me/proposal-settings',     authenticate, requireRole('brand'), ctrl.updateBrandSettings);
router.get   ('/brands/me/proposals',             authenticate, requireRole('brand'), ctrl.listBrandProposals);
router.get   ('/brands/me/proposals/:id',         authenticate, requireRole('brand'), ctrl.getBrandProposal);
// Item 8 — accept, reject and counter moved to /brands/me/pitches/*. Accepting
// here wrote a collab_agreements row; accepting there writes a pool entry and
// nothing else, which is the whole point of item 8 (rules v1.21 §8).
router.post  ('/brands/me/proposals/:id/flag',    authenticate, requireRole('brand'), ctrl.flagProposal);

// ── Admin ───────────────────────────────────────────────────────────────────
router.get   ('/admin/proposals',                                  authenticate, requireAnyAdminRole, ctrl.adminListProposals);
router.post  ('/admin/influencers/:id/proposal-status',            authenticate, requireAnyAdminRole, ctrl.adminSetInfluencerStatus);

module.exports = router;
