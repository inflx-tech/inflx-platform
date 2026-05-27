# Flow 33 — Expected outputs

## Per-screen rendered output assertions

### DeliverableListScreen

| State | Expected render |
|---|---|
| Loading | "Loading deliverables..." + yellow ActivityIndicator |
| Error | Error card with retry button |
| Empty | 📋 emoji + "No Deliverables Yet" placeholder |
| Loaded — progress | Yellow-fill bar + mono "X of Y completed" + chip row |
| Loaded — pending card | Yellow border + warn-tone CTA "UPLOAD {type}" |
| Loaded — revision_requested card | Danger border (if overdue) + danger-tone CTA "REVISION NEEDED — TAP TO RESUBMIT" |
| Loaded — submitted card | Standard border + info-tone CTA "UNDER BRAND REVIEW — WAITING" |
| Loaded — approved pre-live | Success-tone CTA "APPROVED — TAP TO SUBMIT LIVE URL" |
| Loaded — approved post-live URL | Info-tone CTA "LIVE URL SUBMITTED — AWAITING BRAND CONFIRMATION" |
| Loaded — live card | Success-tone CTA "LIVE AND CONFIRMED" |

### DeliverableScreen

| State | Expected render |
|---|---|
| Loading | Full-screen yellow ActivityIndicator |
| No deliverable | "No deliverable data" empty |
| Pending + no media | Picker tiles + URL fallback |
| Pending + media selected | Preview box + UPLOAD & SUBMIT CTA |
| Uploading | Upload progress bar + ink-fill + disabled CTA |
| Submitted | Yellow-tile MCI clock wait card |
| Approved + no live URL | Submit Live URL form with success CTA |
| Approved + live URL submitted | Live Post link card (info-blue) |
| Live | Live Performance stats grid + yellowPale ER box + ink REFRESH btn |
| Revision_requested + brand_feedback | dangerPale revision card + RESUBMIT CTA |

### DeliverableDetailScreen

| State | Expected render |
|---|---|
| Pending | Timeline w/ ink-bordered yellow current dot at step 0 + Submit Content card |
| Submitted | Timeline at step 1 + waiting state |
| Under review | Timeline at step 2 |
| Revision_requested | Timeline at step 1 w/ danger fill + "!" sigil + dangerPale revision card |
| Approved | Timeline at step 3 + Submit Live URL card |
| Live | Timeline at step 4 + Live Celebration card (yellow-tile MCI star, ink title) + Live URL link |

## Data assertions

- DeliverableList sort: `STATUS_PRIORITY[status]` ascending (revision_requested=0 first)
- Progress completed = `deliverables.filter(d => d.status === 'live').length`
- Progress needsAction = `deliverables.filter(d => ['pending', 'revision_requested'].includes(d.status)).length`
- isOverdue = `new Date(deliverable.submission_deadline) < new Date()`
- Timeline currentTimelineIdx via `getTimelineIndex(status)` (revision_requested → 1)
- Upload progress reflects XHR `onprogress` callback (0..1)
- Stats engagement rate = `parseFloat(stats.engagement_rate).toFixed(2) + '%'`

## Visual evidence

Side-by-side comparison via `pnpm diff:open redesign-flow-33-influencer-mobile-deliverables` after implementation:

- `before` = `04-preview/mockups/web.html` rendered at 375×760 (5 frames: List, Screen-pending, Screen-uploading, Detail-revision, Detail-live)
- `after` = founder physical smoke-test on installed APK (NATIVE_RUNTIME=2)
- `notes.md` will document per-screen palette + font + branch-preservation evidence

## Backend assertions (no new endpoints)

- `getContractWithDeliverables` returns same shape as Flow 31 consumes
- `getUploadUrl` returns `{ url, key, method }` — used in 3-step R2 upload
- `submitDeliverable` accepts both `{ media_key, media_type }` AND `{ submitted_url, notes_to_brand? }` payloads
- `submitLive` accepts `{ live_url }` payload
- `refreshStats` triggers Apify scrape + returns `{ stats: {...} }` on success
