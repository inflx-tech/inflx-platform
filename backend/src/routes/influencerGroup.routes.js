'use strict';

/**
 * influencerGroup.routes.js — F-5 server-persisted influencer groups.
 * Mounted under /brands/me (see routes/index.js), so the effective paths are:
 *   GET    /brands/me/influencer-groups
 *   POST   /brands/me/influencer-groups
 *   PATCH  /brands/me/influencer-groups/:id
 *   DELETE /brands/me/influencer-groups/:id
 *   POST   /brands/me/influencer-groups/:id/members
 *   DELETE /brands/me/influencer-groups/:id/members/:influencerId
 * All require an authenticated brand user; ownership is enforced per-:id in the
 * controller (group.brand_id must equal the caller's brand id).
 */

const { Router } = require('express');
const ctrl = require('../controllers/influencerGroup.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = Router();

router.use(authenticate);
router.use(requireRole('brand'));

router.get(   '/influencer-groups',                        ctrl.listGroups);
router.post(  '/influencer-groups',                        ctrl.createGroup);
router.patch( '/influencer-groups/:id',                    ctrl.renameGroup);
router.delete('/influencer-groups/:id',                    ctrl.deleteGroup);
router.post(  '/influencer-groups/:id/members',            ctrl.addMembers);
router.delete('/influencer-groups/:id/members/:influencerId', ctrl.removeMember);

module.exports = router;
