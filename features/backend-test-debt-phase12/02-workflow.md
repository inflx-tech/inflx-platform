# Workflow Definition — backend-test-debt Phase 12

> Step 2. Executable contract. Verifier: the now-DETERMINISTIC
> B2b DB lane (`pnpm qa:db`). FINAL residual sweep.

## Actor
QA/triage operator running `pnpm qa:db` + reading the real
controllers/services/schema (verify-twice; conclusive via code).

## Preconditions
Docker up; substrate green (53/53); instrument deterministic.
Baseline **368 passed / 14 failed / 382** (post-P11 48eabd8).
Main `pnpm qa` 66 GREEN / C1 / gate 0.

## Workflow steps
1. Inventory the 14 from `_p11_remeasure_qadb.log`
   (authoritative post-P11) + a fresh `pnpm qa:db` for the
   re-measure. Separate the 4 carved (RED, untouched) from the
   10 class-2/4.
2. Per-item verify-twice (done, conclusive via code): each of
   the 10 mapped to a cited controller/service/schema line;
   backend correct; no new carve (the suspected follower-city
   defect disproven by reading follower register).
3. Apply the 8 fix-sites — each aligned to the cited verified
   contract.
4. Carve any genuine class-3 RED — expected NONE. If the
   re-measure shows an aligned test still RED for a non-fixture
   reason → carve, never force (P10/P11 precedent). Confirm no
   new 500s beyond the carved follower-feed-noauth-500.
5. Re-measure `pnpm qa:db`; record honest delta vs 368/14 +
   the DEFINITIVE final ledger and the true real-bugs-vs-drift
   split.
6. Re-run main `pnpm qa`; confirm 66 GREEN / C1 / gate 0;
   gov-check clean on the deploy-inert changeset.

## Success definition
SUCCESSFUL iff: per-item classification grounded in cited code;
each alignment traceable; any genuine defect carved RED (not
masked); honest measured delta; the final split reported
truthfully; main `pnpm qa` unchanged. Any green via skip/delete/
weaken/fabricate/force-pass is an explicit FAILURE.

## Failure / edge
- Aligned test still RED for a non-fixture reason → carve,
  classify honestly (P10/P11 precedent), no spin.
- Shared helper (`setupFeedScenario`) edit — deterministic
  re-measure is the arbiter for its consumers.
- qa:db unavailable/substrate-fail → BLOCKED, retry; no
  static-only guessing.
