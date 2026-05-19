# Impact Analysis — backend-test-debt Phase 7

## Deploy posture — DEPLOY-INERT
- Changes only `backend/tests/**` (Jest — not in the running
  server import graph) + this contract (+ a new
  `features/backend-defect-*/` carve stub only if a NEW class-3
  appears; none expected). No `src`/migration/runtime/dep change
  → no Render/Vercel. Carved defects recorded, not fixed here.
- Step-14 = deploy-inert commit/push; no production approval
  gate (GOVERNANCE.md §5/§7). Mandatory pre-release: honest
  delta + class-3 carved RED + no-fake-green + main `pnpm qa`
  66/C1/gate-0 unchanged + gov-check clean.

## Affected files
- **Change:** specific `backend/tests/**` at Step-7-identified
  sites:
  - Lever 1 — set-create payloads in `commissions`,
    `pay-at-store`, `prebook`, `prebook-daterange`,
    `online-order`, `follower-store` test files
    (+`formats_json`). `campaigns.test.js` EXCLUDED (its
    publish setup creates no set — separate validation drift,
    deferred P8).
  - Lever 2 — `contracts.test.js` `setupPendingBrand` + the 3
    `pending_influencer` tests (+approve step).
  - Lever 3 — `influencer-search.test.js` per-test brand setups
    (+`approveUser`).
- **Read (authoritative):** `contract.controller.js:504-530`,
  `transaction.service.js:107-144` (validateTracking),
  `transaction.controller.js` (initiatePayAtStore),
  `influencer.routes.js:15`, `middleware/auth.js:142`
  (requireApproved), the contract auto-create service.
- **Read-only (must NOT change):** `src/**`, migrations,
  `qa/scripts/*`, C1 spec, `playwright.config.ts`,
  `governance-check.mjs`, the qa-db-determinism teardown.

## Affected workflows (regression surface)
- Main `pnpm qa` (66) + C1 + B2b substrate: must stay identical
  (only Jest tests + features/ docs change). Re-run `pnpm qa`;
  gov-check on push (deploy-inert; `backend/tests/**` is NOT a
  GOVERNED path → no contract-approval gate triggered).
- DB lane: the measured surface; deterministic now, so any NEW
  failure introduced by a shared-helper edit
  (`setupPendingBrand`/`setupAcceptedOffer`) is unambiguous and
  must be fixed before release (no net-negative masking).

## Risk notes
1. **Mis-classification** — labelling a genuine bug as drift and
   editing the test would mask it. Mitigation: every lever cites
   the controller line proving staleness; the dominant chain is
   proven by a reverted instrumented run, not a hypothesis; not
   provable ⇒ class-3 carve (uncertainty fails).
2. **Shared-helper blast radius** — `setupPendingBrand` /
   `setupAcceptedOffer` feed many contracts.test.js tests;
   adding approve advances contract state for all of them.
   Mitigation: deterministic re-measure is the arbiter — net
   delta + any new red is exact and acted on, never masked.
3. **Diminishing returns** — each layer reveals the next; ONE
   measured batch this phase; the independent non-cascade
   clusters re-baseline for Phase 8 (bounded, per P1-P6 ledger
   discipline).
4. **Carved-defect debt** — real bugs stay visible/tracked, not
   hidden in a green number. No NEW carve expected (only the
   pre-carved follower-feed-noauth-500).
5. **Scope creep** — fixing a carved backend defect, or the
   brand-sign 500-wrapping-422 wrinkle, here would make this
   production-impacting; forbidden (separate gated contract;
   P6 already adjudicated the wrapper as class-2-fixture).

## Ledger
281→244(P1)→231(P2)→194(P3)→192(city-fix)→146(P4)→123(P5)→
82(P6)→Phase 7. Related: `features/backend-test-debt*`,
`features/qa-db-determinism`, `features/qa-db-truncate-flake`,
`features/qa-aggregation-fidelity` (C1),
`features/backend-defect-*` (carved: city-column [fixed],
follower-feed-noauth-500 [open RED]).
