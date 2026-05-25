# Expected Outputs — Flow 25

## StatusPill canonical map extension (NEW — 3 entries)

| Status | Bg / Fg | Label |
|---|---|---|
| `draft` | bg2 / muted2 | DRAFT |
| `pending_influencer` | yellowPale / yellowText | AWAITING INFLUENCER |
| `pending_brand` | yellowPale / yellowText | YOUR TURN |

Total `STATUS_MAP_DEFAULT` entries now: 34.

`active` and `cancelled` already mapped from Flow 22 (active → successPale, cancelled → dangerPale). Their existing labels stand.

## Header
- `<ScreenHeader title="Media Gallery" back onBack={goBack} />` (centered-title variant)

## Tab bar
- 3 tabs: Assets / Links / Contracts
- Active: yellow underline + ink-bold label
- Inactive: muted2 sansBold label, no underline

## Assets tab outputs

| Element | Output |
|---|---|
| Usage bar | white card + border. Top row: PJS Bold ink "X.X MB of N MB used" + mono small muted2 "Y MB free" right. Track: 6px bg2 with fill colored by pct (≥90 = danger / ≥75 = yellowHover / else ink). Warning red text below at ≥90. |
| Filter chips | Horizontal scroll: 6 tag chips. Active = ink + yellow mono. Inactive = bg2 + muted sansBold. |
| Upload button | Full-width ink bg + yellow Outfit-Bold "+ Upload Photo". Disabled state opacity 0.6 with "Uploading…" label. |
| Upload hint | PJS Medium 10 muted2 center "Photos only · max 25 MB. For videos, add a Reference Link. For PDFs and ZIPs, use the web dashboard." |
| Asset card (grid 2-col) | white + border + 12 radius. Thumb 1:1 aspect bg2 + image OR mono [PHOTO/PDF/ZIP/DOC] placeholder. Body: Outfit-Bold 12 title 1-line + mono muted size. Action row: Open (yellowText) / Delete (dangerText) sansBold buttons. |
| Empty | EmptyState `[PHOTOS]` icon + "No assets yet" + "Upload logos and product shots to reuse in campaigns." |

## Links tab outputs

| Element | Output |
|---|---|
| Hint copy | PJS Medium 11 muted "URLs to YouTube, Drive, Figma, Notion — anything you'd normally share by link. Zero storage cost." |
| + Add Link | Full-width ink + yellow Outfit-Bold pill |
| Link card | white + border + 12 radius row. Big emoji icon left + flex-mid (Outfit-Bold title + mono info url + PJS muted description) + Edit/Delete actions right (yellowText / dangerText). |
| Empty | EmptyState `[LINKS]` icon + "No links yet" + "Tap "Add Link" to save a YouTube reel, Drive folder, or any other URL." |
| LinkEditorModal | Bottom-sheet with rounded-top + ink-header bar with sansBold title + mono × close. mono labels + PJS-medium inputs + bg2 input bg. Footer: bg2 Cancel + yellow Save (ink Outfit-Bold). |

## Contracts tab outputs

| Element | Output |
|---|---|
| Search input | white + border + PJS Medium 13 placeholder "Search campaigns or influencers…" |
| Contract card | white + border + 12 radius. Head row: Outfit-Bold campaign + mono muted2 "Influencer · @handle" + StatusPill right. Foot row: mono muted "DD MMM YYYY · goal" left + mono ink Bold rupees right. |
| Empty | EmptyState `[DOCS]` icon + "No contracts yet" + "Signed contracts with influencers appear here for quick access." |

## Data assertions
- Asset upload: getMediaUploadUrl payload `{ file_name, file_type, file_size_bytes }`; uploadFile(url, method, file.uri, fileName, fileType, key); createMediaAsset `{ title, file_r2_key: key, file_name, file_type, file_size_bytes }`
- Asset delete: deleteMediaAsset(id) — success path checks `res.success || res.ok || res.status === 204`
- Link save: payload `{ title, url, description: trimmed || null }` for both create and update
- Link delete: same success-path check as asset
- Contract nav: `c.pdf_url` truthy → `navigate('ContractPdf', { contractId: c.id, role: 'brand' })`; else "No PDF" Alert
- Contract search: case-insensitive `includes` on campaign_name / influencer_name / influencer_handle

## Visual evidence
`design/wave2/flow-25-brand-mobile-media-gallery/web.html` — 1 phone showing Assets tab + 2 sub-mockups (Links tab card + Contracts tab card + LinkEditor modal)
