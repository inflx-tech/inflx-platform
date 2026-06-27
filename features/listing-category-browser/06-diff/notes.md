# 06 — Before / after notes

**Before** = the locked mock `04-preview/mockups/category-browser.html` (sidebar rail +
filter chips + 2-col grid, toing palette).

**After** = the live `CategoryBrowserScreen` rendered by the real endpoints, reached via
Find → "Browse fashion by category". Capture pending the OTA ship + founder live-test
(no Maestro device; `release.released` stays false per program precedent).

## What the implementation delivers vs the mock
- Header (back/title/search/share), breadcrumb segment › category › leaf — matches.
- Left rail from `category_nodes` children; selected leaf highlighted — matches.
- Filter chips built from the facet values actually present in the live set
  (Filters button with active count, Sort, one chip per facet) — matches; the mock's
  "Size: 5" active state is reproduced by the pink active-chip styling.
- 2-col product grid (image, name, brand, price, struck mrp, % off, rating) — matches.
- Filter/sort bottom sheet (toggle pills + counts, Clear-all + Apply) — adds the
  interaction the static mock implies.

## Known visual deltas (acceptable)
- Rail thumbnails are tinted icon tiles (category_nodes has no per-node image) rather
  than product photos — same as the mock.
- Real product photos/prices replace the mock placeholders; discount % is derived from
  mrp (display-only).

## Verification
- Backend: require/load clean; `pnpm qa` green (see release notes).
- Mobile: metro bundle compiles; jest unchanged-green.
- Live founder test on OTA = the final before/after sign-off for this contract.
