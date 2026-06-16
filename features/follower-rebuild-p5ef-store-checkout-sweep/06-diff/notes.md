# 06 — Before/After Diff Notes: Phase 5e/5f Store + Checkout Sweep

Locked reference: `../04-preview/mockups/store-checkout-recolored.html` + the locked
gold/cream palette rule (text on gold = ink).
Capture mode: device/OTA (RN), reviewed at the joint 5→6 verify.

## Changes implemented (white → ink-on-gold)
- `DealsScreen`: active filter chip + sort pill text.
- `OrderHistoryScreen`: active order tab text.
- `RestaurantDetailScreen`: Follow/Directions CTA text.
- `ErrorBoundary`: "Try again" button text.
- `MeScreen`: wallet balance card label/number/arrow + refer "Invite" button text.

## Verified no-op
- `BrandStoreScreen`: already palette-consistent (gold/cream tokens; per-business
  accent CTAs; no white-on-gold). No change.

## Deliberately left (correct as-is)
- `ProductDetailScreen` toggle knob (switch UX), `RestaurantDetail` party-size
  active (on dark), OrderHistory tracker dot (shared state), on-accent badges.

## Verification
- `pnpm qa`: GREEN gate 0. Mobile-only; web build unaffected; no migration.

## Deferred (separate, production-impacting builds → explicit go)
- Brand-Store→section-engine migration; Phase 6 banner-gateway + hero-tiles.
