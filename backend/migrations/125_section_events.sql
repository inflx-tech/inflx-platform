-- Migration 125 — section_events (Cleanup P5, features/section-analytics-city/).
--
-- First section-keyed engagement capture: one row per follower tap / see-all
-- on an admin-composed section. Surfaced in the App Builder's 7-day panel.
-- Counts start EMPTY from this release — no invented history (backend-first
-- rule: every surfaced number traces to a row here).
--
-- Additive + idempotent; touches no rows.

CREATE TABLE IF NOT EXISTS section_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key  text NOT NULL,
  screen       text NOT NULL,
  scope_value  text NULL,
  city         text NULL,
  event        text NOT NULL CHECK (event IN ('tap', 'see_all')),
  entity_type  text NULL,
  entity_id    text NULL,
  follower_id  uuid NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_section_events_created ON section_events (created_at);
CREATE INDEX IF NOT EXISTS idx_section_events_key     ON section_events (section_key, created_at);
