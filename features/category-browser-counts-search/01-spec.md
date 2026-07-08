# category-browser-counts-search — rail product counts + working search

## Founder (2026-07-08, vs Blinkit)
Two small differences from Blinkit's category browser:
1. Rail categories should show the number of products (Blinkit "N items").
2. The header search icon does nothing — "we have search but it is not working."

## Root cause
- `getNodeChildren` returned children without any count.
- CategoryBrowser `Header` search (⌕) and share (⤴) buttons had NO onPress —
  dead buttons.

## Fix
### Backend
- `getNodeChildren` adds a per-child LIVE product count over the child's whole
  subtree (approved brand + active + pushed_to_store), via a recursive CTE.

### Mobile (OTA)
- Rail item renders "N items" under the category name.
- Header ⌕ wired to open the Find (search/browse) screen, passing the current
  vertical. Dead share button removed.

## Non-goals
- In-category product text search (no product-search endpoint exists) — a
  separate build if wanted; ⌕ opens the existing search screen for now.

## Acceptance
Rail shows counts per category; tapping ⌕ opens the search screen. `pnpm qa`
GREEN; count query validated on dev DB.
