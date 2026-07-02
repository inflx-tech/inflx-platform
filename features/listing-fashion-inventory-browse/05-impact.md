# Impact

**Chat verdict:** additive, fashion/furniture-gated. Adds a *My listings* browse
where there was none; touches no existing flow. No migration.

## Surface area
### Backend (new, additive)
- `backend/src/controllers/listing.controller.js` — two new read-only handlers:
  `getMyListingTree`, `getMyNodeProducts`. Both brand-scoped (`brand_id` from
  `req.user.sub`). No writes.
- `backend/src/routes/listing.routes.js` — two new brand routes on the existing
  authenticated `brandRouter` (mounted at `/brands/me`):
  `GET /listing-tree`, `GET /listing-nodes/:id/products`.
- Reuses existing `PATCH` / `DELETE /brands/me/products/:pid` for row actions.
- **No schema change, no migration.** Reads `category_nodes` + `brand_products`
  columns that already exist (incl. `category_node_id`, `facets`, `mrp`).

### Frontend (UI-governed)
Fashion/furniture brands reach their inventory through **two** render paths
depending on store-setup state — both needed the browse:
- `Packages/brand-web/app/dashboard/products/listing/page.js` — the drill-down
  add page (reached after store setup). Adds a **My listings / Add products** tab;
  the add-wizard is wrapped unchanged. New `BrowseListings` component + `.lst` CSS.
- `Packages/brand-web/app/dashboard/products/components/ListingTemplateLayout.js`
  — the listing-engine `FleetView` (reached when store setup isn't complete, e.g.
  Charvitha Fashions). For drill-down verticals the flat `FleetView` list is
  replaced by `DrilldownFleetView`: category folders → leaf → rows. Rows REUSE
  `DefaultFleetRow` (In-store toggle + Remove) so behaviour is identical; a
  name/SKU search flattens across the catalogue. Non-drill-down verticals keep
  the flat `FleetView` untouched.

### Backend follow-on
- `getMyNodeProducts` now also selects `description` + `section` so the reused
  `DefaultFleetRow` renders its subtitle. Still read-only, still additive.

## Blast radius / risk
- **Follower browse:** untouched. The new endpoints are separate handlers; the
  public `getNodeProducts` (approved-brand, live-only, all-brands) is not modified.
- **Standard verticals:** never reach this page (redirect logic unchanged) → the
  tab never renders for them; `GET /brands/me/products` flat list unchanged.
- **Add flow:** wrapped, not edited — same components, same handlers, same state.
- **Data safety:** browse is read-only; the only writes are the pre-existing,
  brand-scoped hide/remove endpoints (soft-delete, attribution-preserving).
- **Counts:** derived live from `brand_products`; no denormalised counter to drift.

## Known follow-ups (out of scope here)
- Deep edit of a fashion product (facets / per-colour photos / variant stock) has
  no surface yet — Hide/Show + Remove only. Flag for a follow-up contract.
- Furniture shares the code but wasn't the founder's first-vertical focus; verify
  when furniture has live products.
