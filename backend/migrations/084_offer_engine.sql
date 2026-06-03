-- ============================================================================
-- Migration 084 — Offer Engine foundation (Sub-contract A)
-- ----------------------------------------------------------------------------
-- Promotes "offer" from a campaign-child to a brand-owned, catalogue-scoped,
-- REUSABLE library object. This is the SPINE only:
--   · brand_offers           — the library (reuses offer.service.js config shapes)
--   · campaign_influencers.*  — additive provenance + allocation columns (DORMANT
--                               until Sub-contract C writes them)
--   · brand_offers store cols — additive publish-to-store columns (DORMANT until
--                               Sub-contract D reads them)
--
-- Coexists with the existing in-campaign discount builder (campaign_offers +
-- campaign_influencers.offer_type/offer_config_json) — nothing here disturbs it.
--
-- Additive · idempotent · forward-only. DORMANT on deploy: with zero brand_offers
-- rows and no caller wiring, no existing flow changes until B/C/D land (same
-- dormant-ship pattern as migration 078 referral-engine).
-- Contract: features/offer-engine/.
-- ============================================================================

BEGIN;

-- ── brand_offers — a brand's reusable, catalogue-scoped offer ────────────────
CREATE TABLE IF NOT EXISTS brand_offers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id           uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name               varchar(150) NOT NULL,
  offer_type         text NOT NULL
                     CHECK (offer_type IN ('discount','volume','bogo','bundle','free_gift')),
  -- The exact shape resolveOfferDiscount() consumes (offer.service.js header).
  offer_config_json  jsonb NOT NULL,
  availing_modes     text[] NOT NULL DEFAULT '{pay_at_store,online_order}',
  status             text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','active','archived')),
  -- Publish-to-store (Channel ①) — DORMANT until Sub-contract D consumes them.
  published_to_store boolean NOT NULL DEFAULT false,
  store_starts_at    timestamptz,
  store_ends_at      timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_offers_brand
  ON brand_offers (brand_id, status);

-- ── campaign_influencers — additive attach columns (DORMANT until Sub-contract C)
-- brand_offer_id: provenance pointer back to the library row. The offer CONFIG is
-- still snapshotted into the existing offer_type/offer_config_json columns at
-- attach time, so editing a library offer never mutates a live attachment.
-- ON DELETE SET NULL: archiving/removing a library row leaves the snapshot intact.
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS brand_offer_id uuid REFERENCES brand_offers(id) ON DELETE SET NULL;

-- allocation: how this offer is allocated for the influencer.
--   'commissioned' (conversion) → tracked link + commission
--   'promotional'  (engagement) → no commission, no tracking; awareness only
-- NULL on every existing row → no behaviour change.
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS allocation text
  CHECK (allocation IS NULL OR allocation IN ('commissioned','promotional'));

COMMIT;
