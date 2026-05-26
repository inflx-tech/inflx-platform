-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 066 — Phase A12.5: flip is_enforced=true on open_group_broadcast
--
-- A12.5 wired the open_group_broadcast feature gates into:
--   • campaign.controller.publish — pre-flight gates (bulk_outreach +
--     open_group_broadcast.max_recipients=0) conditional on any
--     open_group set in the campaign.
--   • materialiseOpenGroupInvites — per-tier cap (max_recipients) +
--     area_scope SQL filter (city / state / all_india).
--
-- entitlements.service.configFor returns {} when is_enforced=false
-- (gate is a no-op, materialise falls back to the legacy 1000 ceiling
-- with no scope filter). Flipping this true activates the per-tier
-- cap + scope filter and the max_recipients=0 entry block.
--
-- A12.5 also corrected the bulk_outreach wiring (verify-twice — A12.4
-- gated the wrong endpoint). M065 + M066 should be applied together
-- so both gates land on the corrected wiring at the same time.
--
-- Idempotent. Forward-only.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE features
   SET is_enforced = true
 WHERE feature_key = 'open_group_broadcast'
   AND is_enforced = false;

COMMIT;
