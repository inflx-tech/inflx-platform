'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/campaign.controller');

const router = Router();

// All campaign endpoints require brand role
const brandAuth = [authenticate, requireRole('brand')];

// ── Campaign CRUD (Block A2) ─────────────────────────────────────────────────
router.post('/',    ...brandAuth, ctrl.create);
router.get('/',     ...brandAuth, ctrl.list);
router.get('/:id',  ...brandAuth, ctrl.getById);
router.patch('/:id',...brandAuth, ctrl.update);
router.delete('/:id', ...brandAuth, ctrl.remove);

// ── Campaign Publish (Block A6) ──────────────────────────────────────────────
router.post('/:id/publish', ...brandAuth, ctrl.publish);

// ── Campaign Sets CRUD (Block A3) ───────────────────────────────────────────
router.post('/:id/sets',             ...brandAuth, ctrl.createSet);
router.patch('/:id/sets/:sid',       ...brandAuth, ctrl.updateSet);
router.delete('/:id/sets/:sid',      ...brandAuth, ctrl.deleteSet);

// ── Invite influencer to set (Block A — handpick) ───────────────────────────
router.post('/:id/sets/:sid/invite', ...brandAuth, ctrl.invite);

// ── Create offer for set (Block A4) ─────────────────────────────────────────
router.post('/:id/sets/:sid/offers', ...brandAuth, ctrl.createOffer);

// ── Publish open-group set (Block D) ─────────────────────────────────────────
const offerCtrl = require('../controllers/offer.controller');
router.post('/:id/sets/:sid/publish-open', ...brandAuth, offerCtrl.publishOpenGroup);

// ── Live hierarchy (Phase 3 — Block E) ───────────────────────────────────────
router.get('/:id/live', ...brandAuth, ctrl.getLiveHierarchy);

module.exports = router;
