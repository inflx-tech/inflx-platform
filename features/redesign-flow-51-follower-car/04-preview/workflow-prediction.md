# Flow 51 — Workflow prediction (pre-implementation)

## CarDetail
1. Open a vehicle → car-pale hero, Outfit name, gold stars + ink-mono rating.
2. yellowPale creator-deal strip; white spec grid (successPale insurance box).
3. ink-selected pricing tabs (With Driver / Self Drive / Outstation) recompute the
   white pricing box (ink-mono rate, successText offer, successPale Save badge).
4. ink-selected pickup options; optional Directions / distance.
5. Dual sticky CTA: ink/yellow **Book {car}** (full) + bg2 ink-outline **Pre-book ₹300
   token** → both navigate to CarBooking with `bookingType` + tracking.

## CarBooking
1. ink hero "Confirm Pre-booking"; white mini car card (car-pale img + yellowText offer).
2. ink-selected date boxes; bg2 duration stepper; ink-selected pickup type.
3. White price breakdown (ink-mono, successText discount, yellowText token, ink total).
4. yellowPale pay-hero (ink-mono ₹token); ink/yellow **Pay via UPI** →
   sign-in gate → `prebookDateRange` → `processPayment(advance×100)` →
   `prebookDateRangeVerify` → confirmation alert.

## No behavioural change
Every CTA, Razorpay call, API, tracking field, sign-in gate, and price calc is
identical to today — only colors/fonts shift (dark→light brandPalette), with car-blue
reserved for hero/image tints.
