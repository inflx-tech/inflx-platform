'use strict';

/**
 * Item 6 — negotiation, the move request, the pool and the platform settings: the HTTP layer.
 * Every rule lives in services/negotiation.service, services/pool.service and
 * services/platformSettings.service; the legacy /offers and /negotiations routes wrap the same
 * services (APPROVAL §3.1).
 * Contract: features/item6-negotiation · gap prompt §5 (B1–B16)
 *
 * Creator (her own invitation, else 404):
 *   POST /influencers/me/invitations/:ciId/counter            B1
 *   POST /influencers/me/invitations/:ciId/move-request       B2
 *   GET  /influencers/me/invitations/:ciId/thread             B3
 *   POST /influencers/me/invitations/:ciId/thread/accept      B4
 *   POST /influencers/me/invitations/:ciId/thread/decline     B4
 *   GET  /influencers/me/pool · DELETE /influencers/me/pool/:entryId   B11
 * Brand (its own campaign and set, else 404):
 *   GET  /campaigns/:id/sets/:sid/invitations/:ciId/thread                B5
 *   POST …/thread/accept · …/thread/counter · …/thread/decline            B6–B8
 *   POST …/invitations/:ciId/move-answer                                 B9
 *   GET  /brands/me/pool?goal= · DELETE /brands/me/pool/:entryId          B10, B11
 *   POST /brands/me/pool/set-defaults                                     B12
 * Admin:
 *   GET / PATCH /admin/platform-settings                                  B15
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const negotiation = require('../services/negotiation.service');
const pool = require('../services/pool.service');
const settings = require('../services/platformSettings.service');
const { SET_SELECT } = require('./campaignSets.controller');

async function brandOf(userId) {
  const { rows } = await db.query(`SELECT id, user_id, business_name FROM brands WHERE user_id = $1`, [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand profile not found. Please register first.', 404);
  return rows[0];
}
async function influencerIdOf(userId) {
  const { rows } = await db.query(`SELECT id FROM influencers WHERE user_id = $1`, [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Influencer profile not found', 404);
  return rows[0].id;
}
async function ownedSet(req, brandId) {
  const { rows: c } = await db.query(`SELECT id FROM campaigns WHERE id = $1 AND brand_id = $2`, [req.params.id, brandId]);
  if (!c[0]) throw new AppError('NOT_FOUND', 'Campaign not found', 404);
  const { rows: s } = await db.query(`${SET_SELECT} WHERE s.id = $1 AND s.campaign_id = $2`, [req.params.sid, c[0].id]);
  if (!s[0]) throw new AppError('NOT_FOUND', 'Set not found', 404);
  return s[0];
}
async function creatorCtx(req) {
  const influencerId = await influencerIdOf(req.user.sub);
  const ctx = await negotiation.loadContext(req.params.ciId, { influencerId });
  if (!ctx) throw new AppError('NOT_FOUND', 'Invitation not found', 404);
  return ctx;
}
async function brandCtx(req) {
  const brand = await brandOf(req.user.sub);
  const set = await ownedSet(req, brand.id);
  const ctx = await negotiation.loadContext(req.params.ciId, { brandId: brand.id });
  if (!ctx || ctx.set_id !== set.id) throw new AppError('NOT_FOUND', 'Invitation not found', 404);
  return ctx;
}
const reload = (ctx, side) => negotiation.loadContext(ctx.id, side === 'brand' ? { brandId: ctx.brand_id } : { influencerId: ctx.influencer_id });

/* ─────────────────────────────────────────────────────────── creator */

