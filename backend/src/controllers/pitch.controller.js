'use strict';

/**
 * Item 8 — the pitch endpoints, E1–E10.
 * Every rule lives in services/pitch.service; these are thin wrappers.
 * Contract: features/item8-pitch
 *
 * Access: creator endpoints for that creator, brand endpoints for the owning
 * brand, everything else 404 — never 403, which would confirm the row exists.
 * The scope is in the WHERE clause of every load, so a pitch belonging to
 * somebody else simply is not found.
 */

const { success } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const db = require('../config/db');
const pitch = require('../services/pitch.service');
const negotiation = require('../services/negotiation.service');

async function brandIdOf(userId) {
  const { rows } = await db.query(`SELECT id FROM brands WHERE user_id = $1`, [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  return rows[0].id;
}
async function influencerIdOf(userId) {
  const { rows } = await db.query(`SELECT id FROM influencers WHERE user_id = $1`, [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  return rows[0].id;
}

/* ─────────────────────────────────────────────────────────── creator */

// E2 — what this brand accepts, and her own minimums (T2)
const form = asyncHandler(async (req, res) =>
  success(res, { form: await pitch.formFor(req.params.brandId, await influencerIdOf(req.user.sub)) }));

// E3 — send it (T3)
const send = asyncHandler(async (req, res) =>
  success(res, { pitch: await pitch.send(await influencerIdOf(req.user.sub), req.body || {}) }, 201));

// E4 — her list (T13, T14)
const mine = asyncHandler(async (req, res) =>
  success(res, await pitch.listForCreator(await influencerIdOf(req.user.sub))));

// E4 — one of hers
const mineOne = asyncHandler(async (req, res) =>
  success(res, { pitch: await pitch.detailForCreator(req.params.id, await influencerIdOf(req.user.sub)) }));

// E5 — take it back (T4)
const withdraw = asyncHandler(async (req, res) =>
  success(res, { pitch: await pitch.withdraw(req.params.id, await influencerIdOf(req.user.sub), req.user.sub) }));

/* ─────────────────────────────────────────────────────────── brand */

// E6 — the brand's inbox (T5)
const inbox = asyncHandler(async (req, res) =>
  success(res, await pitch.listForBrand(await brandIdOf(req.user.sub))));

// E7 — one pitch, which marks it read (T6)
const detail = asyncHandler(async (req, res) =>
  success(res, { pitch: await pitch.detailForBrand(req.params.id, await brandIdOf(req.user.sub)) }));

// E8 — accept: agrees the money, creates a pool entry and nothing else (T7)
const accept = asyncHandler(async (req, res) =>
  success(res, await pitch.accept(req.params.id, await brandIdOf(req.user.sub), req.user.sub)));

// E9 — reject, which starts the cooldown (T8)
const reject = asyncHandler(async (req, res) =>
  success(res, { pitch: await pitch.reject(req.params.id, await brandIdOf(req.user.sub), req.body || {}, req.user.sub) }));

/* ─────────────────────────────────── E10 · the thread, both sides */

/**
 * The pitch thread is item 6's engine with a different anchor, so these four
 * hand straight to it. Nothing about counters is re-implemented here.
 */

const ctxFor = async (req, side) => {
  const scope = side === 'brand'
    ? { brandId: await brandIdOf(req.user.sub) }
    : { influencerId: await influencerIdOf(req.user.sub) };
  const ctx = await negotiation.loadPitchContext(req.params.id, scope);
  if (!ctx) throw new AppError('NOT_FOUND', 'Not found', 404);
  return ctx;
};

const thread = (side) => asyncHandler(async (req, res) => {
  const ctx = await ctxFor(req, side);
  success(res, { thread: await negotiation.thread(ctx, side) });
});

const counter = (side) => asyncHandler(async (req, res) => {
  const ctx = await ctxFor(req, side);
  const negotiationId = await negotiation.counter({
    ctx, by: side, terms: req.body || {}, note: (req.body || {}).note, actorUserId: req.user.sub,
  });
  success(res, { thread: await negotiation.thread(await ctxFor(req, side), side), negotiationId }, 201);
});

/**
 * Accepting a counter as the BRAND is the same act as accepting the pitch, so
 * it goes through the pitch service — which creates the pool entry after the
 * engine settles the terms. There is one accept, not two.
 */
const threadAccept = (side) => asyncHandler(async (req, res) => {
  if (side === 'brand') {
    return success(res, await pitch.accept(req.params.id, await brandIdOf(req.user.sub), req.user.sub));
  }
  const ctx = await ctxFor(req, side);
  await negotiation.accept({ ctx, by: side, actorUserId: req.user.sub });
  return success(res, { pitch: await pitch.detailForCreator(req.params.id, await influencerIdOf(req.user.sub)) });
});

/** Declining as the brand is a rejection, and a rejection stamps the cooldown. */
const threadDecline = (side) => asyncHandler(async (req, res) => {
  if (side === 'brand') {
    return success(res, { pitch: await pitch.reject(req.params.id, await brandIdOf(req.user.sub), { reason: (req.body || {}).note }, req.user.sub) });
  }
  const ctx = await ctxFor(req, side);
  await negotiation.decline({ ctx, by: side, reason: (req.body || {}).reason, note: (req.body || {}).note, actorUserId: req.user.sub });
  return success(res, { pitch: await pitch.detailForCreator(req.params.id, await influencerIdOf(req.user.sub)) });
});

module.exports = {
  form, send, mine, mineOne, withdraw,
  inbox, detail, accept, reject,
  creatorThread: thread('influencer'), brandThread: thread('brand'),
  creatorCounter: counter('influencer'), brandCounter: counter('brand'),
  creatorAccept: threadAccept('influencer'), brandAccept: threadAccept('brand'),
  creatorDecline: threadDecline('influencer'), brandDecline: threadDecline('brand'),
};
