# Before / after — brand mobile parity pack

**Before:** six web dashboard features had no mobile counterpart — a brand
owner had to open a laptop to confirm a table booking, mark a meal delivered,
check an order's money breakdown, manage offers, see their plan/invoices/
payout status, or scout the creator market. Mobile parity rule (everything
except listing + campaign creation) was violated in six places.

**After (matches 04-preview/mockups/parity-pack.html, 6 panels):**
- Orders: filterable transaction inbox with per-row expandable money breakdown.
- Bookings: stats strip + pending confirm/reject with customer notification.
- Meals (restaurants only): Today board with prep summary + mark-delivered;
  meal-deal decisions (accept/reject/archive/AI-suggest).
- Offer library: status tabs with live counts, where-used sheet,
  activate/archive/publish-to-store, discount creation (pct/flat).
- Plan & billing: plan + usage bars, invoice list with PDF open-in-browser,
  payout account status/connect.
- Creator market: tiles, tier/city/niche bars, rate benchmarks, leaderboards
  with tap-through to creator profiles.

Deliberate v1 exits to web (labelled in-UI): plan change, complex offer
builders, meals chat-builder/menu-costs/config.

Visual deltas vs mockup: none intended — RN implementation mirrors the panels
1:1 on the locked yellow/ink brand palette. Founder on-device verification is
the release gate (walkthrough protocol).
