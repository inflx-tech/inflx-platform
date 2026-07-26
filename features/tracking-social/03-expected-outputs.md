# Expected Outputs — Tracking (social half)

## UI
- `CollabTrackingScreen` matches `04-preview/mockups/tracking-lifecycle.html` §3: social
  panel (aggregate + per-post) + INFLX Phase-2 placeholder.

## Behaviour / logic
- `aggregateSocialStats(list)` → { postCount, reach, likes, comments, saves, shares,
  impressions, avgEngagementRate } — pure, unit-testable (sums counts, averages ER over
  posts that have it).
- Loads collab via `getMyCampaignDetail`; per live deliverable, `getDeliverable` for stats;
  Refresh via `refreshStats`.

## Tests
- Mobile jest: unit tests for `aggregateSocialStats`; module-load smoke for the screen.
- **Maestro (Rule-5 gate):** open Tracking from a collab with a live post → social
  aggregate renders; INFLX panel shows Phase-2 placeholder.

## Non-regression
- Full mobile jest green (incl. updated collabDetailModel tests: tracking hero → 'tracking',
  sectionsFor includes 'tracking' for post-sign).
