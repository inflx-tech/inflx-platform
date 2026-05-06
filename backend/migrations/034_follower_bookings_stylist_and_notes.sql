-- Migration 034: stylist_id + notes columns on follower_bookings
-- Additive only.
--
-- Background
-- ----------
-- Salon's SlotPickerScreen (PR-B step 3.5) collects an optional stylist
-- choice when the picked service has requires_stylist_choice=true, plus a
-- free-form notes field for anything the customer wants the salon to know
-- ahead of the appointment.
--
-- Migration 033 added booking_type + the four date_range columns. This
-- migration completes the per-booking-type field set with two more nullable
-- columns that are populated only by the appointment booking_type today
-- (and any future booking type that needs them).
--
-- Co-shipped consumer updates (same atomic commit as 034)
-- -------------------------------------------------------
-- 1. transaction.controller.js  — verifyPrebook accepts optional stylist_id
--                                  + notes from req.body when booking_type
--                                  is 'appointment' or 'slot'. Writes them
--                                  into the follower_bookings INSERT.
-- 2. brand.controller.js        — listBrandOrders SELECT surfaces both
--    + influencer.controller.js   columns so brand/influencer dashboards
--                                  show them.
-- 3. SlotPickerScreen           — sends stylist_id + notes in the prebook
--                                  body. Backend persists; salon staff
--                                  sees the customer's choice + notes in
--                                  their order list.
--
-- Defensive handling: SlotPickerScreen filters out stylist_ids that don't
-- resolve in brand_data.team_members (per spec section 6 — dangling-ref
-- defense). When team_members is reorganized post-booking, the displayed
-- name on the brand dashboard may say "Unknown stylist" but the booking
-- record itself is preserved.

ALTER TABLE follower_bookings ADD COLUMN IF NOT EXISTS stylist_id varchar(40);
ALTER TABLE follower_bookings ADD COLUMN IF NOT EXISTS notes      text;

-- Index supporting "show me this stylist's upcoming appointments" queries
-- (planned salon staff dashboard view; not used in PR-B itself).
CREATE INDEX IF NOT EXISTS idx_follower_bookings_stylist
  ON follower_bookings (stylist_id) WHERE stylist_id IS NOT NULL;

COMMENT ON COLUMN follower_bookings.stylist_id IS 'Optional stylist choice (UUID) from team_members, populated when booking_type=appointment AND service.requires_stylist_choice=true. May be a dangling ref if the brand later removed the stylist — consumers should resolve defensively against current brand_data.team_members.';
COMMENT ON COLUMN follower_bookings.notes      IS 'Optional free-form note from the customer, surfaced to brand staff in the orders dashboard. Used by appointment booking_type today; may be used by other types in future.';
