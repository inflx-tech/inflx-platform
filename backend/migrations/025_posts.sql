-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 025 — posts (Instagram post-level data)
--
-- Receives per-post data pushed from the external Marketing Automation
-- system. One row per Instagram post, scoped to a creator_profile.
--
-- Used by:
--   - GET /v1/influencers/me/insights → top 5 posts in the influencer
--     dashboard
--   - GET /v1/influencers/:id (creator detail page → Performance tab)
--
-- Data flow:
--   Marketing Automation → POST /v1/internal/ingest/posts
--   { ig_handle, posts: [{ ig_post_id, type, posted_at, ... }, ...] }
--   Upsert by (creator_profile_id, ig_post_id).
--
-- Idempotent: uses IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS posts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_profile_id   UUID NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,

  -- Instagram identity
  ig_post_id           TEXT NOT NULL,
  shortcode            TEXT,
  permalink            TEXT,

  -- Content
  type                 TEXT,                       -- 'image' | 'video' | 'carousel' | 'reel'
  posted_at            TIMESTAMPTZ,
  caption              TEXT,
  media_url            TEXT,                       -- thumbnail / first frame
  hashtags             TEXT[],
  mentions             TEXT[],

  -- Metrics
  likes_count          INTEGER DEFAULT 0,
  comments_count       INTEGER DEFAULT 0,
  views_count          INTEGER DEFAULT 0,
  shares_count         INTEGER DEFAULT 0,
  saves_count          INTEGER DEFAULT 0,

  -- Brand collab data (used by Brand History tab on creator detail)
  brand_tags           JSONB DEFAULT '[]'::jsonb,
  has_commercial_intent BOOLEAN DEFAULT FALSE,
  has_cta              BOOLEAN DEFAULT FALSE,

  -- Audit
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Idempotency for upserts
  UNIQUE (creator_profile_id, ig_post_id)
);

DROP TRIGGER IF EXISTS posts_updated_at ON posts;
CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Indexes ────────────────────────────────────────────────────────────────
-- Top-N posts per creator (engagement = likes + comments)
CREATE INDEX IF NOT EXISTS idx_posts_creator_engagement
  ON posts (creator_profile_id, ((COALESCE(likes_count,0) + COALESCE(comments_count,0))) DESC);

-- Recency lookups
CREATE INDEX IF NOT EXISTS idx_posts_creator_posted_at
  ON posts (creator_profile_id, posted_at DESC);

-- Brand-history filters
CREATE INDEX IF NOT EXISTS idx_posts_commercial
  ON posts (creator_profile_id) WHERE has_commercial_intent = TRUE;

-- Tag search (e.g. all posts tagging @nykaa)
CREATE INDEX IF NOT EXISTS idx_posts_brand_tags
  ON posts USING GIN (brand_tags);

CREATE INDEX IF NOT EXISTS idx_posts_hashtags
  ON posts USING GIN (hashtags);

COMMIT;
