# Flow 43 — Workflow

## Governance loop (per GOVERNANCE.md §1–§4 + locked 5-step rhythm)
1. **Audit** — read all 3 screens (PreBook, SlotPicker, BookingConfirmed),
   confirm tokens / tracking / Razorpay / navigation. ✅ done (verify-twice).
2. **Mockup** — `design/wave3/flow-43-follower-booking-flow/web.html`, 3 frames. ✅
3. **Green signal** — AskUserQuestion → founder "Green — implement". ✅ (mockup_locked)
4. **Implement** — token-swap each screen to light brandPalette (visual only).
5. **After-screenshots** — emulator-5554 before/after into `06-diff/`
   (founder did NOT pick "skip" this round → capture; fallback = physical smoke-test).
6. **06-diff/notes.md** — plain-English before/after notes.
7. **Web QA** — dual-probe pre-warm → `pnpm qa` → 76/76 GREEN gate 0.
8. **Deploy** — `pnpm publish-ota:all` (brand v93 / influencer v82 / follower v56).
9. **Close-out** — fetch manifest hashes → backfill lock.json release block →
   close-out commit (`GOVERNANCE_OVERRIDE` on push).

## Token-swap plan per screen
- **PreBookScreen** (`colors` navy): navyDeep header → ink hero; white cards stay;
  navy buttons → ink bg + yellow text; orange advance/pay accents → yellow family;
  surface2 chips → bg2; t1/t2/t3 → ink/muted/muted3; teal confirm → successText.
  All `fmtMoney` digits already render; ensure mono via JetBrains where money shown.
- **SlotPickerScreen** (hardcoded dark + `#7c3aed`): rewrite StyleSheet to light.
  `#07111E` bg → P.bg; `#0D1D2E` cards → white; `#142438` img → salon-pale;
  `rgba(255,255,255,*)` text → ink/muted; purple `#7c3aed` accent → ink-selected
  (chips) + salon-pale tint (wayfinding); pay btn `#7c3aed` → ink bg + yellow text;
  disabled `#3a4150` → muted4.
- **BookingConfirmedScreen** (`lightColors`): map to brandPalette — `lightColors.yellow`
  `#EAB308` → P.yellow `#FFC107`; yellow50 → P.yellow50; yellow100 → yellowPale;
  yellowDeep → yellowHover; paper → white; surface → bg2; ink/ink2/muted → P equiv.
  Keep QR ink cells, ⏳ pending tile, ink upsell card, CreatorChip.

## Verification of preservation (post-restyle code markers)
Grep each screen after restyle to confirm: `processPayment` (SlotPicker),
`pay_mock_` (PreBook), `prebookVerify`, `booking_type`, tracking IDs
(campaign_id/set_id/offer_id/campaign_influencer_id), `RestaurantBookingScreen`
dispatch, `navigation.replace('BookingConfirmed'`.
