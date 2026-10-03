'use strict';

/**
 * brandOffer.routes.js — mounted under /brands/me. All require an authenticated brand user.
 *
 * The offer builder (contract: features/offer-builder-v2, rules v1.4 §1). Static paths come before
 * /offers/:id so "product-offers" is never read as an id.
 *
 *   GET    /offers                      the offer list (engine=2); without engine=2 → the old list
 *   POST   /offers                      a draft, from a type (and optionally ticked products)
 *   GET    /offers/products-without-offers?date=
 *   GET    /offers/product-offers?product_ids=
 *   GET    /offers/product-offers/:productId
 *   GET    /offers/price-impact?product_id=&price=
 *   GET    /offers/filter-options?node=
 *   GET    /offers/:id                  the builder / review / offer page
 *   PATCH  /offers/:id                  draft autosave
 *   DELETE /offers/:id                  delete: a draft is erased, an ended offer hidden (features/offer-delete)
 *   GET    /offers/:id/candidates       browse / search / gift items, with locks
 *   POST   /offers/:id/sources          add a pool line
 *   DELETE /offers/:id/sources/:sourceId
 *   POST   /offers/:id/publish
 *   POST   /offers/:id/end
 *   GET    /offers/:id/remove-preview?product_ids=
 *   POST   /offers/:id/remove-products  only while no creator has the offer (features/offer-add-products)
 *   POST   /offers/:id/add-products     the same rule; held from today under the publish checks
 *   GET    /offers/:id/attachments     (old builder; kept for old clients)
 *   GET/POST /gift-items · PATCH /gift-items/:id
 *
 * Retired here (rules 1.13): POST /offers/:id/products — the bulk "Attach offer" from Inventory.
 * Products join offers only through the pool builder, where the checks run.
 */

const { Router } = require('express');
const legacy = require('../controllers/brandOffer.controller');
const v2 = require('../controllers/offersV2.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = Router();

router.use(authenticate);
router.use(requireRole('brand'));

// The list: the website asks for the new builder's offers; old clients (the phone's old terms
// sheet) keep the old list, where every old offer is now archived (spec D14).
router.get('/offers', (req, res, next) => (String(req.query.engine) === '2' ? v2.list : legacy.listOffers)(req, res, next));
router.post('/offers', v2.create);

router.get('/offers/products-without-offers', v2.productsWithoutOffers);
router.get('/offers/product-offers', v2.offersByProduct);
router.get('/offers/product-offers/:productId', v2.productOfferPanel);
router.get('/offers/price-impact', v2.priceImpact);
router.get('/offers/filter-options', v2.filterOptions);

router.get(   '/offers/:id/attachments',        legacy.getOfferAttachments);
router.get(   '/offers/:id/candidates',         v2.candidates);
router.post(  '/offers/:id/sources',            v2.addSource);
router.delete('/offers/:id/sources/:sourceId',  v2.removeSource);
router.post(  '/offers/:id/publish',            v2.publish);
router.post(  '/offers/:id/end',                v2.endNow);
router.get(   '/offers/:id/remove-preview',     v2.removePreview);
router.post(  '/offers/:id/remove-products',    v2.removeProducts);
router.post(  '/offers/:id/add-products',       v2.addProducts);
router.get(   '/offers/:id',                    v2.getOne);
router.patch( '/offers/:id',                    v2.update);
router.delete('/offers/:id',                    v2.remove);

router.get(  '/gift-items',     v2.listGiftItems);
router.post( '/gift-items',     v2.createGiftItem);
router.patch('/gift-items/:id', v2.updateGiftItem);

module.exports = router;
