# Preview (Step 4) — backend-test-debt Phase 12 (final sweep)

No UI. Test-debt triage close-out. Reviewer note + Step-7
results + the definitive final split here.

## Reviewer note (Step-5 lock)
- **DEPLOY-INERT.** Only `backend/tests/**` + this contract.
  No `src`/migration/runtime change → no Render/Vercel.
- The FINAL residual sweep — mechanical cascade exhausted.
  Per-item verify-twice (conclusive via code); all 10 are
  class-2/4 stale fixtures/assertions vs evolved contracts,
  backend VERIFIED CORRECT; NO new carve; the 4 prior carved
  genuine defects stay RED (future gated fixes).
- No-fake-green absolute: each alignment is the cited verified
  contract; the engagement re-point documents the evolved
  analytics shape (not weakening); uncertain ⇒ carve.

## Failure-classification key (GOVERNANCE.md §6)
```
1 stale fixture/setup    → fixture aligned to current contract
2 business-rule drift    → test aligned to evolved rule (code-proven)
3 genuine backend defect → CARVE features/backend-defect-<slug>/, test RED
4 assertion drift        → assertion corrected to verified contract
uncertain                → treat as 3 (carve); never silently fixed
```

## Step 7 — RESULT (2026-05-19) — COMPLETE · LADDER DONE
```
method     : per-item verify-twice via real controllers/
             services/schema (conclusive, no instrumentation)
classify   : 14 = 4 carved (RED, untouched) + 10 class-2/4
             (backend CORRECT, NO new carve; suspected
             follower-city defect DISPROVEN by reading follower
             register — verify-twice corrected the hypothesis)
fix (×8)   : wallet data.wallet.wallet_balance (nested,
             wallet.controller.js:68-74); topup amount→1000000
             paise (:104+CLAUDE.md); escrow/brand-sign payout-id
             /^mock_payout_/→/^tranche_1_/ (escrow.service.js
             :115); brand register +name/city/state (:121-128);
             influencer register +name (:205); setupFeed
             Scenario +formats_json (contract.controller.js
             :504-530 → ci contracted → ACTIVE_CI_QUERY);
             engagement re-point to real totals fields
             (engagement.service.js:151-163, drop removed
             category_benchmark_er/daily_reach)
delta      : 368→378 passed / 14→4 failed / 382  (−10)
ledger     : 281→244→231→194→192→146→123→82→49→39→29→23→14→4
clean diff : P11→P12 — exactly 10 fixed, ZERO newly-red, ZERO
             regression, ZERO flake (migrations 53/53)
carve      : NONE new; the 4 remaining = EXACTLY the 4 carved
             genuine defects, RED & untouched
500s       : Received:500 unchanged at 2 = only carved
             follower-feed-noauth-500 (no new 500s)
FINAL SPLIT: qa:db backend-jest debt 281 → 4 (277 resolved).
             ~277 = class-1/2/4 TEST-DRIFT vs evolved-correct
             backend contracts (every one verify-twice
             code-proven, ZERO fake-green across P1-P12).
             GENUINE PRODUCT DEFECTS = 5: 1 FIXED early
             (city-column, 39219e4) + 4 CARVED RED (follower-
             feed-noauth-500; onboarded-creator-city-search;
             search-includes-pending-influencers; open-group-
             publish-assignment-mode-mismatch) — now visible/
             tracked, each a future production-impacting gated
             fix contract. Mechanical cascade EXHAUSTED.
main pnpm qa: <pending regression confirmation>
deploy     : DEPLOY-INERT (backend/tests/** + features/**)
```
