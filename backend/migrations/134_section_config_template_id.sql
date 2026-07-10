-- Migration 134 — section_config.template_id (Creator Experience Engine Phase 5)
-- Contract: features/experience-templates/. Decision D2.
--
-- Lets a placed Experience Template own a section_config row. NULL for every
-- existing row (they are unaffected). The new 'experience_template' rule reads
-- this to resolve the template's creator experiences (Phase 6); in Phase 5 it
-- returns empty, so a placed template is hidden until creators fill it.
--
-- Additive + idempotent. Touches no existing row (all keep template_id = NULL).

ALTER TABLE section_config
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES experience_templates(id);

CREATE INDEX IF NOT EXISTS idx_section_config_template
  ON section_config (template_id) WHERE template_id IS NOT NULL;

COMMENT ON COLUMN section_config.template_id IS
  'Experience Template that owns this row (mig 134). NULL = a normal section (unchanged). Set when an admin places a template; rule=experience_template resolves its experiences (Phase 6).';
