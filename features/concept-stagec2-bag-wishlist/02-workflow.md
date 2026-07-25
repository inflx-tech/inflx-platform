# Workflow — expected end states

1. Guest taps the heart on the PDP (or a shop-sheet card) → saved
   instantly, no login. Heart shows filled everywhere the product appears.
2. Wishlist screen: All tab shows every saved product; "+ New" creates a
   collection; long-press a card assigns it; the collection chip shows its
   count; ⋯ renames or deletes (items survive deletion).
3. Move to Bag: unsized product lands in the bag immediately; sized
   product opens the size sheet → yellow Add → toast → Bag.
4. Bag (shop): white chrome, address strip top, via @creator per line,
   Wishlist/Remove under each line, one yellow Place Order. Placing an
   order still runs the guest-first gate (phone → OTP → resume) from
   follower-guest-checkout.
5. First login adopts the guest wishlist: collections recreated, items
   pushed, links restored; the list becomes the server live join and a
   deactivated product now renders "Currently unavailable" with Move to
   Bag disabled.
6. Food cart, bookings, legacy flows: unchanged end to end.
