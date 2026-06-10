-- 096_listing_sku_brands.sql
-- Contract: features/listing-drilldown-taxonomy-engine (Ship 2.1 — SKU + Brand).
-- ADDITIVE + idempotent.
--
-- Adds: per-business identity code + product counter (for auto-SKU), and a
-- brand directory (popular seed + custom capture → future flywheel).
-- brand_products.sku already exists (populated automatically by the batch API);
-- variant pics + per-size stock live in brand_products.variants_json.

-- ── 1. Per-business identity + auto-SKU counter ───────────────────────────────
ALTER TABLE brands ADD COLUMN IF NOT EXISTS store_code  text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS product_seq integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS uq_brands_store_code ON brands (store_code) WHERE store_code IS NOT NULL;

-- ── 2. Brand directory (popular seed + custom; usage feeds a future flywheel) ──
CREATE TABLE IF NOT EXISTS listing_brands (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical    text        NOT NULL DEFAULT 'fashion',
  name        text        NOT NULL,
  source      text        NOT NULL DEFAULT 'seed',     -- 'seed' | 'custom'
  usage_count integer     NOT NULL DEFAULT 0,
  status      text        NOT NULL DEFAULT 'active',    -- 'active' | 'pending' | 'hidden'
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_listing_brands_vertical_name
  ON listing_brands (vertical, lower(name));
CREATE INDEX IF NOT EXISTS idx_listing_brands_vertical ON listing_brands (vertical, status);
