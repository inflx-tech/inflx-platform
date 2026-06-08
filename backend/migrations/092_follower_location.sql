-- 092 — Follower location capture (for nearest-first discovery + area name).
--
-- followers currently has only `city` (text). Add the device-resolved last known
-- coordinates + reverse-geocoded area name so the section engine can rank by
-- Haversine distance and Home can show the follower's area. Set by
-- POST /v1/follower/location. Additive, nullable — no backfill, no behaviour
-- change until coordinates arrive. (Migration 090/091 were consumed earlier this
-- session by home stories + greeting; this is the next free number.)

ALTER TABLE followers ADD COLUMN IF NOT EXISTS last_lat            numeric(10,6);
ALTER TABLE followers ADD COLUMN IF NOT EXISTS last_lng            numeric(10,6);
ALTER TABLE followers ADD COLUMN IF NOT EXISTS area_name           text;
ALTER TABLE followers ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;
