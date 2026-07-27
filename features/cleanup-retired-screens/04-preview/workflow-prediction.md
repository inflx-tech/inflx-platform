# Workflow Prediction — Cleanup

Mockup: `mockups/nav-inventory.html` (deleted vs remaining).

## Predicted observable behaviour
- None visible to the user — the app behaves identically; only dead files/registrations
  are removed. Bundle is marginally smaller.

## Known deltas
- The 7 route names (OfferDetail, OfferList, MyCampaignsList, CampaignDetail,
  CampaignCompletion, MyPosts) no longer exist; nothing live referenced them.
  `DeliverableDetail` remains (→ DeliverableScreen).
