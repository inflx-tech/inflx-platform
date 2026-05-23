'use strict';

/**
 * Standard INFLX API response helpers.
 * All responses follow the format defined in spec Section 12.
 *
 * Success: { success: true, data: {...}, meta?: {...} }
 * Error:   { success: false, error: { code, message, field? } }
 */

/**
 * Send a successful response.
 * @param {import('express').Response} res
 * @param {object} data
 * @param {number} [statusCode=200]
 * @param {object} [meta]          - Pagination meta: { page, total, limit }
 */
function success(res, data, statusCode = 200, meta = null) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

/**
 * Send an error response (used by errorHandler middleware).
 * @param {import('express').Response} res
 * @param {string} code
 * @param {string} message
 * @param {number} [statusCode=400]
 * @param {string} [field]
 */
function error(res, code, message, statusCode = 400, field = null, details = null) {
  const body = { success: false, error: { code, message } };
  if (field)   body.error.field   = field;
  if (details) body.error.details = details;
  return res.status(statusCode).json(body);
}

module.exports = { success, error };
