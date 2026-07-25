# follower-guest-checkout — guest-first shopping journey

## Founder ruling (verbatim intent, 2026-07-25)

"As a normal person I should be able to browse the products normally, add
products, add address… then phone number then order, that's it. Session
expired / login will come later — first he does shopping. If the user is
not registered, at first time we ask phone number and OTP, next name,
that's it. Address if necessary let him skip; when purchase is happening
we capture there."

## What was wrong

The shop-cart checkout's address row led to AddressScreen, which saved
straight to the server — an auth-required call. A guest (or a user whose
session died) hit "Failed — Session expired. Please log in again." while
just typing an address, i.e. a login wall in the middle of shopping.

## The flow now

1. Browse, PDP, cart — public (already were).
2. **Address — public**: guests get a device-local address book
   (`utils/guestAddress.js`); the same geocode verify runs (those
   endpoints are `authenticateOptional`, verified in follower.routes.js).
   Logged-in users keep the server book; unsynced local rows are shown
   alongside.
3. **Place Order — the ONE login moment**: no session → FollowerLogin
   (phone → OTP → name only for brand-new users) with an `onDone` resume;
   after sign-in the same order continues. A guest-selected address is
   synced to the account first so the payload carries a real address_id.
4. Guests are never told "Session expired" — the api client says
   "Please sign in to continue." when no session ever existed.

## Files

- NEW `Packages/Mobile/src/utils/guestAddress.js` — local address book +
  sync-on-login (guestId → server row map; failed rows stay local).
- `AddressScreen.js` — token-aware load/save (local vs server).
- `CartScreen.js` — guest addresses in the checkout bar; login gate +
  guest-address sync inside placeShopOrder; fresh phone for Razorpay
  prefill after a just-completed OTP.
- `FollowerLoginScreen.js` — `route.params.onDone` resume + restyled to
  the locked design law (pure white, black text, yellow button only —
  it was still the old dark-navy skin and is now the first-purchase
  moment).
- `services/api.js` — guest-aware UNAUTHORIZED copy.

## Out of scope

Food's 3-step OnlineOrder flow (keeps its existing gate); address-skip
UX polish and COD land with C3 checkout.
