# Flow 51 — Expected outputs

## Visual end state
- **CarDetail** — car-pale hero · Outfit name + gold stars + ink-mono rating ·
  yellowPale creator-deal strip · white spec grid (successPale insurance) ·
  ink-selected pricing tabs · white pricing box (ink-mono + successText offer +
  successPale Save badge) · ink-selected pickup · dual sticky CTA (ink/yellow Book +
  bg2 ink-outline Pre-book).
- **CarBooking** — ink hero header · white mini car card (car-pale image + yellowText
  creator offer) · ink-selected date/pickup + bg2 duration stepper · white breakdown
  (ink-mono, successText discount, yellowText token, ink total) · yellowPale pay-hero
  (ink-mono ₹token) · ink/yellow PAY VIA UPI + mono refund note.

## Functional end state (UNCHANGED)
Razorpay processPayment(advance×100), prebookDateRange/prebookDateRangeVerify, 4-ID
tracking + product_id, sign-in gate, duration/pickup/date math, pricing tabs, dual-CTA
routing — all identical.

## QA gate
`pnpm qa` → **76 passed, gate 0, STATE=GREEN**. JS-only; OTA (NATIVE_RUNTIME=2), no
native rebuild.

## Deploy
`pnpm publish-ota:all` → brand v101 / influencer v90 / follower v64 (shared bundle).
production-impacting (follower OTA serves the restyled car screens). **Completes the
follower bucket — all 3 INFLX apps unified on brandPalette.**
