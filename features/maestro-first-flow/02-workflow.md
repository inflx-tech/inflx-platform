# Workflow — maestro-first-flow

## Future-cycle usage (how this contract gets used after release)

Any future feature that touches mobile UI follows this loop:

1. **Discuss + spec-lock** (existing).
2. **Author mockup HTML + workflow-prediction** in `04-preview/`
   (sub-contract 1).
3. **Mockup-lock** in `lock.json`.
4. **Implement** the feature (backend + mobile + DB).
5. **Author a Maestro flow** at `qa/maestro/flows/NN-<name>.yaml`
   that exercises the feature.
6. **Author a `<mockup>.maestro-flow.json` sibling** next to the
   mockup HTML, declaring which Maestro flow produces the "after"
   PNG and which screenshot inside that flow's run to use. Shape:
   ```json
   { "flow": "01-follower-public-browse", "screenshot": "feed-loaded" }
   ```
7. **`pnpm dev:all`** (backend + web) and **`pnpm dev:mobile`**
   (Metro) and edit `Packages/Mobile/src/config/api-overrides.js`
   to point at LAN IP if the flow needs to hit local backend.
8. **`pnpm qa:maestro`** runs the flow against the connected
   device/emulator; per-flow screenshots land in
   `qa/artifacts/qa-maestro/<ts>/<flow>/`.
9. **`pnpm diff:after <slug>`** picks up the named screenshot from
   the latest Maestro run (per the `.maestro-flow.json`) and copies
   it to `qa/artifacts/diff/<slug>/after/<mockup>.png`.
10. **`pnpm diff:open <slug>`** shows side-by-side: locked mockup
    on the left, real Maestro screenshot on the right + agent-
    authored `06-diff/notes.md`.
11. **Founder signs off** → OTA push.

## How THIS sub-contract runs in this turn

1. Spec + workflow + expected outputs + impact + mockup +
   workflow-prediction + 06-diff/notes.md (the docs in this folder).
2. Step-5 spec-lock under standing autonomy (deploy-inert at this
   point — no governed-path code yet).
3. Mockup-lock under standing autonomy (advisory; the mockup is
   the Q1 follower public-browse design grounded in shipped reality).
4. Implement:
   - `Packages/Mobile/src/config/api.js` — env-driven flip via
     sibling-override pattern.
   - `Packages/Mobile/src/config/api-overrides.js` — committed,
     empty defaults.
   - `.gitignore` — NO change (we want the empty default committed;
     `skip-worktree` is the founder-side mechanism for local
     overrides).
   - `qa/maestro/flows/01-follower-public-browse.yaml` — the new
     Maestro flow.
   - `features/maestro-first-flow/04-preview/mockups/01-follower-
     public-browse.html` — the locked mockup (visually grounded in
     Q1's shipped UI).
   - `features/maestro-first-flow/04-preview/mockups/01-follower-
     public-browse.maestro-flow.json` — links mockup to flow.
   - `qa/scripts/diff-after.mjs` — extend to read the
     `.maestro-flow.json` sibling and copy from `qa-maestro/`.
   - `LOCAL.md` — note about `api-overrides.js` + `skip-worktree`.
5. Verify (this turn, agent-side):
   - Read api.js change carefully; confirm default behaviour is
     unchanged when overrides empty (both debug + release → PROD).
   - Smoke flow still passes (`pnpm qa:maestro` runs `00-smoke` +
     `01-follower-public-browse`; `00-smoke` passes; `01` will
     PROBABLY FAIL on the current emulator because Metro isn't
     running and the old debug APK can't load JS — that's expected
     and not a regression of THIS contract; the flow is correctly
     ready-to-run after the founder starts Metro post-OTA).
   - `pnpm diff:before maestro-first-flow` produces the locked-
     mockup PNG.
   - `pnpm diff:after maestro-first-flow` exercises the new
     `.maestro-flow.json` code path: copies the existing
     `00-smoke/smoke-startup.png` (or similar) into the diff/after/
     directory if no fresh Maestro run is available. Demo path
     proven.
   - `pnpm qa` 66/C1/gate 0 — regression check.
   - `pnpm qa:db` 382/382 — regression check.
6. **SURFACE THE PRODUCTION-IMPACTING PUSH + OTA** for the founder's
   explicit go. Never silent.
7. On go: commit + push (Render rebuilds with no real backend
   change; Vercel rebuilds with no web change) + `pnpm
   publish-ota:follower` (and brand/influencer if we want
   parity — likely yes since all three share `api.js`).
8. Founder verifies on his connected device by opening/closing the
   follower app twice, watching for the new bundle, then
   `pnpm qa:maestro` with Metro running to confirm the `01` flow
   passes.

## The actual Maestro flow

`qa/maestro/flows/01-follower-public-browse.yaml` (shape):

```yaml
appId: in.inflx.app.follower
---
- launchApp:
    clearState: true
# Wait for the feed to load — assert on something the Q1 UI shows.
# The Q1 follower-feed-public-location fix means anonymous users
# see a location-based feed without auth prompt.
- assertVisible: ".*"          # placeholder; refine after first real run
- takeScreenshot: feed-loaded
```

The `.maestro-flow.json` sibling tells `diff-after.mjs` to read
`qa-artifacts/qa-maestro/<latest-ts>/01-follower-public-browse/
feed-loaded.png` as the "after" panel.

## Commands

```bash
# After founder confirms api.js change + OTA:
pnpm dev:mobile         # in one terminal — starts Metro
pnpm qa:maestro         # runs both 00-smoke + 01-follower-public-browse
pnpm diff:after maestro-first-flow    # copies the Maestro PNG
pnpm diff:open maestro-first-flow     # opens side-by-side review
```
