# Flow 47 — Workflow prediction (pre-implementation)

## What the user sees
Opening any restaurant (share link, saved offer, search, DiningHome/Browse card) →
BrandStore detects `category==='restaurant'` and renders RestaurantDetail:

1. **Hero** photo carousel (swipe; pagination pill), ink overlay back/heart.
2. **Header** — Outfit name, green rating pill, mono cost/locality, open StatusPill;
   yellow50 offer card with code; amenity chips; Sagar's-quote bar.
3. **Sub-tabs** (yellow underline): Overview / Menu / Offers / Reviews / Photos.
4. **Menu** — section FilterChips; dish rows with VegDot + ADD/qty; tapping ADD builds
   the local cart → yellow cart bar → `goToCart` → RestaurantCart.
5. **Reviews** — rating summary + distribution; creator-only filter; "Rate your visit"
   opens the write-review modal (`postReview`).
6. **Sticky CTA** — Book Table / Pay Bill / Order Online / Send Enquiry depending on
   the brand's enabled actions; `dispatchAction` routes with 4-ID tracking.

## No behavioural change
Every tab, tap target, cart operation, API call, tracking field, and CTA branch is
identical to today — only colors/fonts shift to brandPalette (the screen was already
light; this aligns its yellow to `#FFC107`).
