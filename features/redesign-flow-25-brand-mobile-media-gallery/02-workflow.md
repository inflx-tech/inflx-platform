# Workflow Definition — Flow 25

## Actor
Logged-in brand on mobile app, reaches Media Gallery from BrandProfileScreen Other-links card.

## Preconditions
- Brand profile exists with at least 0+ media assets / reference links / signed contracts
- launchImageLibrary permissions granted (handled by host OS)

## Workflow steps

### Path A — Assets tab (default)
1. Mount: `<ScreenHeader title="Media Gallery" back onBack={goBack} />` (centered title variant for tab-driven screens).
2. Tab bar: 3 tabs (Assets / Links / Contracts) with yellow underline + yellowPale count chips on active.
3. Assets default → parallel load: listMediaAssets(tagFilter) + getMediaUsage.
4. Loading → centered yellow ActivityIndicator.
5. Usage bar (white card): "{usedMb} MB of {quotaMb} MB used" + "{remainingMb} MB free" mono right; track with fill colored by pct (90+ = danger, 75+ = yellow-hover, else ink). Warning text below if pct ≥ 90.
6. Filter chip strip (6 tag options): All/Logo/Brand Kit/Product/Document/Other. Active = ink + yellow mono.
7. Upload button (ink + yellow mono "+ Upload Photo") + hint sub-line (PJS muted).
8. Asset grid (2-col): per-card thumbnail (image OR mono [PHOTO]/[PDF]/[ZIP]/[DOC] placeholder) + title + size mono + Open/Delete row.
9. Empty → `<EmptyState icon="[PHOTOS]" title="No assets yet" sub="Upload logos and product shots to reuse in campaigns." />`.
10. Upload flow: launchImageLibrary({photo, single, no base64}) → file.uri picked → doUpload(file, fileName) → getMediaUploadUrl → uploadFile(R2 signed URL) → createMediaAsset(r2_key, metadata) → reload list.
11. Delete: Alert confirmation → deleteMediaAsset → reload.
12. Open: Linking.openURL(download_url) OR Alert "Unavailable" if no download_url.

### Path B — Links tab
1. Loading → centered yellow spinner.
2. Header hint (PJS muted) + "+ Add Link" button (ink + yellow mono).
3. Link cards: emoji icon (preserved per-URL-type) + title (Outfit Bold) + URL (info mono small) + (optional) description + Edit/Delete row.
4. Empty → EmptyState `[LINKS]` icon.
5. Tap card → Linking.openURL(link.url).
6. Edit/Add: opens LinkEditorModal — bottom-sheet via Modal + KeyboardAvoidingView. Title + URL + Description form; "Save" (yellow + ink) + "Cancel" (bg2 + muted) actions; validation requires title + url non-empty.

### Path C — Contracts tab
1. Loading → centered yellow spinner.
2. Search input (white + border) at top filters by campaign_name / influencer_name / influencer_handle.
3. Contract cards: campaign name (Outfit) + influencer + handle meta + `<StatusPill status={c.status}>` (canonical map handles draft/pending_influencer/pending_brand/active/cancelled — extended in this flow) + fmtRupees total + date mono.
4. Tap card → if `c.pdf_url` exists → navigate('ContractPdf', { contractId, role: 'brand' }); else Alert "No PDF" "This contract does not have a PDF yet."
5. Empty → EmptyState `[DOCS]` icon.

## Success
- All 3 tabs render with brandPalette + Outfit/PJS/Mono throughout
- Upload flow resolves to existing R2 + DB writes
- StatusPill renders all 5 contract statuses correctly (with 3 new map entries)
- Link editor modal save / cancel work
- Search filter works on all 3 contract fields
- pnpm qa green (no overlap; expect modulo env-flake)

## Failure / edge
- launchImageLibrary cancelled → no-op (preserved)
- launchImageLibrary errorCode → Alert with errorMessage
- File type missing or invalid → fallback to 'image/jpeg' (preserved)
- QUOTA_EXCEEDED error code → "Storage full" Alert (not generic "Upload failed")
- Network errors during uploadFile → Alert with caught e.message
- createMediaAsset post-upload failure → Alert (file uploaded but not recorded — preserved current behavior)
