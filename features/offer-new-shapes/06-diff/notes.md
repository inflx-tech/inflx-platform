# Before/after — offer-new-shapes

## Before
- Volume = spend tiers only (spend ₹X → % off).
- BOGO = "buy product A → get different product B free" (which is really a
  free-gift; there was no true same-product BOGO).

## After
- **Quantity-volume**: `mode:'quantity'` with `min_qty` tiers — buy N units in
  scope → % off the scope subtotal. Spend tiers unchanged.
- **Same-product BOGO**: `{product, buy_qty, free_qty}` — buy N of a product →
  M of the SAME product free (any variant); free units = complete (buy+free)
  groups × free_qty → engine `adjustments`. Old `buy_product/get_product`
  offers left intact (shape-selected).
- Builder: Volume mode toggle + quantity tiers; BOGO one-product + buy/free qty
  (with a note steering "buy A get different B" to Free gift).
- PDP OfferBlock renders quantity tiers + same-product BOGO. Cart preview
  (Phase 2 endpoint) shows the free item + discount with no cart change.

## Verification
- Engine unit-tested: BOGO buy-1-get-1 with 2 in cart → 1 free (₹500) +
  adjustment; 1 in cart → "add 1 more"; quantity-volume buy 3 → 20% = ₹300.
- Validator unit-tested: new BOGO + quantity-volume pass; old shapes pass;
  missing min_qty fails.
- brand-web `next build` ✓; OfferBlock parses; `pnpm qa` GREEN (79).
- Device after-capture owed on the OTA eyeball.

## Deploy
Render (backend) + Vercel (brand-web) on push + follower OTA (OfferBlock).
