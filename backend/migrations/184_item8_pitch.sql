-- 184_item8_pitch.sql
-- Item 8 — the creator's pitch.
-- Rules doc v1.21 §8 (rewritten) and §7B (amended). Contract: features/item8-pitch.
--
-- Additive only. Nothing is dropped, no value is rewritten, nothing is backfilled.
-- The nineteen ready agreements are left to their existing ninety-day clock and
-- are not converted, not notified about, and not shown anywhere (approval Q6).
--
-- Four parts:
--   A. one negotiation engine — the thread can hang off a pitch (approval Q1)
--   B. the pitch as item 8 needs it, and the two limits
--   C. the pool learns where an entry came from (T11's tag)
--   D. the two admin numbers join item 6's page

BEGIN;

-- ---------------------------------------------------------------------------
-- A. ONE ENGINE (approval Q1).
--
--    `negotiations.campaign_influencer_id` has been NOT NULL, UNIQUE and
--    foreign-keyed since migration 001, so a pitch-anchored thread could not be
--    inserted at all. The rules now say pitch negotiation IS the invitation
--    mechanism, so the anchor becomes one of two and exactly one must be set.
--
--    Free to do: production holds zero negotiation rows.
-- ---------------------------------------------------------------------------
ALTER TABLE negotiations ALTER COLUMN campaign_influencer_id DROP NOT NULL;

ALTER TABLE negotiations
  ADD COLUMN IF NOT EXISTS pitch_id uuid REFERENCES influencer_proposals(id) ON DELETE CASCADE;

-- The inline UNIQUE cannot express "unique when present", so it is replaced by
-- two partial unique indexes — one per anchor.
ALTER TABLE negotiations DROP CONSTRAINT IF EXISTS negotiations_campaign_influencer_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_neg_ci
  ON negotiations (campaign_influencer_id) WHERE campaign_influencer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_neg_pitch
  ON negotiations (pitch_id) WHERE pitch_id IS NOT NULL;

-- Exactly one anchor. A thread with neither, or both, is a bug we want the
-- database to refuse rather than the application to discover later.
ALTER TABLE negotiations DROP CONSTRAINT IF EXISTS negotiations_one_anchor;
ALTER TABLE negotiations ADD CONSTRAINT negotiations_one_anchor
  CHECK ((campaign_influencer_id IS NOT NULL) <> (pitch_id IS NOT NULL));

-- ---------------------------------------------------------------------------
-- B. The pitch.
--
--    `influencer_proposals` already carries the creator, the brand, the Aim and
--    the money. What it lacks is a real posting date, a response deadline that
--    anything reads, the reminders, the cooldown and the link to the pool entry
--    acceptance creates.
-- ---------------------------------------------------------------------------
ALTER TABLE influencer_proposals
  -- One date, not a window. The brand builds a set around it, and it closes the
  -- pitch early when it comes too close for a set to be built at all.
  ADD COLUMN IF NOT EXISTS proposed_go_live_date date,
  -- Stamped at send from the admin number, so a later change never moves a
  -- pitch already in flight. Governs the brand's FIRST answer only (approval Q2).
  ADD COLUMN IF NOT EXISTS response_due_at      timestamptz,
  ADD COLUMN IF NOT EXISTS response_days        int,
  ADD COLUMN IF NOT EXISTS reminder_7d_sent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_21d_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS answered_by          uuid REFERENCES users(id),
  -- Mirrored from proposal_cooldowns so her list needs one read, and stamped at
  -- rejection so a later admin change never moves it.
  ADD COLUMN IF NOT EXISTS cooldown_until       timestamptz,
  ADD COLUMN IF NOT EXISTS cooldown_days        int,
  -- What acceptance created. A pool entry, and nothing else.
  ADD COLUMN IF NOT EXISTS pool_entry_id        uuid REFERENCES brand_creator_pool(id) ON DELETE SET NULL,
  -- Which ending it reached, for the plain sentence on T14.
  ADD COLUMN IF NOT EXISTS closed_reason        text;

ALTER TABLE influencer_proposals DROP CONSTRAINT IF EXISTS proposals_message_len;
ALTER TABLE influencer_proposals ADD CONSTRAINT proposals_message_len
  CHECK (pitch_message IS NULL OR char_length(pitch_message) <= 500) NOT VALID;

ALTER TABLE influencer_proposals DROP CONSTRAINT IF EXISTS proposals_closed_reason_check;
ALTER TABLE influencer_proposals ADD CONSTRAINT proposals_closed_reason_check
  CHECK (closed_reason IS NULL OR closed_reason IN ('no_reply', 'date_passed', 'withdrawn'));

-- One OPEN pitch per brand per Aim. The database refuses the second; the
-- service turns the violation into the founder's sentence.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pitch_open_per_aim
  ON influencer_proposals (influencer_id, brand_id, goal)
  WHERE status IN ('sent', 'viewed', 'countered');

-- The job's scan: pitches the brand has not answered yet.
CREATE INDEX IF NOT EXISTS idx_pitch_due
  ON influencer_proposals (response_due_at)
  WHERE status IN ('sent', 'viewed', 'countered');

-- The early-close lane: her proposed date coming within item 4's floor.
CREATE INDEX IF NOT EXISTS idx_pitch_date_due
  ON influencer_proposals (proposed_go_live_date)
  WHERE status IN ('sent', 'viewed', 'countered');

-- ---------------------------------------------------------------------------
-- C. The pool learns where an entry came from.
--
--    Item 6 records provenance as three campaign-shaped ids, all of which a
--    pitch leaves null. T11 needs to say "Tanvi came to you on 9 Sep", so the
--    entry has to know it came from a pitch.
--
--    `matched_shoot_mode` is §7B's amendment: it records the mode that was
--    agreed, so item 5's send can tell a matching set (her own settings are not
--    applied against her) from a differing one (every setting applies).
-- ---------------------------------------------------------------------------
ALTER TABLE brand_creator_pool
  ADD COLUMN IF NOT EXISTS from_pitch_id      uuid REFERENCES influencer_proposals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS matched_shoot_mode text;

ALTER TABLE brand_creator_pool DROP CONSTRAINT IF EXISTS pool_matched_shoot_mode_check;
ALTER TABLE brand_creator_pool ADD CONSTRAINT pool_matched_shoot_mode_check
  CHECK (matched_shoot_mode IS NULL OR matched_shoot_mode IN ('visit', 'shipment', 'remote'));

CREATE INDEX IF NOT EXISTS idx_pool_from_pitch
  ON brand_creator_pool (from_pitch_id) WHERE from_pitch_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- D. The two admin numbers, on item 6's page beside the other five.
--    Each is stamped when it is applied, so a later change never moves
--    something already in flight.
-- ---------------------------------------------------------------------------
INSERT INTO platform_settings (key, value, min_value, max_value, unit, label) VALUES
  ('pitch_response_days', 30, 7, 90, 'days', 'Pitch response period'),
  ('pitch_cooldown_days', 30, 0, 90, 'days', 'Pitch rejection cooldown')
ON CONFLICT (key) DO NOTHING;

COMMIT;
