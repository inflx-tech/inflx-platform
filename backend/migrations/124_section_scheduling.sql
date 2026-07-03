-- Migration 124 — Section scheduling (Cleanup P1, features/section-scheduling/).
--
-- Adds a live-window to admin-composed sections (Docs/SECTION_SYSTEM_SPEC.md
-- §4.1, founder decisions #4): the engine serves a shelf only while
-- starts_at <= now() < ends_at. NULL = no bound, so every existing row keeps
-- exactly today's always-on behavior. Expired sections disappear silently —
-- no "sale over" state.
--
-- Additive + idempotent; touches no rows.

ALTER TABLE section_config ADD COLUMN IF NOT EXISTS starts_at timestamptz NULL;
ALTER TABLE section_config ADD COLUMN IF NOT EXISTS ends_at   timestamptz NULL;

COMMENT ON COLUMN section_config.starts_at IS 'Section goes live at this time; NULL = immediately (mig 124)';
COMMENT ON COLUMN section_config.ends_at   IS 'Section disappears at this time; NULL = never (mig 124)';
