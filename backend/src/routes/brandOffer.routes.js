'use strict';

/**
 * brandOffer.routes.js — Offer Engine Sub-contract A.
 * Mounted under /brands/me (see routes/index.js), so the effective paths are:
 *   GET    /brands/me/offers
 *   POST   /brands/me/offers
 *   GET    /brands/me/offers/:id
 *   POST   /brands/me/offers/:id/products
 *   PATCH  /brands/me/offers/:id
 *   DELETE /brands/me/offers/:id
 * All require an authenticated brand user.
 */

const { Router } = require('express');
const ctrl = require('../controllers/brandOffer.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = Router();

router.use(authenticate);
router.use(requireRole('brand'));

router.get(   '/offers',                 ctrl.listOffers);
router.post(  '/offers',                 ctrl.createOffer);
router.get(   '/offers/:id/attachments', ctrl.getOfferAttachments);
// contract: listing-bulk-move-and-offer — add products to an offer's scope from
// the Inventory bulk bar (the reverse direction from the offer builder).
router.post(  '/offers/:id/products',    ctrl.attachOfferProducts);
router.get(   '/offers/:id',             ctrl.getOffer);
router.patch( '/offers/:id', ctrl.updateOffer);
router.delete('/offers/:id', ctrl.archiveOffer);

module.exports = router;
