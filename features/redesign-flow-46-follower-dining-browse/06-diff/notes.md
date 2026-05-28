# Flow 46 — Before / After diff notes

## What shipped
The 3 dining-discovery screens + the shared `LocationHeader` atom converged from
`lightColors` (`#EAB308`) to `brandPalette` (`#FFC107`). **Visual + UX only — zero
functional change.**

| File | Convergence |
|---|---|
| DiningHomeScreen | surface→bg2, paper→white, yellow200→yellowPale (yellow avatar, vibe tiles, eating-now strip, search) |
| DiningBrowseScreen | surface→bg2, paper→white, yellowDeep→yellowText, border2→muted4 (Filters button, chip strip, sort panel, result row) |
| DiningSearchScreen | paper→white, border2→muted4, success50→successPale, surface/surface2→bg2, yellowDeep→yellowText (search box, veg toggle, rows) |
| LocationHeader | yellowDeep→yellowText (caret) — **cascades to shipped F1 HomeScreenV2 + Find** (near-invisible) |

## Matches the mockup
`design/wave3/flow-46-follower-dining-browse/web.html` (founder green-signaled
2026-05-28). All 3 frames implemented as drawn; composes the Flow-45 converged atoms
(RestaurantCard / FilterChip / FilterSheet / VegDot).

## LocationHeader cascade (founder-approved)
Founder chose "Green — incl. LocationHeader". Its `yellowDeep`→`yellowText` caret
shift also reaches the shipped HomeScreenV2 + FindScreen via the shared atom — a
near-invisible improvement (the neutral ink/muted tokens are identical hexes across
both palettes; only the caret yellow changes).

## Verification
- **Babel transform:** all 4 files PASS (Mobile metro preset).
- **Orphaned-token grep:** 0 remaining `lightColors.{paper|surface|surface2|border2|yellowDeep|yellow200|success50}` refs.
- **Marker grep:** `buildTrackingFromOffer` / `getCategoryStores` / `getCreatorsEatingNow` /
  `followerApi.search` / `storeToCardProps` all present (13 occurrences) — logic untouched.
- Pre-existing FollowerWallet vector-icons jest load failure is unrelated (flagged
  separately in Flow 45).

## After-evidence
Emulator after-screenshots SKIPPED per founder (dining screens are data/login-gated).
After-evidence = the mockup + founder physical APK smoke-test on live follower v59.

## Preserved verbatim
4-ID tracking (buildTrackingFromOffer → BrandStore), data calls
(getCategoryStores('eat') / getCreatorsEatingNow / debounced search), storeToCardProps
mappers, client-side filter+sort + activeFilterCount + FilterSheet apply, 300ms search
debounce + rotating placeholder + veg toggle, vibe→initialVibe nav, all empty/hint/
loading render branches.
