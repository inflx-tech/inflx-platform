'use strict';

/**
 * Referral Admin routes — admin-facing API for the referral system.
 * Mounted at /admin/referrals/* by routes/index.js.
 * Contract: features/referral-admin-controls (Contract 2 of 4).
 *
 * Reads are open to any admin role; writes (settings + edge create/edit/end)
 * are gated to superadmin.
 */

const { Router } = require('express');
const { authenticate, requireAdminRole, requireCapability } = require('../middleware/auth');
const ctrl = require('../controllers/referralAdmin.controller');

const router = Router();

// ── Settings — read any admin, write superadmin only ────────────────────────
router.get('/settings',   authenticate, requireCapability('referrals'),  ctrl.getSettings);
router.patch('/settings', authenticate, requireAdminRole('superadmin'), ctrl.updateSettings);

// ── Edges (relationships) — list any admin, mutate superadmin only ──────────
router.get('/edges',       authenticate, requireCapability('referrals'),  ctrl.listEdges);
router.post('/edges',      authenticate, requireAdminRole('superadmin'), ctrl.createEdge);
router.patch('/edges/:id', authenticate, requireAdminRole('superadmin'), ctrl.updateEdge);

// ── Ledger + summary (earnings audit) — any admin role ──────────────────────
router.get('/ledger',  authenticate, requireCapability('referrals'), ctrl.listLedger);
router.get('/summary', authenticate, requireCapability('referrals'), ctrl.getSummary);

// ── Applications (apply-to-become-referrer) — list any admin, decide superadmin ─
router.get('/applications', authenticate, requireCapability('referrals'), ctrl.listApplications);
router.post('/applications/:id/decision', authenticate, requireAdminRole('superadmin'), ctrl.decideApplication);

// ── Generate/allocate a referral code directly — superadmin only ────────────
router.post('/codes', authenticate, requireAdminRole('superadmin'), ctrl.generateCode);

module.exports = router;
