'use strict';

/**
 * Item 7 — the agreement and the two signatures. Mounted at '/' before
 * influencer.routes and campaign.routes so the fixed paths are never shadowed.
 * Contract: features/item7-agreement
 */

const { Router } = require('express');
const { authenticate, requireRole, requireAnyAdminRole, requireCapability } = require('../middleware/auth');
const ctrl = require('../controllers/agreements.controller');
const admin = require('../controllers/standardTerms.controller');

const router = Router();
const creator = [authenticate, requireRole('influencer')];
const brand = [authenticate, requireRole('brand')];
const either = [authenticate, requireRole('brand', 'influencer')];

// Brand — C1–C6
router.get ('/campaigns/:id/sets/:sid/invitations/:ciId/agreement/preview', ...brand, ctrl.preview);
router.post('/campaigns/:id/sets/:sid/invitations/:ciId/agreement/send',    ...brand, ctrl.send);
router.get ('/campaigns/:id/sets/:sid/invitations/:ciId/agreement',         ...brand, ctrl.brandRead);
router.get ('/campaigns/:id/sets/:sid/invitations/:ciId/agreement/cost',    ...brand, ctrl.cost);
router.post('/campaigns/:id/sets/:sid/invitations/:ciId/agreement/sign',    ...brand, ctrl.brandSign);
router.post('/campaigns/:id/sets/:sid/invitations/:ciId/agreement/withdraw', ...brand, ctrl.withdraw);

// Creator — C7–C9
router.get ('/influencers/me/invitations/:ciId/agreement',         ...creator, ctrl.creatorRead);
router.post('/influencers/me/invitations/:ciId/agreement/sign',    ...creator, ctrl.creatorSign);
router.post('/influencers/me/invitations/:ciId/agreement/decline', ...creator, ctrl.creatorDecline);

// C11 — the document, for either party, once both have signed
router.get('/agreements/:ciId/document', ...either, ctrl.document);

// C10 — the standard terms, readable by both sides
router.get('/standard-terms',          authenticate, ctrl.getStandardTerms);
router.get('/standard-terms/:version', authenticate, ctrl.getStandardTerms);

// Admin — read on any admin role, publish on the 'settings' capability (as the
// item 6 platform settings page).
router.get ('/admin/standard-terms',          authenticate, requireAnyAdminRole,           admin.list);
router.get ('/admin/standard-terms/:version', authenticate, requireAnyAdminRole,           admin.get);
router.post('/admin/standard-terms',          authenticate, requireCapability('settings'), admin.publish);

module.exports = router;
