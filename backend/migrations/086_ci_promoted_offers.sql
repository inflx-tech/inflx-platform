-- ============================================================================
-- Migration 086 — Engagement promoted offers (Offer Engine, multi-select)
-- ----------------------------------------------------------------------------
-- Engagement campaigns are promotional: a creator can feature SEVERAL of the
-- brand's saved offers (no commission, no coupon). The single brand_offer_id
-- (084) holds at most one offer — fine for conversion (one coupon/commission),
-- but engagement needs a LIST. Add a nullable uuid[] for the promoted set.
--
-- Additive · idempotent. DORMANT until the wizard's engagement multi-select +
-- invite/update wiring populate it. Conversion/hybrid keep using brand_offer_id.
-- Contract: features/offer-engine-engagement-multi/.
-- ============================================================================

BEGIN;

ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS promoted_brand_offer_ids uuid[];

COMMIT;
