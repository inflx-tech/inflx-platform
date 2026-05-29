# Flow 51 — Before / After diff notes

## What shipped
The 2 car_rental screens converted from Wave-3 **dark** to light `brandPalette`.
**Visual + UX only — zero functional change. Final follower flow → bucket complete.**

| Screen | Before | After |
|---|---|---|
| CarDetailScreen (302) | hardcoded dark hexes + amber `#F59E0B` on chrome/CTA/tabs/deal | car-pale hero tint; ink/yellow CTAs; gold stars; ink-mono rating/price; successText offer + successPale Save/insurance; yellowPale deal strip; ink-selected tabs/pickup |
| CarBookingScreen (298) | hardcoded dark + amber, Razorpay | ink hero; white mini card (car-pale img); ink-selected dates/pickup; bg2 stepper; ink-mono breakdown (successText discount, yellowText token); yellowPale pay-hero; ink/yellow PAY VIA UPI |

## Matches the mockup
`design/wave3/flow-51-follower-car/web.html` (founder green-signaled 2026-05-28).
2 frames implemented as drawn.

## Verification
- **Babel transform:** both PASS (Mobile metro preset).
- **Dark-hex / amber / darkColors grep:** 0 refs (only intentional rgba-white floating
  buttons + white-on-ink CTA sub remain).
- **Marker grep (CarBooking):** processPayment / prebookDateRange / prebookDateRangeVerify /
  campaign_influencer_id / inflx_token / Math.round(advanceRupees) present (7 occ) — logic untouched.

## After-evidence
Emulator after-screenshots SKIPPED (deep, payment/data-gated). After-evidence = mockup
+ founder physical APK smoke-test on live follower v64.

## Preserved verbatim
Razorpay processPayment(advance×100) · prebookDateRange/prebookDateRangeVerify · 4-ID
tracking + product_id · sign-in gate · duration/pickup/date price math · pricing tabs ·
dual-CTA routing (full vs token) → CarBooking.
