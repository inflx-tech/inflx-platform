'use strict';

const AppError = require('../utils/AppError');
const { error } = require('../utils/response');

/**
 * Global Express error-handling middleware.
 * Must be registered LAST in app.js (after all routes).
 *
 * Handles:
 *   - AppError instances → structured error response
 *   - PostgreSQL unique-violation (23505) → 409 CONFLICT
 *   - Everything else → 500 INTERNAL_ERROR (details logged server-side only)
 */
// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  // Known application error
  if (err instanceof AppError) {
    return error(res, err.code, err.message, err.statusCode, err.field);
  }

  // PostgreSQL unique violation (e.g. duplicate phone, duplicate instagram_handle)
  if (err.code === '23505') {
    const field = _extractFieldFromPgError(err);
    return error(res, 'CONFLICT', `A record with this ${field} already exists`, 409, field);
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return error(res, 'VALIDATION_ERROR', 'Referenced resource does not exist', 422);
  }

  // PostgreSQL invalid text representation (e.g. invalid UUID)
  if (err.code === '22P02') {
    return error(res, 'VALIDATION_ERROR', 'Invalid ID format', 400);
  }

  // Unexpected error — log full details server-side, return generic message to client
  console.error('[INFLX] Unhandled error:', err);
  const message = process.env.NODE_ENV === 'development'
    ? `${err.message} (${err.code || err.name})`
    : 'Internal server error. Please try again.';
  return error(res, 'INTERNAL_ERROR', message, 500);
};

function _extractFieldFromPgError(err) {
  // PG error detail looks like: Key (phone)=(+91...) already exists.
  const match = err.detail && err.detail.match(/Key \((\w+)\)/);
  return match ? match[1] : 'field';
}
