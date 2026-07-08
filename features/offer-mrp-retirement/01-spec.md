# offer-mrp-retirement — one price per product; all discounts from the offer engine

## Founder decision (2026-07-08, locked)
Remove MRP in ALL worlds (food, fashion, furniture, everything). A product
carries ONE price. Every discount comes from the offer engine — single source
of discount truth, no duplicate mechanism. "Whatever discounts we add is from
offer engine."

## Current state (verified, 3-agent trace + self-verify)
- `brand_products.mrp` (mig 118) is a display-only "was" price. Follower cards
  compute the strike-through + "X% OFF" from `(mrp-price)/mrp`, NOT from offers.
- Offers ARE fully applied server-side at checkout on all 3 paths (pay-at-store,
  store-direct, online-order via priceOrderForGroup:1329) — money is already
  correct. The gap is DISPLAY: browse/section product cards show a discount from
  MRP, and offers don't attach to product items in the listing payload
  (`discount_value: null` on products today).
- `min_discount_pct` section filter (sectionRules:937) matches on MRP-markdown
  OR a live offer — it already has an offer arm.

## Scope
### Backend
1. Remove `mrp` from every follower-facing product mapper (mapBrowseProduct
   listing.controller:395; mapListedProductItem sectionRules:697; similar/
   carousel follower.controller:1552; restaurant Type-B sectionRules:1059).
   Cards stop showing an MRP strike everywhere (dormant existing food rows too).
2. Attach `discount_value` (+ `offer_price`) to product items from the BEST live
   published-to-store `discount`-type offer, reusing the proven offerLiveGate/
   offerApplies/discPct clauses. Non-discount offers (volume/bogo/bundle/gift)
   keep showing on the PDP OfferBlock + offer/DealCard surfaces as today.
3. Drop the MRP arm of the `min_discount_pct` filter (keep the offer arm).
   Drop the MRP-markdown ORDER BY arms (listing:500, follower:1545) → offer or
   created_at.
4. Stop WRITING mrp in listing create (insertProducts) + edit
   (updateListingProduct). Leave the `mrp` COLUMN in place, dormant (reversible,
   no destructive migration).

### brand-web
5. Remove the MRP field from the drill-down wizard (add + edit), the review
   step, and the inventory strike-through; remove the MRP hint added in
   listing-home-consolidation.

### Mobile (follower)
6. Remove `mrp` reads + strike-through from all card/cart sites
   (ShelfProductCard, ProductCard, ServiceCard, FoodDishCard, DishDetailSheet,
   RestaurantDetailScreen, CategoryBrowserScreen, CartScreen item-savings,
   CartContext/FoodOrderContext). Cards render the offer-based `discount_value`
   when present; no offer → single price, no badge.

## Non-goals
- Cart preview for volume/bogo/bundle/free-gift (→ Phase 2).
- New offer shapes: quantity-volume, BOGO redefinition (→ Phase 3).
- Builder UX reorder/finder (→ contract offer-builder-ux, Phase 1b).
- Dropping the mrp column (kept dormant).

## Acceptance
Fashion + food product with a live store discount-offer shows the correct
"X% OFF" + discounted price on cards (from the offer, not MRP). A product with
no offer shows one price, no strike, anywhere. Listing wizard has no MRP field.
Checkout totals unchanged (already offer-driven). `pnpm qa` GREEN.
