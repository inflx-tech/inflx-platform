# Workflow Definition — backend-test-debt Phase 8

> Step 2. Executable contract. Verifier: the now-DETERMINISTIC
> B2b DB lane (`pnpm qa:db`). Continuation of the Phase-7 method
> on the money-convention cluster.

## Actor
QA/triage operator running `pnpm qa:db` + reading the real
backend controllers/services (verify-twice).

## Preconditions
Docker up; substrate green (53/53); instrument deterministic.
Baseline **333 passed / 49 failed / 382** (post-P7 888cd05).
Main `pnpm qa` 66 GREEN / C1 / gate 0.

## Workflow steps
1. Inventory the money-cluster failures from
   `_p7_remeasure_qadb.log` (authoritative post-P7) + a fresh
   `pnpm qa:db` for the re-measure.
2. 4-class classify each, justified by the actual
   controller/service (verify-twice; real stack > hypothesis):
   - `campaign.controller.js` invite stores offer_config_json
     from body → fixture must send it (class-2).
   - `offer.service.js resolveDiscount` value/sub_type/scope →
     `{ value:30 }` ⇒ 30% on a rupees bill (verified math).
   - `transaction.controller.js initiatePayAtStore` rupees-native.
   - `withdrawal.controller.js:35-39` rupees, `<100` rejects.
   - prebook offer `prebook_advance:200` → endpoint returns 200.
3. Apply the 3 levers — each change traceable to a cited
   controller/service line; new values are the VERIFIED rupees
   outputs, not reverse-engineered.
4. Carve any genuine class-3 RED (none expected). Confirm no new
   500s beyond the carved follower-feed-noauth-500.
5. Re-measure `pnpm qa:db`; record honest delta vs 333/49 + the
   classified inventory (incl. the reclassified-out items).
6. Re-run main `pnpm qa`; confirm 66 GREEN / C1 / gate 0;
   gov-check clean on the deploy-inert changeset.

## Success definition
SUCCESSFUL iff: classification grounded in real evidence; the 3
levers each traceable to a contract line; new assertion values
are the backend's verified-correct rupees output; every class-3
carved RED (not masked); honest measured delta; main `pnpm qa`
unchanged. Any green via skip/delete/weaken/fabricate/force-pass,
or assertions reverse-engineered to hide a real money bug, is an
explicit FAILURE.

## Failure / edge
- Can't prove the rupees value from the controller → uncertain
  ⇒ class-3 carve, never silently "fixed".
- A shared-setup edit (setupPayAtStoreScenario /
  setupCommissionScenario) regresses a currently-green test →
  deterministic re-measure makes it unambiguous; fix or carve;
  never net-negative masking. (Pre-checked: passing consumers
  assert counts/structure/auth, not amounts.)
- qa:db unavailable → BLOCKED, report; no static-only guessing.
