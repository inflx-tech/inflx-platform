# Flow 25 — before/after diff notes

## Files touched
- **Modified**: `Packages/Mobile/src/components/brand/StatusPill.js` — additive 3 entries (draft, pending_influencer, pending_brand). Map now 34 entries.
- **Modified**: `Packages/Mobile/src/screens/brand/BrandMediaGalleryScreen.js` — full visual rewrite consuming brandPalette + ScreenHeader + StatusPill + EmptyState + Outfit/PJS/JetBrains-Mono fonts. SDK boundary preserved verbatim.
- **NOT touched**: theme/tokens.js, react-native-image-picker (SDK), uploadFile API (R2 boundary)

## Visual delta
| Element | Before | After |
|---|---|---|
| Header bg | surface (white) + border-bottom | ink topbar via `<ScreenHeader title="Media Gallery" back onBack>` |
| Header title | system bold 16 ink centered | Outfit-Bold 18 white centered + 30×3 yellow rule below |
| Tab bar | navy underline + navy active label | yellow underline + ink-bold active label |
| Tab label inactive | system 13 t3 | PJS-Bold 12.5 muted2 |
| Usage bar | colors.surface + colors.border, ink label, t3 remaining, surface2 track, fill navy/orange/red at 0/75/90 | brandPalette.white + border, sansBold ink label, mono muted2 remaining, bg2 track, fill ink/yellow-hover/danger |
| Usage warn line | colors.red | dangerText sansMedium |
| Filter chips | surface2 + t2 / navy + white active | bg2 + muted / ink + yellow-mono active |
| Upload button | navy bg + white system bold 13 | ink bg + yellow Outfit-Bold 13.5 letterSpacing 0.3 |
| Upload hint | system 10 t3 | PJS-Medium 9.5 muted2 lineHeight 14 |
| Asset card border | colors.border | brandPalette.border |
| Thumb fallback emoji | 🖼️/📄/📦 large emoji | mono [PHOTO]/[PDF]/[ZIP]/[DOC] uppercase letterSpacing 0.5 |
| Card title | system 12 bold t1 | Outfit-Bold 12 ink |
| Card meta | system 10 t3 | mono 9.5 muted2 |
| Action: Open | t3 fontWeight 700 system | yellowText sansBold |
| Action: Delete | red fontWeight 700 system | dangerText sansBold |
| Empty (Assets) | inline emoji 🖼️ + system bold + system sub | `<EmptyState icon="[PHOTOS]" />` dashed-yellow card |
| Section hint (Links) | system 11 t3 | PJS-Medium 11 muted lineHeight 16 |
| Add Link button | navy + white | ink + yellow Outfit-Bold (same as Upload) |
| Link card | colors.border | brandPalette.border + 12 radius (preserved) |
| Link title | system 13 bold t1 | Outfit-Bold 13 ink |
| Link URL | colors.navy 10 | info-blue mono 10 |
| Link desc | system 11 t3 | PJS-Medium 10.5 muted lineHeight 14 |
| Empty (Links) | inline emoji 🔗 | `<EmptyState icon="[LINKS]" />` |
| Modal backdrop | rgba(0,0,0,0.5) | unchanged |
| Modal body bg | colors.surface | brandPalette.white |
| Modal header title | system 16 bold t1 | Outfit-Bold 16 ink |
| Modal close × | system 24 light t3 | mono 22 muted2 (tighter visual weight) |
| Form label | system 11 bold t2 | mono-Bold 10 muted uppercase letterSpacing 0.4 |
| Form input | surface2 bg + 13 t1 | bg2 + PJS-Medium 13 ink (URL field mono 12) |
| Modal primary | navy + white | yellow + ink Outfit-Bold |
| Modal secondary | surface2 + t2 | bg2 + muted sansBold |
| Search input | surface + border | white + border + PJS-Medium 12.5 |
| Contract card | colors.border | brandPalette.border + 12 radius (preserved) |
| Contract campaign | system 14 bold t1 | Outfit-Bold 13.5 ink |
| Contract influencer | system 11 t3 | mono 10.5 muted2 |
| Contract status pill | inline STATUS_COLORS map (5 entries: hex literals) | canonical `<StatusPill>` (extended map handles draft/pending_influencer/pending_brand/active/cancelled) |
| Contract foot meta | system 10 t3 | mono 10 muted |
| Contract amount | navy fontWeight 700 | mono-Bold 12.5 ink |
| Empty (Contracts) | inline emoji 📝 | `<EmptyState icon="[DOCS]" />` |

