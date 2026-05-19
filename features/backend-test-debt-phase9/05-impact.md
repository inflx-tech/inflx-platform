# Impact Analysis — backend-test-debt Phase 9

## Deploy posture — DEPLOY-INERT
- Changes only `backend/tests/listing-engine.test.js` (Jest —
  not in the running server import graph) + this contract. No
  `src`/schema/migration/runtime change → no Render/Vercel. No
  carve (backend + committed schema verified correct).
- Step-14 = deploy-inert commit/push; no production approval
  gate (GOVERNANCE.md §5/§7). Pre-release: honest delta +
  no-fake-green + main `pnpm qa` 66/C1/gate-0 unchanged +
  gov-check clean.

## Affected files
- **Change:** `backend/tests/listing-engine.test.js` only —
  9 schema-constant assertion alignments + 1 quality-score
  scenario (5→10 products) + stale test-name corrections.
- **Read (authoritative):** `backend/public/schemas/
  restaurant.json` & `salon.json` (committed source of truth);
  `backend/src/services/listing.service.js` (loadSchema:18,
  getActivePhaseCategories:138, isCategoryActive:158,
  calculateQualityScore:200-269); `backend/.env`
  LISTING_ENGINE_PHASE=5.
- **Read-only (must NOT change):** `src/**`, the schema JSON
  files, migrations, `qa/scripts/*`, C1 spec,
  `governance-check.mjs`.

## Affected workflows (regression surface)
- Main `pnpm qa` (66) + C1 + B2b substrate: must stay identical
  (only one Jest test file + features/ docs change).
  `backend/tests/**` is NOT a GOVERNED path → gov-check
  triggers no contract-approval gate (deploy-inert).
- DB lane: the measured surface; deterministic. The single test
  file has NO shared-setup blast radius (no other suite imports
  it) → the re-measure delta is exact and isolated.

## Risk notes
1. **Asserting a non-contractual value** — gravest risk.
   Mitigation: every aligned constant is read directly from the
   committed on-disk schema (`restaurant.json`/`salon.json`) or
   the cited `listing.service.js` predicate + LISTING_ENGINE_
   PHASE; the active-category set was enumerated by replicating
   the exact predicate; not reverse-engineered from red output.
2. **Mistaking evolution for a bug (or vice-versa)** — verify-
   twice resolved the static-vs-runtime active-count mismatch
   (4 vs 5) to the env var LISTING_ENGINE_PHASE=5 (real),
   confirming 5 is the true contract. The quality-score test
   was proven a stale scenario (rule-9 min:10 > 5 added), not a
   scoring bug.
3. **Hidden pre-existing limitation** — `calculateQualityScore`
   only resolves brand fields business_name/city/category, so
   most restaurant field-rules can't score. RECORDED as an
   observation (not introduced here, not what the 10 tests
   assert, out of scope) — surfaced, not masked.
4. **Diminishing returns** — one measured batch; remaining
   clusters re-baseline for Phase 10 (bounded, P1-P8 ledger).

## Ledger
281→244(P1)→231(P2)→194(P3)→192(city)→146(P4)→123(P5)→82(P6)→
49(P7)→39(P8)→Phase 9. Related: `features/backend-test-debt*`,
`features/qa-db-determinism`, `features/qa-db-truncate-flake`,
`features/qa-aggregation-fidelity` (C1),
`features/backend-defect-*` (carved: city-column [fixed],
follower-feed-noauth-500 [open RED]).
