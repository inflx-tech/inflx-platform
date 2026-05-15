-- Migration 050: conversion-flow attribution + linkage columns.
--
-- Closes the analytics gaps + enables the prebook → balance pay-at-store
-- flow surfaced in the Tier-1 conversion audit.
--
-- Additive only. Three new columns on follower_transactions; one on
-- follower_bookings.
--
-- Columns:
--   follower_transactions.variant_id       — which SKU was sold (fashion only
--                                              today; null for everything else)
--   follower_transactions.offer_type       — denormalized from
--                                              campaign_influencers.offer_type so
--                                              analytics can bucket revenue by
--                                              offer mechanic (Discount / Volume /
--                                              BOGO / Bundle / Free gift)
--   follower_transactions.prebook_booking_id — links a balance pay-at-store
--                                              transaction back to its parent
--                                              prebook booking (the Q2 flow).
--                                              Lets reporting answer "how much
--                                              downstream revenue did this
--                                              prebook generate?"
--   follower_bookings.at_venue_discount_pct — when a prebook is created with a
--                                              percentage offer, this captures
--                                              the percent off so the balance-pay
--                                              flow can re-apply it without
--                                              re-querying the offer.

ALTER TABLE follower_transactions
  ADD COLUMN IF NOT EXISTS variant_id          uuid REFERENCES product_variants(id),
  ADD COLUMN IF NOT EXISTS offer_type          text,
  ADD COLUMN IF NOT EXISTS prebook_booking_id  uuid REFERENCES follower_bookings(id);

ALTER TABLE follower_bookings
  ADD COLUMN IF NOT EXISTS at_venue_discount_pct numeric(5,2);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ft_variant
  ON follower_transactions (variant_id) WHERE variant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ft_offer_type
  ON follower_transactions (offer_type) WHERE offer_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ft_prebook_link
  ON follower_transactions (prebook_booking_id) WHERE prebook_booking_id IS NOT NULL;
