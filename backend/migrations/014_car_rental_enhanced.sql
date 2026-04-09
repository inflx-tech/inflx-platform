-- Migration 014: Enhanced car rental master data
-- Adds spec columns + pricing benchmarks to master_vehicles for the listing engine

-- Add new columns to master_vehicles
ALTER TABLE master_vehicles ADD COLUMN IF NOT EXISTS engine_cc VARCHAR(20);
ALTER TABLE master_vehicles ADD COLUMN IF NOT EXISTS kmpl VARCHAR(10);
ALTER TABLE master_vehicles ADD COLUMN IF NOT EXISTS ac BOOLEAN DEFAULT true;
ALTER TABLE master_vehicles ADD COLUMN IF NOT EXISTS sunroof BOOLEAN DEFAULT false;
ALTER TABLE master_vehicles ADD COLUMN IF NOT EXISTS features_json JSONB DEFAULT '[]';
ALTER TABLE master_vehicles ADD COLUMN IF NOT EXISTS variants_json JSONB DEFAULT '[]';
ALTER TABLE master_vehicles ADD COLUMN IF NOT EXISTS day_rate_min INTEGER;
ALTER TABLE master_vehicles ADD COLUMN IF NOT EXISTS day_rate_max INTEGER;
ALTER TABLE master_vehicles ADD COLUMN IF NOT EXISTS km_rate_min INTEGER;
ALTER TABLE master_vehicles ADD COLUMN IF NOT EXISTS km_rate_max INTEGER;
ALTER TABLE master_vehicles ADD COLUMN IF NOT EXISTS services_json JSONB DEFAULT '[]';
ALTER TABLE master_vehicles ADD COLUMN IF NOT EXISTS segment_label VARCHAR(40);
