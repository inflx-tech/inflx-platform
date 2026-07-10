-- Migration 131 — design_layouts (Design Library + Layout Contracts)
-- (Creator Experience Engine, Phase 3. Contract: features/design-library/.)
--
-- The visual grammar the Adaptive Renderer (Phase 4) obeys: one row per layout
-- (Hero, Split, Magazine, Story, Bento, Tile, Card, Shelf header…), each with a
-- Layout Contract (contract_json) declaring which slots are required / optional
-- (show if room) / hidden (never). Slots: background, featured_image, avatar,
-- creator_name, title, subtitle, cta, offer_badge, products, price.
--
-- Additive + idempotent. Ships EMPTY (10 layouts seed in 132). Deploy-inert
-- until read by the Design Library screen / the Phase-4 renderer. Does NOT
-- touch the current live section engine.

CREATE TABLE IF NOT EXISTS design_layouts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text NOT NULL UNIQUE,                 -- 'hero_banner', 'story_card', …
  label         text NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('banner','card','frame','structure')),
  aspect_hint   text,                                  -- '16:9' | '1:1' | '9:16' | '4:5' | '3:4' | 'flex'
  contract_json jsonb NOT NULL DEFAULT '{"required":[],"optional":[],"hidden":[]}'::jsonb,
  world_key     text,                                  -- NULL = global; else follower_categories.key
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','hidden')),
  sort_order    int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_design_layouts_world
  ON design_layouts (world_key) WHERE status = 'active';

COMMENT ON TABLE design_layouts IS
  'Design Library (mig 131): layouts + Layout Contracts (contract_json required/optional/hidden slots). The visual grammar the Adaptive Renderer (Phase 4) obeys. world_key NULL = global.';
