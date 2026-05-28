# Flow 43 — Follower BOOKING flow → light brandPalette (F3, 2nd flow)

## Goal
Restyle the follower **booking trio** — `PreBookScreen`, `SlotPickerScreen`,
`BookingConfirmedScreen` — from their three legacy visual systems onto the
F0-locked light `brandPalette`. **Visual + UX only. Zero functional change.**

Part of the mobile-follower bucket (Wave 3), Phase F3 (shared CTA / checkout).
Flow 42 shipped PayAtStore + OnlineOrder + OrderCart; this flow completes the
booking surfaces.

## Screens in scope (3)
1. **PreBookScreen.js** (525 LOC, legacy `colors` navy) — generic advance/reserve
   booking. In-screen 4-step flow: `form → summary → paying → confirmed`.
   Category-aware copy (salon / car_rental / bike_rental / default). **Restaurant
   category dispatches to `RestaurantBookingScreen` — left untouched.** Uses a
   **mock** payment id (no `processPayment`) — preserved as-is.
2. **SlotPickerScreen.js** (490 LOC, hardcoded dark hexes + purple `#7c3aed`) —
   salon appointment picker: service summary · 14-day date strip · 30-min slot
   grid (booked/overflow greyed) · conditional stylist picker (auto-select single;
   grey non-working) · notes · token/balance breakdown · sticky "Pay ₹100 to
   confirm". Real Razorpay `processPayment(Math.round(advance*100))` +
   `prebookVerify({booking_type:'appointment', stylist_id, notes})`.
3. **BookingConfirmedScreen.js** (304 LOC, `lightColors` `#EAB308`) — pure success
   state, reached via `navigation.replace('BookingConfirmed', …)` from
   RestaurantBookingScreen. Success splash (yellow tile + ✓ / pending ⏳) · QR card
   + mono ref + table# · CreatorChip · creator upsell · requests · directions/done.

## Design language (locked at F0 / Flow 38)
- Light `brandPalette` (`P`): white `#FFFFFF` / yellow `#FFC107` / ink `#0A0A0A`,
  Outfit (display) + Plus Jakarta Sans (body) + JetBrains Mono (money/IDs/dates).
- ink hero header (back + title + sub + yellow underline accent).
- yellowPale creator-deal strip (attribution → commission credit).
- Per-business accent = wayfinding only: salon `#7E22CE` / pale `#F3E8FF` via
  `getBusinessAccentLight('salon')` on date/slot/stylist chips; ink-selected state.
- Token/balance breakdown = yellowPale; discount = successText.
- Primary CTA = ink bg + yellow Outfit-Black UPPERCASE.
- Success = yellow check-tile (matches Flow 32/33/42).

## Non-negotiable (preserve verbatim — see 05-impact.md)
Slot/stylist availability logic · Razorpay flows (SlotPicker `processPayment`
paise-at-boundary; PreBook mock) · `prebookVerify` payloads · 4-ID tracking
(cid/sid/oid/iid) · restaurant→RestaurantBookingScreen dispatch ·
`navigation.replace('BookingConfirmed')` param shape (asserted by
`RestaurantBookingScreen.test.js`) · sign-in gate · guest/qty controls ·
pending-vs-booked confirmation copy.

## Mockup
`design/wave3/flow-43-follower-booking-flow/web.html` (mirrored to
`04-preview/mockups/web.html`). Founder green-signaled via AskUserQuestion
2026-05-28 BEFORE implementation.
