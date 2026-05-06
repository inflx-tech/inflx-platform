-- Migration 033: typed booking_type + date_range fields on follower_bookings
-- Additive + relaxes two NOT NULL constraints. Backwards compatible.
--
-- Background
-- ----------
-- Until now `follower_bookings` carried only table/slot bookings (booking_date
-- + booking_time, guest_count). The booking type was implicit — inferred from
-- which columns were populated and whether the parent transaction had an
-- offer_id. car_rental's date-range bookings were shoehorned through the same
-- shape with duration + pickup serialized into the parent transaction's
-- `notes` field — see contracts-v1.2.md §6 for the long write-up.
--
-- This migration makes the booking type explicit and adds first-class
-- date-range columns so the shoehorn can retire.
--
-- Co-shipped consumer updates (same atomic commit)
-- -------------------------------------------------
-- 1. transaction.controller.js  — verifyPrebook now writes booking_type
--                                  (defaults to 'table'). New
--                                  initiatePrebookDateRange + verify pair
--                                  writes booking_type='date_range' plus
--                                  the four new columns.
-- 2. transaction.routes.js      — adds POST /follower/prebook-daterange (+ /verify)
-- 3. booking-reminder.job.js    — cron WHERE clause extended to match
--                                  pickup_date = CURRENT_DATE for date_range
--                                  rows. Without this update, car_rental
--                                  bookings would silently miss reminder day.
--                                  This connection is non-obvious from
--                                  reading the migration alone — flagged
--                                  here so future archaeologists see it.
-- 4. brand.controller.js        — listBrandOrders SELECT surfaces the new
--    + influencer.controller.js   columns in dashboard payloads.
-- 5. tests/prebook-daterange    — new test file mirrors prebook.test.js shape.
--
-- Mobile (CarBookingScreen.handlePay) lands in a follow-up commit; the legacy
-- /follower/prebook shoehorn keeps working until it does.

-- 1. Relax existing NOT NULL constraints — date_range bookings have no
--    booking_date or booking_time. New rows for table/slot continue to
--    populate them as before.
ALTER TABLE follower_bookings ALTER COLUMN booking_date DROP NOT NULL;
ALTER TABLE follower_bookings ALTER COLUMN booking_time DROP NOT NULL;

-- 2. Typed discriminator. Allowed values today:
--    'table', 'slot', 'appointment', 'date_range'.
--    NULL means a legacy row created before this migration — consumers
--    treat NULL as 'table' for back-compat (matches the only producer at
--    that time, which was restaurant table-style bookings).
ALTER TABLE follower_bookings ADD COLUMN IF NOT EXISTS booking_type varchar(20);

-- 3. date_range fields. All nullable; populated only when booking_type='date_range'.
ALTER TABLE follower_bookings ADD COLUMN IF NOT EXISTS pickup_date   date;
ALTER TABLE follower_bookings ADD COLUMN IF NOT EXISTS return_date   date;
ALTER TABLE follower_bookings ADD COLUMN IF NOT EXISTS duration_days int;
ALTER TABLE follower_bookings ADD COLUMN IF NOT EXISTS pickup_type   varchar(20);

-- 4. Index supporting the booking-reminder cron's pickup_date scan.
--    Existing booking_date is already covered by primary access patterns
--    (transaction joins); pickup_date is a new scan target.
CREATE INDEX IF NOT EXISTS idx_follower_bookings_pickup_date
  ON follower_bookings (pickup_date) WHERE pickup_date IS NOT NULL;

COMMENT ON COLUMN follower_bookings.booking_type  IS 'Discriminator: table | slot | appointment | date_range. NULL = legacy row, treat as table.';
COMMENT ON COLUMN follower_bookings.booking_date  IS 'Required for booking_type IN (table, slot, appointment). NULL when booking_type=date_range.';
COMMENT ON COLUMN follower_bookings.booking_time  IS 'Required for booking_type IN (table, slot, appointment). NULL when booking_type=date_range.';
COMMENT ON COLUMN follower_bookings.pickup_date   IS 'date_range only — vehicle pickup / rental start date.';
COMMENT ON COLUMN follower_bookings.return_date   IS 'date_range only — vehicle return / rental end date.';
COMMENT ON COLUMN follower_bookings.duration_days IS 'date_range only — convenience field, also derivable from pickup/return.';
COMMENT ON COLUMN follower_bookings.pickup_type   IS 'date_range only — garage | doorstep (or future custom values).';
