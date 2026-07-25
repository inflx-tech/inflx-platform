# Before / after — C2 Bag + Wishlist

- **Before**: no product wishlist existed anywhere (verified — only the
  meals engine had an unrelated "favourites"). The shop bag wore the old
  toing yellow/cream skin with the address buried in the footer.
- **After (board c2-bag-wishlist.html)**: hearts on PDP + shop-sheet cards;
  WishlistScreen with collections-as-chips, live-data grey-outs, Move to
  Bag (+quick size sheet), rename/delete, guest-first with sync-at-login;
  Bag shop path on the white law — address strip on top, via @creator kept,
  per-line Wishlist/Remove, payment row slimmed into the footer, ONE yellow
  Place Order. Food cart path untouched (shared file, `w.*` styles apply
  only when cart.kind === 'shop').

Known deviations for the device pass (honest list):
- Bag line/bill inner text still uses the toing sans font family (full
  font unification is a bigger sweep — flag on walk if it reads wrong).
- Payment method row stays in the footer (the board omitted it; removing
  it would regress the Razorpay preselect built in checkout Slice B —
  C3 restructures payment properly).

Definitive after-check = founder device walk: heart a product as a guest →
Wishlist → collection → Move to Bag → Bag (white) → Place Order.
