'use strict';

/**
 * deliverable.routes.js
 *
 * ── Item 12, Phase 2a — ALL EIGHT CONTENT DOORS RETIRED (approval Q2) ─────────────────────────
 * Contract: features/item12-content · gap report §4, finding 1
 *
 * These eight routes were the pre-rebuild content flow: one file or one URL per deliverable
 * unit, no rounds history, a reason optional, no size cap on uploads, and a read that served
 * anyone who was not a MISMATCHED brand or creator. Worst of all, `confirm-live` released
 * tranche 2 and queued tranche 3 with no signature, no shoot and no Aim check, and the brand
 * website called it.
 *
 * They are switched off HERE, server-side, for EVERY Aim and whatever a client still shows —
 * items 10 and 11's pattern. No lookup is made: a retired door says its sentence to any
 * logged-in caller and reveals nothing about the id it was given. The `deliverables` rows and
 * their columns are left exactly as they are, unread by the new flow.
 *
 *   GET  /:id               read              → G1   the content state, both sides
 *   POST /:id/upload-url    upload            → G2   private upload, verified by headObject
 *   GET  /:id/media-url     view a file       → G12  300-second signed URL, parties only
 *   POST /:id/submit        submit            → G5   one complete package
 *   POST /:id/review        review            → G6/G7 one verdict, a required reason
 *   POST /bulk-review       review many       → nothing (one verdict per package)
 *   POST /:id/submit-live   the live link     → G8/G9 a proof per slot, then "posted"
 *   POST /:id/confirm-live  confirm, pay T2   → G10  behind the content gate, contentMoney
 *
 * `refresh-stats` (Apify engagement numbers on a live deliverable) went with post-performance-v2
 * (P11): nothing could reach a live legacy deliverable, and the numbers now come from the links she
 * hands in at the content step (proof_stats). Contract: features/post-performance-v2
 */

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const AppError = require('../utils/AppError');
const { MSG } = require('../services/contentCopy');

const router = Router();

/** A retired door: its code and its sentence, before anything is read. */
const retired = (code, message) => (req, res, next) => next(new AppError(code, message, 422, 'status'));

/** The eight, as a table — the retirement test walks this same list (check 32). */
const RETIRED = [
  ['post', '/bulk-review',       'RETIRED_12_BULK_REVIEW',  MSG.RETIRED_12_CONTENT],
  ['get',  '/:id',               'RETIRED_12_READ',         MSG.RETIRED_12_CONTENT],
  ['post', '/:id/upload-url',    'RETIRED_12_UPLOAD',       MSG.RETIRED_12_CONTENT],
  ['get',  '/:id/media-url',     'RETIRED_12_MEDIA',        MSG.RETIRED_12_CONTENT],
  ['post', '/:id/submit',        'RETIRED_12_SUBMIT',       MSG.RETIRED_12_CONTENT],
  ['post', '/:id/review',        'RETIRED_12_REVIEW',       MSG.RETIRED_12_CONTENT],
  ['post', '/:id/submit-live',   'RETIRED_12_SUBMIT_LIVE',  MSG.RETIRED_12_CONTENT],
  ['post', '/:id/confirm-live',  'RETIRED_12_CONFIRM_LIVE', MSG.RETIRED_12_CONFIRM_LIVE],
];
for (const [method, path, code, message] of RETIRED) router[method](path, authenticate, retired(code, message));

module.exports = router;
module.exports.RETIRED = RETIRED;
