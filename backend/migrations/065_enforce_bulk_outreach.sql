-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 065 — Phase A12.4: flip is_enforced=true on bulk_outreach
--
-- A12.4 wired the bulk_outreach feature gate into:
--   • POST /v1/campaigns/:id/sets/:sid/publish-open (publishOpenGroup)
--
-- entitlements.service.requireFeature returns silently when is_enforced=false
-- (gate is a no-op). Flipping this true activates the 422 FEATURE_NOT_AVAILABLE
-- response on plans that don't include bulk_outreach.
--
-- Idempotent. Forward-only.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE features
   SET is_enforced = true
 WHERE feature_key = 'bulk_outreach'
   AND is_enforced = false;

COMMIT;
