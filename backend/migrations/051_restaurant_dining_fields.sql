-- 051_restaurant_dining_fields.sql
-- Wave 1 of the restaurant Dineout-style refresh.
--
-- Adds brand-level hot fields that previously lived inside
-- brands.listing_data JSONB or didn't exist at all. Moving them to typed
-- columns lets the discovery API filter + sort on them efficiently
-- (vibes filter, cost_for_two range bucket, distance sort via lat/lng).
--
-- All additions are nullable / defaulted. Existing brands continue to work;
-- they fill these fields via the new 9-step listing wizard.
--
-- The amenity + buy-mode booleans default to sensible "most restaurants
-- accept this" values so brand_data.* expressions in BrandActionRow's
-- visible_if don't hide the corresponding CTAs by default.

-- ─── Brand discovery / display fields ────────────────────────────────────────
ALTER TABLE brands ADD COLUMN IF NOT EXISTS vibes              jsonb DEFAULT '[]'::jsonb;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS cost_for_two       integer;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS locality           text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS cover_image_url    text;

-- ─── Hot geo fields (copied from primary branch on save) ─────────────────────
-- Today branches live in brands.listing_data.branches[] JSONB. The primary
-- branch's lat/lng is copied to these columns so the discovery query can
-- ORDER BY haversine(brand.lat, brand.lng, ...) without unpacking JSONB.
ALTER TABLE brands ADD COLUMN IF NOT EXISTS lat                numeric(10,6);
ALTER TABLE brands ADD COLUMN IF NOT EXISTS lng                numeric(10,6);
ALTER TABLE brands ADD COLUMN IF NOT EXISTS formatted_address  text;

-- ─── Amenity booleans (restaurant Dining setup step) ─────────────────────────
ALTER TABLE brands ADD COLUMN IF NOT EXISTS outdoor_seating       boolean DEFAULT false;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS kids_welcome          boolean DEFAULT false;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS wheelchair_accessible boolean DEFAULT false;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS wifi                  boolean DEFAULT false;

-- ─── Buy-mode toggles (restaurant "How followers buy" step) ──────────────────
-- accepts_table_booking already lives in listing_data per the v1.4 schema;
-- we promote it to a column too so discovery filters can use it. The schema
-- default flipped to true last week.
ALTER TABLE brands ADD COLUMN IF NOT EXISTS accepts_table_booking  boolean DEFAULT true;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS pay_at_store_supported boolean DEFAULT true;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS online_order_supported boolean DEFAULT false;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS enquiry_enabled        boolean DEFAULT true;

-- ─── Indexes for the hot discovery paths ─────────────────────────────────────
-- Distance: (category, lat, lng) — supports "find restaurants near me by
-- category" with a bounding-box pre-filter before haversine compute.
CREATE INDEX IF NOT EXISTS idx_brands_category_geo
  ON brands (category, lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Cost bucket filter — single column index is fine, queries rarely combine
-- cost with other range fields.
CREATE INDEX IF NOT EXISTS idx_brands_cost_for_two
  ON brands (cost_for_two)
  WHERE cost_for_two IS NOT NULL;

-- Vibes (GIN for jsonb containment lookups like vibes @> '["rooftop"]')
CREATE INDEX IF NOT EXISTS idx_brands_vibes_gin
  ON brands USING GIN (vibes);

-- Locality search — partial match queries use trigram, but for now a simple
-- btree on lower(locality) supports "= ?" lookups from filter UIs.
CREATE INDEX IF NOT EXISTS idx_brands_locality_lower
  ON brands (LOWER(locality))
  WHERE locality IS NOT NULL;
