# Before / After — offer-engine-engagement-multi

**Before** = engagement offer step used a single-select "Use a saved offer"
dropdown (one offer per influencer). **After** = engagement shows a **multi-select
checklist** of active saved offers; conversion/hybrid keep the single-select.
Verified by `next build` GREEN.

| Aspect | Before | After |
|---|---|---|
| Engagement offer picker | single `<select>` (1 offer) | multi-select checklist (any number) |
| Stored as | `brand_offer_id` (1) | `promoted_brand_offer_ids uuid[]` |
| Allocation | promotional | promotional (forced when list present) |
| Conversion/hybrid | single-select | **unchanged** |

## Notes
- Backend additive: new nullable `uuid[]` column (migration 086) + a validated
  array branch in invite/update; conversion path untouched.
- Each promoted id validated against the brand's library (foreign/archived → 422).
- Follower-side "creator promotes these" surfacing is downstream; the offers are
  already buyable via store-publish/store-direct.
- Live Playwright capture not run here; structural before/after vs Screen 03 +
  build green + offer-attach 11/11.
