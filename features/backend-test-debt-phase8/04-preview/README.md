# Preview (Step 4) — backend-test-debt Phase 8

No UI. Test-debt triage continuation. Reviewer note + Step-7
results here.

## Reviewer note (Step-5 lock)
- **DEPLOY-INERT.** Only `backend/tests/**` + this contract. No
  `src`/migration/runtime change → no Render/Vercel.
- Continuation of the Phase-7 ladder, **same disciplined
  method**, the money-convention cluster, on the
  now-DETERMINISTIC instrument. Backend VERIFIED CORRECT on
  every value (real controller/service reads cited) — the
  fixtures/assertions are stale on migration-021 (rupees) +
  the Tier-1 offer_config_json contract.
- No-fake-green absolute: new values are the verified rupees
  outputs, never reverse-engineered; uncertain ⇒ carve.
- Not expected to hit zero — honest deliverable is the shrinking
  cascade + the truthfully reclassified-out items.

## Failure-classification key (GOVERNANCE.md §6)
```
1 stale fixture/setup    → fixture aligned to current contract
2 business-rule drift    → test aligned to evolved rule (code-proven)
3 genuine backend defect → CARVE features/backend-defect-<slug>/, test RED
4 assertion drift        → assertion corrected to verified contract
uncertain                → treat as 3 (carve); never silently fixed
```

## Step 7 — RESULT (2026-05-19) — COMPLETE
```
method     : verify-twice on real controllers/services —
             campaign.controller.js invite (offer_config_json
             from body, 735); offer.service.js resolveDiscount/
             resolveScope (132-163, 104-108);
             withdrawal.controller.js:35-39; transaction.
             controller.js:313 (bill_amount); prebook offer
             setup; P7 instrumented dump (offer_config_json=null)
root cause : money-convention cluster, 2 evolved contracts the
             fixtures predate, backend VERIFIED CORRECT:
             (1) migration-021 ALL RUPEES — tests send/assert
                 PAISE (bill 100000, disc 30000, advance 20000,
                 withdrawal 5000)
             (2) Tier-1 — discount resolves from ci.offer_type
                 + offer_config_json; invite omits it → value=0
                 → discount=0
fix        : LeverA setupPayAtStore/Commission invite
             +offer_config_json:{value:30}, bill_amount
             100000→1000, rupees assertions (disc 300/net 700/
             comm 56/fee 56/brand_net 588/revenue 700,
             original_amount→bill_amount=1000);
             LeverB prebook advance 20000→200 ×2;
             LeverC withdrawal amount_requested 5000→50 (+name)
delta      : 333→343 passed / 49→39 failed / 382  (−10)
ledger     : 281→244→231→194→192→146→123→82→49→39
self-corr  : _p8 first re-measure showed 9/10 — pay-at-store
             'discount calc' still RED. Verify-twice: disc→300
             & net→700 PASSED (math+offer_config correct), but
             res.body.data.original_amount = undefined — the
             controller exposes bill_amount (transaction.
             controller.js:313), not original_amount. One-line
             fix → _p8b pay-at-store fully GREEN, 10/10.
             Premature partial-success self-corrected by
             evidence, no spin (P6-style).
flake      : _p8b surfaced 1 transient — auth.test.js
             logout 'refresh token unusable' Exceeded timeout
             30000ms. class-1 ENVIRONMENTAL (NOT regression):
             auth.test.js 15.9s(P7 PASS)→10.1s(P8 PASS, money
             fixes already applied)→164.6s(P8b FAIL, run 565s
             under load)→17.5s(P8c PASS). Shares no code with
             the 4 edited files; only P8→P8b diff was 1
             pay-at-store assertion line — provably can't reach
             auth. P8c CONFIRMED transient. Surfaced, not masked.
reclassed  : OUT of money cluster (deferred P9, different
             levers): payout-id-format (earnings:181/
             contracts:426), set-response-shape (PATCH sets
             budget NaN), wallet-response-shape (GET wallet
             undefined), topup Razorpay-boundary amount
carve      : NO new class-3. Received:500 UNCHANGED at 2 =
             ONLY the already-carved follower-feed-noauth-500
             (RED). Clean P7→P8c diff: exactly 10 fixed, ZERO
             newly-red, ZERO regression.
main pnpm qa: 66 passed (1.2m) / C1 STATE=GREEN / gate 0 —
             zero regression (deploy-inert: tests/** + features/**)
deploy     : DEPLOY-INERT (backend/tests/** + features/**)
```
