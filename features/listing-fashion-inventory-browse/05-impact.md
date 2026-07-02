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
- `Packages/brand-web/app/dashboard/products/listing/page.js` — adds a top-level
  **My listings / Add products** tab. The entire existing add-wizard is wrapped
  unchanged under the *Add products* tab. New `BrowseListings` component + browse
  CSS added to the scoped `.lst` stylesheet.

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
