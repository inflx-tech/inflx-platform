# INFLX — AI-Governed Software-Engineering Operating System

> **This file is the canonical charter.** It is committed, versioned,
> and authoritative. `CLAUDE.md` is the lean always-loaded entry point
> and points here; it does not duplicate this. Auto-memory mirrors the
> rules for cross-session recall but this repo file wins on conflict.
>
> Status legend for every rule below:
> **[ENFORCED]** an executable check fails the build/push if violated ·
> **[RECOMMENDED]** discipline only, not yet machine-checked ·
> **[OPERATOR-ONLY]** a human action code cannot perform.
>
> A rule may be tagged **[ENFORCED]** only if a real check backs it
> (`qa/scripts/governance-check.mjs`, the `pnpm qa`/C1 machinery, or
> GitHub branch protection). The charter must never claim teeth it
> does not have.

---

## 0. Purpose

This repository is run as an operating system for software engineering,
not as an app with tests bolted on. The application is its first
workload. The defining principle:

> Discipline that lives only in an operator's head or a chat context is
> a single point of failure. It does not survive a context reset, a new
> window, a new operator, or a second agent. **Any governance rule that
> is not executable and in-repo effectively does not exist.**

The mission is the progressive conversion of process *convention* into
process *enforcement*, lowest-cost/highest-leverage first, so the system
runs with less human-in-the-loop while becoming **more** safe, not less.

---

## 1. Repo execution lifecycle (the 14-step spine)

Every unit of work is a **contract** in `features/<slug>/`:

```
01-spec.md  02-workflow.md  03-expected-outputs.md
04-preview/ 05-impact.md    lock.json
```

Lifecycle: **spec → workflow → mock/screens → Step-5 LOCK → impact →
implement → preview → Playwright/API/DB verification → fix → retest →
Step-14 RELEASE**.

- **[ENFORCED]** Code under governed paths requires an approved contract
  (`governance-check.mjs`).
- **[RECOMMENDED]** Never code directly from discussion; the contract is
  written and agreed before implementation.
- `features/_TEMPLATE/` is the scaffold. `features/brand-web-auth/` is a
  worked example.

---

## 2. System A — Feature pipeline

`spec → workflow → mock/screens → lock → impact → implementation →
preview deploy → Playwright functional test → fix → retest → release`

- Success = the workflow **executes to its expected end state**, proven
  by QA. "It compiled" is never success. **[ENFORCED]** via `pnpm qa`.
- Every release explicitly classified **deploy-inert** vs
  **production-impacting** (§7). **[RECOMMENDED]** (gov-check checks
  release-evidence presence; the classification judgement is human/AI).
- Production-impacting release requires explicit approval.
  **[OPERATOR-ONLY]** + **[RECOMMENDED]**.

## 3. System B — Reliability / governance pipeline

`flow inventory → edge-case inventory → business-rule classification →
test matrix → Playwright/API/DB verification → evidence logging →
failure classification → fix → regression verification → release gate`

Testing is **systematic discovery and verification of business
behaviour**, not "running tests". Before verifying, classify the surface:
happy paths · edge cases · auth/permission · money paths · failure paths
· deployment-sensitive paths → build the matrix → then execute.

---

## 4. Step-5 LOCK semantics

- The lock (`lock.json.approved=true`, `status:"locked"`,
  `approved_by`, `approved_at`) is the gate between design and code.
- **[ENFORCED]** No governed-path code without an approved contract.
- **[RECOMMENDED]** No implementation before the lock. The founder may
  delegate the lock decision; the *existence* of the approved contract
  is still enforced.
- The agent never fabricates approval. `approved_by` records who/how.

### 4a. Mockup-lock  **[ENFORCED]**

Phase 2 sub-contract 1 (`features/preview-machinery/`) introduced
a second human gate **between spec-lock and code** for UI-touching
contracts. Phase 2 sub-contract 5 (`features/enforce-cycle-gates/`)
promoted this to ENFORCED in `governance-check.mjs` (Rule 3):

- Author HTML mockups in `features/<slug>/04-preview/mockups/*.html`
  and a sibling `04-preview/workflow-prediction.md`.
- `pnpm preview:open <slug>` renders both in the default browser
  for review (worked example: `features/_demo-preview/`).
- On approval, set in `lock.json`:
  - `mockup_locked: true`
  - `mockup_locked_by: "<who/how>"`
  - `mockup_locked_at: "<YYYY-MM-DD>"`
- **[ENFORCED]** for any commit touching
  `Packages/*/(src|app|components|lib|screens|services)/`
  ("UI-governed"). gov-check Rule 3 BLOCKS the push if the backing
  approved+complete contract does not have all three
  `mockup_locked*` fields set. `GOVERNANCE_OVERRIDE="reason"`
  bypasses with a loud, recorded notice.
