# Flow 45 — Before / After diff notes

## What shipped
All 9 `components/restaurant/*` shared atoms converged from Wave-4 `lightColors`
(`#EAB308`) to the F0-locked `brandPalette` (`#FFC107`). **Visual + UX only — zero
functional change. Every prop API + render branch + composition preserved verbatim.**

| Atom | Convergence |
|---|---|
| RestaurantCard | paper→white, surface→bg2; green rating pill + ink Outfit name kept; composes CreatorChip/OfferPill/StatusPill |
| CreatorChip | `#EAB308`→`#FFC107` avatar + verified; ink pill kept |
| StatusPill (restaurant) | **PALETTE re-themed** to brandPalette pales (open→successPale/successText/green dot · closed→bg2/muted2 · pending→yellowPale/yellowText · confirmed→successPale · cancelled→dangerPale/dangerText · live→yellowPale/ink); variant+label+size+dot API unchanged |
| OfferPill | yellow→`#FFC107`, yellow200→yellowPale, yellowDeep→yellowText; solid/soft branches kept |
| FilterChip | paper→white, border2→muted4; ink-on-selected |
| TimeSlot | white default, `#FFC107` selected, surface→bg2; 4 state branches kept |
| VegDot | success `#00B894`→`#10B981`; danger kept; bool/string coercion kept |
| SagarStrip | surface→bg2, seeAll yellowDeep→yellowText; composes CreatorChip |
| FilterSheet | paper→white, border2→muted4, apply yellow, clear yellowText; schema + toggle/clear logic kept |
| index.js | doc-comment updated (lightColors → brandPalette) |

## Matches the mockup
`design/wave3/flow-45-restaurant-atom-cascade/web.html` (founder green-signaled
2026-05-28). The 9-atom gallery is implemented as drawn; the in-context feed frame
shows the composed result.

## Two-StatusPill resolution (founder decision)
`restaurant/StatusPill` re-themed to brandPalette, API kept. `brand/StatusPill`
(canonical 43-map) untouched. No consumer rewiring.

## Verification
- **Babel transform:** all 9 atoms PASS (Mobile metro preset).
- **Orphaned-token grep:** 0 remaining `lightColors.{paper|surface|border2|yellowDeep|yellow200|success50|warning|danger50}` refs.
- **jest:** RestaurantBookingScreen / RestaurantCartScreen / RestaurantBillScreen
  suites (which render these atoms) PASS 9/9.
- **Known pre-existing failure (NOT a Flow 45 regression):** FollowerWalletScreen.test.js
  fails to *load* with "Cannot use import statement outside a module" at
  `react-native-vector-icons/MaterialCommunityIcons.js` (FollowerWalletScreen.js:26 —
  an MCI import, NOT my CreatorChip import at line 29). This is a jest
  `transformIgnorePatterns` gap for the vector-icons ESM module, independent of this
  flow (I did not touch FollowerWalletScreen, vector-icons, or jest config). Classified
  per GOVERNANCE §6 as stale/setup. Flagged for a separate test-infra fix. Production
  is unaffected (Metro bundles MCI fine — NATIVE_RUNTIME=2 since Flow 28).

## After-evidence
Emulator after-screenshots SKIPPED — these atoms have no standalone screen; they
become visible when the dining/detail screens ship in the next F4 flows. After-evidence
= the gallery mockup + founder physical APK smoke-test on live follower v58.

## Preserved verbatim
Every prop API (variant/size/label/selected/onPress/veg/icon/count/…), every render
branch (RestaurantCard feed/list, OfferPill solid/soft, TimeSlot 4 states, StatusPill
6 variants, CreatorChip handle/name), VegDot coercion, FilterSheet schema lists +
toggle/clear logic, and all compositions.
