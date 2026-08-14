'use strict';

/**
 * postEvents.controller.js — behaviour-log ingest (Slice 0).
 * Contract: features/follower-event-log/
 *
 * authenticateOptional: guests must be able to log, or the feed would only
 * ever learn from signed-in followers while most browsing happens signed out.
 */

const postEvents = require('../services/postEvents.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// POST /v1/follower/events
const ingest = asyncHandler(async (req, res) => {
  let batch;
  try {
    batch = postEvents.validateBatch(req.body);
  } catch (e) {
    throw new AppError('VALIDATION_ERROR', e.message, 422, e.field);
  }

  const result = await postEvents.ingest({
    userId: req.user ? req.user.sub : null,
    deviceId: batch.deviceId,
    sessionId: batch.sessionId,
    events: batch.events,
  });

  return success(res, result);
});

module.exports = { ingest };
