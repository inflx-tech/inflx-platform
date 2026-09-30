-- 199_item14_sale_going_live.sql
-- Contract: features/item14-sale-going-live · master rules v1.29 §12.1/§19 → v1.30 · board v2 (locked 30 Sep 2026)
--
-- Item 14 — Pay for Sale going live. Path 1 (the shoppable post, INFLX approves) is item 13 and is
-- not touched here. Path 2 (the social media post, the brand approves) REUSES item 12's content
-- step: collab_content, its rounds, files, captions and proofs. What item 14 adds:
--
--   1. content_social_rows — the rows SHE names (§12.1): one approved shoppable post + where it
--      will be shared. Item 12's rows come from the agreement; these come from her. A row named
--      after the package was first sent, for a post outside it, is `outside` — links only, never
--      reviewed (board S17, point 2).
--   2. collab_content — the self-confirmation stamp (decision D3: Pay for Sale confirms itself
--      after the Admin days; never Hybrid) and whether a confirmation was automatic.
--   3. the brand's report reasons for a sale collaboration (S23).
--   4. Delayed — six sale stages (§25, S7, S22, S24).
--   5. the one new Admin number (A1).
--
-- ADDITIVE throughout. NO BACKFILL. MONEY: none — Pay for Sale has no fixed money (§21).

-- ─── 1. The rows she names ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_social_rows (
  content_id    uuid NOT NULL REFERENCES collab_content(id) ON DELETE RESTRICT,
  row_key       text NOT NULL CHECK (row_key ~ '^s[0-9]{1,4}$'),
  post_id       uuid NOT NULL REFERENCES creator_posts(id) ON DELETE RESTRICT,
  type          text NOT NULL CHECK (type IN ('reel','post','story','youtube_video','youtube_short','facebook_post')),
  outside       boolean NOT NULL DEFAULT false,
  added_round   smallint NOT NULL CHECK (added_round >= 1),
  -- A row taken out while the package is hers. A row no round ever sent is deleted instead.
  removed_round smallint,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_id, row_key)
);
-- One post, one place, once (among the rows still standing).
CREATE UNIQUE INDEX IF NOT EXISTS uq_content_social_rows_live
  ON content_social_rows (content_id, post_id, type) WHERE removed_round IS NULL;
COMMENT ON TABLE content_social_rows IS
  'Item 14. The social deliverables a Pay for Sale creator names herself (rules v1.30 §12.1): an INFLX-approved shoppable post of this collaboration + where she shares it. Package rows are reviewed by the brand; outside rows (posts approved after the package was first sent, or any post after Completed) take a link only.';

-- ─── 2. Self-confirmation (D3) ───────────────────────────────────────────────
ALTER TABLE collab_content ADD COLUMN IF NOT EXISTS autoconfirm_days    smallint;
ALTER TABLE collab_content ADD COLUMN IF NOT EXISTS autoconfirm_at      timestamptz;
ALTER TABLE collab_content ADD COLUMN IF NOT EXISTS live_confirmed_auto boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN collab_content.autoconfirm_at IS
  'Item 14. Pay for Sale only: when the live confirmation confirms itself if the brand neither confirms nor reports. Stamped when she marks it posted, from sale_live_autoconfirm_days; never re-read. Never set for Hybrid or Pay for Content.';

-- ─── 3. The brand's report reasons (S23) ────────────────────────────────────
ALTER TABLE collab_content DROP CONSTRAINT IF EXISTS collab_content_brand_report_kind_check;
ALTER TABLE collab_content ADD CONSTRAINT collab_content_brand_report_kind_check
  CHECK (brand_report_kind IN ('rounds_used','posted_wrong','not_posted','missing'));

-- ─── 4. Delayed — the six sale stages ───────────────────────────────────────
ALTER TABLE campaign_influencers DROP CONSTRAINT IF EXISTS ci_delayed_stage_known;
ALTER TABLE campaign_influencers ADD CONSTRAINT ci_delayed_stage_known CHECK (
  delayed_stage IS NULL OR delayed_stage IN (
    'plan_not_sent','time_not_agreed','not_attended','not_confirmed','content_not_live',
    'address_not_sent','not_booked','in_transit','not_checked','shoot_not_marked',
    'content_not_submitted','content_in_review','content_changes_requested',
    'content_not_posted','content_not_confirmed',
    'posts_not_approved','social_not_sent','social_in_review','social_changes_requested',
    'social_not_posted','social_not_confirmed'));

-- ─── 5. The Admin number (A1) ───────────────────────────────────────────────
INSERT INTO platform_settings (key, value, min_value, max_value, unit, label) VALUES
  ('sale_live_autoconfirm_days', 7, 1, 30, 'days', 'Pay for Sale confirms itself after')
ON CONFLICT (key) DO NOTHING;

-- Post-migration checks (scripts/run-199.js --dry prints them):
--   SELECT count(*) FROM content_social_rows;                                  -- 0 (new)
--   SELECT count(*) FROM collab_content WHERE autoconfirm_at IS NOT NULL;      -- 0
--   SELECT value FROM platform_settings WHERE key = 'sale_live_autoconfirm_days'; -- 7
--   escrow / contracts / wallets / ledger — identical before and after.