- The fields are forward-compatible — they may be absent from
  contracts whose work does not touch UI (backend-only, infra,
  test-debt, governance, showcase contracts). Backend-only commits
  only have to satisfy Rule 1 (approved contract) + Rule 2 (release
  evidence).

### 4b. Before/after-diff  **[ENFORCED]**

Phase 2 sub-contract 2 (`features/before-after-diff/`) added the
**final visual gate before the production deploy** for UI-touching
contracts. Sub-contract 5 promoted the presence of
`06-diff/notes.md` to ENFORCED in gov-check (Rule 4):

- After implementation, `pnpm diff:before <slug>` renders the locked
  mockups to PNGs in `qa/artifacts/diff/<slug>/before/`.
- For each mockup with a sibling
  `04-preview/mockups/<name>.capture.json` (declares `url` +
  `viewport` + optional `wait_for_selector`),
  `pnpm diff:after <slug>` captures the real implementation against
  the local dev stack into `qa/artifacts/diff/<slug>/after/`.
- For mobile mockups with a sibling `<name>.maestro-flow.json`
  (`{flow, screenshot}`), `diff:after` copies the named screenshot
  from the latest `qa/artifacts/qa-maestro/<ts>/` run.
- Agent authors `features/<slug>/06-diff/notes.md` — plain-English
  notes on what shipped, what matches the mockup, what (honestly)
  diverged and why.
- `pnpm diff:open <slug>` builds + opens the side-by-side review
  page (worked example: `features/_demo-preview/06-diff/`).
- **[ENFORCED]** for UI-governed changes (same trigger as Rule 3).
  gov-check Rule 4 BLOCKS the push if
  `features/<slug>/06-diff/notes.md` is absent or empty in the
  backing contract. Override mechanism identical to Rule 3.
- The `06-diff/` folder is forward-compatible — backend-only,
  infra, test-debt, and showcase contracts may legitimately omit it.

## 5. Step-14 RELEASE semantics

- Every release states: **what deploys, where it deploys, rollback
  implications, affected systems, regression risk**. **[RECOMMENDED]**.
- **deploy-inert** releases: commit/push freely (no prod surface).
- **production-impacting** releases: surfaced explicitly, never silent;
  explicit go/no-go required. **[OPERATOR-ONLY]**.
- **[ENFORCED]** A change that flips `release.released=true` must carry a
  populated, self-consistent `lock.json` release/QA-evidence block
  (`governance-check.mjs`) — because QA reports are git-ignored, the
  lock.json transcription IS the durable evidence.

---

## 6. Failure taxonomy & classification (System B core)

Tests are **never auto-trusted**. Every failure is classified:

1. **stale fixture/setup** — fix the fixture.
2. **business-rule drift** — the rule changed; align the test to truth.
3. **genuine backend defect** — carve `features/backend-defect-<slug>/`,
   leave the catching test **RED**, fix the backend in its own
   contract. Never patch the test to hide a real bug.
4. **assertion drift** — the assertion is wrong/weak; correct it.

**[RECOMMENDED]** (classification is judgement). The *carve stays RED
until backend-fixed* discipline is mandatory.

## 7. deploy-inert vs production-impacting

- **deploy-inert**: tests, QA harness, `features/**`, docs, CI config,
  dev tooling, devDeps, scripts not loaded by the running server,
  metadata. `git push` does **not** change production behaviour.
- **production-impacting**: anything `git push` makes Render (backend),
  Vercel (web), or an OTA bundle serve differently — `backend/src/**`,
  migrations, web/mobile runtime, runtime deps.
- The classification is stated on **every** release. Ambiguity →
  treat as production-impacting.

## 8. No-fake-green policy  **[ENFORCED via C1 + CI]**

Forbidden, always: `.skip`, deleting a test, weakening an assertion,
fabricating fixture data, force-passing. Uncertainty must **fail**, not
pass. The C1 verdict state machine + 10 fidelity meta-tests make a
false-GREEN impossible without modifying the reporter (and the
meta-tests guard the reporter). This policy extends to CI: a green CI
obtained by weakening/skipping the gate is an explicit FAILURE.

## 9. Verify-twice principle  **[RECOMMENDED]**

Before any root-cause or "X exists" claim: read the actual
controller/route/migration/schema. A real stack trace overrides any
hypothesis. (This refuted three "candidate" defect hypotheses in the
city-column audit — discipline paid.)

## 10. Regression policy  **[ENFORCED via CI `qa` job]**

Every backend/runtime change: rerun main `pnpm qa`, confirm C1/gate
integrity, verify zero regression. The DB lane (`pnpm qa:db`) is a
**separate, decoupled, informational** lane — it never merges into the
main GREEN and never blocks it. It stays informational until **formally
promoted** by its own contract.

