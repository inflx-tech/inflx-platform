# Expected Outputs — follower-category-rebuild

> Step 4. Concrete, checkable end states.

## Files changed
- `Packages/Mobile/src/components/vibe/ShelfBrandListRow.js` — NEW full-width brand
  list-row (thumb + name + cuisine/category + city; rating/distance omitted).
- `Packages/Mobile/src/components/vibe/index.js` — export `ShelfBrandListRow`.
- `Packages/Mobile/src/components/vibe/StoryCircle.js` — optional follower-count line.
- `Packages/Mobile/src/components/SectionRenderer.js` — `brands` + `config.main_list`
  → vertical list of `ShelfBrandListRow`.
- `Packages/Mobile/src/screens/follower/CategoryListScreen.js` — header + sticky
  sub-cat bar + client-side sub-cat filtering + suppress `subcat_chips` shelf.
- Contract docs + `04-preview/` + `06-diff/notes.md`.

## Acceptance checks
1. **Header** matches mockup: back · icon+label title · "📍 city · N places" ·
   search icon. No big top search bar; no duplicate top sort-pills.
2. **Sticky sub-cat bar** shows "All" + real sub-types derived from the payload
   (no hardcoded list). Tapping filters the brand shelves + All list; "All" clears.
3. **All Businesses** renders as a full-width **list** (list-rows), not a rail.
4. **Shelves** render via the vibe kit (creators with follower counts, brand/
   product rails, deal rail). 4-ID passed through on taps.
5. **Backend-first:** chips are real sub-types; list-rows show no rating/distance;
   Best-Deals empty renders nothing; filter bar is display-only (disclosed).
6. **Defensive:** no sub-types → only "All"; engine error/empty → legacy layout.
7. **No regression to other screens:** `SectionRenderer`/`StoryCircle` changes are
   additive; Home + other engine screens unaffected (story follower-count additive).
8. **QA:** babel transform PASS on touched files; `pnpm qa` GREEN (web 79/79 + C1).
9. **Diff:** `06-diff/notes.md` non-empty vs `category-comprehensive.html`.

## Release classification
- **production-impacting** (follower OTA — Category + shared SectionRenderer/vibe
  ship live). Surfaced for explicit founder go; `released` flips true only after go
  + Maestro attest (or recorded `GOVERNANCE_OVERRIDE`). OTA:
  `pnpm publish-ota:follower` (follower OTA v69 → next).
