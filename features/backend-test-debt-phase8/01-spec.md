# Feature Spec — backend-test-debt Phase 8

> Step 1. Implementation GATED on `lock.json.approved = true`.
> Ledger: `features/backend-test-debt*`. Continuation of the
> Phase-7 ladder on the now-DETERMINISTIC qa:db instrument.
> Baseline (post-P7, 888cd05): **333 passed / 49 failed / 382**.

## Problem / goal
P7 cleared the formats_json + approve-step cascade (82→49) and
classified the residual. Phase 8 takes the **money-convention
cluster** — a cohesive, single-root-cause class-2/4 batch where
the backend is VERIFIED CORRECT and the test fixtures/assertions
are stale on TWO evolved contracts:

1. **migration 021 — ALL RUPEES.** Every DB value & API field is
   rupees `numeric(x,2)`; paise only at the Razorpay boundary
   (CLAUDE.md). These tests predate 021 and send/assert PAISE.
2. **Tier-1 conversion fix.** The follower discount now resolves
   from `campaign_influencers.offer_type + offer_config_json`
   (offer.service.js `resolveDiscount`; validateTracking
   transaction.service.js:108-112), NOT the legacy set-level
   `campaign_offers.discount_value`. These tests invite WITHOUT
   `offer_config_json` → `ci.offer_config_json = null` →
   `value = Number(offerConfig?.value || 0) = 0`
   (offer.service.js:134) → discount = 0.

Verify-twice (real controllers, P7 instrumented dump showing
`ci.offer_config_json: null`):
- `campaign.controller.js` invite stores `offer_config_json`
  from the request body (line 634, 735-736) — the fixture must
  send it; the backend is correct.
- `offer.service.js resolveDiscount` (132-163): pct on a bill =
  `r2(billAmount * value / 100)`; `sub_type` defaults to `'pct'`
  (133); `resolveScope(null)` → `'store'` (104-108) so
  `{ value: 30 }` is sufficient for pay-at-store.
- `transaction.controller.js initiatePayAtStore` is rupees-native
  (bill in rupees; breakdown rupees).
- `withdrawal.controller.js:35-39`: `amount_requested` is RUPEES;
  `< 100 → WITHDRAWAL_TOO_SMALL`. Fixture sends `5000` (₹5000,
  not too small) → 201 not 422.
- prebook offer is `prebook_advance: 200` (₹200 rupees); the
  endpoint correctly returns `200`; tests assert `20000` paise.

The verified rupees math (bill ₹1000, 30% pct, 8% commission,
8% platform fee): discount **300**, net **700**, influencer
commission **56**, platform fee **56**, brand_net **588**,
conversion revenue **700**.

## Scope (Phase 8 — one measured, evidence-driven batch)
The money-convention cluster = 10 failing tests, all class-2/4,
backend verified-correct:
1. **Lever A — pay-at-store/commission discount chain**
   (class-2 fixture: invite missing `offer_config_json`, bill
   sent in paise; class-4: paise assertions). Fix shared setups
   `setupPayAtStoreScenario` / `setupCommissionScenario`
   (invite `+ offer_config_json:{ value:30 }`, `bill_amount`
   100000→1000) + per-test rupees assertions: pay-at-store
   "discount calc" + "commission breakdown" + verify
   "creates follower_transaction"; commissions "required
   fields" + "summary totals"; conversions "analytics";
   earnings "commission_summary".
2. **Lever B — prebook advance** (class-4 pure assertion):
   prebook "Razorpay order for advance" + prebook/verify
   "correct advance": `20000`→`200`.
3. **Lever C — withdrawal fixture** (class-2 stale value):
   `amount_requested: 5000`→`50` (₹50 < ₹100 min) so the
   too-small path triggers; correct the stale paise test name.
4. CARVE any genuine class-3 RED (none expected — backend
   verified correct on every value). Confirm no new 500s.
5. Re-measure honestly vs 333/49; main `pnpm qa` 66/C1/gate-0
   unchanged.

## Out of scope / forbidden
- NOT zero; one measured batch. Honestly RECLASSIFIED OUT of the
  money cluster (different levers, deferred to a later phase):
  payout-id-format drift (`earnings.test.js:181`,
  `contracts.test.js:426` — `mock_payout_`→`tranche_1_`),
  set-response-shape (`PATCH sets` budget NaN),
  wallet-response-shape (`GET /brands/me/wallet` undefined),
  wallet/topup Razorpay-boundary amount (ambiguous direction —
  needs its own controller read). These are NOT paise→rupees.
- No `.skip`/delete/fabricated-data/assertion-weakening/
  force-pass. Each new assertion value is the VERIFIED-CORRECT
  rupees output the backend genuinely computes — not a
  number reverse-engineered to make red go green.
- No backend/runtime change (carved defects = own gated
  contracts). The brand-sign 500-wrapping-422 wrinkle stays
  P6's class-2 adjudication.

## Surfaces touched
- `backend/tests/**`: pay-at-store, commissions, prebook,
  withdrawal test files (shared setups + specific assertions).
- **Deploy-inert** (tests not in the server import graph; no
  migration/web/mobile/OTA/runtime change → no Render/Vercel).

## Non-functional
- Success = complete classification grounded in real controller
  evidence + honest measured delta on the deterministic
  instrument + every value traceable to a cited controller line
  + zero main-lane regression. Modest delta with rigor = success;
  any green via masking a real money bug = FAILURE.
