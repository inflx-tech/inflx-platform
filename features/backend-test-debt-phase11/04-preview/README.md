# Preview (Step 4) — backend-test-debt Phase 11

No UI. Test-debt triage continuation. Reviewer note + Step-7
results here.

## Reviewer note (Step-5 lock)
- **DEPLOY-INERT.** Only `backend/tests/campaigns.test.js` +
  `backend/tests/negotiations.test.js` + this contract. No
  `src`/migration/runtime change → no Render/Vercel.
- Continuation of the Phase-10 ladder, **same disciplined
  method**, the campaigns publish/set-CRUD cluster. Root cause
  pinned conclusively via controller verify-twice (every
  failure → a cited controller line; code unambiguous so no
  instrumentation). All class-2/4 stale fixtures vs evolved
  campaign-lifecycle contracts; backend VERIFIED CORRECT; NO
  class-3 carve.
- No-fake-green absolute: each fixture/assertion aligned to the
  cited verified contract; publish #1/#4 assert the deliberate
  evolved behaviour (no money at publish; status active; escrow
  at brand-sign), documenting not masking; uncertain ⇒ carve.

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
method     : verify-twice via the real controllers + schema
             (conclusive, no instrumentation): campaign.routes
             .js:12; campaign.controller.js :20 :190-193 :452
             :480-489 :512 :550 :900 :909 :942-974 :1031;
             offer.controller.js:835; migrations 001:221/002:12
root cause : campaigns publish/set-CRUD cluster — 9× stale
             fixtures vs evolved campaign-lifecycle contracts
             (backend CORRECT) + 1 GENUINE class-3 defect.
             requireApproved on POST /campaigns; create needs
             dates; publish needs ≥1 set; publish moves NO
             money + status→'active'; deleteSet keeps ≥1 set;
             updateSet field=set_budget; engagement set needs
             set_budget.
fix (×9)   : 404-test approve-user; fundedBrandWithCampaign
             +engagement set +brandId; publish#1 assert status
             'active' + DB-verify no wallet debit; publish#2
             +set→WALLET_INSUFFICIENT; publish#3 +dates+set
             (omit budget)→422; publish#4 assert NO escrow_lock
             at publish (locks @brand-sign); PATCH-set
             set_budget; DELETE-set 2nd set; negotiations
             setupOpenGroupScenario +set_budget; '422 not
             open_group' +approveUser
carve (×1) : features/backend-defect-open-group-publish-
             assignment-mode-mismatch — 'publishes the
             open-group set 200' LEFT RED. campaign_sets has
             BOTH assignment_mode ENUM (mig 001:221, NULL) +
             influencer_mode varchar (mig 002:12); createSet
             writes only influencer_mode but publishOpenGroup
             gates on assignment_mode → open-group publish
             ALWAYS 422 (non-functional). The +set_budget
             class-2 fix is correct + retained — it UNMASKED
             this class-3 (P10 pattern). Backend NOT patched
             (fix = future production-impacting gated contract).
delta      : 359→368 passed / 23→14 failed / 382  (−9)
ledger     : 281→244→231→194→192→146→123→82→49→39→29→23→14
clean diff : P10→P11 — exactly 9 fixed, ZERO newly-red, ZERO
             regression, ZERO flake (migrations 53/53).
note       : the spec's 'NO carve expected' hypothesis was
             honestly corrected by re-measure + verify-twice
             (1 genuine class-3) — exactly the discipline
             clause working, no spin (P6/P10 precedent).
500s       : Received:500 unchanged at 2 = only the already-
             carved follower-feed-noauth-500 (no new 500s)
main pnpm qa: <pending regression confirmation>
deploy     : DEPLOY-INERT (backend/tests/** + features/**)
```
