'use strict';

/**
 * adminCapabilities.js — canonical admin capability catalog (B-2).
 *
 * v1 of the admin CAPABILITIES/PERMISSIONS model. Fine-grained section
 * access that COEXISTS with the 3 base roles (superadmin/reviewer/finance)
 * stored in admin_profiles.admin_role. Base roles stay functional for the
 * route files still gated by requireAdminRole/requireAnyAdminRole; the
 * capability layer (requireCapability) is an ADDITIVE per-section gate.
 *
 * One source of truth, owned by the backend and exposed to the admin UI via
 * GET /admin/capabilities so the user-management screen builds checkboxes
 * without hardcoding keys. The keys below are derived from the real admin
 * nav (Packages/brand-web/app/admin/layout.js) and the section routes in
 * backend/src/routes/admin.routes.js.
 *
 * superadmin (admin_role === 'superadmin') bypasses every capability check
 * in the middleware, so it is never section-restricted regardless of the
 * capabilities[] array. The DEFAULT_CAPS_BY_ROLE map below is used only to
 * backfill / seed capabilities for the two scoped base roles so that
 * pre-existing reviewer / finance admins keep exactly their current reach
 * once the section routes flip to requireCapability.
 */

// ─── Canonical capability catalog ──────────────────────────────────────────
// key   — stored in admin_profiles.capabilities[]; matched by requireCapability
// label — human label for the UI checkbox
// group — nav section the capability belongs to (for grouped checkboxes)
const CAPABILITIES = [
  // OVERVIEW (analytics). Platform Stats stays on requireAnyAdminRole — it is
  // the dashboard landing read + badge source every admin needs; only the
  // dedicated Analytics page is capability-gated.
  { key: 'analytics',     label: 'Analytics',            group: 'Overview' },

  // MANAGEMENT
  { key: 'approvals',     label: 'Approvals (queues + status)', group: 'Management' },
  { key: 'brands',        label: 'Brands directory',     group: 'Management' },
  { key: 'influencers',   label: 'Influencers',          group: 'Management' },
  { key: 'production',    label: 'Production queue',      group: 'Management' },
  { key: 'orders',        label: 'Orders',               group: 'Management' },

  // CONTENT / catalogue + merch engine
  { key: 'master_data',   label: 'Master dishes',        group: 'Content' },
  { key: 'sections',      label: 'App sections',         group: 'Content' },
  { key: 'libraries',     label: 'Section + Collection libraries', group: 'Content' },
  { key: 'categories',    label: 'Tag vocab + follower categories', group: 'Content' },

  // MARKETING
  { key: 'marketing',     label: 'Marketing (leads, verifications, invitations)', group: 'Marketing' },

  // REFERRALS
  { key: 'referrals',     label: 'Referrals',            group: 'Referrals' },

  // FINANCE
  { key: 'escrow',        label: 'Escrow',               group: 'Finance' },
  { key: 'payouts',       label: 'Payouts + withdrawals', group: 'Finance' },
  { key: 'returns',       label: 'Returns',              group: 'Finance' },
  { key: 'subscriptions', label: 'Subscriptions + invoices', group: 'Finance' },
  { key: 'tax',           label: 'Tax summary + tax controls', group: 'Finance' },

  // PRICING
  { key: 'pricing',       label: 'Pricing (tiers, features, L3 categories)', group: 'Pricing' },

  // SETTINGS
  { key: 'settings',      label: 'Payment config + meals settings', group: 'Settings' },
  { key: 'users',         label: 'Admin users (superadmin only)', group: 'Settings' },
];

const CAPABILITY_KEYS = CAPABILITIES.map((c) => c.key);

// ─── Role → default capabilities (backfill + seed map) ──────────────────────
// superadmin → ALL keys (it also bypasses checks in middleware; ALL kept so
//   the stored array is honest and the UI shows everything ticked).
// reviewer   → read / approval / catalogue sections (its current reach).
// finance    → money sections (its current reach).
const ALL_CAPS = [...CAPABILITY_KEYS];

const REVIEWER_CAPS = [
  'analytics',
  'approvals',
  'brands',
  'influencers',
  'production',
  'orders',
  'master_data',
  'sections',
  'libraries',
  'categories',
  'marketing',
];

const FINANCE_CAPS = [
  'analytics',
  'escrow',
  'payouts',
  'returns',
  'subscriptions',
  'tax',
];

const DEFAULT_CAPS_BY_ROLE = {
  superadmin: ALL_CAPS,
  reviewer:   REVIEWER_CAPS,
  finance:    FINANCE_CAPS,
};

/**
 * isValidCapability(key) — true if key is a known catalog capability.
 */
function isValidCapability(key) {
  return CAPABILITY_KEYS.includes(key);
}

/**
 * defaultCapsForRole(role) — seed capabilities for a base role; [] if unknown.
 */
function defaultCapsForRole(role) {
  return DEFAULT_CAPS_BY_ROLE[role] ? [...DEFAULT_CAPS_BY_ROLE[role]] : [];
}

module.exports = {
  CAPABILITIES,
  CAPABILITY_KEYS,
  DEFAULT_CAPS_BY_ROLE,
  isValidCapability,
  defaultCapsForRole,
};
