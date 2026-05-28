# Flow 45 — Restaurant shared-atom cascade → light brandPalette (F4 foundation)

## Goal
Converge all **9 `components/restaurant/*` shared atoms** from the Wave-4
`lightColors` palette (`#EAB308`) to the F0-locked `brandPalette` (`#FFC107`).
**Visual + UX only. Zero functional change.** This is the F4 foundation flow —
it cascades a consistent look into every restaurant screen (DiningHome/Browse/
Search · RestaurantDetail · RestaurantCart/Booking/Bill · MealsChat) BEFORE those
screens are restyled, exactly as F0 did for the general atom library.

Founder decision (AskUserQuestion 2026-05-28): **atom-cascade first** + **re-theme
the restaurant StatusPill, keep both pills**.

## Atoms in scope (9)
1. **RestaurantCard.js** — feed + list card. paper→white, surface→bg2, border
   kept, success rating pill kept. Composes CreatorChip/OfferPill/StatusPill.
2. **CreatorChip.js** — ink pill + yellow avatar + verified. `#EAB308`→`#FFC107`.
3. **StatusPill.js** (restaurant) — **re-theme PALETTE to brandPalette** (open→
   successPale/successText/success dot · closed→bg2/muted2 · pending→yellowPale/
   yellowText/yellow · confirmed→successPale · cancelled→dangerPale/dangerText ·
   live→yellowPale/ink/yellow). `variant`+`label`+`size`+dot API kept verbatim.
4. **OfferPill.js** — solid (yellow/ink) + soft (yellow50/yellowText). yellow→
   `#FFC107`, yellow200→yellowPale, yellowDeep→yellowText.
5. **FilterChip.js** — default (white/muted4) + selected (ink/white). paper→white,
   border2→muted4.
6. **TimeSlot.js** — default/selected(yellow)/full/disabled. paper→white,
   border2→muted4, surface→bg2.
7. **VegDot.js** — veg green `#00B894`→`#10B981`; non-veg danger kept.
8. **SagarStrip.js** — creator picks strip. surface→bg2, seeAll yellowDeep→
   yellowText. Composes CreatorChip.
9. **FilterSheet.js** — bottom-sheet. paper→white, border2→muted4, apply yellow,
   clear yellowText. Composes FilterChip.
Plus `index.js` doc-comment update (lightColors → brandPalette).

## Two-StatusPill resolution
`components/restaurant/StatusPill` → re-theme palette only; keep its distinct
`variant`/`label`/dot API (handles dynamic "Open till 11 PM" + open/closed/booking
states). `components/brand/StatusPill` (canonical 43-map) → untouched (lifecycle
statuses). No consumer rewiring — the APIs differ and serve different jobs.

## Non-negotiable (preserve verbatim)
Every component's prop API (variant/size/label/selected/onPress/veg/icon/count/…)
byte-for-byte · every render branch + composition · VegDot string/bool coercion ·
FilterSheet schema lists (VIBES/CUISINES/COST_BUCKETS/MORE) + toggle/clear logic ·
OfferPill solid/soft branches · TimeSlot default/selected/full/disabled branches.

## Cascade note
These atoms are consumed by restaurant screens (this + later F4 flows) AND already-
shipped Flow 41 (FollowerWallet) + Flow 43 (BookingConfirmed) via CreatorChip — the
convergence retroactively aligns those to `#FFC107` (improvement; API unchanged).

## Mockup
`design/wave3/flow-45-restaurant-atom-cascade/web.html` (mirrored to
`04-preview/mockups/web.html`). 9-atom gallery + in-context dining-feed frame.
Founder green-signaled via AskUserQuestion 2026-05-28 ("go and implement") BEFORE
implementation.
