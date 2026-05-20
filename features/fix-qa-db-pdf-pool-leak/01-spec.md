# Feature Spec — fix qa:db PDF pool leak

> Step 1. Implementation GATED on `lock.json.approved = true`.
> PRODUCTION-IMPACTING per gov-check path classification (touches
> `backend/src/controllers/contract.controller.js`) but **runtime
> effect in production is ZERO** — the change is gated by
> `env.NODE_ENV === 'test'`. Founder GO 2026-05-20: "Go with
> your recommendation" (option 3 of the surfaced 4).

## Problem

`pnpm qa:db` hits an environmental-shaped block under sustained
load: 5 suites failed in the last clean run (367/382), all with
timeout / Connection-terminated signatures. Verify-twice via the
qa:db log (`qa/artifacts/_sc5_finalretry_qadb.log`) pinned the
root cause:

- **14 of 14 `Error: timeout exceeded when trying to connect`
  events originate at `contract.controller.js:1157`** —
  `db.query(SELECT * FROM contracts WHERE id = $1)` after the
  brand-approve handler.
- The pool exhaustion is caused by the line ABOVE
  (**`contract.controller.js:1153`**):
  ```js
  _generateAndStorePdf(contract.id).catch(err => ...);
  ```
  This is the **only fire-and-forget invocation** out of 6
  call-sites of `_generateAndStorePdf` (the other 5 all
  `await`). Under tight test loops the brand-approve test fires
  many approve requests back-to-back; each leaves a background
  PDF-gen pending. Those background tasks each hold app-pool
  (`backend/src/config/db.js`, max=20) connections beyond the
  owning request's lifetime. After ~20 in-flight approves the
  pool saturates → the next `db.query` waits 10s for a free
  connection → `connectionTimeoutMillis` fires → "timeout
  exceeded when trying to connect."
- The cascade also delays `truncateAll()` in subsequent
  `beforeEach` (the catch-all hook timeout — 30000ms — finally
  trips). lock_timeout='8s' diagnostic never fired because the
  block isn't at the TRUNCATE statement; it's at the upstream
  pool starvation.

In **production** the leak is invisible: brand-approve runs
sparsely, PDF gen completes well before the next approve, and
Render's app-pool size keeps headroom. The leak is unmasked by
qa:db's tight back-to-back load pattern only.

## Fix (minimal, NODE_ENV-gated)

`backend/src/controllers/contract.controller.js:1153` — wrap the
fire-and-forget so it is `await`-ed when `NODE_ENV === 'test'`:

```js
const pdfRegen = _generateAndStorePdf(contract.id).catch(err =>
  console.error('[CONTRACT] PDF regen after approve failed:', err.message)
);
if (env.NODE_ENV === 'test') await pdfRegen;
```

The `env.NODE_ENV` access matches the existing pattern in this
file (`env` imported at :19 from `../config/env`; the same pattern
is used in `env.js:29` for `DATABASE_URL` test gating). In
production (`NODE_ENV !== 'test'`), the line continues to fire
the PDF gen and return immediately — **zero runtime difference**
vs the current code.

## Success

- `pnpm qa:db` flips to **382/382 deterministic GREEN across two
  consecutive runs** (the determinism standard the founder set in
  `qa-db-determinism` / `qa-db-truncate-flake`). The 5 previously
  failing suites (pay-at-store, earnings, follower-feed,
  commissions, prebook-daterange) all GREEN by the backend
  serialisation, NOT by a test edit.
- Main `pnpm qa`: 66 / C1 / gate 0 unchanged.
- No new genuine 500s, no regression vs commit 02e6298 baseline.

## Surfaces / deploy

- `backend/src/controllers/contract.controller.js` (GOVERNED).
- **PRODUCTION-IMPACTING per path classification**: `git push
  origin main` → Render auto-deploys backend.
- **Runtime effect in production: ZERO** — the gated `await`
  only fires under `NODE_ENV === 'test'`. Brand-approve latency
  unchanged in prod.
- Founder GO 2026-05-20 on record: "Go with your recommendation."
- Forward-only. Rollback = revert the 3-line change.
