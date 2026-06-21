# Diff notes — Store offer at food checkout

Backend-only wire (no UI in this changeset).

What changed:
- `placeOrder` accepts optional `brand_offer_id`; in the ORGANIC branch it
  fetches the published store offer (reuse `fetchStoreOfferOrThrow`), resolves
  the discount via the existing `resolveOfferDiscount` (billAmount passed so
  store-wide discounts resolve), and stashes `brand_offer_id` +
  `offer_source='store'` in the order meta.
- `verifyOrder` INSERT persists `brand_offer_id` + `offer_source` on
  `follower_transactions`.

Verified:
- food-store-offer-checkout.test.js 3/3 — BOGO store offer discounts the food
  cart (₹180 free item) + persists brand_offer_id + offer_source='store'; organic
  no-offer = ₹0; unpublished offer = 409.
- food-customisation order tests 3/3 — no regression.

INERT until a client passes `brand_offer_id`; the food cart offer-picker (mobile)
is a later slice. No mockup (backend wire).
