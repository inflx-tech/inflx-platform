-- 192_item12_content.sql
-- Contract: features/item12-content · Docs/ITEM12_CONTENT_GAP_REPORT.md §8, approval §3.3
--
-- Item 12 — Pay for Content: the package, the review, posting and proof, confirming live, the
-- last two payments. ADDITIVE throughout. NO BACKFILL (approval Q31): no collab_content row is
-- created for anyone; the first one is written by the first upload after the gate passes.
--
-- Parts:
--   1. collab_content      — the content step, one per collaboration, every moment a timestamp;
--   2. content_rounds      — each submission frozen, with the verdict and the reason;
--   3. content_files       — private R2 objects, immutable once sent (a replacement is a removal
--                            plus an addition); Story screenshots are files too (approval §2.6);
--   4. content_file_notes, content_captions, content_proofs;
--   5. escrow_entries.release_due_at — the STAMPED due of the final 50% (finding 2);
--   6. Delayed — the CHECK widened with the five content stages (none exists today);
--   7. the Admin numbers — two new, and the waiting period MOVED from payment_config (Q4);
--   8. escrow_manual_releases — the admin release's audit row with a required reason (Q13).
--
-- MONEY: this migration moves none. scripts/run-192.js reads it before and after.

-- ─── 1. The content step ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collab_content (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_influencer_id uuid NOT NULL UNIQUE REFERENCES campaign_influencers(id) ON DELETE RESTRICT,
  contract_id            uuid NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  -- The rounds: stamped from content_change_rounds at her FIRST submission (never earlier, never again).
  rounds_allowed         smallint CHECK (rounds_allowed IS NULL OR rounds_allowed BETWEEN 1 AND 5),
  first_submitted_at     timestamptz,
  -- The submission being drafted or reviewed. Round n's row in content_rounds exists once sent.
  current_round          smallint NOT NULL DEFAULT 1 CHECK (current_round >= 1),
  approved_at            timestamptz,
  approved_by            uuid,
  approved_round         smallint,
  -- Posting: her confirmation, and the silence period stamped at that moment.
  posted_at              timestamptz,
  posted_by              uuid,
  report_silence_days    smallint,
  report_after_at        timestamptz,
  -- Confirming live: the brand's, and the waiting period stamped at that moment.
  live_confirmed_at      timestamptz,
  live_confirmed_by      uuid,
  final_wait_days        smallint,
  final_due_at           timestamptz,
  t2_released_at         timestamptz,
  t3_released_at         timestamptz,
  completed_at           timestamptz,
  -- Reports (§26), recorded for item 18. The brand's FREEZES the step; hers never does (v1.29).
  brand_reported_at      timestamptz,
  brand_reported_by      uuid,
  brand_report_kind      text CHECK (brand_report_kind IN ('rounds_used','posted_wrong')),
  brand_report_note      text CHECK (brand_report_note IS NULL OR char_length(brand_report_note) <= 500),
  creator_reported_at    timestamptz,
  creator_reported_by    uuid,
  creator_report_note    text CHECK (creator_report_note IS NULL OR char_length(creator_report_note) <= 500),
  -- The 48-hour lane (item 10's anchor rule).
  reminder_sent_at       timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CHECK ((brand_reported_at IS NULL) = (brand_report_kind IS NULL))
);
COMMENT ON TABLE collab_content IS
  'Item 12. The Pay for Content step (rules v1.29 §12.2), one per collaboration. The stage is DERIVED from these timestamps, never stored. Created on the first write after contentGate passes.';

-- ─── 2. The rounds ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_rounds (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id   uuid NOT NULL REFERENCES collab_content(id) ON DELETE RESTRICT,
  round_no     smallint NOT NULL CHECK (round_no >= 1),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  submitted_by uuid NOT NULL,
  -- What was sent, frozen: { rows: [{ key, type, count, caption, fileIds: [...] }] }.
  package_json jsonb NOT NULL,
  verdict      text CHECK (verdict IN ('approved','changes')),
  verdict_at   timestamptz,
  verdict_by   uuid,
  reason       text CHECK (reason IS NULL OR char_length(reason) <= 500),
  CHECK (verdict IS DISTINCT FROM 'changes' OR (reason IS NOT NULL AND btrim(reason) <> '')),
  CHECK ((verdict IS NULL) = (verdict_at IS NULL)),
  UNIQUE (content_id, round_no)
);

-- ─── 3. The files ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id    uuid NOT NULL REFERENCES collab_content(id) ON DELETE RESTRICT,
  row_key       text NOT NULL,
  purpose       text NOT NULL CHECK (purpose IN ('content','story_proof')),
  kind          text NOT NULL CHECK (kind IN ('photo','video')),
  mime          text NOT NULL CHECK (mime IN ('image/jpeg','image/png','video/mp4')),
  size_bytes    bigint NOT NULL CHECK (size_bytes > 0),
  duration_s    numeric(8,2),
  storage_key   text NOT NULL UNIQUE,
  added_round   smallint NOT NULL,
  removed_round smallint,
  uploaded_by   uuid NOT NULL,
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  verified_at   timestamptz,
  deleted_at    timestamptz,
  -- The limits, a second time, where no endpoint can forget them (§12.2).
  CHECK ((kind = 'photo' AND mime IN ('image/jpeg','image/png') AND size_bytes <= 10485760)
      OR (kind = 'video' AND mime = 'video/mp4' AND size_bytes <= 209715200)),
  -- A Story screenshot is an image under the photo rules (approval Q15–Q29, §2.6).
  CHECK (purpose <> 'story_proof' OR kind = 'photo')
);
COMMENT ON TABLE content_files IS
  'Item 12. Private R2 objects under collab-content/<ciId>/. Never public, never putBuffer, never brand_media_assets. verified_at is set only after headObject agrees with what was declared; an unverified row counts for nothing and is swept after 24 h unless a round references it.';

