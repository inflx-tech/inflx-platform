-- 113 — Food World Phase 1: dish customisation data model.
--
-- ONE unified model for BOTH variations and add-on groups:
--   * a VARIATION group  (selection_type='single', is_variation=true,
--     is_required=true) — e.g. "Portion": Half / Full. The chosen item's
--     price is the ABSOLUTE base price of the line (Half=70, Full=114).
--   * an ADD-ON group    (selection_type='multi', is_variation=false) — e.g.
--     "Accompaniment select up to 2": Roti +15, Coke +40. Each chosen item's
--     price is a +DELTA added on top of the base.
-- Live total (UI + order) = chosen variation price (or product base if no
-- variation) + Σ chosen add-on prices.
--
-- Forward-only, ADDITIVE, IDEMPOTENT (CREATE TABLE IF NOT EXISTS / ADD COLUMN
-- IF NOT EXISTS). Safe to re-run. No existing table/column altered or dropped.
-- Highest prior migration = 112; next free slot = 113 (verified).
--
-- Owner-owned: a restaurant owner defines these in the Phase-2 product editor.
-- Admin is NOT involved in per-dish authoring (founder decision 2026-06-21).
-- Restaurant ETA + free-delivery flag ride in brands.listing_data (jsonb) —
-- consistent with existing cuisines/cost_for_two/locality — so NO brands ALTER.

-- ── Add-on / variation GROUPS (one row per group on a dish) ──────────────────
CREATE TABLE IF NOT EXISTS product_addon_groups (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     uuid NOT NULL REFERENCES brand_products(id) ON DELETE CASCADE,
  name           text NOT NULL,                       -- "Portion" | "Accompaniment" | "Beverage"
  selection_type varchar(8) NOT NULL DEFAULT 'multi'  -- 'single' (radio) | 'multi' (checkboxes)
                 CHECK (selection_type IN ('single','multi')),
  is_variation   boolean NOT NULL DEFAULT false,      -- true → chosen item SETS the base price (Half/Full)
  is_required    boolean NOT NULL DEFAULT false,      -- must pick at least min_select
  min_select     int NOT NULL DEFAULT 0,
  max_select     int,                                 -- NULL = unlimited; "select up to N" = N
  sort_order     int NOT NULL DEFAULT 0,              -- on-screen order (add-ons → Half/Full per dish)
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_addon_groups_product
  ON product_addon_groups (product_id, sort_order);

-- ── Add-on / variation ITEMS (the options inside a group) ────────────────────
CREATE TABLE IF NOT EXISTS product_addon_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id          uuid NOT NULL REFERENCES product_addon_groups(id) ON DELETE CASCADE,
  name              text NOT NULL,                    -- "Half" | "Full" | "Roti" | "Coke"
  price             numeric(10,2) NOT NULL DEFAULT 0, -- rupees. variation=ABSOLUTE base; add-on=+DELTA
  source_product_id uuid REFERENCES brand_products(id) ON DELETE SET NULL, -- set when owner "pulled from menu"
  is_default        boolean NOT NULL DEFAULT false,   -- preselect (e.g. Full)
  is_active         boolean NOT NULL DEFAULT true,
  sort_order        int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_addon_items_group
  ON product_addon_items (group_id, sort_order);

-- ── Dish display columns ─────────────────────────────────────────────────────
-- badge       — owner-set label ("Popular", "Chef's Special"); NULL = none.
-- is_featured — dish shows in THIS restaurant's Type-B "famous dishes" carousel.
-- featured_sort — order within that carousel.
ALTER TABLE brand_products
  ADD COLUMN IF NOT EXISTS badge         text,
  ADD COLUMN IF NOT EXISTS is_featured   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_sort int NOT NULL DEFAULT 0;

-- Per-restaurant featured-dish carousel lookup (Type B).
CREATE INDEX IF NOT EXISTS idx_brand_products_featured
  ON brand_products (brand_id, featured_sort)
  WHERE is_featured = true;

COMMENT ON TABLE  product_addon_groups IS 'Food World P1 — unified variation (single/is_variation) + add-on (multi) groups per dish. Owner-authored.';
COMMENT ON TABLE  product_addon_items  IS 'Food World P1 — options in a group. variation item price = absolute base; add-on item price = +delta.';
COMMENT ON COLUMN brand_products.badge        IS 'Food World P1 — owner-set dish badge label (e.g. Popular). NULL = none.';
COMMENT ON COLUMN brand_products.is_featured  IS 'Food World P1 — dish appears in this restaurant''s Type-B famous-dishes carousel.';
COMMENT ON COLUMN brand_products.featured_sort IS 'Food World P1 — order within the featured carousel.';
