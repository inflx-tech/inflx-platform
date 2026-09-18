'use strict';

/**
 * Item 10 — the Store Visit shoot plan endpoints, F1–F8.
 * Every rule lives in services/shootPlan.service (and, for the time, the negotiation engine);
 * these are thin wrappers. Contract: features/item10-store-visit
 *
 * Access: brand endpoints for the owning brand through the owning set, creator endpoints for
 * that creator, everything else 404 — never 403, which would confirm the row exists. Every one
 * of them is behind the §10 gate, asked inside the service.
 */

const { success } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const shoot = require('../services/shootPlan.service');

const brandScope = (req) => ({ side: 'brand', userId: req.user.sub, campaignId: req.params.id, setId: req.params.sid });
const creatorScope = (req) => ({ side: 'creator', userId: req.user.sub });

// ─── brand ───────────────────────────────────────────────────────────────────

// F1 — the collaboration's shoot state (V1, V10, V11, V13, V14)
const brandRead = asyncHandler(async (req, res) =>
  success(res, { shoot: await shoot.read(req.params.ciId, brandScope(req)) }));

// F2+F3 — send the plan, one call (V2, V3)
const send = asyncHandler(async (req, res) =>
  success(res, { shoot: await shoot.send(req.params.ciId, brandScope(req), req.body || {}) }, 201));

// F5 — the brand's side of the time thread (V7)
const brandThread = asyncHandler(async (req, res) =>
  success(res, { shoot: await shoot.read(req.params.ciId, brandScope(req)) }));
const brandCounter = asyncHandler(async (req, res) =>
  success(res, { shoot: await shoot.counterTime(req.params.ciId, brandScope(req), req.body || {}) }));
const brandAccept = asyncHandler(async (req, res) =>
  success(res, { shoot: await shoot.acceptCounter(req.params.ciId, brandScope(req)) }));

// F6 — move an agreed time (V12; V10's quiet alternative)
const brandMove = asyncHandler(async (req, res) =>
  success(res, { shoot: await shoot.move(req.params.ciId, brandScope(req), req.body || {}) }));

// F8 — confirm the shoot is done (V10 → V11)
const confirm = asyncHandler(async (req, res) =>
  success(res, { shoot: await shoot.confirm(req.params.ciId, brandScope(req)) }));

// ─── creator ─────────────────────────────────────────────────────────────────

// F1 — what she was sent (V4, V5, V8, V9, V15)
const creatorRead = asyncHandler(async (req, res) =>
  success(res, { shoot: await shoot.read(req.params.ciId, creatorScope(req)) }));

// F4 — this time works (V5)
const acceptTime = asyncHandler(async (req, res) =>
  success(res, { shoot: await shoot.acceptTime(req.params.ciId, creatorScope(req)) }));

// F5 — her side of the time thread (V6)
const creatorThread = asyncHandler(async (req, res) =>
  success(res, { shoot: await shoot.read(req.params.ciId, creatorScope(req)) }));
const creatorCounter = asyncHandler(async (req, res) =>
  success(res, { shoot: await shoot.counterTime(req.params.ciId, creatorScope(req), req.body || {}) }));
const creatorAccept = asyncHandler(async (req, res) =>
  success(res, { shoot: await shoot.acceptCounter(req.params.ciId, creatorScope(req)) }));

// F6 — ask to move an agreed time (V8's quiet link, V12)
const creatorMove = asyncHandler(async (req, res) =>
  success(res, { shoot: await shoot.move(req.params.ciId, creatorScope(req), req.body || {}) }));

// F7 — I've been to the store (V8 → V9)
const attended = asyncHandler(async (req, res) =>
  success(res, { shoot: await shoot.attended(req.params.ciId, creatorScope(req)) }));

module.exports = {
  brandRead, send, brandThread, brandCounter, brandAccept, brandMove, confirm,
  creatorRead, acceptTime, creatorThread, creatorCounter, creatorAccept, creatorMove, attended,
};
