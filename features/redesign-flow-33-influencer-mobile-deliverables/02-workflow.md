# Flow 33 — Workflow

**Actor**: Influencer (logged-in, role=`influencer`, post-contract).

## A · DeliverableListScreen (per-campaign list)

### Preconditions
- Contract signed (`campaign_influencers.status` ∈ {'contracted', 'active', 'live', 'completed'}).
- User tapped "Deliverables" tile on `CampaignDetailScreen` → navigates with `{ campaign_influencer_id, campaign_name, brand_name }` route params.

### Steps
1. `fetchData()` issues `getContractWithDeliverables(ciId)` on mount and on tab-focus.
2. On success, server returns `{ contract, deliverables: [...] }`.
3. Items are sorted client-side by `STATUS_PRIORITY` (revision_requested=0, pending=1, submitted=2, under_review=3, approved=4, live=5).
4. Renders:
   - Ink header w/ "Deliverables" + "Brand — Campaign" sub
   - Progress card: yellow-fill bar (% live), mono "X of Y completed", chip row (needs action / in review / approved)
   - Per-deliverable card with type emoji + Outfit-Bold type + mono date meta + StatusPill canonical
   - Per-card CTA chip in 1-of-5 tints per status (warn / danger / info / success-pre-live / success-post-live)
   - `action` border = yellow 1.5px when status ∈ {pending, revision_requested}
   - `overdue` border = danger 1.5px when status ∈ {pending, revision_requested} AND deadline < now
5. Tap on a card → `navigation.navigate('DeliverableDetail', { deliverable, campaign_name, brand_name })`.
6. Pull-to-refresh available via `RefreshControl`.

### Failure modes
- API error → red error card with retry button
- Empty deliverables → "No Deliverables Yet" placeholder

### Success state
Influencer sees clear action-first list with status pills + per-row CTAs guiding them to the right next action.

---

## B · DeliverableScreen (submission surface)

### Preconditions
- Route params: `{ deliverable, deliverableId? }`.
- If only `deliverableId` provided, screen falls back to `getDeliverable(id)`.

### Steps
1. Mount → if no initial deliverable, fetch via `getDeliverable(deliverableId)`.
2. If `media_key` present → fetch `getMediaUrl(id)` for preview.
3. If status='live' → fetch existing stats via `getDeliverable(id).stats`.
4. Renders ink header w/ inline StatusPill canonical + deadline sub.
5. Info card with mono Type / Revisions rows + bg2 Content Brief box.
6. **Conditional cards** based on status:
   - `revision_requested` AND `brand_feedback` → dangerPale revision card with white feedback body
   - `media_key` present → "Submitted Content" card with Image or video play tile
   - `submitted_url` present AND no media_key → "Submitted URL" card with info-link
   - `canSubmit` (pending OR revision_requested) → "Upload Content" card:
     - Selected media preview (if any) w/ ink-tiled MCI video icon + mono filename + REMOVE link
     - Upload progress (if uploading) w/ ink-fill bar + mono %
     - Picker tiles (if no media + not uploading) — 2 dashed ink-bordered tiles w/ yellowPale MCI image-multi + video icons
     - Ink/yellow UPLOAD & SUBMIT FOR REVIEW CTA (if media selected)
     - Divider "OR" + URL input + ink/yellow SUBMIT URL FOR REVIEW CTA
   - `live_url` present → "Live Post" card with info-link
   - `approved` AND `!live_url` → "Submit Live Post URL" card with success-bg MARK AS LIVE CTA
   - `submitted` → yellowPale wait-tile w/ MCI clock + "Waiting for Brand Review" copy
   - `live` → "Live Performance" card with ink REFRESH button + 6-grid stats + yellowPale ER box
7. Media picker flow:
   - `pickFromGallery()` → `launchImageLibrary` w/ mediaType:'mixed', videoQuality:'high', selectionLimit:1
   - `recordVideo()` → `launchCamera` w/ mediaType:'video', videoQuality:'high', durationLimit:300
   - `handlePickerResponse(response)` → sets `selectedMedia` if not cancelled/error
