-- 093 — Follower saved addresses get coordinates, so selecting a saved address
-- (or a typed one) repositions the nearest-first feed to that area.
--
-- follower_addresses had only text (label/line1/line2/city/pincode). Add lat/lng;
-- createAddress now forward-geocodes the address (Google Geocoding, live) on save.
-- Additive, nullable — existing rows stay null until re-saved. (090 home-stories,
-- 091 greeting, 092 follower-location consumed earlier; this is the next number.)

ALTER TABLE follower_addresses ADD COLUMN IF NOT EXISTS lat numeric(10,6);
ALTER TABLE follower_addresses ADD COLUMN IF NOT EXISTS lng numeric(10,6);
