'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/productVariants.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = Router();

// All variant routes require an authenticated brand user
router.use(authenticate);
router.use(requireRole('brand'));

router.get(   '/products/:productId/variants',                ctrl.listVariants);
router.post(  '/products/:productId/variants',                ctrl.replaceVariants);
router.patch( '/products/:productId/variants/:variantId',     ctrl.updateVariant);
router.delete('/products/:productId/variants/:variantId',     ctrl.deleteVariant);

module.exports = router;
