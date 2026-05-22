# Workflow — qa:db env-resilience hardening

> Step 2. Verifier: `pnpm qa:db` × 2 deterministic GREEN + main
> `pnpm qa` regression + gov-check rules 1+2 exit 0.

## Actor

Agent under standing autonomy; founder GO 2026-05-20 "go with
your recommendation" (Option 1 surfaced after Phase 2 closeout).

## Preconditions

- Phase 2 sub-contract 5 SHIPPED (commit 71e4ce4) — gov-check
  Rules 3/4/5 are now ENFORCED; this contract's deploy-inert
  scope means none of them fire here.
- Fresh-box baseline confirmed at 11:29Z (240.8s, 382/382 GREEN
  on commit 02e6298 → carried forward through 71e4ce4 unchanged
  because SC5 didn't touch backend tests).
- Box is rested / Docker daemon healthy / no heavy background
  processes.

## Steps

1. Edit `qa/scripts/db-up.mjs` — append `-c max_connections=200`
   in the `docker run` arg array.
2. Edit `backend/tests/helpers/db.js` —
   bump pool max 5→10, add `connectionTimeoutMillis: 10000`,
   add `pool.on('error', …)` with pool-state dump.
3. Edit `backend/tests/jest.afterEnv.js` —
   at `beforeAll`, attach idempotent `'error'` listener to the
   app pool with pool-state dump.
4. Verify-twice: `node --check` each edited JS file parses
   clean; re-read the diff hunk on each file; confirm no
   `backend/src/` modification.
5. `pnpm qa:db` run #1 — must hit 382/382 GREEN; capture log to
   `qa/artifacts/_envres_qadb_run1.log`.
6. `pnpm qa:db` run #2 — must again hit 382/382 GREEN for
   determinism; capture to `_envres_qadb_run2.log`.
7. `pnpm qa` — main lane GREEN 66/C1/gate 0; capture to
   `_envres_qa.log`.
8. Author `06-diff/notes.md` — plain-English summary of
   before/after pool behaviour + diagnostic-event examples.
9. Finalize `lock.json`: status `locked → released`,
   `release.qa_all_green: true`, populate `released_by/at`.
10. Step-14 RELEASE — DEPLOY-INERT; commit with approved
    contract; push origin main → gov-check exit 0 expected.

## Success definition

- 2 consecutive qa:db runs land 382/382 GREEN, same suite
  shape (28/28), same migration count (54/54), times comparable
  or better than 240.8s.
- Main qa unchanged 66/C1/gate 0.
- gov-check at push: "no governed paths changed (deploy-inert
  changeset) ✓ release evidence … present + self-consistent ✓".
- The diagnostic listener fires correctly when triggered
  (verified by inspecting the listener code parses + the
  attach-once guard works).

## Failure / edge

- Run #1 RED → classify Class 1 (env saturation again? box
  load?) vs Class 2/3 (code regression from this contract).
  If env saturation: surface + hold; do NOT retry-to-green.
  If code regression: revert the change, investigate, do not
  push.
- Run #1 GREEN, Run #2 RED → flake; classify, do not call done.
- Main qa regression → revert immediately. The contract is
  deploy-inert; nothing should change in main qa.
