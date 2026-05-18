# Feature Spec — governance-enforcement-ci

> Status: **DRAFT** (Steps 1–6). Implementation GATED on
> `lock.json.approved = true`. Roadmap #4 (CI hardening),
> pulled ahead of #1 per the founder's enforcement-first
> decision (2026-05-18): machine-enforce governance before
> deeper Phase-4 stabilization so future work is structurally
> safe, not context-dependent.
>
> ⚠️ **Deploy posture: DEPLOY-INERT.** New files only:
> `.github/workflows/qa.yml`, `qa/scripts/governance-check.mjs`,
> `qa/hooks/*` + installer, `GOVERNANCE.md`, this contract. NO
> `backend/src`, NO migrations, NO runtime behaviour. The single
> non-code action is **operator-only** GitHub branch-protection
> configuration (a governance-state change, not a deploy).

## Problem / goal
Per the 2026-05-18 governance audit: exactly one subsystem is
code-enforced (the `pnpm qa` exit gate + C1 verdict state
machine + 10 fidelity meta-tests + DB-lane decoupling). Both
System A (feature) and System B (reliability) pipelines, and the
`lock.json` contract, are **Tier-B discipline only** — no code
reads `lock.json`; nothing blocks a contract-less change, an
un-QA'd backend edit, or a missing impact analysis; `main`
takes direct auto-deploying pushes. The strongest asset
(`pnpm qa`) is real but only ever triggered because a human/agent
chooses to run it.

Goal: **convert the discipline into machine enforcement** —
make the existing `pnpm qa` gate run automatically and block
merges, add a governance validator (contract / QA-evidence /
impact-analysis existence) reused by both a local hook and CI,
and commit the operating model itself as `GOVERNANCE.md` so it
survives context resets, new windows, new operators, and future
agents. Preserve the existing QA semantics exactly (CI mirrors
local; the DB lane stays decoupled; C1 must not regress).

Role: engineering governance / all roles (meta-infrastructure).

## Scope
**In scope — three explicitly-separated enforcement layers:**

- **(L) LOCAL enforcement** — a tracked git **pre-push** hook +
  `pnpm run hooks:install` (copies `qa/hooks/pre-push` into
  `.git/hooks`, since `.git/hooks` is not version-controlled).
  Runs `node qa/scripts/governance-check.mjs`. Local layer is
  **loud + a recorded override** (`GOVERNANCE_OVERRIDE="reason"`
  printed and required for exceptions) — NOT a silent or
  unbreakable block (a local hook is `--no-verify`-bypassable by
  nature; CI is the real gate). No silent bypass: an override
  must state a reason and is surfaced.
- **(C) CI enforcement** — `.github/workflows/qa.yml` on
  `pull_request` → `main` and `push` → `main`:
  - `governance` job — `governance-check.mjs --ci`: any change
    under governed paths (`backend/src/**`, `Packages/*/src/**`,
    `backend/migrations/**`) must map to a `features/<slug>/`
    with `lock.json.approved=true` and non-empty `01-spec.md`,
    `02-workflow.md`, `05-impact.md`. Release-marked changes must
    have a populated, self-consistent `lock.json` release/QA
    block. Deploy-inert paths (docs, `features/**`, `qa/**` meta,
    known not-mine untracked) are allowlisted.
  - `qa` job — pinned Node + pnpm → `pnpm install
    --frozen-lockfile` → brand-web deps → Playwright browsers →
    `pnpm qa` (`CI=true`; config already adapts). This is the
    **required status check**.
  - `qa-db` job — informational, `continue-on-error`,
    non-required: Docker (ubuntu) → `pnpm qa:db`; uploads
    `db-lane.json` + `db-jest.log` as workflow artifacts.
    Mirrors the by-design local decoupling — **never blocks the
    gate, never merged into the GREEN** (C1 must not regress).
  - All jobs upload evidence (results.json, qa report,
    db-lane.json) as **workflow artifacts** → durable CI
    evidence without changing gitignore.
- **(M) OPERATOR-ONLY** — GitHub branch protection on `main`
  (UI/API; cannot be code). The contract delivers the EXACT
  settings list; the founder applies them.
