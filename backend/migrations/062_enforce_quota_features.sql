-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 062 — Phase A12.1: flip is_enforced=true on the 4 quota features
--
-- The quotaCheck middleware in Phase A4 enforced max_campaigns,
-- max_sets_per_campaign, max_influencers_per_cycle, max_products via the
-- legacy columns on subscription_tiers. Phase A12.1 migrates the
-- middleware to read from tier_features (the same surface admin edits in
-- /admin/pricing/tiers/[tier_key] Section C).
--
-- The features were seeded with is_enforced=false in M061 (display-only).
-- This migration flips them to true so the admin tier editor shows the
-- "✓ ENFORCED" badge for these 4 features, consistent with their actual
-- runtime behaviour.
--
-- Note: the middleware refactor reads tier_features.quota_value regardless
-- of is_enforced (quota gates have always been "real"). is_enforced is a
-- visibility/auditing flag — flipping it true after the code change keeps
-- catalog state truthful.
--
-- Idempotent. Forward-only.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE features
   SET is_enforced = true
 WHERE feature_key IN (
         'active_campaigns',
         'sets_per_campaign',
         'products_in_store',
         'invitations_per_cycle'
       )
   AND is_enforced = false;

COMMIT;
