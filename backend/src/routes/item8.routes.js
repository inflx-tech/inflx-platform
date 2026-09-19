'use strict';

/**
 * Item 8 — the creator's pitch, E1–E10. Mounted at '/' beside items 6 and 7.
 * Contract: features/item8-pitch
 *
 * Every path is fixed, so nothing here can be shadowed by a later ':id' route.
 * The pitch thread deliberately reuses item 6's engine rather than adding a
 * second one, so the four thread endpoints mirror the invitation's exactly.
 */

const { Router } = require('express');
const { authenticate, requireApproved, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/pitch.controller');

const router = Router();
// registration-and-profile §6.3: a pending creator now reaches the app, so every creator
// action here answers ACCOUNT_PENDING until admin approves — the same middleware the brand
// side has used all along.
const creator = [authenticate, requireRole('influencer'), requireApproved];
const brand = [authenticate, requireRole('brand')];

// ── Creator — E2–E5, T1–T4, T13, T14 ────────────────────────────────────────
router.get ('/influencers/me/pitches/form/:brandId', ...creator, ctrl.form);
router.get ('/influencers/me/pitches',               ...creator, ctrl.mine);
router.post('/influencers/me/pitches',               ...creator, ctrl.send);
router.get ('/influencers/me/pitches/:id',           ...creator, ctrl.mineOne);
router.post('/influencers/me/pitches/:id/withdraw',  ...creator, ctrl.withdraw);

// Her side of the thread — item 6's engine, anchored to the pitch (T10)
router.get ('/influencers/me/pitches/:id/thread',         ...creator, ctrl.creatorThread);
router.post('/influencers/me/pitches/:id/thread/counter', ...creator, ctrl.creatorCounter);
router.post('/influencers/me/pitches/:id/thread/accept',  ...creator, ctrl.creatorAccept);
router.post('/influencers/me/pitches/:id/thread/decline', ...creator, ctrl.creatorDecline);

// ── Brand — E6–E9, T5–T9 ────────────────────────────────────────────────────
router.get ('/brands/me/pitches',            ...brand, ctrl.inbox);
router.get ('/brands/me/pitches/:id',        ...brand, ctrl.detail);
router.post('/brands/me/pitches/:id/accept', ...brand, ctrl.accept);
router.post('/brands/me/pitches/:id/reject', ...brand, ctrl.reject);

// Its side of the thread — the brand opens it, because her pitch is turn zero
router.get ('/brands/me/pitches/:id/thread',         ...brand, ctrl.brandThread);
router.post('/brands/me/pitches/:id/thread/counter', ...brand, ctrl.brandCounter);
router.post('/brands/me/pitches/:id/thread/accept',  ...brand, ctrl.brandAccept);
router.post('/brands/me/pitches/:id/thread/decline', ...brand, ctrl.brandDecline);

module.exports = router;
