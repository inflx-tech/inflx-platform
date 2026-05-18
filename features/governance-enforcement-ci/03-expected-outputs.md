# Expected Outputs — governance-enforcement-ci

> Step 3. Defined BEFORE coding. This is what Step-7 QA asserts.
> "It compiles" / "the YAML parses" is NOT an expected output —
> the machinery must demonstrably block a real violation and
> pass a real compliant change.

## Per-step expected outputs
| Step | Observable output | How verified |
|---|---|---|
| 1 Charter | `GOVERNANCE.md` at repo root, committed, all mandatory sections present, every rule tagged MANDATORY-ENFORCED/RECOMMENDED/OPERATOR-ONLY | Section checklist; grep for tier tags; human read |
| 2 Validator | `node qa/scripts/governance-check.mjs` → exit 0 clean tree; exit≠0 + precise message on injected violation | Run both ways locally; capture output |
| 3 Hook happy | Push with approved contract → hook exit 0 | Local dry-run with installed hook |
| 4 Hook violation | Push governed-path change w/o approved contract → blocked + reason; `GOVERNANCE_OVERRIDE` prints reason & allows | Local dry-run, both branches |
| 5 CI governance | Non-compliant PR → `governance` job fails naming the missing artifact; compliant PR → passes | Workflow run logs (a test PR/branch) |
| 6 CI qa gate | `qa` job result == local `pnpm qa` gate exit; artifacts uploaded | Compare CI exit vs local; artifact present |
| 7 CI qa-db | `qa-db` runs, non-blocking, `db-lane.json`+`db-jest.log` artifacts; workflow still passes when DB lane FAILs | Workflow logs; required-check status |
| 8 Operator doc | Exact branch-protection settings listed; explicitly NOT applied by code | Read GOVERNANCE.md + contract |
| 9 Determinism | root `package.json` pins Node/pnpm; `Packages/brand-web` lockfile committed | git diff; CI install is `--frozen-lockfile` |
| 10 No regression | local `pnpm qa` 66 GREEN / C1 STATE=GREEN / gate 0; DB-lane decoupling unchanged | Re-run `pnpm qa`; read `qa/reports/latest.md`; `qa-report-fidelity` green |

## Data assertions (post-implementation)
- C1 fidelity meta-tests: still GREEN, count unchanged. The
  `pnpm qa` exit-gate logic (`run-qa.mjs`), the verdict state
  machine (`qa-report.mjs decide()`), and the DB-lane read-only
  treatment are **byte-for-byte unchanged** (CI calls them; it
  does not modify them).
- `pnpm qa` baseline: 66 specs GREEN, gate 0, STATE=GREEN —
  identical before and after (this contract adds enforcement
  *around* the gate, never alters the gate).
- `pnpm qa:db`: still a separate decoupled lane; CI `qa-db`
  job's failure never changes the required-check status.
- `governance-check.mjs` is the ONLY new logic that can fail a
  build; its rule set is documented in GOVERNANCE.md and is
  deterministic (same tree → same verdict).

## Hard expectations
- The CI `qa` job proves WORKFLOW success (it runs `pnpm qa`),
  not compilation. A passing CI with a weakened/skipped gate is
  a contract failure (no-fake-green extends to CI).
- The DB lane decoupling is preserved exactly — CI must not be
  the place the lane silently becomes blocking or merged.
- Every governance rule that GOVERNANCE.md calls
  MANDATORY-ENFORCED must have a corresponding executable check
  in `governance-check.mjs` or the `pnpm qa`/branch-protection
  layer — no rule is tagged "enforced" if only prose enforces
  it (the charter must not lie about its own teeth).
- Operator-only steps are never executed by the agent; they are
  documented for the founder.
- Deploy-inert: zero `backend/src`/migration/runtime change;
  confirm `git diff --stat` touches only
  `.github/`, `qa/`, `GOVERNANCE.md`, `Packages/brand-web`
  lockfile, root `package.json` metadata, `features/`.

## Visual evidence required
- None (no UI). Evidence is textual + CI:
  - `governance-check.mjs` pass and fail console captures
    (placed in `04-preview/` as the pre-impl mock, then real
    output recorded in `lock.json` at Step 7).
  - A CI workflow run URL/log summary (or a documented dry-run
    if branch protection / PR is deferred to Mode B) showing
    `governance` + `qa` results and `qa-db` non-blocking.
  - `qa/reports/latest.md` re-run showing unchanged 66 GREEN.

## Implemented by (after lock)
- `GOVERNANCE.md`; `qa/scripts/governance-check.mjs`;
  `qa/hooks/pre-push` + `hooks:install`; `.github/workflows/
  qa.yml`; brand-web lockfile + root pin; result + the chosen
  Mode (A/B) + exact branch-protection settings recorded in
  `lock.json`; re-run `pnpm qa` for the no-regression proof.
