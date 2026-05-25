# Feature Spec — Flow 19 · brand-mobile Store Preview + Campaign Sets List

> Second flow of the mobile-brand bucket. Bundle of 2 read-only display screens (per audit Cluster 1). Builds on Flow 18's `brandPalette` export.

## Problem / goal

Both screens currently render off-palette versus the brand-web wave and Flow 18 notifications:
- **BrandStorePreviewScreen** uses the navy-based legacy `colors` + orange CTA. Visually inconsistent with the locked yellow/ink palette.
- **BrandCampaignSetsListScreen** is partially on the locked palette (inline `P` const matches `brandPalette` exactly on yellow/ink) but uses default fonts (not Outfit/PJS/JetBrains-Mono) and duplicates palette constants locally.

Bring both to parity:
1. Consume `brandPalette` + `fonts` from `theme/tokens.js` (single source of truth — Flow 18's export covers all needed tokens)
2. Apply locked typography (Outfit headings, Plus Jakarta body, JetBrains Mono digits/IDs)
3. Preserve all behavior 1:1

## Scope

**In scope:**
- Visual rewrite of `Packages/Mobile/src/screens/brand/BrandStorePreviewScreen.js` (navy + orange → brandPalette + yellow/ink)
- Visual rewrite of `Packages/Mobile/src/screens/brand/BrandCampaignSetsListScreen.js` (drop inline `P` const → import `brandPalette`; apply `fonts.displayBold`/`sansMedium`/`monoMedium` everywhere)
- Preserve all behavior: API calls, navigation (StorePreview goBack + SetsList → BrandCampaignInfluencersList with setIdFilter), product grouping by section, open_group funnel, mini-roster filtering, status dot mapping
- Backend-first audit: all visible tiles trace to real fields in `/brands/me/store-preview` and `/campaigns/:id` responses

**Explicitly out of scope:**
- Any change to `theme/tokens.js` (Flow 18's `brandPalette` is sufficient)
- Touching `Packages/Mobile/src/screens/brand/BrandCampaignInfluencersList*` (that's Flow 22)
- Adding edit affordances to StorePreview (it's intentionally read-only — edit happens in BrandProfileScreen)
- Backend changes (no migrations, no API shape changes)
- Maestro setup (still deferred; GOVERNANCE_OVERRIDE on close-out)

## Surfaces touched

- **App(s)**: mobile-brand (2 screen files)
- **Roles involved**: brand (no influencer / follower / admin affected)

## Data / contracts

- **New or changed tables / columns / migrations**: none
- **New or changed API endpoints**: none — consumes existing:
  - `GET /v1/brands/me/store-preview` (proxies `followerService.resolveBusinessStore` for the brand's own id)
  - `GET /v1/campaigns/:campaignId` (returns `{ campaign: { sets: [{ id, name, goal, window_start, window_end, set_budget, influencer_mode, max_cap, influencers: [...] }] } }`)
- **Money/units, attribution IDs, status machines**: none affected (consumed read-only via `fmtRupees`)

## Non-functional

- **Auth/role gates**: unchanged — both screens behind brand-app role-routed entry
- **Failure modes the feature must handle**:
  - StorePreview: empty `products[]` → empty state with 🏪 emoji + copy; empty `influencers[]` → creators section hidden
  - SetsList: empty `sets[]` → dashed-bordered empty state; missing `campaign` → "Campaign not found" error state with go-back CTA
  - Network failure on initial load → ActivityIndicator cleared, screen renders empty (preserved); pull-to-refresh re-fires
  - SetsList: `useFocusEffect` re-loads when screen regains focus (preserved — important when returning from BrandCampaignInfluencersList after status changes)
