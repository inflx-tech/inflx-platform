# Expected Outputs — Collab detail

## UI
- `CollabDetailScreen` matches `04-preview/mockups/collab-lifecycle.html` §3: IG-clean
  header + 6-node progress spine, a bordered "next action" hero, then section rows
  (Contract / Deliverables / Earnings / Products / Logistics) that lock/unlock by stage.

## Behaviour / logic
- `heroFor(stage, record)` → { label, action, tone } deterministic per stage
  (unit-testable pure helper; no API).
- `sectionsFor(record)` → the ordered, stage-gated section list (Logistics only when
  `physical_delivery`; Earnings from `active` onward; etc.) — unit-testable.
- Load via `getMyCampaignDetail(ciId)`; error/empty states handled.

## Tests
- Mobile jest: unit tests for `heroFor` (every stage → correct action) and
  `sectionsFor` (gating), plus a module-load smoke test — all green.
- **Maestro (Rule-5 gate):** `open a collab → detail renders → correct hero for stage
  → tap a section → correct sub-screen` on a connected device.

## Non-regression
- Full mobile jest green.
- CollabsList rows now open CollabDetail (assert routing).
- OfferDetail/CampaignDetail still resolve when navigated to (kept for deep-links).
