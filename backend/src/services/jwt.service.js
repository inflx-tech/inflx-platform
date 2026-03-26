'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');
const db = require('../config/db');
const AppError = require('../utils/AppError');

/**
 * Generate the short-lived access token (15 min).
 * Payload contains everything the auth middleware needs to authorise requests.
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRY });
}

/**
 * Generate the long-lived refresh token (30 days).
 * Only carries the user's sub — everything else is re-read from DB on refresh.
 *
 * A random `jti` (JWT ID) claim is included so that two tokens generated in
 * the same second for the same user produce different JWT strings and therefore
 * different SHA-256 hashes. Without this, jwt.sign embeds only a whole-second
 * `iat` timestamp — identical payloads in the same second → identical hashes
 * → unique-constraint violation on refresh_tokens.token_hash.
 */
function generateRefreshToken(userId) {
  return jwt.sign(
    { sub: userId, type: 'refresh', jti: crypto.randomBytes(16).toString('hex') },
    env.JWT_SECRET,
    { expiresIn: env.REFRESH_TOKEN_EXPIRY }
  );
}

/**
 * Verify any JWT (access or refresh).
 * Throws AppError if invalid or expired.
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    throw new AppError('UNAUTHORIZED', 'Invalid or expired token', 401);
  }
}

/**
 * Persist a refresh token hash to the DB so we can revoke it later.
 * We store the SHA-256 hash — never the raw token.
 */
async function storeRefreshToken(userId, rawToken) {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hash, expiresAt]
  );
  return hash;
}

/**
 * Validate a raw refresh token against the DB.
 * Returns the stored row if valid.
 * Throws AppError if not found, revoked, or expired.
 */
async function validateRefreshToken(rawToken) {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const { rows } = await db.query(
    `SELECT * FROM refresh_tokens
     WHERE token_hash = $1 AND revoked = false AND expires_at > now()`,
    [hash]
  );
  if (rows.length === 0) {
    throw new AppError('UNAUTHORIZED', 'Refresh token is invalid or expired', 401);
  }
  return rows[0];
}

/**
 * Revoke a refresh token by its raw value.
 */
async function revokeRefreshToken(rawToken) {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await db.query(
    `UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`,
    [hash]
  );
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  storeRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
};
