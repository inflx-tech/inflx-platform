# Feature Spec — Follower Creator's Category rebuild (Creator-Vibe)

> UI-governed (Mobile). Screen #5 of the follower redesign. Reached by tapping a
> category tab inside the Creator Store.

## Problem / goal
Rebuild `CreatorCategoryScreen` to `creator-category-comprehensive.html`: the same
creator drilled into ONE vertical, showing their products (not brand-level offer cards)
in that vertical.

## Scope (in)
Runs on the creator's offers passed from the Creator Store (filtered to the vertical):
- **Header**: back · "{Creator} · {Category}" · "curated by @handle" · search.
- **Sticky sub-type chips**: product types within the vertical (from product `section`).
- **Partner brands**: distinct brands the creator collabs with here (circles → BrandStore).
- **"{Creator}'s Picks in {Category}"**: 2-col grid of product cards (ShelfProductCard) —
  flatten offers→products, deduped, with discounted price.
- **"{Creator}'s Top in {Category} 🔥"**: ranked rail of best-discount products.
- Reels note. Every pick tap → ProductDetail with 4-ID tracking + via_store_influencer_id.
- **Entry wiring**: Creator Store category tabs now NAVIGATE here (non-"All").

## Scope (out)
- Backend changes — none (reuses getStore data via route params).
- Real "by sales" ranking (Top uses discount for now).

## Surfaces
- Mobile follower: `screens/follower/CreatorCategoryScreen.js` (rebuild) +
  `InfluencerStoreScreen.js` (tab navigation). Reuses `vibe/{ShelfProductCard,ShelfHeader}`.

## Non-functional
- OTA-safe; NATIVE_RUNTIME '3'. JSX validated via Babel. Founder is the on-device gate.
