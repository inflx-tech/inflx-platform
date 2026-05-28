# Flow 46 — Follower DINING browse → light brandPalette (F4)

## Goal
Restyle the 3 dining-discovery screens — `DiningHomeScreen`, `DiningBrowseScreen`,
`DiningSearchScreen` — from Wave-4 `lightColors` (`#EAB308`) to the F0-locked
`brandPalette` (`#FFC107`). Plus converge the shared general atom `LocationHeader`
(a DiningHome dependency). **Visual + UX only. Zero functional change.**

Thin screen-chrome restyle: the cards/chips these screens compose
(RestaurantCard, FilterChip, FilterSheet, VegDot) were already converged in Flow 45.

## Screens in scope (3 + 1 dependency)
1. **DiningHomeScreen.js** (448, lightColors) — vibe entry: location pill + greeting,
   bg2 search, 2-col vibe tiles (date_night accent), "Creators eating now" strip,
   nearby RestaurantCard list. `getCategoryStores('eat')` + `getCreatorsEatingNow` +
   `buildTrackingFromOffer` → BrandStore. Convergence: surface→bg2, paper→white,
   yellow200→yellowPale.
2. **DiningBrowseScreen.js** (471, lightColors) — filtered list: app bar, search,
   ink Filters button + chip strip + FilterSheet, sort panel, mono result count,
   RestaurantCard list. Client-side filter+sort. Convergence: surface→bg2, paper→
   white, yellowDeep→yellowText, border2→muted4.
3. **DiningSearchScreen.js** (228, lightColors) — debounced `followerApi.search`:
   rotating placeholder, successPale veg toggle (VegDot), brand/dish result rows.
   Convergence: paper→white, border2→muted4, success50→successPale, surface→bg2,
   surface2→bg2, yellowDeep→yellowText.
4. **LocationHeader.js** (general atom, DiningHome dep) — caret yellowDeep→yellowText.
   **Cascades to shipped F1 HomeScreenV2 + Find** (near-invisible caret-yellow shift).
   Founder approved including it (AskUserQuestion "Green — incl. LocationHeader").

## Non-negotiable (preserve verbatim — see 05-impact.md)
4-ID tracking (`buildTrackingFromOffer` on every card → BrandStore) · data calls
(`getCategoryStores('eat')`, `getCreatorsEatingNow`, debounced `search`) ·
`storeToCardProps` mappers · client-side filter+sort + `activeFilterCount` +
FilterSheet apply · 300ms search debounce + rotating placeholder + veg toggle ·
vibe→initialVibe nav · all empty/hint/loading render branches.

## Mockup
`design/wave3/flow-46-follower-dining-browse/web.html` (mirrored to
`04-preview/mockups/web.html`). 3 frames. Founder green-signaled via AskUserQuestion
2026-05-28 ("Green — incl. LocationHeader") BEFORE implementation.
