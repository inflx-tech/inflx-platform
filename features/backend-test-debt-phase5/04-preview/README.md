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
