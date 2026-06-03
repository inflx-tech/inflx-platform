-- ============================================================================
-- Migration 085 — Offer Engine store-direct provenance (Sub-contract D, Phase 1)
-- ----------------------------------------------------------------------------
-- Adds the columns the store-direct purchase path (D2) will write, so a follower
-- transaction can be attributed to a brand_offers row with NO influencer:
--   · follower_transactions.brand_offer_id — which library offer was availed
--   · follower_transactions.offer_source   — 'influencer' (default, existing) | 'store'
--
-- The 4 tracking IDs (campaign_id/set_id/campaign_influencer_id/offer_id) are
-- ALREADY nullable (migration 001), so no relaxation is needed. This migration
-- is purely additive + idempotent. DORMANT: no writer until D2's store-direct
-- endpoints; existing transactions get offer_source='influencer' by default.
-- Contract: features/offer-engine-store-publish/.
-- (brand_offers.published_to_store / store_starts_at / store_ends_at already
--  exist from migration 084.)
-- ============================================================================

BEGIN;

ALTER TABLE follower_transactions
  ADD COLUMN IF NOT EXISTS brand_offer_id uuid REFERENCES brand_offers(id) ON DELETE SET NULL;

ALTER TABLE follower_transactions
  ADD COLUMN IF NOT EXISTS offer_source text NOT NULL DEFAULT 'influencer'
  CHECK (offer_source IN ('influencer', 'store'));

CREATE INDEX IF NOT EXISTS idx_follower_tx_brand_offer
  ON follower_transactions (brand_offer_id)
  WHERE brand_offer_id IS NOT NULL;

COMMIT;
