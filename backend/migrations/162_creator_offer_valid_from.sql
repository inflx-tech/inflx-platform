-- 162_creator_offer_valid_from.sql
-- Contract: features/stage-2-offers-parity (P4)
--
-- THE FOUNDER'S REASON, 2026-08-27
-- "keep that start date as well... set date is for all creators... say one individual creator
--  may be work from different time. offer start and end per creator is necessary."
--
-- He is right, and it is the reason I should not have recommended deriving it. A set's start
-- date is one date for everybody in the set. Creators do not all begin on that day: one signs
-- late, one is travelling, one is asked to hold until a launch. Deriving her offer's start
-- from the set's would have meant a creator who starts three weeks late carries an offer that
-- has been discounting to nobody for three weeks — and there would have been no way to say so.
--
-- WHAT ALREADY EXISTED, AND WHY THIS IS ONE COLUMN AND NOT TWO
-- campaign_influencers.offer_valid_until already carries the END of a creator's offer, and its
-- column comment documents it precisely. Only the START was missing. Adding a matching one
-- rather than a new pair keeps a single vocabulary for the window.
--
-- NOT TO BE CONFUSED WITH offer_expires_at, which is the invitation-acceptance clock — a
-- different thing, on the same table, already documented as distinct.
--
-- Additive, nullable, no default, no backfill. NULL means "no start limit", exactly as NULL on
-- offer_valid_until means "no deadline". Nothing in production carries an offer at all today
-- (0 of 6 rows), so there is nothing this could reinterpret.

BEGIN;

ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS offer_valid_from timestamptz;

COMMENT ON COLUMN campaign_influencers.offer_valid_from IS
  'When this creator''s campaign-level OFFER starts discounting. NULL = no start limit, it applies from the moment she is contracted. Pairs with offer_valid_until, which ends it. Deliberately per-creator rather than derived from the set: the set has one start date for everybody, and creators begin at different times — one signs late, one is asked to hold until a launch. Founder, 2026-08-27. Distinct from offer_expires_at, which is the invitation-acceptance clock.';

COMMIT;

-- Post-migration checks (informational):
--   SELECT count(*) FROM campaign_influencers;                        -- unchanged
--   SELECT count(offer_valid_from) FROM campaign_influencers;         -- expect 0
