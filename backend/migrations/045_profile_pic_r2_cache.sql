-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 045 — R2-cached profile pics for creator_profiles + brand_profiles
--
-- Instagram CDN URLs (`scontent-*.cdninstagram.com/...?oe=<timestamp>`) are
-- time-signed and 403 silently after 1-2 weeks. The admin verification queue,
-- campaign wizard, and invitations queue all render these URLs in <img> tags
-- with onError handlers that hide the broken image — so it looks like no pic
-- was scraped when actually the URL just expired.
--
-- Fix: cache the bytes to R2 at scrape time, store the R2 object key here,
-- and serve a presigned URL (or public R2 URL) at API response time. Stable.
--
-- Both columns are NULLABLE; if caching fails we fall back to the original
-- Instagram URL (which still works for a window after scrape). The image
-- proxy worker updates these fields out-of-band after INGEST.
--
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS profile_pic_r2_key      TEXT,
  ADD COLUMN IF NOT EXISTS profile_pic_cached_at   TIMESTAMPTZ;

ALTER TABLE brand_profiles
  ADD COLUMN IF NOT EXISTS profile_pic_r2_key      TEXT,
  ADD COLUMN IF NOT EXISTS profile_pic_cached_at   TIMESTAMPTZ;

-- Helps a future cron find rows whose IG URL might be stale (cached >14 days
-- ago) so the daily refresh can re-cache. Partial index keeps it tiny.
CREATE INDEX IF NOT EXISTS idx_creator_profiles_pic_refresh
  ON creator_profiles (profile_pic_cached_at)
  WHERE profile_pic_r2_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_brand_profiles_pic_refresh
  ON brand_profiles (profile_pic_cached_at)
  WHERE profile_pic_r2_key IS NOT NULL;

-- Recreate v_searchable_creators to expose profile_pic_r2_key so brand
-- search + campaign picker can resolve the R2 URL the same way every
-- other endpoint does. Onboarded influencers don't have R2-cached pics
-- (they upload directly), so that half of the UNION returns NULL.
-- CREATE OR REPLACE allows appending columns at the end.
CREATE OR REPLACE VIEW v_searchable_creators AS

SELECT
  cp.id                                            AS row_id,
  'scraped'                                        AS source,
  cp.ig_handle                                     AS ig_handle,
  cp.youtube_handle                                AS youtube_handle,
  cp.full_name                                     AS full_name,
  cp.profile_pic_url                               AS profile_pic_url,
  cp.bio                                           AS bio,
  cp.followers_count                               AS followers_count,
  cp.following_count                               AS following_count,
  cp.view_based_er                                 AS view_based_er,
  cp.follower_based_er                             AS follower_based_er,
  cp.follower_tier                                 AS tier,
  cp.city                                          AS city,
  cp.niche                                         AS niche,
  cp.sub_niche                                     AS sub_niche,
  cp.languages                                     AS languages,
  cp.is_verified                                   AS ig_verified,
  cp.is_business                                   AS is_business,
  cp.estimated_min_rate                            AS estimated_min_rate,
  cp.estimated_max_rate                            AS estimated_max_rate,
  cp.rank_score                                    AS rank_score,
  cp.growth_potential_score                        AS growth_potential_score,
  cp.posting_frequency_per_week                    AS posting_frequency_per_week,
  cp.total_posts_90d                               AS total_posts_90d,
  cp.total_brand_collaborations                    AS total_brand_collaborations,
  cp.unique_brands_count                           AS unique_brands_count,
  cp.commercial_post_rate                          AS commercial_post_rate,
  cp.top_brand_partners                            AS top_brand_partners,
  cp.recommended_use_cases                         AS recommended_use_cases,
  cp.avg_views                                     AS avg_views,
  cp.avg_likes                                     AS avg_likes,
  cp.avg_comments                                  AS avg_comments,
  cp.is_active_creator                             AS is_active_creator,
  cp.activity_status                               AS activity_status,
  cp.linked_influencer_id                          AS linked_influencer_id,
  (cp.verification_status = 'verified')            AS is_inflx_verified,
  cp.verification_status                           AS internal_verification_status,
  cp.last_calculated_at                            AS last_calculated_at,
  -- Appended in migration 045 (must be at end for CREATE OR REPLACE).
  cp.profile_pic_r2_key                            AS profile_pic_r2_key
FROM creator_profiles cp
WHERE cp.linked_influencer_id IS NULL

UNION ALL

SELECT
  i.id                                              AS row_id,
  'onboarded'                                       AS source,
  i.instagram_handle                                AS ig_handle,
  i.youtube_handle                                  AS youtube_handle,
  COALESCE(i.full_name, u.name)                     AS full_name,
  i.profile_image_url                               AS profile_pic_url,
  i.bio                                             AS bio,
  i.followers_count                                 AS followers_count,
  NULL::int                                         AS following_count,
  i.engagement_rate                                 AS view_based_er,
  i.engagement_rate                                 AS follower_based_er,
  i.tier                                            AS tier,
  i.city                                            AS city,
  COALESCE(i.niche[1], NULL)                        AS niche,
  COALESCE(i.secondary_niche[1], NULL)              AS sub_niche,
  i.language                                        AS languages,
  COALESCE(i.verified, FALSE)                       AS ig_verified,
  FALSE                                             AS is_business,
  i.price_per_post_min                              AS estimated_min_rate,
  i.price_per_post_max                              AS estimated_max_rate,
  NULL::numeric                                     AS rank_score,
  NULL::int                                         AS growth_potential_score,
  NULL::numeric                                     AS posting_frequency_per_week,
  i.total_posts                                     AS total_posts_90d,
  COALESCE(jsonb_array_length(i.past_brands_json), 0)::int AS total_brand_collaborations,
  COALESCE(jsonb_array_length(i.past_brands_json), 0)::int AS unique_brands_count,
  NULL::numeric                                     AS commercial_post_rate,
  COALESCE(i.past_brands_json, '[]'::jsonb)         AS top_brand_partners,
  NULL::text[]                                      AS recommended_use_cases,
  i.avg_views                                       AS avg_views,
  i.avg_likes                                       AS avg_likes,
  i.avg_comments                                    AS avg_comments,
  TRUE                                              AS is_active_creator,
  'active'                                          AS activity_status,
  i.id                                              AS linked_influencer_id,
  TRUE                                              AS is_inflx_verified,
  'verified'                                        AS internal_verification_status,
  i.scrape_last_run                                 AS last_calculated_at,
  -- Onboarded users upload pics directly; no R2 proxy cache for them.
  NULL::text                                        AS profile_pic_r2_key
FROM influencers i
JOIN users u ON u.id = i.user_id
WHERE u.status IN ('approved', 'pending');

COMMIT;
