'use strict';

/**
 * ops.routes.js — things INFLX's own scripts do on the live system, never an app or a person signed in.
 *
 * POST /v1/ops/post-media/:id/cover   — add the picture of a video slide that has none
 *      Header: X-OTA-Token: <OTA_PUBLISH_TOKEN>   (the same token that publishes an app update)
 *      Body:   { jpeg_b64, replace? }
 *
 * Contract: features/shopper-walk-fixes · 01-spec.md W16 (founder, 5 Oct 2026: the four videos
 * uploaded before a creator's phone made a picture show a product photo on Saved). The server holds
 * the storage keys; the script that calls this (backend/scripts/backfill-video-covers.js) does not.
 */

const { Router } = require('express');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const posts = require('../services/shoppablePosts.service');

const router = Router();

/** The token that publishes an app update is the only way in. No token configured → nobody gets in. */
function opsOnly(req, _res, next) {
  const token = req.get('x-ota-token') || '';
  if (!env.OTA_PUBLISH_TOKEN || token !== env.OTA_PUBLISH_TOKEN) {
    return next(new AppError('UNAUTHORIZED', 'Invalid or missing X-OTA-Token', 401));
  }
  return next();
}

router.post('/post-media/:id/cover', opsOnly, asyncHandler(async (req, res) => {
  const { jpeg_b64: b64, replace } = req.body || {};
  if (typeof b64 !== 'string' || !b64.length) throw new AppError('VALIDATION_ERROR', 'jpeg_b64 is required', 422, 'jpeg_b64');
  const out = await posts.setVideoPicture(req.params.id, Buffer.from(b64, 'base64'), { replace: replace === true });
  console.log(`[ops] video picture ${out.changed ? 'set' : 'kept'} for media ${out.media_id} (post ${out.post_code})`);
  return success(res, out);
}));

module.exports = router;
