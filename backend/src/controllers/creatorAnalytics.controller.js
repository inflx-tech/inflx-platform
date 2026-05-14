'use strict';

/**
 * Brand-side market analytics over the unified searchable creator pool
 * (v_searchable_creators).
 *
 * One endpoint returns every aggregate the dashboard needs in a single
 * JSON blob — tier/niche/city/language distributions, rate histograms,
 * ER distribution, top performers, cost-efficiency, trending brands,
 * verification breakdown, etc.
 *
 * Optional filters (city, niche, tier) let the brand scope the analytics
 * to a subset (e.g. "food bloggers in Vijayawada only").
 */

const db = require('../config/db');
const { success } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const { resolveAvatars } = require('../utils/avatarResolver');

function parseList(value) {
  if (value == null) return null;
  const arr = Array.isArray(value)
    ? value
    : String(value).split(',').map(s => s.trim()).filter(Boolean);
  return arr.length > 0 ? arr : null;
}

/**
 * Build a parameterised WHERE clause from optional scope filters.
 * Returns { where: 'a=$1 AND b=ANY($2)', params: [...] }.
 */
function buildScope(req) {
  const conditions = [`(is_active_creator IS DISTINCT FROM FALSE)`];
  const params = [];

  const cities = parseList(req.query.city);
  const niches = parseList(req.query.niche);
  const tiers  = parseList(req.query.tier);

  if (cities) { params.push(cities); conditions.push(`city  = ANY($${params.length}::text[])`); }
  if (niches) { params.push(niches); conditions.push(`niche = ANY($${params.length}::text[])`); }
  if (tiers)  { params.push(tiers);  conditions.push(`tier  = ANY($${params.length}::text[])`); }

  return { where: conditions.join(' AND '), params };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/influencers/analytics
// ─────────────────────────────────────────────────────────────────────────────

const getMarketAnalytics = asyncHandler(async (req, res) => {
  const { where, params } = buildScope(req);

  const [
    overview,
    tierDist,
    cityDist,
    nicheDist,
    languageDist,
    erBuckets,
    rateByTier,
    topRank,
    topGrowth,
    cheapest,
    costEfficient,
    trendingBrands,
    verificationBreakdown,
  ] = await Promise.all([
    // Overview
    db.query(`
      SELECT
        COUNT(*)::int                                                  AS total,
        COUNT(*) FILTER (WHERE is_inflx_verified)::int                 AS verified,
        COUNT(*) FILTER (WHERE source='scraped')::int                  AS scraped,
        COUNT(*) FILTER (WHERE source='onboarded')::int                AS onboarded,
        COUNT(DISTINCT city)         FILTER (WHERE city  IS NOT NULL)  AS distinct_cities,
        COUNT(DISTINCT niche)        FILTER (WHERE niche IS NOT NULL)  AS distinct_niches,
        ROUND(AVG(view_based_er)::numeric, 2)                          AS avg_view_er,
        ROUND(AVG(followers_count)::numeric)                           AS avg_followers,
        MIN(estimated_min_rate)                                        AS min_rate,
        MAX(estimated_max_rate)                                        AS max_rate
      FROM v_searchable_creators WHERE ${where}
    `, params),

    // Tier distribution
    db.query(`
      SELECT COALESCE(tier,'unknown') AS tier, COUNT(*)::int AS n
      FROM v_searchable_creators WHERE ${where}
      GROUP BY tier
      ORDER BY n DESC
    `, params),

    // City distribution (top 15)
    db.query(`
      SELECT city, COUNT(*)::int AS n
      FROM v_searchable_creators
      WHERE ${where} AND city IS NOT NULL
      GROUP BY city
      ORDER BY n DESC, city ASC
      LIMIT 15
    `, params),

    // Niche distribution
    db.query(`
      SELECT niche, COUNT(*)::int AS n
      FROM v_searchable_creators
      WHERE ${where} AND niche IS NOT NULL
      GROUP BY niche
      ORDER BY n DESC, niche ASC
      LIMIT 15
    `, params),

    // Language distribution (unnest array)
    db.query(`
      SELECT lang, COUNT(*)::int AS n
      FROM (
        SELECT UNNEST(languages) AS lang
        FROM v_searchable_creators
        WHERE ${where} AND languages IS NOT NULL
      ) t
      GROUP BY lang
      ORDER BY n DESC, lang ASC
      LIMIT 10
    `, params),

    // ER distribution buckets (view_based_er)
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE view_based_er <  1)::int  AS lt_1,
        COUNT(*) FILTER (WHERE view_based_er >= 1 AND view_based_er < 2)::int AS b_1_2,
        COUNT(*) FILTER (WHERE view_based_er >= 2 AND view_based_er < 3)::int AS b_2_3,
        COUNT(*) FILTER (WHERE view_based_er >= 3 AND view_based_er < 5)::int AS b_3_5,
        COUNT(*) FILTER (WHERE view_based_er >= 5 AND view_based_er < 8)::int AS b_5_8,
        COUNT(*) FILTER (WHERE view_based_er >= 8)::int  AS gte_8
      FROM v_searchable_creators WHERE ${where}
    `, params),

    // Rate range by tier
    db.query(`
      SELECT
        COALESCE(tier,'unknown') AS tier,
        COUNT(*) FILTER (WHERE estimated_min_rate IS NOT NULL)::int AS n,
        ROUND(MIN(estimated_min_rate)::numeric)         AS min_rate,
        ROUND(MAX(estimated_max_rate)::numeric)         AS max_rate,
        ROUND(AVG(estimated_min_rate)::numeric)         AS avg_min,
        ROUND(AVG(estimated_max_rate)::numeric)         AS avg_max,
        ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY estimated_min_rate))::numeric) AS median_min,
        ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY estimated_max_rate))::numeric) AS median_max
      FROM v_searchable_creators
      WHERE ${where}
      GROUP BY tier
      ORDER BY n DESC
    `, params),

    // Top 10 by rank_score
    db.query(`
      SELECT ig_handle, full_name, profile_pic_url, profile_pic_r2_key, tier, city, niche,
             followers_count, view_based_er, rank_score, is_inflx_verified
      FROM v_searchable_creators
      WHERE ${where} AND rank_score IS NOT NULL
      ORDER BY rank_score DESC
      LIMIT 10
    `, params),

    // Top 10 by growth potential
    db.query(`
      SELECT ig_handle, full_name, profile_pic_url, profile_pic_r2_key, tier, city, niche,
             followers_count, growth_potential_score, is_inflx_verified
      FROM v_searchable_creators
      WHERE ${where} AND growth_potential_score IS NOT NULL
      ORDER BY growth_potential_score DESC
      LIMIT 10
    `, params),

    // Cheapest creators (best for limited budgets)
    db.query(`
      SELECT ig_handle, full_name, profile_pic_url, profile_pic_r2_key, tier, city, niche,
             followers_count, view_based_er, estimated_min_rate, estimated_max_rate, is_inflx_verified
      FROM v_searchable_creators
      WHERE ${where} AND estimated_min_rate IS NOT NULL
      ORDER BY estimated_min_rate ASC
      LIMIT 10
    `, params),

    // Cost-efficient creators — best avg_views / estimated_min_rate × 1000
    db.query(`
      SELECT ig_handle, full_name, profile_pic_url, profile_pic_r2_key, tier, city, niche,
             avg_views, estimated_min_rate,
             ROUND((avg_views::numeric * 1000 / NULLIF(estimated_min_rate, 0))::numeric, 2) AS views_per_1k_inr,
             is_inflx_verified
      FROM v_searchable_creators
      WHERE ${where}
        AND estimated_min_rate IS NOT NULL AND estimated_min_rate > 0
        AND avg_views IS NOT NULL
      ORDER BY views_per_1k_inr DESC
      LIMIT 10
    `, params),

    // Trending brands — most-collabbed brands across all (filtered) creators
    db.query(`
      SELECT
        LOWER(REPLACE(bp->>'handle', '@', '')) AS brand_handle,
        COUNT(*)::int AS creator_count,
        SUM(COALESCE((bp->>'count')::int, 1))::int AS collab_count
      FROM v_searchable_creators c
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.top_brand_partners, '[]'::jsonb)) AS bp
      WHERE ${where} AND bp ? 'handle'
      GROUP BY brand_handle
      ORDER BY creator_count DESC, collab_count DESC
      LIMIT 15
    `, params),

    // Verification breakdown (donut)
    db.query(`
      SELECT
        SUM(CASE WHEN is_inflx_verified THEN 1 ELSE 0 END)::int AS verified,
        SUM(CASE WHEN NOT is_inflx_verified THEN 1 ELSE 0 END)::int AS unverified
      FROM v_searchable_creators WHERE ${where}
    `, params),
  ]);

  // Resolve avatars on every "top X" array — each row has profile_pic_url + profile_pic_r2_key.
  await Promise.all([
    resolveAvatars(topRank.rows),
    resolveAvatars(topGrowth.rows),
    resolveAvatars(cheapest.rows),
    resolveAvatars(costEfficient.rows),
  ]);

  return success(res, {
    overview:               overview.rows[0],
    tier_distribution:      tierDist.rows,
    city_distribution:      cityDist.rows,
    niche_distribution:     nicheDist.rows,
    language_distribution:  languageDist.rows,
    er_distribution: {
      buckets: [
        { label: '<1%',   n: erBuckets.rows[0].lt_1 },
        { label: '1-2%',  n: erBuckets.rows[0].b_1_2 },
        { label: '2-3%',  n: erBuckets.rows[0].b_2_3 },
        { label: '3-5%',  n: erBuckets.rows[0].b_3_5 },
        { label: '5-8%',  n: erBuckets.rows[0].b_5_8 },
        { label: '8%+',   n: erBuckets.rows[0].gte_8 },
      ],
    },
    rate_by_tier:           rateByTier.rows,
    top_rank:               topRank.rows,
    top_growth:             topGrowth.rows,
    cheapest:               cheapest.rows,
    cost_efficient:         costEfficient.rows,
    trending_brands:        trendingBrands.rows,
    verification_breakdown: verificationBreakdown.rows[0],
  });
});

module.exports = { getMarketAnalytics };
