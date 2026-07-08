# Before/after — offer-cart-preview

## Before
- Cart's `estimateOfferDiscount` handled only plain % / ₹ discount; volume /
  BOGO / bundle / free-gift → 0 saving shown, no free item, just "savings at
  checkout". Money was correct at checkout but the bill didn't explain it.

## After
- **Backend**: `POST /follower/cart/price` (previewCartOffer) reuses the exact
  checkout engine + price-map helpers to return discount + free-item
  adjustments + reason. Read-only — no order, no Razorpay, no write. placeOrder/
  verifyOrder/settlement untouched.
- **Mobile**: CartScreen debounced-calls the endpoint on (offer, items) change;
  bill uses the server discount and renders "🎁 Free · <name>" rows for BOGO/
  free-gift and an italic reason line for tier offers.

## Verification
- Backend loads; engine reuse validated on dev DB (live 20%-off offer on a
  ₹1998 cart → ₹399.60, correct reason).
- Mobile: CartScreen + api.js parse clean; CartScreen jest 2/2.
- `pnpm qa` GREEN (79). Checkout money path untouched.
- Device after-capture owed on the OTA eyeball (apply a BOGO/free-gift store
  offer → free item appears in the bill).

## Deploy
Render (backend) on push + follower OTA. brand-web untouched.
