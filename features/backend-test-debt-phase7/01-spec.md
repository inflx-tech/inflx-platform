# Feature Spec — backend-test-debt Phase 7

> Step 1. Implementation GATED on `lock.json.approved = true`.
> Ledger: `features/backend-test-debt*`. Continuation of the
> Phase-6 ladder on the now-DETERMINISTIC qa:db instrument
> (qa-db-determinism + qa-db-truncate-flake) — deltas are
> noise-free. Baseline (post-P6, e7ad316): **300 passed / 82
> failed / 382**.

## Problem / goal
P6 cleared the contract-workflow layer for the engagement cohort
(approve-step ×11 suites + formats_json ×6 set-creates, 123→82).
The 82 residual is dominated by the SAME class-2 fixture/contract
drift, one cohort over — proven by an instrumented run against
the real qa:db Postgres (diagnostic added → git-reverted, zero
residue; commissions setup chain captured end-to-end):

- **brand-sign → 500 / 422 → full cascade ×~50** — the
  conversion/payment/contracts/campaigns cohort's campaign-set
  create payloads omit `formats_json`. Contract creation at
  brand-sign hard-throws (`contract.controller.js:504-530`
  `VALIDATION_ERROR 422` when the set has no deliverable
  formats; the brand-sign route re-wraps it 500). The contract
  never signs → `campaign_influencers.status` stays `accepted`
  (not `contracted`) → `txService.validateTracking`
  (`transaction.service.js:107-144`) rejects with **409
  OFFER_UNAVAILABLE** → the follower-payment init returns an
  error envelope → `initRes.body.data.razorpay_order_id`
  TypeError. Surfaces as: `razorpay_order_id` ×25 tests,
  `VALIDATION_ERROR` ×69, `OFFER_UNAVAILABLE`/409 ×10,
  brand-sign 422 ×5, escrow/deliverable count cascades.
  (commissions, conversions, earnings, pay-at-store, prebook,
  prebook-daterange, online-order, contracts brand-sign,
  campaigns publish/escrow, follower-store offers, brand escrow.)
- **`setupPendingBrand` / `setupAcceptedOffer` skip approve ×8**
  — contracts.test.js helpers `setupPendingBrand` (line ~313)
  and the 3 `pending_influencer` tests skip the brand
  "Approve & Send" step (`POST /v1/contracts/:id/approve`,
  draft→pending_influencer). P6 patched the sign-describe's
  `getContractId`, not these. Verified: instrumented run shows
  accept→contract `draft`, approve→`pending_influencer`.
- **influencers/search → 403 ×8** — `influencer.routes.js:15`
  `GET /search` requires `authenticate + requireRole('brand',
  'admin') + requireApproved`. influencer-search.test.js creates
  brand users (lines 46-128) but never approves the brand →
  `requireApproved` 403. Class-2 stale setup.

Phase 7 = the next measured rung: align these THREE code-proven
class-2 levers; classify the rest; carve genuine class-3 RED;
honest delta. NOT force-green; NOT expected to reach zero.

## Scope (Phase 7 — one measured, evidence-driven batch)
1. Inventory the 82 from the authoritative post-P6 evidence
   (`qa/artifacts/_p6b_remeasure_qadb.log`) + a fresh
   deterministic `pnpm qa:db` for the re-measure.
2. 4-class classify each failure (GOVERNANCE.md §6), each
   justified by the ACTUAL controller/route/migration
   (verify-twice; real stack > hypothesis; the dominant chain
   captured by a reverted instrumented run).
3. Fix the THREE code-proven class-2 levers:
   - **Lever 1 (formats_json):** add a deliverable format to the
     set-create payloads in commissions, pay-at-store, prebook,
     prebook-daterange, online-order, follower-store (cite
     `contract.controller.js:504-530`). NOTE: campaigns.test.js
     is deliberately EXCLUDED — verify-twice showed its publish
     setup (`fundedBrandWithCampaign`, line 821) creates NO
     campaign set, so its publish/publish-open failures are a
     SEPARATE publish-time validation drift, not this lever →
     deferred (one-measured-batch; no guessing without
     evidence).
   - **Lever 2 (approve step):** add the brand
     `POST /v1/contracts/:id/approve` (draft→pending_influencer)
     to contracts.test.js `setupPendingBrand` + the 3
     `pending_influencer` tests (cite the P6-verified workflow +
     the instrumented chain).
   - **Lever 3 (brand approval):** add `approveUser(brandUser.id)`
     to influencer-search.test.js's per-test brand setups (cite
     `influencer.routes.js:15` + `middleware/auth.js:142`).
4. CARVE every class-3 genuine defect as its own
   `features/backend-defect-<slug>/`; test LEFT RED; backend
   NOT patched, test NOT edited. (Confirm no NEW genuine 500s
   beyond the already-carved follower-feed-noauth-500.)
5. Re-measure honestly vs 300/82 (deterministic instrument →
   noise-free). Re-run main `pnpm qa` → 66 GREEN / C1
   STATE=GREEN / gate 0 unchanged.

## Out of scope / forbidden
- NOT laneState=PASS / NOT zero. One measured batch; the
  independent non-cascade clusters (campaigns
  publish/publish-open/create-budget validation drift ×~9,
  listing-service schema constants ×10, register-422 ×3,
  money-convention/paise ×4, engagement-analytics field ×1) are
  CLASSIFIED here but their fix re-baselines for Phase 8 (one
  batch/phase ledger discipline; mixing unrelated levers breaks
  the bounded rung).
- No `.skip`/delete/fabricated-data/assertion-weakening/
  force-pass. No test edited to mask a real backend bug.
- Backend runtime fixes for carved defects (own future
  production-impacting gated contracts). The brand-sign route
  re-wrapping a 422 into a 500 is a pre-existing code-quality
  wrinkle P6 already adjudicated as class-2-fixture (not
  carved); Phase 7 stays consistent and records it as an
  observation, not a new carve.

## Surfaces touched
- `backend/tests/**` at Step-7-identified sites; new
  `features/backend-defect-*/` carves only if a NEW class-3
  appears.
- **Deploy-inert** (tests/qa not in the server import graph; no
  migration/web/mobile/OTA/runtime change → no Render/Vercel).

## Non-functional
- Success = complete 4-class inventory grounded in real
  evidence + honest measured delta on the deterministic
  instrument + every genuine defect carved RED + zero main-lane
  regression. Modest delta with rigor = success; big delta via
  masking = FAILURE.
