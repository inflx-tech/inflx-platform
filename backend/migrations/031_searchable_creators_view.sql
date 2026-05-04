-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 031 — v_searchable_creators VIEW
--
-- Unifies two creator sources into one queryable surface:
--   1. creator_profiles  — scraped via marketing automation
--   2. influencers       — onboarded users (real + 20 dummy seed rows)
--
-- Brand search and campaign-picker UIs query this view, so they don't
-- need to know about the two-source split.
--
-- Public flag exposed to UI:
--   is_inflx_verified BOOLEAN
--     true  = onboarded (influencers row, status='approved')
--             OR scraped row with verification_status='verified'
--     false = scraped row, NOT yet admin-verified
--
-- The four internal verification states (unclaimed/claimed/verified/
-- rejected) are kept in `internal_verification_status` for admin views
-- only. Brand UI ignores it.
--
-- De-duplication:
--   When a scraped creator_profile has been claimed and linked
--   (linked_influencer_id IS NOT NULL), the scraped row is HIDDEN —
--   the legacy influencers row supersedes it. This avoids showing the
--   same creator twice in search.
--
-- View is recreatable: CREATE OR REPLACE.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE VIEW v_searchable_creators AS

-- Source 1: scraped creators that aren't (yet) onboarded
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
  cp.last_calculated_at                            AS last_calculated_at
FROM creator_profiles cp
WHERE cp.linked_influencer_id IS NULL          -- skip rows already represented by an influencers row

UNION ALL

-- Source 2: onboarded influencers (real users + 20 dummy seed rows)
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
  TRUE                                              AS is_inflx_verified,    -- onboarded users always verified
  'verified'                                        AS internal_verification_status,
  i.scrape_last_run                                 AS last_calculated_at
FROM influencers i
JOIN users u ON u.id = i.user_id
WHERE u.status IN ('approved', 'pending');     -- include pending so dummy seed rows surface too

COMMENT ON VIEW v_searchable_creators IS
  'Unified read-only view of all searchable creators (scraped + onboarded). '
  'Brand search and campaign picker query this view. '
  'Internal verification status is in internal_verification_status; '
  'brand UI uses only is_inflx_verified.';

COMMIT;
