'use strict';

/**
 * Compact comparison view across all creator_profiles.
 * Shows: identity, key metrics, posts summary, missing fields.
 *
 * Usage: node scripts/inspect-all-creators.js
 */

const { Client } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows } = await client.query(`
    SELECT cp.*,
           (SELECT COUNT(*)::int FROM posts p WHERE p.creator_profile_id = cp.id) AS post_count,
           (SELECT MIN(posted_at) FROM posts p WHERE p.creator_profile_id = cp.id) AS earliest_post,
           (SELECT MAX(posted_at) FROM posts p WHERE p.creator_profile_id = cp.id) AS latest_post
      FROM creator_profiles cp
      ORDER BY rank_score DESC NULLS LAST, ig_handle
  `);

  console.log(`\n${rows.length} creator_profiles\n${'='.repeat(70)}`);

  for (const c of rows) {
    console.log(`\n@${c.ig_handle}  —  ${c.full_name || '(no full_name)'}`);
    console.log('-'.repeat(70));

    // Compact one-line summaries grouped by usefulness
    console.log(`Identity     verified=${c.is_verified}  business=${c.is_business}  private=${c.is_private}  onboarded=${c.is_onboarded}`);
    console.log(`Profile      city=${c.city || 'null'}  niche=${c.niche || 'null'}  sub=${c.sub_niche || 'null'}  langs=${JSON.stringify(c.languages)}  category="${c.ig_category || 'null'}"`);
    console.log(`Contact      email=${c.bio_email || 'null'}  phone=${c.bio_phone || 'null'}`);
    console.log(`Counts       followers=${c.followers_count}  following=${c.following_count}  lifetime_posts=${c.total_posts_lifetime}  highlights=${c.highlights_count}`);
    console.log(`90-day       posts=${c.total_posts_90d}  videos=${c.total_videos_90d}  carousels=${c.total_carousels_90d}  per_week=${c.posting_frequency_per_week}`);
    console.log(`Avg          likes=${c.avg_likes}  comments=${c.avg_comments}  views=${c.avg_views}  median_likes=${c.median_likes}  median_views=${c.median_views}`);
    console.log(`Engagement   follower_er=${c.follower_based_er}%  view_er=${c.view_based_er}%  best_views=${c.best_post_views}  best_eng=${c.best_post_engagement}%  consistency=${c.consistency_score}`);
    console.log(`Brand        collabs=${c.total_brand_collaborations}  unique_brands=${c.unique_brands_count}  comm_rate=${c.commercial_post_rate}  cta_rate=${c.cta_usage_rate}  diversity=${c.brand_diversity_score}`);
    console.log(`Health       tier=${c.follower_tier}  age_days=${c.account_age_days}  active=${c.is_active_creator}  status=${c.activity_status}  growth=${c.growth_potential_score}/100  rank=${c.rank_score}`);
    console.log(`Pricing      ₹${c.estimated_min_rate || '?'}–${c.estimated_max_rate || '?'} per post  use_cases=${JSON.stringify(c.recommended_use_cases)}`);
    console.log(`Top brands   ${JSON.stringify(c.top_brand_partners).slice(0, 100)}`);
    console.log(`Related      ${JSON.stringify(c.related_handles).slice(0, 100)}`);
    console.log(`Posts in DB  ${c.post_count}  range=${c.earliest_post?.toISOString().slice(0,10) || '—'} to ${c.latest_post?.toISOString().slice(0,10) || '—'}`);
    console.log(`Audit        last_calculated_at=${c.last_calculated_at?.toISOString() || 'null'}  scrape_count=${c.scrape_count}`);
  }

  // Cross-creator aggregates
  console.log(`\n${'='.repeat(70)}\nCross-creator aggregates`);
  const { rows: agg } = await client.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE is_active_creator)::int AS active,
      COUNT(DISTINCT follower_tier) AS tiers,
      COUNT(DISTINCT city) FILTER (WHERE city IS NOT NULL) AS distinct_cities,
      COUNT(DISTINCT niche) FILTER (WHERE niche IS NOT NULL) AS distinct_niches,
      AVG(followers_count)::int AS avg_followers,
      AVG(view_based_er)::numeric(5,2) AS avg_view_er,
      AVG(rank_score)::numeric(5,2) AS avg_rank,
      AVG(growth_potential_score)::numeric(5,1) AS avg_growth,
      MIN(estimated_min_rate) AS min_rate,
      MAX(estimated_max_rate) AS max_rate,
      COUNT(*) FILTER (WHERE bio_email IS NOT NULL)::int AS with_email,
      COUNT(*) FILTER (WHERE bio_phone IS NOT NULL)::int AS with_phone,
      COUNT(*) FILTER (WHERE total_brand_collaborations > 0)::int AS with_brand_collabs,
      SUM(total_posts_90d)::int AS sum_posts_90d
    FROM creator_profiles
  `);
  console.table(agg);

  const { rows: tierDist } = await client.query(`
    SELECT follower_tier, COUNT(*)::int AS n
    FROM creator_profiles
    GROUP BY follower_tier
    ORDER BY n DESC
  `);
  console.log('\nTier distribution:');
  console.table(tierDist);

  const { rows: nicheDist } = await client.query(`
    SELECT COALESCE(niche, '(null)') AS niche, COUNT(*)::int AS n
    FROM creator_profiles
    GROUP BY niche
    ORDER BY n DESC
  `);
  console.log('Niche distribution:');
  console.table(nicheDist);

  const { rows: postsAgg } = await client.query(`
    SELECT
      COUNT(*)::int AS total_posts,
      COUNT(*) FILTER (WHERE has_commercial_intent)::int AS commercial,
      COUNT(*) FILTER (WHERE type = 'reel')::int AS reels,
      COUNT(*) FILTER (WHERE type = 'video')::int AS videos,
      COUNT(*) FILTER (WHERE type = 'carousel')::int AS carousels,
      COUNT(*) FILTER (WHERE type = 'image')::int AS images,
      AVG(likes_count)::int AS avg_likes,
      AVG(comments_count)::int AS avg_comments,
      AVG(views_count)::int AS avg_views,
      MIN(posted_at) AS earliest,
      MAX(posted_at) AS latest
    FROM posts
  `);
  console.log('Posts cross-creator:');
  console.table(postsAgg);

  await client.end();
})().catch(e => { console.error(e); process.exit(1); });
