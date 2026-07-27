# Workflow — expected end states

1. Cold open → the Discover tab (admin-curated) is the first screen; one
   swipe/tap to Posts; Videos placeholder. Old cream home unreachable.
2. Bottom nav shows Home · Orders · Profile (white bar); the old center
   Posts FAB is gone; navigate('HomeTab') from legacy code still lands
   correctly (same route name, new surface).
3. Profile (logged in): grouped rows all open their existing screens;
   Wallet row appears ONLY with a positive balance; Log out clears the
   session and flips the same screen to the guest state.
4. Profile (guest): sign-in CTA → FollowerLogin; Wishlist + Addresses
   rows work fully logged-out; no dead rows anywhere.
5. Addresses/Followed/Saved render white-law; every flow inside them
   behaves exactly as before.
