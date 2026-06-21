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

## Slice B — brand-web Customise modal (pending)
The before/after screenshots for the modal vs the locked mockup
(`04-preview/mockups/owner-editor.html`) will be captured when Slice B lands.
