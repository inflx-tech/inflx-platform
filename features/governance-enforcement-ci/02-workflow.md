# Workflow Definition — governance-enforcement-ci

> Step 2. The executable contract. Each numbered step is an
> assertion verified at Step 7. This contract's "workflow" is
> the enforcement machinery behaving correctly on real inputs.

## Actor
An engineer/agent committing changes to the INFLX repo; GitHub
Actions running on PR/push to `main`; the founder applying
operator-only branch protection.

## Preconditions
- Baseline intact: `pnpm qa` 66 GREEN, C1 STATE=GREEN, gate 0;
  `pnpm qa:db` decoupled (190/192/382, laneState FAIL by
  design); HEAD on `main`, working tree clean except the known
  not-mine untracked (`backend/seeds/master_dishes_draft.csv`,
  `design/`).
- No `.github/`, no git hooks today (audit-confirmed).

## Workflow steps (observable behaviour the machinery must show)
1. **Charter exists & is durable** → `GOVERNANCE.md` at repo
   root, committed, contains every mandatory section (§spec),
   each rule tagged MANDATORY-ENFORCED / RECOMMENDED /
   OPERATOR-ONLY, cross-referencing the enforcement scripts.
2. **Reusable validator** → `node qa/scripts/governance-check.mjs`
   runs standalone, exit 0 on a compliant tree, exit nonzero
   with a precise human message on a violation. Same script
   invoked by (L) and (C) — one source of truth.
3. **Local hook — happy path** → with the pre-push hook
   installed, pushing a change that has an approved contract +
   impact analysis succeeds (hook exit 0, push proceeds).
4. **Local hook — violation** → pushing a change under a
   governed path (`backend/src/**` etc.) with NO approved
   `features/<slug>/lock.json` is **blocked loudly** with the
   reason; only an explicit `GOVERNANCE_OVERRIDE="<reason>"`
   lets it through and the override+reason is printed (never
   silent).
5. **CI `governance` job** → on a PR touching a governed path
   with no approved contract / missing `05-impact.md`, the job
   **fails** with the exact missing artifact named. On a
   compliant PR it passes fast.
6. **CI `qa` job (the gate)** → installs pinned Node+pnpm,
   frozen root deps, brand-web deps (frozen lockfile),
   Playwright browsers; runs `pnpm qa` with `CI=true`; the job's
   pass/fail equals the local `pnpm qa` gate exit code (same
   semantics — workflow success, not compilation). Evidence
   (results.json, QA report) uploaded as artifacts.
7. **CI `qa-db` job** → runs `pnpm qa:db` on Docker; is
   `continue-on-error` / non-required; uploads `db-lane.json` +
   `db-jest.log`. A red DB lane does **not** fail the workflow
   or the required check (decoupling preserved). C1 fidelity
   meta-tests still GREEN — proven by re-running `pnpm qa`.
8. **Operator-only doc** → the contract + GOVERNANCE.md state
   the EXACT GitHub branch-protection settings; applying them
   is explicitly the founder's action, clearly labelled, never
   attempted by code.
9. **Determinism** → root `package.json` pins Node/pnpm
   (metadata); `Packages/brand-web` has a committed lockfile so
   the CI brand-web install is reproducible.
10. **Zero regression** → after all artifacts land, local
    `pnpm qa` still 66 GREEN / C1 STATE=GREEN / gate 0;
    `pnpm qa:db` still decoupled & unchanged in semantics.

## Success definition
SUCCESSFUL only if the final state is:
- `GOVERNANCE.md` committed with all mandatory sections + tier
  tags; AND
- `governance-check.mjs` correctly passes a compliant tree and
  fails a real violation with a precise message, reused by both
  (L) local hook and (C) CI; AND
- `.github/workflows/qa.yml` runs `governance` + `qa` (required)
  + `qa-db` (informational, non-blocking, decoupling intact) on
  PR/push to `main`, with evidence uploaded as artifacts; AND
- the exact operator-only branch-protection settings are
  documented (not applied by code); AND
- determinism pins committed; AND
- local `pnpm qa` 66 GREEN / C1 STATE=GREEN / gate 0 and the
  DB-lane decoupling are **unchanged** (no regression, no
  fake-green, the gate logic itself untouched).

A green CI achieved by weakening the gate, skipping specs, or
merging the DB lane into the verdict is an **explicit FAILURE**
of this contract.

## Failure / edge workflows
- CI flaky on first run (browser fetch / Next boot) → diagnose
  & fix the workflow (caching, timeouts, retries already =1 in
  CI); NEVER loosen `pnpm qa` to pass CI.
- `governance-check` blocks a legitimate deploy-inert change →
  fix the governed-path allowlist; do not disable the check.
- brand-web install non-deterministic → the committed brand-web
  lockfile resolves it; if a lockfile can't be produced cleanly,
  STOP and surface (do not ship a non-deterministic gate).
- Tension Mode A vs B unresolved → blocked at lock, not chosen
  by the agent.
