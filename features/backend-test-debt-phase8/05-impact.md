# Impact Analysis — backend-test-debt Phase 8

## Deploy posture — DEPLOY-INERT
- Changes only `backend/tests/**` (Jest — not in the running
  server import graph) + this contract. No `src`/migration/
  runtime/dep change → no Render/Vercel. No carve expected
  (backend verified correct on every value).
- Step-14 = deploy-inert commit/push; no production approval
  gate (GOVERNANCE.md §5/§7). Pre-release: honest delta +
  no-fake-green + main `pnpm qa` 66/C1/gate-0 unchanged +
  gov-check clean.

## Affected files
- **Change:** `backend/tests/pay-at-store.test.js`,
  `commissions.test.js`, `prebook.test.js`, `withdrawal.test.js`
  — shared setups (`setupPayAtStoreScenario`,
  `setupCommissionScenario`: invite `+ offer_config_json`,
  `bill_amount` 100000→1000) + the 10 cluster tests' rupees
  assertions + the withdrawal fixture value/name.
- **Read (authoritative):** `campaign.controller.js` invite
  (offer_config_json from body, 735-736); `offer.service.js`
  `resolveDiscount`/`resolveScope` (132-163, 104-108);
  `transaction.controller.js` initiatePayAtStore;
  `withdrawal.controller.js:35-39`; prebook offer setup.
- **Read-only (must NOT change):** `src/**`, migrations,
  `qa/scripts/*`, C1 spec, `governance-check.mjs`.

## Affected workflows (regression surface)
- Main `pnpm qa` (66) + C1 + B2b substrate: must stay identical
  (only Jest tests + features/ docs change). `backend/tests/**`
  is NOT a GOVERNED path → gov-check triggers no
  contract-approval gate (deploy-inert).
- DB lane: the measured surface; deterministic, so any NEW red
  from a shared-setup edit is unambiguous and fixed before
  release (no net-negative masking). Pre-checked: the
  currently-green `setupCommissionScenario`/`setupPayAtStore`
  consumers assert counts/structure/auth, not money amounts —
  changing the money flow does not regress them.

## Risk notes
1. **Masking a real money bug** — the gravest risk. Mitigation:
   every new value is the controller's VERIFIED-correct rupees
   output (cited file:line + the resolveDiscount math), not a
   number picked to turn red green. The discount=0 anomaly was
   verify-twiced to a real fixture gap (ci.offer_config_json
   null because invite omits it — campaign.controller.js:735),
   NOT a backend defect — proven, not assumed.
2. **Shared-setup blast radius** — setupPayAtStore/Commission
   feed many tests. Pre-checked the passing consumers
   (by_channel/by_influencer/filters/pending_balance assert
   counts/structure, not amounts). Deterministic re-measure is
   the arbiter; any regression is exact and acted on.
3. **Scope honesty** — payout-id-format, set/wallet
   response-shape, topup-boundary are RECLASSIFIED OUT (not
   money-convention) and recorded as deferred, not dropped.
4. **Diminishing returns** — one measured batch; next layer
   re-baselines for Phase 9 (bounded, per P1-P7 ledger).

## Ledger
281→244(P1)→231(P2)→194(P3)→192(city)→146(P4)→123(P5)→82(P6)→
49(P7)→Phase 8. Related: `features/backend-test-debt*`,
`features/qa-db-determinism`, `features/qa-db-truncate-flake`,
`features/qa-aggregation-fidelity` (C1),
`features/backend-defect-*` (carved: city-column [fixed],
follower-feed-noauth-500 [open RED]).
