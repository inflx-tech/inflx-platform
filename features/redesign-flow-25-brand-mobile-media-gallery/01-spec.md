# Feature Spec — Flow 25 · brand-mobile MediaGallery

## Problem / goal

Eighth flow. BrandMediaGalleryScreen (654 LOC) — single screen with 3 tabs (Assets / Links / Contracts) backed by 10 distinct API endpoints + native SDK boundary (launchImageLibrary from `react-native-image-picker`). Currently navy + orange legacy. Migrate to brandPalette + Flow 21 components + Outfit/PJS/JetBrains-Mono.

## Scope

**In scope:**
- Visual rewrite consuming brandPalette + ScreenHeader + StatusPill + fonts
- Replace inline STATUS_COLORS (5 contract statuses) with canonical `<StatusPill>`
- Extend `StatusPill.STATUS_MAP_DEFAULT` with 3 additive contract statuses: `draft` (bg2/muted2 "DRAFT") · `pending_influencer` (yellowPale "AWAITING INFLUENCER") · `pending_brand` (yellowPale "YOUR TURN")
- Preserve all behavior 1:1: launchImageLibrary photo picker, R2 signed-URL upload flow (getMediaUploadUrl → uploadFile → createMediaAsset), storage usage bar with 75%/90% threshold colors, tag filter (logo/brand_kit/product_shot/document/other), tab-driven render, link editor Modal w/ KeyboardAvoidingView, contract search filter, contract PDF nav

**Out of scope:**
- theme/tokens.js changes
- Replacing launchImageLibrary (still photo-only — videos via Reference Links per existing copy)
- File-type expansion (PDF / ZIP upload still web-only per existing copy)
- Backend / API changes

## Surfaces touched
- mobile-brand: 1 screen file + 1 component file (additive StatusPill extension)

## Data / contracts
- **APIs**: listMediaAssets (tag filter), getMediaUsage, getMediaUploadUrl, uploadFile (R2 signed URL), createMediaAsset, deleteMediaAsset, listReferenceLinks, createReferenceLink, updateReferenceLink, deleteReferenceLink, listBrandContracts — all unchanged
- **Money**: contract `influencer_fee + bonus_amount` = total displayed via `fmtRupees`
- **Storage**: usage_bytes / quota_bytes / used_pct / remaining_bytes — preserved
- **Image picker**: `mediaType: 'photo'`, `selectionLimit: 1`, `includeBase64: false` — preserved verbatim

## Non-functional
- Auth/role: unchanged
- KeyboardAvoidingView preserved on link editor modal
- Failure modes: QUOTA_EXCEEDED on getMediaUploadUrl → "Storage full" Alert; uploadFile network failure → Alert; createMediaAsset failure → Alert; delete failure → Alert; link save validation (title + url required) → Alert
