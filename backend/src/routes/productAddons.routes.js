'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/productAddons.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = Router();

// All addon routes require an authenticated brand user (restaurant owner).
router.use(authenticate);
router.use(requireRole('brand'));

router.get( '/products/:productId/addon-groups', ctrl.getAddonGroups);
router.post('/products/:productId/addon-groups', ctrl.replaceAddonGroups);

module.exports = router;
