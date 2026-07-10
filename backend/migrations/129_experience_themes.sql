-- Migration 129 — experience_themes (Theme Library)
-- (Creator Experience Engine, Phase 2. Contract: features/theme-library/.)
--
-- A Theme is a business definition, not a title: shopping logic (categories,
-- product counts), media rules, offer eligibility, default copy, and a visual
-- identity (a Phase-1 design_preset). Admin authors themes as a curator,
-- starting from a Blueprint (is_blueprint=true seed rows, migration 130) and
-- editing the delta. Themes become platform masters the creator Experience
-- Studio (Phase 6) will offer.
--
-- Additive + idempotent. Ships EMPTY (blueprints seed in 130). Deploy-inert
-- until an admin authors/publishes. Nothing on the follower app reads this yet.

CREATE TABLE IF NOT EXISTS experience_themes (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_key              text NOT NULL,                       -- follower_categories.key, e.g. 'fashion'
  key                    text NOT NULL,                       -- slug, e.g. 'street_style'
  name                   text NOT NULL,
  subtitle               text,
  icon                   text,
  description            text,
  purpose                text,                                -- lifestyle|travel|occasion|seasonal|budget|trend|category|offer|editorial
  audience               text,                                -- men|women|unisex|kids
  preset_key             text REFERENCES design_presets(key), -- visual identity (Phase 1); NULL allowed
  supported_categories   jsonb NOT NULL DEFAULT '[]'::jsonb,  -- array of category labels/keys (curated at author time)
  min_products           int  NOT NULL DEFAULT 4,
  max_products           int  NOT NULL DEFAULT 20,
  media_rules_json       jsonb NOT NULL DEFAULT '{"featured":"required","video":"optional","orientation":"portrait"}'::jsonb,
  supported_offer_types  text[] NOT NULL DEFAULT '{}',        -- discount|volume|bogo|bundle|free_gift
  suggested_product_ids  jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_title          text,
  default_subtitle       text,
  default_cta            text,
  applicable_worlds      text[] NOT NULL DEFAULT '{}',
  is_blueprint           boolean NOT NULL DEFAULT false,      -- seeded starter (migration 130)
  blueprint_source_key   text,                                -- which blueprint an authored theme was cloned from
  status                 text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  -- a blueprint and an authored theme may share a key; two authored themes may not.
  UNIQUE (world_key, key, is_blueprint)
);

CREATE INDEX IF NOT EXISTS idx_experience_themes_world_status
  ON experience_themes (world_key, status) WHERE is_blueprint = false;

CREATE INDEX IF NOT EXISTS idx_experience_themes_blueprints
  ON experience_themes (world_key) WHERE is_blueprint = true;

COMMENT ON TABLE experience_themes IS
  'Theme Library (mig 129): themes as business definitions (categories/counts/media/offers/copy + a design_preset). is_blueprint=true rows are seeded starters. Consumed by Experience Templates (Phase 5) + creator Experiences (Phase 6).';
