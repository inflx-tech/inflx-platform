# Preview (Step 4) — backend-test-debt Phase 5

No UI. Test-debt triage continuation. Reviewer note + Step-7
results land here.

## Reviewer note (Step-5 lock)
- **DEPLOY-INERT.** Only `backend/tests/**` + new
  `features/backend-defect-*/` carves + this contract. No
  backend/src/migration/runtime change → no Render/Vercel.
- Continuation of the Phase-4 ladder, **same disciplined
  method**, next cascade layer (invite/offer/wallet setup).
- Carve discipline + no-fake-green absolute (skip/delete/
  weaken/fabricate/force-pass all forbidden; genuine bugs →
  own RED carve, never masked; uncertain ⇒ carve).
- Not expected to hit zero — the honest deliverable is the
  shrinking cascade + the true count of carved genuine defects.

## Failure-classification key (GOVERNANCE.md §6)
```
1 stale fixture/setup    → fixture aligned to current contract
2 business-rule drift    → test aligned to evolved rule (code-proven)
3 genuine backend defect → CARVE features/backend-defect-<slug>/, test RED
4 assertion drift        → assertion corrected to verified contract
uncertain                → treat as 3 (carve); never silently fixed
```

## Step 7 — RESULTS (filled at implementation)
```
fresh qa:db baseline : <passed>/<failed>/382  (expect ~236/146)
classified           : 1:<n> 2:<n> 3:<n> 4:<n>  (Σ = failed)
honestly fixed (1/2/4): <n>   (each cites controller file:line)
carved (3)           : features/backend-defect-<...>  (tests RED)
re-measure           : failed 146 → <X>   (honest delta)
main pnpm qa         : 66 GREEN / STATE=GREEN / gate 0 (unchanged)
ledger               : 281→244→231→194→192→146→<X>
```
Full classified inventory + per-fix rationale + carved-defect
list recorded here and in `lock.json` at Step 7.

## Step 7 — RESULT (2026-05-19) — COMPLETE
```
instrument   : DETERMINISTIC (qa-db-determinism +
               qa-db-truncate-flake) → delta is noise-free
root cause   : campaign.controller.js:654-656 — conversion/
               hybrid sets REQUIRE offer_type at invite; 8
               P4-era conversion-set suites invited w/o it
               → 422 → `reading 'campaign_influencer'` ×122
fix          : +offer_type:'percentage' on the invite payload
               in 8 suites (prebook, prebook-daterange,
               enquiry, pay-at-store, follower-store,
               follower-feed, online-order, commissions);
               matches each suite's own /offers call; minimal
               (controller only hard-requires offer_type)
delta        : 236→259 passed / 146→123 failed / 382  (−23)
ledger       : 281→244→231→194→192→146→123
residual 123 : campaign_influencer cascade GONE; next-layer
               same-class drift `reading 'id'` ×80 +
               `razorpay_order_id` ×50 + WALLET_INSUFFICIENT
               ×7 → Phase-6 batch. 500s ×2 = ONLY the
               already-carved follower-feed-noauth-500 — no
               new genuine defects, no new carves.
evidence note: authoritative = the P5 run's own stdout log
               (_p5_remeasure_qadb.log); db-jest.log/db-lane
               artifact-write lagged the Monitor read (stale
               01:45) — caught by verify-twice, recorded
               transparently, not glossed.
main pnpm qa : <pending regression confirmation>
deploy       : DEPLOY-INERT (backend/tests/** + features/**)
```
