# Flow 43 — Expected outputs

## Visual end state
- **PreBookScreen** renders on light brandPalette: ink hero, white offer/date/time
  cards, ink-selected date + time-slot chips, bg2 guest stepper, yellowPale advance
  badge, ink/yellow "Review & Pay ₹X" → "Pay ₹X & Book". Inline confirmed view uses
  yellow success accent. Restaurant bookings still hand off to RestaurantBookingScreen
  (no visual change there).
- **SlotPickerScreen** renders on light brandPalette: ink hero, white service card
  (salon-pale image tint + purple creator-deal line), salon-pale date strip / slot
  grid / stylist cards with ink-selected state, greyed booked/overflow slots + off-day
  stylists, yellowPale token breakdown, ink/yellow "PAY ₹100 TO CONFIRM".
- **BookingConfirmedScreen** renders on brandPalette yellow (#FFC107): yellow check
  tile (or yellow-50 ⏳ pending), Outfit-Black headline, white QR card + mono ref,
  CreatorChip, ink upsell card with yellowPale quote + yellow btn, bg2 requests,
  bottom bar (bg2 Directions + yellow Done).

## Functional end state (UNCHANGED — proof = preserved markers + QA)
- Salon appointment: pick date/time/stylist → ₹100 token via Razorpay
  `processPayment` → `prebookVerify(booking_type:'appointment')` → confirmation alert.
- Generic prebook: form → summary → mock-pay → `prebookVerify` → inline confirmed.
- Restaurant table booking → RestaurantBookingScreen → `navigation.replace('BookingConfirmed')`.
- 4-ID tracking threaded into every prebook body (commission attribution intact).

## QA gate
`pnpm qa` → **76 passed, gate 0, STATE=GREEN** (zero regression). Mobile change is
JS-only; ships via OTA (NATIVE_RUNTIME=2), no native rebuild.

## Deploy
`pnpm publish-ota:all` → brand v93 / influencer v82 / follower v56 (shared bundle
hash). production-impacting (follower OTA serves restyled screens).
