'use strict';

// Command Center Phase 2 + 3 — store-clicks rollup + per-creator date-change
// request/approve flow. Contract: features/campaign-command-center.
//
// Brand-side endpoints sit under /brands/me/campaigns/:id/* (mounted on
// '/brands', mirroring engagement.routes). The influencer-side request-create
// endpoint sits under /campaign-influencers/:id/* (mounted on
// '/campaign-influencers'). See routes/index.js for the mounts.

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/campaign.controller');

const brandAuth = [authenticate, requireRole('brand')];

// ── Brand-side (mounted on '/brands') ────────────────────────────────────────
const brandRouter = Router();

// GET /brands/me/campaigns/:id/clicks
brandRouter.get('/me/campaigns/:id/clicks', ...brandAuth, ctrl.getCampaignClicks);

// GET /brands/me/campaigns/:id/date-change-requests
brandRouter.get('/me/campaigns/:id/date-change-requests', ...brandAuth, ctrl.listDateChangeRequests);

// ── Influencer + brand actions (mounted on '/campaign-influencers') ──────────
const ciRouter = Router();

// POST /campaign-influencers/:id/date-change  (influencer creates a request)
ciRouter.post('/:id/date-change', authenticate, requireRole('influencer'), ctrl.createDateChangeRequest);

// POST /campaign-influencers/:id/date-change/:requestId/decision  (brand approve|reject)
ciRouter.post('/:id/date-change/:requestId/decision', ...brandAuth, ctrl.decideDateChangeRequest);

module.exports = { brandRouter, ciRouter };
