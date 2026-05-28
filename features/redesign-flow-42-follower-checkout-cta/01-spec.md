# Flow 42 (F3) — Follower Checkout / CTA · Spec

**Bucket**: mobile-follower redesign (Wave 3) — Phase F3 (shared checkout/CTA), 1st flow
**Owner**: founder · **Locked**: 2026-05-28 (F3 mockup green-signaled via AskUserQuestion)

## 1 · Problem
The core transaction CTAs — pay-at-store/restaurant, online-order, cart — run
mixed legacy themes (PayAtStore darkColors, OnlineOrder legacy navy `colors`,
OrderCart hardcoded dark hexes). These are the highest-stakes screens (real
Razorpay money + 4-ID commission attribution) and must move to the F0-locked
light brandPalette without touching any payment/tracking logic.

## 2 · Goal
Restyle the 3 checkout/CTA screens to light brandPalette per the green-signaled
F3 mockup. Visual only — Razorpay, paise boundary, 4-ID tracking, RestaurantBill
dispatch, discount math, sign-in gate all preserved verbatim.

## 3 · Scope
### In-scope
- `screens/follower/PayAtStoreScreen.js` (393, darkColors) — ink hero + yellowPale deal card + ink-bordered amount + breakdown + ink/yellow PAY + yellow-tile MCI-check success receipt
- `screens/follower/OnlineOrderScreen.js` (210, legacy navy) — light cart + ink-active address radio + ink/yellow PLACE ORDER
- `screens/follower/OrderCartScreen.js` (237, hardcoded dark) — rewritten to light + ink/yellow PROCEED TO PAY
### Out-of-scope
- PreBook + SlotPicker + BookingConfirmed → Flow 43 (own sign-off)
- Enquiry + MyReturns → Flow 44
- RestaurantBillScreen (dispatched from PayAtStore for restaurant category) → F4
- Backend / APIs / payment SDK / tracking — untouched

## 4 · Dependencies (preserved verbatim)
- `processPayment` (Razorpay) + paise-at-boundary (`Math.round(youPay*100)`, `amountRupees*100`)
- `followerApi.payAtStore` / `createOrder` / `verifyPayAtStore` / `verifyOrder`
- 4-ID tracking (cid/sid/oid/iid) on every order/pay call
- PayAtStore → `RestaurantBillScreen` inline dispatch for `category === 'restaurant'`
- Prebook-balance link (prebookBookingId / tokenPaid / atVenueDiscountPct) + Q3 discount math
- `useCart` context (OrderCart) · sign-in gate before pay · address/qty controls

## 5 · Risk surface — MEDIUM (payment screens)
- Highest-stakes screens in the bucket. Restyle is token-level only; all
  payment/verify/tracking branches preserved byte-for-byte (verified: 9 integrity
  markers in PayAtStore, 7 in OrderCart post-restyle).
- PayAtStore amber buttons → ink/yellow; `#000`-on-amber text → yellow-on-ink;
  ✅ → MCI check in yellow tile; green token-banner → successPale.
- OrderCart hardcoded dark hexes → full rewrite preserving handleCheckout exactly.

## 6 · Governance
Per-flow F3 mockup authored (`design/wave3/flow-42-follower-checkout-cta/web.html`)
→ founder green signal via AskUserQuestion BEFORE implementation → implement →
real after-screenshots (emulator) → web QA → OTA → close-out.

## 7 · Success criteria
1. 3 screens render light brandPalette per mockup.
2. Razorpay + paise boundary + 4-ID tracking + RestaurantBill dispatch + discount math unchanged.
3. `pnpm qa` 76/76 GREEN.
4. After-screenshots captured into 06-diff.
5. OTA × 3.
