# Feature Spec — backend-test-debt Phase 2

> Contract (Phase 2 of the backend-test-debt ledger). Step 2.
> Implementation GATED on `lock.json.approved = true`.
> Ledger: `features/backend-test-debt/` (baseline now 138/244/382).

## Problem / goal
Phase 1 (registerBrand alignment) cleared 37 of 281
(→ 138 passed / 244 failed / 382). Phase 2 attacks the next
highest-leverage residual. Triage must be **evidence-based**, but
`qa-db.mjs` currently parses only the jest summary line — the full
failure log is not persisted, so classification would be guesswork.

## Scope (Phase 2)
1. **Enable evidence:** `qa-db.mjs` persists the full backend jest
   output to `qa/artifacts/db-jest.log` every run (small,
   deploy-inert harness change — prerequisite for honest triage,
   not scope creep).
2. **Triage:** from `db-jest.log`, classify the 244 by suite +
   root cause (expected classes: stale `registerInfluencer`/other
   shared factories; pre-rupees / pre-migration assertions;
   seed/order assumptions).
3. **Fix the next highest-leverage batch** — the exact batch is
   chosen at Step 7 from the captured log (evidence, not guessed),
   smallest change that clears the largest cluster.
4. **Re-measure** via `pnpm qa:db`; record honest delta + residual.

## Out of scope
- Not "make the DB lane PASS". Phase 2 = one more measured,
  evidence-driven batch. Remaining failures re-baselined for Phase 3.
- No app/runtime changes unless a failure is a *genuine backend
  bug* (then it is surfaced as its own finding/contract, not
  silently patched here).

## Surfaces touched
- `qa/scripts/qa-db.mjs` (persist log — harness), and whichever
  `backend/tests/**` helpers/specs the triage identifies as the
  next batch (test-infra). **Deploy-inert** (jest-only; not in the
  server import graph). No migration, mobile, OTA, web.

## Non-functional
- Same discipline as Phase 1: only real contract alignment; no
  `.skip`/deletion/fabricated data to inflate the pass rate; no
  force-green; honest re-baseline.
