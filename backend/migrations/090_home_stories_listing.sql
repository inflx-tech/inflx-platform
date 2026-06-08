-- 090 — Home "Stories" → listing/activity-driven so creators appear without a
-- materialized campaign_offer.
--
-- Founder report 2026-06-08: the Home influencer-stories carousel was empty even
-- though creators (e.g. Sagar Joshi) are active. Root cause (verified vs prod):
-- the `stories` rule is offer/follow-gated (needs a campaign_offers row or a
-- follow), but there are 0 campaign_offers platform-wide (offer intent lives at
-- set level as coupon_prefix, never materialized) and 0 follows → 0 stories.
-- Sagar shows on the Category screen because that rule is picks-based.
--
-- Re-point Home's "Stories" shelf at the new offer-independent `creators_listing`
-- rule (sectionRules.service.js): a creator shows when followed OR has a live
-- offer OR has picks on active products of approved brands. The ● LIVE ring still
-- only lights when a real live offer exists. Idempotent (UPDATE by shelf_key).
-- No schema change.

UPDATE section_config
   SET rule = 'creators_listing',
       config_json = jsonb_set(
         COALESCE(config_json, '{}'::jsonb),
         '{sub}', '"creators you follow + active creators"'::jsonb, true)
 WHERE screen = 'home' AND shelf_key = 'stories';
