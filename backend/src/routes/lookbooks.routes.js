'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/lookbooks.controller');
const { authenticate, requireRole, authenticateOptional } = require('../middleware/auth');

// ── Public side (no auth required — mounted on root) ─────────────────────────
const publicRouter = Router();
publicRouter.get('/store/:influencer_handle/lookbooks',     authenticateOptional, ctrl.listPublic);
publicRouter.get('/store/:influencer_handle/lookbooks/:id', authenticateOptional, ctrl.getPublic);

// ── Creator side (influencer auth required) ──────────────────────────────────
const creatorRouter = Router();
creatorRouter.use(authenticate);
creatorRouter.use(requireRole('influencer'));

creatorRouter.post(  '/lookbooks',                 ctrl.createLookbook);
creatorRouter.get(   '/lookbooks',                 ctrl.listMine);
creatorRouter.patch( '/lookbooks/:id',             ctrl.updateLookbook);
creatorRouter.delete('/lookbooks/:id',             ctrl.deleteLookbook);
creatorRouter.post(  '/lookbooks/:id/products',    ctrl.replaceLookbookProducts);

module.exports = { publicRouter, creatorRouter };
