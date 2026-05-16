-- 052_brand_booking_review.sql
-- Wave 2 (Dining) — brand-side review workflow on follower_bookings.
--
-- Adds a brand-managed review state independent of the existing booking_status
-- enum. Today follower_bookings.status defaults to 'confirmed' the moment the
-- follower completes payment — that's the booking_status from the follower's
-- perspective (payment cleared, slot reserved).
--
-- The new brand_status column tracks the BRAND's review decision, surfaced in
-- the new BookingsInbox UI:
--   NULL        — not yet reviewed (legacy rows + future brand workflows can
--                  treat NULL as 'confirmed' for back-compat — existing
--                  payment-cleared bookings continue to display as confirmed)
--   'pending'   — restaurant wants explicit acknowledgement before the visit
--                  (set by future PR when restaurant booking flow flips on
--                  brand-confirm-required)
--   'confirmed' — brand acknowledged
--   'rejected'  — brand declined (booking_status is also flipped to
--                  'cancelled' in the same transaction by the API handler;
--                  refund handling is out of scope for this migration)
--
-- The two timestamp columns let the brand inbox sort and audit. Both default
-- to NULL until the corresponding transition fires.

ALTER TABLE follower_bookings
  ADD COLUMN IF NOT EXISTS brand_status        varchar(20),
  ADD COLUMN IF NOT EXISTS brand_confirmed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS brand_rejected_at   timestamptz,
  ADD COLUMN IF NOT EXISTS brand_review_note   text;

-- Index supporting the BookingsInbox "Pending" tab — brand_status = 'pending'
-- AND brand_id = ? — keyed off transaction join. The brand_id lives on
-- follower_transactions, not directly on follower_bookings, so the inbox query
-- joins ft → fb. A partial index on (brand_status) is enough to make the
-- pending bucket fast across the whole table.
CREATE INDEX IF NOT EXISTS idx_follower_bookings_brand_status
  ON follower_bookings (brand_status)
  WHERE brand_status IS NOT NULL;

COMMENT ON COLUMN follower_bookings.brand_status       IS 'Brand review state: NULL (not reviewed, treat as confirmed in UI) | pending | confirmed | rejected. Independent of booking_status (which tracks the follower-side payment/slot lifecycle).';
COMMENT ON COLUMN follower_bookings.brand_confirmed_at IS 'When the brand clicked Confirm in the BookingsInbox.';
COMMENT ON COLUMN follower_bookings.brand_rejected_at  IS 'When the brand clicked Reject. The booking_status is also flipped to cancelled in the same API call.';
COMMENT ON COLUMN follower_bookings.brand_review_note  IS 'Optional internal note the brand attaches when confirming or rejecting (e.g. "no tables available at 8pm — please rebook at 9pm").';
