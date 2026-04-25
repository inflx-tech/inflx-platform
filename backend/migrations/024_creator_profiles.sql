-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 024 — creator_profiles
--
-- Receives Instagram metric data pushed from the external Marketing
-- Automation system (n8n + Apify). One row per Instagram handle.
--
-- Two-state model
-- ---------------
-- Every creator with public Instagram data gets a row here, regardless of
-- whether they have an Inflx account. Brands search across this table so
-- they can discover creators who haven't signed up yet, and trigger admin-
-- driven outreach via the creator_invitations queue (migration 026).
--
-- When an influencer registers via POST /influencers/register with their
-- handle, the registration handler matches the existing creator_profiles
-- row (if any), sets is_onboarded = true, and sets linked_influencer_id
-- to the freshly created influencers.id.
--
-- Data flow
-- ---------
--   Marketing Automation → POST /v1/internal/ingest/creator-metrics
--   → upsert into creator_profiles by ig_handle (UNIQUE)
--
-- The Inflx side does NOT scrape — APIFY_INGEST_MODE=external disables the
-- existing apify-engagement-scrape cron. Apify is only used as a fallback
-- for first-time signups when the marketing system hasn't seen the handle.
--
-- target_type
-- -----------
-- The marketing payload includes a target_type field but Inflx accepts only
-- 'influencer'. The ingest controller returns 400 IGNORED_BRAND_TYPE for any
-- 'brand' row that leaks through. We do NOT store target_type in this table
-- — every row here is an influencer by definition.
--
-- Money
-- -----
-- estimated_min_rate / estimated_max_rate are RUPEES (numeric(10,2)) per the
-- post-021 platform-wide convention. The marketing payload sends them as
-- integers; the ingest controller coerces.
--
-- Idempotent: uses IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS creator_profiles (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  ig_handle                   TEXT NOT NULL UNIQUE,
  ig_user_id                  TEXT,

  -- Two-state model
  is_onboarded                BOOLEAN NOT NULL DEFAULT FALSE,
  linked_influencer_id        UUID REFERENCES influencers(id) ON DELETE SET NULL,

  -- Profile snapshot
  full_name                   TEXT,
  bio                         TEXT,
  profile_pic_url             TEXT,
  external_url                TEXT,
  followers_count             INTEGER DEFAULT 0,
  following_count             INTEGER DEFAULT 0,
  total_posts_lifetime        INTEGER DEFAULT 0,
  is_verified                 BOOLEAN DEFAULT FALSE,
  is_business                 BOOLEAN DEFAULT FALSE,
  is_private                  BOOLEAN DEFAULT FALSE,
  joined_recently             BOOLEAN DEFAULT FALSE,
  ig_category                 TEXT,
  highlights_count            INTEGER DEFAULT 0,
  city                        TEXT,
  niche                       TEXT,
  sub_niche                   TEXT,
  languages                   TEXT[],
  bio_email                   TEXT,
  bio_phone                   TEXT,

  -- Layer 1 — Basic aggregates (last 90 days)
  total_posts_90d             INTEGER DEFAULT 0,
  total_videos_90d            INTEGER DEFAULT 0,
  total_carousels_90d         INTEGER DEFAULT 0,
  posting_frequency_per_day   NUMERIC(5,2) DEFAULT 0,
  posting_frequency_per_week  NUMERIC(5,2) DEFAULT 0,
  avg_likes                   INTEGER DEFAULT 0,
  avg_comments                INTEGER DEFAULT 0,
  avg_views                   INTEGER DEFAULT 0,
  median_likes                INTEGER DEFAULT 0,
  median_views                INTEGER DEFAULT 0,

  -- Layer 2 — Engagement
  follower_based_er           NUMERIC(6,2) DEFAULT 0,
  view_based_er               NUMERIC(6,2) DEFAULT 0,
  best_post_views             INTEGER DEFAULT 0,
  best_post_engagement        NUMERIC(6,2) DEFAULT 0,
  consistency_score           NUMERIC(4,2) DEFAULT 0,

  -- Layer 3 — Brand collaboration
  total_brand_collaborations  INTEGER DEFAULT 0,
  unique_brands_count         INTEGER DEFAULT 0,
  commercial_post_rate        NUMERIC(4,2) DEFAULT 0,
  cta_usage_rate              NUMERIC(4,2) DEFAULT 0,
  brand_diversity_score       NUMERIC(4,2) DEFAULT 0,
  top_brand_partners          JSONB DEFAULT '[]'::jsonb,

  -- Layer 5 — Health & ranking
  follower_tier               TEXT,
  account_age_days            INTEGER,
  is_active_creator           BOOLEAN DEFAULT TRUE,
  activity_status             TEXT DEFAULT 'active'
                              CHECK (activity_status IN ('active','dormant','abandoned')),
  growth_potential_score      INTEGER DEFAULT 0,
  rank_score                  NUMERIC(8,2) DEFAULT 0,

  -- Pricing (rupees, post-migration 021 convention)
  estimated_min_rate          NUMERIC(10,2),
  estimated_max_rate          NUMERIC(10,2),
  recommended_use_cases       TEXT[],

  -- Special
  related_handles             JSONB DEFAULT '[]'::jsonb,
  raw_profile_data            JSONB,

  -- Audit
  last_scraped_at             TIMESTAMPTZ,
  last_calculated_at          TIMESTAMPTZ,
  scrape_count                INTEGER DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reuses the project's existing trigger function update_updated_at()
-- defined in migration 001.
DROP TRIGGER IF EXISTS creator_profiles_updated_at ON creator_profiles;
CREATE TRIGGER creator_profiles_updated_at
  BEFORE UPDATE ON creator_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Indexes ────────────────────────────────────────────────────────────────
-- Covers the brand search default sort and the most common filter columns.
CREATE INDEX IF NOT EXISTS idx_creator_profiles_handle
  ON creator_profiles (ig_handle);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_user_id
  ON creator_profiles (ig_user_id);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_rank
  ON creator_profiles (rank_score DESC);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_view_er
  ON creator_profiles (view_based_er DESC);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_followers
  ON creator_profiles (followers_count DESC);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_city
  ON creator_profiles (city);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_niche
  ON creator_profiles (niche);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_tier
  ON creator_profiles (follower_tier);

-- Partial index — most search queries filter is_active_creator = TRUE
CREATE INDEX IF NOT EXISTS idx_creator_profiles_active
  ON creator_profiles (is_active_creator) WHERE is_active_creator = TRUE;

CREATE INDEX IF NOT EXISTS idx_creator_profiles_onboarded
  ON creator_profiles (is_onboarded);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_linked
  ON creator_profiles (linked_influencer_id) WHERE linked_influencer_id IS NOT NULL;

-- GIN for languages array filter (`languages && $langs`)
CREATE INDEX IF NOT EXISTS idx_creator_profiles_languages
  ON creator_profiles USING GIN (languages);

COMMIT;
