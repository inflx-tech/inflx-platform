# Before/after — offer-mrp-retirement

## Before
- Listing wizard captured Price + MRP; the follower app computed the strike-
  through + "X% OFF" from `(mrp-price)/mrp` on cards (two discount mechanisms).
- Product items in the section/browse payload carried `discount_value: null`
  (offers never attached to a product card).

## After
- **Backend**: MRP dropped from every follower product mapper
  (mapBrowseProduct, mapListedProductItem, similar/carousel, restaurant Type-B).
  Products now carry `discount_value` + `offer_price` from the BEST live
  published-to-store `discount` offer that applies (hoisted OFFER_* clauses,
  reused across all product queries). `min_discount_pct` filter + "discount"
  sort dropped their MRP arm (offer arm only). insertProducts writes mrp=null;
  updateListingProduct sets mrp=NULL. Excel template drops the MRP column.
  Column kept dormant (no destructive migration).
- **brand-web**: MRP field removed from the drill-down wizard (add + edit +
  review) and the inventory strike; the strike-through hint removed.
- **Mobile**: food cards (FoodDishCard, DishDetailSheet), CategoryBrowser grid,
  restaurant nested dishes, and cart recommendations now derive the struck
  "was" price from `offer_price` instead of `mrp`. ShelfProductCard/ProductCard/
  ServiceCard were already offer-driven (base price + discount prop). Cart
  line/savings degrade gracefully (mrp→null) — full complex-offer cart preview
  is Phase 2.

## Verification
- Backend modules load; OFFER_BEST_PCT correlated subquery executes on dev DB
  (returns null when no live offer, % when one applies).
- brand-web `next build` ✓ compiled.
- Mobile: all changed files babel-parse clean; CartScreen jest 2/2 pass.
- `pnpm qa` GREEN (79). Checkout money path untouched (already offer-driven).
- Device after-capture owed on the OTA eyeball: a product with a live store
  discount offer shows badge + discounted price; no-offer product shows one
  price, no strike, in every world.

## Deploy
Production-impacting: Render (backend) + Vercel (brand-web) on push; Mobile
needs an OTA publish to show the card changes on device (old bundle degrades
gracefully — mrp strikes just disappear — so no broken intermediate state).
