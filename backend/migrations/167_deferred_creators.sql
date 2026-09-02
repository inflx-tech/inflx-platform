-- 167 — A creator who cannot accept the set's day or shoot moves to a holding pool,
-- with what she'd actually prefer, instead of being fully declined.
-- Contract: features/stage-a-the-set
-- Design:   features/screen-atlas (mockup-locked 2026-09-01) — SB-24's "Moved out",
--           the founder's own words, 2026-09-02: "we need to make in single button
--           ... she [picks] date and mode of work ... reaches brand ... brand wants
--           he create another set for those deferred or reservations candidates."
--
-- WHY NOT WHAT THE IMPLEMENTATION PLAN ORIGINALLY SKETCHED
-- Docs/IMPLEMENTATION_PLAN.md's migration 170 proposed campaign_influencers.set_id
-- becoming NULLABLE, so a deferred creator points at no set at all. Checked against
-- the actual codebase before writing this: set_id is the ONLY path from a creator's
-- row back to her campaign (every contract, deliverable, offer and PDF query joins
-- campaign_influencers -> campaign_sets -> campaigns through it). Nulling it would
-- make her silently vanish from dozens of existing queries that have no reason to
-- expect that today.
--
-- So this does something smaller and safer: her row keeps its set_id — she stays
-- linked to the set she was ORIGINALLY invited into, which is also useful history —
-- and gets a new STATUS instead, plus what she asked for. Nothing that already reads
-- campaign_influencers by set_id needs to change; a caller that cares about "who is
-- still active in this set" already filters status, the same way it already
-- excludes 'declined' and 'expired'.
--
-- WHAT "BUILD A SET FROM THESE" DOES WITH THIS DATA
-- Not a re-negotiation. Her money, allocation and offer were already settled and are
-- not in question — only the day and the shoot are. Bringing her into a new set
-- copies those settled terms across, the same way duplicateSet already copies a
-- whole set's creators. No new negotiation machinery, no migration 168/169
-- (negotiation-thread infrastructure) — this is deliberately a smaller slice of what
-- the atlas calls Stage B, not the whole of it.
--
-- Additive, nullable, no defaults, IF NOT EXISTS throughout. No existing row is
-- touched — every one of them keeps its current status and has NULL in all four new
-- columns, which is exactly true of them.

ALTER TYPE campaign_influencer_status ADD VALUE IF NOT EXISTS 'deferred';

BEGIN;

ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS deferred_at             timestamptz,
  ADD COLUMN IF NOT EXISTS deferred_go_live_date    date,
  ADD COLUMN IF NOT EXISTS deferred_shoot_mode      text,
  ADD COLUMN IF NOT EXISTS deferred_note            text;

COMMENT ON COLUMN campaign_influencers.deferred_at IS
  'When she raised a reservation about the set''s fixed day or shoot mode, from her '
  'invite screen (SC-05), before accepting. NULL for every row that never did. Her '
  'status moves to ''deferred'' at the same time — she is no longer counted as one '
  'of the set''s active creators, but her row (and its settled money/allocation/'
  'offer) is not thrown away either.';

COMMENT ON COLUMN campaign_influencers.deferred_go_live_date IS
  'The day she would actually be available, if different from the set''s go_live_date. '
  'Either this or deferred_shoot_mode may be set alone — she might only have an issue '
  'with one of the two.';

COMMENT ON COLUMN campaign_influencers.deferred_shoot_mode IS
  'The shoot mode she''d prefer instead, if different from the set''s shoot_mode. Same '
  'vocabulary as campaign_sets.shoot_mode (visit / shipment / remote) — see the CHECK '
  'below.';

COMMENT ON COLUMN campaign_influencers.deferred_note IS
  'Her own words on why, optional. Same reasoning as declined_note (163): the useful '
  'information is almost never which field she picked, it is "I can only shoot on a '
  'weekend" — something a brand can actually act on when building the next set.';

DO $$ BEGIN
  ALTER TABLE campaign_influencers
    ADD CONSTRAINT campaign_influencers_deferred_shoot_mode_known
    CHECK (deferred_shoot_mode IS NULL OR deferred_shoot_mode IN ('visit', 'shipment', 'remote'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
