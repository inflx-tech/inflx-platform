-- Migration 047: product_variants — SKU-level variant tracking for fashion
-- (and any other category that needs size × color × stock).
--
-- Fashion is the trigger but the table is intentionally generic. Future
-- categories with variant matrices (footwear, eyewear with prescription
-- variants, jewellery with metal-purity variants) can use the same table
-- without further migrations.
--
-- Data model:
--   · One row = one SKU. Brand decides which attributes matter (size,
--     color, both, or just stock variation).
--   · price_override is nullable — when null, the SKU sells at the parent
--     brand_products.price. When set, overrides for that SKU.
--   · stock is per-SKU; brand_products.stock becomes the aggregate (sum
--     of variants.stock) only if variants exist, else stays authoritative.
--   · image_url per-SKU for color-specific photos (red shirt vs blue
--     shirt). Optional.
--   · sku is a brand-supplied identifier (e.g. "TSHIRT-M-RED"); unique
--     across the platform when present.
--
-- Cascade delete from brand_products: deactivating a product nukes its
-- variants atomically. Returns referencing a variant carry the variant_id
-- as a snapshot — the FK there is RESTRICT to prevent loss of audit trail.
--
-- Additive only. brand_products.stock semantics unchanged; the variant
-- table is opt-in per product.

CREATE TABLE IF NOT EXISTS product_variants (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        uuid          NOT NULL REFERENCES brand_products(id) ON DELETE CASCADE,
  size              text,                                     -- 'S' | 'M' | 'L' | 'XL' | '32' | etc. or null
  color             text,                                     -- 'Red' | 'Blue' | 'Black' or null
  sku               text,                                     -- brand-defined; UNIQUE when present
  price_override    numeric(10,2),                            -- null = use brand_products.price
  stock             integer       DEFAULT 0,                  -- 0 = out of stock, null = unlimited
  image_url         text,                                     -- variant-specific photo
  is_active         boolean       DEFAULT true,
  created_at        timestamptz   DEFAULT now()
);

-- Partial unique on SKU — only enforces when SKU is provided
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_variants_sku
  ON product_variants (sku) WHERE sku IS NOT NULL;

-- Lookup by product, scoped to active variants
CREATE INDEX IF NOT EXISTS idx_product_variants_product
  ON product_variants (product_id) WHERE is_active = true;

-- Return policy declaration per product. Fashion needs this; defaults to 0
-- for everything else (no returns supported today). Brand can override
-- per-product in the wizard.
ALTER TABLE brand_products
  ADD COLUMN IF NOT EXISTS return_policy_days integer DEFAULT 0;
