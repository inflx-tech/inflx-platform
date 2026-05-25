# Impact Analysis — Flow 19 · brand-mobile Store Preview + Campaign Sets List

> Chat verdict (terse): **Impact: zero functional / backend / logic / DB impact — visual + UX only across 2 read-only screens; no tokens.js change (reuses Flow 18 brandPalette).**

## Affected files (read or change)

- **mobile (changed)**:
  - `Packages/Mobile/src/screens/brand/BrandStorePreviewScreen.js` — full visual rewrite (~290 LOC). Behavior preserved 1:1.
  - `Packages/Mobile/src/screens/brand/BrandCampaignSetsListScreen.js` — consolidate inline `P` → `brandPalette` import; apply Outfit/PJS/JetBrains-Mono fonts. Behavior preserved 1:1.
- **backend**: none
- **web**: none
- **shared**: none
- **theme/tokens.js**: **no change** — `brandPalette` (shipped in Flow 18) already covers every needed token
- **read-only verify**: 24 Wave-3 follower/restaurant screens unaffected (no tokens.js touch); 14 brand-mobile screens not yet redesigned unaffected (each ships its own flow)

## Affected routes / APIs

| Method | Path | Change | Consumers |
|---|---|---|---|
| GET | `/v1/brands/me/store-preview` | none | mobile brand (this screen) |
| GET | `/v1/campaigns/:campaignId` | none | mobile brand (this + CampaignDetail + InfluencersList + ReviewQueue + future flows), brand-web (already redesigned in Flow 6) |

## Affected workflows (regression surface)

- **All 75 tests in `pnpm qa`** — no overlap (zero web/backend files touched); expect 75/75 GREEN
- **Nav chain `BrandCampaignSetsList → BrandCampaignInfluencersList { setIdFilter }`** — preserved verbatim; future Flow 22 will redesign the destination screen but accepts the same param
- **`useFocusEffect` refetch on SetsList** — preserved verbatim; important for status-change propagation when returning from influencer screens

## Migration / deploy / OTA impact

- **New migration?** No
- **Mobile JS changed → OTA required?** Yes. Pure JS/style; no native modules. `NATIVE_RUNTIME` does NOT bump.
- **APK rebuild?** No
- **Backend/web only → push only?** No — mobile-only; push triggers Vercel/Render redeploys (no-op for this change)
- **OTA × 3 ceremony** per `feedback_ota_publish_strategy` learned in Flow 18: use `pnpm publish-ota:all` (single Node process, 3 audit registrations, more reliable than 3-separate)

## Risk notes

- **Reversibility**: pure JS/style rewrite, phones with old bundle work; rollback = republish OTA from previous-known-good commit
- **Theme additivity**: no tokens.js change in this flow → zero risk to 24 Wave-3 follower screens
- **Local P const removal in SetsList**: a verify-twice grep confirms no other file imports `P` from BrandCampaignSetsListScreen.js (it's a private const)
- **Maestro Rule 5**: close-out push uses `GOVERNANCE_OVERRIDE="Maestro not yet wired for solo dev"` per Flow 18 precedent

## Time estimate

- Mockup build + founder lock: 30 min (in progress this session)
- Implementation (2 screens): 45 min
- pnpm qa baseline: 5 min
- Commit + push + OTA × 3 + close-out: 15 min

Total: ~95 min for Flow 19.

## Pattern extraction watch (per handoff §12)

After Flow 19 ships, 3 screens (Flow 18 Notifications, Flow 19 StorePreview, Flow 19 SetsList) will share:
- The ink topbar pattern (title + rule + count chip + optional back-pill / right-pill)
- The dashed-yellow empty-state card
- Mono-digit count chips in ink/yellow

**Trigger reached** — Flow 20 will likely extract these into `Packages/Mobile/src/components/brand/{ScreenHeader, EmptyState, CountChip}.js`. NOT extracted in Flow 19 to avoid Flow-18-pattern lock-in before the 3rd screen tests the abstraction.
