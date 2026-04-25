'use strict';

const crypto = require('crypto');
const env = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * requireIngestToken
 * Authorises pushes from the external Marketing Automation system to the
 * /v1/internal/ingest/* endpoints. Compares the X-Ingest-Token header
 * against env.INFLX_INGEST_TOKEN using a constant-time comparison.
 *
 * In production the token must be configured — if it's empty, EVERY
 * request is rejected. In dev/test a fixed default is used (see env.js)
 * so smoke tests don't need configuration.
 *
 * Failure response (matches the contract published to the marketing
 * automation system):
 *   401 { success: false, error: { code: 'TOKEN_REJECTED', message: '...' } }
 */
function requireIngestToken(req, res, next) {
  const presented = req.headers['x-ingest-token'];
  const expected = env.INFLX_INGEST_TOKEN;

  if (!expected) {
    return next(new AppError('TOKEN_REJECTED', 'Ingest endpoint not configured', 401));
  }
  if (typeof presented !== 'string' || presented.length === 0) {
    return next(new AppError('TOKEN_REJECTED', 'Missing X-Ingest-Token header', 401));
  }

  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  // timingSafeEqual requires equal-length buffers; a length mismatch is
  // itself proof the token is wrong.
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return next(new AppError('TOKEN_REJECTED', 'Invalid X-Ingest-Token', 401));
  }

  next();
}

module.exports = { requireIngestToken };
