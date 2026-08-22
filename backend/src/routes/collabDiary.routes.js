'use strict';

/**
 * collabDiary.routes.js — reading "what happened here".
 * Contract: features/stage-1-find-each-other-and-agree
 *
 *   GET /v1/collab-diary/request/:id    — a brand -> creator conversation
 *   GET /v1/collab-diary/proposal/:id   — a creator -> brand pitch
 *
 * No requireRole: BOTH sides read the same page, and which side you are is proved from
 * the record itself in the controller. Gating by role here would mean writing the rule
 * twice and letting the two drift.
 */

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/collabDiary.controller');

const router = Router();

router.get('/request/:id',  authenticate, ctrl.requestDiary);
router.get('/proposal/:id', authenticate, ctrl.proposalDiary);

module.exports = router;
