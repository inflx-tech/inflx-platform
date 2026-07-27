# Before / After — discovery live filtering (step 2)

**Before:** every filter change (search text, city, niche, tier, ER, follower/rate ranges)
required an explicit **Search** button press before results updated. Tier chips also fired an
inline `doSearch()` right after `setTier` — a stale-tier double-fetch.

**After:** the directory **filters live** — a single debounced (~400ms) effect keyed on all
filter state calls the existing `doSearch()` whenever any filter changes (and on approval).
Type or adjust a filter and results update ~0.4s later, no button press. Tier chips just set
state and let the effect search once (no double-fetch). The Search button + Enter still work
(now optional).

## Changed
- `influencers/page.js` — replaced the initial `[brandStatus]` search effect with the
  debounced multi-dep effect; removed the inline `doSearch()` from the two tier-chip onClicks.

## Verification
- **`next build` compiled clean** (77 pages).
- **Pending (web verify):** founder on Vercel — change a filter / type a niche → results
  update without pressing Search; tier chips re-filter instantly.

## Known delta / deferred (step 2b)
- Numeric ranges are still number inputs (sliders = step 2b); city/niche/language still
  free-text (pick-from-list/autocomplete = step 2b). Audience-fit filters = backend batch.
