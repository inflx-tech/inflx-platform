# Before / after — Fashion inventory browse

## What was implemented
A **My listings** browse on `/dashboard/products/listing`, added as a tab beside
the existing **Add products** wizard. It renders the brand's own inventory as a
drill-down of the same category tree they list under, plus a name/SKU search.

- Backend (additive, no migration):
  - `GET /brands/me/listing-tree` → vertical tree with per-node `product_count`
    (this brand, any status, rolled up).
  - `GET /brands/me/listing-nodes/:id/products` → this brand's products under a
    node subtree, all statuses, live-first.
  - Both in `backend/src/controllers/listing.controller.js` + routes on the
    existing `brandRouter` (`backend/src/routes/listing.routes.js`).
- Frontend: `Packages/brand-web/app/dashboard/products/listing/page.js`
  — new `BrowseListings` component, tab switch, browse CSS. The entire add wizard
  is wrapped unchanged under the **Add products** tab.
- Row actions reuse `PATCH` / `DELETE /brands/me/products/:pid` (Hide/Show, Remove).

## What matches the locked mockup
- Segment → category → leaf folder drill-down with a count badge per folder.
- Breadcrumb to jump back up.
- Leaf shows the item shelf: thumbnail, name, price (+ MRP strike), SKU/stock, and
  a Live/Hidden status pill.
- Search flattens across the whole catalogue (replaces the mockup's "Today (flat)"
  contrast toggle, as predicted in workflow-prediction.md).

## What diverged (deliberate)
- Browse shows **only folders the brand has listed in** (`product_count > 0`), not
  the full empty taxonomy — this is their inventory, not the add tree.
- Default landing tab is **My listings** (returning brands see inventory first);
  a brand with zero products auto-sees an empty state pointing to **Add products**.
- Row actions are **Hide/Show + Remove** only. Full facet/photo edit has no surface
  yet (the wizard owns creation) — flagged as a follow-up in 05-impact.md.

## What to check on the deployed screen
1. A fashion brand with products across ≥2 leaves sees folders with correct counts;
   drilling reaches the right item shelf.
2. Hide flips a row to Hidden and it stays after reload (count/status truthful).
3. Search by name and by SKU both return the product with working actions.
4. A brand with zero products lands on the empty state, not a blank tree.
5. Standard (non-drill-down) verticals are unaffected — they never reach this page.

## Amendment — second render path (2026-07-02)
First pass upgraded only `/dashboard/products/listing` (drill-down add page).
But a fashion brand whose store setup isn't complete (e.g. Charvitha Fashions)
renders `ListingWizard → ListingTemplateLayout → FleetView` on `/dashboard/products`
instead — a different flat list that the first pass never touched (confirmed by
founder screenshot). Fix: `DrilldownFleetView` added to `ListingTemplateLayout`,
gated to fashion/furniture, reusing the same deployed endpoints and `DefaultFleetRow`
(In-store toggle + Remove preserved). Backend `getMyNodeProducts` now also returns
`description`/`section` for the reused row subtitle. Lesson: this feature has two
inventory render paths depending on store-setup state; both now show the drill-down.

## Verification
- `pnpm qa` GREEN — 79 passed, gate 0 (2026-07-02), zero regression.
- Backend `node --check` clean; frontend JSX parses via Next's bundled babel.
- No fashion/furniture products in the current DB, so live drill-down was not
  exercised by an automated test — verify on staging/prod with seeded fashion data.
