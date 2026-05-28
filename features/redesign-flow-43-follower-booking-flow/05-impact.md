# Flow 43 — Impact analysis

## Verdict (chat one-liner)
**Zero functional disturbance — visual + UX only.** Three booking screens move to
light brandPalette; all booking logic, payments, tracking, and navigation preserved
verbatim.

## Classification
- **production-impacting** — follower OTA bundle serves the restyled screens.
- Mobile JS-only; no backend, no migration, no native rebuild (NATIVE_RUNTIME=2,
  MCI baked since Flow 28). Brand/influencer carry the shared bundle (no
  brand/influencer-screen change in this flow).

## Preserved verbatim (NON-NEGOTIABLE)
| Concern | Where | Preservation |
|---|---|---|
| Slot grid + stylist availability | SlotPicker `generateSlotGrid`, `isWorkingOnDate`, `teamMembers` filter, booked-slot fetch, auto-select-single | logic untouched; only chip styling changes |
| Razorpay (real) | SlotPicker `processPayment({amount: Math.round(advanceRupees*100)})` | paise-at-boundary unchanged |
| Razorpay (mock) | PreBook `razorpay_payment_id = pay_mock_${Date.now()}` | left as-is (NOT converted to processPayment) |
| prebook / prebookVerify | both screens — `booking_type:'appointment'`, `stylist_id`, `notes`, order/payment ids | payload shape byte-for-byte |
| 4-ID tracking | `campaign_id/set_id/offer_id/campaign_influencer_id` in prebook body | threaded unchanged (commission attribution) |
| Restaurant dispatch | PreBook `if (category==='restaurant') return <RestaurantBookingScreen/>` | untouched |
| Confirmation hand-off | RestaurantBooking `navigation.replace('BookingConfirmed', {...})` param shape | untouched (asserted by `RestaurantBookingScreen.test.js`) |
| Sign-in gate | SlotPicker AsyncStorage `inflx_token` check → FollowerLogin | unchanged |
| Pending vs booked copy | BookingConfirmed `brand_status === 'pending'` branch | unchanged |
| Money formatting | `fmtRupees` / `fmtMoney` (rupees, migration 021) | unchanged; rendered in JetBrains Mono |

## Risk
- **Regression risk: minimal.** No control-flow edits; restyle is token/StyleSheet
  only. SlotPicker is a full StyleSheet rewrite (hardcoded hexes) — highest care;
  verified by post-restyle integrity grep + QA.
- **Rollback:** OTA version pin to follower v55 (Flow 42) if needed.

## Mockup sign-off
Founder green-signaled the per-flow mockup via AskUserQuestion 2026-05-28
("Green — implement") BEFORE any screen code. `mockup_locked=true`.
