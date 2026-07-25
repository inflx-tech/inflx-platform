# Expected Outputs — Deliverable consolidation

## UI
- Unified `DeliverableScreen` matches `04-preview/mockups/deliverable-unified.html`
  (IG-clean): timeline + details + submit(upload+URL+notes) + live stats.

## Behaviour / logic
- `deliverableStatusMeta(status)` → { label, tone } (pending/submitted/under_review/
  approved/revision_requested/live) — pure, unit-testable.
- Loads by `deliverable` OR `deliverableId` (getDeliverable → {deliverable, stats}).
- Media upload state machine (getUploadUrl → uploadFile → submitDeliverable media_key) +
  URL fallback + submitLive + refreshStats all functional.

## Tests
- Mobile jest: unit test for `deliverableStatusMeta`; module-load smoke for the screen.
- **Maestro (Rule-5 gate):** open a deliverable in-app AND via notification → same screen;
  submit section shows upload + URL.

## Non-regression
- Full mobile jest green.
- Both route names (`Deliverable`, `DeliverableDetail`) resolve to the unified screen.
