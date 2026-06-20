-- ============================================================================
-- Migration 107 — Admin capabilities / permissions model (B-2)
--   (contract: admin CAPABILITIES/PERMISSIONS — project_admin_url_roles_decision)
-- ----------------------------------------------------------------------------
-- Adds a fine-grained, per-section capability layer ON TOP of the existing 3
-- base roles (admin_profiles.admin_role enum superadmin/reviewer/finance). The
-- base roles stay fully functional; capabilities[] is an additive gate that
-- requireCapability(<key>) checks per request.
--
--   capabilities  text[]  — section capability keys (see config/adminCapabilities.js)
--   active        boolean — soft deactivate; an inactive admin is 403'd
--
-- Backfill preserves current behaviour exactly:
--   superadmin → ALL capability keys (it also bypasses checks in middleware)
--   reviewer   → read / approval / catalogue sections (its current reach)
--   finance    → money sections (its current reach)
-- The key lists below MUST stay in sync with config/adminCapabilities.js
-- (DEFAULT_CAPS_BY_ROLE). superadmin is never locked out: it gets every key
-- here AND short-circuits every capability check in the middleware.
--
-- Additive · idempotent · behaviour-preserving on deploy.
-- ============================================================================

BEGIN;

-- 1. New columns (idempotent).
ALTER TABLE admin_profiles
  ADD COLUMN IF NOT EXISTS capabilities text[] NOT NULL DEFAULT '{}';

ALTER TABLE admin_profiles
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- 2. Backfill by base role. Guarded by `capabilities = '{}'` so re-running
--    the migration never clobbers capabilities an admin has since been
--    granted/edited through the UI. New admins created post-migration are
--    seeded by the controller, not here.

-- superadmin → ALL keys
UPDATE admin_profiles
   SET capabilities = ARRAY[
     'analytics','approvals','brands','influencers','production','orders',
     'master_data','sections','libraries','categories','marketing','referrals',
     'escrow','payouts','returns','subscriptions','tax','pricing','settings','users'
   ]
 WHERE admin_role = 'superadmin'
   AND capabilities = '{}';

-- reviewer → read / approval / catalogue sections
UPDATE admin_profiles
   SET capabilities = ARRAY[
     'analytics','approvals','brands','influencers','production','orders',
     'master_data','sections','libraries','categories','marketing'
   ]
 WHERE admin_role = 'reviewer'
   AND capabilities = '{}';

-- finance → money sections
UPDATE admin_profiles
   SET capabilities = ARRAY[
     'analytics','escrow','payouts','returns','subscriptions','tax'
   ]
 WHERE admin_role = 'finance'
   AND capabilities = '{}';

COMMIT;
