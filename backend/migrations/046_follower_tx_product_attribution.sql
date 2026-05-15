-- Migration 046: per-product attribution on follower_transactions
--
-- Closes the Q3 gap surfaced in the Phase Salon-3 architecture audit:
-- follower_transactions tracked campaign/set/CI/offer/brand attribution but
-- not product. Per-item product info lived in follower_orders.items_json
-- (online_order only) or in adjacent tables (follower_bookings has stylist_id
-- but no product_id), making per-product creator-economy analytics impossible
-- via a single-row JOIN.
--
-- Resolution model (enforced in transaction.controller.js):
--   1. If mobile sends product_id explicitly → use it (SlotPickerScreen
--      passes service.id, CarBookingScreen passes vehicle.id)
--   2. Else if campaign_offers.products_json has exactly one product →
--      use that
--   3. Else null
--
-- Null is honest: brand-level offers (no specific product), restaurant table
-- prebooks (no product tied to a table), and pay_at_store flows (bill-based,
-- no product picked) all correctly write null. Per-item details for
-- online_order continue to live in follower_orders.items_json — this column
-- denormalizes the *primary* item only, for single-JOIN analytics.
--
-- Additive only. Column is nullable; existing rows stay null.

ALTER TABLE follower_transactions
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES brand_products(id);

-- Partial index — only includes attributed rows. Cheap; targets the
-- "creator-economy analytics" workload (how much commission did Priya earn
-- on Haircut Premium? on Honda City rentals?).
CREATE INDEX IF NOT EXISTS idx_ft_product_attributed
  ON follower_transactions (product_id, campaign_influencer_id)
  WHERE product_id IS NOT NULL;
