# Workflow — Campaign Command Center

1. Brand opens /dashboard/campaigns/[id] → full-width page: breadcrumb +
   title → ⚡ needs-attention banner (only when applications / reviews /
   live-confirms pending; replaces the old right rail) → header strip
   (CONTENT x·y·z honest counts · BUDGET · ESCROW · CONVERSIONS · LIKES ·
   AVG ER · ↻ Refresh analytics) → tabs.
2. Hierarchy (default): every set expanded with inline set analytics from
   /engagement by_set; influencer rows (auto-expanded when action needed)
   with rollup analytics from by_influencer; deliverable rows show EVERY
   state — LIVE (stats + per-row ↻), SUBMITTED/UNDER REVIEW (yellow card +
   Review now → reviews?tab=reviews), APPROVED+live_url (Confirm live →
   reviews?tab=live), PENDING, REVISION REQUESTED — plus product chips per
   influencer and a manage ↗ link to the influencers page.
3. Products tab: product | category/section | set(s) | influencer(s) |
   price | status table — set names joined client-side from campaign.sets
   (ci → set), brand-level offers labelled "All sets / all influencers".
4. Analytics tab: Level 1 campaign cards → Level 2 by-set bars → Level 3
   by-influencer bars → Level 4 per-deliverable rows with ↻.
5. ↻ Refresh analytics: sequentially POSTs /deliverables/:id/refresh-stats
   for every live deliverable (progress shown "re-scraping i/n…"), then
   refetches /engagement. Per-row ↻ re-scrapes one post then refetches.
6. Escrow/conversions detail pages, sets/influencers/reviews sub-routes,
   campaign brief toggle: all preserved and linked.

Expected end state: founder can answer "which set, which influencer, which
deliverable, which product, performing how?" from one screen with zero dead
clicks; submitted content is impossible to miss.
