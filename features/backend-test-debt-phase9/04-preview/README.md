# Preview (Step 4) — backend-test-debt Phase 9

No UI. Test-debt triage continuation. Reviewer note + Step-7
results here.

## Reviewer note (Step-5 lock)
- **DEPLOY-INERT.** Only `backend/tests/listing-engine.test.js`
  + this contract. No `src`/schema/migration/runtime change →
  no Render/Vercel.
- Continuation of the Phase-8 ladder, **same disciplined
  method**, the listing-service schema cluster, on the
  now-DETERMINISTIC instrument. Backend + committed on-disk
  schema VERIFIED CORRECT — the tests hard-code a stale
  snapshot the schema redesign moved past.
- No-fake-green absolute: every aligned value is read from the
  committed `public/schemas/*.json` / cited service line;
  uncertain ⇒ carve.
- Not expected to hit zero — honest deliverable is the cluster
  cleared + the remaining clusters classified for Phase 10.

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
method     : verify-twice vs the COMMITTED source of truth —
             public/schemas/restaurant.json & salon.json;
             listing.service.js loadSchema/getActivePhase
             Categories/isCategoryActive/calculateQualityScore;
             LISTING_ENGINE_PHASE=5 (backend/.env)
root cause : listing-service schema cluster — the category
             schema legitimately EVOLVED (real redesign); the
             tests hard-code the OLD constants. All class-2/4,
             backend CORRECT, NO carve:
             9× class-4 schema-constant assertion drift
             1× class-2 stale scenario (quality-score test adds
                5 products but evolved rule 9 needs min:10)
fix        : align 9 assertions to the on-disk schema
             (accent #ef4444→#dc2626; cta 'Order'→'Order Now';
             salon phase 99→1 / coming_soon→active; active
             categories 2→5 [car_rental,fashion,fashion_walkin,
             restaurant,salon]; isCategoryActive(salon)
             false→true; quality_rules 9→13 + rule[0]
             business_name/15→restaurant_description/5;
             listing_steps 3→9 + ids; action_types →
             {online_order:{…}}; integration listing_steps 3→9
             + accent) + stale test-name corrections;
             quality-score scenario 5→10 products
delta      : 343→353 passed / 39→29 failed / 382  (−10)
ledger     : 281→244→231→194→192→146→123→82→49→39→29
infra-flake: _p9 first run hit a SUBSTRATE FAIL (Jest globalSetup
             tests/setup.js 'Connection terminated unexpectedly'
             — pg drop BEFORE any test loads). Verify-twice:
             node --check listing-engine.test.js = clean → NOT
             my edits; transient qa:db Postgres drop under load.
             Per discipline retried fresh container (_p9b):
             substrate OK (53/53), clean. Surfaced, not masked.
clean diff : P8c→P9b — exactly 10 fixed (8 unit + 2 integration),
             ZERO newly-red, ZERO regression, ZERO flake.
             Received:500 unchanged at 2 = only carved
             follower-feed-noauth-500.
carve      : NONE (backend + committed schema verified correct);
             follower-feed-noauth-500 stays RED (already carved)
observation: calculateQualityScore resolves only brand fields
             business_name/city/category → most restaurant
             field-rules can't score (pre-existing limitation,
             out of scope, surfaced not masked → P10 candidate)
main pnpm qa: 66 passed (1.2m) / C1 STATE=GREEN / gate 0 —
             zero regression (deploy-inert: tests/** + features/**)
deploy     : DEPLOY-INERT (backend/tests/** + features/**)
```
