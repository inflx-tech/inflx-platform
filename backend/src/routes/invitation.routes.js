'use strict';

/**
 * Item 5 — the creator's invitations (A13–A16). Mounted at '/' BEFORE influencer.routes so
 * the fixed /influencers/me/invitations paths are never shadowed by /influencers/:id.
 * The brand's endpoints live in campaign.routes.js under /campaigns/:id/sets/:sid.
 * Contract: features/item5-invitations
 */

const { Router } = require('express');
const { authenticate, requireApproved, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/invitations.controller');

const router = Router();
// registration-and-profile §6.3: a pending creator now reaches the app, so every creator
// action here answers ACCOUNT_PENDING until admin approves — the same middleware the brand
// side has used all along.
const creator = [authenticate, requireRole('influencer'), requireApproved];

router.get ('/influencers/me/invitations',              ...creator, ctrl.myInvitations);
router.get ('/influencers/me/invitations/:ciId',        ...creator, ctrl.myInvitation);
router.post('/influencers/me/invitations/:ciId/accept', ...creator, ctrl.accept);
router.post('/influencers/me/invitations/:ciId/decline', ...creator, ctrl.decline);
// creator-terms-v2 — what she can sell, read-only (C2) and one offer (C3). Her own only; else 404.
router.get ('/influencers/me/invitations/:ciId/sell',              ...creator, ctrl.mySell);
router.get ('/influencers/me/invitations/:ciId/offers/:offerId',   ...creator, ctrl.myOffer);

module.exports = router;
