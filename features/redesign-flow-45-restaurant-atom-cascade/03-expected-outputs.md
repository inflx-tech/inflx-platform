# Flow 45 — Expected outputs

## Visual end state
All 9 restaurant atoms render in light brandPalette (`#FFC107` yellow), matching
the gallery mockup:
- **RestaurantCard** — white card + `#E4E4E7` border, green rating pill, ink Outfit
  name, mono meta, bg2 vibe chips, composed StatusPill/OfferPill/CreatorChip.
- **CreatorChip** — ink pill + `#FFC107` avatar + white "via @handle" + yellow ✓.
- **StatusPill** (restaurant) — brandPalette pales + dot, mono uppercase, 6 variants.
- **OfferPill** — solid `#FFC107`/ink + soft yellow50/yellowText.
- **FilterChip** — white/muted4 default, ink/white selected.
- **TimeSlot** — white default, `#FFC107` selected, bg2 full/disabled.
- **VegDot** — `#10B981` veg, `#E8401A` non-veg.
- **SagarStrip** — ink title + CreatorChip + yellowText "See all", bg2 tiles, mono ₹.
- **FilterSheet** — white sheet, brandPalette FilterChips, yellow apply, yellowText clear.

## Functional end state (UNCHANGED)
Every prop API, render branch, and composition identical to today. Consumers
(DiningHome/Browse/Search, RestaurantDetail, Cart/Booking/Bill, RestaurantBooking,
shipped FollowerWallet/BookingConfirmed) render with zero code change on their side —
only the atoms' colors/fonts shift.

## QA gate
`pnpm qa` → **76 passed, gate 0, STATE=GREEN** (zero regression). JS-only; ships via
OTA (NATIVE_RUNTIME=2), no native rebuild. Existing restaurant jest suites stay green.

## Deploy
`pnpm publish-ota:all` → brand v95 / influencer v84 / follower v58 (shared bundle).
production-impacting (follower OTA serves the converged atoms; brand/influencer carry
the shared bundle — CreatorChip is the only atom they touch indirectly via shared code,
no brand/influencer-screen change).
