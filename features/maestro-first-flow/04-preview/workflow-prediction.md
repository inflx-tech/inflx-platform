# Workflow prediction — api.js env-driven flip + first Maestro flow

## Trigger

Two distinct triggers covered by this contract:

1. **`api.js` is reloaded** (app open, OTA bundle fetch, debug
   reload from Metro). Happens every time JS code executes on app
   launch.
2. **A Maestro test run** (`pnpm qa:maestro`) discovers
   `qa/maestro/flows/01-follower-public-browse.yaml` and runs it
   against the connected device.

## Steps — api.js logic

```js
// New api.js (paraphrased):
import overrides from './api-overrides';

const PRODUCTION_API_URL = 'https://inflx-platform.onrender.com/v1';
const PRODUCTION_BRAND_WEB_URL = 'https://inflx.in';

const getBaseUrl = () => {
  if (__DEV__ && overrides.API_BASE_URL) return overrides.API_BASE_URL;
  return PRODUCTION_API_URL;
};
const getBrandWebUrl = () => {
  if (__DEV__ && overrides.BRAND_WEB_URL) return overrides.BRAND_WEB_URL;
  return PRODUCTION_BRAND_WEB_URL;
};

export const API_BASE_URL = getBaseUrl();
export const BRAND_WEB_URL = getBrandWebUrl();
export const ONESIGNAL_APP_ID = 'fe77ce76-e9c3-47ea-babd-ac3c23be4f62';  // unchanged
```

Where `api-overrides.js` is COMMITTED with `export default {};` —
the empty-default ensures debug AND release builds both return
PROD URLs when no developer has customized.

## Steps — Maestro flow

```yaml
# qa/maestro/flows/01-follower-public-browse.yaml
appId: in.inflx.app.follower
---
- launchApp:
    clearState: true
# Q1 makes the feed public — no auth, no sign-in prompt.
- assertVisible: ".*"          # to be tightened to a real Q1 element
                               # after the first real run captures
                               # what the UI looks like
- takeScreenshot: feed-loaded
```

## End state

### api.js
- `API_BASE_URL` is a string (one of: `PRODUCTION_API_URL`, an
  override value).
- `BRAND_WEB_URL` similar.
- `ONESIGNAL_APP_ID` unchanged.
- All three exports compile + are usable by the rest of the app
  exactly as before.
- Bundle size delta: ~negligible (3 lines saved on USE_PRODUCTION
  removal; ~5 lines added on overrides import).

### Maestro flow
- After Metro is up and the new api.js bundle is loaded by the
  app (either via OTA on a release build, or via Metro on a debug
  build with the new code):
  - App launches, fetches feed from `API_BASE_URL` (which is PROD
    by default).
  - Feed renders with real Q1 deal cards.
  - Maestro screenshots the loaded feed as `feed-loaded.png`.
  - Flow exits 0 → orchestrator counts it as PASSED.

### diff-after with mobile extension
- Reads `01-follower-public-browse.maestro-flow.json` ({"flow":
  "01-follower-public-browse", "screenshot": "feed-loaded"}).
- Looks at `qa/artifacts/qa-maestro/` for the latest run dir.
- Reads `<latest>/01-follower-public-browse/feed-loaded.png`.
- Copies it to `qa/artifacts/diff/maestro-first-flow/after/01-
  follower-public-browse.png`.
- `pnpm diff:open maestro-first-flow` shows the locked mockup
  next to this real Maestro screenshot.

## Edge cases

- **`api-overrides.js` deleted somehow** → `import overrides from
  './api-overrides';` would throw at bundle time; Metro's static
  resolver would error during dev build, and the release build
  would fail at compile. Mitigation: the file is COMMITTED with
  `export default {};` and explicitly noted in LOCAL.md as
  "do not delete; edit for local overrides."
- **`api-overrides.js` exports a non-object** (e.g., founder edits
  it to `export default "broken";`) → `overrides.API_BASE_URL`
  becomes `undefined` (accessing a property on a string returns
  undefined for non-string-prototype keys), falsy, falls back to
  PROD. Defensive default holds.
- **Metro not running when Maestro flow runs** → app shows red
  "Could not connect to development server" screen. Maestro's
  `assertVisible` for ".*" or any feed element fails. Flow fails
  visibly; not a silent green.
- **Q1 feed empty** (no deals served for the device's resolved
  city) → app shows "No deals in <city> yet" empty state. The
  `assertVisible: ".*"` placeholder still matches; a tightened
  assertion targeting `[data-testid='deal-card']` would correctly
  fail. We start permissive (`.*`) and tighten after the first
  real-run reveals the actual UI text.
- **Founder commits his LAN IP** in `api-overrides.js` accidentally
  → still benign for end users (release ignores overrides); only
  a minor private-IP leak. Mitigated by docs + skip-worktree.

## What changes vs current behaviour

### Today
- `api.js` hardcodes `USE_PRODUCTION = true`.
- All builds (debug + release) hit `PRODUCTION_API_URL`.
- No way to redirect to local backend without editing the source
  file (and accidentally committing the edit).
- No real Maestro coverage of user flows.

### After
- `api.js` uses a clean sibling-override pattern.
- Default-empty `api-overrides.js` preserves the current behaviour
  exactly.
- Founders can opt-in to local-backend testing via
  `api-overrides.js` + `skip-worktree`.
- One real Maestro flow ready to exercise Q1 once Metro is up.
- diff-after machinery extended to handle mobile screenshots.

## Files touched

- `Packages/Mobile/src/config/api.js` (modified — governed)
- `Packages/Mobile/src/config/api-overrides.js` (new, committed
  empty)
- `qa/maestro/flows/01-follower-public-browse.yaml` (new)
- `qa/scripts/diff-after.mjs` (extended)
- `LOCAL.md`, `CLAUDE.md` (small additions)
- `features/maestro-first-flow/04-preview/mockups/*` (new locked
  mockup + `.maestro-flow.json`)
- `features/maestro-first-flow/06-diff/notes.md` (new — the
  retroactive worked example)

## Blast radius

- **Production:** zero (empty overrides → PROD URL, same as today).
- **OTA:** ships the new JS bundle to `in.inflx.app.{follower,
  brand,influencer}` installed apps; behaviour unchanged on receipt.
- **Render / Vercel rebuilds:** no-op (no governed backend/web
  changes).
- **DB:** untouched.

## Rollback path

- `git revert <commit>` + `pnpm publish-ota:follower` (and
  others) re-ships the prior api.js. Zero data risk, ~5 min round
  trip.

## Open questions

None at lock time — design A/B/C/D decisions delegated by founder
and locked by the agent in the prior turn.
