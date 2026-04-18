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
 * authenticateWithQuery
 * Like `authenticate` but accepts a JWT in `?download_token=` as a fallback.
 * Use ONLY for binary-stream endpoints (PDF, file downloads) embedded in
 * `<iframe>` / `<img>` / browser tabs that cannot set Authorization headers.
 *
 * Trade-off: token may appear in access logs. Mitigated by short JWT lifetime
 * (15 min) and the endpoint returning only the requesting party's own data.
 */
const authenticateWithQuery = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  let token = null;
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.query && req.query.download_token) {
    token = String(req.query.download_token);
  }
  if (!token) {
    throw new AppError('UNAUTHORIZED', 'Missing token', 401);
  }
  req.user = jwtService.verifyToken(token);
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

/**
 * requireApproved
 * Blocks unapproved brands from major actions (campaigns, influencer browse, products).
 * Must be placed AFTER authenticate + requireRole('brand').
 */
const requireApproved = asyncHandler(async (req, res, next) => {
  if (!req.user?.sub) return next(new AppError('UNAUTHORIZED', 'Authentication required', 401));
  const { rows } = await db.query('SELECT status FROM users WHERE id = $1', [req.user.sub]);
  const status = rows[0]?.status;
  if (status === 'approved') return next();
  if (status === 'pending') return next(new AppError('ACCOUNT_PENDING', 'Your account is under review by admin. This feature will be available once approved (usually within 24 hours).', 403));
  if (status === 'rejected') return next(new AppError('ACCOUNT_REJECTED', 'Your account was not approved. Please update your profile and resubmit.', 403));
  return next(new AppError('FORBIDDEN', 'Account access restricted.', 403));
});

module.exports = { authenticate, authenticateWithQuery, requireRole, requireAdminRole, requireAnyAdminRole, authenticateOptional, requireApproved };