8. Upload flow (`handleMediaUpload`):
   - Step 1: `getUploadUrl(id, { filename, content_type })` → receives `{ url, key, method }`
   - Step 2: `uploadFile(url, method, uri, name, type, key, onProgress)` → XHR PUT to R2 with progress callback
   - Step 3: `submitDeliverable(id, { media_key, media_type })` → success Alert + reload deliverable
9. URL fallback flow (`handleUrlSubmit`):
   - `submitDeliverable(id, { submitted_url })` → success Alert + reload
10. Live URL flow (`handleSubmitLive`):
    - `submitLive(id, { live_url })` → success Alert + reload
11. Stats refresh (`handleRefreshStats`):
    - `refreshStats(id)` → Apify-trigger; success Alert + update `stats` state

### Failure modes
- Picker error → Alert with errorMessage
- Upload URL fetch fail → Alert + reset uploading state
- R2 PUT fail → Alert "Upload Failed" + reset
- Submit fail → Alert with error message
- Live submit fail → Alert
- Stats refresh fail → Alert

### Success state
Influencer submits content (via media upload or URL), watches it progress through brand review, and ultimately confirms live with engagement stats visible.

---

## C · DeliverableDetailScreen (alternate detail with timeline)

### Preconditions
- Route params: `{ deliverable, campaign_name, brand_name }` (from List).

### Steps
1. `refreshData()` issues `getContractWithDeliverables(ciId)` on pull-to-refresh.
2. Renders:
   - Ink header w/ inline StatusPill canonical + brand·campaign sub
   - **Status Timeline card** (5 steps: pending → submitted → under_review → approved → live)
     - Yellow-active dot for completed steps
     - Ink-bordered yellow current dot
     - Danger dot + "!" sigil for revision_requested (overrides step 2 = submitted)
     - Numbered placeholders for incomplete steps
   - Details card (mono detail rows: Type / Status / Deadline / Submitted / Confirmed Live / Revisions Used + bg2 Content Brief box)
   - **Submitted Content card** (if submitted_url present) with bg2 url-box + Notes-to-Brand sub-box
   - **Revision card** (if revision_requested + brand_feedback): dangerPale + danger border + dangerText "REVISION REQUESTED" title with white feedback body + mono REVISION X of Y meta line
   - **Live URL card** (if live_url present) with info-link
   - **Submit Content card** (if canSubmitContent = pending OR revision_requested):
     - URL input (ink-bordered)
     - Notes-to-brand input (muted-bordered) — optional
     - 2-confirm Alert flow → submitDeliverable
     - Ink/yellow RESUBMIT FOR REVIEW (or SUBMIT FOR REVIEW) CTA
   - **Submit Live URL card** (if canSubmitLive = approved AND !live_url):
     - URL input (ink-bordered)
     - 2-confirm Alert flow → submitLive
     - success/white SUBMIT LIVE URL CTA
   - **Live Celebration card** (if isLive): white card with yellow-tile MCI star + ink Outfit-Black "Content is Live!" + body about T2 + mono confirmed-date

### Failure modes
- Refresh API error → silent (refresh stops, no alert)
- Submit failures → Alert with error message
- 2-confirm Alert allows Cancel

### Success state
Influencer sees clear status progression, addresses revision feedback if any, submits content/live URL via guarded confirm flow, and celebrates when live.

---

## Edge cases (all preserved verbatim)

- **No `campaign_influencer_id`** → "No campaign data" empty state
- **No `deliverable`** → "No deliverable data" empty state
- **No `media_key` + no `submitted_url`** → No submission preview cards
- **No `brand_feedback` on revision** → Revision card hidden (only render when feedback present)
- **`revision_count = 0`** → Revisions Used row hidden
- **No `content_requirements`** → Brief box hidden
- **No `submission_deadline`** → Deadline row hidden
- **Deadline < now** AND status ∈ {pending, revision_requested} → red overdue treatment on List + Detail
- **Stats engagement_rate null** → ER box hidden
- **Stats scraped_at null** → "Last updated" hint hidden
- **Stats null entirely** → "No stats yet. Tap Refresh Stats…" empty state
- **Upload progress at 1.0** → CTA disabled; submit step in flight
