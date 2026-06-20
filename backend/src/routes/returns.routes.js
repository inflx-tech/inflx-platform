'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/returns.controller');
const { authenticate, requireRole, requireAdminRole, requireAnyAdminRole, requireCapability } = require('../middleware/auth');

const router = Router();

// ── Brand side (READ-ONLY) ───────────────────────────────────────────────────
// Mounted under /brands/me (see routes/index.js), matching productVariants +
// brandOffer routers. Brands SEE returns on their transactions but cannot
// action them — admin owns approve/reject/refund.

const brandRouter = Router();
brandRouter.use(authenticate);
brandRouter.use(requireRole('brand'));

brandRouter.get('/returns', ctrl.listBrandReturns);

// ── Customer side ────────────────────────────────────────────────────────────

const followerRouter = Router();
followerRouter.use(authenticate);
followerRouter.use(requireRole('follower'));

followerRouter.post('/returns',     ctrl.initiateReturn);
followerRouter.get( '/returns',     ctrl.listMyReturns);
followerRouter.get( '/returns/:id', ctrl.getMyReturn);

// ── Admin side ───────────────────────────────────────────────────────────────

const adminRouter = Router();
adminRouter.use(authenticate);
adminRouter.use(requireCapability('returns'));

adminRouter.get(  '/returns',                       ctrl.adminListReturns);
adminRouter.post( '/returns/:id/approve',           ctrl.adminApproveReturn);
adminRouter.post( '/returns/:id/reject',            ctrl.adminRejectReturn);
adminRouter.post( '/returns/:id/mark-refunded',     ctrl.adminMarkRefunded);

module.exports = { brandRouter, followerRouter, adminRouter };
