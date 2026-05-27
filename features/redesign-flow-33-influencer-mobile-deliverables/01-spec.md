# Flow 33 — Influencer-mobile Deliverable List + Deliverable + Deliverable Detail · Spec

**Bucket**: mobile-influencer redesign (Wave 2)
**Flow position**: 6/23 (6th flow shipped in this bucket; preceding Flows 28–32 RELEASED)
**Owner**: founder
**Locked**: 2026-05-27

---

## 1 · Problem

Three core content-submission screens in the influencer mobile app are still on the legacy navy/teal/orange/red palette + DM Sans/Syne fonts:

- `DeliverableListScreen` (470 LOC) — per-campaign deliverable list w/ progress overview + action-needed sorting
- `DeliverableScreen` (676 LOC) — single deliverable view with media picker + R2 upload + URL fallback + live stats
- `DeliverableDetailScreen` (657 LOC) — alternate detail surface with 5-step status timeline + revision UI + live-URL submission

These are the most-trafficked screens in the post-contract influencer journey (every deliverable submission flows through them). They visually clash with the Flow 28-32 redesigned surface:

- Header uses navyDeep (off-brand vs ink-and-yellow Flow 28/30/31/32)
- Status badges use ad-hoc inline STATUS_CONFIG instead of canonical `StatusPill`
- Progress bar uses teal fill (off-brand vs yellow on Flow 31/32)
- Status timeline uses status-specific colors (off-brand vs unified yellow-active w/ ink-bordered current step from Flow 32)
- Revision card uses redPale + red border + plain feedback (visual stress without sufficient hierarchy)
- Picker buttons use surface2 dashed border2 + 📁/📹 emoji (off-brand vs ink-bordered dashed tiles with MCI icons)
- Upload progress fill uses navy (off-brand vs ink on rest of bucket)
- Primary CTAs use navy bg + white (off-brand vs ink+yellow Flow 30/31/32)
- Live CTA uses teal bg + white (off-brand vs success+white on Flow 31/32)
- Live celebration uses 🎉 emoji (off-brand vs yellow-tile MCI star from Flow 32 design call #4)
- Live stats grid uses surface2 + navy ER box (off-brand vs bg2 + yellowPale ER box)
- Engagement rate label uses lowercase + tight tracking (off-brand vs mono UPPERCASE)

## 2 · Goal

Visual + UX restyle of the 3 screens to brandPalette + Outfit/Plus Jakarta Sans/JetBrains Mono fonts + StatusPill canonical migration. Preserve **every** render branch, **every** API call, **every** sub-component, **every** state transition. Zero backend change. Zero StatusPill canonical-map additions (all 6 statuses already in the 43-entry map). Zero new SDK boundaries.

## 3 · Scope

### In-scope

- `Packages/Mobile/src/screens/influencer/DeliverableListScreen.js` (470 LOC) — full rewrite to brandPalette + fonts + StatusPill
- `Packages/Mobile/src/screens/influencer/DeliverableScreen.js` (676 LOC) — full rewrite preserving image-picker integration + 3-step R2 upload flow + 6-grid live stats
- `Packages/Mobile/src/screens/influencer/DeliverableDetailScreen.js` (657 LOC) — full rewrite preserving 5-step status timeline + 2-confirm Alert flows + revision feedback hierarchy

### Out-of-scope (no-touch list)

- `backend/**`, `backend/migrations/**` — zero backend change
- All 8 APIs preserved verbatim
- `react-native-image-picker` SDK boundary — already shipping (v7.1.2), no plumbing change
- `Packages/Mobile/android/**` — no native rebuild (NATIVE_RUNTIME=2 from Flow 28)
- All 5 previously shipped influencer screen flows (28-32)
- Wave-3 follower screens consuming `lightColors`
- `Packages/Mobile/src/components/StatusBadge.js` — replaced by canonical `StatusPill` import (StatusBadge file remains for any non-redesigned consumers)
- `Packages/Mobile/src/components/brand/StatusPill.js` — already includes all 6 deliverable statuses (pending, submitted, under_review, revision_requested, approved, live); zero additions

## 4 · Data / dependencies

### 4.1 · API calls preserved verbatim (8 endpoints)

| API | Source screen | Use |
|---|---|---|
| `getContractWithDeliverables(ciId)` | List + Detail | Contract + deliverables array |
| `getDeliverable(id)` | Screen | Fallback fetch + live-stats reload |
| `getUploadUrl(id, {filename, content_type})` POST | Screen | R2 signed PUT URL |
| `uploadFile(url, method, uri, name, type, key, onProgress)` | Screen | Direct R2 PUT via XHR with progress |
| `getMediaUrl(id)` | Screen | Post-upload preview |
| `submitDeliverable(id, {media_key/submitted_url, notes_to_brand?})` POST | Screen + Detail | Submit content for review |
| `submitLive(id, {live_url})` POST | Screen + Detail | Submit live URL for confirmation |
| `refreshStats(id)` POST | Screen | Apify-driven engagement scrape trigger |

All 8 endpoints exist in production today. Verified via `Packages/Mobile/src/services/api.js` lines 245-252.

### 4.2 · SDK boundary (react-native-image-picker v7.1.2)

Already installed + working in production today. No native rebuild required.

- `launchImageLibrary({ mediaType: 'mixed', videoQuality: 'high', selectionLimit: 1, includeBase64: false }, handlePickerResponse)`
- `launchCamera({ mediaType: 'video', videoQuality: 'high', durationLimit: 300 }, handlePickerResponse)`
- `handlePickerResponse(response)` — handles `didCancel`, `errorCode`, `assets[0]`; sets `selectedMedia` state

### 4.3 · DB columns referenced (read-only)

- `deliverables.status` ∈ {'pending', 'submitted', 'under_review', 'revision_requested', 'approved', 'live'}
- `deliverables.type` ∈ {'reel', 'post', 'story', 'youtube_video', 'youtube_short'}
- `deliverables.media_key` (R2 object key)
- `deliverables.media_type` (MIME type)
- `deliverables.submitted_url` (fallback URL when no media upload)
- `deliverables.submitted_at` / `live_confirmed_at` / `submission_deadline`
- `deliverables.live_url`
- `deliverables.brand_feedback` (revision feedback)
- `deliverables.revision_count` / `revision_limit`
- `deliverables.notes_to_brand` (optional submission note)
- `deliverables.content_requirements` (brief from brand)
- `stats.{likes, comments, saves, shares, reach, impressions, engagement_rate, scraped_at}`

### 4.4 · No new tables / no migrations

The 3 screens already consume only existing schema. Backend defect surface remains zero.

## 5 · Risk surface

- **MEDIUM risk** (not HIGH despite SDK boundary — image-picker already shipping; restyle only)
- **Image-picker integration**: preserve config (mediaType/videoQuality/selectionLimit/durationLimit) byte-for-byte
- **3-step upload state machine** (getUploadUrl → R2 PUT → submitDeliverable) preserved verbatim
- **`onprogress` XHR callback** driving uploadProgress (0..1 float) preserved
- **STATUS_PRIORITY sort** on List (action-first ordering: revision_requested=0, pending=1, submitted=2…) preserved
- **STATUS_TIMELINE 5-step** progression in Detail (`['pending', 'submitted', 'under_review', 'approved', 'live']`) preserved
- **revision_requested timeline override** (`getTimelineIndex` maps to submitted=idx 1; current dot shows danger "!" sigil)
- **2-confirm Alert flow** on submitContent + submitLive (Detail screen): "Cancel" + "Submit" before API call
- **isOverdue(deadline)** check + red-border treatment on List cards
- **5 per-row CTA branches** in List (pending/revision/approved-pre-live/approved-post-live/live)
- **Stats null-guard** with "No stats yet" empty state when refreshStats hasn't run
- **media_key vs submitted_url bifurcation**: existing-media preview vs URL link — separate render branches
- **useFocusEffect refresh** in List on tab-return preserved
- **No-fake-green**: any QA failure during web `pnpm qa` post-implementation classifies as env-flake / stale / drift / regression per usual taxonomy

---

## 6 · Success criteria (verifiable)

1. 3 screens render on brandPalette + Outfit/Plus Jakarta Sans/JetBrains Mono fonts
2. ALL 35 render branches preserved (per-screen audit in `06-diff/notes.md`)
3. ALL 8 APIs preserved verbatim
4. `StatusPill` canonical replaces ad-hoc `STATUS_CONFIG` on all 3 screens
5. `launchImageLibrary` + `launchCamera` configs unchanged byte-for-byte
6. 3-step R2 upload state machine + onprogress callback unchanged
7. 5-step STATUS_TIMELINE in Detail unchanged
8. 2-confirm Alert flow preserved on submit actions
9. Type-icon emojis (🎬📸📱▶️⚡) preserved per locked design call #4 split (KEEP type, DROP action)
10. Action emoji (🎉📁📹⏳⚠ ! ◉ ○ ✓ ★) dropped/replaced with MCI vectors per design call #4
11. Web `pnpm qa` 76/76 GREEN gate 0 first-run (dual-probe pre-warm)
12. OTA brand v83 / influencer v72 / follower v46 published
13. lock.json `release.released = true` after deploy
14. `06-diff/notes.md` non-empty (gov-check Rule 4)