- **GOVERNANCE.md** (repo root, committed): the durable charter
  (full content list in §Data/contracts), tagging every rule
  **MANDATORY-ENFORCED / RECOMMENDED / OPERATOR-ONLY**, cross-
  referencing the enforcement scripts so it is not orphaned
  prose.
- **`qa/scripts/governance-check.mjs`** — single reusable
  validator used by BOTH (L) and (C) (DRY).
- Determinism sub-item: pin Node/pnpm (root `package.json`
  `engines` + `packageManager` — metadata, deploy-inert) and
  generate+commit a `Packages/brand-web` lockfile so the CI
  `qa` job's brand-web install is frozen/deterministic.

**Explicitly out of scope:**
- Any `backend/src` / migration / runtime behaviour change.
- Roadmap #1 backend-test-debt Phase 4 (next, after this lands).
- Roadmap #5–#8 (staging/prod envs, observability, Maestro,
  multi-agent) — GOVERNANCE.md *names* them as future direction
  but enforces nothing for them yet.
- Changing the `pnpm qa` gate logic, C1 state machine, or DB-
  lane decoupling (CI MIRRORS them; must not alter or regress).
- Auto-enabling branch protection (operator-only by definition).

## Surfaces touched
- App(s): **none runtime** — repo tooling/CI/docs only.
- Roles: engineering governance.

## Data / contracts
- New/changed tables/columns/migrations: **none**.
- New/changed API endpoints: **none**.
- New files: `.github/workflows/qa.yml`,
  `qa/scripts/governance-check.mjs`, `qa/hooks/pre-push`
  (+ `hooks:install` script in root `package.json` scripts —
  metadata), `GOVERNANCE.md`, `Packages/brand-web` lockfile,
  optional root `package.json` `engines`/`packageManager`
  (metadata only, deploy-inert), this contract folder.
- **GOVERNANCE.md mandatory contents:** System A pipeline;
  System B pipeline; repo execution lifecycle; Step-5 lock
  semantics; Step-14 release semantics; deploy-inert vs
  production-impacting definitions; release classification
  rules; failure taxonomy (stale fixture / business-rule drift
  / genuine backend defect / assertion drift) + classification
  rules; no-fake-green policy (no .skip/deletion/assertion-
  weakening/fabricated-data/force-pass); verify-twice principle;
  regression policy (rerun `pnpm qa`, confirm C1/gate, zero
  regression); QA expectations (main gate + decoupled DB lane);
  contract cadence; enforcement philosophy; the three layers
  (L/C/M) and what each guarantees; future roadmap direction
  (#1–#8). Every item tagged MANDATORY-ENFORCED / RECOMMENDED /
  OPERATOR-ONLY. Human-readable, onboarding-friendly.

## Non-functional
- Auth/role gates: none.
- Must preserve current QA semantics EXACTLY: CI runs the same
  `pnpm qa`; `qa-db` stays informational/decoupled; the C1
  fidelity meta-tests must still pass unchanged (no
  regression to the 66-GREEN / gate-0 / STATE=GREEN baseline).
- Failure modes to handle:
  - First CI run flakiness (Playwright browser fetch, Next dev
    server ≤180s boot) → fix the harness, **never weaken the
    gate to go green** (no-fake-green applies to CI).
  - `governance-check` false positives (legit docs/no-contract
    change) → governed-path allowlist + recorded override; tune
    the rule, do not disable the check.

## Known tension to resolve at the Step-5 lock (honest)
Enforcement-grade CI requires the `qa`/`governance` checks to
be **required on a protected `main`**, which implies a
**PR-to-main** flow. `main` is currently direct-push
auto-deploy. "Machine-enforced governance" and "preserve
current workflow cadence" are therefore partially in tension.
Two viable modes (lock decision):
- **Mode A (full enforcement):** PR required to `main`; `qa` +
  `governance` are required checks. Strongest; small cadence
  change (no more direct pushes to `main`).
- **Mode B (advisory-on-push):** CI also runs on direct pushes
  to `main` and reports red but does not block. Preserves
  cadence exactly; strictly weaker (governance remains
  bypassable by pushing anyway). Recommended only as a
  time-boxed transition to Mode A.
The spec builds the machinery for both; the lock chooses which
is active first.
