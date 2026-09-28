# offer-builder-v2 — impact

**Production-impacting.** Migration 193, backend (Render), brand website (Vercel). No phone app
change, no OTA. Explicit go required before migrate, push.

## What changes for people
- **Brands (website):** Listings → Offers becomes the new six-step builder on its own page; two new
  tabs (Products without offers, Gift items); an Offer column and panel on Products; a warning before a
  price change on a product in an offer. The old pop-up builder, "Publish to store", the "In store"
  badge, the availing-mode choice and the bulk "Attach offer" action are gone.
- **Brands (phone):** the terms screen's "saved offer" list is empty from now on (every old offer is
  archived; new offers aren't offered to the old sheet). Level 2 replaces that sheet.
- **Creators:** told when an offer they were given ends early, loses products, or a product in it
  changes price. Nobody is linked to an offer until Level 2, so in practice nobody is told yet.
- **Shoppers:** no shopper screens exist (profile-only apps). Old offers stop showing anywhere.

## Every old offer is archived (rules 1.13)
Old store offers stop everywhere they were read: offer badges and struck prices on product cards,
the "has offer" shelf rules, the store page's offer list, the store-direct pay path (answers
"offer unavailable"), brand-wide discounts at checkout, and the publish gate's shopper-offer hint
(a warning, never a block). Copies already written onto collaborations keep their offer name and
numbers. All production offers are test data (handoff).

## Money
None moves. Checkout doesn't read the new tables. The old checkout finds no live old offer, so it
charges normal prices — which is what an offer-free cart already did.

## Data
Migration 193: the `btree_gist` extension; eight nullable/defaulted columns and four checks on
`brand_offers` (status widened); four new tables (`gift_items`, `offer_pool_sources`,
`offer_pool_items` with the two lock constraints, `collab_offers`, empty). The only rows changed:
every old offer set to archived and off the store. `scripts/run-193.js` prints the before/after.

## Risk
- `btree_gist` must be available on the production database (checked by the dry run first).
- Four product-create paths and two price-edit paths gain an after-save hook; each is non-fatal
  (logged), so a hook failure never fails the product save.
- The phone's old saved-offer sheet shows nothing until Level 2.
