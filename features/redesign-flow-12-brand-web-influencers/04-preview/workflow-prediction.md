# Flow 12 · preview workflow-prediction — mockup → backend source mapping

Verifies every visible element in `04-preview/mockups/web.html` traces to
a real backend field surfaced today (no phantom metrics, no new endpoints).

---

## State 1 — LIST default

| Element | Backend source |
|---|---|
| Count chip `{N} SEARCHABLE` | `meta.total` from `GET /influencers/search` |
| Hero KPI 1 Total Searchable | `meta.total` (or `ov.total` from analytics endpoint on first paint) |
| Hero KPI 2 Verified count | derived: `creators.filter(c => c.is_inflx_verified).length` from the visible page (or analytics overview if pre-loaded) |
| Hero KPI 3 Median min rate | derived client-side: median of `creators[].estimated_min_rate` (visible page) — labeled "this page" when filtered |
| Search input `q` | passed as `?q=` |
| Sort dropdown | passed as `?sort=` (whitelist enforced backend-side) |
| City input | passed as `?city=` |
| Niche input | passed as `?niche=` |
| Tier select | passed as `?tier=` |
| Min ER % input | passed as `?min_view_er=` |
| Language input (advanced) | passed as `?languages=` |
| Use case select (advanced) | passed as `?use_case=` |
| Min/Max followers (advanced) | `?min_followers=` `?max_followers=` |
| Min/Max rate (advanced) | `?min_rate=` `?max_rate=` |
| Worked-with-brand input | `?brand_handle=` |
| Has-collabs check | `?has_brand_collabs=true` |
| Verified-only check | `?is_inflx_verified=true` |
| Business-only check | `?is_business=true` |
| Tier chip counts | derived client-side: `results.filter(r => r.tier === key).length` |
| Row avatar | `c.profile_pic_url` (or initials from `c.ig_handle`) |
| Row name | `c.full_name` (or empty fallback) |
| Row @handle | `c.ig_handle` |
| Row ✓verify | `c.is_inflx_verified === true` |
| Row tier pill | `c.tier` mapped to palette class |
| Row ⭐ rank-mini | `c.rank_score` (Number().toFixed(1)) — **NEW surface inline** |
| Row scraped tag | `c.source === 'scraped' && !c.is_inflx_verified` |
| Row stale tag | derived: `Date.now() - new Date(c.last_calculated_at) > 7 days` — **NEW surface inline** |
| Row meta city | `c.city` |
| Row meta niche | `c.niche` |
| Row meta collab count | `c.total_brand_collaborations` |
| Row mono trio | `c.followers_count`, `c.view_based_er`, `c.avg_views` |
| Row rate range | `c.estimated_min_rate – c.estimated_max_rate` |
| Row action button | "+ Add" if verified (`router.push('/dashboard/campaigns')`); "✉ Invite" if unclaimed (`POST /brands/me/creator-invitations`) |

## State 2 — LIST advanced

Same as State 1 with `advanced=true` revealing 7 extra inputs + 3 toggles. All bound to the same `?param=` set.

## State 3 — PROFILE

| Element | Backend source (from `GET /influencers/:id` → `influencer` object) |
|---|---|
| Avatar | `inf.profile_image_url` (or initials from `inf.instagram_handle`) |
| H1 full name | `inf.full_name` (or `inf.name`) |
| @handle | `inf.instagram_handle` |
| Platform | `inf.platform` |
| Location | `inf.city`, `inf.state` |
| Age | `inf.age` |
| Gender | `inf.gender` |
| Scrape date | `inf.source` ('scraped' label) |
| Bio | `inf.bio` |
| Niche tags | `inf.niche` + `inf.secondary_niche` |
| Language tags | `inf.language` |
| ✓ Verified | `inf.is_inflx_verified === true` |
| `View on Instagram ↗` | `inf.website` (only renders when present) |
| Followers stat | `inf.followers_count` |
| ER stat | `inf.engagement_rate` (colored by threshold) |
| Avg Views stat | `inf.avg_views` |
| Total Posts stat | `inf.total_posts` |
| Engagement bars | `inf.avg_likes`, `inf.avg_comments`, `inf.avg_shares`, `inf.avg_saves` (only rendered when `> 0`) |
| Pricing | `inf.price_per_post_min`, `inf.price_per_post_max` |
| Collab types chips | `inf.collaboration_types_json` (JSON-parsed) |
| Past brands | `inf.past_brands_json` (JSON-parsed array of handles) |
| Past brands header `unique_brands_count` chip | `inf.unique_brands_count` — **NEW surface** |
| Audience Insights k/v list | platform / city / language / gender / niche (existing) + use cases (`inf.recommended_use_cases`) — **NEW surface** |
| Activity Signal · posts/wk | `inf.posting_frequency_per_week` — **NEW surface** |
| Activity Signal · 90d posts | `inf.total_posts_90d` — **NEW surface** |
| Activity Signal · commercial% | `inf.commercial_post_rate` — **NEW surface** |
| Activity Signal · rank | `inf.rank_score` — **NEW surface** |
| Activity Signal · growth | `inf.growth_potential_score` — **NEW surface** |
| Activity Signal · active dot | `inf.activity_status` — **NEW surface** |
| Activity Signal · refresh note | `inf.last_calculated_at` (relative) — **NEW surface** |

## State 4 + 5 — ANALYTICS

| Element | Backend source (from `GET /influencers/analytics` → `data` object) |
|---|---|
| Count chip `{N} CREATORS` | `data.overview.total` |
| Stat 1 Total Creators | `data.overview.total` + sub: `verified · scraped · onboarded` counts |
| Stat 2 Avg Engagement | `data.overview.avg_view_er` |
| Stat 3 Distinct Cities | `data.overview.distinct_cities` + sub: `distinct_niches` |
| Stat 4 Rate Range | `data.overview.min_rate – data.overview.max_rate` |
| Tier donut | `data.tier_distribution[]` (6 tiers) |
| Verification donut | `data.verification_breakdown.{verified, unverified}` |
| Top cities bars | `data.city_distribution[]` (top 15) |
| Top niches bars | `data.niche_distribution[]` (top 15) |
| ER bucket bars | `data.er_distribution.buckets[]` (6 buckets) |
| Languages bars | `data.language_distribution[]` (top 10) |
| Rate-by-tier table | `data.rate_by_tier[]` (one row per tier) |
| Top by rank leaderboard | `data.top_rank[]` (top 10) |
| Top by growth leaderboard | `data.top_growth[]` (top 10) |
| Cheapest leaderboard | `data.cheapest[]` (top 10) |
| Cost-efficiency leaderboard | `data.cost_efficient[]` (top 10) |
| Trending brands bars | `data.trending_brands[]` (top 15) |
| Scope filter inputs/select | passed as `?city= ?niche= ?tier=` |
| "View all →" leaderboard links | `router.push('/dashboard/influencers?sort=<key>')` |

---

## Verification at impl time

After each page rewrite, grep to confirm every field consumed:

```
grep -n 'c\.' Packages/brand-web/app/dashboard/influencers/page.js
grep -n 'inf\.' Packages/brand-web/app/dashboard/influencers/\[id\]/page.js
grep -n 'data\.' Packages/brand-web/app/dashboard/influencers/analytics/page.js
```

Every match must correspond to a row in the tables above. Any access to a
field NOT in the tables = phantom; must be removed before merge.
