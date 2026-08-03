# 05 — Impact

**Verdict: presentation-only. No functional disturbance — no API, no
schema, no money path, no auth, no routing.**

## Blast radius

Every change is a rendered pixel or a static asset. Nothing touches
`backend/`, no migration, no contract with the API, no state machine.

| Area | Impact |
|---|---|
| Backend / DB / migrations | **None.** No file touched. |
| API surface | **None.** |
| Auth / RBAC / routing | **None.** `page.js` edits are inside JSX bodies; no route, guard or redirect altered. |
| Money / ledger / escrow | **None.** |
| Web bundle | +~3 KB inline SVG path data, offset by dropping two `<img>` fetches of a 537 KB PNG. Net **faster** landing page. |
| Mobile bundle | +~3 KB path data; **−537 KB** from deleting the marketing-mockup PNG. Net smaller. |
| `react-native-svg` | Already a dependency (`^14.1.0`) and already stubbed in `jest.setup.js`. No new dependency. |
| Fonts | None added. Plus Jakarta Sans 800 already imported in `globals.css`; PlusJakartaSans-Bold already bundled in `android/app/src/main/assets/fonts/`. |

## Compatibility

`Logo`'s public API is unchanged (`tone`, `size`), so all five existing
call sites work untouched. `size="xl"` is additive (mobile only).

## Risks and how each is handled

1. **Font fails to resolve on mobile.** `PlusJakartaSans-Bold` is bundled
   but the app currently uses only `'monospace'`, so this is its first real
   use. RN falls back to the system face rather than erroring — degrades to
   a slightly different wordmark, never a crash.
2. **Splash regression relapse.** Guarded by a test that fails if any
   `<Image>` reappears on the splash, plus one pinning the ground colour to
   the launcher background.
3. **Launcher icon is a native change.** Ships **only in a new APK** — an
   OTA bundle will not move it. Called out below.
4. **Adaptive icon is new to this project.** Legacy PNGs remain for
   API 21–25, so pre-Oreo devices are unaffected; `mipmap-anydpi-v26` is
   version-gated by Android itself.

## Release classification — **PRODUCTION-IMPACTING**

Not deploy-inert. Three distinct delivery paths, and they are not
interchangeable:

| Change | Path |
|---|---|
| `Packages/brand-web/**` (landing, shared `Logo`, favicons) | `git push` → **Vercel** auto-deploy |
| `Packages/Mobile/src/**` (lockup, splash) | **OTA** bundle |
| `android/app/src/main/res/**` (launcher icon) | **APK rebuild only** — OTA cannot ship it |

Explicit founder go required before push. `release.released` stays `false`
until the founder's single end-to-end pass, per the standing "verify
everything together at the end" rule; Rule 5 also requires
`pnpm qa:maestro` green before the flip.
