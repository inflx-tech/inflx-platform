# Impact Analysis — referral-influencer-refer-earn (Contract 4)

## Chat verdict (terse)
**New influencer "Refer & Earn" screen (RN influencer app) + one read-only
`GET /influencers/me/referral` endpoint.** No migration, no schema change, no
money-path change — the engine already settles influencer-referrers. Mobile-
governed: Maestro boot smoke is the gate; ships via OTA + a backend push. Low
blast radius (additive screen + read endpoint).

## Affected files
- **backend (changed, additive):**
  - `backend/src/controllers/influencer.controller.js` — add `getReferralInfo`.
  - `backend/src/routes/influencer.routes.js` — `GET /me/referral`
    (`requireRole('influencer')`).
  - `backend/tests/referral-influencer.test.js` — endpoint tests.
- **mobile (new):**
  - `Packages/Mobile/src/screens/influencer/ReferAndEarnScreen.js`.
- **mobile (changed, additive):**
  - `Packages/Mobile/src/navigation/InfluencerNavigator.js` — register
    ReferAndEarn in the Earnings stack.
  - `Packages/Mobile/src/screens/influencer/EarningsScreen.js` — add an entry
    tile/row → navigate to ReferAndEarn.
  - `Packages/Mobile/src/services/api.js` — `influencerApi.getReferralInfo`.

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| GET | `/influencers/me/referral` | new (read-only) | influencer app Refer & Earn |

## Affected workflows (regression surface)
- Existing influencer app boot/golden paths → `02-influencer-launch.yaml` (+
  `00-smoke`) must stay GREEN with the new bundle.
- Shared `influencer.controller.js` / `api.js` edits are additive → existing
  influencer suites stay GREEN.

## Migration / deploy / OTA impact
- **No migration.** Backend `git push` → Render (1 GET). Mobile JS-only →
  **OTA** (`scripts/publish-ota.js influencer`); **no native rebuild** (Clipboard
  + Share already in the app).
- **Mobile-verify gate (ENFORCED):** commit touches `Packages/Mobile/src/**` and
  flips `release.released=true` → MUST carry `release.maestro_green: true`
  (gov-check Rule 5). Satisfied by `pnpm qa:maestro` GREEN on emulator-5554.
- **Deploy posture: PRODUCTION-IMPACTING** (Render + OTA to installed influencer
  apps). Surfaced for explicit go.

## Risk notes
- A JS error in the new screen would break the influencer bundle → caught by the
  Maestro boot smoke (gate blocks release) — the gate's purpose.
- Read endpoint joins to resolve referred names → LEFT JOIN + fallback label, no
  500 on odd rows.
- Mockup-lock + diff gates apply (UI). Shared-file edits staged by explicit path.
- Reversibility: OTA rollback (republish prior bundle) + remove endpoint; nothing
  persisted, no money touched.
