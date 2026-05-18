# INFLX QA & Contract-Driven Workflow Foundation

**Principle:** a feature is *done* when its **workflow executes to the
expected end state** — never when it merely compiles.

This folder is the testing/automation spine for the 14-step
contract-driven workflow. Mobile device E2E is a deferred phase (see
"Limitations").

---

## The 14 steps → where they live

| # | Step | Lives in |
|---|---|---|
| 1 | Feature discussion | conversation |
| 2 | Structured spec | `features/<slug>/01-spec.md` |
| 3 | Workflow + expected outputs | `features/<slug>/02-workflow.md`, `03-expected-outputs.md` |
| 4 | Mock UI preview | `features/<slug>/04-preview/` |
| 5 | **Approval & lock (human)** | `features/<slug>/lock.json` → `approved:true` |
| 6 | Impact analysis (pre-code) | `features/<slug>/05-impact.md` |
| 7 | Implementation | app code |
| 8 | Migrate / deploy / OTA | existing cadence (migrate→commit→push→OTA) |
| 9 | Before/after screenshots | `qa/artifacts/screenshots/{before,after}/` |
| 10 | Functional workflow testing | `pnpm qa` (Playwright L1+L2, jest L3) |
| 11 | Error reporting | `qa/reports/<ts>/QA-REPORT.md` |
| 12 | Debug & recode | bounded auto-fix loop (see policy) |
| 13 | Retest | `pnpm qa` again |
| 14 | **Release approval (human)** | `lock.json` → `release.released:true` |

Steps 5 and 14 are **human gates**. The agent never self-approves them.

---

## Layered test model

| Layer | What | Tooling | Status |
|---|---|---|---|
| L0 | Contract (spec/workflow/expected/preview/impact) | markdown/json in `features/` | ✅ |
| L1 | API / contract workflows | Playwright `request` / `e2e-smoke.js` / backend jest+supertest | scaffolded (`qa/api/`) |
| L2 | Web E2E (brand-web 3002, admin-web 3003) | Playwright (`qa/web/`) | ✅ first workflow live |
| L3 | Mobile component-flow | jest + RTL (`Packages/Mobile/.../__tests__`) | ✅ 11/11 |
| L4 | Mobile device E2E + on-device OTA | Maestro + Android emulator | ⏸ deferred phase |

---

## Run it

```bash
pnpm qa            # run all workflow tests + generate the QA report
pnpm qa:web        # Playwright only (L1+L2)
pnpm qa:report     # regenerate report from last results
pnpm qa:html       # open the Playwright HTML report
pnpm qa:mobile     # L3 mobile component-flow (jest in Packages/Mobile)
```

`pnpm qa` exits non-zero if any workflow fails — that exit code is the
release gate signal, not "build succeeded".

---

## Playwright MCP

`.mcp.json` (repo root) registers the Microsoft Playwright MCP server.
It is **project-scoped**: Claude Code prompts to trust it on next
start (`/mcp` to inspect). Use it for interactive exploration, selector
discovery, and debugging failed specs. Authored `@playwright/test`
specs remain the deterministic CI gate; the MCP is the agent's hands
for *building and diagnosing* them.

---

## Limitations (known, by design)

- **Playwright cannot drive the React Native app.** Vanilla RN 0.73,
  no react-native-web. Mobile functional coverage is L3 (jest+RTL,
  component-level, mocked API). True on-device mobile + OTA E2E needs
  L4 (Maestro + emulator) — deferred to its own contract/phase.
- **Video is OFF.** The Playwright FFmpeg CDN is blocked in this
  environment. QA evidence = screenshots + traces (better for the
  report anyway). Re-enable `video` in `playwright.config.ts` if
  FFmpeg becomes installable.
- **No CI yet** (chosen: local-first). `.github/workflows/qa.yml` is a
  follow-up once the suite is stable; it will need repo secrets
  (never committed).

---

## Flagged — needs its own contract (DO NOT bundle into QA work)

**pnpm-workspace path-casing bug.** `pnpm-workspace.yaml` globs
`packages/*` but the directories are `Packages/*` (capital P). Result:
pnpm only discovers `inflx` (root) + `inflx-backend`. The web apps
(`Packages/brand-web`, `admin-web`) and `Packages/Mobile` are **not**
workspace-managed — their `node_modules` are installed independently
(brand-web/admin-web npm-ish, Mobile npm). Implications:

- `pnpm install` at root does **not** install web/mobile app deps.
- `pnpm --filter @inflx/<app>` resolves nothing — never use it for
  app start (QA config starts brand-web by direct `cwd` instead).

This is intentionally left as-is. The fix (one line in
`pnpm-workspace.yaml`) has workspace/lockfile/Vercel blast radius and
must go through its own spec → impact → lock → validate cycle.

## Bounded auto-fix loop policy (steps 12–13)

When `QA-REPORT.md` shows failed workflows, the agent may iterate:
read failure → patch → rerun `pnpm qa`. Guardrails:

- **Max 3 auto-fix iterations** per workflow, then stop and report.
- Never edits a spec to make a failing workflow "pass" — fix the code
  or flag the contract as wrong.
- Never touches steps 5 or 14 (human gates).
- Destructive/irreversible changes still require explicit confirmation.
