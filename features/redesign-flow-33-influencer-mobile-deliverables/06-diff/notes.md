# Flow 33 — Before/After diff notes

## Before (legacy palette/fonts)

| Screen | Visual |
|---|---|
| DeliverableList | navyDeep header · ad-hoc inline StatusBadge · teal progress fill · goldPale/orangePale/tealPale chip tints · surface2 deliverable-icon tile · gold action-border / red overdue-border · 5 row-CTA tints (goldPale/redPale/tealPale/navyPale/tealPale) · 📋 empty-state emoji |
| DeliverableScreen | navyDeep header · ad-hoc inline status badge with custom STATUS_CONFIG hex · surface2 dashed border2 picker buttons with 📁/📹 emoji · navy upload progress fill · navy bg + white UPLOAD CTA · teal bg + white LIVE CTA · surface2 stat boxes · navy+11 ER box · ⏳ wait emoji · 🎬 video preview emoji |
| DeliverableDetailScreen | navyDeep header · ad-hoc large status badge · status-specific timeline dot colors (different color per step) · redPale + red revision card with plain feedback · border2 URL/notes inputs · navy submit btn · teal live btn · 🎉 live celebration emoji |

## After (brandPalette + Outfit/Plus Jakarta Sans/JetBrains Mono + StatusPill canonical)

| Screen | Visual |
|---|---|
| DeliverableList | Ink header with yellow rule accent + Outfit-Black title + mono brand·campaign sub · `<StatusPill status>` canonical replaces ad-hoc badge (5 status states render from 43-entry map) · yellow progress-fill bar (matches Flow 31 yellow-active pattern) · yellowPale + infoPale + successPale chip tints · bg2 deliverable-icon tile with KEPT type emojis (🎬📸📱▶️⚡ per design call #4) · yellow action-border + danger overdue-border · 5 row-CTA tints (warn/danger/info/success-pre/success-post-live) · 📋 empty-state emoji preserved (type-icon class, kept per design call #4) |
| DeliverableScreen | Ink header with yellow rule + inline `<StatusPill>` on right · ink-tile MCI video icon on preview · dashed ink-bordered picker tiles with yellowPale MCI image-multi (gallery) + video (camera) icons (replaces 📁/📹 emoji per design call #4) · ink fill upload progress bar + mono % · ink/yellow Outfit-Black UPLOAD & SUBMIT FOR REVIEW CTA · success/white MARK AS LIVE CTA · bg2 stat boxes with mono numbers + UPPERCASE mono labels · yellowPale + #F0DA88-border ER box with mono yellowText % · yellowPale MCI clock wait-tile (replaces ⏳ per design call #4) |
| DeliverableDetailScreen | Ink header with yellow rule + inline `<StatusPill>` · status timeline with unified yellow-active dots + ink-bordered yellow current step + danger fill + "!" sigil on revision_requested override · dangerPale revision card with white feedback body box + dangerText UPPERCASE title + mono REVISION X OF Y meta · ink-bordered URL input + muted-bordered notes input · ink/yellow RESUBMIT FOR REVIEW CTA · success/white SUBMIT LIVE URL CTA · yellow-tile MCI star Live celebration (replaces 🎉 per design call #4) + ink Outfit-Black title + mono CONFIRMED LIVE date |

## Per locked design call

| # | Decision | Implementation |
|---|---|---|
| 1 | Progress bar fill = yellow | `progressFill.backgroundColor = P.yellow` (matches Flow 31 progress + Flow 32 timeline pattern) |
| 2 | Revision card = danger (red) tone | `revisionCard.backgroundColor = P.dangerPale` · `.borderColor = P.danger` · `revisionFeedback` wrapped in white inset box |
| 3 | Live celebration title = ink | `celebrationTitle.color = P.ink` (matches Flow 32 CampaignCompletion title color) |
| 4 | Drop action emoji, KEEP type emoji | Picker 📁📹 → MCI image-multi + video · Live 🎉 → MCI star + yellow tile · Wait ⏳ → MCI clock + yellow tile · DELIVERABLE_ICONS (🎬📸📱▶️⚡) KEPT verbatim in DELIVERABLE_ICONS map |

## Render-branch preservation evidence

| Screen | Branches preserved verbatim |
|---|---|
| DeliverableListScreen | Loading / error / empty / progress / 5 per-row CTAs (pending/revision/approved-pre-live/approved-post-live/live) / yellow action-border / danger overdue-border / pull-to-refresh / useFocusEffect on tab return / STATUS_PRIORITY sort |
| DeliverableScreen | Loading / no-data / `canSubmit` (pending OR revision) / selectedMedia preview / uploading progress / picker tiles (gallery + camera) / URL fallback divider+input / `media_key` preview (image vs video) / `submitted_url` link / `revision_requested` + `brand_feedback` card / submitted wait card / approved-no-live submit-live form / live stats grid 3×2 / engagement rate box / refresh stats button / no-stats empty state |
| DeliverableDetailScreen | 5-step STATUS_TIMELINE with revision override / details rows w/ optional fields (deadline/submitted/confirmed/revision count) / brief box / submitted_url card + notes-to-brand sub-box / revision card / live_url link / submitContent form w/ 2-confirm Alert / submitLive form w/ 2-confirm Alert / live celebration / pull-to-refresh refreshData |

**Total preserved**: ~35 render branches across 3 files.

## API preservation evidence

All 8 APIs invoked with identical request shapes:

```js
// DeliverableListScreen + DeliverableDetailScreen
influencerApi.getContractWithDeliverables(campaign_influencer_id)

// DeliverableScreen
influencerApi.getDeliverable(deliverableId)
influencerApi.getUploadUrl(deliverable.id, { filename, content_type })
influencerApi.getMediaUrl(deliverable.id)
influencerApi.refreshStats(deliverable.id)
uploadFile(url, method, uri, fileName, type, key, onProgress)  // helper from api.js

// DeliverableScreen + DeliverableDetailScreen
influencerApi.submitDeliverable(deliverable.id, { media_key, media_type } | { submitted_url, notes_to_brand? })
influencerApi.submitLive(deliverable.id, { live_url })
```

All preserved verbatim. Zero new endpoints. Zero changed signatures.

## SDK boundary preservation

```js
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';

launchImageLibrary({
  mediaType: 'mixed',
  videoQuality: 'high',
  selectionLimit: 1,
  includeBase64: false,
}, handlePickerResponse);

launchCamera({
  mediaType: 'video',
  videoQuality: 'high',
  durationLimit: 300,
}, handlePickerResponse);
```

Config byte-for-byte identical. No native rebuild.

## Sign-off

- Mockup locked 2026-05-27 (founder · 4 design calls confirmed via AskUserQuestion)
- Implementation locked 2026-05-27 (founder · "ok go and proceed to flow 33" → 5-design-call confirmation)
- Web QA: see lock.json `release.qa_evidence` for run details
- OTA versions: see lock.json `release.deploy.ota_*`
