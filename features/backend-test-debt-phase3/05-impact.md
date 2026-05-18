# Impact Analysis — backend-test-debt Phase 3

> Step 6. Generated BEFORE implementation. Reviewed at the lock.

## Affected files
- `backend/tests/**` — the stale-create-payload sites identified
  from `db-jest.log` (test-infra). Exact files pinned at Step 7
  from evidence (no pre-guessing).
- **New:** `features/backend-defect-*/` stub(s) — one per genuine
  backend defect found (200→500 / wrong-status from correct
  input). These are *findings*, not fixes (their own contracts
  later if/when addressed).
- Ledger: `features/backend-test-debt*/lock.json`.
- No app/runtime code edited in Phase 3 (a genuine defect is
  recorded, not patched here). No migration/mobile/OTA/web.
  **Deploy-inert** (`tests/`, `qa/`, `features/` not in
  `node src/index.js`).

## Affected workflows (regression surface)
- Test-infra edits ripple only within the backend suite; verified
  solely via the `pnpm qa:db` delta.
- Main `pnpm qa` (66), C1 meta-tests, B2b substrate: unaffected
  (DB lane separate by design; no qa-harness change this phase).

## Migration/deploy/OTA
- None. `test`-class, deploy-inert.

## Risk notes
- **Misclassification risk:** calling a genuine backend defect
  "stale payload" and editing the test to pass would MASK a
  product bug — the single worst outcome. Mitigation: every
  `200→500` (and any correct-input wrong-status) is treated as a
  defect candidate by default; reclassified to (i) only after
  reading the controller proves the test's request was genuinely
  malformed vs the *current* contract. Bias: when unsure, it's a
  defect finding (test stays red).
- Phase 3 will not reach 0 failures; residual + carved defects
  re-baselined for Phase 4. No force-green.
- Determinism unchanged (DB lane DROP/CREATE + all migrations).
