-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 040 — brand_profiles
--
-- Mirror of creator_profiles for SCRAPED / DISCOVERY brands — i.e. brands
-- we know about from Instagram but who are not yet registered on Inflx.
--
-- IMPORTANT: This is NOT the same as the existing `brands` table.
--   - `brands` (migration 001)         = registered platform brands with
--                                        wallet_balance, GSTIN, razorpay
--                                        contact id, etc. A user.
--   - `brand_profiles` (this migration)= scraped Instagram brand handles
--                                        that we may eventually onboard.
--                                        Not a user. May or may not link
--                                        back to brands(id) once they
--                                        register.
--
-- Two-state model (mirrors creator_profiles):
--   When a discovery brand later registers on Inflx (creates a user with
--   role='brand' and a brands row), `is_onboarded` is flipped TRUE and
--   `linked_brand_id` is set to the freshly created brands.id.
--
-- Brand enrichment is INTENTIONALLY LIGHTER than creator enrichment:
--   - Profile snapshot (followers, bio, verification, etc.)
--   - Contact intelligence (phone, email, WhatsApp from bio)
--   - Collaboration history (which influencers this brand has worked with
--     in the last 90 days)
--   No 60+ post-level metrics. No engagement rate calc. No rate range.
--   The collab list is the headline signal — it tells us if the brand is
--   active in influencer marketing.
--
-- Manual vs Claude-inferred separation (Q5 rule, "Manual data is sacred"):
--   - city, industry, sub_industry, manual_phone/email/whatsapp = admin
--     typed these at intake; AI never overwrites them.
--   - inferred_city, inferred_industry, inferred_sub_industry,
--     bio_phone/email/whatsapp = Claude-extracted from bio; never
--     overwrites the manual side.
--   The marketing UI shows the manual value if present, else the inferred
--   value with an "AI suggested" badge.
--
-- Money:
--   No money columns in this table (brands don't have rate ranges).
--
-- Idempotent: BEGIN/COMMIT + IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS brand_profiles (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  instagram_handle            TEXT NOT NULL UNIQUE,
  ig_user_id                  TEXT,
  business_name               TEXT,

  -- Two-state model
  is_onboarded                BOOLEAN NOT NULL DEFAULT FALSE,
  linked_brand_id             UUID REFERENCES brands(id) ON DELETE SET NULL,

  -- Manual fields from admin intake (sacred — never overwritten by AI)
  city                        TEXT,
  industry                    TEXT,
  sub_industry                TEXT,
  manual_phone                TEXT,
  manual_email                TEXT,
  manual_whatsapp             TEXT,

  -- Profile snapshot from Apify
  full_name                   TEXT,
  bio                         TEXT,
  profile_pic_url             TEXT,
  external_url                TEXT,
  website                     TEXT,
  followers_count             INTEGER DEFAULT 0,
  following_count             INTEGER DEFAULT 0,
  total_posts_lifetime        INTEGER DEFAULT 0,
  is_verified                 BOOLEAN DEFAULT FALSE,
  is_business                 BOOLEAN DEFAULT FALSE,
  is_private                  BOOLEAN DEFAULT FALSE,
  ig_category                 TEXT,
  highlights_count            INTEGER DEFAULT 0,
  business_address            TEXT,

  -- Claude-inferred (separate from manual fields — Q5)
  inferred_city               TEXT,
  inferred_industry           TEXT,
  inferred_sub_industry       TEXT,
  bio_phone                   TEXT,
  bio_email                   TEXT,
  bio_whatsapp                TEXT,
  primary_offering            TEXT,
  tone                        TEXT,
  languages_used              TEXT[],
  bio_business_type           TEXT,
  reachability_score          INTEGER,
  contact_intel_extracted_at  TIMESTAMPTZ,

  -- Collaboration intelligence (which influencers this brand has worked with)
  influencer_collabs_90d      JSONB DEFAULT '[]'::jsonb,
  influencer_collab_count     INTEGER DEFAULT 0,
  unique_influencer_partners  INTEGER DEFAULT 0,
  marketing_intensity         TEXT
                              CHECK (marketing_intensity IS NULL
                                  OR marketing_intensity IN ('high','medium','low')),

  -- Scoring (lighter than creator — 4 criteria, no rate range)
  priority_score              NUMERIC(5,2) DEFAULT 0,
  tier                        TEXT
                              CHECK (tier IS NULL
                                  OR tier IN ('small','mid','large','enterprise')),
  scoring_summary             TEXT,
  scoring_strengths           JSONB DEFAULT '[]'::jsonb,
  scoring_concerns            JSONB DEFAULT '[]'::jsonb,

  -- Lifecycle flags
  is_active                   BOOLEAN DEFAULT TRUE,
  is_paused                   BOOLEAN DEFAULT FALSE,
  paused_at                   TIMESTAMPTZ,
  source                      TEXT DEFAULT 'admin_intake',
  notes                       TEXT,

  -- Raw payload for debugging
  raw_profile_data            JSONB,

  -- Audit
  last_scraped_at             TIMESTAMPTZ,
  last_calculated_at          TIMESTAMPTZ,
  scrape_count                INTEGER DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reuses the project's update_updated_at() trigger function from migration 001.
DROP TRIGGER IF EXISTS brand_profiles_updated_at ON brand_profiles;
CREATE TRIGGER brand_profiles_updated_at
  BEFORE UPDATE ON brand_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_brand_profiles_handle
  ON brand_profiles (instagram_handle);

CREATE INDEX IF NOT EXISTS idx_brand_profiles_ig_user
  ON brand_profiles (ig_user_id) WHERE ig_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_brand_profiles_score
  ON brand_profiles (priority_score DESC);

CREATE INDEX IF NOT EXISTS idx_brand_profiles_followers
  ON brand_profiles (followers_count DESC);

CREATE INDEX IF NOT EXISTS idx_brand_profiles_city
  ON brand_profiles (city);

CREATE INDEX IF NOT EXISTS idx_brand_profiles_industry
  ON brand_profiles (industry);

CREATE INDEX IF NOT EXISTS idx_brand_profiles_sub_industry
  ON brand_profiles (sub_industry);

CREATE INDEX IF NOT EXISTS idx_brand_profiles_tier
  ON brand_profiles (tier);

CREATE INDEX IF NOT EXISTS idx_brand_profiles_onboarded
  ON brand_profiles (is_onboarded);

CREATE INDEX IF NOT EXISTS idx_brand_profiles_linked
  ON brand_profiles (linked_brand_id) WHERE linked_brand_id IS NOT NULL;

-- Partial index for active, non-paused brands (the default triage filter)
CREATE INDEX IF NOT EXISTS idx_brand_profiles_active_unpaused
  ON brand_profiles (priority_score DESC)
  WHERE is_active = TRUE AND is_paused = FALSE;

-- For refresh-due queries (A6 daily refresh workflow)
CREATE INDEX IF NOT EXISTS idx_brand_profiles_last_scraped
  ON brand_profiles (last_scraped_at NULLS FIRST)
  WHERE is_paused = FALSE;

COMMIT;
