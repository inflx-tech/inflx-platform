# Flow 47 — Before / After diff notes

## What shipped
`RestaurantDetailScreen.js` (1,106 LOC, 3 StyleSheets) converged from `lightColors`
(`#EAB308`) to `brandPalette` (`#FFC107`). **Visual + UX only — zero functional change.**

| Area | Convergence |
|---|---|
| `styles` | surface/surface2→bg2, paper→white, yellow200→yellowPale, yellowDeep→yellowText, border2→muted4, warning→#FFB800 (rating stays gold) |
| `rvStyles` (reviews) | border2→muted4, surface2→bg2, paper→white |
| `mo` (meals offers) | success50→successPale, border2→muted4 |
| Composed atoms | StatusPill / OfferPill / CreatorChip / SagarStrip / VegDot / FilterChip already brandPalette (Flow 45) |

## Matches the mockup
`design/wave3/flow-47-follower-restaurant-detail/web.html` (founder green-signaled
2026-05-28). 3 frames (Overview / Menu / Reviews) implemented as drawn; Offers (INFLX
Meals) + Photos tabs carry the same convergence.

## Verification
- **Babel transform:** PASS (Mobile metro preset).
- **Orphaned-token grep:** 0 remaining `lightColors.{paper|surface|surface2|border2|yellowDeep|yellow200|success50|warning}` refs.
- **jest:** RestaurantBooking / RestaurantCart / RestaurantBill suites PASS 9/9.
- **Marker grep:** dispatchAction / buildTracking / navigation.navigate / goToCart /
  mealsApi.getStore / getBrandReviews / postReview present (18 occ) — logic untouched.

## After-evidence
Emulator after-screenshots SKIPPED (deep, data-gated detail screen). After-evidence =
the mockup + founder physical APK smoke-test on live follower v60.

## Preserved verbatim
dispatchAction (call/book/pay/order/enquiry) + 4-ID tracking, local cart
(addToCart/decFromCart/goToCart), CTA branching, offer selection, tab/section/carousel
state, reviews + write-review modal, INFLX Meals offers, BrandStore inline-render path.
