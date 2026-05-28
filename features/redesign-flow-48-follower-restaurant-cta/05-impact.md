# Flow 48 — Impact analysis

## Verdict (chat one-liner)
**Zero functional disturbance — visual + UX only.** Four restaurant transaction
screens converge to brandPalette; all order/booking/pay/chat APIs, mockPayment,
4-ID attribution, auth gates, and the BookingConfirmed nav param shape preserved
verbatim.

## Classification
- **production-impacting** — follower OTA bundle serves the restyled screens.
- Mobile JS-only; no backend, no migration, no native rebuild (NATIVE_RUNTIME=2).
- Brand/influencer carry the shared bundle (no brand/influencer-screen change).

## Preserved verbatim (NON-NEGOTIABLE)
| Screen | Preservation |
|---|---|
| Cart | createOrder/verifyOrder + mockPayment + 4-ID (cid/sid/ciid) + canOrder gate + setQty + ensureFollowerAuth |
| Booking | prebook/prebookVerify + 4-ID + pay_mock_ + `navigation.replace('BookingConfirmed')` param shape (asserted by test) + date/party/time/requests state + ensureFollowerAuth |
| Bill | payAtStore/verifyPayAtStore + mockPayment + prebook-balance token math + discount math + method selector + 4-ID + ensureFollowerAuth |
| MealsChat | mealsApi.chat/pay + address-first flow + offers/recommendation/order state + OFFER_EXPIRED/SLOT_FULL handling |

## Risk
- **Regression risk: minimal.** Pure palette swaps; no control-flow or prop changes.
  Verified by 0-orphan grep + babel (4/4) + 3 restaurant jest suites green (9/9).
- **Rollback:** OTA version pin to follower v60 (Flow 47).

## After-evidence
Emulator after-screenshots SKIPPED (deep, payment/data-gated screens). After-evidence
= the mockup + founder physical APK smoke-test on live follower v61.

## Mockup sign-off
Founder green-signaled via AskUserQuestion 2026-05-28 ("Green — implement") BEFORE any
screen code. `mockup_locked=true`. This flow completes F4 (restaurant vertical).
