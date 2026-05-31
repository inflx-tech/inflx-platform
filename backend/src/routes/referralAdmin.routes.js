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
const { authenticate, requireAdminRole, requireAnyAdminRole } = require('../middleware/auth');
const ctrl = require('../controllers/referralAdmin.controller');

const router = Router();

// ── Settings — read any admin, write superadmin only ────────────────────────
router.get('/settings',   authenticate, requireAnyAdminRole,            ctrl.getSettings);
router.patch('/settings', authenticate, requireAdminRole('superadmin'), ctrl.updateSettings);

// ── Edges (relationships) — list any admin, mutate superadmin only ──────────
router.get('/edges',       authenticate, requireAnyAdminRole,            ctrl.listEdges);
router.post('/edges',      authenticate, requireAdminRole('superadmin'), ctrl.createEdge);
router.patch('/edges/:id', authenticate, requireAdminRole('superadmin'), ctrl.updateEdge);

// ── Ledger + summary (earnings audit) — any admin role ──────────────────────
router.get('/ledger',  authenticate, requireAnyAdminRole, ctrl.listLedger);
router.get('/summary', authenticate, requireAnyAdminRole, ctrl.getSummary);

module.exports = router;
