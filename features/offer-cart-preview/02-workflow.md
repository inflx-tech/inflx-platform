# Workflow — offer-cart-preview

1. Follower adds items to a shop cart and applies a store offer.
2. CartScreen (debounced) POSTs the cart + offer to `/follower/cart/price`.
3. Backend runs the real engine and returns discount + free-item adjustments.
4. Bill shows:
   - Discount type → "Offer · <name>  −₹X" (exact).
   - BOGO / free-gift → "🎁 Free · <product> [×N]  FREE".
   - Volume/tier not yet met → the reason line ("Spend ₹X more for Y% off").
5. Follower checks out → charged total matches the preview (same engine).
6. No offer applied → no preview call, bill unchanged.
