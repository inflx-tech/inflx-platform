# Flow 46 — Expected outputs

## Visual end state
- **DiningHome** — yellow avatar, mono location pill + Outfit greeting (caret now
  yellowText via LocationHeader), bg2 search, 2-col vibe tiles (date-night = yellow50/
  yellowPale accent), ink-chip "Creators eating now" strip, nearby converged
  RestaurantCards.
- **DiningBrowse** — app bar, bg2 search, ink Filters button + yellow count badge +
  converged FilterChips, mono "N RESULTS · locality" + yellowText "Map view",
  converged RestaurantCard list, FilterSheet on open.
- **DiningSearch** — white search box (muted4 border) + rotating placeholder,
  successPale veg toggle (converged VegDot), mono section labels, brand rows
  (yellowText chevron) + dish rows (VegDot + mono ₹price).
- **LocationHeader** — caret `#CA8A04`→`#6B5A00`; also reflected in shipped
  HomeScreenV2/Find.

## Functional end state (UNCHANGED)
All data calls, 4-ID tracking, client-side filter+sort, 300ms debounce, rotating
placeholder, veg toggle, vibe→initialVibe nav, and every render branch identical to
today. Consumers render unchanged.

## QA gate
`pnpm qa` → **76 passed, gate 0, STATE=GREEN** (zero regression). JS-only; OTA
(NATIVE_RUNTIME=2), no native rebuild.

## Deploy
`pnpm publish-ota:all` → brand v96 / influencer v85 / follower v59 (shared bundle).
production-impacting (follower OTA serves the restyled dining screens; LocationHeader
shift also reaches brand/influencer-shared HomeScreenV2/Find via the shared bundle —
follower-only screens in practice).
