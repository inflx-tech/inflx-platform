'use strict';

/**
 * production.routes.js — Phase P endpoints.
 *
 *   GET    /v1/contracts/:id/production                — fetch event + log
 *   POST   /v1/contracts/:id/production/visit-details  — brand sets visit
 *   POST   /v1/production-events/:id/accept            — influencer accepts
 *   POST   /v1/production-events/:id/counter-propose   — influencer suggests alt
 *   POST   /v1/production-events/:id/dispatch          — brand: shipped (AWB)
 *   POST   /v1/production-events/:id/confirm-received  — influencer received
 *   POST   /v1/production-events/:id/complete          — mark visit done
 *   POST   /v1/production-events/:id/cancel            — admin cancel
 *
 *   stage-4 — the parcel:
 *   GET    /v1/production-events/:id/items                 — what is in the box (both)
 *   POST   /v1/production-events/:id/items                 — brand packs it
 *   DELETE /v1/production-events/:id/items/:itemId         — brand unpacks (pre-dispatch)
 *   POST   /v1/production-events/:id/items/:itemId/drop    — brand drops a flagged item
 */

const { Router } = require('express');
const { authenticate, requireRole, requireAnyAdminRole, requireApproved } = require('../middleware/auth');
const ctrl = require('../controllers/production.controller');

const router = Router();

// Contract-scoped reads + brand visit-details
router.get(
  '/contracts/:id/production',
  authenticate, requireRole('brand', 'influencer'),
  ctrl.getProduction
);
// Campaign-wide production roster (brand only) — backend batch item 3.
router.get(
  '/campaigns/:id/production',
  authenticate, requireRole('brand'),
  ctrl.listCampaignProduction
);
router.get(
  '/contracts/:id/production/date-range',
  authenticate, requireRole('brand', 'influencer'),
  ctrl.getDateRange
);
router.post(
  '/contracts/:id/production/initialise',
  authenticate, requireRole('brand'),
  ctrl.initialiseProduction
);
router.post(
  '/contracts/:id/production/visit-details',
  authenticate, requireRole('brand'),
  ctrl.setVisitDetails
);

// Event-scoped state transitions
// registration-and-profile §6.3: a pending creator now reaches the app, so every creator
// action here answers ACCOUNT_PENDING until admin approves — the same middleware the brand
// side has used all along.
router.post('/production-events/:id/propose-slot',     authenticate, requireRole('influencer'), requireApproved, ctrl.proposeSlot);
router.post('/production-events/:id/accept',           authenticate, requireRole('brand', 'influencer'), requireApproved, ctrl.acceptEvent);
router.post('/production-events/:id/counter-propose',  authenticate, requireRole('brand', 'influencer'), requireApproved, ctrl.counterPropose);
router.post('/production-events/:id/dispatch',         authenticate, requireRole('brand'),       ctrl.dispatch);
router.post('/production-events/:id/confirm-received', authenticate, requireRole('influencer'), requireApproved, ctrl.confirmReceived);
router.post('/production-events/:id/complete',         authenticate, requireRole('brand', 'influencer'), requireApproved, ctrl.complete);
router.post('/production-events/:id/flip-to-remote',   authenticate, requireRole('brand', 'influencer'), requireApproved, ctrl.flipToRemote);
router.post('/production-events/:id/cancel',           authenticate, requireAnyAdminRole, ctrl.adminCancel);


// ─── The parcel (stage-4) ───────────────────────────────────────────────────
// Both parties read it — she cannot confirm a box she cannot see. Only the brand changes it.
router.get(
  '/production-events/:id/items',
  authenticate, requireRole('brand', 'influencer'),
  ctrl.getParcel
);
router.post(
  '/production-events/:id/items',
  authenticate, requireRole('brand'),
  ctrl.addParcelItems
);
router.delete(
  '/production-events/:id/items/:itemId',
  authenticate, requireRole('brand'),
  ctrl.removeParcelItem
);
router.post(
  '/production-events/:id/items/:itemId/drop',
  authenticate, requireRole('brand'),
  ctrl.dropParcelItem
);

module.exports = router;
