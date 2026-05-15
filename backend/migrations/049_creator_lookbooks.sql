-- Migration 049: creator_lookbooks + lookbook_products — Fashion-2 surface
-- for creator-curated outfit/edit cards ("Aman's summer essentials").
--
-- A lookbook is owned by an influencer. It bundles N products (optionally
-- specific variants the creator was wearing) into a single curated grid.
-- Followers tap a lookbook card → see the full look → tap into individual
-- products → buy with attribution credited to the creator.
--
-- The visibility column lets creators draft a lookbook (visibility='unlisted'
-- or 'draft') before publishing. V1 only uses 'public' and 'unlisted'; the
-- value space is intentionally permissive for future states.
--
-- product_count is denormalized for cheap list-view sorting and display
-- ("3-product look" badge). Maintained via trigger OR via the application
-- layer's lookbook-products add/remove endpoints. V1 uses the app layer.
--
-- No UNIQUE constraint on (lookbook_id, product_id, variant_id) by design:
-- a creator might tag the same shirt twice (different angles, different
-- captions). Duplicates are rare and harmless; admin/creator UI prevents
-- them at the input layer.
--
-- Additive only.

CREATE TABLE IF NOT EXISTS creator_lookbooks (
  id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id      uuid          NOT NULL REFERENCES influencers(id),
  title              text          NOT NULL,
  description        text,
  cover_image_url    text,
  is_active          boolean       DEFAULT true,
  visibility         text          DEFAULT 'public',   -- 'public' | 'unlisted' | 'draft'
  product_count      integer       DEFAULT 0,
  created_at         timestamptz   DEFAULT now(),
  updated_at         timestamptz   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lookbook_products (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  lookbook_id     uuid          NOT NULL REFERENCES creator_lookbooks(id) ON DELETE CASCADE,
  product_id      uuid          NOT NULL REFERENCES brand_products(id),
  variant_id      uuid          REFERENCES product_variants(id),
  display_order   integer       DEFAULT 0,
  creator_note    text,                                   -- "wearing M in this", "perfect for monsoons"
  created_at      timestamptz   DEFAULT now()
);

-- Lookups
CREATE INDEX IF NOT EXISTS idx_creator_lookbooks_influencer
  ON creator_lookbooks (influencer_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_lookbook_products_lookbook
  ON lookbook_products (lookbook_id, display_order);

CREATE INDEX IF NOT EXISTS idx_lookbook_products_product
  ON lookbook_products (product_id);
