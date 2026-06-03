# Workflow Prediction — offer-engine-library-ui (Sub-contract B)

Mockups in `04-preview/mockups/` (copied from the feature-wide set):
- `01-offers-list.html` — the `/dashboard/offers` library (stats, tabs, type
  filter, search, offer rows, empty state).
- `02-offer-builder.html` — create/edit: name → 5 type cards → per-type fields →
  scope → availing modes → live preview.

Predicted brand workflow: Offers nav → list (or empty) → New offer → builder
(pick type, fill config, scope, modes) → Save (POST) → appears in list → edit
(PATCH, pre-filled) → activate → archive (DELETE → Archived tab). Distribution
(store toggle / influencer attach / badges) is NOT in this contract (C/D) — B is
authoring + management only.

Visual fidelity: locked wave-2 palette (ink #0A0A0A, yellow #FFC107, success
#10B981), Outfit / Plus Jakarta Sans / JetBrains Mono, dashboard topbar chrome.
The builder component carries its own scoped styles so it ports to the campaign
wizard in Sub-contract C unchanged.
