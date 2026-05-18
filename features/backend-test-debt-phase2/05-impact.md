# Impact Analysis — backend-test-debt Phase 2

> Step 6. Generated BEFORE implementation. Reviewed at the lock.

## Affected files
- `qa/scripts/qa-db.mjs` — additively persist the full backend
  jest stdout+stderr to `qa/artifacts/db-jest.log`. The existing
  parsing / laneState logic / exit semantics are UNCHANGED (only a
  `fs.writeFileSync(log)` added). C1 + B2b behaviour preserved.
- `backend/tests/**` — the triage-identified next batch
  (helpers/specs aligned to current contracts). Exact files chosen
  at Step 7 from `db-jest.log` (evidence, not pre-guessed).
- Ledger updates: `features/backend-test-debt*/lock.json`.
- No app/runtime code (unless a genuine backend bug is found → its
  own finding/contract). No migration, mobile, OTA, web.
  **Deploy-inert** (`tests/`, `qa/` are not in `node src/index.js`).

## Affected workflows (regression surface)
- `qa-db.mjs` change is additive logging → main `pnpm qa` (66),
  C1 meta-tests, B2b substrate all unaffected (DB lane separate by
  design; logging doesn't alter verdict/exit). Re-confirm by the
  qa:db run itself (it still reports truthfully).
- Test-helper edits ripple only within the backend suite (no
  runtime blast radius), verified solely via the qa:db delta.

## Migration/deploy/OTA
- None. `test`/harness-class, deploy-inert.

## Risk notes
- `db-jest.log` can be large; write it plainly (truncate only if
  egregiously huge, noting truncation) — never silently drop the
  tail used for triage.
- Over-fix risk (mask a real bug by editing the test): explicitly
  forbidden — genuine backend bugs are surfaced separately.
- Phase 2 likely won't reach 0 failures; residual is re-baselined
  and tracked for Phase 3. No force-green, no `.skip`.
- Determinism unchanged: DB lane still DROP/CREATE + all-migrations
  per run.
