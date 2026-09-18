# item10-store-visit — before/after notes

Filled in phase by phase. The screens' notes (V1–V15 against the locked mockups) land with Phase 3.

## Phase 2a — the gate and the mode (backend; one mobile primitive)

**Before:** two of eighteen paths into the shoot checked the signatures; none checked the money.
Every set-first collaboration's shoot row was born `remote`. `DangerButton` accepted `busy` and
dropped it, so four confirm sheets could be double-tapped mid-request.

**After:** `shootGate` / `assertShootOpen` on every path (contract reads, date range, visit
details, all event-scoped routes through `getEventOrThrow`, the brand list as a filter, the roster
and the admin queue as a column, and `autoCreateForContract` itself). The set's `shoot_mode` is the
mode's source. The shoot row is born after the money inside the countersign transaction, in a
savepoint. `DangerButton` honours `busy` exactly as `PrimaryButton` does — visible on the decline,
withdraw, reject and withdraw-pitch sheets as a dimmed button with a spinner that cannot fire twice.

Evidence: `backend/tests/item10-storevisit.test.js` (15, incl. the loop over the route table);
`Packages/Mobile/src/components/settings/__tests__/dangerButton.test.js` (3); full backend
1345 tests, 221 failed = the baseline's 221, 0 new failures (`compare.js`).
