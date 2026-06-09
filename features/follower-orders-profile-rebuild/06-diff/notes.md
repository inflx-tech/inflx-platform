# Before / After — Orders + Profile rebuild

Mockups: 04-preview/mockups/orders-comprehensive.html · orders-profile-comprehensive.html.

## Orders — before/after
- Before: flat list of online orders only (navy header, no tabs, no tracker).
- After: "Orders" + tabs (Active/Orders/Bookings/Visits/Enquiries/Returns/History);
  per-kind cards — order with live tracker, booking with date/ref, pay-at-store with
  amount + "saved ₹X"; via-creator chip. Driven by new /follower/activity feed.

## Profile — before/after
- Before: profile card + menu + logout.
- After: profile card + stats (Orders/Following/Saved) + Wallet card (₹ balance) +
  Refer & Earn banner + menu rows (Orders/Following/Saved/Addresses/Returns/Settings) + logout.

## Verification
- Babel transform clean (both); backend app loads. Founder = on-device acceptance gate;
  Maestro waived via GOVERNANCE_OVERRIDE. Enquiry/Return tabs honest-empty until wired.

## Fix 2026-06-09 — Orders tab crash (negative-percentage style)
The order-tracker connector used `left: '-50%'` (absolute, negative percentage), which RN
rejects → the Orders tab crashed on render. Reworked the tracker connector as a flex line
(no absolute/negative positioning). No data/logic change.
