# Impact — Redesign Flow 4 · Brand mobile (Home + Campaign list)

## Verdict

**Zero functional / backend / logic / DB impact — visual + UX only.**

Two RN files restyled to locked palette + 1 dead-code phantom field removed.

## Files touched (2)
- `Packages/Mobile/src/screens/brand/BrandHomeScreen.js`
- `Packages/Mobile/src/screens/brand/BrandCampaignListScreen.js`

## Files NOT touched
- `backend/**`
- `Packages/shared/api/**` and `Packages/Mobile/src/services/api.js`
- `Packages/Mobile/src/components/Logo.js` (re-used from Flow 1)
- `Packages/Mobile/src/theme/tokens.js` (palette inlined; consolidation deferred)
- All other Mobile screens (BrandCampaignDetailScreen is Flow 5)
- Web (Vercel auto-deploy is a no-op for this push)
- Backend (Render auto-deploy no-op)

## NO-TOUCH (preserved exactly)
- `brandApi.getMe()`, `getCampaigns()`, `getInboxSummary()`, `cancelCampaign(id)`, `deleteCampaign(id)`
- All navigation route names + nested-navigator params
- `useFocusEffect` + `RefreshControl` + pull-to-refresh
- `openWebDashboard` deeplinks
- AsyncStorage keys
- Selection state machine + Alert.alert confirms
- Filter + sort algorithms
- Status-banner trigger conditions

## Window A coordination
NONE. Window A in backend/revenue — doesn't touch brand mobile.

## Regression risk
LOW. `pnpm qa` 67/67 must hold; no Playwright spec touches these mobile screens. Mobile changes don't affect any web spec.

## Deploy classification — PRODUCTION-IMPACTING (mobile-only)
- `git push origin main` → Vercel/Render auto-deploys = no-op (no web/backend files touched)
- `pnpm publish-ota:brand` + `:influencer` + `:follower` — all 3 flavors get the new bundle (same JS bundle across flavors; even though only brand uses these screens, all 3 need the bundle to stay in sync)
- Phones pick up new bundle on next launch (NATIVE_RUNTIME=1, no APK reinstall)

Rule 5 (Maestro green) fires (`Packages/Mobile/src/**` touched + `release.released=true`). No Maestro flow covers brand home/list — substituted via `GOVERNANCE_OVERRIDE` per Flow 1 precedent: `pnpm qa` green + per-file verify-twice in 06-diff/notes.md + pure visual restyle.

## Time estimate
~2-3h focused work (smaller than Flow 1 — 2 files, no Logo component creation needed).
