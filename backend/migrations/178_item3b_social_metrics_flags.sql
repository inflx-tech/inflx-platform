-- 178 — Item 3b: the calculated numbers per posts run (history + one current row per
-- account) and the admin flags (3 failures in a row · budget reached · ceiling hit).
-- Contract: features/item3b-social-numbers · prompt §3.4, §3.6

BEGIN;

CREATE TABLE IF NOT EXISTS creator_social_metrics (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            uuid NOT NULL REFERENCES creator_social_accounts(id) ON DELETE CASCADE,
  run_id                uuid REFERENCES creator_social_runs(id) ON DELETE SET NULL,
  computed_at           timestamptz NOT NULL DEFAULT now(),
  window_start          timestamptz NOT NULL,
  window_end            timestamptz NOT NULL,
  is_current            boolean NOT NULL DEFAULT true,
  followers_used        bigint,
  -- Instagram
  ig_posts_90d          int,
  ig_posts_per_week     numeric(6,1),
  ig_reels              int,
  ig_photos             int,
  ig_carousels          int,
  ig_last_post_at       timestamptz,
  ig_avg_likes          numeric(14,1),
  ig_hidden_likes_count int,
  ig_avg_comments       numeric(14,1),
  ig_avg_reel_views     numeric(14,1),
  ig_engagement         numeric(6,1),
  -- YouTube
  yt_uploads_90d        int,
  yt_uploads_per_week   numeric(6,1),
  yt_last_upload_at     timestamptz,
  yt_long_count         int,
  yt_long_avg_views     numeric(14,1),
  yt_long_avg_likes     numeric(14,1),
  yt_long_avg_comments  numeric(14,1),
  yt_long_engagement    numeric(6,1),
  yt_short_count        int,
  yt_short_avg_views    numeric(14,1),
  yt_short_avg_likes    numeric(14,1),
  yt_short_avg_comments numeric(14,1),
  yt_short_engagement   numeric(6,1),
  counts                jsonb NOT NULL DEFAULT '{}'::jsonb   -- the counts each average used
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_creator_social_metrics_current ON creator_social_metrics (account_id) WHERE is_current;
CREATE INDEX IF NOT EXISTS idx_creator_social_metrics_account ON creator_social_metrics (account_id, computed_at DESC);

CREATE TABLE IF NOT EXISTS social_admin_flags (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL CHECK (kind IN ('failing_3','budget','ceiling')),
  account_id   uuid REFERENCES creator_social_accounts(id) ON DELETE CASCADE,
  detail       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  resolved_by  uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_social_admin_flags_open ON social_admin_flags (created_at DESC) WHERE resolved_at IS NULL;

COMMIT;
