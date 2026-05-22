# Feature Spec — qa:db env-resilience hardening

> Step 1. Implementation GATED on `lock.json.approved = true`.
> DEPLOY-INERT (only `qa/scripts/db-up.mjs` + `backend/tests/`
> touched; no governed source). Founder GO 2026-05-20: "go with
> your recommendation" (Option 1 of the 2 surfaced after Phase 2
> closeout).

## Problem

`pnpm qa:db` recurringly hits Class 1 environmental blocks on
the founder's Windows box after ~6–8 hours of sustained heavy
work (multiple emulator + Gradle + qa:db + OTA cycles in one
session). The same code measured 382/382 GREEN at commit
`02e6298` (05:47Z) — saturated 4 hours later (367/382 RED) —
recovered 240.8s clean after Windows restart. Three concrete
substrate weaknesses that **amplify** the saturation block (none
of them are the root cause of host saturation, but each one
makes the manifestation louder + harder to diagnose):

1. **`max_connections=100` (postgres default).** Jest under
   `--runInBand` per worker still spawns multiple pool clients
   per request (controllers + `withTransaction` + helper pool).
   Under load + delayed teardown, the total in-flight count
   creeps past safe margins.
2. **Test-helper pool `max: 5`** (`backend/tests/helpers/db.js`).
   Tight cap; under sustained truncate + parallel migrations +
   per-test queries, queries can queue.
3. **No `connectionTimeoutMillis` on the test pool.** Means
   test-pool requests for a connection wait INDEFINITELY (pg-pool
   default). When the app pool exhausts (10s timeout fires loud),
   the test pool just hangs silently until the 30s Jest hook
   timeout fires — opaque. The app pool already has
   `connectionTimeoutMillis: 10000` — test pool should match.
4. **No pool-state diagnostic on `'error'` events.** When pg-pool
   emits an `error` event, the existing app-pool handler logs
   only the message — not `{ totalCount, idleCount, waitingCount }`.
   Means a saturated pool emits an error with no context for
   diagnosis.

This contract does NOT attempt to solve host saturation (that's
operator hygiene: don't run 12-hour heavy sessions without
restart). It DOES raise the pool ceiling so the threshold at
which saturation manifests is materially higher AND makes
diagnostics loud so the next saturation event tells us
exactly what happened.

## Fix (minimal, deploy-inert)

1. **`qa/scripts/db-up.mjs`** — append `-c max_connections=200`
   to the `docker run` args (after `PG_IMAGE`). Doubles the
   container-side ceiling. Memory cost: tiny (each connection
   slot is ~few KB metadata).
2. **`backend/tests/helpers/db.js`** —
   - bump `Pool({ max: 5 })` → `Pool({ max: 10, connectionTimeoutMillis: 10000 })`;
   - add `pool.on('error', err => …)` that logs
     `{ totalCount, idleCount, waitingCount }` alongside the
     message. **Loud, not silent.**
3. **`backend/tests/jest.afterEnv.js`** — at `beforeAll(...)`,
   attach an analogous `'error'` listener to the **app pool**
   (imported from `backend/src/config/db.js`) — listener is
   idempotent (guarded by a `_inflxDiagAttached` flag). Test-side
   instrumentation only; no edits to `backend/src/`.

## Success

- `pnpm qa:db` × 2 deterministic 382/382 GREEN, time comparable
  to today's clean baseline (240.8s) — slightly faster expected
  due to the higher pool ceiling, no regression expected.
- `pnpm qa` main lane 66/C1/gate 0 unchanged.
- gov-check exit 0 (Rule 1: no governed paths; Rule 2: release
  evidence valid on lock.json; Rules 3/4/5 don't fire — no
  UI/Mobile in scope).
- No new Connection-terminated errors on the clean run (if any
  appear, the new diagnostic emits pool state for triage).

## Surfaces / deploy

- `qa/scripts/db-up.mjs` (DEPLOY-INERT).
- `backend/tests/helpers/db.js` (DEPLOY-INERT — under
  `backend/tests/`, not loaded by the running server).
- `backend/tests/jest.afterEnv.js` (DEPLOY-INERT).
- `git push origin main` is a behavioural no-op for
  Render/Vercel/OTA — no source path touched.
- Forward-only. Rollback = revert the 3-file change.

## Out-of-scope (explicit non-goals)

- Editing `backend/src/config/db.js` (would be governed/
  production-impacting). The existing app-pool `'error'` listener
  there stays as-is; this contract layers an additional test-side
  listener for tests only.
- Tuning `shared_buffers`, `work_mem`, or other pg memory knobs
  — the recurring block is connection-count + socket-layer, not
  pg memory.
- Docker Desktop resource limits — those are operator settings,
  not in this repo.
- Solving Windows TCP/Docker socket-layer drops — out of scope;
  the diagnostic will reveal them clearly when they happen, and
  fresh-box discipline remains the operational backstop.
