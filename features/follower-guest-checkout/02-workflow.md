# Workflow — expected end states

1. Fresh install, never logged in: open a post → shop → PDP → Add to Bag
   → Bag → "+ Add new address" → search/verify/save → address appears
   selected in the checkout bar. NO login prompt, NO "Session expired".
2. Same guest taps Place Order → phone → OTP → (name if new) → "Signed
   in" → order continues automatically: guest address syncs to the
   account, order is created with the server address_id, payment sheet
   opens.
3. Returning logged-in user: journey identical to before this change —
   server addresses, one-tap Place Order.
4. User whose session died: browsing/cart/address all still work (guest
   path); Place Order asks for OTP again — never a dead end.
