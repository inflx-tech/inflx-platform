# Impact Analysis — backend-test-debt Phase 6

## Deploy posture — DEPLOY-INERT
- Changes only `backend/tests/**` (Jest — not in the running
  server import graph) + new `features/backend-defect-*/` carve
  stubs + this contract. No `src`/migration/runtime/dep change →
  no Render/Vercel. Carved defects recorded, not fixed here.
- Step-14 = deploy-inert commit/push; no production approval
  gate (GOVERNANCE.md §5/§7). Mandatory pre-release: honest
  delta + class-3 carved RED + no-fake-green + main `pnpm qa`
  66/C1/gate-0 unchanged + gov-check clean.

## Affected files
- **Change:** specific `backend/tests/**` at Step-7-identified
  sites (create-order payloads, accept/contract step,
  wallet-funding setup) — classes 1/2/4. New
  `features/backend-defect-*/` for class 3.
- **Read (authoritative):** the actual follower-payment /
  contract / wallet controllers the failing tests exercise.
- **Read-only (must NOT change):** `src/**`, migrations,
  `qa/scripts/*`, C1 spec, `playwright.config.ts`,
  `governance-check.mjs`, the qa-db-determinism teardown.

## Affected workflows (regression surface)
- Main `pnpm qa` (66) + C1 + B2b substrate: must stay identical
  (only Jest tests + features/ docs change). Re-run `pnpm qa`;
  gov-check on push (deploy-inert).
- DB lane: the measured surface; deterministic now, so any NEW
  failure introduced by a test edit is unambiguous and must be
  fixed before release (no net-negative masking).

## Risk notes
1. **Mis-classification** — labelling a genuine bug as drift and
   editing the test would mask it. Mitigation: every 1/2/4 fix
   cites the controller line proving staleness; not provable ⇒
   class-3 carve (uncertainty fails).
2. **Diminishing returns** — each layer reveals the next; ONE
   measured batch this phase; next layer re-baselines for
   Phase 7 (bounded, per P1-P5 ledger discipline).
3. **Carved-defect debt grows** — correct: real bugs become
   visible/tracked, not hidden in a green number.
4. **Scope creep** — fixing a carved backend defect here would
   make this production-impacting; forbidden (separate gated
   contract).

## Ledger
281→244(P1)→231(P2)→194(P3)→192(city-fix)→146(P4)→123(P5)→
Phase 6. Related: `features/backend-test-debt*`,
`features/qa-db-determinism`, `features/qa-db-truncate-flake`,
`features/qa-aggregation-fidelity` (C1),
`features/backend-defect-*` (carved: city-column [fixed],
follower-feed-noauth-500 [open RED]).