> **qa:db host-ceiling discipline (`features/qa-db-env-resilience`,
> shipped-partial 2026-05-22):** on the founder's Windows + Docker +
> WSL2 box, `pnpm qa:db` passes cleanly **once per fresh boot** but
> saturates on a second consecutive run (tests time out at the
> socket/scheduling layer — not INFLX defects, not pool exhaustion;
> proven by zero pool-`error` diagnostic events). Application/test
> tuning cannot raise this ceiling. **Operational rule:** before a
> release needing qa:db evidence, restart Windows, run qa:db once,
> capture the GREEN. This is host hygiene, not a code gate.

The Maestro mobile lane (`pnpm qa:maestro`, Phase 2 sub-contract 3)
follows the same pattern: separate, decoupled, **[ENFORCED]** for
any commit touching `Packages/Mobile/src/**` that flips
`release.released = true`. gov-check Rule 5 (Phase 2 sub-contract 5)
BLOCKS the push if the backing contract's `release.maestro_green`
is not `=== true`. The attestation is opt-in by explicit
declaration — silent omission is treated as not-green. WIP commits
with `released=false` are allowed to touch Mobile freely; the
attestation is required only at the release-flip moment. Maestro
requires Maestro CLI + ADB + a connected device/emulator + the app
flavor installed — all founder-side; `pnpm qa:maestro:doctor` reports
red with install instructions when prerequisites are missing.
`GOVERNANCE_OVERRIDE="reason"` bypasses with a loud, recorded notice.

---

## 11. The three enforcement layers (separation of powers)

| Layer | Mechanism | Strength |
|---|---|---|
| **Local** | `qa/hooks/pre-push` → `governance-check.mjs` (`pnpm run hooks:install`) | Advisory, loud, `--no-verify`-bypassable **by design** — a fast aid, not the gate. Overrides via `GOVERNANCE_OVERRIDE="reason"` (printed, never silent). |
| **CI** | `.github/workflows/qa.yml`: `governance` + `qa` + `qa-db`(informational) | The real gate. Hard-enforcing **once** branch protection makes the checks required. |
| **Operator-only** | GitHub branch-protection settings (§13) | The B→A switch. Founder-only. No code change needed to flip. |

`qa/scripts/governance-check.mjs` is the single reusable validator
shared by Local and CI (one source of truth for future hooks/gates).

---

## 12. Enforcement modes

- **Mode B (current): advisory-on-push.** CI runs on push to `main`,
  reports honestly, does **not** block. Cadence unchanged. Governance
  still bypassable (push anyway). A transition state only.
- **Mode A (target): full enforcement.** PR-to-`main`; `governance` +
  `qa` are required checks; no bypass. Reached when the founder applies
  §13 — **no code change required to flip**.

## 13. Operator-only — GitHub branch protection  **[OPERATOR-ONLY]**

Apply on GitHub → Settings → Branches → protect `main`:

```
☑ Require a pull request before merging
☑ Require status checks to pass:  governance , qa
☑ Require branches to be up to date before merging
☑ Do not allow bypassing the above settings
☑ Block force pushes
☐ (optional) Require linear history
```

Until applied, the system is Mode B. Code cannot do this step.

---

## 14. OS phase roadmap

| Phase | Name | Posture | State |
|---|---|---|---|
| P0 | Pipeline foundation (System A/B, QA gate, C1, DB lane, contracts, memory) | inert | DONE |
| P1 | Governance enforcement substrate + this charter + CLAUDE.md rewrite | deploy-inert | ACTIVE |
| P2 | Reliability deepening — backend-test-debt Phase 4 (192 residual) | mostly inert | next |
| P3 | QA reporting usability (grouped failures, contract rollups, regression visibility, DB lane in main report) | inert | queued |
| P4 | Environment governance (dev/staging/prod, promotion rules, rollback governance) | prod-impacting | gated |
| P5 | Observability (structured logging, workflow tracing, failure/cron/financial alerts, runtime diagnostics) | prod-impacting | gated |
| P6 | Mobile E2E / Maestro (mobile flow inventory, regression governance, OTA safety) | mixed | gated |
| P7 | Multi-agent governance (coding / testing / release-review / production-monitoring agents on the enforced substrate) | mixed | last |

Each phase is one or more contracts through the full pipeline.
Production-impacting phases (P4–P6) each hit their explicit release
gate; they are never executed silently.

---

## 15. How new feature work executes (the standing flow)

From now, every new feature/stabilization request follows:

1. Draft the contract (Steps 1–6) — spec, workflow, expected outputs,
   preview, impact.
2. Step-5 lock (founder-delegated decision; contract existence
   **[ENFORCED]**).
3. Implement only after lock.
4. Verify with evidence (`pnpm qa`; DB lane informational).
5. Classify any failure honestly (§6); carve genuine defects RED.
6. Step-14 release — state deploy-inert vs production-impacting;
   production-impacting gets explicit approval and is never silent.
7. Record results into repo artifacts (`lock.json`, `04-preview/`,
   ledgers). Re-run `pnpm qa` for the zero-regression proof.

The machine runs and gates; intelligence builds and judges. Automation
covers the toil and the safety, never the decision of what to build or
what reaches production.
