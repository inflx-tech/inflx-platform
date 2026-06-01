# Impact Analysis — referral-agency-mobile (Contract 3b)

## Chat verdict (terse)
**New `in.inflx.app.agency` Android flavor + agency app screens (Home/Wallet/
Register) on the existing RN codebase, + the `ota.controller` FLAVORS allowlist
gaining `agency`.** No migration, no schema change, no money-path change (3a owns
agency money). Additive native flavor (no new Kotlin — role resolves generically).
Production-impacting: backend `ota.controller` push (Render) + OTA agency bundle;
the agency APK is a native build whose **Play Store distribution is a manual
founder step**.

## Affected files
- **mobile native (additive):**
  - `Packages/Mobile/android/app/build.gradle` — agency flavor + `agencyDebug`
    in `debuggableVariants`.
  - `Packages/Mobile/android/app/src/agency/res/values/strings.xml` — app_name.
  - `Packages/Mobile/android/app/google-services.json` — already updated (5 apps).
  - `Packages/Mobile/package.json` — `android:agency` script.
- **mobile JS (new):**
  - `src/navigation/AgencyNavigator.js`, `src/screens/agency/AgencyHomeScreen.js`,
    `AgencyWalletScreen.js`, `AgencyProfileScreen.js`,
    `src/screens/auth/AgencyRegisterScreen.js`.
- **mobile JS (changed, additive):**
  - `App.js` (agency navigator branch + role guard), `src/screens/auth/OTPScreen.js`
    (guard + post-OTP agency branch), `src/screens/auth/PhoneScreen.js` (label),
    `src/navigation/AuthNavigator.js` (AgencyRegister screen),
    `src/services/api.js` (`agencyApi`).
- **backend (changed, additive, PROD-IMPACTING):**
  - `backend/src/controllers/ota.controller.js` — `FLAVORS` += `'agency'`.
  - `backend/tests/*` — a test asserting agency flavor accepted / unknown rejected.
- **tooling/docs:**
  - `scripts/publish-ota.js` — FLAVORS + arg allowlist += `agency`.
  - `LOCAL.md` — agency variant doc.
- **qa:** `qa/maestro/flows/04-agency-launch.yaml`.

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| (existing 3a) | `/agencies/*`, `/referrals/redeem` | consumed by the app | agency app |
| GET/POST | `/ota/manifest`, `/ota/publish` | now accept flavor `agency` | OTA publisher + app update check |

## Affected workflows (regression surface)
- The other 3 mobile flavors (shared `App.js`/`OTPScreen`/`PhoneScreen`/`api.js`
  edits are additive) — their Maestro flows (00/01/02/03) must stay GREEN.
- `ota.controller` — existing flavors must still publish/fetch; unknown still 422.
- `pnpm qa` (backend + web) unaffected.

## Migration / deploy / OTA impact
- **No migration.** Backend `git push` → Render (`ota.controller` FLAVORS).
- **Agency app distribution:** the debug APK is built+verified on the emulator;
  the **production APK → Play Store listing + signing + review is the manual
  founder step** (Play Console access + release keystore). 3b does not and
  cannot automate that.
- **Mobile-verify gate ENFORCED:** `release.maestro_green: true` required
  (gov-check Rule 5) — satisfied by `pnpm qa:maestro` GREEN incl. 04-agency-launch.
- **Deploy posture: PRODUCTION-IMPACTING** (Render ota.controller). Surfaced for
  explicit go.

## Risk notes
- Shared auth-flow edits could affect all flavors → mitigated: edits are
  additive `agency` branches/guards; Maestro 00–03 re-run to prove no regression.
- `ota.controller` FLAVORS is the only backend change — small, allowlist-only;
  jest asserts agency accepted + unknown rejected.
- New flavor needs google-services entry (done) + `debuggableVariants` entry
  (or the debug build mis-bundles) — both handled.
- Reversibility: remove the flavor/nav branch/allowlist entries; nothing
  persisted. No money path touched.
