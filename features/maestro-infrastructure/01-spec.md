# Spec — maestro-infrastructure (Phase 2 sub-contract 3 of 5)

## Problem

Today, mobile has **zero end-to-end coverage**. The 66-spec
`pnpm qa` is Playwright-on-web only. The 382-test `pnpm qa:db` is
backend jest only. INFLX ships three Android apps from one RN
codebase (`in.inflx.app.{brand,influencer,follower}`) — every JS
change ships via OTA → opens-and-closes-twice on the founder's
phone — with no automated mobile gate between "code shipped" and
"users see it."

The founder's stated cycle calls this out explicitly: "verify both
web (Playwright) AND mobile (Maestro) that it correctly passes the
golden path + edge cases + no regressions." Phase 2 sub-contracts
3+4 close that gap.

## Goal (this sub-contract)

Stand up the **Maestro infrastructure** so that a future contract
can write a YAML flow and run `pnpm qa:maestro` to execute it against
a connected device or emulator. Deliverables:

- `qa/maestro/` directory with one starter smoke flow that just
  launches the follower app + takes a screenshot. (Real golden-path
  flows land in sub-contract 4.)
- `qa/scripts/qa-maestro.mjs` orchestrator — discovers all
  `qa/maestro/flows/*.yaml`, runs each via the `maestro test` CLI,
  collects exit codes + screenshots into
  `qa/artifacts/qa-maestro/<timestamp>/`, prints a summary, exits
  non-zero on any failure.
- `qa/scripts/maestro-doctor.mjs` — verifies the Maestro CLI is on
  PATH, `adb` is available, at least one device/emulator is
  connected. Loud-fail with install instructions if not.
- Root `pnpm` scripts: `qa:maestro`, `qa:maestro:doctor`.
- `LOCAL.md` updated with a "Mobile dev with Maestro" section
  covering Maestro install (Windows: PowerShell one-liner; macOS:
  homebrew), Android emulator setup OR USB-debug device, app
  install (`pnpm dev:android` for the appropriate flavor), and
  the run sequence.
- Optional informational check in the existing `pnpm dev:doctor`
  noting whether Maestro is installed (does not gate; just
  surfaces).

## Non-goals (explicit scoping)

- **The Mobile `api.js` env-driven flip** — required for Maestro
  tests to actually hit the local backend (currently
  `USE_PRODUCTION = true` overrides everything). That change is a
  GOVERNED-PATH change (touches `Packages/Mobile/src/config/api.js`,
  which is `Packages/*/(src|...)` per gov-check) and is therefore
  PRODUCTION-IMPACTING (ships via OTA). It will be paired with
  sub-contract 4's first real Maestro flow, where the change has
  immediate purpose. Sub-contract 3 stays cleanly DEPLOY-INERT.
- **gov-check ENFORCEMENT** of Maestro green for UI-touching
  releases — sub-contract 5.
- **Actually running the smoke flow as part of THIS contract's
  release verification** — Maestro requires (a) the CLI installed,
  (b) ADB + a device or emulator, (c) the app installed and able
  to launch. None of those are available on the agent's side; all
  three are founder-side. This sub-contract therefore ships the
  infrastructure ready-to-run; the founder runs `pnpm qa:maestro`
  himself after the doctor reports green. (The doctor's loud-fail
  on missing Maestro IS the proof that the failure path works,
  same demonstration pattern as `dev-doctor`.)
- **iOS support** — not shipping iOS yet (per CLAUDE.md). Maestro
  supports iOS but it's out of scope for this sub-contract.
- **CI integration** of Maestro — running Maestro on GitHub Actions
  needs an emulator runner; deferred until staging exists.

## Constraints

- **DEPLOY-INERT.** Only adds root `package.json` scripts,
  `qa/scripts/*.mjs`, `qa/maestro/` directory, `LOCAL.md`
  addition, and small CLAUDE.md / GOVERNANCE.md addenda. No
  governed-path touched in this sub-contract.
- **App IDs:** the three flavors are `in.inflx.app.brand`,
  `in.inflx.app.influencer`, `in.inflx.app.follower`. The smoke
  flow targets the **follower** flavor by default (matches the
  Q1 public-browse feature; smallest-friction "does it launch"
  test). Per-flow `appId` makes this overridable.
- **Loud failures** — matches the dev-doctor / preview-machinery /
  diff-machinery pattern. Missing Maestro, missing ADB, no devices,
  app not installed, flow YAML invalid, flow execution failed —
  all produce clear actionable errors. No silent green.
- **Maestro output** → `qa/artifacts/qa-maestro/<timestamp>/` which
  is gitignored under `qa/artifacts/*` — regenerable; never
  pollutes commits.
- **Flow YAML files are committed** under `qa/maestro/flows/` —
  they're the durable test definitions, parallel to Playwright
  specs under `qa/web/`.
