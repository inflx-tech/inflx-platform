'use strict';

/**
 * Marketing Admin routes — admin-facing API for the marketing engine.
 * Mounted at /admin/marketing/* by routes/index.js.
 *
 * All routes require an admin JWT. Reads + most writes are open to
 * reviewer+, settings writes are gated to superadmin.
 */

const { Router } = require('express');
const { authenticate, requireAdminRole, requireCapability } = require('../middleware/auth');
const ctrl = require('../controllers/marketingAdmin.controller');

const router = Router();

// ── Lead intake (single + bulk) — reviewer+ ─────────────────────────────────
router.post('/leads/intake',      authenticate, requireCapability('marketing'), ctrl.intakeLead);
router.post('/leads/intake/bulk', authenticate, requireCapability('marketing'), ctrl.intakeLeadBulk);

// ── Triage list — any admin role ────────────────────────────────────────────
router.get('/leads', authenticate, requireCapability('marketing'), ctrl.listLeads);

// ── Lead detail — any admin role ────────────────────────────────────────────
router.get('/leads/:type/:id', authenticate, requireCapability('marketing'), ctrl.getLeadDetail);

// ── Activity logging — reviewer+ ────────────────────────────────────────────
router.post('/leads/:type/:id/activity', authenticate, requireCapability('marketing'), ctrl.logActivity);

// ── Quick status update — reviewer+ ─────────────────────────────────────────
router.patch('/leads/:type/:id/status', authenticate, requireCapability('marketing'), ctrl.updateStatus);

// ── Inbox (today's follow-ups) — any admin role ────────────────────────────
router.get('/inbox', authenticate, requireCapability('marketing'), ctrl.getInbox);

// ── Funnel (stage counts + conversion rates) — any admin role ──────────────
router.get('/funnel', authenticate, requireCapability('marketing'), ctrl.getFunnel);

// ── Settings — read any, write superadmin only ─────────────────────────────
router.get('/settings',    authenticate, requireCapability('marketing'),       ctrl.getSettings);
router.patch('/settings',  authenticate, requireAdminRole('superadmin'), ctrl.updateSettings);

// ── Filter options for the Triage page dropdowns ───────────────────────────
router.get('/filter-options', authenticate, requireCapability('marketing'), ctrl.getFilterOptions);

// ── One-shot maintenance: cache profile pics to R2 — any admin ──────────────
// Walks creator_profiles + brand_profiles and pushes every profile_pic_url
// through imageProxy.cacheProfilePic. Use after a re-scrape if IG URLs were
// stale. Body: { type?: 'creator'|'brand'|'all', limit?: number, force?: bool }
// Non-destructive (idempotent, only writes R2 keys + cached_at) so reviewer+
// can run it without superadmin escalation.
router.post('/backfill-profile-pics', authenticate, requireCapability('marketing'), ctrl.backfillProfilePics);

module.exports = router;
