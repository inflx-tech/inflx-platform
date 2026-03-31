-- Migration 003a: Add influencer profile columns needed by seed data (003)
-- These columns are referenced in 003_seed_influencers.sql but were missing from 001.
-- Safe to re-run: uses IF NOT EXISTS.

ALTER TABLE influencers ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS tier VARCHAR(20);
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS secondary_niche TEXT[];
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS platform VARCHAR(50) DEFAULT 'Instagram';
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS avg_views INTEGER DEFAULT 0;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS avg_likes INTEGER DEFAULT 0;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS avg_comments INTEGER DEFAULT 0;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
