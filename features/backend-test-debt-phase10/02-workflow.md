# Workflow Definition — backend-test-debt Phase 10

> Step 2. Executable contract. Verifier: the now-DETERMINISTIC
> B2b DB lane (`pnpm qa:db`). Continuation of the Phase-9 method
> on the influencer-search response-shape cluster.

## Actor
QA/triage operator running `pnpm qa:db` + a reverted
instrumented diagnostic + reading the real search controller /
`v_searchable_creators` view (verify-twice).

## Preconditions
Docker up; substrate green (53/53); instrument deterministic.
Baseline **353 passed / 29 failed / 382** (post-P9 81137ee).
Main `pnpm qa` 66 GREEN / C1 / gate 0.

## Workflow steps
1. Inventory the 8 influencer-search failures from
   `_p9b_remeasure_qadb.log` (authoritative post-P9) + a fresh
   `pnpm qa:db` for the re-measure.
2. Verify-twice via a reverted instrumented run on real qa:db
   PG: capture the actual `res.status` / `res.body` shape /
   creators content. Confirm `data.creators` + meta + field
   names + that onboarded influencers appear (class-2/4) vs a
   genuine gap (class-3). Diagnostic reverted precisely
   (test file byte-clean vs HEAD post-revert).
3. Apply the response-shape + field rename uniformly (7 go
   green; #6 city stays RED on the genuine defect). Each rename
   = the verified live field, cited.
4. Carve the genuine class-3 city defect
   (`features/backend-defect-onboarded-creator-city-search/`);
   test LEFT RED; backend untouched; not masked. Confirm no new
   500s beyond the carved follower-feed-noauth-500.
5. Re-measure `pnpm qa:db`; record honest delta vs 353/29 + the
   classified inventory.
6. Re-run main `pnpm qa`; confirm 66 GREEN / C1 / gate 0;
   gov-check clean on the deploy-inert changeset.

## Success definition
SUCCESSFUL iff: classification grounded in the instrumented
real response; renames traceable to the verified live field;
the genuine city defect carved RED (not masked, test not
weakened); honest measured delta; main `pnpm qa` unchanged. Any
green via skip/delete/weaken/fabricate/force-pass, or masking
the city defect, is an explicit FAILURE.

## Failure / edge
- Can't prove a field from the instrumented response → uncertain
  ⇒ class-3 carve, never silently "fixed".
- A shape-renamed test still RED for a non-shape reason → that's
  a genuine finding (carve or classify), surfaced not masked
  (the city test is exactly this).
- `'does NOT include pending'` post-rename behaviour is decided
  by the deterministic re-measure, not assumed.
- qa:db unavailable → BLOCKED, report; retry; no static guessing.