CREATE TABLE IF NOT EXISTS content_file_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES collab_content(id) ON DELETE RESTRICT,
  file_id    uuid NOT NULL REFERENCES content_files(id) ON DELETE RESTRICT,
  round_no   smallint NOT NULL,
  note       text NOT NULL CHECK (char_length(btrim(note)) BETWEEN 1 AND 300),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (file_id, round_no)
);

CREATE TABLE IF NOT EXISTS content_captions (
  content_id uuid NOT NULL REFERENCES collab_content(id) ON DELETE RESTRICT,
  row_key    text NOT NULL,
  caption    text NOT NULL CHECK (char_length(caption) <= 500),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_id, row_key)
);

-- One slot per unit of the count (approval §2.3): a link, or for a Story a screenshot.
CREATE TABLE IF NOT EXISTS content_proofs (
  content_id         uuid NOT NULL REFERENCES collab_content(id) ON DELETE RESTRICT,
  row_key            text NOT NULL,
  slot               smallint NOT NULL CHECK (slot BETWEEN 1 AND 20),
  url                text CHECK (url IS NULL OR char_length(url) <= 500),
  screenshot_file_id uuid REFERENCES content_files(id) ON DELETE RESTRICT,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK ((url IS NULL) <> (screenshot_file_id IS NULL)),
  PRIMARY KEY (content_id, row_key, slot)
);

CREATE INDEX IF NOT EXISTS idx_content_files_live   ON content_files (content_id, row_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_content_files_sweep  ON content_files (uploaded_at) WHERE verified_at IS NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_collab_content_open  ON collab_content (campaign_influencer_id) WHERE completed_at IS NULL;

-- ─── 5. The stamped due of the final 50% ────────────────────────────────────
-- NULL keeps the pre-item-12 rule (triggered_at + the live number) for any row queued before
-- this column existed. Production has none queued (read 25 Sep 2026).
ALTER TABLE escrow_entries ADD COLUMN IF NOT EXISTS release_due_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_escrow_t3_due ON escrow_entries (release_due_at) WHERE status = 'queued';
COMMENT ON COLUMN escrow_entries.release_due_at IS
  'Item 12. When this tranche is released, STAMPED at the moment that starts its clock (the brand confirming the content is live). A later change to final_payment_wait_days never moves it.';

-- ─── 6. Delayed — the five content stages ───────────────────────────────────
ALTER TABLE campaign_influencers DROP CONSTRAINT IF EXISTS ci_delayed_stage_known;
ALTER TABLE campaign_influencers ADD CONSTRAINT ci_delayed_stage_known CHECK (
  delayed_stage IS NULL OR delayed_stage IN (
    'plan_not_sent','time_not_agreed','not_attended','not_confirmed','content_not_live',
    'address_not_sent','not_booked','in_transit','not_checked','shoot_not_marked',
    'content_not_submitted','content_in_review','content_changes_requested',
    'content_not_posted','content_not_confirmed'));

-- ─── 7. The Admin numbers ───────────────────────────────────────────────────
INSERT INTO platform_settings (key, value, min_value, max_value, unit, label) VALUES
  ('content_change_rounds',       2, 1,  5, 'rounds', 'Content change requests'),
  ('content_report_silence_days', 7, 1, 30, 'days',   'Brand silence before the Creator may report')
ON CONFLICT (key) DO NOTHING;
-- Q4: the waiting period MOVES here with its audit. The current value is carried across (clamped
-- to 1–60); payment_config.tranche_3_release_after_days stays in place and is no longer read.
INSERT INTO platform_settings (key, value, min_value, max_value, unit, label)
SELECT 'final_payment_wait_days',
       LEAST(60, GREATEST(1, COALESCE((SELECT tranche_3_release_after_days FROM payment_config LIMIT 1), 7))),
       1, 60, 'days', 'Final payment waiting period'
ON CONFLICT (key) DO NOTHING;

-- ─── 8. The manual escrow release's audit row (Q13) ─────────────────────────
CREATE TABLE IF NOT EXISTS escrow_manual_releases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_entry_id uuid NOT NULL REFERENCES escrow_entries(id) ON DELETE RESTRICT,
  tranche_number  integer NOT NULL,
  amount          numeric(10,2) NOT NULL,
  admin_user_id   uuid NOT NULL,
  reason          text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 5 AND 500),
  released_at     timestamptz NOT NULL DEFAULT now()
);

-- Post-migration checks (informational — scripts/run-192.js --dry prints all of them):
--   SELECT count(*) FROM collab_content;                                     -- 0 (new)
--   SELECT count(*) FROM content_files;                                      -- 0 (new)
--   SELECT count(*) FROM escrow_entries WHERE release_due_at IS NOT NULL;    -- 0
--   SELECT key, value FROM platform_settings WHERE key IN
--     ('content_change_rounds','content_report_silence_days','final_payment_wait_days'); -- 2, 7, 7
--   escrow / contracts / wallets / ledger — identical before and after.
