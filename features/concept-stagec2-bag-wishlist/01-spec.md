# concept-stagec2-bag-wishlist — Bag reskin + product Wishlist with collections

Founder locked the board (04-preview/mockups/c2-bag-wishlist.html) in the
browser pane, 2026-07-25: "Pls lock and start implement."

## Scope

1. **Bag (shop path reskin, live rails unchanged)**: white law — pure white
   chrome, black text, yellow ONLY on Place Order. Address strip at the top
   (guest addresses per follower-guest-first). "via @creator" on every line
   (items are born from posts). Inline size + qty; per-line Wishlist /
   Remove. Offer row + engine-priced bill + payment row kept. Food cart
   path pixel-identical to before (shared file; new styles gated on
   cart.kind === 'shop').
2. **Wishlist (NEW — nothing existed in code; verified)**: product pointers
   + follower-private collections. Collections as chips (All | … | + New);
   2-col grid mirroring the shop-sheet cards; black-outline Move to Bag
   with the quick size sheet for sized products (yellow Add — buy action);
   long-press → assign to collections; active collection ⋯ → rename /
   delete (share parked); dead/out-of-stock products grey out honestly.
3. **Guest-first law**: hearts work logged out (device-local, snapshot
   cards); the guest wishlist — collections included — is adopted into the
   account at the first login; from then on the server list is a LIVE
   brand_products join (never stale copies).
4. **Entry points**: PDP top-bar heart · shop-sheet card heart · bag line
   "Wishlist" · bag header Wishlist link.

## Backend (new, additive)

- Migration 143: follower_wishlist_items (UNIQUE follower×product),
  follower_wishlist_collections (UNIQUE follower×name), collection_items
  link (one item ↔ many collections; deleting a collection keeps items).
- /followers/wishlist* endpoints (list / add / remove / collections CRUD /
  assign / unassign), followerAuth. List prices cards with the same
  OFFER_BEST_PCT + offerFieldsFromPct the PDP and shelves use — one
  evaluator, no drift.

## Out of scope

Wishlist sharing; COD + review-order (C3); My Orders lifecycle (C4);
full font unification of the bag's inner text (noted in 06-diff).
