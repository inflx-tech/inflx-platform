-- 164_shoot_two_sided_completion.sql
-- Contract: features/shoot-starts-where-the-agreement-left-it
--
-- Founder, 2026-08-28, reviewing what Stage 4 actually shipped:
--   "we designed in stage 4 that if it is store visit then both will mark it as done...
--    if it is remote then creator mark it as done...all these are absent"
--
-- WHAT WAS BUILT INSTEAD
-- completeShoot writes a single visit_completed_at and flips status to 'completed' the moment
-- ONE side calls it. parcel.service.MAY_COMPLETE says visit: ['brand','influencer'] — which is
-- correct about who is ALLOWED to mark it, and was then read as who is SUFFICIENT to close it.
--
-- Those are different questions. A store visit involves two people being in the same room; the
-- honest record is that both of them say it happened. One side closing it alone lets a brand
-- assert a visit the creator says never took place, and lets a creator close a visit the brand
-- was not present for.
--
-- Remote and shipment stay one-sided, and deliberately so: the brand cannot see whether she has
-- shot anything, so letting them assert it would be letting them state something they cannot know.
--
-- ADDITIVE. Two nullable timestamps. Nothing is dropped and no existing value is rewritten
-- except the backfill below, which only makes already-completed rows self-consistent.

BEGIN;

ALTER TABLE production_events
  ADD COLUMN IF NOT EXISTS brand_completed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS influencer_completed_at timestamptz;

COMMENT ON COLUMN production_events.brand_completed_at IS
  'When the BRAND said the shoot happened. On a store visit both sides must mark it before the event completes (founder 2026-08-28); on remote/shipment the brand cannot mark it at all, because they cannot see whether it happened.';

COMMENT ON COLUMN production_events.influencer_completed_at IS
  'When the CREATOR said the shoot happened. Sufficient on its own for remote and shipment; on a store visit it must be joined by the brand''s.';

-- Rows already completed keep their meaning. Without this they would read as half-marked and the
-- screens would ask two people to confirm a visit that finished weeks ago.
UPDATE production_events
   SET brand_completed_at      = COALESCE(brand_completed_at, visit_completed_at, updated_at),
       influencer_completed_at = COALESCE(influencer_completed_at, visit_completed_at, updated_at)
 WHERE status = 'completed';

COMMIT;

-- Post-migration checks (informational):
--   SELECT count(*) FROM production_events;                                    -- unchanged
--   SELECT count(*) FROM production_events WHERE status = 'completed'
--     AND (brand_completed_at IS NULL OR influencer_completed_at IS NULL);     -- expect 0
--   SELECT count(*) FROM production_events WHERE status <> 'completed'
--     AND (brand_completed_at IS NOT NULL OR influencer_completed_at IS NOT NULL);  -- expect 0
