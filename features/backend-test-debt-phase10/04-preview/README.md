# Preview (Step 4) — backend-test-debt Phase 10

No UI. Test-debt triage continuation. Reviewer note + Step-7
results here.

## Reviewer note (Step-5 lock)
- **DEPLOY-INERT.** Only `backend/tests/influencer-search.test.js`
  + the new carve folder + this contract. No `src`/migration/
  runtime change → no Render/Vercel.
- Continuation of the Phase-9 ladder, **same disciplined
  method**, the influencer-search response-shape cluster, on the
  now-DETERMINISTIC instrument. Backend VERIFIED CORRECT for the
  7 shape-drift tests (instrumented real response); 1 genuine
  class-3 city defect CARVED RED (not masked).
- No-fake-green absolute: every rename is the live response
  field; the carved defect's test stays RED, exposed via the
  real assertion; uncertain ⇒ carve.
- Not expected to hit zero — honest deliverable is 7 fixed + 1
  genuine defect carved + remaining clusters classified.

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
method     : verify-twice via a reverted instrumented run on the
             real qa:db PG (_p10_diag.log; diagnostic git-
             reverted, influencer-search.test.js byte-clean vs
             HEAD); + read search controller + v_searchable_
             creators view (migration 045) + influencer
             registration; + P10 re-measure for the 2nd defect
root cause : P7 Lever-3 cleared the 403 gate; residual = pure
             response-shape drift. Endpoint returns 200 with
             res.body.data.creators (v_searchable_creators
             projection) + res.body.meta{page,limit,total};
             tests assert legacy res.body.data.influencers +
             instagram_handle/engagement_rate. Onboarded
             influencers DO appear (niche/followers correct) →
             6× class-2/4, backend CORRECT. TWO genuine class-3
             defects surfaced (same onboarded view branch):
             (1) city null — registration writes users.city but
                 the view selects i.city;
             (2) pending leak — view WHERE u.status IN
                 ('approved','pending') admits unapproved
                 influencers (Expected 1, Received 2).
fix (×6)   : class-2/4 shape rename — data.influencers→
             data.creators (uniform), creators[0].
             instagram_handle→ig_handle, engagement_rate→
             view_based_er (register payload + GET /:id singular
             line untouched). GREEN: returns-200, no-sensitive-
             fields, admin-role, filters niche/min/max_followers.
carve (×2) : features/backend-defect-onboarded-creator-city-
             search ('filters by city' RED) + features/backend-
             defect-search-includes-pending-influencers ('does
             NOT include pending' RED). Shape-rename applied so
             each fails on its GENUINE assertion (exposing, not
             masking); no assertion weakened; backend NOT
             patched (view-migration fixes = future production-
             impacting gated contracts; pending-leak intent is
             uncertain ⇒ §6 carve, not a silent test edit).
delta      : 353→359 passed / 29→23 failed / 382  (−6)
ledger     : 281→244→231→194→192→146→123→82→49→39→29→23
clean diff : P9b→P10 — exactly 6 fixed, ZERO newly-red, ZERO
             regression, ZERO flake (migrations 53/53).
500s       : Received:500 unchanged at 2 = only the already-
             carved follower-feed-noauth-500 (no new 500s)
main pnpm qa: <pending regression confirmation>
deploy     : DEPLOY-INERT (backend/tests/** + features/**)
```
