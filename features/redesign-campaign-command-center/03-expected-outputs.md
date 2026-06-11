# Expected outputs

- Founder's test campaign (67865957…): Set A renders expanded with
  @sagartravel row → 1 LIVE reel (stats + ↻) + 6 product chips
  (Breads/Chicken sections); Products tab lists all 6 with set "Set A" and
  influencer @sagartravel; header strip CONTENT reads "0 to review ·
  0 awaiting live · 1 live".
- A submitted deliverable (any campaign) renders as a yellow card with
  SUBMITTED pill + Review now button AND increments the strip's to-review
  count AND appears in the ⚡ banner.
- ↻ on a live deliverable → POST refresh-stats → row + totals update without
  page reload. Header ↻ shows "re-scraping i/n…" then updated totals.
- Brand-level-offer campaigns: Products tab shows "All sets / All campaign
  influencers" rows; per-influencer chips show the full catalogue.
- No-engagement campaigns (nothing live): strip shows — values; Analytics
  levels render empty-safe; refresh just refetches.
- Old sub-routes (sets/influencers/reviews/escrow) unchanged and reachable.
- pnpm qa stays GREEN (no campaign-detail specs exist; billing-nav spec
  unaffected).
