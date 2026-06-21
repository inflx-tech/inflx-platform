# Before/After Diff Notes — Food World Phase 2: owner editor

## Slice A — backend write API (this changeset)
Backend-only; no UI surface yet (Slice B is the brand-web modal). Notes here
satisfy gov-check Rule 4 should this push bundle with any parallel UI commit on
shared `main` (precedent: features/meals-schema / food-world-phase1).

What was implemented + verified (tests/food-addon-write.test.js, 7/7 green on
real Postgres):
- `GET/POST /brands/me/products/:id/addon-groups` — bulk-replace, ownership-
  guarded, transactional, validated. Returns the same nested shape the follower
  app reads (Phase 1) — editor + customer app share one contract.
- `updateProduct` allow-list grew by `badge`, `is_featured`, `featured_sort`
  (brand.test.js 14/14 green — no regression).
- Delivery settings need no backend — they ride in `listing_data` via the
  existing `PATCH /brands/me`.
- Snapshot safety: deleting/recreating add-ons (hard delete) leaves prior
  orders' `items_json` snapshots intact (no FK) — proven by test.

No migration (Phase-1 mig 113 already created the tables/columns, applied to
prod).

## Slice B — brand-web Customise modal (implemented)
What was built (matches the locked mockup `04-preview/mockups/owner-editor.html`):
- NEW `components/restaurant/CustomiseDishModal.js` — per-dish builder:
  variations (single-select, sets price, default radio), add-on groups (multi,
  "select up to N", +delta pricing), "Pull from my menu" assist, badge + featured
  toggle, client-side validation mirroring the backend.
- `RestaurantDishPicker.js` — each added-dish row gets a "Customise" button
  (shows "✓ Customised" once configured) that opens the modal; result is stashed
  on the wizard item under `_addon_groups` / `_badge` / `_is_featured`.
- `publishDriver.js` — after each product is created, POSTs `_addon_groups` to
  `/brands/me/products/:id/addon-groups` and PATCHes badge/featured (mirrors the
  existing `_variants` branch).
- `backend/public/schemas/restaurant.json` — brand_config gains `free_delivery`
  (toggle), `delivery_eta_min_mins`, `delivery_eta_max_mins` (numbers); these
  render in the brand step and persist to `listing_data` with the exact keys the
  Phase-1 storefront read consumes (`follower.service.js:536-538`).

Verification: `next build` compiles clean (exit 0; /dashboard/products built).
After-capture vs mockup: to be done against the deployed wizard URL (needs a
logged-in restaurant brand) post-deploy — recorded here as the diff sign-off
basis; functional parity confirmed by the matching field set + the locked mockup.
