'use strict';

/**
 * Item 6 — negotiation, the move request, the pool, the platform settings. Mounted at '/'
 * before influencer.routes and campaign.routes so the fixed paths are never shadowed.
 * Contract: features/item6-negotiation
 */

const { Router } = require('express');
const { authenticate, requireApproved, requireRole, requireAnyAdminRole, requireCapability } = require('../middleware/auth');
const ctrl = require('../controllers/negotiations.controller');

const router = Router();
// registration-and-profile §6.3: a pending creator now reaches the app, so every creator
// action here answers ACCOUNT_PENDING until admin approves — the same middleware the brand
// side has used all along.
const creator = [authenticate, requireRole('influencer'), requireApproved];
// registration-and-profile §6.5 (founder decision 18): a pending brand is inside the app now and
// may reach home, profile and wallet only — campaigns, creators, groups, pitches and the pool
// answer ACCOUNT_PENDING until admin approves.
const brand = [authenticate, requireRole('brand'), requireApproved];

// Creator — B1–B4, B11
router.get   ('/influencers/me/invitations/:ciId/thread',         ...creator, ctrl.creatorThread);
router.post  ('/influencers/me/invitations/:ciId/counter',        ...creator, ctrl.creatorCounter);
router.post  ('/influencers/me/invitations/:ciId/move-request',   ...creator, ctrl.creatorMoveRequest);
router.post  ('/influencers/me/invitations/:ciId/thread/accept',  ...creator, ctrl.creatorAccept);
router.post  ('/influencers/me/invitations/:ciId/thread/decline', ...creator, ctrl.creatorDecline);
router.get   ('/influencers/me/pool',                             ...creator, ctrl.creatorPool);
router.delete('/influencers/me/pool/:entryId',                    ...creator, ctrl.creatorLeavePool);

// Brand — B5–B9, B10–B12
router.get   ('/campaigns/:id/sets/:sid/invitations/:ciId/thread',         ...brand, ctrl.brandThread);
router.post  ('/campaigns/:id/sets/:sid/invitations/:ciId/thread/accept',  ...brand, ctrl.brandAccept);
router.post  ('/campaigns/:id/sets/:sid/invitations/:ciId/thread/counter', ...brand, ctrl.brandCounter);
router.post  ('/campaigns/:id/sets/:sid/invitations/:ciId/thread/decline', ...brand, ctrl.brandDecline);
router.post  ('/campaigns/:id/sets/:sid/invitations/:ciId/move-answer',    ...brand, ctrl.brandMoveAnswer);
router.get   ('/brands/me/pool',                                            ...brand, ctrl.brandPool);
router.post  ('/brands/me/pool/set-defaults',                               ...brand, ctrl.brandPoolSetDefaults);
router.delete('/brands/me/pool/:entryId',                                   ...brand, ctrl.brandRemoveFromPool);

// Admin — B15: read on any admin role, write on the 'settings' capability (as payment config)
router.get   ('/admin/platform-settings', authenticate, requireAnyAdminRole,           ctrl.getPlatformSettings);
router.patch ('/admin/platform-settings', authenticate, requireCapability('settings'), ctrl.updatePlatformSettings);

module.exports = router;
