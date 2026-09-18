'use strict';

/**
 * Item 10 — the Store Visit shoot plan. Mounted at '/' beside item 7's routes so the fixed
 * paths are never shadowed. Contract: features/item10-store-visit
 *
 * There is deliberately NO decline route on the time thread (rules §11.1): the only alternative
 * to accepting a time is proposing another, and a missing route is the honest 404.
 */

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/shoot.controller');

const router = Router();
const creator = [authenticate, requireRole('influencer')];
const brand = [authenticate, requireRole('brand')];

// Brand — F1, F2+F3, F5, F6, F8
router.get ('/campaigns/:id/sets/:sid/invitations/:ciId/shoot',                ...brand, ctrl.brandRead);
router.post('/campaigns/:id/sets/:sid/invitations/:ciId/shoot/plan',           ...brand, ctrl.send);
router.get ('/campaigns/:id/sets/:sid/invitations/:ciId/shoot/thread',         ...brand, ctrl.brandThread);
router.post('/campaigns/:id/sets/:sid/invitations/:ciId/shoot/thread/counter', ...brand, ctrl.brandCounter);
router.post('/campaigns/:id/sets/:sid/invitations/:ciId/shoot/thread/accept',  ...brand, ctrl.brandAccept);
router.post('/campaigns/:id/sets/:sid/invitations/:ciId/shoot/move',           ...brand, ctrl.brandMove);
router.post('/campaigns/:id/sets/:sid/invitations/:ciId/shoot/confirm',        ...brand, ctrl.confirm);

// Creator — F1, F4, F5, F6, F7
router.get ('/influencers/me/invitations/:ciId/shoot',                ...creator, ctrl.creatorRead);
router.post('/influencers/me/invitations/:ciId/shoot/accept',         ...creator, ctrl.acceptTime);
router.get ('/influencers/me/invitations/:ciId/shoot/thread',         ...creator, ctrl.creatorThread);
router.post('/influencers/me/invitations/:ciId/shoot/thread/counter', ...creator, ctrl.creatorCounter);
router.post('/influencers/me/invitations/:ciId/shoot/thread/accept',  ...creator, ctrl.creatorAccept);
router.post('/influencers/me/invitations/:ciId/shoot/move',           ...creator, ctrl.creatorMove);
router.post('/influencers/me/invitations/:ciId/shoot/attended',       ...creator, ctrl.attended);

module.exports = router;
