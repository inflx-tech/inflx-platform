# Impact analysis — maestro-infrastructure

## What changes

- 2 new scripts in `qa/scripts/`: `qa-maestro.mjs`,
  `maestro-doctor.mjs`
- New `qa/maestro/` directory: `README.md`, `config.yaml`,
  `flows/00-smoke.yaml`
- Root `pnpm` scripts: `qa:maestro`, `qa:maestro:doctor`
- `LOCAL.md` — new "Mobile dev with Maestro" section
- `qa/scripts/dev-doctor.mjs` — small informational Maestro-on-PATH
  check (does not gate dev-doctor's exit code; just surfaces)
- `CLAUDE.md` lifecycle line updated to reflect Maestro is the
  mobile lane
- `GOVERNANCE.md` small addendum noting Maestro alongside Playwright
  in §10 (Regression policy) — both advisory until sub-contract 5

Nothing under `backend/src/`, `backend/migrations/`, or
`Packages/*/(src|app|components|lib|screens|services)/`.
`qa/scripts/dev-doctor.mjs` is in `qa/` (ALLOWLIST). Gov-check
GOVERNED regex matches nothing in this changeset.

## Blast radius

- **Production:** zero. No governed change.
- **Local dev:** new opt-in commands. Existing workflows untouched.
- **Existing contracts:** unaffected.
- **dev-doctor:** gains one new informational line; remains a
  positive-checks-only loud-failure doctor for the local-dev stack.
- **Maestro CLI:** founder-side install; cleanly absent on systems
  without it (loud-fail with install command).

## Reversibility

Purely additive. `git revert` removes all of it. No state.

## Test plan (live, this turn)

The agent's machine does NOT have Maestro CLI / ADB / a device.
The verification is therefore:

1. Syntax-check 2 new `.mjs` scripts via `node --check`.
2. YAML parse-check `qa/maestro/config.yaml` and
   `qa/maestro/flows/00-smoke.yaml` (simple `js-yaml`-free check:
   verify the files are non-empty and have the expected top-level
   keys; Maestro will do the real syntax validation when the
   founder runs it).
3. Run `pnpm qa:maestro:doctor` — **expected RED**: "maestro CLI
   not on PATH" with the install one-liner; "adb not on PATH" with
   the platform-tools URL. Exit 1. This IS the demonstration that
   the doctor's failure path is loud, not silent.
4. Run `pnpm qa:maestro` without Maestro → expected loud fail with
   the doctor-first hint.
5. Run `pnpm dev:doctor` — confirm the new informational Maestro
   line appears, doesn't gate the doctor's overall verdict.
6. `pnpm qa` — 66/C1/gate 0 unchanged.
7. `pnpm qa:db` — 382/382 unchanged.

The founder's verification (post-merge) is `pnpm qa:maestro:doctor`
once Maestro + ADB + a device with the follower app are ready.
Sub-contract 4 will land the first GREEN Maestro flow as the real
proof-of-life.

## Regression risk

- **None on production / main qa / qa:db** — no overlap with
  governed code or qa lanes.
- **dev-doctor compatibility** — the new Maestro check is purely
  additive (informational only; does not flip the doctor's exit
  code). Existing dev-doctor users see one new line and otherwise
  the same behaviour.
- **Maestro absence** is the default state — the orchestrator and
  doctor handle "not installed" loudly, which is the case in CI
  (when CI runs) and on the agent's side.

## Affected systems checklist

- [x] Backend runtime (Render): unaffected
- [x] DB (Supabase): unaffected
- [x] Brand-web / admin-web (Vercel): unaffected
- [x] Mobile (OTA): unaffected (sub-contract 4 will touch
      Packages/Mobile/src/config/api.js with the env-driven flip
      and OTA the result)
- [x] qa:db lane: unaffected
- [x] main pnpm qa: unaffected
- [x] dev:doctor / db:dev:* / preview:* / diff:*: unaffected
      (one new informational line in dev-doctor)
- [x] gov-check: unaffected (sub-contract 5 enforces Maestro green
      for UI-touching releases)
- [x] Existing contracts: validate unchanged (additive)
