-- 010_brand_products_missing_columns.sql
-- Add missing columns referenced by brand.controller.js createProduct

ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS description       TEXT;
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS is_bookable       BOOLEAN DEFAULT false;
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS stock             INTEGER;
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS availability_json JSONB DEFAULT '{}';
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS booking_config_json JSONB DEFAULT '{}';
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ DEFAULT now();
