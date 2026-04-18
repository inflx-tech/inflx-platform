-- 016_offer_expiry_use_posting_date.sql
-- Switches offer-expiry rule from "now + 48h" to "= posting_date".
--
-- After this migration:
--   * New invites (campaign.controller.js) write offer_expires_at = posting_date.
--   * The offer-expiry cron flips status='invited' rows to 'expired' once
--     their posting_date passes (existing query unchanged in semantics).
--
-- This file does TWO things to existing rows:
--   1. Realign offer_expires_at to posting_date for all currently-invited rows
--      (so they no longer expire on the old 48h-from-invite clock).
--   2. Revive rows that were prematurely marked 'expired' under the old rule
--      but whose posting_date is still in the future — flip them back to
--      'invited' and recompute offer_expires_at.
--
-- Rows whose posting_date is NULL get offer_expires_at = NULL (never auto-expire
-- until a posting_date is assigned).

BEGIN;

-- 1. Realign every still-invited offer to its posting_date.
UPDATE campaign_influencers
SET    offer_expires_at = posting_date
WHERE  status = 'invited';

-- 2. Revive offers that the old 48h cron expired but whose posting_date is
--    still in the future (or unset). These should have been 'invited' all along
--    under the new rule.
UPDATE campaign_influencers
SET    status           = 'invited',
       offer_expires_at = posting_date
WHERE  status = 'expired'
  AND  (posting_date IS NULL OR posting_date > now());

COMMIT;
