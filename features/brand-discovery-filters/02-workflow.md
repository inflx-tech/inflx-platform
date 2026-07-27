# Workflow — discovery live filtering (step 2)
## Actor
Approved brand on the influencer directory.
## Steps
1. Type in search / change a filter (city, niche, tier, ER, a range) → results **update
   automatically** ~0.4s after you stop (no Search press).
2. Click a tier chip → results re-filter immediately (no double-fetch).
## Success
- Filters apply live (debounced); no Search press needed; one search fires per settle;
  results correct for the current filter set.
## Failure/edge
- Rapid typing → only the final debounced search fires. Not-approved brand → gated, no search.
