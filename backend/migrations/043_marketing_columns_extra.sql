-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 043 — additive columns on creator_profiles (and brand_profiles
-- gets a small amount of belt-and-suspenders columns too)
--
-- Purpose:
--   1. Add outreach_status to creator_profiles for fast triage queries
--      (mirrors the brand_profiles column added in migration 040).
--   2. Add Claude-bio-intel columns to creator_profiles so the marketing
--      engine can preserve the manual-vs-inferred separation (Q5 rule:
--      "Manual data is sacred"). Without these the AI extraction has
--      nowhere to land without clobbering admin-entered values.
--   3. Add pause + reengagement columns on creator_profiles for parity
--      with brand_profiles.
--
-- All additions are NULLABLE or have safe DEFAULTs — no existing read paths
-- break. No existing column is modified or dropped.
--
-- Idempotent: every ADD COLUMN uses IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. creator_profiles — outreach status (the marketing engine's state field)
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS outreach_status TEXT
    NOT NULL DEFAULT 'not_contacted'
    CHECK (outreach_status IN ('not_contacted','contacted','replied',
                               'interested','negotiating','registered',
                               'dead','paused'));

CREATE INDEX IF NOT EXISTS idx_creator_profiles_outreach_status
  ON creator_profiles (outreach_status);

-- Compound index for the "ready for outreach" triage default:
--   SELECT … WHERE outreach_status='not_contacted' ORDER BY priority_score DESC
-- Note: creator_profiles uses `rank_score` not `priority_score` — we don't
-- have a priority_score column on creator_profiles. The marketing UI will
-- sort by rank_score for influencers, priority_score for brands.
CREATE INDEX IF NOT EXISTS idx_creator_profiles_triage_ready
  ON creator_profiles (rank_score DESC)
  WHERE outreach_status = 'not_contacted';


-- ═════════════════════════════════════════════════════════════════════════════
-- 2. creator_profiles — Claude bio intel + manual-vs-inferred separation
-- ═════════════════════════════════════════════════════════════════════════════
-- The existing schema (migration 024) has city / niche / sub_niche and
-- bio_email / bio_phone but NO "inferred_*" tracking. We add the Claude
-- side here without touching the existing columns. The application layer
-- will write manual values to city/niche/sub_niche and Claude values to
-- inferred_*, then COALESCE(manual, inferred) at read time.
ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS inferred_city             TEXT,
  ADD COLUMN IF NOT EXISTS inferred_niche            TEXT,
  ADD COLUMN IF NOT EXISTS inferred_sub_niche        TEXT,
  ADD COLUMN IF NOT EXISTS bio_whatsapp              TEXT,
  ADD COLUMN IF NOT EXISTS manual_phone              TEXT,
  ADD COLUMN IF NOT EXISTS manual_email              TEXT,
  ADD COLUMN IF NOT EXISTS manual_whatsapp           TEXT,
  ADD COLUMN IF NOT EXISTS primary_offering          TEXT,
  ADD COLUMN IF NOT EXISTS tone                      TEXT,
  ADD COLUMN IF NOT EXISTS bio_business_type         TEXT,
  ADD COLUMN IF NOT EXISTS reachability_score        INTEGER,
  ADD COLUMN IF NOT EXISTS contact_intel_extracted_at TIMESTAMPTZ;


-- ═════════════════════════════════════════════════════════════════════════════
-- 3. creator_profiles — scoring summary text + priority_score
-- ═════════════════════════════════════════════════════════════════════════════
-- creator_profiles has rank_score and growth_potential_score but no single
-- 0–100 priority_score (the A5 workflow produces it). Add it.
ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS priority_score   NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scoring_summary  TEXT,
  ADD COLUMN IF NOT EXISTS scoring_strengths JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS scoring_concerns  JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_creator_profiles_priority_score
  ON creator_profiles (priority_score DESC);


-- ═════════════════════════════════════════════════════════════════════════════
-- 4. creator_profiles — lifecycle flags (pause / reengagement)
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS is_paused          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS paused_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reengagement_date  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_creator_profiles_unpaused
  ON creator_profiles (rank_score DESC)
  WHERE is_paused = FALSE;


-- ═════════════════════════════════════════════════════════════════════════════
-- 5. creator_profiles — source tracking
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS source TEXT,  -- 'admin_intake' | 'sheet' | 'api' | etc.
  ADD COLUMN IF NOT EXISTS notes  TEXT;

COMMIT;
