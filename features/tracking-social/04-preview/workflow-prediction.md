# Workflow Prediction — Tracking (social half)

Mockup: `mockups/tracking-lifecycle.html` §3 (Stage-5 dual panel).

## Predicted observable behaviour
1. Tracking opens from CollabDetail (hero / Performance section).
2. Social panel = aggregate reach + likes/comments/saves/shares/impressions + avg ER, with
   per-post breakdown; Refresh re-scrapes.
3. INFLX panel = "Coming soon (Phase 2)" placeholder, no real numbers.
4. No live posts → empty state.

## Known mockup-vs-build deltas (expected, not defects)
- The mockup's INFLX panel shows sample views/sales tagged "Phase 2"; the BUILD shows a
  placeholder with NO numbers (honest — the backend doesn't exist yet).
- Social numbers are live Instagram scrapes (vary).
