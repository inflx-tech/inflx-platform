# Impact Analysis — backend-test-debt Phase 4

> Step 5/6. Generated before implementation. Reviewed at lock.

## ⚠️ Deploy posture — DEPLOY-INERT
- Changes only `backend/tests/**` (Jest suites/fixtures — not in
  the running server's import graph) and adds
  `features/backend-defect-*/` finding stubs + this contract.
- **No** `backend/src`, migration, web, mobile, OTA, runtime, or
  dependency change → `git push` triggers **no** Render/Vercel
  deploy. Carved backend defects are *recorded*, not fixed here.
- Step-14 is a deploy-inert commit/push (no production approval
  gate per GOVERNANCE.md §5/§7); the no-fake-green + zero-
  regression proofs are mandatory before release.

## Affected files (read or change)
- **Change:** specific `backend/tests/**` files at sites
  identified from the fresh `db-jest.log` at Step 7 (classes
  1/2/4 only). New `features/backend-defect-<slug>/` stubs for
  class 3.
- **Read (authoritative truth):** the actual backend
  controllers / routes / migrations the failing tests exercise —
  the contract line, not the test's assumption, defines correct.
- **Read-only (must NOT change):** `backend/src/**`, migrations,
  `qa/scripts/run-qa.mjs`, `qa-report.mjs`,
  `qa-report-fidelity` (C1), `playwright.config.ts`,
  `governance-check.mjs`. Phase 4 touches neither runtime nor
  the QA/governance machinery.

## Affected routes / APIs
None. No runtime/contract/endpoint change. Tests are aligned to
the *existing* backend contract; the backend is unchanged.

## Affected workflows (regression surface)
- Main `pnpm qa` (66) + C1 + B2b substrate: must stay identical
  (Phase 4 edits only Jest tests + features/ docs; the Playwright
  L1/L2 lane and C1 are untouched). Mitigation: re-run `pnpm qa`
  at Step 7; gov-check runs on push (deploy-inert changeset).
- DB lane (`pnpm qa:db`): the measured surface. Expected to
  improve or hold; any *new* failure introduced by a test edit
  is a Phase-4 defect to fix before release (no net-negative
  masking).

## Migration / deploy / OTA
None. Test-infra + finding stubs only.

## Risk notes (honest)
1. **Mis-classification risk** — labelling a genuine backend
   defect as "assertion drift" and editing the test would mask a
   product bug. Mitigation: every class-1/2/4 fix must cite the
   controller/migration `file:line` that proves the test was
   stale; anything not provable from code is class-3 carve
   (uncertainty fails). This is the core discipline of the phase.
2. **Low-delta risk** — the residual is the hard part; the
   honest outcome may be a small numeric delta with several
   carves. That is a *successful* Phase 4 (rigor > delta). A big
   delta would be the red flag (likely masking).
3. **Scope-creep risk** — fixing a carved backend defect here
   would make this production-impacting. Forbidden: carves are
   separate gated contracts.
4. **Carved-defect debt** — Phase 4 will likely *increase* the
   count of open `backend-defect-*` contracts. That is correct:
   real bugs become visible and tracked rather than hidden in a
   green number.

## Ledger
281 → 244 (P1) → 231 (P2) → 194 (P3) → 192 (city-fix) → Phase 4.
Cheap cascades exhausted; P4 = per-test business-rule analysis.
Related: `features/backend-test-debt*`, `features/db-substrate`,
`features/qa-aggregation-fidelity` (C1),
`features/backend-defect-city-column` (carved precedent).
