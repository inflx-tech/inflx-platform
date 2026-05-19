-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 055 — fix v_searchable_creators onboarded branch:
--   (A) influencer city  (carve: backend-defect-onboarded-creator-city-search;
--       fix contract: features/fix-onboarded-creator-city-search)
--   (B) is_inflx_verified / internal_verification_status truth
--       (carve: backend-defect-search-includes-pending-influencers — product
--       decision 2026-05-19 keeps pending VISIBLE but it must NOT be tagged
--       'verified'; fix contract: features/fix-search-verification-tag)
-- Both are single-onboarded-branch truth fixes folded into ONE atomic
-- CREATE OR REPLACE VIEW (reproducing the 92-line view once, not twice —
-- lower transcription risk). Founder GO 2026-05-19.
--
-- (B) detail: the onboarded branch hardcoded `TRUE AS is_inflx_verified`
-- and `'verified' AS internal_verification_status` for ALL onboarded rows
-- (approved AND pending). Per the product decision, the brand-facing
-- "verified" tag must mean admin-verified registered only. Fixed to
-- `(u.status = 'approved')` and `u.status` respectively. Pending onboarded
-- influencers remain in search (WHERE u.status IN ('approved','pending'))
-- but now correctly carry is_inflx_verified = FALSE.
--
-- (A) detail:
-- Defect (carved: features/backend-defect-onboarded-creator-city-search;
-- fix contract: features/fix-onboarded-creator-city-search; founder GO
-- 2026-05-19 "This is required pls fix this"):
--
-- The onboarded branch selected `i.city` (influencers.city). Influencer
-- registration writes city to `users.city`
-- (influencer.controller.js:214-219 `UPDATE users SET ... city ...`) and
-- the INSERT INTO influencers omits city, so influencers.city is always
-- NULL for onboarded influencers. The `users u` join is already present,
-- so the correct, authoritative source is `u.city` (mirrors the
-- city-on-users convention — cf. the fixed brand backend-defect-city-column
-- and listing.service.js quality-score join).
--
-- Forward-only: CREATE OR REPLACE VIEW (idempotent; same output columns in
-- the same order). ONLY the onboarded branch's `city` source changes
-- (`i.city` → `u.city`). The scraped branch and every other column are
-- byte-identical to migration 045. The WHERE u.status IN
-- ('approved','pending') is intentionally retained (product decision
-- 2026-05-19: search shows both verified + pending/scraped — see
-- features/fix-search-verification-tag).
-- ─────────────────────────────────────────────────────────────────────────────

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
  u.city                                            AS city,
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
  (u.status = 'approved')                           AS is_inflx_verified,
  u.status::text                                    AS internal_verification_status,
  i.scrape_last_run                                 AS last_calculated_at,
  NULL::text                                        AS profile_pic_r2_key
FROM influencers i
JOIN users u ON u.id = i.user_id
WHERE u.status IN ('approved', 'pending');
