# qa/maestro/ — INFLX Mobile E2E test lane

Maestro flow definitions for the three Android variants
(`in.inflx.app.brand`, `in.inflx.app.influencer`,
`in.inflx.app.follower`). Runs against a connected Android device or
emulator via ADB.

Contract: `features/maestro-infrastructure/`.

## Structure

```
qa/maestro/
├── README.md           this file
├── config.yaml         lane conventions (NOT a Maestro config; just metadata)
└── flows/
    ├── 00-smoke.yaml   minimal launch + screenshot smoke test
    └── …               real golden-path flows land via sub-contract 4 onwards
```

## Commands (from repo root)

```bash
pnpm qa:maestro:doctor    # verify Maestro CLI + ADB + device + app readiness
pnpm qa:maestro           # run all qa/maestro/flows/*.yaml; exit 0 only if all pass
```

## Adding a new flow

1. Create `qa/maestro/flows/NN-<name>.yaml` (numeric prefix for sort
   order; e.g. `01-follower-public-browse.yaml`).
2. Set `appId:` at the top — one of `in.inflx.app.brand`,
   `in.inflx.app.influencer`, `in.inflx.app.follower`.
3. Add Maestro steps (`- launchApp:`, `- tapOn:`, `- assertVisible:`,
   `- takeScreenshot:`, etc. — see [Maestro
   docs](https://maestro.mobile.dev/api-reference/commands)).
4. Tie the flow to a feature contract by referencing it from
   `features/<slug>/06-diff/notes.md` so the diff page links it
   alongside the visual diff.

## Output

`qa/artifacts/qa-maestro/<timestamp>/<flow-name>/` (gitignored)
contains per-flow `maestro.log` + any `takeScreenshot:`-produced
`*.png`. Regenerable on every run.

## Conventions

- **Numeric prefix** for sort order (`00-smoke`, `01-onboard`,
  `02-checkout`, …).
- **One concern per flow**. If a flow grows past ~20 steps, split.
- **Use `clearState: true`** in `launchApp` for tests that must
  start from a fresh app state.
- **Take a screenshot at the end** so failure mode is debuggable
  even when the flow technically passes (helps with visual diff
  against the locked mockup).
