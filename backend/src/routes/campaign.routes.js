'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/campaign.controller');

const router = Router();
const brandAuth = [authenticate, requireRole('brand')];

// ── Campaign CRUD ────────────────────────────────────────────────────────────
router.post('/',       ...brandAuth, ctrl.create);
router.get('/',        ...brandAuth, ctrl.list);
router.get('/:id',     ...brandAuth, ctrl.getById);
router.patch('/:id',   ...brandAuth, ctrl.update);
router.delete('/:id',  ...brandAuth, ctrl.remove);

// ── Campaign Publish / Cancel ─────────────────────────────────────────────────
router.post('/:id/publish', ...brandAuth, ctrl.publish);
router.post('/:id/cancel',  ...brandAuth, ctrl.cancel);

// ── Cancel individual influencer assignment ──────────────────────────────────
router.post('/:id/influencers/:ciid/cancel', ...brandAuth, ctrl.cancelInfluencer);

// ── Campaign Sets CRUD ───────────────────────────────────────────────────────
router.get('/:id/sets',                     ...brandAuth, ctrl.getSets);
router.post('/:id/sets',                    ...brandAuth, ctrl.createSet);
router.patch('/:id/sets/:sid',              ...brandAuth, ctrl.updateSet);
router.delete('/:id/sets/:sid',             ...brandAuth, ctrl.deleteSet);
router.post('/:id/sets/:sid/duplicate',     ...brandAuth, ctrl.duplicateSet);

// ── Invite influencer to set (handpick) ─────────────────────────────────────
router.post('/:id/sets/:sid/invite', ...brandAuth, ctrl.invite);

// ── Update existing influencer assignment (draft editing) ───────────────────
router.patch('/:id/sets/:sid/influencers/:ciId', ...brandAuth, ctrl.updateInfluencer);

// ── Create offer for set (legacy) ───────────────────────────────────────────
router.post('/:id/sets/:sid/offers', ...brandAuth, ctrl.createOffer);

// ── Open-group set ───────────────────────────────────────────────────────────
const offerCtrl = require('../controllers/offer.controller');
router.post('/:id/sets/:sid/publish-open', ...brandAuth, offerCtrl.publishOpenGroup);

// ── Influencer search (for handpick modal) ───────────────────────────────────
router.get('/:id/influencer-search', ...brandAuth, ctrl.searchInfluencers);

// ── Open-group match count ───────────────────────────────────────────────────
router.get('/:id/sets/:sid/open-group-matches', ...brandAuth, ctrl.openGroupMatches);

// ── Live hierarchy ───────────────────────────────────────────────────────────
router.get('/:id/live', ...brandAuth, ctrl.getLiveHierarchy);

module.exports = router;
