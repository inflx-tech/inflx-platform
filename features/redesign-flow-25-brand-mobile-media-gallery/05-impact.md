# Impact Analysis — Flow 25

> Chat: **Impact: zero functional / backend / DB impact — visual + extend StatusPill canonical map with 3 contract statuses (additive); 1 single-screen rewrite consuming Flow 21 components + brandPalette + fonts.**

## Affected files
- **Modified**: `Packages/Mobile/src/components/brand/StatusPill.js` — additive 3 entries (draft, pending_influencer, pending_brand). Existing 31 entries byte-identical.
- **Modified**: `Packages/Mobile/src/screens/brand/BrandMediaGalleryScreen.js` — full visual rewrite, behavior preserved 1:1. SDK boundary (launchImageLibrary + uploadFile to R2 signed URL) preserved verbatim.
- **Not touched**: theme/tokens.js, ScreenHeader / EmptyState (consumed)

## APIs — none changed
- listMediaAssets, getMediaUsage, getMediaUploadUrl, uploadFile, createMediaAsset, deleteMediaAsset (assets)
- listReferenceLinks, createReferenceLink, updateReferenceLink, deleteReferenceLink (links)
- listBrandContracts (contracts)

## Regression surface
- pnpm qa: zero web/backend changes; expect 76 GREEN modulo env-flake
- StatusPill consumers (Conversions / CampaignInfluencersList / Negotiation / etc.): extension additive, byte-identical for existing keys
- React Native image-picker SDK: not modified; preserved as-is
- R2 upload boundary (uploadFile): not modified; preserved as-is

## Migration / deploy
- New migration: No
- Mobile JS: Yes → OTA × 3 via publish-ota:all
- NATIVE_RUNTIME: NOT bumped (image-picker already in current APK)
- Maestro Rule 5: GOVERNANCE_OVERRIDE on close-out

## Risk
- **SDK boundary risk**: launchImageLibrary + uploadFile flow is the most complex IO surface in the bucket. Preserved verbatim — only visual changes around the boundary (button colours, hint copy retained, Alert flows preserved).
- **R2 upload retry / network resilience**: existing behavior preserves try/catch on uploadFile; no new retry logic added.
- **Tab-driven mount**: each tab self-mounts on focus via useEffect — preserved.
- **Modal KeyboardAvoidingView**: preserved with iOS `padding` behavior.

## Time estimate
- Mockup + lock: 25 min
- Implementation: 80 min (largest non-Contract flow due to 3-tab + modal complexity)
- QA + commit + push + OTA + close-out: 20 min

Total: ~125 min.

## Pattern extraction watch
After this flow, 9 screens in the bucket use the same StatusPill / ScreenHeader / EmptyState. The modal pattern (bottom-sheet with KeyboardAvoidingView + ink header + form + footer actions) now appears in 4 screens (Enquiries / ProposalInbox / InfluencerProfile invite / this LinkEditor). Worth a `<BottomSheet>` component extraction in a future polish flow, but not in Flow 25 — pattern is stable enough to extract cleanly, but doing so here would expand scope. Defer.
