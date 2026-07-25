# Workflow Prediction — Deliverable consolidation

Mockup: `mockups/deliverable-unified.html`.

## Predicted observable behaviour
1. Same screen from in-app list and from a content notification.
2. Submit section offers media upload (gallery/camera) AND a URL fallback + notes.
3. Timeline reflects the state; revision shows the danger card.
4. Live shows the performance stats panel + celebration; Refresh re-scrapes.

## Known mockup-vs-build deltas (expected, not defects)
- The mockup shows two representative states; the built screen renders all states
  (pending/revision/submitted/approved/live) from one component.
- Stats come from `getDeliverable`/`refreshStats` (Instagram scrape) — real numbers vary.
