# Feature Spec — backend-test-debt Phase 12 (residual sweep + final split)

> Step 1. Implementation GATED on `lock.json.approved = true`.
> Ledger: `features/backend-test-debt*`. FINAL sweep on the
> now-DETERMINISTIC qa:db instrument. Baseline (post-P11,
> 48eabd8): **368 passed / 14 failed / 382**.

## Problem / goal
P11 finished the last big mechanical cluster (campaigns,
23→14). The 14 residual = **4 carved genuine defects** (RED,
future gated fixes — untouched) + **10 small heterogeneous
class-2/4 drift items** across 6 micro-clusters. The mechanical
cascade is exhausted; Phase 12 is the **final residual sweep**:
verify-twice EACH item individually (rigor per-item, not bulk
forcing), fix the class-2/4, and deliver the **definitive final
ledger + true real-bugs-vs-test-drift split** (the founder-
roadmap end-state).

Verify-twice classified all 10 (conclusive via controller/
service/schema reads — no instrumentation needed; backend
VERIFIED CORRECT for every one; NO new carve — the suspected
follower-city defect was DISPROVEN by reading the follower
register controller):

1. **wallet-shape** (campaigns.test.js:685-686): `getWallet`
   returns `data.wallet.{wallet_balance,…}` (nested,
   wallet.controller.js:68-74); test asserts `data.wallet_
   balance`. class-2/4.
2. **topup paise** (campaigns.test.js:720): order `amount` is
   paise at the Razorpay boundary (`amountPaise`,
   wallet.controller.js:104 + CLAUDE.md "Razorpay requires
   paise"); ₹10000 → 1000000. Test asserts 10000. class-4.
3. **escrow payout-id** (earnings.test.js:181): escrow tranche
   payout id = `tranche_<n>_<ts>` (escrow.service.js:115);
   `mock_payout_` is withdrawals-only. class-4.
4. **brand-sign payout-id** (contracts.test.js:426): same →
   `/^tranche_1_/`. class-4.
5. **brand register 422** (brand.test.js): register requires
   `name`/`city`/`state` (brand.controller.js:121-128); fixture
   sends only business_name/category/address_line/pincode.
   class-2.
6. **influencer register 422** (influencer.test.js:22): register
   requires `name` (influencer.controller.js:205); fixture
   sends only instagram_handle. class-2.
7. **follower-feed feed-empty ×3** (follower-feed.test.js:69):
   `setupFeedScenario` set-create omits `formats_json` →
   brand-sign 500 (contract.controller.js:504-530) → ci never
   `contracted` → `ACTIVE_CI_QUERY` (`ci.status IN contracted/
   active/completed`, follower.service.js:105) excludes it →
   feed empty. SAME P7 Lever-1 lever, last cohort. (Suspected
   follower-city defect DISPROVEN: follower register DOES write
   `users.city`, follower.controller.js:55-60 — verify-twice
   corrected the hypothesis; not a carve.) class-2.
8. **engagement shape** (engagement.test.js:79,82): the
   analytics evolved — `engagementService.getCampaignEngagement`
   returns `totals:{total_likes,total_comments,total_views,
   avg_er}` + `by_set`/`by_influencer` (engagement.service.js:
   151-163); NO `category_benchmark_er`/`daily_reach`. Test
   asserts the removed fields. class-2/4.

## Scope (Phase 12 — the final measured sweep)
8 fix-sites covering the 10 class-2/4 tests; backend VERIFIED
CORRECT; **NO new carve** (4 prior carves stay RED untouched):
align each per the cited controller/service/schema line. Stale
test names corrected for accuracy where they encode removed
behaviour.

## Out of scope / forbidden
- The 4 carved genuine defects (follower-feed-noauth-500,
  onboarded-creator-city-search, search-includes-pending-
  influencers, open-group-publish-assignment-mode-mismatch)
  stay RED, untouched — their fixes are future production-
  impacting gated contracts.
- No `.skip`/delete/assertion-weakening/fabricated-data/
  force-pass. Each aligned value is the verified contract
  (cited), not reverse-engineered. Engagement: re-point to the
  REAL `totals` fields (documents the evolved contract — not
  weakening; the asserted fields genuinely don't exist).
- No backend/runtime change. If any item turns out genuinely
  wrong on re-measure → carve RED, never force (P10/P11
  precedent).

## Surfaces touched
- `backend/tests/`: campaigns, earnings, contracts, brand,
  influencer, follower-feed, engagement test files + this
  contract.
- **Deploy-inert** (tests not in the server import graph; no
  migration/web/mobile/OTA/runtime change → no Render/Vercel).

## Non-functional
- Success = complete per-item classification grounded in cited
  code + honest measured delta on the deterministic instrument
  + the definitive final ledger & true split + zero main-lane
  regression. Big delta via masking = FAILURE.
