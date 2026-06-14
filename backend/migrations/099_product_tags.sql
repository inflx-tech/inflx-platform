-- ============================================================================
-- Migration 099 — Product Tags + admin tag-vocabulary
--   (contract: features/merch-engine-p1a-product-tags)
-- ----------------------------------------------------------------------------
-- Phase 1a of the merchandising engine. Gives products an optional `tags` list
-- that admin-built Sections/Collections will target in later phases. Two pieces:
--   · brand_products.tags text[] — per-product tags (slugs), GIN-indexed.
--   · tag_vocabulary — admin-owned FIXED tags per business scope; the brand
--     listing picker offers these. Brands may also add free tags (stored in
--     brand_products.tags but absent from the vocabulary — that's expected).
--
-- Additive · idempotent · forward-only. Tags ORGANIZE only — they do NOT make a
-- product visible (the push/allocation gate, Phase 2, governs visibility).
-- Zero backfill: tags defaults to '{}', so nothing changes for existing rows.
-- ============================================================================

BEGIN;

-- ── per-product tags (slugs) ────────────────────────────────────────────────
ALTER TABLE brand_products
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_brand_products_tags_gin
  ON brand_products USING gin (tags);

-- ── tag_vocabulary — admin-owned fixed tags per business scope ───────────────
-- scope = a brand_products.category_key value (the business type) OR 'ALL' for
-- cross-business tags. slug is the normalized key Sections/Collections rule on.
CREATE TABLE IF NOT EXISTS tag_vocabulary (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope       text NOT NULL,
  label       text NOT NULL,
  slug        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','hidden')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, slug)
);

CREATE INDEX IF NOT EXISTS idx_tag_vocabulary_scope
  ON tag_vocabulary (scope, status, sort_order);

COMMIT;
