'use strict';

/**
 * Marketing Admin routes — admin-facing API for the marketing engine.
 * Mounted at /admin/marketing/* by routes/index.js.
 *
 * All routes require an admin JWT. Reads + most writes are open to
 * reviewer+, settings writes are gated to superadmin.
 */

const { Router } = require('express');
const { authenticate, requireAdminRole, requireAnyAdminRole } = require('../middleware/auth');
const ctrl = require('../controllers/marketingAdmin.controller');

const router = Router();

// ── Lead intake (single + bulk) — reviewer+ ─────────────────────────────────
router.post('/leads/intake',      authenticate, requireAdminRole('reviewer'), ctrl.intakeLead);
router.post('/leads/intake/bulk', authenticate, requireAdminRole('reviewer'), ctrl.intakeLeadBulk);

// ── Triage list — any admin role ────────────────────────────────────────────
router.get('/leads', authenticate, requireAnyAdminRole, ctrl.listLeads);

// ── Lead detail — any admin role ────────────────────────────────────────────
router.get('/leads/:type/:id', authenticate, requireAnyAdminRole, ctrl.getLeadDetail);

// ── Activity logging — reviewer+ ────────────────────────────────────────────
router.post('/leads/:type/:id/activity', authenticate, requireAdminRole('reviewer'), ctrl.logActivity);

// ── Quick status update — reviewer+ ─────────────────────────────────────────
router.patch('/leads/:type/:id/status', authenticate, requireAdminRole('reviewer'), ctrl.updateStatus);

// ── Inbox (today's follow-ups) — any admin role ────────────────────────────
router.get('/inbox', authenticate, requireAnyAdminRole, ctrl.getInbox);

// ── Funnel (stage counts + conversion rates) — any admin role ──────────────
router.get('/funnel', authenticate, requireAnyAdminRole, ctrl.getFunnel);

// ── Settings — read any, write superadmin only ─────────────────────────────
router.get('/settings',    authenticate, requireAnyAdminRole,           ctrl.getSettings);
router.patch('/settings',  authenticate, requireAdminRole('superadmin'), ctrl.updateSettings);

module.exports = router;
