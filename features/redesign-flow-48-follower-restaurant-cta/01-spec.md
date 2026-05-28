# Flow 48 — Follower RESTAURANT CTA cluster → light brandPalette (F4 final)

## Goal
Converge the 4 restaurant transaction screens — `RestaurantCartScreen`,
`RestaurantBookingScreen`, `RestaurantBillScreen`, `MealsChatScreen` — from Wave-4
`lightColors` (`#EAB308`) to `brandPalette` (`#FFC107`). **Visual + UX only. Zero
functional change.** Completes Phase F4 (restaurant vertical). Composes the Flow-45
converged atoms (CreatorChip, OfferPill, TimeSlot, FilterChip).

## Screens in scope (4)
1. **RestaurantCartScreen.js** (251) — online-order checkout. createOrder/verifyOrder
   + mockPayment + 4-ID attribution (cid/sid/ciid) + canOrder gate + setQty.
   Convergence: surface/surface2→bg2, paper→white, yellowDeep→yellowText.
2. **RestaurantBookingScreen.js** (420) — table booking. prebook/prebookVerify + 4-ID
   + `navigation.replace('BookingConfirmed')` (param shape asserted by
   RestaurantBookingScreen.test) + pay_mock_. Convergence: surface/surface2→bg2,
   paper→white, border2→muted4.
3. **RestaurantBillScreen.js** (484) — pay-at-restaurant. payAtStore/verifyPayAtStore
   + mockPayment + prebook-balance token math + discount math + method selector + 4-ID.
   Convergence: + yellow200→yellowPale, yellowDeep→yellowText.
4. **MealsChatScreen.js** (244) — AI meal planner. mealsApi.chat/pay + address-first
   flow + offers/recommendation/order + OFFER_EXPIRED/SLOT_FULL handling. Convergence:
   yellowDeep→yellowText, success50→successPale.

## Non-negotiable (preserve verbatim — see 05-impact.md)
All order/booking/pay/chat APIs · mockPayment · 4-ID attribution · `ensureFollowerAuth`
sign-in gates (cart/booking/bill) · `navigation.replace('BookingConfirmed')` param
shape · prebook-balance token + discount math · address-first meals flow · every
render branch.

## Mockup
`design/wave3/flow-48-follower-restaurant-cta/web.html` (mirrored to
`04-preview/mockups/web.html`). 4 frames. Founder green-signaled via AskUserQuestion
2026-05-28 ("Green — implement") BEFORE code.
