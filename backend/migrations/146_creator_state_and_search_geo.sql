-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 146 — state-aware creator geography
--   (A) creator_profiles.state — new column (did not exist anywhere on the
--       scraped side; influencers.state and users.state already do)
--   (B) v_searchable_creators — expose `state` on BOTH branches
--   (C) v_searchable_creators — onboarded `city` becomes COALESCE(u.city, i.city)
--
-- Contract: features/creator-geo-tagging/
--
-- WHY (A): the founder's onboarding workflow is "take a list of Instagram IDs
-- (Vijayawada / Guntur / Nellore), tag them with city + state, upload, let the
-- scrape fill the rest, brands then find them by area". Everything in that
-- loop already exists — POST /admin/marketing/leads/intake/bulk accepts an
-- admin-supplied `city`, inserts into creator_profiles, and fires the n8n A2
-- scrape, which is column-protected so it never clobbers a manual value. The
-- ONLY missing piece is `state`. Verified against production 2026-07-29:
-- creator_profiles has no `state` column and no ALTER ever added one.
--
-- WHY (C): migration 055 changed the onboarded branch from i.city to u.city on
-- the stated premise that "influencers.city is always NULL for onboarded
-- influencers" because self-registration writes to users.city. That premise is
-- now incomplete — the admin CSV bulk upload
-- (admin.controller.js:600-731, POST /admin/influencers/bulk-upload) writes
-- influencers.city AND influencers.state and never sets users.city.
--
-- Measured on production 2026-07-29 over the 29 onboarded creators:
--     users.city populated ......... 8
--     influencers.city populated ... 28
--     influencers.state populated .. 28
--     have i.city but NOT u.city ... 20   <-- invisible to brand city search
--
-- COALESCE(u.city, i.city) preserves 055's decision (u.city still wins when
-- present, so self-registered users keep authority over their own city) while
-- recovering the 20 rows the CSV path strands. Same reasoning for state.
--
-- Forward-only. CREATE OR REPLACE VIEW requires identical column names, types
-- and order for existing columns — `state` is therefore APPENDED LAST on both
-- branches, and only the `city` EXPRESSION changes (its name and type do not).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── (A) creator_profiles.state ───────────────────────────────────────────────
ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS state text;

COMMENT ON COLUMN creator_profiles.state IS
  'Admin-tagged state (manual field, same protection class as city). The n8n '
  'A2 scrape must never write this — Claude-parsed geography goes to '
  'inferred_city only. Set via /admin/marketing/leads/intake[/bulk].';

-- Case-insensitive lookup — brand search compares LOWER(state), mirroring the
-- existing city predicate in influencer.controller.js.
CREATE INDEX IF NOT EXISTS idx_creator_profiles_state_lower
  ON creator_profiles (LOWER(state));

-- ── (B)+(C) v_searchable_creators ────────────────────────────────────────────
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
  cp.profile_pic_r2_key                            AS profile_pic_r2_key,
  cp.state                                         AS state
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
  COALESCE(u.city, i.city)                          AS city,
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
  NULL::text                                        AS profile_pic_r2_key,
  COALESCE(u.state, i.state)                        AS state
FROM influencers i
JOIN users u ON u.id = i.user_id
WHERE u.status IN ('approved', 'pending');
