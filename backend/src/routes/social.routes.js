'use strict';

/**
 * social.routes.js — Item 3b: social numbers. Contract: features/item3b-social-numbers
 * Mounted at '/' before influencer.routes so /influencers/me/social is never caught by /:id.
 */

const { Router } = require('express');
const { authenticate, requireRole, requireCapability } = require('../middleware/auth');
const ctrl = require('../controllers/social.controller');

const router = Router();
const creator = [authenticate, requireRole('influencer')];
const brand   = [authenticate, requireRole('brand', 'admin')];
const admin   = [authenticate, requireCapability('marketing')];

router.get ('/influencers/me/social',                         ...creator, ctrl.mine);
router.get ('/influencers/me/social/:platform',               ...creator, ctrl.myDetail);
router.post('/influencers/me/social/:platform/check-again',   ...creator, ctrl.checkAgain);

router.get ('/influencers/:id/social/:platform',              ...brand, ctrl.brandDetail);

router.get ('/admin/social/handle-checks',                    ...admin, ctrl.handleChecks);
router.post('/admin/social/accounts/:id/confirm',             ...admin, ctrl.confirm);
router.post('/admin/social/accounts/:id/reject',              ...admin, ctrl.reject);
router.post('/admin/social/accounts/:id/measure-now',         ...admin, ctrl.measureNow);
router.get ('/admin/social/flags',                            ...admin, ctrl.flags);
router.post('/admin/social/flags/:id/resolve',                ...admin, ctrl.resolveFlag);
router.get ('/admin/social/costs',                            ...admin, ctrl.costs);
router.get ('/admin/influencers/:id/social',                  ...admin, ctrl.adminCreator);

module.exports = router;
