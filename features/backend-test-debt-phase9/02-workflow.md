# Workflow Definition — backend-test-debt Phase 9

> Step 2. Executable contract. Verifier: the now-DETERMINISTIC
> B2b DB lane (`pnpm qa:db`). Continuation of the Phase-8 method
> on the listing-service schema cluster.

## Actor
QA/triage operator running `pnpm qa:db` + reading the
authoritative on-disk schemas + `listing.service.js`
(verify-twice).

## Preconditions
Docker up; substrate green (53/53); instrument deterministic.
Baseline **343 passed / 39 failed / 382** (post-P8 c222e1f).
Main `pnpm qa` 66 GREEN / C1 / gate 0.

## Workflow steps
1. Inventory the 10 listing failures from
   `_p8c_remeasure_qadb.log` (authoritative post-P8) + a fresh
   `pnpm qa:db` for the re-measure.
2. Classify each against the COMMITTED source of truth
   (verify-twice): `backend/public/schemas/restaurant.json` &
   `salon.json`; `listing.service.js` loadSchema /
   getActivePhaseCategories / isCategoryActive /
   calculateQualityScore; `LISTING_ENGINE_PHASE` (=5,
   `backend/.env`). Schema evolved ⇒ class-4 align; scenario
   stale vs evolved rule ⇒ class-2 align; genuine regression ⇒
   class-3 carve.
3. Apply: 9 schema-constant assertion alignments + 1
   quality-score scenario fix (10 products) — each value read
   from the on-disk schema / cited service line.
4. Carve any genuine class-3 RED — expected NONE (schemas are
   the committed contract; score behaviour correct per the
   evolved rule). Confirm no new 500s beyond the carved
   follower-feed-noauth-500.
5. Re-measure `pnpm qa:db`; record honest delta vs 343/39.
6. Re-run main `pnpm qa`; confirm 66 GREEN / C1 / gate 0;
   gov-check clean on the deploy-inert changeset.

## Success definition
SUCCESSFUL iff: classification grounded in the committed schema;
each aligned value traceable to the on-disk JSON /
`listing.service.js` line; any class-3 carved RED (not masked);
honest measured delta; main `pnpm qa` unchanged. Any green via
skip/delete/weaken/fabricate/force-pass, or asserting a value
not backed by the committed schema, is an explicit FAILURE.

## Failure / edge
- Can't justify a value from the committed schema → uncertain
  ⇒ class-3 carve, never silently "fixed".
- A "fix" would require changing the schema or backend → that's
  out of scope (not a test edit).
- The single test file has no shared-setup blast radius; the
  deterministic re-measure is the exact arbiter.
- qa:db unavailable → BLOCKED, report; no static-only guessing.
