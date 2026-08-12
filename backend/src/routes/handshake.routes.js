'use strict';

/**
 * handshake.routes.js — the pre-campaign handshake.
 * Contract: features/collab-part2-precampaign-handshake
 *
 * Mirrors proposal.routes (the creator → brand direction, which already existed) so the
 * two halves of the handshake look the same to a client:
 *
 *   /v1/brands/me/collab-requests/*        brand → creator (NEW — did not exist)
 *   /v1/brands/me/agreements               ready to brief
 *   /v1/influencers/me/collab-requests/*   the creator's inbox
 *   /v1/influencers/me/collab-preferences  the creator's mute and their own bar
 *   /v1/influencers/me/agreements
 *   /v1/admin/handshake-settings           the limits, admin-editable
 */

const { Router } = require('express');
const { authenticate, requireRole, requireAnyAdminRole } = require('../middleware/auth');
const ctrl = require('../controllers/handshake.controller');

const router = Router();

// ── Brand: sending and managing requests ────────────────────────────────────
router.post ('/brands/me/collab-requests',                    authenticate, requireRole('brand'), ctrl.createRequests);
router.post ('/brands/me/collab-requests/broadcast-preview',  authenticate, requireRole('brand'), ctrl.broadcastPreview);
router.get  ('/brands/me/collab-requests',                    authenticate, requireRole('brand'), ctrl.listBrandRequests);
router.post ('/brands/me/collab-requests/:id/accept',         authenticate, requireRole('brand'), ctrl.brandAccept);
router.post ('/brands/me/collab-requests/:id/counter',        authenticate, requireRole('brand'), ctrl.brandCounter);
router.post ('/brands/me/collab-requests/:id/decline',        authenticate, requireRole('brand'), ctrl.brandDecline);
router.post ('/brands/me/collab-requests/:id/withdraw',       authenticate, requireRole('brand'), ctrl.withdrawRequest);

// Ready to brief — what campaign creation offers.
router.get  ('/brands/me/agreements',                         authenticate, requireRole('brand'), ctrl.listAgreements);

// ── Creator: inbox, responses, preferences ──────────────────────────────────
router.get  ('/influencers/me/collab-requests',               authenticate, requireRole('influencer'), ctrl.listCreatorRequests);
router.post ('/influencers/me/collab-requests/:id/accept',    authenticate, requireRole('influencer'), ctrl.creatorAccept);
router.post ('/influencers/me/collab-requests/:id/counter',   authenticate, requireRole('influencer'), ctrl.creatorCounter);
router.post ('/influencers/me/collab-requests/:id/decline',   authenticate, requireRole('influencer'), ctrl.creatorDecline);

router.get  ('/influencers/me/collab-preferences',            authenticate, requireRole('influencer'), ctrl.getPreferences);
router.patch('/influencers/me/collab-preferences',            authenticate, requireRole('influencer'), ctrl.updatePreferences);
router.get  ('/influencers/me/agreements',                    authenticate, requireRole('influencer'), ctrl.listCreatorAgreements);

// ── Admin: the limits ───────────────────────────────────────────────────────
// requireAnyAdminRole, not superadmin — the founder's daily account is not always
// superadmin, and an operator who cannot reach the settings cannot operate them.
router.get  ('/admin/handshake-settings',                     authenticate, requireAnyAdminRole, ctrl.getSettings);
router.patch('/admin/handshake-settings',                     authenticate, requireAnyAdminRole, ctrl.patchSettings);

module.exports = router;
