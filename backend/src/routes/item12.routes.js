'use strict';

/**
 * Item 12 — the content step. Mounted at '/' beside items 10 and 11.
 * Contract: features/item12-content · approval §3.7
 *
 * The shape is items 10 and 11's exactly: the brand reaches a collaboration through its own
 * campaign and set, the creator through her own invitation, Admin only once a side has reported.
 * Anything that is not yours resolves to nothing and answers 404 — never 403.
 */

const { Router } = require('express');
const { authenticate, requireApproved, requireRole, requireCapability } = require('../middleware/auth');
const ctrl = require('../controllers/content.controller');

const router = Router();
const creator = [authenticate, requireRole('influencer'), requireApproved];
const brand = [authenticate, requireRole('brand'), requireApproved];

const B = '/campaigns/:id/sets/:sid/invitations/:ciId/content';
const C = '/influencers/me/invitations/:ciId/content';

// ── Creator ──────────────────────────────────────────────────────────────────
router.post  (`${C}/files/upload-url`,      ...creator, ctrl.requestUpload);   // G2a
router.post  (`${C}/files/:fileId/confirm`, ...creator, ctrl.confirmUpload);   // G2b
router.delete(`${C}/files/:fileId`,         ...creator, ctrl.removeFile);      // G3
router.get   (`${C}/files/:fileId/url`,     ...creator, ctrl.creatorFileUrl);  // G12

// ── Brand ────────────────────────────────────────────────────────────────────
router.get   (`${B}/files/:fileId/url`,     ...brand, ctrl.brandFileUrl);      // G12

// ── The device proof (Phase 2b) — 404 unless CONTENT_UPLOAD_PROBE=on ──────────
router.get ('/influencers/me/upload-probe',         ...creator, ctrl.probeStatus);
router.post('/influencers/me/upload-probe/url',     ...creator, ctrl.probeUrl);
router.post('/influencers/me/upload-probe/confirm', ...creator, ctrl.probeConfirm);

// ── Admin — only once a side has reported to INFLX (approval Q12) ────────────
router.get('/admin/collabs/:ciId/content/files/:fileId/url', authenticate, requireCapability('production'), ctrl.adminFileUrl);

module.exports = router;
