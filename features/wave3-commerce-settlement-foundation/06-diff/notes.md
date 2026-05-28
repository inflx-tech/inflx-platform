# 06-diff — wave3-commerce-settlement-foundation (Wave 3 commit 1)

**Before:** Commerce purchases recorded the split (brand_net, influencer
commission, marketplace fee) but the brand's share never reached the brand —
there was no payout account, no Route integration, no transfer. Brands had no
way to receive commerce settlements.

**After (foundation, dormant):**

*Schema (M077).* `brands` gains `razorpay_linked_account_id`,
`linked_account_status`, and `tcs_applicable` (the per-brand TCS gate);
`follower_transactions` gains `tcs_amount`, `commission_gst_amount`,
`razorpay_transfer_id`. All nullable/defaulted, additive, dormant.

*Route service.* New `razorpayRoute.service.js` (createLinkedAccount,
getLinkedAccountStatus, createTransfer) with a RAZORPAY_MOCK split — mock
synthesizes everything so the flow is testable now; live is built against the
Razorpay Route API but inert until Route is enabled.

*Onboarding.* New `GET`/`POST /brands/me/payout-account` + a
`/dashboard/settings/payouts` screen: the brand connects a payout account built
from its saved bank details; status (not_created → created → activated) is shown
and refreshed from Route.

*Adjacent fix.* `brandApi.getSubscription()` (called in `useEntitlements` + the
subscription page's two poll helpers — one added in Wave 2 commit 4) was never a
real method; the correct name is `getMySubscription`. All 3 sites fixed. This
was a long-standing latent no-op (masked by server-side quota enforcement + the
poll's try/catch fallback), confirmed via git history NOT to be a Window B
regression.

**Scope boundary (deliberate):** this is the foundation only. No transfer fires
on a purchase, no TCS is deducted, and commission still releases on the existing
flat-30 path. Wave 3 commit 2 wires settlement + per-brand TCS + commission GST +
the per-category return window. Live money needs Razorpay Route enabled.

**Verified locally:** backend boot smoke clean; `payout-account.test.js` 5/5
(mock onboarding + 409 + 422 guards); brand-web build compiles (exit 0); `pnpm
qa` 76/76 GREEN (gate=0).
