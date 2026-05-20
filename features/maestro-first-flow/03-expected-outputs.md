# Expected outputs — maestro-first-flow

## Files created

```
features/maestro-first-flow/04-preview/workflow-prediction.md    api.js behavior change
features/maestro-first-flow/04-preview/mockups/01-follower-public-browse.html
features/maestro-first-flow/04-preview/mockups/01-follower-public-browse.maestro-flow.json
features/maestro-first-flow/06-diff/notes.md                     diff narrative
qa/maestro/flows/01-follower-public-browse.yaml                  first real flow
Packages/Mobile/src/config/api-overrides.js                      empty defaults (committed)
```

## Files modified

```
Packages/Mobile/src/config/api.js          (GOVERNED — env-driven flip)
qa/scripts/diff-after.mjs                  (extend for .maestro-flow.json)
LOCAL.md                                   (api-overrides + skip-worktree note)
CLAUDE.md                                  (mobile-verify gate is no longer
                                            "advisory infrastructure-only";
                                            it now covers a real flow)
```

## Files NOT modified

- `Packages/Mobile/src/**` other than `config/api.js` and the new
  `config/api-overrides.js`.
- Backend, web, migrations.
- `.gitignore` — NOT changed. `api-overrides.js` is COMMITTED with
  empty defaults; founder uses `git update-index --skip-worktree
  Packages/Mobile/src/config/api-overrides.js` for local edits.
  (Gitignoring would have created the Metro dynamic-require
  problem.)

## Visible runtime behaviour

### Before OTA (current state):
- Debug APK on emulator/phone: `USE_PRODUCTION=true` → hits PROD.
- Release APK in prod: `USE_PRODUCTION=true` → hits PROD.

### After OTA (with empty committed `api-overrides.js`):
- Debug APK + new JS bundle from OTA: `__DEV__=true`, empty
  overrides → returns `PRODUCTION_API_URL` (same as before).
- Release APK in prod + new JS bundle from OTA: `__DEV__=false` →
  returns `PRODUCTION_API_URL` (same as before).
- **Zero behaviour change for end users.**

### After founder edits `api-overrides.js` locally (skip-worktree):
- Debug APK with Metro running: `__DEV__=true`, override
  `API_BASE_URL` set → returns the override (e.g.,
  `http://10.0.2.2:3001/v1` for emulator → host).
- Release APK in prod: still `PRODUCTION_API_URL` regardless of
  founder's local `api-overrides.js` edits (because `__DEV__=false`
  in release builds).
- **End-user behaviour: still unchanged.**

### After `pnpm qa:maestro` (with Metro running + 01 flow ready):

```
[qa:maestro] running maestro-doctor (prerequisite) ...
[maestro-doctor] === ALL GREEN ===
[qa:maestro] discovered 2 flows: 00-smoke.yaml, 01-follower-public-browse.yaml
[qa:maestro] output → qa/artifacts/qa-maestro/<ts>/
[qa:maestro] running 00-smoke ...
[qa:maestro]   00-smoke: PASSED
[qa:maestro] running 01-follower-public-browse ...
[qa:maestro]   01-follower-public-browse: PASSED
[qa:maestro] === 2/2 flows PASSED ===
exit 0
```

### After `pnpm diff:after maestro-first-flow`:

```
[diff-after] 01-follower-public-browse.html: maestro-flow.json found
[diff-after]   flow=01-follower-public-browse screenshot=feed-loaded
[diff-after]   reading qa/artifacts/qa-maestro/<latest>/01-follower-public-browse/feed-loaded.png
[diff-after]   copied → qa/artifacts/diff/maestro-first-flow/after/01-follower-public-browse.png
[diff-after] done — 1/1 captured
```

## Expected doctor output (unchanged)

`pnpm qa:maestro:doctor` continues to report green (Maestro + adb +
device + follower app) — this sub-contract doesn't modify the
doctor.

## Expected `dev-doctor` output

Unchanged. The informational Maestro line still appears.

## Failure-path outputs (loud, no fake green)

- If the `01-follower-public-browse` flow runs without Metro: the
  app launches, shows the red "Could not connect to development
  server" screen, Maestro's `assertVisible` for known feed text
  fails. Loud, with the screenshot as evidence.
- If `diff:after maestro-first-flow` runs but the latest qa-maestro
  run has no `feed-loaded.png`: clear "no Maestro screenshot found
  for flow=01-follower-public-browse / screenshot=feed-loaded —
  run pnpm qa:maestro first."
- If `.maestro-flow.json` is malformed: name the file + the JSON
  error + skip-not-fake.
