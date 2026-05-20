# Preview (Step 4) — maestro-infrastructure

Meta note: tooling contract, no UI. The deliverable is two new
`pnpm qa:maestro*` commands + a `qa/maestro/` test home.

## Reviewer note (Step-5 lock)

- **DEPLOY-INERT.** No Mobile source touched. The Mobile `api.js`
  USE_PRODUCTION flip pairs with sub-contract 4's first real flow
  (where it has immediate purpose).
- **Advisory.** gov-check unchanged; sub-contract 5 enforces.
- **Loud failures throughout.** Same design philosophy as
  `dev-doctor` and `preview-build` — positive checks only, never
  silent green.
- **No flow execution in THIS contract's verification.** Maestro
  itself is founder-side; the doctor's loud-fail on missing Maestro
  IS the proof the failure path works.

## Approval (Step-5)

Self-locked under standing autonomy: deploy-inert, sub-contract
order pre-agreed in earlier turns; founder said "pls continue sub
contract 3" after the Phase-2 walk-through. Founder runs the doctor
+ first Maestro flow himself after installing the CLI and connecting
a device.

## Step 7 — RESULT — GREEN 2026-05-20 (RELEASED)

```
fix       : 2 new qa scripts (qa-maestro.mjs, maestro-doctor.mjs) +
            qa/maestro/{README, config.yaml, flows/00-smoke.yaml} +
            2 root pnpm scripts (qa:maestro, qa:maestro:doctor —
            distinct from existing qa:mobile=jest-unit) + LOCAL.md
            mobile section + dev-doctor informational extension +
            CLAUDE.md lifecycle update + GOVERNANCE.md §10 addendum
demo      : pnpm qa:maestro:doctor ✓ produced expected RED — 2 ✗
            (maestro missing, no device) + 1 ✓ (adb IS on PATH —
            founder's Platform Tools already present, surfaced
            honestly) + 1 (deferred). Exit 1 with specific install
            commands per check.
            pnpm qa:maestro ✓ correctly chained doctor-first, saw
            RED, exited with named failure. No silent green.
mobile    : NOT touched in this sub-contract (Packages/Mobile/src/
            USE_PRODUCTION flip pairs with sub-contract 4)
regression: main pnpm qa GREEN (66/C1/gate 0, 04:02:10Z) +
            pnpm qa:db GREEN (382/382, 04:05:40Z) — ZERO regression
deploy    : DEPLOY-INERT (no governed paths; gov-check rule-1 n/a;
            rule-2 satisfied via this lock.json release evidence)
```
