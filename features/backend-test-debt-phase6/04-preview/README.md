# Preview (Step 4) — backend-test-debt Phase 6

No UI. Test-debt triage continuation. Reviewer note + Step-7
results here.

## Reviewer note (Step-5 lock)
- **DEPLOY-INERT.** Only `backend/tests/**` + new
  `features/backend-defect-*/` carves + this contract. No
  `src`/migration/runtime change → no Render/Vercel.
- Continuation of the Phase-5 ladder, **same disciplined
  method**, next cascade layer (create-order / accept /
  wallet-funding), on the now-DETERMINISTIC instrument.
- Carve discipline + no-fake-green absolute (skip/delete/
  weaken/fabricate/force-pass forbidden; genuine bugs → own RED
  carve; uncertain ⇒ carve).
- Not expected to hit zero — honest deliverable is the shrinking
  cascade + the true count of carved genuine defects.

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
method     : verify-twice via instrumented real responses
             (diagnostic added → git-reverted, zero residue)
root cause : contract chain needs TWO missing workflow steps,
             both class-2 (backend correct, fixtures stale):
             (1) brand "Approve & Send" POST /contracts/:id/
                 approve (draft→pending_influencer)
             (2) campaign set must declare formats_json or
                 brand-sign 500s "no deliverable formats"
fix        : approve-step → 11 suites + shared getContractId
             helper; formats_json:['reel'] → 6 engagement
             set-creation payloads (deliverables, earnings,
             contracts ×2, negotiations ×2)
delta      : 261→300 passed / 123→82 failed / 382  (−41)
ledger     : 281→244→231→194→192→146→123→82
note       : single-step re-measure first showed only −2;
             verify-twice proved approve was CORRECT but
             incomplete — paired fix = −41. Premature
             "didn't work" self-corrected by evidence (no spin).
residual 82: campaign_influencer ×122 + id ×80 ELIMINATED.
             Next-layer same-class: VALIDATION_ERROR ×69 +
             razorpay_order_id ×50 (follower-payment init) →
             Phase-7 batch. 500s ×2 = ONLY already-carved
             follower-feed-noauth-500 — no new defects/carves.
main pnpm qa: <pending regression confirmation>
deploy     : DEPLOY-INERT (backend/tests/** + features/**)
```
