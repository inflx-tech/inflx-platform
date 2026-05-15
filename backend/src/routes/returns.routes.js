'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/returns.controller');
const { authenticate, requireRole, requireAdminRole, requireAnyAdminRole } = require('../middleware/auth');

const router = Router();

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
adminRouter.use(requireAnyAdminRole);

adminRouter.get(  '/returns',                       ctrl.adminListReturns);
adminRouter.post( '/returns/:id/approve',           ctrl.adminApproveReturn);
adminRouter.post( '/returns/:id/reject',            ctrl.adminRejectReturn);
adminRouter.post( '/returns/:id/mark-refunded',     ctrl.adminMarkRefunded);

module.exports = { followerRouter, adminRouter };
