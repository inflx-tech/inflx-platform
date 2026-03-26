'use strict';

/**
 * Wraps an async Express route handler so that any rejected promise
 * is forwarded to next(err) for the global errorHandler to catch.
 *
 * Usage:
 *   router.post('/foo', asyncHandler(async (req, res) => { ... }));
 */
module.exports = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
