# Flow 43 — Before / After diff notes

## What shipped
Three follower booking screens restyled from their legacy visual systems to the
F0-locked light `brandPalette`. **Visual + UX only — zero functional change.**

| Screen | Before | After |
|---|---|---|
| **PreBookScreen** | legacy `colors` navy (navyDeep header, navy buttons, orange advance/pay accents, teal confirm) | ink hero · white cards · ink-selected date/time chips · bg2 guest stepper · yellowPale advance badge · ink/yellow Review/Pay CTAs · light confirmed splash with yellow check-tile (locked success pattern) · mono money |
| **SlotPickerScreen** | hardcoded dark hexes (`#07111E`/`#0D1D2E`/`#142438`) + purple `#7c3aed` | ink hero · white service card (salon-pale image tint + purple `#7E22CE` creator-deal line) · salon-pale (`#F3E8FF`) date strip / slot grid / stylist cards, **ink-selected** state · greyed+struck booked/overflow slots · dimmed off-day stylists · yellowPale token breakdown · ink/yellow `PAY ₹100 TO CONFIRM` |
| **BookingConfirmedScreen** | `lightColors` `#EAB308` yellow family | brandPalette `#FFC107` convergence (yellow check tile / yellow-50 ⏳ pending tile / yellowPale upsell quote / yellow Done) — same layout, QR grid, CreatorChip, pending copy |

## Matches the mockup
`design/wave3/flow-43-follower-booking-flow/web.html` (founder-green-signaled
2026-05-28). All 3 frames implemented as drawn: ink hero + yellowPale creator-deal
strip, salon-pale wayfinding chips with ink-selected state, yellowPale token
breakdown, ink/yellow Outfit-Black CTAs, yellow-tile success.

## Honest divergences
- **PreBook confirmed view**: the old dark navy header + teal "✓" was restyled to a
  light splash with a **yellow check-tile** to match the locked F0 success pattern
  (same as BookingConfirmed + Flow 32/33/42). Structural delta is minimal (wrapped the
  check glyph in a circular tile); render branch unchanged.
- **Salon-pale border** `#E9D5FF` is a derived purple-pale (one step darker than
  `getBusinessAccentLight('salon').pale` `#F3E8FF`) used for chip borders — not a
  named token. Acceptable: SlotPicker is salon-only.

## After-evidence
**Emulator after-screenshots SKIPPED this round per founder instruction**
(AskUserQuestion 2026-05-28 — "Skip, like Flow 42"). Rationale: Flow 43's screens
are deep/payment-gated — `BookingConfirmed` is only reachable after a completed live
Razorpay booking; `PreBook`/`SlotPicker` sit several nav levels in. Same constraint
that made Flow 42 skip. **After-evidence = founder physical APK smoke-test on live
follower v56.** Before-reference = the locked mockup HTML. Babel transform of all 3
screens passes (metro preset); `RestaurantBookingScreen.test.js` (3/3) confirms the
BookingConfirmed handoff still renders post-restyle.

## Preserved verbatim (verified by post-restyle grep)
- SlotPicker: `processPayment({ amount: Math.round(advanceRupees * 100) })` (paise
  boundary), `prebookVerify({ booking_type:'appointment', stylist_id, notes })`,
  slot-grid + stylist-availability logic, 4-ID tracking, sign-in gate.
- PreBook: `category === 'restaurant'` → `RestaurantBookingScreen` dispatch, mock
  `pay_mock_` payment id (NOT converted to processPayment), `prebookVerify`, tracking.
- BookingConfirmed: `navigation.replace('BookingConfirmed')` param shape, QR pattern,
  `brand_status === 'pending'` branch, CreatorChip.
