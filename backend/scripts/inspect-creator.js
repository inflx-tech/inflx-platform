'use strict';

/**
 * Dump all stored data for a single creator_profile + their posts.
 *
 * Usage:
 *   node scripts/inspect-creator.js              # dumps the only row
 *   node scripts/inspect-creator.js vsunitha2001 # named handle
 */

const { Client } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
  const handle = process.argv[2] || null;

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const where = handle ? 'WHERE ig_handle = $1' : '';
  const args  = handle ? [handle] : [];

  const { rows: profiles } = await client.query(
    `SELECT * FROM creator_profiles ${where} ORDER BY ig_handle`,
    args
  );

  if (profiles.length === 0) {
    console.log('No creator_profiles match.');
    await client.end();
    return;
  }

  console.log(`\n=== creator_profiles (${profiles.length} row${profiles.length > 1 ? 's' : ''}) ===\n`);

  for (const p of profiles) {
    console.log(`────── @${p.ig_handle} ──────`);
    // Group fields for readability
    const groups = {
      Identity: ['id', 'ig_handle', 'ig_user_id', 'is_onboarded', 'linked_influencer_id'],
      Profile: ['full_name', 'bio', 'profile_pic_url', 'external_url', 'is_verified',
                'is_business', 'is_private', 'joined_recently', 'ig_category',
                'highlights_count', 'city', 'niche', 'sub_niche', 'languages',
                'bio_email', 'bio_phone'],
      'Profile counts': ['followers_count', 'following_count', 'total_posts_lifetime'],
      'Layer 1 — basic aggregates (90d)': [
        'total_posts_90d', 'total_videos_90d', 'total_carousels_90d',
        'posting_frequency_per_day', 'posting_frequency_per_week',
        'avg_likes', 'avg_comments', 'avg_views',
        'median_likes', 'median_views',
      ],
      'Layer 2 — engagement': [
        'follower_based_er', 'view_based_er',
        'best_post_views', 'best_post_engagement', 'consistency_score',
      ],
      'Layer 3 — brand collaboration': [
        'total_brand_collaborations', 'unique_brands_count',
        'commercial_post_rate', 'cta_usage_rate', 'brand_diversity_score',
        'top_brand_partners',
      ],
      'Layer 5 — health & ranking': [
        'follower_tier', 'account_age_days',
        'is_active_creator', 'activity_status',
        'growth_potential_score', 'rank_score',
      ],
      Pricing: ['estimated_min_rate', 'estimated_max_rate', 'recommended_use_cases'],
      Special: ['related_handles'],
      Audit: ['last_scraped_at', 'last_calculated_at', 'scrape_count', 'created_at', 'updated_at'],
    };

    for (const [groupName, fields] of Object.entries(groups)) {
      console.log(`\n  [${groupName}]`);
      for (const f of fields) {
        let val = p[f];
        if (val === null || val === undefined) {
          val = '(null)';
        } else if (typeof val === 'object') {
          val = JSON.stringify(val).slice(0, 200);
        } else if (typeof val === 'string' && val.length > 200) {
          val = val.slice(0, 200) + '…';
        }
        console.log(`    ${f.padEnd(34)} ${val}`);
      }
    }
    // raw_profile_data is huge — only show whether present
    console.log(`\n  [raw]\n    raw_profile_data                   ${p.raw_profile_data ? '<' + JSON.stringify(p.raw_profile_data).length + ' bytes of JSON>' : '(null)'}`);

    // Posts
    const { rows: posts } = await client.query(
      `SELECT type, posted_at, likes_count, comments_count, views_count,
              shares_count, saves_count, has_commercial_intent,
              jsonb_array_length(COALESCE(brand_tags, '[]'::jsonb)) AS tag_count,
              LEFT(COALESCE(caption, ''), 80) AS caption_preview
         FROM posts WHERE creator_profile_id = $1
         ORDER BY (COALESCE(likes_count,0) + COALESCE(comments_count,0)) DESC
         LIMIT 10`,
      [p.id]
    );
    console.log(`\n  [posts — top 10 of ${posts.length === 0 ? 0 : 'many'} by engagement]`);
    if (posts.length === 0) {
      console.log('    (none)');
    } else {
      console.log('    ' + ['type', 'posted_at', 'likes', 'comments', 'views', 'shares', 'saves', 'comm', 'tags', 'caption'].map(s => s.padEnd(s === 'caption' ? 40 : 9)).join('| '));
      for (const post of posts) {
        const dateStr = post.posted_at ? post.posted_at.toISOString().slice(0, 10) : 'null';
        console.log('    ' + [
          (post.type || '').padEnd(9),
          dateStr.padEnd(9),
          String(post.likes_count || 0).padEnd(9),
          String(post.comments_count || 0).padEnd(9),
          String(post.views_count || 0).padEnd(9),
          String(post.shares_count || 0).padEnd(9),
          String(post.saves_count || 0).padEnd(9),
          String(post.has_commercial_intent ? 'Y' : 'N').padEnd(9),
          String(post.tag_count || 0).padEnd(9),
          (post.caption_preview || '').slice(0, 40),
        ].join('| '));
      }
    }

    // Posts aggregates
    const { rows: aggRows } = await client.query(
      `SELECT
         COUNT(*)::int AS total_posts,
         COUNT(*) FILTER (WHERE type = 'video')::int AS videos,
         COUNT(*) FILTER (WHERE type = 'image')::int AS images,
         COUNT(*) FILTER (WHERE type = 'carousel')::int AS carousels,
         COUNT(*) FILTER (WHERE type = 'reel')::int AS reels,
         COUNT(*) FILTER (WHERE has_commercial_intent)::int AS commercial,
         MIN(posted_at) AS earliest,
         MAX(posted_at) AS latest,
         AVG(likes_count)::int AS avg_likes,
         AVG(comments_count)::int AS avg_comments,
         AVG(views_count)::int AS avg_views,
         MAX(likes_count + comments_count)::int AS best_engagement
       FROM posts WHERE creator_profile_id = $1`,
      [p.id]
    );
    const agg = aggRows[0];
    console.log(`\n  [posts aggregates — what we can compute locally]`);
    console.log(`    total stored                       ${agg.total_posts}`);
    console.log(`    type breakdown                     videos=${agg.videos}  images=${agg.images}  carousels=${agg.carousels}  reels=${agg.reels}`);
    console.log(`    commercial intent                  ${agg.commercial}`);
    console.log(`    earliest — latest                  ${agg.earliest?.toISOString().slice(0,10) || 'null'} — ${agg.latest?.toISOString().slice(0,10) || 'null'}`);
    console.log(`    avg likes / comments / views       ${agg.avg_likes} / ${agg.avg_comments} / ${agg.avg_views}`);
    console.log(`    best engagement (likes+comments)   ${agg.best_engagement}`);
    console.log('');
  }

  await client.end();
})().catch(e => { console.error(e); process.exit(1); });
