# Flow 51 — Follower CAR vertical → light brandPalette (F5 — FINALE)

## Goal
Convert the 2 car_rental screens — `CarDetailScreen`, `CarBookingScreen` — from
Wave-3 **dark** (hardcoded hexes + amber `#F59E0B`) to the F0-locked light
`brandPalette`. **Visual + UX only. Zero functional change.** This is the **final
follower flow** — completes the follower bucket and unifies all 3 INFLX apps.

## Screens in scope (2)
1. **CarDetailScreen.js** (302) — hero, rating, influencer deal strip, spec grid,
   feature chips, pricing tabs (with_driver/self_drive/outstation), pickup options,
   directions/distance, dual sticky CTA (Book full / Pre-book ₹300 token) → CarBooking.
2. **CarBookingScreen.js** (298) — mini car card, dates, duration stepper, pickup
   type, price breakdown, pay-hero, token pay CTA. **Real Razorpay.**

## Convergence
car accent `getBusinessAccentLight('car_rental')` = `#1D4ED8` / pale `#DBEAFE` (CAR_PALE)
→ hero + mini-card image **tints only**. amber chrome → ink/yellow CTAs; prices →
ink-mono; discounts/insurance/save → successText/successPale; stars → gold `#FFB800`;
creator-deal strip → yellowPale (yellow avatar + ink/yellow badge); CarBooking header →
ink hero; pickup/date selected → ink border; pricing tabs → ink-selected.

## Non-negotiable (preserve verbatim — see 05-impact.md)
Razorpay `processPayment({ amount: Math.round(advanceRupees*100) })` paise boundary ·
`prebookDateRange` + `prebookDateRangeVerify` (date-range contract) · 4-ID tracking +
`product_id` in prebook body · sign-in gate (AsyncStorage `inflx_token` → FollowerLogin) ·
duration/pickup/doorstep/date math · CarDetail pricing-tab data + dual-CTA routing
(full vs token) → CarBooking with bookingType.

## Mockup
`design/wave3/flow-51-follower-car/web.html` (mirrored to `04-preview/mockups/web.html`).
2 frames. Founder green-signaled via AskUserQuestion 2026-05-28 ("Green — implement")
BEFORE code.
