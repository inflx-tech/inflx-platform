'use strict';

const jwtService = require('../services/jwt.service');
const db = require('../config/db');
const { loadSchema } = require('../services/schema.service');
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
 * requireCapability(capKey)
 * Fine-grained, per-section admin gate (B-2). Sits AFTER `authenticate` and
 * COEXISTS with requireAdminRole/requireAnyAdminRole (which are untouched).
 *
 * Behaviour:
 *   - Requires req.user.role === 'admin' (any non-admin JWT → 403).
 *   - Loads admin_role + capabilities + active from admin_profiles by the
 *     JWT subject on EVERY request — capabilities are deliberately NOT read
 *     from the JWT, so a superadmin's grant/revoke takes effect immediately
 *     without the affected admin re-logging in.
 *   - superadmin (admin_role === 'superadmin') bypasses the capability check
 *     entirely → never section-locked-out.
 *   - active === false → 403 (deactivated admin).
 *   - Otherwise capKey must be present in capabilities[], else 403.
 *
 * Usage:
 *   router.get('/escrow', authenticate, requireCapability('escrow'), ctrl.getEscrowOverview)
 */
function requireCapability(capKey) {
  return asyncHandler(async (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
      return next(new AppError('FORBIDDEN', 'Admin access required', 403));
    }
    const { rows } = await db.query(
      `SELECT admin_role, capabilities, active FROM admin_profiles WHERE user_id = $1`,
      [req.user.sub]
    );
    const profile = rows[0];
    if (!profile) {
      return next(new AppError('FORBIDDEN', 'Admin profile not found', 403));
    }
    if (profile.active === false) {
      return next(new AppError('FORBIDDEN', 'Your admin account has been deactivated', 403));
    }
    // superadmin has unrestricted access to every section.
    if (profile.admin_role === 'superadmin') {
      return next();
    }
    const caps = Array.isArray(profile.capabilities) ? profile.capabilities : [];
    if (!caps.includes(capKey)) {
      return next(new AppError('FORBIDDEN', 'You do not have access to this admin section', 403));
    }
    next();
  });
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

/**
 * requireApprovedFor(...roles) — requireApproved, but only when the caller's role is one of
 * `roles`. For routes a brand shares with admin (a creator's profile page, for instance):
 * the brand must be approved, admin passes through untouched.
 * Contract: features/registration-and-profile §6.5 — a pending brand sees home, profile and
 * wallet, nothing else.
 */
function requireApprovedFor(...roles) {
  return (req, res, next) => {
    if (roles.includes(req.user?.role)) return requireApproved(req, res, next);
    return next();
  };
}

/**
 * requireBrandFeature(featureKey)
 * Gates a brand-side route by the brand's category schema. The brand's
 * `category` (brands.category) resolves to public/schemas/<category>.json;
 * the route is only reachable when that schema declares
 * `features[featureKey] === true`. Anything else (flag false or absent)
 * → 403.
 *
 * This is the backend half of vertical feature-gating: it stops a brand of
 * the wrong vertical from reaching another vertical's endpoints by a direct
 * API call, even when the dashboard nav already hides the link. Place AFTER
 * authenticate + requireRole('brand').
 *
 *   router.put('/config', requireRole('brand'), requireBrandFeature('meals'), ctrl.putConfig)
 */
function requireBrandFeature(featureKey) {
  return asyncHandler(async (req, res, next) => {
    if (!req.user?.sub) return next(new AppError('UNAUTHORIZED', 'Authentication required', 401));
    const { rows } = await db.query('SELECT category FROM brands WHERE user_id = $1', [req.user.sub]);
    const category = rows[0]?.category;
    if (!category) return next(new AppError('NOT_FOUND', 'Brand profile not found', 404));
    const schema = loadSchema(category);
    if (schema?.features?.[featureKey] === true) return next();
    return next(new AppError('FORBIDDEN', 'This feature is not available for your business type.', 403));
  });
}

module.exports = { authenticate, authenticateWithQuery, requireRole, requireAdminRole, requireAnyAdminRole, requireCapability, authenticateOptional, requireApproved, requireApprovedFor, requireBrandFeature };
