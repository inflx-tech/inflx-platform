-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 063 — Phase A12.2: flip is_enforced=true on discover_filter feature
--
-- A12.2 wired the discover_filter feature gate into:
--   • GET /v1/campaigns/:id/influencer-search → filters by area_scope (city/state/all_india)
--   • GET /v1/campaigns/:id/sets/:sid/open-group-matches → area_scope + niches_limit
--
-- The entitlements.service.configFor helper honours is_enforced (returns {}
-- if false). Flipping this true switches the gate from defensive-pass-through
-- to actually enforcing the area_scope + niches_limit configured per tier
-- in Section C of /admin/pricing/tiers/[tier_key].
--
-- Idempotent. Forward-only.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE features
   SET is_enforced = true
 WHERE feature_key = 'discover_filter'
   AND is_enforced = false;

COMMIT;
