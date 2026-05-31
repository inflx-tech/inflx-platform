# Impact Analysis — referral-engine (Contract 1)

> Generated BEFORE implementation code. Reviewed against the lock before Step 7.

## Affected files (read or change)
- **backend (new):**
  - `backend/migrations/078_referral_engine.sql` — new tables + index +
    `influencers.referral_earned_total` column.
  - `backend/src/services/referral.service.js` — engine (code, resolveActiveEdge,
    accrue, guards).
  - `backend/scripts/run-078.js` — one-off migration runner (per precedent;
    `migrate.js` is broken past 013).
  - `backend/tests/referral-engine.test.js` — QA workflow + invariant tests.
- **backend (changed — accrual hooks, additive, wrapped):**
  - `backend/src/controllers/webhook.controller.js` (~line 237, after the
    `subscription_invoices` paid INSERT in `handleSubscriptionCharged`).
  - `backend/src/services/escrow.service.js` (~line 175, end of
    `processTrancheRelease`, inside its txn client).
  - `backend/src/jobs/commission-confirm.job.js` (~line 39, after the
    pending→wallet UPDATE).

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| — | — | No API surface change in this contract | — |

## Affected workflows (regression surface)
Existing workflows touching the same files/paths that must stay GREEN:
- Subscription charge webhook — `qa/.../subscription*` / webhook tests.
- Escrow tranche release (T1/T2/T3) — escrow/tranche specs.
- Commission confirmation cron — commission-confirm spec.
- Pay-at-store / online-order commission math — `pay-at-store.test.js`,
  `pricing-service.test.js` (base figures must be unchanged).

## Migration / deploy / OTA impact
- **New migration 078** → needs `run-078.js`; apply to Supabase prod as part of
  release (additive only: new tables, new index, one nullable-with-default
  column — no destructive change).
- Backend-only → **`git push` (Render) only**. No web build, no OTA.
- **Deploy posture: PRODUCTION-IMPACTING but DORMANT** — the engine ships live,
  but with **zero `referral_edges` rows in prod** it never accrues. It activates
  only once Contract 2/3 create edges. Safe to deploy ahead of the UI.

## Risk notes
- Hooks run **inside existing money transactions** — primary risk is an accrual
  bug breaking a real payment/cron. Mitigation: each hook wrapped in try/catch
  that logs + no-ops; accrual is INSERT-only + idempotent; covered by tests
  asserting the host path still commits when accrual throws.
- No backfill (greenfield); no auth change; no enum change in this contract
  (the `agency` user_role enum value is added in Contract 3).
- Reversibility: additive tables; feature is inert with no edges, so a rollback
  is "stop creating edges" — no data migration needed.
