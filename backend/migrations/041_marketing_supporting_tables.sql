-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 041 — marketing supporting tables
--
-- Four supporting tables that round out the marketing-engine data model.
-- These were previously in System A's separate Supabase; folding them into
-- the unified Inflx Platform database now that there's only one source of
-- truth.
--
--   1. caption_insights — per-post AI-extracted insights for influencer
--      posts (commercial intent, CTA, content theme, funnel stage). Used
--      by the influencer detail panel and by future scoring runs.
--
--   2. collab_map — every brand collaboration detected on an influencer's
--      posts. One row per (influencer, post) collab signal. Used to show
--      "top brand partners" and detected collab feed in the detail panel.
--
--   3. insights — historical log of AI runs (daily reports, scoring
--      summaries). Append-only timeline; never updated. Powers the daily
--      report and the audit trail.
--
--   4. system_settings — single-row configuration table for tunable
--      thresholds (tier cutoffs, refresh cadence, retention windows).
--      Read by A6 daily refresh, A7 cleanup, and the admin settings UI.
--      Seeded with sensible defaults.
--
-- Idempotent: IF NOT EXISTS throughout. The system_settings seed uses
-- ON CONFLICT DO NOTHING so re-running this migration won't overwrite
-- whatever an admin has tuned the values to.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. caption_insights
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS caption_insights (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  post_shortcode           TEXT NOT NULL UNIQUE,
  ig_handle                TEXT,
  creator_profile_id       UUID REFERENCES creator_profiles(id) ON DELETE CASCADE,

  -- Brand mentions detected in this post's caption
  brand_usernames          JSONB DEFAULT '[]'::jsonb,

  -- Commercial intent signals
  commercial_intent        BOOLEAN DEFAULT FALSE,
  intent_type              TEXT
                           CHECK (intent_type IS NULL
                               OR intent_type IN ('promotional','informational',
                                                  'personal','entertainment','educational')),
  intent_strength          TEXT
                           CHECK (intent_strength IS NULL
                               OR intent_strength IN ('strong','medium','weak')),

  -- CTA signals
  cta_present              BOOLEAN DEFAULT FALSE,
  cta_type                 TEXT,
  has_link                 BOOLEAN DEFAULT FALSE,
  has_discount             BOOLEAN DEFAULT FALSE,
  has_promo_code           BOOLEAN DEFAULT FALSE,

  -- Categorization
  product_category         TEXT,
  collaboration_type       TEXT
                           CHECK (collaboration_type IS NULL
                               OR collaboration_type IN ('paid_post','gifted','ambassador',
                                                         'giveaway','organic_mention','none')),
  sales_funnel_stage       TEXT
                           CHECK (sales_funnel_stage IS NULL
                               OR sales_funnel_stage IN ('awareness','consideration',
                                                         'purchase','retention')),
  content_theme            TEXT,
  emotion_type             TEXT,

  -- Audit
  analyzed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS caption_insights_updated_at ON caption_insights;
CREATE TRIGGER caption_insights_updated_at
  BEFORE UPDATE ON caption_insights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_caption_insights_creator
  ON caption_insights (creator_profile_id);

CREATE INDEX IF NOT EXISTS idx_caption_insights_handle
  ON caption_insights (ig_handle);

CREATE INDEX IF NOT EXISTS idx_caption_insights_commercial
  ON caption_insights (commercial_intent)
  WHERE commercial_intent = TRUE;

CREATE INDEX IF NOT EXISTS idx_caption_insights_brand_usernames
  ON caption_insights USING GIN (brand_usernames);


-- ═════════════════════════════════════════════════════════════════════════════
-- 2. collab_map
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS collab_map (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  creator_profile_id       UUID NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  post_shortcode           TEXT NOT NULL,

  -- Brand identification
  brand_name               TEXT,
  brand_instagram          TEXT,

  -- Signal details
  collab_type              TEXT,
  detected_signals         JSONB DEFAULT '[]'::jsonb,
  confidence               TEXT
                           CHECK (confidence IS NULL
                               OR confidence IN ('high','medium','low')),

  -- Audit
  detected_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One collab signal per (creator, post) — re-detections update in place
  UNIQUE (creator_profile_id, post_shortcode)
);

DROP TRIGGER IF EXISTS collab_map_updated_at ON collab_map;
CREATE TRIGGER collab_map_updated_at
  BEFORE UPDATE ON collab_map
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_collab_map_creator
  ON collab_map (creator_profile_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_collab_map_brand_handle
  ON collab_map (brand_instagram)
  WHERE brand_instagram IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_collab_map_post
  ON collab_map (post_shortcode);


-- ═════════════════════════════════════════════════════════════════════════════
-- 3. insights — append-only log of AI runs / daily reports
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS insights (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What kind of insight
  insight_type             TEXT NOT NULL
                           CHECK (insight_type IN ('profile_summary','brand_fit',
                                                   'engagement_trend','daily_db_report',
                                                   'weekly_report','scoring_run','other')),

  -- Optional links to subject
  creator_profile_id       UUID REFERENCES creator_profiles(id) ON DELETE CASCADE,
  brand_profile_id         UUID REFERENCES brand_profiles(id) ON DELETE CASCADE,

  -- Payload
  title                    TEXT NOT NULL,
  body                     TEXT,
  score                    NUMERIC(5,2),
  model_used               TEXT,
  metadata                 JSONB DEFAULT '{}'::jsonb,

  -- Audit (append-only — no updated_at trigger)
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insights_creator
  ON insights (creator_profile_id, created_at DESC)
  WHERE creator_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_insights_brand
  ON insights (brand_profile_id, created_at DESC)
  WHERE brand_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_insights_type_time
  ON insights (insight_type, created_at DESC);


-- ═════════════════════════════════════════════════════════════════════════════
-- 4. system_settings — single-row configuration
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS system_settings (
  id                          INTEGER PRIMARY KEY DEFAULT 1
                              CHECK (id = 1),  -- enforce single row

  -- Tier score thresholds (priority_score 0-100)
  high_tier_threshold         INTEGER NOT NULL DEFAULT 70,
  low_tier_threshold          INTEGER NOT NULL DEFAULT 40,

  -- Refresh cadence in days (per Q7 — keep as is)
  high_refresh_days           INTEGER NOT NULL DEFAULT 3,
  mid_refresh_days            INTEGER NOT NULL DEFAULT 7,
  low_refresh_days            INTEGER NOT NULL DEFAULT 14,
  brand_refresh_days          INTEGER NOT NULL DEFAULT 7,

  -- Freshness gate (skip re-scrape if scraped within this many hours)
  skip_recent_scrape_hours    INTEGER NOT NULL DEFAULT 24,

  -- Retention windows (days)
  posts_retention_days        INTEGER NOT NULL DEFAULT 30,
  brand_posts_retention_days  INTEGER NOT NULL DEFAULT 0,  -- 0 = delete brand posts after analysis

  -- Discovery (per Q1 — kept here for future toggles; default OFF)
  discovery_enabled           BOOLEAN NOT NULL DEFAULT FALSE,

  -- Audit
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS system_settings_updated_at ON system_settings;
CREATE TRIGGER system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed the single row. ON CONFLICT DO NOTHING preserves admin tweaks on re-run.
INSERT INTO system_settings (id)
  VALUES (1)
  ON CONFLICT (id) DO NOTHING;

COMMIT;
