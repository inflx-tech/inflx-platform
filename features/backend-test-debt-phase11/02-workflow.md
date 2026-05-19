# Workflow Definition — backend-test-debt Phase 11

> Step 2. Executable contract. Verifier: the now-DETERMINISTIC
> B2b DB lane (`pnpm qa:db`). Continuation of the Phase-10
> method on the campaigns publish/set-CRUD cluster.

## Actor
QA/triage operator running `pnpm qa:db` + reading the real
campaign create/publish/set/delete controllers + route
middleware (verify-twice; conclusive via code).

## Preconditions
Docker up; substrate green (53/53); instrument deterministic.
Baseline **359 passed / 23 failed / 382** (post-P10 899296f).
Main `pnpm qa` 66 GREEN / C1 / gate 0.

## Workflow steps
1. Inventory the 10 campaigns-area failures from
   `_p10_remeasure_qadb.log` (authoritative post-P10) + a fresh
   `pnpm qa:db` for the re-measure.
2. Classify each against the cited controller line
   (verify-twice; code is unambiguous so no instrumentation):
   campaign.routes.js:12 (brandApproved), campaign.controller.js
   :20/:190-193/:452/:512/:550/:900/:909/:942-974/:1031.
3. Apply the campaign-lifecycle fixture alignments — each
   change traceable to the cited controller contract; publish
   #1/#4 assert the deliberate evolved behaviour (no money at
   publish; status active; escrow at brand-sign).
4. Carve genuine class-3 RED — expected NONE (every behaviour
   verified intentional). If any aligned test stays RED for a
   non-fixture reason on re-measure, classify it honestly
   (carve, not force). Confirm no new 500s beyond the carved
   follower-feed-noauth-500.
5. Re-measure `pnpm qa:db`; record honest delta vs 359/23.
6. Re-run main `pnpm qa`; confirm 66 GREEN / C1 / gate 0;
   gov-check clean on the deploy-inert changeset.

## Success definition
SUCCESSFUL iff: classification grounded in the cited
controllers; each fixture alignment traceable to the verified
contract; any genuine defect carved RED (not masked); honest
measured delta; main `pnpm qa` unchanged. Any green via
skip/delete/weaken/fabricate/force-pass, or asserting a value
not backed by the controller, is an explicit FAILURE.

## Failure / edge
- Can't justify a behaviour from the controller → uncertain ⇒
  class-3 carve, never silently "fixed".
- A shared-helper edit (`fundedBrandWithCampaign`,
  `setupOpenGroupScenario`) affects sibling tests — the
  deterministic re-measure is the exact arbiter; any regression
  is unambiguous and acted on, never masked.
- Publish #1/#4 align to the evolved contract; if the
  re-measure shows the controller actually differs, reclassify
  honestly (carve), no spin.
- qa:db unavailable/substrate-fail → BLOCKED, retry; no
  static-only guessing.
