# Impact Analysis — backend-test-debt Phase 5

## Deploy posture — DEPLOY-INERT
- Changes only `backend/tests/**` (Jest — not in the running
  server import graph) + new `features/backend-defect-*/` carve
  stubs + this contract. No `backend/src`/migration/runtime/dep
  change → `git push` triggers no Render/Vercel deploy. Carved
  defects are recorded, not fixed here.
- Step-14 = deploy-inert commit/push; no production approval
  gate (GOVERNANCE.md §5/§7). Mandatory pre-release: honest
  delta + every class-3 carved RED + no-fake-green + main
  `pnpm qa` 66/C1/gate-0 unchanged + gov-check clean.

## Affected files
- **Change:** specific `backend/tests/**` at Step-7-identified
  sites (invite/offer payloads, wallet-funding setup, assertion
  drift) — classes 1/2/4 only. New `features/backend-defect-*/`
  for class 3.
- **Read (authoritative):** the actual controllers/routes/
  migrations the failing tests exercise.
- **Read-only (must NOT change):** `backend/src/**`, migrations,
  `qa/scripts/run-qa.mjs`, `qa-report.mjs`, C1 spec,
  `playwright.config.ts`, `governance-check.mjs`.

## Affected workflows (regression surface)
- Main `pnpm qa` (66) + C1 + B2b substrate must stay identical
  (only Jest tests + features/ docs change). Mitigation: re-run
  `pnpm qa` at Step 7; gov-check on push (deploy-inert).
- DB lane: the measured surface. Any NEW failure introduced by a
  test edit must be fixed before release (no net-negative
  masking).

## Risk notes
1. **Mis-classification** — labelling a genuine bug as assertion
   drift and editing the test would mask it. Mitigation: every
   1/2/4 fix cites the controller line proving staleness; not
   provable ⇒ class-3 carve (uncertainty fails).
2. **Diminishing returns / unbounded peel** — each layer reveals
   the next. Mitigation: ONE measured batch this phase; the next
   layer (if any) re-baselines for Phase 6 — bounded, per the
   P1–P4 ledger discipline.
3. **Carved-defect debt increases** — correct: real bugs become
   visible/tracked, not hidden in a green number.
4. **Scope creep** — fixing a carved backend defect here would
   make this production-impacting; forbidden (separate gated
   contract).

## Ledger
281→244(P1)→231(P2)→194(P3)→192(city-fix)→146(P4)→Phase 5.
Related: `features/backend-test-debt*`, `features/db-substrate`,
`features/qa-aggregation-fidelity` (C1),
`features/backend-defect-*` (carved precedents:
city-column [fixed], follower-feed-noauth-500 [open]).
