'use strict';

/**
 * brandCreatorImages.routes.js — brand approves creator product photos + picks
 * the display source (Creator Experience Engine Phase 7a, features/creator-imagery/).
 * Mounted under /v1/brands/me. Auth: requireRole('brand').
 */

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/brandCreatorImages.controller');

const router = Router();
const brandAuth = [authenticate, requireRole('brand')];

router.get('/creator-images',              ...brandAuth, ctrl.queue);
router.post('/creator-images/:id/approve', ...brandAuth, ctrl.approve);
router.post('/creator-images/:id/reject',  ...brandAuth, ctrl.reject);
router.patch('/products/:id/image-source', ...brandAuth, ctrl.setSource);

module.exports = router;
