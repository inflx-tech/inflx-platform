-- Migration 127 — Design System: tokens + presets
-- (Creator Experience Engine, Phase 1. Contract: features/design-system-tokens/.)
--
-- The curated visual vocabulary an admin PICKS from — moods, palettes,
-- typography, backgrounds, radius, shadow — plus named preset bundles. The
-- admin is a curator, not a designer: no artwork upload, no color picker.
-- Consumed by the Theme wizard (Phase 2) and, eventually, the Adaptive
-- Renderer (Phase 4).
--
-- Additive + idempotent (CREATE TABLE IF NOT EXISTS). Ships EMPTY — the
-- Fashion starter catalog lands in migration 128. Deploy-inert until seeded
-- and the admin Design System screen reads it. Safe to re-run.

CREATE TABLE IF NOT EXISTS design_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL
              CHECK (kind IN ('mood','palette','typography','background','radius','shadow')),
  key         text NOT NULL,                       -- stable slug, e.g. 'urban_dark'
  label       text NOT NULL,                       -- admin-facing, e.g. 'Urban Dark'
  world_key   text,                                -- NULL = global; else follower_categories.key
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,  -- kind-specific payload (see 03_TOKEN_CATALOG.md)
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','hidden')),
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, key)
);

CREATE INDEX IF NOT EXISTS idx_design_tokens_kind_world
  ON design_tokens (kind, world_key) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS design_presets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key            text NOT NULL UNIQUE,                 -- 'urban_fashion'
  label          text NOT NULL,                        -- 'Urban Fashion'
  world_key      text,                                 -- NULL = global; else world key
  tokens_json    jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {mood,palette,typography,background,radius,shadow} → token keys
  positions_json jsonb NOT NULL DEFAULT '{}'::jsonb,   -- preferred slot positions (contract overrides per size)
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active','hidden')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_design_presets_world
  ON design_presets (world_key) WHERE status = 'active';

COMMENT ON TABLE design_tokens IS
  'Design-system atoms (mig 127): mood/palette/typography/background/radius/shadow. Curated vocabulary for the Theme wizard. world_key NULL = global.';
COMMENT ON TABLE design_presets IS
  'Named token bundles (mig 127): a Theme starts from a preset. tokens_json references design_tokens keys.';
