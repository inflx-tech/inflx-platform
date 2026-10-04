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
router.get   (`${C}`,                        ...creator, ctrl.creatorRead);     // G1
router.put   (`${C}/rows/:rowKey/caption`,   ...creator, ctrl.caption);         // G4
router.post  (`${C}/submit`,                 ...creator, ctrl.submit);          // G5
router.put   (`${C}/proofs/:rowKey/:slot`,   ...creator, ctrl.setProof);        // G8
router.delete(`${C}/proofs/:rowKey/:slot`,   ...creator, ctrl.clearProof);      // G8
router.post  (`${C}/posted`,                 ...creator, ctrl.posted);          // G9
router.post  (`${C}/report`,                 ...creator, ctrl.creatorReport);   // G11 — brand_silent
router.post  (`${C}/files/upload-url`,      ...creator, ctrl.requestUpload);   // G2a
router.post  (`${C}/files/:fileId/confirm`, ...creator, ctrl.confirmUpload);   // G2b
router.delete(`${C}/files/:fileId`,         ...creator, ctrl.removeFile);      // G3
router.post  (`${C}/files/:fileId/cover-url`, ...creator, ctrl.requestCoverUpload); // W15 — a video's picture
router.post  (`${C}/files/:fileId/cover`,     ...creator, ctrl.confirmCover);       // W15
router.get   (`${C}/files/:fileId/url`,     ...creator, ctrl.creatorFileUrl);  // G12

// ── Brand ────────────────────────────────────────────────────────────────────
router.get   (`${B}`,                        ...brand, ctrl.brandRead);         // G1
router.post  (`${B}/approve`,                ...brand, ctrl.approve);           // G6
router.post  (`${B}/changes`,                ...brand, ctrl.askChanges);        // G7
router.post  (`${B}/confirm-live`,           ...brand, ctrl.confirmLive);       // G10 — releases the second 25%
router.post  (`${B}/report`,                 ...brand, ctrl.brandReport);       // G11 — rounds_used | posted_wrong
router.get   (`${B}/files/:fileId/url`,     ...brand, ctrl.brandFileUrl);      // G12

// ── The device proof (Phase 2b) — 404 unless CONTENT_UPLOAD_PROBE=on ──────────
router.get ('/influencers/me/upload-probe',         ...creator, ctrl.probeStatus);
router.post('/influencers/me/upload-probe/url',     ...creator, ctrl.probeUrl);
router.post('/influencers/me/upload-probe/confirm', ...creator, ctrl.probeConfirm);

// ── Admin — only once a side has reported to INFLX (approval Q12) ────────────
router.get('/admin/collabs/:ciId/content/files/:fileId/url', authenticate, requireCapability('production'), ctrl.adminFileUrl);

module.exports = router;
