-- 210 — post-performance-v2: how the creator's campaign post is doing on Instagram and YouTube.
-- Contract: features/post-performance-v2 · master rules v1.35 §13A · spec §4
--
-- ADDITIVE. No existing row is written and nothing is dropped.
--   1. post_stat_runs    — one row per Apify run (both platforms, batched up to 50 links a run),
--                          with the Apify run id and what it cost, so /admin/social/costs can name it.
--                          Item 3b's creator_social_runs cannot hold these: its account_id is NOT NULL
--                          and a batched run spans creators (spec P4).
--   2. proof_stats       — one row per TRACKED LINK: a content_proofs row whose url is an Instagram or
--                          YouTube post, from the moment the link is final (spec P1, P2). Carries the
--                          latest reading, denormalised, for the screens. Replaces deliverable_stats,
--                          which stays in place, unwritten, for a later housekeeping migration (P11).
--   3. proof_stat_reads  — every reading, append-only, with the raw item for the next field-name drift.
--   4. social_admin_flags.kind gains 'owner_mismatch' (P8): the link's owner is not her confirmed
--                          account, nor a co-author of the post.
--
-- A replaced link on an outside row closes its row (stop_reason link_changed) and opens a new one,
-- so the row has its own id and the (content_id,row_key,slot) key is unique only among open rows.

BEGIN;

CREATE TABLE IF NOT EXISTS post_stat_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform        text NOT NULL CHECK (platform IN ('instagram','youtube')),
  trigger         text NOT NULL CHECK (trigger IN ('schedule','update_now','admin','backfill')),
  actor           text,
  apify_run_id    text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  result          text NOT NULL DEFAULT 'running' CHECK (result IN ('success','technical_failure','budget','running')),
  error           text,
  usage_usd       numeric(10,4) NOT NULL DEFAULT 0,
  urls_sent       int NOT NULL DEFAULT 0,
  items_received  int NOT NULL DEFAULT 0,
  detail          jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_post_stat_runs_apify ON post_stat_runs (apify_run_id) WHERE apify_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_post_stat_runs_month ON post_stat_runs (started_at);
COMMENT ON TABLE post_stat_runs IS
  'post-performance-v2 (v1.35 §13A). One row per Apify run that reads campaign post links: platform, trigger (schedule | update_now | admin | backfill), the Apify run id, what it cost. Counted by /admin/social/costs beside item 3b''s creator runs.';

CREATE TABLE IF NOT EXISTS proof_stats (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id        uuid NOT NULL,
  row_key           text NOT NULL,
  slot              smallint NOT NULL,
  platform          text NOT NULL CHECK (platform IN ('instagram','youtube')),
  url_sent          text NOT NULL,
  platform_post_id  text NOT NULL,
  kind              text CHECK (kind IS NULL OR kind IN ('reel','post','carousel','long','short')),
  tracked_from      timestamptz NOT NULL DEFAULT now(),
  reads             int NOT NULL DEFAULT 0,
  next_due_at       timestamptz,
  stopped_at        timestamptz,
  stop_reason       text CHECK (stop_reason IS NULL OR stop_reason IN ('day_90','post_left_shop','link_changed','not_found','private')),
  -- the latest reading, denormalised for the screens
  views             bigint,
  likes             bigint,
  likes_hidden      boolean NOT NULL DEFAULT false,
  comments          bigint,
  comments_off      boolean NOT NULL DEFAULT false,
  published_at      timestamptz,
  owner_handle      text,
  owner_state       text CHECK (owner_state IS NULL OR owner_state IN ('match','other_account','owner_unknown')),
  numbers_at        timestamptz,            -- when the numbers above were read (the time the screens print)
  last_read_at      timestamptz,            -- the last attempt, whatever it answered
  last_source       text CHECK (last_source IS NULL OR last_source IN ('apify','level1')),
  last_result       text CHECK (last_result IS NULL OR last_result IN ('ok','not_found','private','unreadable')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (content_id, row_key, slot) REFERENCES content_proofs (content_id, row_key, slot) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_proof_stats_open ON proof_stats (content_id, row_key, slot) WHERE stopped_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_proof_stats_due ON proof_stats (next_due_at) WHERE stopped_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_proof_stats_content ON proof_stats (content_id);
COMMENT ON TABLE proof_stats IS
  'post-performance-v2 (v1.35 §13A). One row per tracked link (a content_proofs url on Instagram or YouTube), from the moment the link is final: a package row''s links when she marks posted, an outside row''s link at save. Read on day 1,2,3,5,7,10,14,21,30 after tracked_from, then every 14 days to day 90. The latest reading is kept here for the screens; every reading is in proof_stat_reads.';

CREATE TABLE IF NOT EXISTS proof_stat_reads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stat_id       uuid NOT NULL REFERENCES proof_stats(id) ON DELETE CASCADE,
  run_id        uuid REFERENCES post_stat_runs(id) ON DELETE SET NULL,   -- NULL for a level1 seed
  measured_at   timestamptz NOT NULL DEFAULT now(),
  source        text NOT NULL CHECK (source IN ('apify','level1')),
  result        text NOT NULL CHECK (result IN ('ok','not_found','private','unreadable')),
  views         bigint,
  likes         bigint,
  likes_hidden  boolean NOT NULL DEFAULT false,
  comments      bigint,
  comments_off  boolean NOT NULL DEFAULT false,
  owner_handle  text,
  raw           jsonb
);
CREATE INDEX IF NOT EXISTS idx_proof_stat_reads_stat ON proof_stat_reads (stat_id, measured_at DESC);

ALTER TABLE social_admin_flags DROP CONSTRAINT IF EXISTS social_admin_flags_kind_check;
ALTER TABLE social_admin_flags ADD CONSTRAINT social_admin_flags_kind_check
  CHECK (kind IN ('failing_3','budget','ceiling','owner_mismatch'));

COMMIT;
