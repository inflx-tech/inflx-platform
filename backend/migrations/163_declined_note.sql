-- 163_declined_note.sql
-- Contract: features/brief-straight-to-signing
--
-- Founder, 2026-08-28, choosing "sign or decline" over "sign or let's talk":
--   "your recommendations is fine...with clear remarks from creator"
--
-- WHY A CATEGORY IS NOT ENOUGH
-- campaign_influencers.declined_reason already exists and holds one of five fixed values —
-- not_relevant, fee_too_low, schedule_conflict, already_partnered, other. That tells a brand
-- WHICH BOX she ticked and nothing about why.
--
-- Under the new flow it matters more than it did. She is no longer declining an offer she was
-- seeing for the first time; she is declining a deal she had already agreed, after reading the
-- campaign around it. The useful information is almost never the category — it is "the store
-- visit is 40km from me" or "I can't sell only jackets, my followers come for sarees".
--
-- Without somewhere to write that, a brand gets "fee_too_low" on a fee she already accepted,
-- and learns nothing they can act on.
--
-- Additive, nullable, no default, no backfill. Every existing declined row keeps its category
-- and simply has no note, which is exactly true of them.

BEGIN;

ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS declined_note text;

COMMENT ON COLUMN campaign_influencers.declined_note IS
  'The creator''s own words when she declines, alongside the declined_reason category. Optional. Added when briefing moved to sign-or-decline (founder 2026-08-28) — she is now declining a deal she had already agreed, so WHY matters more than which box she ticked. A brand who reads "the store visit is 40km from me" can fix it; "schedule_conflict" tells them nothing.';

COMMIT;

-- Post-migration checks (informational):
--   SELECT count(*) FROM campaign_influencers;              -- unchanged
--   SELECT count(declined_note) FROM campaign_influencers;  -- expect 0
