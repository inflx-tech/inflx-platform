# Before / After — Tracking (social half)

**Before:** the Collabs lifecycle named a **Tracking** stage but had no screen; a
tracking-stage collab just fell back to the Deliverables list. Per-post social stats
existed only on the individual DeliverableScreen (no collab-level roll-up); the
platform/sales axis had nowhere to live.

**After:** a per-collab `CollabTrackingScreen` (IG-clean):
- **On social media** panel — aggregates reach + likes/comments/saves/shares/impressions
  and average engagement-rate across the collab's live deliverables (backed by
  `deliverable_stats`), with a per-post breakdown and a Refresh (re-scrape).
- **On INFLX** panel — an honest **"Coming soon (Phase 2)"** placeholder (post views/saves/
  sales) with **no fabricated numbers**; the real platform analytics + post-level sales
  attribution are a gated Phase-2 backend contract.
- Empty state when the collab has no live posts yet.

## Wiring
- `collabDetailModel`: tracking-stage hero action → `tracking`; `sectionsFor` adds a
  **Performance** section for post-sign collabs. (Model tests updated.)
- `CollabDetailScreen.go('tracking')` → `CollabTracking`; registered in the Collabs stack.
- `aggregateSocialStats(list)` pure helper.

## Mockup → build fidelity
Mockup `04-preview/mockups/tracking-lifecycle.html` §3 (dual panel) — **matches**; the
build's INFLX panel deliberately shows a placeholder (no numbers) rather than the mockup's
sample figures, because the backend doesn't exist yet.

## Verification status
- `aggregateSocialStats` unit tests (sums, ER averaging, null-safety) + CollabTracking
  module-load smoke + updated collabDetailModel tests.
- Full mobile jest: **78/78 green** (18 suites).
- **Pending (device gate):** Maestro — open Tracking from a collab with a live post →
  social aggregate renders; INFLX panel shows the Phase-2 placeholder.
