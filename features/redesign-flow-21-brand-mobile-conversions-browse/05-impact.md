# Impact Analysis — Flow 21

> Chat verdict: **Impact: zero functional / backend / DB impact — visual + extracted components (3 new files); no tokens.js change; Flows 18-20 untouched.**

## Affected files

- **NEW**: `Packages/Mobile/src/components/brand/StatusPill.js` (~50 LOC)
- **NEW**: `Packages/Mobile/src/components/brand/EmptyState.js` (~40 LOC)
- **NEW**: `Packages/Mobile/src/components/brand/ScreenHeader.js` (~80 LOC)
- **Modified**: `Packages/Mobile/src/screens/brand/BrandConversionsScreen.js` (~290 LOC → similar) — full visual rewrite consuming the 3 new components
- **Modified**: `Packages/Mobile/src/screens/brand/BrandInfluencerBrowseScreen.js` (~370 LOC → similar) — full visual rewrite consuming the 3 new components
- **NOT touched**: `theme/tokens.js`, `BrandNotifications*`, `BrandStorePreview*`, `BrandCampaignSetsList*`, `BrandEnquiries*`, `BrandProposalInbox*`, `BrandInfluencerProfile*` (Flows 18-20 keep inline pattern; visually identical)

## Affected routes / APIs

| Endpoint | Change | Consumers |
|---|---|---|
| GET /v1/transactions | none | Conversions screen |
| GET /v1/influencers/search | none | InfluencerBrowse screen |

## Regression surface

- pnpm qa 76 tests: no overlap, expect GREEN
- 24 Wave-3 follower screens: untouched (no tokens.js change)
- **6 prior brand-mobile screens (Flows 18-20)**: inline pattern preserved — they don't import the new components in this flow. **The new components render IDENTICAL pixels** to the inline equivalents (same palette, same fonts, same border-radius, same shadow); future polish pass can swap inline → component without any user-visible change

## Risk

- **Extraction trap**: if the components' API is too narrow, future flows (22+) may need to fork them. Mitigation: API designed to handle the variants observed in Flows 18-20 (ScreenHeader has 5 variants surfaced as props; StatusPill has 6 canonical tokens; EmptyState is the simplest shape)
- **Import path**: keep components at `Packages/Mobile/src/components/brand/` (not `src/components/`) so they're scoped to brand-app code path. Influencer + follower buckets get their own dirs when those buckets reach extraction-trigger
- Maestro Rule 5: GOVERNANCE_OVERRIDE

## Time estimate
- Mockup + lock: 30 min
- 3 component files: 30 min
- 2 screen rewrites consuming components: 60 min
- pnpm qa + commit + push + OTA + close-out: 25 min

Total: ~145 min.