## Behavior delta — zero behavioral change
**SDK boundary preserved verbatim:**
- launchImageLibrary({mediaType:'photo', selectionLimit:1, includeBase64:false})
- Response handling: didCancel → no-op; errorCode → Alert with errorMessage; assets[0] → doUpload
- doUpload: fileType guess regex preserved; fileSize = Number(file.fileSize) || 0; getMediaUploadUrl payload identical; uploadFile call identical (url/method/uri/name/type/key); createMediaAsset payload identical
- QUOTA_EXCEEDED error code → "Storage full" Alert (preserved)
- Try/catch around uploadFile + outer try/catch with finally setUploading(false)

**Other behaviors:**
| Behavior | Status |
|---|---|
| Tab-driven sub-component mount | Preserved |
| listMediaAssets(tagFilter) | Preserved (tagFilter triggers useEffect re-load via load callback dep) |
| getMediaUsage in parallel with listMediaAssets | Preserved verbatim |
| deleteMediaAsset success-path check (success / ok / status 204) | Preserved verbatim |
| openAsset: Linking.openURL OR "Unavailable" Alert | Preserved |
| listReferenceLinks + create/update/delete | Preserved |
| LinkEditorModal: title+url required validation | Preserved |
| LinkEditorModal: id-presence dispatches create vs update | Preserved |
| listBrandContracts + 3-field case-insensitive search | Preserved verbatim |
| Contract nav: c.pdf_url truthy → navigate; else "No PDF" Alert | Preserved |
| RefreshControl on all 3 tabs | Preserved (now yellow-tinted) |
| KeyboardAvoidingView on modal with iOS padding | Preserved |
| All Alert flows + Cancel/destructive style buttons | Preserved verbatim |

## StatusPill extension
Additive 3 entries in `STATUS_MAP_DEFAULT` (line numbers retained):
```js
draft:              { bg: P.bg2,        fg: P.muted2,     label: 'DRAFT' }
pending_influencer: { bg: P.yellowPale, fg: P.yellowText, label: 'AWAITING INFLUENCER' }
pending_brand:      { bg: P.yellowPale, fg: P.yellowText, label: 'YOUR TURN' }
```

**Verify-twice**: prior 31 entries byte-identical. Existing consumers
(Conversions / CampaignInfluencersList / Negotiation / etc.) all
unaffected. The contract statuses `active` and `cancelled` are already
mapped from Flow 22 — preserved.

## SDK boundary — explicit preservation
The `react-native-image-picker` + `uploadFile` (R2 signed URL) +
`getMediaUploadUrl` + `createMediaAsset` 4-step upload flow is the most
complex IO surface in the bucket. ZERO logic changes — only visual
treatment around the boundary (button colors, hint copy retained, Alert
flows preserved). The SDK module is NOT modified.

NATIVE_RUNTIME: not bumped. react-native-image-picker is already in
current APK; no new native module added.

## Wave-3 follower regression check
theme/tokens.js unchanged. 24 Wave-3 follower screens byte-identical.

## QA classification expectation
Per Flow 24 precedent: pre-warm backend → expect clean GREEN on first
run. If env-flake recurs (MSG91 / Render cold-start), classify per
Flow 19/21/23 — ship pending-cert. Flow 25 touched 1 mobile screen + 1
additive component change — zero web/backend/qa changes — zero causal
path to brand-web or API failures.

## What's NOT in this flow
- Bottom-sheet component extraction (defer until 5+ uses — currently at 4)
- Video upload (still Reference Links only per existing copy)
- PDF/ZIP upload (still web-only per existing copy)
- Real-time storage updates (relies on pull-to-refresh)
- Per-row file rename / re-tag (not in existing scope)
