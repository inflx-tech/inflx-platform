'use strict';

const jwtService = require('../services/jwt.service');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * authenticate
 * Extracts and verifies the Bearer token from the Authorization header.
 * Attaches decoded payload to req.user.
 *
 * req.user shape:
 *   { sub, role, brand_id?, influencer_id?, admin_role? }
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('UNAUTHORIZED', 'Missing or invalid Authorization header', 401);
  }
  const token = header.slice(7);
  const decoded = jwtService.verifyToken(token);
  req.user = decoded;
  next();
});

/**
 * requireRole(...roles)
 * Middleware factory. Ensures the authenticated user has one of the given roles.
 *
 * @example
 *   router.post('/brands/register', authenticate, requireRole('brand'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('FORBIDDEN', 'You do not have permission to perform this action', 403));
    }
    next();
  };
}

/**
 * requireAdminRole(requiredRole)
 * For admin-only routes. First checks role === 'admin', then checks admin_role.
 *
 * From spec Section 5 — each admin role owns a distinct permission domain:
 *   superadmin → full access to all admin sections
 *   reviewer   → approval queues and read-only profiles (NOT finance ops)
 *   finance    → escrow, payout queue, financial reports (NOT approval ops)
 *
 * Rules:
 *   - superadmin always passes regardless of requiredRole
 *   - reviewer and finance are NOT interchangeable — each only passes its own domain
 *   - Any non-admin JWT (brand, influencer, follower) always gets 403
 *
 * Usage:
 *   requireAdminRole('reviewer')   → reviewer OR superadmin only
 *   requireAdminRole('finance')    → finance  OR superadmin only
 *   requireAdminRole('superadmin') → superadmin only
 */
function requireAdminRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
      return next(new AppError('FORBIDDEN', 'Admin access required', 403));
    }
    // superadmin has unrestricted access to every admin endpoint
    if (req.user.admin_role === 'superadmin') {
      return next();
    }
    // All other admin roles must match the required role exactly
    if (req.user.admin_role !== requiredRole) {
      return next(new AppError('FORBIDDEN', 'Insufficient admin permissions', 403));
    }
    next();
  };
}

/**
 * authenticateOptional
 * Like authenticate but does NOT throw if no token is present.
 * Sets req.user = decoded payload if valid token found, otherwise req.user = null.
 * Used for public endpoints (e.g. GET /store/:handle) that work for both
 * anonymous and logged-in users.
 */
const authenticateOptional = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  try {
    const token = header.slice(7);
    req.user = jwtService.verifyToken(token);
  } catch (_) {
    req.user = null;
  }
  next();
});

/**
 * requireAnyAdminRole
 * Allows any authenticated admin (reviewer, finance, superadmin) to proceed.
 * Used for endpoints that all admin roles can access (e.g. GET /admin/stats).
 */
function requireAnyAdminRole(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('FORBIDDEN', 'Admin access required', 403));
  }
  next();
}

module.exports = { authenticate, requireRole, requireAdminRole, requireAnyAdminRole, authenticateOptional };
