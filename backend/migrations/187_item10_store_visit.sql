-- 187_item10_store_visit.sql
-- Contract: features/item10-store-visit · Docs/ITEM10_STOREVISIT_GAP_REPORT.md §7
--
-- Item 10 — the Store Visit shoot plan. ADDITIVE. No backfill here: the one data
-- correction this item makes (six production_events rows whose mode was invented
-- as 'remote' because the set's shoot_mode never reached the resolver) lives in
-- scripts/run-187.js behind --fix-modes, printed and approved separately.
--
-- Four parts:
--   1. the plan — the columns a store visit actually needs on production_events,
--      on top of the visit_* columns migration 024 already gave it;
--   2. Delayed — a FLAG on the collaboration (rules v1.24 §25: "nothing else
--      moves"), not a status, so item 4's set expiry never sees it;
--   3. the third negotiation anchor — a shoot plan hangs a thread off item 6's
--      engine exactly as a pitch does (184), and the "exactly one anchor" CHECK
--      is rewritten because (a) <> (b) is only "exactly one" for two operands;
--   4. the admin number — how long the brand has to confirm before the visit
--      confirms itself; stamped onto the row when she marks attended.
-- Idempotent throughout.

BEGIN;

-- ─── 1. The plan ──────────────────────────────────────────────────────────────
ALTER TABLE production_events
  ADD COLUMN IF NOT EXISTS branch_id            uuid REFERENCES brand_branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visit_branch_name    text,
  ADD COLUMN IF NOT EXISTS visit_lat            numeric(10,6),
  ADD COLUMN IF NOT EXISTS visit_lng            numeric(10,6),
  ADD COLUMN IF NOT EXISTS visit_duration_text  text,
  ADD COLUMN IF NOT EXISTS visit_notes          text,
  ADD COLUMN IF NOT EXISTS plan_sent_at         timestamptz,
  ADD COLUMN IF NOT EXISTS plan_sent_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS time_agreed_at       timestamptz,
  ADD COLUMN IF NOT EXISTS brand_completed_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_confirm_days    int,
  ADD COLUMN IF NOT EXISTS auto_confirm_due_at  timestamptz,
  ADD COLUMN IF NOT EXISTS auto_confirmed_at    timestamptz;

ALTER TABLE production_events DROP CONSTRAINT IF EXISTS pe_visit_notes_len;
ALTER TABLE production_events ADD CONSTRAINT pe_visit_notes_len
  CHECK (visit_notes IS NULL OR char_length(visit_notes) <= 500) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_pe_auto_confirm_due
  ON production_events (auto_confirm_due_at)
  WHERE auto_confirm_due_at IS NOT NULL AND status <> 'completed';

COMMENT ON COLUMN production_events.branch_id IS
  'Item 10. The set''s branch, copied when the shoot row is born. The address the creator is sent is SNAPSHOTTED into visit_address / visit_city / visit_state / visit_pincode / visit_lat / visit_lng / visit_branch_name at send, so a branch edited or deleted later never rewrites what she was told.';
COMMENT ON COLUMN production_events.plan_sent_at IS
  'Item 10. The moment the brand sent the plan — and the moment the street address and contact number stop being private to the brand. NULL = not sent; the creator sees the branch city only.';
COMMENT ON COLUMN production_events.time_agreed_at IS
  'Item 10. When the visit time was agreed — by her accepting, or by the end of a time negotiation. Cleared when either side moves the time.';
COMMENT ON COLUMN production_events.auto_confirm_days IS
  'Item 10. platform_settings.shoot_auto_confirm_days as it stood when she marked attended. Stamped, never re-read, so an admin change never moves a due date already promised.';
COMMENT ON COLUMN production_events.auto_confirm_due_at IS
  'Item 10. influencer_completed_at + auto_confirm_days. The job confirms the shoot at this moment if the brand has not. Safe because completing a shoot moves no money.';
COMMENT ON COLUMN production_events.auto_confirmed_at IS
  'Item 10. Set when the shoot confirmed ITSELF. brand_completed_at stays NULL in that case, so the record says honestly which of the two happened.';

-- ─── 2. Delayed ───────────────────────────────────────────────────────────────
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS delayed_at    timestamptz,
  ADD COLUMN IF NOT EXISTS delayed_stage text;

ALTER TABLE campaign_influencers DROP CONSTRAINT IF EXISTS ci_delayed_stage_known;
ALTER TABLE campaign_influencers ADD CONSTRAINT ci_delayed_stage_known
  CHECK (delayed_stage IS NULL OR delayed_stage IN
    ('plan_not_sent', 'time_not_agreed', 'not_attended', 'not_confirmed', 'content_not_live'));

CREATE INDEX IF NOT EXISTS idx_ci_delayed ON campaign_influencers (set_id) WHERE delayed_at IS NOT NULL;

COMMENT ON COLUMN campaign_influencers.delayed_at IS
  'Rules v1.24 §11.1/§25. Set the day after the posting date when the collaboration has not reached the step it should have. A LABEL, not a state: status, set, agreement and money are untouched. Item 10 sets it for the shoot; item 12 will set it for content (content_not_live).';
COMMENT ON COLUMN campaign_influencers.delayed_stage IS
  'Where it had got to when the posting date passed: plan_not_sent | time_not_agreed | not_attended | not_confirmed | content_not_live.';

-- ─── 3. The third anchor ──────────────────────────────────────────────────────
ALTER TABLE negotiations
  ADD COLUMN IF NOT EXISTS production_event_id uuid REFERENCES production_events(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_neg_shoot
  ON negotiations (production_event_id) WHERE production_event_id IS NOT NULL;

-- Exactly one anchor, now that there are three. The two-operand XOR from 184
-- would accept a row with all three set.
ALTER TABLE negotiations DROP CONSTRAINT IF EXISTS negotiations_one_anchor;
ALTER TABLE negotiations ADD CONSTRAINT negotiations_one_anchor
  CHECK (num_nonnulls(campaign_influencer_id, pitch_id, production_event_id) = 1);

COMMENT ON COLUMN negotiations.production_event_id IS
  'Item 10. The thread that agrees a store visit TIME. The plan as sent is turn zero; only visitAt is negotiable; there is no decline; the same thread reopens when either side moves an agreed time. round_limit is stamped once and governs every episode.';

-- ─── 4. The admin number ──────────────────────────────────────────────────────
INSERT INTO platform_settings (key, value, min_value, max_value, unit, label)
VALUES ('shoot_auto_confirm_days', 3, 1, 30, 'days', 'Store visit auto-confirm')
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- Post-migration checks (informational):
--   SELECT count(*) FROM production_events;                                            -- unchanged (11 in prod)
--   SELECT count(*) FROM negotiations WHERE num_nonnulls(campaign_influencer_id, pitch_id, production_event_id) <> 1;  -- 0
--   SELECT key, value FROM platform_settings WHERE key = 'shoot_auto_confirm_days';   -- 3
--   SELECT count(*) FROM campaign_influencers WHERE delayed_at IS NOT NULL;           -- 0
