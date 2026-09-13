-- 181 — Item 5: the invitation as an EVENT — when it was sent, by whom, from which door, the
-- personal note, usage rights, the answer time, and the brand's two exits (withdraw / remove).
-- Contract: features/item5-invitations · rules v1.16 §7A · gap report §13 · APPROVAL.md §3.1, §4.1
--
-- Additive. One small backfill (founder, APPROVAL.md §3.1): every existing row was sent, so
-- invited_at = created_at; source = 'pitch' where it came through an agreement, 'legacy' otherwise.
--
-- The two enum values are added first. PostgreSQL 12+ allows ADD VALUE inside a transaction as
-- long as the NEW value is not USED in the same transaction — nothing below names them: the
-- partial unique index lists the LIVE statuses instead, which is also the honest rule
-- ("a creator who is live in this set cannot be chosen again"; a dead, withdrawn, removed or
-- deferred row never blocks a fresh invitation).
BEGIN;

ALTER TYPE campaign_influencer_status ADD VALUE IF NOT EXISTS 'withdrawn';
ALTER TYPE campaign_influencer_status ADD VALUE IF NOT EXISTS 'removed';

ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS invited_at        timestamptz,
  ADD COLUMN IF NOT EXISTS answered_at       timestamptz,
  ADD COLUMN IF NOT EXISTS invited_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source            text,
  ADD COLUMN IF NOT EXISTS source_group_id   uuid REFERENCES influencer_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS brand_note        text,
  ADD COLUMN IF NOT EXISTS usage_rights_json jsonb,
  ADD COLUMN IF NOT EXISTS withdrawn_at      timestamptz,
  ADD COLUMN IF NOT EXISTS withdrawn_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS removed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by        uuid REFERENCES users(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE campaign_influencers
    ADD CONSTRAINT campaign_influencers_source_check
    CHECK (source IS NULL OR source IN ('brand_picker', 'group', 'pitch', 'open_group', 'legacy'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The note is capped at 300 characters in code (§7); the column carries the same rule so no
-- other writer can exceed it.
DO $$ BEGIN
  ALTER TABLE campaign_influencers
    ADD CONSTRAINT campaign_influencers_brand_note_len CHECK (brand_note IS NULL OR char_length(brand_note) <= 300);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill (APPROVAL.md §3.1): the eight production rows were all sent.
UPDATE campaign_influencers SET invited_at = created_at WHERE invited_at IS NULL;
UPDATE campaign_influencers
   SET source = CASE WHEN agreement_id IS NOT NULL THEN 'pitch' ELSE 'legacy' END
 WHERE source IS NULL;

-- One LIVE invitation per creator per set. Dead, withdrawn, removed and deferred rows are
-- outside the index, so re-inviting after any of them is allowed (rules §7A).
CREATE UNIQUE INDEX IF NOT EXISTS uq_ci_live_per_set
  ON campaign_influencers (set_id, influencer_id)
  WHERE status IN ('invited', 'applied', 'accepted', 'negotiating', 'contracted', 'active', 'completed');

-- The set screen lists a set's creators newest first.
CREATE INDEX IF NOT EXISTS idx_ci_set_created ON campaign_influencers (set_id, created_at DESC);

COMMENT ON COLUMN campaign_influencers.invited_at IS 'Item 5: the moment the invitation was sent. Present on every row; the "never edit a sent row" guard tests it.';
COMMENT ON COLUMN campaign_influencers.answered_at IS 'Item 5: when the creator accepted or declined. Null while waiting.';
COMMENT ON COLUMN campaign_influencers.source IS 'Item 5: the door the row came through — brand_picker, group, pitch (briefed agreement), open_group (legacy broadcast), legacy.';
COMMENT ON COLUMN campaign_influencers.source_group_id IS 'Item 5: the creator group the brand invited from. Never shown to creators.';
COMMENT ON COLUMN campaign_influencers.brand_note IS 'Item 5: the brand''s personal note to this creator, at most 300 characters. Shown on her invitation.';
COMMENT ON COLUMN campaign_influencers.usage_rights_json IS 'Item 5 (Pay for Content only): { on, duration_days | null (forever), places[] } — places ⊆ social, ads, website.';
COMMENT ON COLUMN campaign_influencers.withdrawn_at IS 'Item 5: the brand pulled back an unanswered invitation (status withdrawn). No reason is ever stored.';
COMMENT ON COLUMN campaign_influencers.removed_at IS 'Item 5: the brand took the creator out before both signatures (status removed). No reason is ever stored.';

COMMIT;
