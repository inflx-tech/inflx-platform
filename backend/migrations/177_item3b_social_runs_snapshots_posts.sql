-- 177 — Item 3b: the run log (with Apify cost), profile snapshots per run, and every post.
-- Contract: features/item3b-social-numbers · prompt §3.3, §3.4

BEGIN;

CREATE TABLE IF NOT EXISTS creator_social_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       uuid NOT NULL REFERENCES creator_social_accounts(id) ON DELETE CASCADE,
  run_type         text NOT NULL CHECK (run_type IN ('full','profile','posts')),
  trigger          text NOT NULL,           -- approval · handle_confirm · schedule · retry · check_again · measure_now · backfill
  actor            text,
  apify_run_id     text,
  started_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz,
  result           text CHECK (result IN ('success','not_found','private','technical_failure','budget','running')),
  error            text,
  usage_usd        numeric(10,4) NOT NULL DEFAULT 0,
  items_received   int NOT NULL DEFAULT 0,
  ceiling_hit      boolean NOT NULL DEFAULT false,
  detail           jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_creator_social_runs_apify ON creator_social_runs (apify_run_id) WHERE apify_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_creator_social_runs_account ON creator_social_runs (account_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_social_runs_month ON creator_social_runs (started_at);

CREATE TABLE IF NOT EXISTS creator_social_profile_snapshots (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id           uuid NOT NULL REFERENCES creator_social_accounts(id) ON DELETE CASCADE,
  run_id               uuid REFERENCES creator_social_runs(id) ON DELETE SET NULL,
  measured_at          timestamptz NOT NULL DEFAULT now(),
  -- Instagram
  followers            bigint,
  following            bigint,
  total_posts          bigint,
  verified             boolean,
  account_type         text,
  -- YouTube
  subscribers          bigint,
  total_videos         bigint,
  total_channel_views  bigint,
  channel_name         text,
  channel_id           text
);
CREATE INDEX IF NOT EXISTS idx_creator_social_snapshots_account ON creator_social_profile_snapshots (account_id, measured_at DESC);

CREATE TABLE IF NOT EXISTS creator_social_posts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        uuid NOT NULL REFERENCES creator_social_accounts(id) ON DELETE CASCADE,
  platform_post_id  text NOT NULL,
  kind              text NOT NULL CHECK (kind IN ('reel','photo','carousel','long','short')),
  tab_source        text CHECK (tab_source IN ('tab','duration_fallback')),
  published_at      timestamptz NOT NULL,
  duration_secs     int,
  likes             bigint,          -- NULL when hidden
  comments          bigint,          -- NULL when disabled
  views             bigint,          -- NULL when not available
  url               text,
  owner_handle      text,            -- Instagram collaborative posts carry the co-author here
  first_seen_run    uuid REFERENCES creator_social_runs(id) ON DELETE SET NULL,
  last_seen_run     uuid REFERENCES creator_social_runs(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, platform_post_id)
);
CREATE INDEX IF NOT EXISTS idx_creator_social_posts_account_date ON creator_social_posts (account_id, published_at DESC);

COMMIT;
