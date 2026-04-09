-- Migration 013: Listing Engine Foundation
-- Additive only — no column drops or table drops.

-- ── Brand listing score (cached quality score) ──────────────────────────────
ALTER TABLE brands ADD COLUMN IF NOT EXISTS listing_score INTEGER DEFAULT 0;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS listing_score_updated_at TIMESTAMPTZ;

-- ── Super-category on products (for category browsing) ──────────────────────
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS super_category VARCHAR(30);

-- ── Listing data (brand-level metadata from listing wizard steps) ────────────
ALTER TABLE brands ADD COLUMN IF NOT EXISTS listing_data JSONB DEFAULT '{}';

-- ── Performance indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_brand_products_super_category
  ON brand_products (super_category) WHERE super_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_brands_listing_score
  ON brands (listing_score DESC);

CREATE INDEX IF NOT EXISTS idx_brands_category
  ON brands (category);
