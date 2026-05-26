-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 064 — Phase A12.3: flip is_enforced=true on search_filters_advanced
--
-- A12.3 wired the search_filters_advanced feature gate into:
--   • GET /v1/campaigns/:id/influencer-search → blocks tier + min_er params
--   • GET /v1/campaigns/:id/sets/:sid/open-group-matches → blocks tiers[] + min_er
--
-- entitlements.service.hasFeature returns true when is_enforced=false (the
-- gate is a no-op). Flipping this true activates the 422 FEATURE_NOT_AVAILABLE
-- response on plans that don't include search_filters_advanced.
--
-- Idempotent. Forward-only.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE features
   SET is_enforced = true
 WHERE feature_key = 'search_filters_advanced'
   AND is_enforced = false;

COMMIT;
