-- 107 — Follower address: receiver + landmark fields for the v2 add-address form.
--
-- The redesigned "Add new address" details screen (after the map pin step)
-- captures WHO receives the order — receiver name + phone, which may differ
-- from the account holder — plus a free-text landmark, on top of the existing
-- label/line1/line2/city/pincode/lat/lng. Additive, nullable — existing rows
-- stay null until re-saved. ("Entry photo" deferred to its own slice; needs R2
-- upload.) Contract: features/follower-location-redesign.

ALTER TABLE follower_addresses ADD COLUMN IF NOT EXISTS receiver_name  varchar(80);
ALTER TABLE follower_addresses ADD COLUMN IF NOT EXISTS receiver_phone varchar(20);
ALTER TABLE follower_addresses ADD COLUMN IF NOT EXISTS landmark       text;
