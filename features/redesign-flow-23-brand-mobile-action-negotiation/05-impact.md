# Impact Analysis — Flow 23

> Chat: **Impact: zero functional / backend / DB impact — visual + extend StatusPill canonical map with 5 negotiation statuses (additive); 2 screen rewrites consuming Flow 21 components.**

## Affected files
- **Modified**: `Packages/Mobile/src/components/brand/StatusPill.js` — additive: 5 new entries (awaiting_brand, awaiting_influencer, agreed, walked_away, open) in STATUS_MAP_DEFAULT. Existing 26 entries byte-identical.
- **Modified**: `Packages/Mobile/src/screens/brand/BrandActionRequiredScreen.js` — full rewrite consuming brandPalette + ScreenHeader + StatusPill + EmptyState + fonts. Drop `import StatusBadge from '../../components/StatusBadge'` → use `<StatusPill>`. 5-tab + bulk-sign + retry behavior preserved.
- **Modified**: `Packages/Mobile/src/screens/brand/BrandNegotiationScreen.js` — full rewrite consuming brandPalette + ScreenHeader + StatusPill + fonts. Chat-thread bubbles + goal-aware action panel preserved.
- **NOT touched**: theme/tokens.js, `components/StatusBadge.js` (deferred), Flows 18-22 screens (Conversions/InfluencerBrowse/etc. unaffected — extension is additive)

## APIs (none changed — see 01-spec)

## Regression surface
- pnpm qa 76 tests: no overlap, expect GREEN modulo MSG91/cold-backend flakes (see Flow 21/22 precedent)
- Flows 21-22 consumers of StatusPill: extension additive, byte-identical for existing keys
- Cross-screen nav from ActionRequired (BrandNegotiation, BrandCampaignDetail, BrandContract, BrandInfluencerProfile) — param shapes preserved
- Deep-link entry: Negotiation accepts either `negotiationId` OR `campaignInfluencerId` (existing dual-path preserved)

## Migration / deploy
- New migration: No
- Mobile JS: Yes → OTA × 3 via publish-ota:all
- NATIVE_RUNTIME: not bumped
- Maestro Rule 5: GOVERNANCE_OVERRIDE on close-out

## Risk
- StatusPill extension: 5th additive change. STATUS_MAP_DEFAULT keys now ~31. Verify-twice: no key collision with prior entries.
- ActionRequired's 5-tab lazy-load + bulk-sign + retry is the most complex state surface in the bucket so far. Each tab's render branch preserved 1:1.
- Negotiation chat-thread auto-scroll behavior is timing-sensitive (300ms timeout after load) — preserved verbatim.

## Time estimate
~150 min total (mockup + impl + QA + ship).
