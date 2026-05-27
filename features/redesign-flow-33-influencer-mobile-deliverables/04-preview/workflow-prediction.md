# Flow 33 — Workflow prediction (mockup → backend source mapping)

Verifying every tile/metric in the mockup traces to a real backend field/aggregate. Read via the actual controller / SQL in `backend/src/`.

## DeliverableList tiles

| Mockup element | Backend source |
|---|---|
| "Sparkle Cosmetics — Diwali Glow-Up" sub | Route params (passed from CampaignDetail) |
| Progress bar % | `deliverables.filter(d.status==='live').length / deliverables.length * 100` |
| "1 of 4 deliverables completed" | Same — live count / total |
| "2 needs action" chip | `deliverables.filter(d.status ∈ {pending, revision_requested}).length` |
| "1 in review" chip | `deliverables.filter(d.status ∈ {submitted, under_review}).length` |
| "1 live" chip | `deliverables.filter(d.status === 'live').length` |
| Per-card type emoji (🎬📸📱▶️⚡) | `DELIVERABLE_ICONS[deliverable.type]` (5-key map) |
| "Instagram Reel" type label | `DELIVERABLE_LABELS[deliverable.type]` (5-key map) |
| "Due: 10 Nov 2026" / "Overdue — 5 Nov 2026" | `deliverable.submission_deadline` + isOverdue(deadline) |
| "Submitted: 8 Nov 2026" | `deliverable.submitted_at` |
| Status pill (PENDING/SUBMITTED/REVISION/LIVE) | `StatusPill status={deliverable.status}` (canonical map) |
| Row CTA tint + text | Function of `deliverable.status` + `live_url` presence |

## DeliverableScreen tiles

| Mockup element | Backend source |
|---|---|
| Status pill in header | `StatusPill status={deliverable.status}` |
| "Deadline: 10 Nov 2026" | `deliverable.submission_deadline` |
| Type detail row | `deliverable.type` |
| Revisions detail row | `deliverable.revision_count + ' / ' + deliverable.revision_limit` |
| Content Brief box | `deliverable.content_requirements` |
| Selected media preview filename | `selectedMedia.fileName` (client-side) |
| Selected media size + duration | `selectedMedia.fileSize / 1024 / 1024 .toFixed(1) MB` + `selectedMedia.duration` |
| Upload progress % | `uploadProgress * 100` (client-side, XHR onprogress) |
| 6-grid stats (likes/comments/saves/shares/reach/impressions) | `stats.{likes, comments, saves, shares, reach, impressions}` (Apify scraped) |
| Engagement rate % | `parseFloat(stats.engagement_rate).toFixed(2)` |
| "Last updated" hint | `stats.scraped_at` |

## DeliverableDetail tiles

| Mockup element | Backend source |
|---|---|
| Status pill in header | `StatusPill status={deliverable.status}` |
| Timeline dot active flag | `getTimelineIndex(status) >= step_idx` |
| Timeline current step + revision sigil | `status === 'revision_requested' && idx === 1` |
| "Revision 1 of 2" meta | `deliverable.revision_count + ' of ' + deliverable.revision_limit` |
| Revision feedback body | `deliverable.brand_feedback` |
| "Submitted: 8 Nov 2026 14:32" detail row | `deliverable.submitted_at` (formatDateTime) |
| "Confirmed Live: 12 Nov 2026 09:15" detail row | `deliverable.live_confirmed_at` (formatDateTime) |
| Live celebration "Confirmed live on 12 Nov 2026" | `deliverable.live_confirmed_at` (formatDate) |
| Submitted Content URL | `deliverable.submitted_url` |
| Notes to Brand box | `deliverable.notes_to_brand` |
| Live URL link | `deliverable.live_url` |

## Zero phantom

Every mockup metric traces to a real DB field, a derived computation on real fields, or a route param. No tile invented during mockup phase. `feedback_backend_first_tiles` satisfied.
