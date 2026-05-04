'use strict';

/**
 * Read-only smoke test: runs the same SQL the analytics + search
 * endpoints will run, against prod. Catches column/cast bugs before
 * deploy.
 */

const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const where = `(is_active_creator IS DISTINCT FROM FALSE)`;

  console.log('\n[1] overview');
  console.table((await c.query(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE is_inflx_verified)::int AS verified,
           COUNT(*) FILTER (WHERE source='scraped')::int AS scraped,
           COUNT(*) FILTER (WHERE source='onboarded')::int AS onboarded,
           COUNT(DISTINCT city) FILTER (WHERE city IS NOT NULL) AS cities,
           COUNT(DISTINCT niche) FILTER (WHERE niche IS NOT NULL) AS niches
      FROM v_searchable_creators WHERE ${where}
  `)).rows);

  console.log('\n[2] tier distribution');
  console.table((await c.query(`
    SELECT COALESCE(tier,'unknown') AS tier, COUNT(*)::int AS n
    FROM v_searchable_creators WHERE ${where}
    GROUP BY tier ORDER BY n DESC
  `)).rows);

  console.log('\n[3] city distribution');
  console.table((await c.query(`
    SELECT city, COUNT(*)::int AS n
    FROM v_searchable_creators
    WHERE ${where} AND city IS NOT NULL
    GROUP BY city ORDER BY n DESC LIMIT 10
  `)).rows);

  console.log('\n[4] niche distribution');
  console.table((await c.query(`
    SELECT niche, COUNT(*)::int AS n
    FROM v_searchable_creators
    WHERE ${where} AND niche IS NOT NULL
    GROUP BY niche ORDER BY n DESC LIMIT 10
  `)).rows);

  console.log('\n[5] languages');
  console.table((await c.query(`
    SELECT lang, COUNT(*)::int AS n
    FROM (SELECT UNNEST(languages) AS lang FROM v_searchable_creators WHERE ${where} AND languages IS NOT NULL) t
    GROUP BY lang ORDER BY n DESC LIMIT 10
  `)).rows);

  console.log('\n[6] er buckets');
  console.table((await c.query(`
    SELECT
      COUNT(*) FILTER (WHERE view_based_er <  1)::int  AS lt_1,
      COUNT(*) FILTER (WHERE view_based_er >= 1 AND view_based_er < 2)::int AS b_1_2,
      COUNT(*) FILTER (WHERE view_based_er >= 2 AND view_based_er < 3)::int AS b_2_3,
      COUNT(*) FILTER (WHERE view_based_er >= 3 AND view_based_er < 5)::int AS b_3_5,
      COUNT(*) FILTER (WHERE view_based_er >= 5 AND view_based_er < 8)::int AS b_5_8,
      COUNT(*) FILTER (WHERE view_based_er >= 8)::int  AS gte_8
    FROM v_searchable_creators WHERE ${where}
  `)).rows);

  console.log('\n[7] rate by tier');
  console.table((await c.query(`
    SELECT
      COALESCE(tier,'unknown') AS tier,
      COUNT(*) FILTER (WHERE estimated_min_rate IS NOT NULL)::int AS n,
      ROUND(AVG(estimated_min_rate)::numeric) AS avg_min,
      ROUND(AVG(estimated_max_rate)::numeric) AS avg_max
    FROM v_searchable_creators
    WHERE ${where}
    GROUP BY tier ORDER BY n DESC
  `)).rows);

  console.log('\n[8] top by rank_score');
  console.table((await c.query(`
    SELECT ig_handle, tier, followers_count, view_based_er, rank_score, is_inflx_verified
    FROM v_searchable_creators
    WHERE ${where} AND rank_score IS NOT NULL
    ORDER BY rank_score DESC LIMIT 5
  `)).rows);

  console.log('\n[9] cost-efficient (views per ₹1k)');
  console.table((await c.query(`
    SELECT ig_handle, tier, avg_views, estimated_min_rate,
           ROUND((avg_views::numeric * 1000 / NULLIF(estimated_min_rate, 0))::numeric, 2) AS views_per_1k_inr
    FROM v_searchable_creators
    WHERE ${where} AND estimated_min_rate > 0 AND avg_views IS NOT NULL
    ORDER BY views_per_1k_inr DESC LIMIT 5
  `)).rows);

  console.log('\n[10] trending brands');
  console.table((await c.query(`
    SELECT
      LOWER(REPLACE(bp->>'handle', '@', '')) AS brand_handle,
      COUNT(*)::int AS creator_count,
      SUM(COALESCE((bp->>'count')::int, 1))::int AS collab_count
    FROM v_searchable_creators c
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.top_brand_partners, '[]'::jsonb)) AS bp
    WHERE ${where} AND bp ? 'handle'
    GROUP BY brand_handle
    ORDER BY creator_count DESC LIMIT 10
  `)).rows);

  console.log('\n[11] search default sort sample');
  console.table((await c.query(`
    SELECT row_id, source, ig_handle, tier, city, niche, followers_count,
           view_based_er, rank_score, is_inflx_verified
    FROM v_searchable_creators
    WHERE ${where}
    ORDER BY rank_score DESC NULLS LAST, ig_handle
    LIMIT 10
  `)).rows);

  await c.end();
  console.log('\n✓ all queries passed\n');
})().catch(e => { console.error(e); process.exit(1); });
