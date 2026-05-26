-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 067 — Phase A12.6: flip is_enforced=true on multi_branch_support
--
-- A12.6 wired the multi_branch_support feature gate into:
--   • brand.controller.updateMe — pre-flight check on
--     PATCH /v1/brands/me that compares the patch's
--     listing_data.branches length against the existing count on the
--     brand row. Fires requireFeature(multi_branch_support) only when
--     the patch is ADDING branches beyond the existing count AND the
--     resulting list has > 1 entries.
--
-- entitlements.service.requireFeature returns silently when is_enforced=false
-- (gate is a no-op). Flipping this true activates the 422 FEATURE_NOT_AVAILABLE
-- response on plans that don't include multi_branch_support.
--
-- Grandfathered: existing brands with > 1 branches saved are not
-- retroactively blocked from editing other fields; the gate only fires
-- on increase.
--
-- Idempotent. Forward-only.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE features
   SET is_enforced = true
 WHERE feature_key = 'multi_branch_support'
   AND is_enforced = false;

COMMIT;
