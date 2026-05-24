-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 060 — Phase A9: features list per subscription tier
--
-- Adds `features_json` (jsonb array of strings) to subscription_tiers so
-- admin can list, under each tier, the bullet features a brand gets on
-- that plan. Distinct from the 4 numeric quota columns (max_campaigns
-- etc.) which the backend uses to gate mutations.
--
-- Phase 1 (this migration): features_json is DISPLAY-ONLY. Admin edits
-- it, brand sees it on /dashboard/settings/subscription. No code reads it
-- for gating.
--
-- Phase 2 (future, founder-paced): wire individual features to actual
-- enforcement (e.g. "REST API access" gates the API key endpoint).
-- One small contract per feature.
--
-- Idempotent. Additive only.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE subscription_tiers
  ADD COLUMN IF NOT EXISTS features_json jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN subscription_tiers.features_json IS
  'JSON array of feature bullet strings shown to brands on the upgrade page. Display-only in Phase A9; admin-editable via /admin/pricing/tiers.';

-- Seed bullets on the 4 existing tier rows. Founder-confirmed 2026-05-24:
-- Free: 5 bullets · Growth: 5 bullets · Pro: 5 bullets · Enterprise: 5 bullets.
-- Only updates rows whose features_json is still empty (re-run safety —
-- once admin edits via UI, this migration won't overwrite).

UPDATE subscription_tiers
   SET features_json = '[
     "Browse + discover influencers",
     "1 campaign at a time",
     "10 product listings",
     "Self-serve onboarding",
     "Email support"
   ]'::jsonb
 WHERE tier_key = 'free'
   AND features_json = '[]'::jsonb;

UPDATE subscription_tiers
   SET features_json = '[
     "Everything in Free",
     "Bulk influencer outreach",
     "Email templates",
     "Campaign analytics",
     "Priority email support"
   ]'::jsonb
 WHERE tier_key = 'growth'
   AND features_json = '[]'::jsonb;

UPDATE subscription_tiers
   SET features_json = '[
     "Everything in Growth",
     "Advanced analytics + revenue reports",
     "WhatsApp templates",
     "Custom reports",
     "Dedicated onboarding call"
   ]'::jsonb
 WHERE tier_key = 'pro'
   AND features_json = '[]'::jsonb;

UPDATE subscription_tiers
   SET features_json = '[
     "Everything in Pro",
     "Dedicated Customer Success Manager",
     "REST API access",
     "Custom integrations",
     "24x7 phone support"
   ]'::jsonb
 WHERE tier_key = 'enterprise'
   AND features_json = '[]'::jsonb;

COMMIT;
