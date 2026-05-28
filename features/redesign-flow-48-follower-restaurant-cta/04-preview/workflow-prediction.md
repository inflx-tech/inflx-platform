# Flow 48 — Workflow prediction (pre-implementation)

## RestaurantCart (online order)
From RestaurantDetail menu → cart → adjust qty → "Place order" → sign-in gate →
createOrder → mockPayment → verifyOrder → success. 4-ID attribution mandatory;
`canOrder` gate blocks when no active campaign.

## RestaurantBooking (table)
From RestaurantDetail "Book Table" → pick date/party/time/requests → "Confirm" →
sign-in gate → prebook → mockPayment → prebookVerify → `navigation.replace`
('BookingConfirmed') with the booking row + tracking + offer.

## RestaurantBill (pay-at-restaurant)
From RestaurantDetail "Pay Bill" (or prebook balance) → enter bill → discount +
token math → pick method → "Pay" → sign-in gate → payAtStore → mockPayment →
verifyPayAtStore → success.

## MealsChat (AI planner)
Chat intent → address-first prompt → engine returns ranked offers (AI starred pick)
→ "Pay & lock" → mealsApi.pay → order locked (OFFER_EXPIRED / SLOT_FULL handled).

## No behavioural change
Every tap target, API call, payment, tracking field, auth gate, and render branch is
identical to today — only colors/fonts shift to brandPalette (`#EAB308`→`#FFC107`).
