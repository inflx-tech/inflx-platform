# Flow 42 (F3) — Expected outputs

## PayAtStoreScreen
| State | Expected |
|---|---|
| enter | ink hero · yellowPale deal card (ink badge) · ink-bordered amount · bg2 breakdown (successText discount, mono "You Pay Now") · ink/yellow PAY VIA UPI |
| restaurant category | dispatches to RestaurantBillScreen (unchanged) |
| prebook balance | successPale token-banner + token subtracted in breakdown |
| processing | yellow ActivityIndicator |
| success | yellow-tile MCI check + Outfit-Black title + mono ref + bg2 receipt + ink/yellow DONE |

## OnlineOrderScreen
| Element | Expected |
|---|---|
| header | ink hero + Outfit-Black "Your Cart" |
| items | qty steppers (bg2) |
| address | ink-active radio + ink dot |
| footer | mono total + ink/yellow PLACE ORDER |

## OrderCartScreen
| State | Expected |
|---|---|
| empty | yellowPale dashed tile + 🛒 |
| items | white rows + bg2 qty steppers + mono prices |
| breakdown | mono rows + big mono Total |
| below-min | yellowPale banner |
| footer | ink/yellow PROCEED TO PAY (muted4 when disabled) |

## Data assertions (UNCHANGED)
- Razorpay `processPayment` + `Math.round(amount*100)` paise boundary.
- 4-ID tracking on payAtStore/createOrder.
- verifyPayAtStore / verifyOrder.
- RestaurantBill dispatch on restaurant category.
- Q3 discount math + prebook token subtraction.
- sign-in gate before pay.

## Visual evidence
before = F3 mockup (`04-preview/mockups/web.html`); after = real emulator
captures of PayAtStore + Cart in `06-diff/` (login-gated pay screens reached
via the emulator session).
