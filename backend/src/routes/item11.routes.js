'use strict';

/**
 * Item 11 — the Remote shoot. Mounted at '/' beside item 10's, so the fixed paths never shadow.
 * Contract: features/item11-remote · approval §3.9
 *
 * The shape is item 10's exactly: the brand reaches a collaboration through its own campaign
 * and set, the creator through her own invitation. Anything that is not yours resolves to
 * nothing and answers 404 — never 403, which would confirm it exists.
 *
 * There is deliberately NO decline, NO counter and NO mode route: a Remote shoot has nothing to
 * negotiate. She sends her address once and it locks (§28); the brand picks and books. A
 * missing route is the honest 404.
 */

const { Router } = require('express');
const { authenticate, requireApproved, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/remoteShoot.controller');

const router = Router();
// registration-and-profile §6.3 / §6.5 — a pending account reaches the app but not the work.
const creator = [authenticate, requireRole('influencer'), requireApproved];
const brand = [authenticate, requireRole('brand'), requireApproved];

const B = '/campaigns/:id/sets/:sid/invitations/:ciId/remote';
const C = '/influencers/me/invitations/:ciId/remote';

// ── Brand ────────────────────────────────────────────────────────────────────
router.get (`${B}`,                    ...brand, ctrl.brandRead);        // F1
router.get (`${B}/products`,           ...brand, ctrl.products);         // F5
router.put (`${B}/lines`,              ...brand, ctrl.saveLines);        // F6
router.post(`${B}/quote`,              ...brand, ctrl.quote);            // F7
router.post(`${B}/book`,               ...brand, ctrl.book);             // F8
router.get (`${B}/label`,              ...brand, ctrl.label);            // F9
router.post(`${B}/cancel`,             ...brand, ctrl.cancel);           // F10
router.post(`${B}/rebook`,             ...brand, ctrl.rebook);           // F11
router.post(`${B}/report`,             ...brand, ctrl.report);           // F13
router.post(`${B}/acknowledge`,        ...brand, ctrl.acknowledge);      // R10's quiet button
router.post(`${B}/lines/:lineId/gift`, ...brand, ctrl.returnToGift);     // F15
router.post(`${B}/return/confirm`,     ...brand, ctrl.confirmReturn);    // F17

// The label's bytes. Not under the campaign/set path because the phone opens it as a plain
// URL — the shipment id carries the scope, and labelStream refuses anyone but its own brand.
router.get('/shipments/:shipmentId/label.pdf', ...brand, ctrl.labelPdf);

// ── Creator ──────────────────────────────────────────────────────────────────
router.get (`${C}`,                 ...creator, ctrl.creatorRead);       // F1
router.post(`${C}/coverage`,        ...creator, ctrl.coverage);          // F2
router.post(`${C}/address`,         ...creator, ctrl.sendAddress);       // F3
router.post(`${C}/address/correct`, ...creator, ctrl.correctAddress);    // F4
router.post(`${C}/check`,           ...creator, ctrl.check);             // F12
router.post(`${C}/done`,            ...creator, ctrl.markDone);          // F14
router.post(`${C}/return/book`,     ...creator, ctrl.bookReturn);        // F16
router.post(`${C}/return/sent`,     ...creator, ctrl.markSelfSent);      // approval Q1

module.exports = router;
