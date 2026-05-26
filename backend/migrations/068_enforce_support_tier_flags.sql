-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 068 — Phase A12.7: flip is_enforced=true on the two support-tier
-- features (informational-only — no runtime gate exists for either).
--
-- dedicated_onboarding_call → catalog row for "Dedicated onboarding call".
--   Real-world meaning: a one-on-one onboarding call with the INFLX team
--   at sign-up. Delivered manually by the founder / ops team. Pro and
--   Enterprise tiers include it; Free and Growth don't.
--
-- phone_support_24x7 → catalog row for "24x7 phone support".
--   Real-world meaning: 24x7 phone support hotline. A staffing / SLA
--   commitment, not a code feature. Enterprise only.
--
-- Neither feature has a backend controller / entitlements check / frontend
-- gate. The catalog rows exist to drive the per-tier inclusion bullets on
-- the brand-facing Subscription page (via listTiers + entitlements[]).
--
-- This migration flips is_enforced=true purely for catalog consistency on
-- the admin Features page (/admin/pricing/features) so all 10 software-
-- enforceable rules + these 2 human-delivered support tiers uniformly
-- show enforced=yes. The baseline self_serve_onboarding row intentionally
-- stays is_enforced=false (it's a baseline, no gate possible).
--
-- Idempotent. Forward-only. Single UPDATE.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE features
   SET is_enforced = true
 WHERE feature_key IN ('dedicated_onboarding_call', 'phone_support_24x7')
   AND is_enforced = false;

COMMIT;
