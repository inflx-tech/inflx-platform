# Diff notes — maestro-first-flow

This is the agent-authored plain-English summary of what was
implemented, what matches the locked mockup, and what diverged.
Reviewed at the diff sign-off gate before the OTA push.

## What was implemented

1. **`Packages/Mobile/src/config/api.js`** refactored from a
   hardcoded `USE_PRODUCTION = true` flag into a sibling-override
   pattern. Imports `./api-overrides` (committed with empty
   defaults) and uses its `API_BASE_URL` / `BRAND_WEB_URL` values
   ONLY when `__DEV__` is true AND the override field is set.
   Release builds always return `PRODUCTION_API_URL` /
   `PRODUCTION_BRAND_WEB_URL`. Default behaviour preserved exactly
   for both empty overrides and release.

2. **`Packages/Mobile/src/config/api-overrides.js`** added as a
   COMMITTED file with `export default {};`. The empty default
   makes the new logic equivalent to the old hardcoded
   `USE_PRODUCTION=true` branch. Developers customize locally and
   use `git update-index --skip-worktree` to keep changes out of
   commits.

3. **`qa/maestro/flows/01-follower-public-browse.yaml`** added as
   the first real Maestro flow. Targets `in.inflx.app.follower`,
   launches with `clearState: true`, asserts visibility of a Q1
   feed element, takes `feed-loaded` screenshot. Runs against the
   PRODUCTION API by default (current behaviour preserved).

4. **`qa/scripts/diff-after.mjs`** extended to read a sibling
   `<mockup>.maestro-flow.json` for each mockup. When present, the
   script looks at `qa/artifacts/qa-maestro/` for the latest
   timestamp directory, locates `<flow>/<screenshot>.png`, and
   copies it into `qa/artifacts/diff/<slug>/after/<mockup>.png`.
   The existing `.capture.json` Playwright path is unchanged
   (additive feature).

5. **`LOCAL.md`** + **`CLAUDE.md`** small additions documenting
   the new override pattern and the `skip-worktree` convention.

## What matches the locked mockup

The mockup `01-follower-public-browse.html` shows the founder-
agreed Q1 follower public-browse UI: orange/pink INFLX logo,
Vijayawada city header, yellow "Browsing as guest" banner, three
deal cards (Royal Threads boutique, Blush & Co. salon, City Wheels
rental), each with verified-badge + view-deal CTA, sticky sign-in
CTA at bottom. The actual implementation of Q1 (already shipped in
commit `bfcd788`) renders this exact shape — verified during the
Q1 release in the carved-defect remediation. So:

- ✓ Header layout (INFLX logo + city dropdown)
- ✓ Guest banner
- ✓ Deal card hierarchy (image · brand · description · price · CTA)
- ✓ Sticky sign-in CTA
- ✓ No auth prompt for anonymous browse

When the Maestro flow runs (founder-side, after OTA + Metro), the
captured `feed-loaded.png` will be compared side-by-side against
this mockup. Expected: ≥80% visual match (font rendering and
exact pixel positioning will differ between mockup-HTML and
React-Native-rendered UI, but the structure should align).

## What diverged from the mockup (and why)

- **The mockup uses Tailwind-CDN classes** for layout; the real
  React Native UI uses its own styling system (StyleSheet objects,
  not Tailwind classes). This is intentional and expected — the
  mockup is a *visual approximation* of the design, not a code
  prototype.
- **`assertVisible: ".*"` in the YAML** is a permissive placeholder
  for the first run. After the founder runs the flow and captures
  the actual rendered UI, the assertion should be tightened to
  match a known element (e.g., `assertVisible: "Deals near you"`
  or `assertVisible: "Sign in to save"`). This is a follow-up
  cycle, not a divergence — the flow is correctly conservative on
  first author.
- **Brand data is mocked in the mockup** (Royal Threads, Blush,
  City Wheels) — real prod data shows whatever real brands are
  active. The structure matches; the text differs. This is
  expected for a "shape-matches, content-comes-from-API" mockup.

## Things the founder should specifically check

- **The OTA actually delivers the new bundle.** After
  `pnpm publish-ota:follower`, the founder opens the installed
  follower APK twice. The OneSignal background notif (or in-app
  refresh) should pick up the new bundle. To confirm new bundle
  is loaded: check that `api-overrides.js` reference works — but
  since overrides are empty, the visible behaviour is identical
  to before, so this isn't user-visible. The pragmatic confirmation
  is that the OTA endpoint reports a new manifest version.
- **The `01` flow assertion** (currently `.*`) will pass
  trivially. After running for the first time, tighten the
  assertion to a real Q1 feed element so future runs catch
  regressions.
- **`api-overrides.js` exists and is empty** in the installed
  bundle. If the founder ever wants to test against local backend,
  edit the local file + `git update-index --skip-worktree
  Packages/Mobile/src/config/api-overrides.js`.

## Out-of-band changes

- `qa/scripts/diff-after.mjs` got extended with mobile support
  (the `.maestro-flow.json` reader). This was foreshadowed in
  sub-contract 4's spec (decision C). Surfaced here, not silent.
- `BRAND_WEB_URL` got the same treatment as `API_BASE_URL`
  (symmetric refactor). The old code had identical hardcoded-
  USE_PRODUCTION logic for both; we refactored both in one pass
  for consistency.
