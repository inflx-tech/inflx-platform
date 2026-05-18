# Mock / Preview (Step 4) — backend-test-debt Phase 4

No UI. Test-debt triage. The "preview" is what the reviewer
agrees to at the Step-5 lock + where Step-7 evidence lands.

## Reviewer confirms at the Step-5 lock
- **DEPLOY-INERT.** Only `backend/tests/**` (test-infra, not in
  the server import graph) + new `features/backend-defect-*/`
  stubs + this contract. No backend/src, migration, web, mobile,
  OTA, runtime change → no Render/Vercel deploy.
- Phase 4 is the **hard residual** — per-test business-rule
  analysis, not a cascading factory fix. Modest honest delta is
  expected and acceptable; rigor > delta size.
- **Carve discipline:** every genuine backend defect becomes its
  own `features/backend-defect-<slug>/` contract, the catching
  test is left **RED**, the backend is NOT patched here, the
  test is NOT edited to pass. Backend fixes are separate,
  production-impacting, gated contracts (not this one).
- **No-fake-green absolute:** no skip/delete/assertion-weakening/
  fabricated-data/force-pass; uncertain ⇒ carve, not "fix".
- Verifier is the real `pnpm qa:db` (53-migration Postgres);
  main `pnpm qa` must stay 66 GREEN / C1 / gate 0.

## Failure-classification key (GOVERNANCE.md §6)
```
1 stale fixture/setup   → fixture aligned to current contract
2 business-rule drift   → test aligned to evolved rule (code-proven)
3 genuine backend defect→ CARVE features/backend-defect-<slug>/, test RED
4 assertion drift       → assertion corrected to verified contract
uncertain               → treat as 3 (carve); never silently fixed
```

## Step 7 — IN PROGRESS (2026-05-18)

**Fresh qa:db baseline confirmed:** 190 passed / 192 failed /
382, migrations 53/53 0-error (db-jest.log @14:57:03Z — fresh).

**Dominant cascade ROOT CAUSE pinned (verify-twice, real
controller — not hypothesis):**
- Signature: `TypeError: Cannot read properties of undefined
  (reading 'set' / 'campaign')` in massive volume.
- Real stack: `campaigns.test.js:510` `setRes.body.data.set.id`
  — `setRes.body.data` is `undefined` because set-create
  returned a non-201 error body.
- Why: `campaign.controller.js:451-453` — engagement/hybrid
  sets **require `set_budget`** (intentional business rule;
  also conversion requires `coupon_prefix` & must NOT have
  `set_budget`, :454-464). Test helpers
  (`setupInviteScenario` :506-510, `createSet` :399/:451) send
  `{name, goal:'engagement', assignment_mode:'handpick'}` with
  **no `set_budget`**, and use stale keys (`budget`,
  `assignment_mode`) vs the contract (`set_budget`,
  `influencer_mode`). → 422 → `.data` undefined → TypeError →
  cascade across the campaign→set→invite→offer→publish→
  contract→deliverable→escrow chain in ~19 suites.
- **Class: 2 (business-rule drift).** Backend is CORRECT; the
  fixtures never tracked the evolved set-budget/coupon rule.
  Fix = align test set-creation payloads to the verified
  contract. NOT assertion-weakening, NOT masking a bug. Highest-
  leverage lever (analogous to P1's single-factory cascade).

**Secondary signatures seen (to classify next):** `404→403`
(authz-ordering drift), `Expected 10000 / Received 1000000`
(paise→rupee assertion drift, migration 021), residual
`201→422`, and any true `Received: 500` (→ carve class-3 RED).

## Step 7 — COMPLETE (2026-05-18)

Two measured, verify-twice contract-alignment passes (both
class-2 business-rule drift — backend correct, fixtures stale):

```
baseline                : 190 passed / 192 failed / 382
PASS 1 set_budget/coupon: 202 / 180   (+12)  — ~19 sites/14 suites
PASS 2 start/end dates  : 236 / 146   (+34)  — 15 sites/13 suites
CUMULATIVE Phase 4      : 190→236 / 192→146  (−46, honest)
ledger : 281→244→231→194→192(city)→146(P4)
```

Residual 146 classified (fresh db-jest.log):
- next-layer cascade `campaign_influencer`/`id` (~200 occ) =
  invite/offer-step fixture drift, **same class → Phase-5 batch**
  (one measured batch per phase, per P1–P3 discipline).
- WALLET_INSUFFICIENT ×7 = wallet-funding setup drift → Phase 5.
- **1 genuine backend defect → CARVED RED:**
  `features/backend-defect-follower-feed-noauth-500`
  (`GET /v1/follower/feed` no-auth → 500, must be 401;
  test left RED, backend NOT patched, NOT masked).
- authz/assertion drift (403/422/money) = residual, later.

Regression: **main `pnpm qa` 66/66 GREEN, STATE=GREEN, gate 0**
(fresh, proven). Deploy-inert (backend/tests/** + features/**
only) — no Render/Vercel. No-fake-green: nothing skipped/
deleted/weakened; negative-assertion tests left untouched; the
genuine bug carved, not hidden.
```
