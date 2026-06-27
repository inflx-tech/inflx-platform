# 06 — Before / after notes (Slice A)

**Before:** the cart showed items + bill + Place Order, no recommendations.
**After (`04-preview/mockups/shopping-checkout.html`):** a **"You might also like"** rail
below the bill — same-category cross-sell from the cart items, excluding what's in the cart.

## Delivered
- Backend `GET /follower/cart-recommendations` (sections of cart products → live products in
  those sections, ranked by markdown then newest, excluding cart ids).
- `CartScreen` rail (image · name · price · struck MRP); tap → ProductDetail (organic).
- The follower list stays **one flat list** (locked); the per-brand split is Slice B.

## Verification
- backend load ok; `pnpm qa` GREEN 79; CartScreen babel-compile clean; jest 20/20
  (CartScreen test mock updated for the new api method).
- Capture after Render + OTA + founder re-test.
