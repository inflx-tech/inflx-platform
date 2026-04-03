-- 011_follower_app_redesign.sql
-- Follower App Redesign: new tables for influencer product notes, saved offers, follower city

-- Influencer product notes (personal recommendation per product per campaign)
CREATE TABLE IF NOT EXISTS influencer_product_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id),
  product_id    UUID NOT NULL REFERENCES brand_products(id),
  campaign_id   UUID NOT NULL REFERENCES campaigns(id),
  note_text     TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(influencer_id, product_id, campaign_id)
);

-- Follower saved/bookmarked offers
CREATE TABLE IF NOT EXISTS follower_saved_offers (
  follower_id   UUID NOT NULL REFERENCES followers(id),
  offer_id      UUID NOT NULL REFERENCES campaign_offers(id),
  influencer_id UUID REFERENCES influencers(id),
  saved_at      TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (follower_id, offer_id)
);

-- Add city column to followers table for location-based feed
ALTER TABLE followers ADD COLUMN IF NOT EXISTS city VARCHAR(60);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_followers_city ON followers(city);
CREATE INDEX IF NOT EXISTS idx_brand_products_brand_active ON brand_products(brand_id, is_active);
CREATE INDEX IF NOT EXISTS idx_influencer_product_notes_inf ON influencer_product_notes(influencer_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_follower_saved_offers_follower ON follower_saved_offers(follower_id);
CREATE INDEX IF NOT EXISTS idx_campaign_offers_set_active ON campaign_offers(set_id, is_active);
