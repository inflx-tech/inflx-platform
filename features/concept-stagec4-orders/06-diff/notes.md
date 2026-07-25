# Before / after — C4 orders

- **Before**: Orders was the old Creator-Vibe activity inbox (orders +
  bookings + visits mixed, emoji icons, cream/brown skin) and the detail
  screen matched; no way for a follower to cancel anything; list cards
  had no product photo or name (items_json carries no names).
- **After (board c4-orders.html)**: My Orders is the white-law order list
  with honest tabs and status chips; detail's timeline lights from the
  real per-status timestamps with courier/AWB deep links; cancel exists
  with the locked until-dispatched rule enforced server-side (409 +
  SQL-guarded update for the dispatch race); COD bills read
  to-pay/paid-on-delivery honestly. Return + prebook Pay-Balance blocks
  preserved with identical wiring.

Known scope note: bookings/pay-at-store history no longer shows on this
screen (fashion-first rebuild; the data and endpoints are untouched and
can be resurfaced later).

Definitive after-check = founder device walk: place a COD order → watch
Confirmed on the timeline → cancel it (banner + brand notification) →
place another → have the brand panel dispatch it → confirm the Cancel
button is gone and the courier row deep-links.
