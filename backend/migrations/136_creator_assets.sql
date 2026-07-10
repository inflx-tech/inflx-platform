-- Migration 136 — creator_assets + creator_product_images
-- (Creator Experience Engine Phase 7a. Contract: features/creator-imagery/. Decision D §E.)
--
-- Per-context creator imagery: a creator shoots real product photos (Asset
-- Bank), tags them to products, the brand approves. Then a product shows
-- different images by context (creator's own store = own shots; brand store =
-- brand's choice). Everything is FLAG-GATED (CREATOR_IMAGERY, default off) at
-- the resolver — these tables just hold data until enabled per brand.
--
-- Additive + idempotent. Ships EMPTY. Reuses the R2 upload + deliverable-approval patterns.

CREATE TABLE IF NOT EXISTS creator_assets (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id          uuid NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  campaign_influencer_id uuid REFERENCES campaign_influencers(id) ON DELETE SET NULL,
  deliverable_id         uuid REFERENCES deliverables(id) ON DELETE SET NULL,
  r2_key                 text NOT NULL,                         -- from the existing upload flow
  media_type             text,                                  -- image/jpeg, image/png…
  aspect                 text CHECK (aspect IS NULL OR aspect IN ('landscape','portrait','square')),
  status                 text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by            uuid,
  approved_at            timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_creator_assets_influencer ON creator_assets (influencer_id, status);

-- An approved shot bound to a product (one creator may have several per product).
CREATE TABLE IF NOT EXISTS creator_product_images (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES brand_products(id) ON DELETE CASCADE,
  asset_id      uuid NOT NULL REFERENCES creator_assets(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (influencer_id, product_id, asset_id)
);
-- hot path: an approved shot for (creator, product)
CREATE INDEX IF NOT EXISTS idx_creator_product_images_lookup
  ON creator_product_images (product_id, influencer_id) WHERE status = 'approved';

COMMENT ON TABLE creator_assets IS
  'Creator Asset Bank (mig 136): approved creator photos, reusable across experiences. FLAG-GATED (CREATOR_IMAGERY) at resolveProductImage — inert until enabled per brand.';
