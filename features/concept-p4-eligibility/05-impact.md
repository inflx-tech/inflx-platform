# Impact — concept-p4-eligibility

**Verdict: production-impacting (backend + DB migration + admin tab),
additive; one deliberate behaviour change: dark posts stop rendering.**

- DB: 3 additive columns on creator_posts, all NULL on existing rows
  (= visible until first sweep). Partial index for the feed filter.
- Feed: gains the cache filter — visible-behaviour identical until a sweep
  writes a 0. Detail: gains a per-request live check; a dark post 404s
  (intended honesty, not a regression — prod has zero posts today).
- Cron: one new job every 30 min; cost scales with approved-post count
  (per-post rule query ≈ the picker's); fine for launch volumes, batch
  later if posts reach tens of thousands.
- Notifications: 1 new type (post.dark). Creator My Posts payload gains
  eligible_product_count/went_dark_at (additive; mobile renders it in a
  later OTA).
- Admin: 2 read-only endpoints + an "In use" tab on the existing concepts
  page. No other surface touched. Rollback: revert commit (columns inert).
