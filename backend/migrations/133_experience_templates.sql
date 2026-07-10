-- Migration 133 — experience_templates (Creator Experience Engine Phase 5)
-- Contract: features/experience-templates/.
--
-- An Experience Template assembles the reusable parts into a placeable unit:
-- Theme (P2) + Design layout (P3) + Section Style + placement + rules. Placing
-- a template writes a section_config row (rule='experience_template', migration
-- 134 adds the template_id column) so it flows through the existing section
-- engine. A placed template renders EMPTY until creators publish experiences
-- (Phase 6) — the live follower home is unchanged in Phase 5.
--
-- Additive + idempotent. Ships EMPTY. Deploy-inert until an admin creates/places.

CREATE TABLE IF NOT EXISTS experience_templates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_key           text NOT NULL,
  key                 text NOT NULL,
  name                text NOT NULL,
  template_type       text NOT NULL DEFAULT 'creator' CHECK (template_type IN ('creator','automatic','mixed')),
  theme_key           text,                                       -- experience_themes.key (NULL for pure automatic)
  design_layout_key   text REFERENCES design_layouts(key),       -- design_layouts.key
  section_style       text NOT NULL DEFAULT 'carousel',          -- carousel|grid|masonry|collage|story_rail|tabs|bento|split|hero|magazine
  placement_json      jsonb NOT NULL DEFAULT '{"screens":["home"],"audiences":["all"]}'::jsonb,
  store_rule          text NOT NULL DEFAULT 'if_products' CHECK (store_rule IN ('always','if_products','manual')),
  creator_store_rule  text NOT NULL DEFAULT 'if_creator_has_experience' CHECK (creator_store_rule IN ('always','if_creator_has_experience','hidden')),
  location_priority   text[] NOT NULL DEFAULT '{city,state,country,global}',
  status              text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','placed','archived')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (world_key, key)
);

CREATE INDEX IF NOT EXISTS idx_experience_templates_world_status
  ON experience_templates (world_key, status);

COMMENT ON TABLE experience_templates IS
  'Experience Templates (mig 133): Theme + Design + Section Style + placement/rules. Place → writes a section_config row (rule=experience_template). Renders empty until creator experiences exist (Phase 6).';
