# Feature Spec — Follower Offers tab rebuild (Creator-Vibe)

> UI-governed (Mobile). Rebuild the Offers tab to its locked comprehensive mockup.
> Depends on: the offer-source cutover (listing-section-d0-seams) — LIVE.

## Problem / goal
The offer DATA is now live (offer shelves populated via `brandOffers.adapter`), but the
Offers tab (`Packages/Mobile/src/screens/follower/DealsScreen.js`) still wears the OLD
recolored layout: a generic subtitle + brand-category tabs (All/Dining/Shopping/Booking)
above a flat grid. Rebuild it to `design/wave4-creator-vibe/offers-comprehensive.html`.

## Scope (in)
One screen, three behaviours over the live offers data (`GET /v1/follower/section/offers`):
- **Chrome:** header "Offers · 📍 best deals in {city}" + search; sticky **super-category
  chips** (All · 🍽️ Eat · 🛍️ Shop · ✨ Groom · ✈️ Travel); **sort/filter pills**
  (Best Discount · Ending Soon · By Creator).
- **All + sort:** hero "Today's Best Deal" (biggest live discount) + per-super-category
  deal rails (vibe `DealCard`).
- **A chip selected:** filtered 2-col grid (`NewOfferCard`), sorted.
- **By Creator:** offers grouped under each backing creator (avatar + handle + count +
  View →) with that creator's deal rail.
- 4-ID tracking passes through untouched on every tap (`item.tracking` → ProductDetail).

## Scope (out)
- Backend / data changes (the adapter already feeds the shelves) — none.
- Admin "hero PIN" control (brand-web) — follow-up; existing Section Manager already does
  enable/order/count for the offer shelves.
- "Near Me" sort — offers don't carry distance yet (dropped from the pill set for now).

## Surfaces
- App: **Mobile follower** only (`screens/follower/DealsScreen.js`). No backend, no web.
- Card kit reused: `vibe/DealCard`, `vibe/ShelfHeader`, `vibe/Gradient`, `cards/NewOfferCard`.

## Non-functional
- OTA-safe (pure JS; vibe gradients). NATIVE_RUNTIME unchanged ('3') — no native dep.
- Degrades to an empty state; never throws on missing/empty sections.
- Release = OTA (`publish-ota:follower`). Reversible by reverting the screen + re-publish.
