# Flow 48 — Expected outputs

## Visual end state
- **RestaurantCart** — bg2 thumbs, Outfit names, mono ₹, yellow qty steppers, white
  bill card (yellowText creator-offer line), bg2 CreatorChip attribution, yellow
  Place-order CTA.
- **RestaurantBooking** — bg2 brand strip + OfferPill, ink-selected date/party tiles,
  3-col TimeSlot grid (yellow selected, bg2 booked struck), FilterChip requests,
  sticky summary + yellow Confirm.
- **RestaurantBill** — Outfit-Black ₹ input, white breakdown (yellowPale % chip,
  yellowText discount, successText "You saved", Outfit-Black "You pay"), yellow50-active
  method rows + yellow radio, yellow Pay CTA.
- **MealsChat** — ink header (yellow "X"), white/ink chat bubbles, offer cards (yellow-
  border AI pick + yellowText reasoning + mono strike), ink/yellow "Pay & lock", yellow Send.

## Functional end state (UNCHANGED)
createOrder/verifyOrder, prebook/prebookVerify, payAtStore/verifyPayAtStore,
mealsApi.chat/pay, mockPayment, 4-ID attribution, ensureFollowerAuth gates,
BookingConfirmed nav param shape, prebook-balance token+discount math — all identical.

## QA gate
`pnpm qa` → **76 passed, gate 0, STATE=GREEN**. JS-only; OTA (NATIVE_RUNTIME=2), no
native rebuild. Restaurant jest suites stay green.

## Deploy
`pnpm publish-ota:all` → brand v98 / influencer v87 / follower v61 (shared bundle).
production-impacting (follower OTA serves the 4 restyled screens). Completes F4.
