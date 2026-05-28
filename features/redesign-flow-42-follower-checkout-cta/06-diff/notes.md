# Flow 42 (F3) — Before/After diff notes

## Before
- PayAtStore: Wave-3 darkColors — dark header, amber pay button (#000 text), ✅ emoji success, green rgba token banner.
- OnlineOrder: legacy navy `colors` — navyDeep header, navy place-order button.
- OrderCart: hardcoded dark hexes (#07111E / #0D1D2E / #F59E0B amber / #fff).

## After (light brandPalette)
| Screen | After |
|---|---|
| PayAtStore | ink hero ("Pay at {store}" + mono "via {creator}'s deal") · yellowPale deal card with ink badge · ink-bordered amount input (Outfit-Black ₹ + mono) · bg2 breakdown (successText discount + mono "You Pay Now") · **ink/yellow PAY VIA UPI** Outfit-Black · successPale prebook token-banner · success = **yellow-tile MCI check-bold** + Outfit-Black "Payment Successful!" + mono ref + bg2 receipt + ink/yellow DONE |
| OnlineOrder | ink hero + Outfit-Black "Your Cart" · white item rows + bg2 qty steppers · **ink-active address radio** + ink dot · summary + sticky footer mono total + **ink/yellow PLACE ORDER** |
| OrderCart | white cart + bg2 qty steppers + mono prices · breakdown with big mono Total · yellowPale below-min banner · **ink/yellow PROCEED TO PAY** (muted4 disabled) · yellowPale dashed empty-tile |

## Per F3 mockup (green-signaled)
- Creator-deal strip = yellowPale + ink badge · amount = ink-bordered + mono ·
  discount = successText · primary CTA = ink/yellow Outfit-Black · success =
  yellow check-tile · Razorpay note = mono.

## Preservation evidence (NON-NEGOTIABLE — verified intact)
- `processPayment` + paise-at-boundary (`Math.round(...*100)`) untouched.
- 4-ID tracking (cid/sid/oid/iid) on payAtStore + createOrder verbatim.
- `verifyPayAtStore` / `verifyOrder` flows verbatim.
- PayAtStore → RestaurantBillScreen inline dispatch (restaurant category) verbatim.
- Q3 discount math + prebook token subtraction verbatim.
- sign-in gate, useCart, min-order gate, address/qty controls verbatim.

## After-implementation evidence (governance)
- before = F3 mockup (`04-preview/mockups/web.html`).
- after = **founder physical APK smoke-test** (per founder instruction this
  round: skip the emulator after-screenshot capture for F3 — "dont go after
  implementation screenshots"). PayAtStore + Cart are pay-gated/cart-state-
  gated; founder confirms on real device. Emulator capture available on request
  for any later F3 flow.

## F3 cascade status
Flow 42 done (PayAtStore / OnlineOrder / OrderCart). Next: Flow 43 (PreBook +
SlotPicker + BookingConfirmed), Flow 44 (Enquiry + MyReturns).

## Sign-off
- F3 mockup green-signaled via AskUserQuestion before implementation. QA + OTA: see lock.json.
