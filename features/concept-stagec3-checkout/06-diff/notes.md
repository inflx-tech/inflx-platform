# Before / after — C3 checkout

- **Before**: Bag's footer held a fake payment-method row and placed the
  order directly (Razorpay only — COD impossible); success screen was the
  Creator Vibe cream/brown skin for every flow; app-config had no
  checkout knobs and the App Settings page had no ratings switch.
- **After (board c3-checkout.html)**: Bag → Proceed hands off to Review
  Order (address + items + Pay with + bill, one yellow CTA that names the
  action); COD as a first-class server-enforced payment method with an
  admin toggle + fee knob; shop orders land on the white-law success
  screen with the COD badge and address recap; food flow and its
  confirmation untouched.

Known deviation (honest): the online option no longer preselects a
specific UPI/card tab in Razorpay (the old footer picker chose one) —
Razorpay's own sheet owns method choice now, which matches the board's
two-option "Pay with" model.

Definitive after-check = founder device walk: bag → Proceed → COD order
end-to-end, then an online order end-to-end, then flip the admin toggle
off and confirm COD disappears.
