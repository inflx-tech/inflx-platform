-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 174 — Item 3: indexes for Discover creators, Find brands and posts-by-brand.
-- Contract: features/item3-discovery-profiles-groups · gap report §5, §7
--
-- influencers had no index beyond its primary key and two uniques; users had none on
-- status. At today's size nothing is slow — these exist so the discovery queries stay
-- index-backed as the population grows. The creator_posts GIN index is for item 13's
-- "posts made for this brand" (founder decision 11).
--
-- Additive + idempotent. No row touched.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_status_role         ON users (status, role);
CREATE INDEX IF NOT EXISTS idx_influencers_followers     ON influencers (followers_count DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_influencers_youtube_subs  ON influencers (youtube_subscribers DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_influencers_engagement    ON influencers (engagement_rate DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_influencers_city_id       ON influencers (city_id);
CREATE INDEX IF NOT EXISTS idx_influencers_niche_gin     ON influencers USING gin (niche);
CREATE INDEX IF NOT EXISTS idx_influencers_language_gin  ON influencers USING gin (language);
CREATE INDEX IF NOT EXISTS idx_influencers_ig_lower      ON influencers (lower(instagram_handle));
CREATE INDEX IF NOT EXISTS idx_influencers_yt_lower      ON influencers (lower(youtube_handle));
CREATE INDEX IF NOT EXISTS idx_brands_sub_categories_gin ON brands USING gin (sub_categories);
CREATE INDEX IF NOT EXISTS idx_brands_name_lower         ON brands (lower(business_name));
CREATE INDEX IF NOT EXISTS idx_creator_posts_scoped_brands_gin ON creator_posts USING gin (scoped_brand_ids);
