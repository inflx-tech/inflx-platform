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
 */

const { Router } = require('express');
const { authenticate, requireRole, requireAnyAdminRole } = require('../middleware/auth');
const ctrl = require('../controllers/production.controller');

const router = Router();

// Contract-scoped reads + brand visit-details
router.get(
  '/contracts/:id/production',
  authenticate, requireRole('brand', 'influencer'),
  ctrl.getProduction
);
router.post(
  '/contracts/:id/production/visit-details',
  authenticate, requireRole('brand'),
  ctrl.setVisitDetails
);

// Event-scoped state transitions
router.post('/production-events/:id/accept',           authenticate, requireRole('influencer'), ctrl.acceptEvent);
router.post('/production-events/:id/counter-propose',  authenticate, requireRole('influencer'), ctrl.counterPropose);
router.post('/production-events/:id/dispatch',         authenticate, requireRole('brand'),       ctrl.dispatch);
router.post('/production-events/:id/confirm-received', authenticate, requireRole('influencer'), ctrl.confirmReceived);
router.post('/production-events/:id/complete',         authenticate, requireRole('brand', 'influencer'), ctrl.complete);
router.post('/production-events/:id/cancel',           authenticate, requireAnyAdminRole, ctrl.adminCancel);

module.exports = router;
