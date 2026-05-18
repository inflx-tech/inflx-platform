# Impact Analysis — governance-enforcement-ci

> Step 5/6. Generated BEFORE implementation, grounded in
> verify-twice repo reads (run-qa.mjs, playwright.config.ts,
> db-up.mjs, qa/.gitignore, root package.json, qa/README.md).
> Reviewed against the lock.

## ⚠️ Deploy posture — DEPLOY-INERT (with one operator-only action)
- Edits **no** `backend/src`, **no** migrations, **no** runtime
  code. New artifacts only: `.github/workflows/qa.yml`,
  `qa/scripts/governance-check.mjs`, `qa/hooks/pre-push` +
  `hooks:install`, `GOVERNANCE.md`, a `Packages/brand-web`
  lockfile, optional root `package.json` `engines`/
  `packageManager` (metadata), this contract folder.
- `git push` does **NOT** trigger Render or Vercel (no
  backend/web source change). Confirm at Step 7 with
  `git diff --stat` (must touch only the paths above).
- The single non-code action is **OPERATOR-ONLY**: the founder
  enabling GitHub branch protection. That is a governance-state
  change, not a deployment. Until applied, CI is advisory
  (Mode B); applied, it is enforcing (Mode A).

## Affected files (read or change)
- **New:** `.github/workflows/qa.yml`,
  `qa/scripts/governance-check.mjs`, `qa/hooks/pre-push`,
  `GOVERNANCE.md`, `Packages/brand-web/<lockfile>`.
- **Metadata edit (deploy-inert):** root `package.json` —
  add `scripts.hooks:install`, and (recommended) `engines`
  + `packageManager` for CI determinism. No dependency change.
- **Read-only (must NOT modify):** `qa/scripts/run-qa.mjs`,
  `qa/scripts/qa-report.mjs`, `qa/playwright.config.ts`,
  `qa/scripts/qa-db.mjs`, the C1 fidelity spec. CI *invokes*
  these unchanged; altering them would regress the one
  code-enforced subsystem.
- **No test files edited.**

## Affected routes / APIs
None. No contract/endpoint/runtime surface.

## Affected workflows (regression surface)
- **The `pnpm qa` gate itself** — highest-value asset; risk =
  accidentally changing its behaviour while wrapping it in CI.
  Mitigation: CI calls `pnpm qa` verbatim with `CI=true` (the
  config already branches on `process.env.CI`:
  `playwright.config.ts:26-28,58`); zero edits to run-qa /
  qa-report / the config. Proof: re-run local `pnpm qa` post-
  implementation → 66 GREEN / STATE=GREEN / gate 0 unchanged;
  `qa-report-fidelity` meta-tests green.
- **DB-lane decoupling** — risk = CI making the lane blocking.
  Mitigation: `qa-db` job is `continue-on-error: true` and NOT
  a required check; it mirrors the local read-only treatment
  (`qa-report.mjs` reads `db-lane.json` informationally). The
  decoupling is a governance invariant; CI must not invert it.
- **Developer/agent cadence** — Mode A adds a PR step to `main`
  (currently direct-push). Real, intentional friction; the
  point of the contract. Surfaced as the lock decision, not
  decided unilaterally.
- Main `pnpm qa` (66) + C1 + B2b substrate otherwise unaffected
  (no harness/backend change).

## Migration / deploy / OTA impact
- No migration. No mobile/OTA. No Render/Vercel deploy.
- CI infra only. `qa-db` needs Docker — available by default on
  GitHub `ubuntu-latest` runners (verify the runner image at
  Step 7; `db-up.mjs:30` already loud-fails if Docker absent).

## Risk notes (honest)
1. **brand-web non-deterministic install.** brand-web is NOT
   pnpm-workspace-managed (known casing bug,
   `project_pnpm_workspace_casing`) and has **no committed
   lockfile** (verified — only root `pnpm-lock.yaml` exists).
   The CI `qa` job must install brand-web deps to boot the Next
   server (`playwright.config.ts:54-60`); without a frozen
   lockfile that install is non-deterministic → flaky/non-
   reproducible gate. Mitigation: generate + commit a brand-web
   lockfile as an in-scope determinism sub-item. If a clean
   lockfile cannot be produced, **STOP and surface** — do not
   ship a non-deterministic gate (that would itself violate
   governance).
2. **First-run CI flakiness** (Playwright browser download,
   Next dev server ≤180s boot, 2 CI workers). Config already
   sets `retries:1` under CI. Mitigation: dependency/browser
   caching, generous timeouts; if still flaky, fix the workflow
   — **never weaken `pnpm qa`** to make CI green.
3. **governance-check false positives** (legit docs-only or
   not-mine changes). Mitigation: governed-path scoping +
   deploy-inert allowlist (`features/**`, `qa/**` meta, docs,
   the known not-mine untracked) + recorded
   `GOVERNANCE_OVERRIDE` (loud, reasoned, never silent). Tune
   the rule; never disable the check.
4. **Charter honesty risk.** GOVERNANCE.md must not tag a rule
   MANDATORY-ENFORCED unless an executable check backs it.
   Mitigation: a self-audit step — every MANDATORY-ENFORCED
   line maps to gov-check / C1 / branch-protection; otherwise
   it is RECOMMENDED.
5. **Mode B is strictly weaker.** If the founder picks Mode B
   (advisory-on-push) to preserve cadence, governance remains
   bypassable (push anyway). Acceptable only as a time-boxed
   transition to Mode A; GOVERNANCE.md must state this plainly.
6. **Operator dependency.** Real enforcement requires the
   founder to apply branch protection. The contract cannot
   close that gap itself; it documents it precisely and marks
   it OPERATOR-ONLY.

## Why this contract first (sequencing rationale)
This is the substrate for roadmap #1–#8: once the gate is
machine-triggered and contracts are machine-checked, Phase-4
stabilization and every later effort become structurally safe
instead of discipline-dependent. Cost is one deploy-inert
contract + one operator action; value is converting ~70% of
Tier-B process into Tier-A enforcement.
