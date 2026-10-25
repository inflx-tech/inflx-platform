-- post-performance-v2 · production counts for 01-spec.md §5 (read-only, run with the prod DATABASE_URL; no semicolon in comments: the runner splits on them)
-- Run 25 Oct 2026 once auto mode was off (the auto-mode classifier refuses prod reads); results in prod-counts-2026-10-25.md

-- 1. Proof links by platform host (content_proofs, migration 192:128–137)
SELECT CASE WHEN url ~* 'instagram' THEN 'instagram'
            WHEN url ~* 'youtu'     THEN 'youtube'
            WHEN url ~* 'facebook|fb\.watch' THEN 'facebook'
            WHEN url IS NULL        THEN 'screenshot'
            ELSE 'other' END AS platform, count(*)
  FROM content_proofs GROUP BY 1 ORDER BY 2 DESC;

-- 2. Shape of the Instagram / YouTube links (reel vs p vs shorts vs watch)
SELECT regexp_replace(url, '^(https?://[^/]+/[^/?]+).*', '\1') AS shape, count(*)
  FROM content_proofs WHERE url IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 20;

-- 3. Content rows by clock (posted → confirmed → final paid → completed), by Aim
SELECT cs.goal,
       count(*)                       AS content_rows,
       count(cc.posted_at)            AS posted,
       count(cc.live_confirmed_at)    AS confirmed,
       count(cc.t3_released_at)       AS final_paid,
       count(cc.completed_at)         AS completed
  FROM collab_content cc
  JOIN campaign_influencers ci ON ci.id = cc.campaign_influencer_id
  JOIN campaign_sets cs ON cs.id = ci.set_id
 GROUP BY 1;   -- goal lives on the set (engagement.service.js:27)

-- 4. Pay for Sale social rows (migration 199:21–35): package vs outside, standing vs removed
SELECT outside, (removed_round IS NULL) AS standing, count(*) FROM content_social_rows GROUP BY 1, 2;

-- 5. Links that would be tracked on day one under P2 (posted package rows + outside rows), by platform
SELECT CASE WHEN p.url ~* 'instagram' THEN 'instagram' WHEN p.url ~* 'youtu' THEN 'youtube' ELSE 'other' END AS platform,
       count(*)
  FROM content_proofs p
  JOIN collab_content cc ON cc.id = p.content_id
  LEFT JOIN content_social_rows sr ON sr.content_id = p.content_id AND sr.row_key = p.row_key
 WHERE p.url IS NOT NULL
   AND p.url !~* 'facebook|fb\.watch'
   AND (cc.posted_at IS NOT NULL OR sr.outside)
   AND (sr.row_key IS NULL OR sr.removed_round IS NULL)
 GROUP BY 1;

-- 6. The legacy table this contract retires
SELECT count(*) AS rows, max(scraped_at) AS last_scrape FROM deliverable_stats;
SELECT count(*) AS legacy_live_links FROM deliverables WHERE status = 'live' AND live_url IS NOT NULL;

-- 7. Level 1 spend this month and per-run cost by actor (creator_social_runs, migration 177:6–24)
SELECT count(*) AS runs, round(sum(usage_usd)::numeric, 4) AS usd, min(started_at)::date AS since
  FROM creator_social_runs WHERE started_at >= date_trunc('month', now());
SELECT actor, run_type, count(*) AS runs,
       round(avg(usage_usd)::numeric, 4) AS avg_usd, round(max(usage_usd)::numeric, 4) AS max_usd
  FROM creator_social_runs WHERE result = 'success' GROUP BY 1, 2 ORDER BY 3 DESC;

-- 8. Confirmed accounts for the ownership check (P8) and Level 1 posts for the seed (P9)
SELECT platform, ownership, count(*) FROM creator_social_accounts WHERE replaced_at IS NULL GROUP BY 1, 2;
SELECT count(*) AS level1_posts_matching_a_proof
  FROM content_proofs p
 WHERE p.url IS NOT NULL
   AND EXISTS (SELECT 1 FROM creator_social_posts sp WHERE sp.url IS NOT NULL
                 AND regexp_replace(sp.url, '^https?://[^/]+/(p|reel|tv|shorts|watch[?]v=)?/?([A-Za-z0-9_-]+).*', '\2')
                   = regexp_replace(p.url,  '^https?://[^/]+/(p|reel|tv|shorts|watch[?]v=)?/?([A-Za-z0-9_-]+).*', '\2'));
   -- platform_post_id is Instagram's numeric id (socialCalc.service.js:67), so match on the URL's shortcode / video id
