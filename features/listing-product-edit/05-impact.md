# Impact

**Chat verdict:** additive edit surface for drill-down products. Reuses the add
form + create validation verbatim, so create/edit can't diverge. No migration.

## Surface area
### Backend (governed, additive)
- `backend/src/controllers/listing.controller.js` — `getListingProduct` (read) +
  `updateListingProduct` (write). Update reuses `taxonomy.validateItem`,
  `buildVariants`, `coverImage` and the exact facets/brand/_images assembly from
  `insertProducts`. Brand-scoped; leaf + SKU preserved; MRP preserved when absent.
- `backend/src/routes/listing.routes.js` — `GET` + `PATCH /listing-products/:id`
  on the existing authenticated brand router.
- **No change to `brand.controller.updateProduct`** (its ALLOWED list still excludes
  `facets` by design) — facet-aware edits go through the new validated endpoint
  instead, which is safer than widening the generic PATCH.

### Frontend (UI-governed)
- `Packages/brand-web/app/dashboard/products/listing/page.js` — `?edit=<id>` edit
  mode: loads the product into the stepper, hides tabs/tree/bulk/staged-list, adds
  Save changes / Cancel. `Edit` action added to `BrowseListings` rows.
- `Packages/brand-web/app/dashboard/products/components/ListingTemplateLayout.js` —
  `Edit` action added to `DrilldownFleetView` rows (via `DefaultFleetRow` onEdit),
  linking to `?edit=<id>`.

## Blast radius / risk
- **Add flow:** unchanged — edit mode is a branch guarded by `editingId`/`editMode`;
  when absent, every path is byte-for-byte the old behaviour.
- **Create validation parity:** edit calls the same validator + builders, so no new
  way to persist an invalid product.
- **Other verticals / generic PATCH:** untouched. `DefaultFleetRow`'s new `onEdit`
  is optional — the flat `FleetView` (non-drill-down) doesn't pass it.
- **Data safety:** update is brand-scoped and leaf/SKU-preserving; it can't move a
  product between brands or leaves.

## Closes
The founder's "after listing, can't upload new images or edit things" gap — now
covers photos, price, description, stock, facets, and per-colour/size variants.
