# 04 — Workflow prediction (mockup-lock)

Founder locked the shopping checkout 2026-06-27 with the correction: **one flat list for the
follower, NO brand grouping** (backend splits silently). Address + payment as shown.

- `mockups/shopping-checkout.html` = the locked design: one flat item list · bill details ·
  "You might also like" · bottom bar (Address + Change, PhonePe-default Payment, Place Order).
- **Slice A** (this build): the "You might also like" rail + its endpoint.
- **Slice B** (next): the address + payment bar + the backend per-brand order split.
