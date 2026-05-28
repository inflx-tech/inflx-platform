# Flow 47 — Follower RESTAURANT DETAIL → light brandPalette (F4)

## Goal
Converge `RestaurantDetailScreen.js` (1,106 LOC) — the dining centerpiece,
inline-rendered by BrandStore for `category==='restaurant'` — from Wave-4
`lightColors` (`#EAB308`) to `brandPalette` (`#FFC107`). **Visual + UX only. Zero
functional change.** Composes the Flow-45 converged atoms (StatusPill, OfferPill,
CreatorChip, SagarStrip, VegDot, FilterChip).

## Screen in scope (1, 3 StyleSheets)
`RestaurantDetailScreen.js` — photo-carousel hero · header (Outfit name + green
rating + mono meta + open StatusPill) · yellow offer card · amenity chips · Sagar's
Table strip · sticky sub-tabs (Overview / Menu / Offers / Reviews / Photos) · local
cart (online-order) · reviews + write-review modal · INFLX Meals offers · sticky CTA
branched by enabled actions. StyleSheets: `styles`, `rvStyles` (reviews), `mo`
(meals offers).

## Convergence (lightColors → brandPalette)
surface/surface2→bg2 · paper→white · yellow200→yellowPale · yellowDeep→yellowText ·
border2→muted4 · success50→successPale · warning→`#FFB800` literal (rating stays
gold; StarRow already hardcodes `#FFB800`). All neutral/ink/muted/success/yellow/
yellow50 tokens are identical hexes across both palettes.

## Non-negotiable (preserve verbatim — see 05-impact.md)
`dispatchAction` (call/directions/book/pay/order/enquiry) + nav to PreBook/PayAtStore/
OrderCart/Enquiry · 4-ID `tracking` prop threaded into every nav · local cart
(addToCart/decFromCart/cartCount/cartTotal/goToCart items mapping) · CTA branching
(showBookTable/showPayAtStore/showOnlineOrder/showEnquiry; cart-bar vs action-bar) ·
offer selection (best across influencers) · sections grouping · tab state · photo
carousel · APIs (`mealsApi.getStore`, `getBrandReviews`, `getReviewable`,
`postReview`) · BrandStore inline-render path (BrandStore untouched).

## Mockup
`design/wave3/flow-47-follower-restaurant-detail/web.html` (mirrored to
`04-preview/mockups/web.html`). 3 frames (Overview / Menu / Reviews). Founder
green-signaled via AskUserQuestion 2026-05-28 ("Green — implement") BEFORE code.
