-- 095_drilldown_taxonomy_engine.sql
-- Contract: features/listing-drilldown-taxonomy-engine (the core net-new engine
-- the fashion + furniture verticals ride on). ADDITIVE + idempotent.
--
-- Adds: a variable-depth category tree (category_nodes), a per-leaf typed facet
-- schema (facet_definitions), and queryable facet storage on brand_products
-- (facets jsonb + GIN). Existing flat-schema verticals (restaurant/car/salon)
-- are untouched — category_node_id is nullable; nothing references it until a
-- vertical is migrated to the tree. Fashion/furniture have 0 live products.
--
-- Schema decision (locked): facet VALUES live in brand_products.facets jsonb +
-- GIN index (mirrors variants_json), NOT an EAV table — simpler + filterable.

-- ── 1. Category tree (variable depth; leaf = where facets attach) ──────────────
CREATE TABLE IF NOT EXISTS category_nodes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical       text        NOT NULL,                 -- 'fashion' | 'furniture' | ...
  parent_id      uuid        REFERENCES category_nodes(id) ON DELETE CASCADE,
  segment        text,                                 -- denorm top-level name (e.g. 'Women')
  category       text,                                 -- denorm 2nd-level name (e.g. 'Footwear')
  name           text        NOT NULL,                 -- this node's display name
  slug           text,
  depth          integer     NOT NULL DEFAULT 0,       -- 0=segment, 1=category, 2+=leaf branch
  is_leaf        boolean     NOT NULL DEFAULT false,   -- only leaves accept products
  sort_order     integer     NOT NULL DEFAULT 0,
  size_system    text,                                 -- leaf only: alpha|waist_in|bra|uk_women|age|free_size|...
  variant_axis   text,                                 -- leaf only: 'Size' | 'Color' | 'Age'
  unisex_default boolean     NOT NULL DEFAULT false,
  meta           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_category_nodes_vertical_parent ON category_nodes (vertical, parent_id);
CREATE INDEX IF NOT EXISTS idx_category_nodes_vertical_leaf   ON category_nodes (vertical, is_leaf);
-- A node name is unique among its siblings within a vertical.
CREATE UNIQUE INDEX IF NOT EXISTS uq_category_nodes_sibling
  ON category_nodes (vertical, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

-- ── 2. Per-leaf facet definitions (typed; role; required; allowed values) ──────
-- scope resolution for a leaf = facet.scope IN ('ALL', node.category, node.name)
CREATE TABLE IF NOT EXISTS facet_definitions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical       text        NOT NULL,
  scope          text        NOT NULL,                 -- 'ALL' | category name | leaf name
  facet_key      text        NOT NULL,                 -- slug of label
  label          text        NOT NULL,
  facet_role     text,                                 -- variant|descriptive|discovery|media|price
  input_type     text        NOT NULL,                 -- single_select|multi_select|boolean|number|text|dimension|image_set|price
  required       text        NOT NULL DEFAULT 'optional', -- required|recommended|optional|conditional
  allowed_values jsonb       NOT NULL DEFAULT '[]'::jsonb,
  show_if        jsonb,                                -- {"facet":"Made to order","value":"Yes"} | null
  sort_order     integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_facet_def_scope_key ON facet_definitions (vertical, scope, facet_key);
CREATE INDEX IF NOT EXISTS idx_facet_def_vertical_scope  ON facet_definitions (vertical, scope);

-- ── 3. brand_products: tree link + queryable facet values ─────────────────────
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS category_node_id uuid REFERENCES category_nodes(id);
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS facets jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_brand_products_category_node ON brand_products (category_node_id);
CREATE INDEX IF NOT EXISTS idx_brand_products_facets_gin    ON brand_products USING gin (facets);
