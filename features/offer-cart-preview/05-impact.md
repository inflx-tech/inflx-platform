# Impact — offer-cart-preview

**Verdict: additive — a read-only preview endpoint + cart display; checkout
UNCHANGED.**

- Backend: one new endpoint (previewCartOffer) reusing existing pure engine +
  price-map helpers. No writes, no Razorpay, no change to placeOrder/verifyOrder
  or settlement. Zero money-path risk.
- Mobile: CartScreen swaps the client discount estimate for the server preview
  and renders free items + reason. One API helper added.
- Exactness caveat (documented): food-with-addons % preview is conservative
  (base subtotal), never over-promises.
- Production-impacting: Render (backend) on push + Mobile OTA. brand-web
  untouched.
- Rollback: revert one commit (endpoint unused by old bundles; cart falls back
  to the client estimate).
