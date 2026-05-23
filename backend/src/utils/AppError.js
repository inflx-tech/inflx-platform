'use strict';

/**
 * Structured application error.
 * All intentional errors thrown in controllers/services should use this class.
 * The global errorHandler will format it into the standard INFLX error response.
 *
 * @example
 *   throw new AppError('WALLET_INSUFFICIENT', 'Wallet balance too low', 409);
 *   throw new AppError('VALIDATION_ERROR', 'Phone is required', 422, 'phone');
 */
class AppError extends Error {
  /**
   * @param {string} code        - SCREAMING_SNAKE_CASE error code (see spec Section 12.3)
   * @param {string} message     - Human-readable message
   * @param {number} statusCode  - HTTP status code (default 400)
   * @param {string} [field]     - Optional field name for validation errors
   * @param {object} [details]   - Optional structured payload (e.g. QUOTA_EXCEEDED { action, used, limit, upgrade_to })
   */
  constructor(code, message, statusCode = 400, field = null, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.field = field;
    this.details = details;
  }
}

module.exports = AppError;
