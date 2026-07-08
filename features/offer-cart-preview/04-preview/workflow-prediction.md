# Workflow prediction — offer-cart-preview

- Applying a store offer triggers a debounced `/follower/cart/price` call.
- Discount offers: bill shows the exact "−₹X" (was a client estimate).
- BOGO / free-gift: bill lists "🎁 Free · <product>" rows.
- Volume tier not met: an italic reason line ("Spend ₹X more for Y% off").
- Charged total at checkout equals the previewed total (same engine).
- No offer → no call, bill unchanged.
