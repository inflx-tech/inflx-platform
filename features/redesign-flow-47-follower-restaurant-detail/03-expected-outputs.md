# Flow 47 — Expected outputs

## Visual end state
RestaurantDetailScreen renders on light brandPalette across all tabs:
- **Overview** — photo-carousel hero, Outfit name + green rating pill + mono meta +
  open StatusPill, yellow50 offer card (yellow code), bg2 amenity chips, ink Sagar's-
  quote bar (yellow italic), yellow-underline sub-tabs, vibe tags (yellowPale) +
  CreatorChip.
- **Menu** — ink Sagar-quote, FilterChip section chips (ink-on-selected + mono count),
  dish rows (VegDot + yellowPale BESTSELLER + ink Pick + mono ₹price + yellow ADD/qty),
  yellow cart bar.
- **Reviews** — Outfit-Black avg + gold stars + success distribution, ink creator-only
  filter (yellow toggle), yellow "Rate your visit", review cards (CreatorChip + gold
  stars + mono date), write-review modal.
- **Offers** (INFLX Meals) + **Photos** (grid) — same convergence.
- Sticky CTA branches: Book Table / Pay Bill / Order Online / Send Enquiry; cart-bar
  when items in cart.

## Functional end state (UNCHANGED)
dispatchAction, 4-ID tracking, local cart, CTA branching, offer selection, tab state,
photo carousel, and all APIs identical to today. BrandStore inline-render unchanged.

## QA gate
`pnpm qa` → **76 passed, gate 0, STATE=GREEN**. JS-only; OTA (NATIVE_RUNTIME=2), no
native rebuild. Restaurant jest suites stay green.

## Deploy
`pnpm publish-ota:all` → brand v97 / influencer v86 / follower v60 (shared bundle).
production-impacting (follower OTA serves the restyled RestaurantDetail).
