# Impact Analysis — Flow 22

> Chat: **Impact: zero functional / backend / DB impact — visual + extend StatusPill canonical map (additive); 2 screen rewrites consuming Flow 21 components.**

## Affected files

- **Modified**: `Packages/Mobile/src/components/brand/StatusPill.js` — additive: 7 new entries in `STATUS_MAP_DEFAULT` (applied, negotiating, contracted, active, invited, rejected_by_brand, slots_filled). Existing entries byte-identical.
- **Modified**: `Packages/Mobile/src/screens/brand/BrandCampaignInfluencersListScreen.js` — drop inline `P` + `STATUS_CFG`; consume brandPalette + ScreenHeader + StatusPill + EmptyState + fonts
- **Modified**: `Packages/Mobile/src/screens/brand/BrandCampaignReviewQueueScreen.js` — drop inline `P`; consume brandPalette + ScreenHeader + EmptyState + fonts (no StatusPill needed — deliverables don't use one)
- **Not touched**: `theme/tokens.js`, ScreenHeader, EmptyState (StatusPill is extended additively)

## APIs

| Endpoint | Change | Consumers |
|---|---|---|
| GET /v1/campaigns/:id | none | InfluencersList + ReviewQueue |
| POST .../approve, /reject, /cancel | none | InfluencersList |
| POST /v1/deliverables/:id/review | none | ReviewQueue |
| POST /v1/deliverables/:id/confirm-live | none | ReviewQueue |

## Regression surface

- pnpm qa 76 tests: zero overlap (mobile-only); expect GREEN modulo MSG91/cold-backend flakes carried from Flow 21
- Flows 18-21 screens: untouched. Flow 21 components used here are byte-equivalent to their existing API. Extension to STATUS_MAP_DEFAULT is additive — Conversions screen (Flow 21 consumer) still sees the same `completed`/`pending`/etc. behavior
- Cross-screen nav: BrandNegotiation, BrandContract, BrandInfluencerProfile all expect existing param shapes; preserved

## Migration / deploy

- New migration: No
- Mobile JS: Yes → OTA × 3 via `publish-ota:all`
- NATIVE_RUNTIME: not bumped
- APK rebuild: No

## Risk

- **Extending StatusPill in this flow** is the right call (additive only, single source of truth grows with the bucket) but it's a SHARED component change. Verify-twice: Conversions screen (Flow 21 consumer) doesn't reference any of the 7 new statuses, so behavior there is unchanged.
- Maestro Rule 5: GOVERNANCE_OVERRIDE
- MSG91 / Render cold-start flake risk continues (Flow 19 + 21 precedent → pending-cert if needed)

## Time estimate
- Mockup + lock: 30 min
- StatusPill extension: 5 min
- 2 screen rewrites: 75 min
- QA + commit + push + OTA + close-out: 20 min

Total: ~130 min.