const creatorThread = asyncHandler(async (req, res) => {
  const ctx = await creatorCtx(req);
  return success(res, { thread: await negotiation.thread(ctx, 'influencer') });
});
const creatorCounter = asyncHandler(async (req, res) => {
  const ctx = await creatorCtx(req);
  await negotiation.counter({ ctx, by: 'influencer', terms: req.body && req.body.terms ? req.body.terms : (req.body || {}), note: req.body && req.body.note, actorUserId: req.user.sub });
  return success(res, { thread: await negotiation.thread(await reload(ctx, 'influencer'), 'influencer') }, 201);
});
const creatorMoveRequest = asyncHandler(async (req, res) => {
  const ctx = await creatorCtx(req);
  const b = req.body || {};
  await negotiation.moveRequest({ ctx, goLiveDate: b.goLiveDate || b.go_live_date, shootMode: b.shootMode || b.shoot_mode, note: b.note });
  return success(res, { thread: await negotiation.thread(await reload(ctx, 'influencer'), 'influencer') }, 201);
});
const creatorAccept = asyncHandler(async (req, res) => {
  const ctx = await creatorCtx(req);
  const { contractError } = await negotiation.accept({ ctx, by: 'influencer', actorUserId: req.user.sub });
  return success(res, { thread: await negotiation.thread(await reload(ctx, 'influencer'), 'influencer'), contractPending: !!contractError });
});
const creatorDecline = asyncHandler(async (req, res) => {
  const ctx = await creatorCtx(req);
  await negotiation.decline({ ctx, by: 'influencer', reason: req.body && req.body.reason, note: req.body && req.body.note, actorUserId: req.user.sub });
  return success(res, { thread: await negotiation.thread(await reload(ctx, 'influencer'), 'influencer') });
});
const creatorPool = asyncHandler(async (req, res) => {
  const influencerId = await influencerIdOf(req.user.sub);
  return success(res, { entries: await pool.listForCreator(influencerId) });
});
const creatorLeavePool = asyncHandler(async (req, res) => {
  const influencerId = await influencerIdOf(req.user.sub);
  return success(res, await pool.remove({ entryId: req.params.entryId, influencerId, actorUserId: req.user.sub }));
});

/* ─────────────────────────────────────────────────────────── brand */

const brandThread = asyncHandler(async (req, res) => {
  const ctx = await brandCtx(req);
  return success(res, { thread: await negotiation.thread(ctx, 'brand') });
});
const brandCounter = asyncHandler(async (req, res) => {
  const ctx = await brandCtx(req);
  await negotiation.counter({ ctx, by: 'brand', terms: req.body && req.body.terms ? req.body.terms : (req.body || {}), note: req.body && req.body.note, actorUserId: req.user.sub });
  return success(res, { thread: await negotiation.thread(await reload(ctx, 'brand'), 'brand') }, 201);
});
const brandAccept = asyncHandler(async (req, res) => {
  const ctx = await brandCtx(req);
  const { contractError } = await negotiation.accept({ ctx, by: 'brand', actorUserId: req.user.sub });
  return success(res, { thread: await negotiation.thread(await reload(ctx, 'brand'), 'brand'), contractPending: !!contractError });
});
const brandDecline = asyncHandler(async (req, res) => {
  const ctx = await brandCtx(req);
  await negotiation.decline({ ctx, by: 'brand', note: req.body && req.body.note, actorUserId: req.user.sub });
  return success(res, { thread: await negotiation.thread(await reload(ctx, 'brand'), 'brand') });
});
const brandMoveAnswer = asyncHandler(async (req, res) => {
  const ctx = await brandCtx(req);
  const out = await negotiation.moveAnswer({ ctx, answer: req.body && req.body.answer, actorUserId: req.user.sub });
  return success(res, { answer: out.answer, poolEntryId: out.entry ? out.entry.id : null, thread: await negotiation.thread(await reload(ctx, 'brand'), 'brand') });
});
const brandPool = asyncHandler(async (req, res) => {
  const brand = await brandOf(req.user.sub);
  return success(res, await pool.listForBrand(brand.id, { goal: req.query.goal || null }));
});
const brandRemoveFromPool = asyncHandler(async (req, res) => {
  const brand = await brandOf(req.user.sub);
  return success(res, await pool.remove({ entryId: req.params.entryId, brandId: brand.id, actorUserId: req.user.sub }));
});
const brandPoolSetDefaults = asyncHandler(async (req, res) => {
  const brand = await brandOf(req.user.sub);
  return success(res, await pool.setDefaults(brand.id, (req.body && (req.body.entryIds || req.body.entry_ids)) || []));
});

/* ─────────────────────────────────────────────────────────── admin */

const getPlatformSettings = asyncHandler(async (req, res) => {
  const all = await settings.getAll({ fresh: true });
  const audit = await settings.audit({ limit: 20 });
  return success(res, { settings: settings.KEYS.map(k => all[k]), lastChange: audit[0] || null, audit });
});
const updatePlatformSettings = asyncHandler(async (req, res) => {
  const out = await settings.update(req.body || {}, req.user.sub);
  const audit = await settings.audit({ limit: 20 });
  return success(res, { settings: settings.KEYS.map(k => out.settings[k]), changed: out.changed, lastChange: audit[0] || null, audit });
});

module.exports = {
  creatorThread, creatorCounter, creatorMoveRequest, creatorAccept, creatorDecline, creatorPool, creatorLeavePool,
  brandThread, brandCounter, brandAccept, brandDecline, brandMoveAnswer, brandPool, brandRemoveFromPool, brandPoolSetDefaults,
  getPlatformSettings, updatePlatformSettings,
};
