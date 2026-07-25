# Before / After — Deliverable consolidation

**Before:** two divergent single-deliverable screens. `DeliverableScreen` had media
picker + R2 upload + live stats but was reachable ONLY via push-notification deep-link;
`DeliverableDetailScreen` (the in-app destination) had URL-only submit + 5-step timeline +
notes-to-brand + confirm dialogs. Same task, different tools depending on how you arrived.
Both old-ink (brandPalette).

**After:** ONE IG-clean `DeliverableScreen` with the union — status timeline + details/brief
+ submitted-content preview (media OR url) + revision card + a submit section offering
**media upload (gallery/camera → R2) AND a URL fallback + notes + 2-step confirm** +
submit-live + **live performance stats** + celebration. Loaded by `deliverable` object OR
`deliverableId` (getDeliverable → {deliverable, stats}); pull-to-refresh.

## Convergence (both doors → one screen)
- `InfluencerNavigator`: the `DeliverableDetail` route (in-app, from DeliverableList) and
  the `Deliverable` route (notification deep-link) BOTH now resolve to the unified
  `DeliverableScreen` — in the Home + Collabs stacks. No caller changes needed.
- `DeliverableDetailScreen.js` retired (unused; deleted in the later cleanup contract).

## Mockup → build fidelity
Mockup `04-preview/mockups/deliverable-unified.html`: submit (upload+URL) + live-stats
states — **matches**. All states render from the one component.

## Known deltas (expected, not defects)
- Sub-screen is IG-clean now (old screens were ink) — intended restyle.
- Stats are live Instagram scrapes (getDeliverable/refreshStats) — numbers vary.

## Verification status
- `deliverableStatusMeta` unit test + module-load smoke: `__tests__/deliverableConsolidation.test.js`.
- Added `react-native-image-picker` jest mock (native module; standard stub, not fake-green).
- Full mobile jest: **73/73 green** (16 suites).
- All 4 route registrations (Deliverable/DeliverableDetail × Home/Collabs) → DeliverableScreen.
- **Pending (device gate):** Maestro — open a deliverable in-app AND via notification → same
  screen; submit shows upload + URL; live shows stats.
