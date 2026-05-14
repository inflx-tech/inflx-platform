-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 044 — outreach_status on brand_profiles (oversight from 040)
--
-- Migration 040 created brand_profiles without the outreach_status column.
-- Migration 043 added outreach_status to creator_profiles but not to
-- brand_profiles. Several admin marketing queries select / update / write
-- outreach_status on brand_profiles, so this column has to exist.
--
-- Symptom that triggered this fix: admin intake → "Add Lead" → 500 from
--   POST /v1/admin/marketing/leads/intake with PostgreSQL error
--   42703 "column outreach_status does not exist" raised by the dedup
--   query inside findByHandle().
--
-- Also adds reengagement_date for parity with creator_profiles (the
-- existing 040 schema has paused_at but not reengagement_date).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE brand_profiles
  ADD COLUMN IF NOT EXISTS outreach_status TEXT
    NOT NULL DEFAULT 'not_contacted'
    CHECK (outreach_status IN ('not_contacted','contacted','replied',
                               'interested','negotiating','registered',
                               'dead','paused')),
  ADD COLUMN IF NOT EXISTS reengagement_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_brand_profiles_outreach_status
  ON brand_profiles (outreach_status);

-- Compound index for the "ready for outreach" triage default sort, mirrors
-- the equivalent index on creator_profiles in migration 043.
CREATE INDEX IF NOT EXISTS idx_brand_profiles_triage_ready
  ON brand_profiles (priority_score DESC)
  WHERE outreach_status = 'not_contacted';

COMMIT;
