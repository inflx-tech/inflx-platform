-- ============================================================================
-- Migration 103 — Section Library (Phase 3a)
--   (contract: features/merch-engine-p3a-section-library-engine)
-- ----------------------------------------------------------------------------
-- Reusable, data-driven follower "sections": a section = {business, name, image,
-- rule}. The rule is a filter (sub-category + tags + price + sort) evaluated by
-- the data-driven engine (sectionRules.library_products) over gated brand_products,
-- with surface context (creator/brand/category/city) stacked at render time.
--
-- Additive + DORMANT: nothing renders from this table until a section is placed
-- (contract 3c). Admin authors rows via the rule-builder UI (contract 3b).
-- Idempotent.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS section_library (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type text NOT NULL,                 -- a launch-tile key (fashion/food/...) or 'ALL'
  name          text NOT NULL,                 -- e.g. "Jeans Under ₹499"
  image_url     text,                          -- optional banner/thumb
  rule_json     jsonb NOT NULL DEFAULT '{}'::jsonb,
                -- { subcategory_node_id?: uuid, tags?: text[], price_min?: num,
                --   price_max?: num, sort?: 'newest'|'price_asc'|'price_desc' }
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','hidden')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_section_library_business
  ON section_library (business_type, status);

COMMIT;
