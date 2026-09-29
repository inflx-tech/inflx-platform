'use strict';

/**
 * postLinks.routes.js — the public side of post, store and collection links (Level 4). Mounted at
 * /v1/links, no sign-in: inflx.in/p/<code>, /s/<handle>, /c/<code> ask here, and the shopper app
 * asks /code/<code> when a code is typed in search. Contract: features/post-links-codes
 */

const { Router } = require('express');
const ctrl = require('../controllers/postLinks.controller');

const router = Router();
router.get('/p/:code', ctrl.post);
router.get('/s/:handle', ctrl.store);
router.get('/c/:code', ctrl.collection);
router.get('/code/:code', ctrl.code);

module.exports = router;
