-- 087_dish_search_flywheel.sql
-- Contract: features/listing-restaurant-search-flywheel
-- ADDITIVE ONLY. No drops, no type changes, no data rewrites.
--
-- Adds: fuzzy-search extensions, master_dishes.popularity_rank,
-- dish_aliases (regional/typo -> canonical), pending_dishes (the
-- custom-name flywheel queue). Existing 129 master_dishes rows and all
-- brand_products are untouched.

-- ── Fuzzy / transliteration search ───────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ── Popularity rank on the canonical dictionary ──────────────────────────────
ALTER TABLE master_dishes
  ADD COLUMN IF NOT EXISTS popularity_rank integer NOT NULL DEFAULT 0;

-- trigram index for fuzzy name search (seller typeahead + admin queue match)
CREATE INDEX IF NOT EXISTS idx_master_dishes_name_trgm
  ON master_dishes USING gin (name gin_trgm_ops);

-- ── dish_aliases: regional names / spellings that map to a canonical dish ─────
CREATE TABLE IF NOT EXISTS dish_aliases (
  id              bigserial PRIMARY KEY,
  master_dish_id  integer NOT NULL REFERENCES master_dishes(id) ON DELETE CASCADE,
  alias_text      text NOT NULL,
  source          text NOT NULL DEFAULT 'admin' CHECK (source IN ('admin','promotion','seller')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (master_dish_id, alias_text)
);
CREATE INDEX IF NOT EXISTS idx_dish_aliases_text_trgm
  ON dish_aliases USING gin (alias_text gin_trgm_ops);

-- ── pending_dishes: custom names sellers typed that aren't canonical yet ──────
-- raw_name = seller's verbatim words; norm_name = unaccent(lower(trim)) collapsed
-- whitespace (computed in app at insert). One row per brand_product (dedupe).
CREATE TABLE IF NOT EXISTS pending_dishes (
  id                        bigserial PRIMARY KEY,
  brand_id                  uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  brand_product_id          uuid REFERENCES brand_products(id) ON DELETE CASCADE,
  raw_name                  text NOT NULL,
  norm_name                 text NOT NULL,
  section                   varchar(80),
  suggested_master_dish_id  integer REFERENCES master_dishes(id) ON DELETE SET NULL,
  suggested_score           numeric(4,3),
  status                    text NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','alias','promoted','rejected')),
  resolver                  text,
  resolved_at               timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_dishes_status ON pending_dishes(status);
CREATE INDEX IF NOT EXISTS idx_pending_dishes_norm   ON pending_dishes(norm_name);
-- one pending row per listing (re-saving the same product won't duplicate)
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_dishes_brand_product
  ON pending_dishes(brand_product_id) WHERE brand_product_id IS NOT NULL;
