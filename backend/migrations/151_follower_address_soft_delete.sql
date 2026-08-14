-- 151_follower_address_soft_delete.sql — deletable addresses (Slice 1)
-- Contract: features/follower-profile-repairs/
--
-- A follower cannot remove an address today: /followers/addresses has POST,
-- GET and PATCH but no DELETE. Someone who moves house carries the old flat in
-- their checkout picker forever.
--
-- The delete MUST be soft. follower_orders.address_id REFERENCES
-- follower_addresses(id) with no ON DELETE clause, so a hard delete either
-- fails on the FK or destroys the shipping address of a past order. Order
-- history has to keep resolving where it actually shipped.
--
-- Every address READ path filters deleted_at IS NULL; the order-history join
-- deliberately does not.

BEGIN;

ALTER TABLE follower_addresses
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Live-address lookups are the hot path; deleted rows are read only via an
-- order's own FK, one row at a time.
CREATE INDEX IF NOT EXISTS idx_follower_addresses_live
  ON follower_addresses (follower_id) WHERE deleted_at IS NULL;

COMMIT;
