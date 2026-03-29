-- Migration 002: Add columns that were missing from the initially applied schema
-- Run this against your database if you get "column does not exist" errors.

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS brief text;

-- Campaign sets: new fields for full campaign creation vision
ALTER TABLE campaign_sets ADD COLUMN IF NOT EXISTS brief text;
ALTER TABLE campaign_sets ADD COLUMN IF NOT EXISTS coupon_prefix varchar(40);
ALTER TABLE campaign_sets ADD COLUMN IF NOT EXISTS formats_json jsonb DEFAULT '[]';
ALTER TABLE campaign_sets ADD COLUMN IF NOT EXISTS assets_json jsonb DEFAULT '[]';
ALTER TABLE campaign_sets ADD COLUMN IF NOT EXISTS per_influencer_budget numeric(10,2);
ALTER TABLE campaign_sets ADD COLUMN IF NOT EXISTS influencer_mode varchar(20) DEFAULT 'handpick';
ALTER TABLE campaign_sets ADD COLUMN IF NOT EXISTS open_group_filters jsonb DEFAULT '{}';
ALTER TABLE campaign_sets ADD COLUMN IF NOT EXISTS max_cap integer;
ALTER TABLE campaign_sets ADD COLUMN IF NOT EXISTS window_start date;
ALTER TABLE campaign_sets ADD COLUMN IF NOT EXISTS window_end date;
ALTER TABLE campaign_sets ADD COLUMN IF NOT EXISTS set_budget numeric(12,2);

-- Campaign influencers: new fields for per-influencer config
ALTER TABLE campaign_influencers ADD COLUMN IF NOT EXISTS offer_type varchar(30);
ALTER TABLE campaign_influencers ADD COLUMN IF NOT EXISTS offer_config_json jsonb;
ALTER TABLE campaign_influencers ADD COLUMN IF NOT EXISTS commission_pct numeric(5,2);
ALTER TABLE campaign_influencers ADD COLUMN IF NOT EXISTS coupon_code varchar(80);
ALTER TABLE campaign_influencers ADD COLUMN IF NOT EXISTS physical_delivery bool DEFAULT false;
ALTER TABLE campaign_influencers ADD COLUMN IF NOT EXISTS delivery_address text;
ALTER TABLE campaign_influencers ADD COLUMN IF NOT EXISTS post_date date;
ALTER TABLE campaign_influencers ADD COLUMN IF NOT EXISTS submission_deadline timestamptz;
ALTER TABLE campaign_influencers ADD COLUMN IF NOT EXISTS influencer_budget numeric(10,2);

-- Brand products: add SKU if missing
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS sku varchar(80);
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS is_active bool DEFAULT true;

-- Unique constraint on coupon codes (platform-wide)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaign_influencers_coupon_code_key'
  ) THEN
    ALTER TABLE campaign_influencers ADD CONSTRAINT campaign_influencers_coupon_code_key UNIQUE (coupon_code);
  END IF;
END $$;
