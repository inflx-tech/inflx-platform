# Preview (Step 4) — backend-test-debt Phase 7

No UI. Test-debt triage continuation. Reviewer note + Step-7
results here.

## Reviewer note (Step-5 lock)
- **DEPLOY-INERT.** Only `backend/tests/**` + this contract. No
  `src`/migration/runtime change → no Render/Vercel.
- Continuation of the Phase-6 ladder, **same disciplined
  method**, next cascade layer (formats_json + approve-step +
  search brand-approval), on the now-DETERMINISTIC instrument.
  The dominant chain is proven by a reverted instrumented run
  (`_p7_diag.log`), not a hypothesis.
- Carve discipline + no-fake-green absolute (skip/delete/
  weaken/fabricate/force-pass forbidden; genuine bugs → own RED
  carve; uncertain ⇒ carve).
- Not expected to hit zero — honest deliverable is the shrinking
  cascade + the true count of carved genuine defects + the
  classified-but-deferred independent clusters.

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
method     : verify-twice; reverted instrumented run captured the
             commissions setup chain end-to-end against real
             qa:db PG (_p7_diag.log; diagnostic git-reverted,
             commissions.test.js byte-clean vs HEAD)
root cause : SAME class-2 drift one cohort over —
             (1) set-create omits formats_json → brand-sign
                 422/500 (contract.controller.js:504-530) →
                 ci stays 'accepted' → validateTracking 409
                 OFFER_UNAVAILABLE (transaction.service.js:
                 107-144) → init error envelope → razorpay_
                 order_id TypeError
             (2) contracts.test.js setupAcceptedOffer (15
                 consumers) + inline negotiation test skip the
                 brand approve step (draft→pending_influencer)
             (3) influencer-search.test.js never approves the
                 brand; GET /search requires requireApproved
                 (influencer.routes.js:15, auth.js:142) → 403
fix        : Lever1 formats_json:['reel'] → 6 single-set-create
             cascade suites (commissions/pay-at-store/prebook/
             prebook-daterange/online-order/follower-store);
             Lever2 approve-step → setupAcceptedOffer (verified
             re-approve-safe, contract.controller.js:1041; 0
             'draft' assertions) + inline negotiation test;
             Lever3 approveUser(brand) → influencer-search ×10
delta      : 300→333 passed / 82→49 failed / 382  (−33)
ledger     : 281→244→231→194→192→146→123→82→49
effect     : Lever1 ELIMINATED razorpay_order_id (50→0) + 409
             OFFER_UNAVAILABLE (10→0) → 3 suites flipped GREEN
             (follower-store, online-order, prebook-daterange).
             Lever2 fixed contracts pending_influencer ×3 +
             brand-sign 5→1. Lever3 code-correct, cleared the
             verified 403 gate (Received-403 16→2) — but
             verify-twice: influencer-search ALSO needs a
             response-shape lever (endpoint returns data.creators
             from v_searchable_creators, influencer.controller
             .js:529; tests expect data.influencers) → those 8
             stay RED, deferred P8. Lever3 RETAINED as a
             verified-correct prerequisite (NOT fake-green: the
             8 are honestly RED on the shape mismatch). Net −33
             attributable to Levers 1+2 (no spin; P-ladder
             cascade — each layer reveals the next, as in P6).
deferred   : ALL 49 residual CLASSIFIED, fix re-baselined to
             Phase 8 (one-measured-batch): campaigns publish/
             publish-open/create/set-CRUD ×~10 (separate
             publish-validation drift, no set in publish setup);
             listing-service schema ×10; influencer-search ×8
             (data.influencers→data.creators shape lever);
             money-convention ×~13 (original ×4 + razorpay-
             unmasked next-layer rupees-vs-paise in pay-at-store/
             commissions/earnings/conversions/prebook/brand-sign/
             escrow); follower-feed ×4 (1 carved + 3 feed-empty);
             register-422 ×2; engagement-analytics ×1
carve      : NO new class-3. Received:500 UNCHANGED at 2 = ONLY
             the already-carved follower-feed-noauth-500 (RED).
             No new defects, no new carves. No prior-GREEN suite
             regressed (11 stay green; +3 flipped green).
main pnpm qa: 66 passed (1.2m) / C1 STATE=GREEN / gate 0 —
             zero regression (deploy-inert: tests/** + features/**)
deploy     : DEPLOY-INERT (backend/tests/** + features/**)
```
