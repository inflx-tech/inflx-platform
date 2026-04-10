-- Migration 015: Brand location (lat/lng) for distance-based features
ALTER TABLE brands ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8);
ALTER TABLE brands ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8);

-- Index for geo queries
CREATE INDEX IF NOT EXISTS idx_brands_location
  ON brands (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
