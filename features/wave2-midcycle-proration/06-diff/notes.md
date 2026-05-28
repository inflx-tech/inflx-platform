# 06-diff — wave2-midcycle-proration (Wave 2 commit 4)

**Before:** `POST /subscription/upgrade` always treated an upgrade as a full
re-subscription — live: a new Razorpay subscription + fresh mandate charging the
full first cycle; mock: a fresh active sub with a new 30/365-day cycle + a
full-price invoice. A brand upgrading mid-cycle paid the full new price and got
a brand-new cycle, losing the time already paid on the old plan.

**After:**

*Backend.* `razorpay.service` gains `createOrder` + `start_at` on
`createSubscription`. `subscription.controller.upgrade` gains an additive
pro-ration branch: for a true mid-cycle upgrade between paid tiers (same period,
higher price, time remaining) it charges only `(newDaily − oldDaily) ×
daysRemaining + GST`. Live → a one-off Razorpay Order (`proration_pending`);
mock → immediate swap keeping the original cycle end + a proration invoice. The
new `order.paid` webhook completes the live path: cancel old sub, create the new
full-price sub `start_at` = old cycle end, swap `brand_subscriptions` (keeping
the aligned cycle end), write the proration invoice — idempotently.
`handleSubscriptionAuthenticated` got a guarded branch so the new sub's mandate
authorization records `mandate_status='active'` without clobbering the aligned
cycle dates. `getSubscription` now returns `notes` (renewal short_url).

*Frontend.* The subscription page opens Razorpay Checkout in **Order** mode for
the delta (description shows pro-rata + GST), polls until the tier swaps, then
shows an "Authorize renewals →" banner so the brand can authorize the new UPI
Autopay mandate for the next cycle. Mock path shows the pro-rata amount.

**Why cancel-and-recreate:** Razorpay subscriptions can't change plan in place.
The brand pays the pro-rata delta for the current remainder (one-off Order) and
authorizes a fresh mandate for the new full-price subscription that starts at
the next cycle.

**Safety / scope boundary:** every NON-qualifying case (Free→paid, paid→Free,
downgrade, period switch, no active sub) falls through to the existing flow,
unchanged — live subscriptions are not at risk. No migration. The live
Order→webhook→re-mandate path needs a founder test-mode validation (Aveen
Growth→Pro) + the `order.paid` webhook event enabled on Razorpay.

**Verified locally:** backend boot smoke clean; `subscription.test.js` 9/9
incl. 3 new proration tests (Growth→Pro delta = ₹3,750 + ₹675 GST on 15 days
left; downgrade + Free→paid fall through, no proration); brand-web build
compiles (exit 0); `pnpm qa` 76/76 GREEN (gate=0).
