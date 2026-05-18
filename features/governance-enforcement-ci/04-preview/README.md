# Mock / Preview (Step 4) — governance-enforcement-ci

No UI. The "preview" is the shape of the artifacts the reviewer
agrees to at the Step-5 lock, plus what the founder must do
manually.

## Reviewer confirms at the Step-5 lock
- **DEPLOY-INERT.** Only `.github/`, `qa/`, `GOVERNANCE.md`,
  `Packages/brand-web` lockfile, root `package.json` metadata,
  and this contract change. No `backend/src`, no migrations, no
  runtime behaviour, no Render/Vercel deploy.
- The CI `qa` job runs the **existing** `pnpm qa` unchanged —
  this contract adds enforcement *around* the gate, never edits
  the gate, the C1 state machine, or the DB-lane decoupling.
- `qa-db` is informational/non-blocking in CI exactly as it is
  decoupled locally — C1/gate must not regress.
- **Mode decision required (A vs B)** — see §lock question:
  full PR-enforced `main` vs advisory-on-push transition.
- Operator-only branch protection is **documented, not applied
  by code** — the founder enables it in GitHub.
- A CI green obtained by weakening/skipping the gate is a
  contract FAILURE (no-fake-green extends to CI).

## Mock A — `governance-check.mjs` behaviour (target)
```
$ node qa/scripts/governance-check.mjs
[gov-check] scanning changed paths vs origin/main…
[gov-check] governed change: backend/src/services/x.service.js
[gov-check]   ↳ contract: features/x-feature/ lock.json approved=true ✓
[gov-check]   ↳ 01-spec.md ✓  02-workflow.md ✓  05-impact.md ✓
[gov-check] OK — 1 governed change, all contract-backed. exit 0

$ node qa/scripts/governance-check.mjs   # violation
[gov-check] governed change: backend/src/controllers/y.controller.js
[gov-check]   ✗ no features/<slug>/ with lock.json.approved=true
[gov-check] BLOCK — governed change without an approved contract.
            Set GOVERNANCE_OVERRIDE="reason" to override (logged). exit 1
```

## Mock B — `.github/workflows/qa.yml` job graph (target)
```
on: [pull_request → main, push → main]
jobs:
  governance   (fast)         node governance-check.mjs --ci      [required]
  qa           (the gate)     setup node/pnpm → install →
                              pnpm qa  (CI=true)                   [required]
                              ↳ upload results.json + qa report
  qa-db        (informational) docker → pnpm qa:db
                              continue-on-error: true              [NOT required]
                              ↳ upload db-lane.json + db-jest.log
```

## Mock C — `GOVERNANCE.md` table of contents (target)
```
GOVERNANCE.md
 1. Purpose & how this file is enforced (not just prose)
 2. Repo execution lifecycle (Steps 1–14 overview)
 3. System A — feature pipeline
 4. System B — reliability/governance pipeline
 5. Step-5 lock semantics      [MANDATORY-ENFORCED via gov-check]
 6. Step-14 release semantics  [MANDATORY-ENFORCED via gov-check]
 7. deploy-inert vs production-impacting (definitions + rule)
 8. Release classification rules
 9. Failure taxonomy + classification rules
10. No-fake-green policy       [MANDATORY-ENFORCED via C1 + CI]
11. Verify-twice principle     [RECOMMENDED / discipline]
12. Regression policy (rerun pnpm qa, C1/gate, zero-regress)
13. The three enforcement layers (L / C / M) — what each guarantees
14. Operator-only actions (branch protection settings)  [OPERATOR-ONLY]
15. Future roadmap direction (#1–#8)
Every rule tagged: MANDATORY-ENFORCED | RECOMMENDED | OPERATOR-ONLY
```

## Mock D — operator-only GitHub branch protection (founder applies)
```
Settings → Branches → Protect `main`:
 ☑ Require a pull request before merging
 ☑ Require status checks to pass:  governance , qa
 ☑ Require branches up to date before merging
 ☑ Do not allow bypassing the above settings
 ☐ (optional) Require linear history
 ☑ Block force pushes
NOTE: This is the ONLY step code cannot do. Without it, CI is
advisory (Mode B). With it, governance is enforced (Mode A).
```

## Step 7 — RESULTS (2026-05-18)

**Mode chosen:** PHASED (build for A, run B now). CI is
advisory-on-push until the founder applies §13 branch
protection (no code change to flip B→A).

**gov-check self-test** (isolated git worktree; asserted on the
verdict *message*, not the exit code, to rule out coincidental
exits — first attempt was correctly DISCARDED as invalid because
`git worktree` omits untracked files, then redone properly):
```
T1 governed change, no contract     → "BLOCK — governed change
                                       without an approved
                                       contract"           exit 1 ✓
T2 same + GOVERNANCE_OVERRIDE       → "OVERRIDE ACTIVE …
                                       recorded, NOT silent" exit 0 ✓
T3 governed + approved contract     → "backed by approved
   touched                            contract(s):
                                       backend-city-audit"  exit 0 ✓
```
Local hook installed: `.git/hooks/pre-push` (exec bit set).

**Zero-regression proof (fresh):** `qa/reports/latest.md`
@2026-05-18T20:05 — ✅ ALL WORKFLOWS PASSED, 66 · passed 66 ·
failed 0, STATE=GREEN, `run-qa … gate 0` (pwExit=0 reportExit=0).
DB lane FAIL = the by-design decoupled informational lane (not a
regression). C1 machinery byte-for-byte unchanged (CI runs
`pnpm qa` verbatim).

**Verify-twice correction (transparent):** impact risk #1
(“brand-web has no committed lockfile”) is **refuted** —
`Packages/brand-web/package-lock.json` is already tracked &
committed (152 deps); `npm install --package-lock-only` was a
no-op. The earlier “no lockfile” read was a quoting glitch in a
combined `ls`; corrected on the record, not hidden.

**Deploy posture:** DEPLOY-INERT — only `CLAUDE.md`,
`package.json` (metadata), `.github/**`, `GOVERNANCE.md`,
`features/governance-enforcement-ci/**`, `qa/hooks/**`,
`qa/scripts/governance-check.mjs`, `qa/scripts/install-hooks.mjs`.
No backend/runtime change → no Render/Vercel deploy. Not-mine
untracked files deliberately not staged.

**Operator-only remaining (founder, Mock D / §13):** apply
GitHub branch protection on `main` to switch Mode B → A.
