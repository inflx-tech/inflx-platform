# Feature Spec — Listing Workspace UX

> Step 2 of the contract-driven workflow. Written and agreed BEFORE any code.

## Problem / goal

The brand Listings screen (`/dashboard/products/listing`) is capped at
`maxWidth: 960` and centred, so on a normal 1440–1920px desktop roughly half
the viewport is dead space while the working area is cramped. Worse than the
wasted pixels is the **navigation model**: the category tree is browsed by
replacing the whole screen one level at a time, with a thin breadcrumb as the
only way back. A brand listing across several categories cannot see where they
are, cannot jump sideways, and loses the batch they are staging below the fold.

Goal: turn Listings into a **persistent three-pane workspace** that uses the
full screen — category tree always visible on the left, the working surface in
the centre, and contextual support (staging tray / filters) on the right.

Role: **brand** (brand-web only).

## Scope

- **In scope**
  - Remove the 960px cap; page becomes fluid up to 1720px.
  - New persistent, expandable **category tree rail** (left), shared by the
    Inventory and Add-products views. Any category or item-type reachable in
    one click; no breadcrumb back-tracking required.
  - **Add products**: same 4-step wizard and same Bulk-Excel path, re-laid out
    over a 12-column grid; the staged batch moves from below the fold into a
    **sticky right-hand tray** with the Save action.
  - **Inventory**: cramped one-line rows become a real table (photo, product,
    brand, variant swatches, SKU, price, stock, status, actions), plus
    multi-select with bulk **Hide / Show / Remove / Edit price**, plus a right
    rail of category stat tiles and status/brand filters.
  - Header rework: underline tab rail with live counts + catalogue stats,
    slim dismissible store-setup strip (was a full-width slab).
  - Offers tab re-housed in the same shell (contents unchanged).

- **Explicitly out of scope**
  - Bulk **Move category** — `updateListingProduct`
    (`backend/src/controllers/listing.controller.js:719`) deliberately preserves
    `category_node_id`; re-parenting needs a backend change. Deferred.
  - Bulk **Attach offer** — no attach endpoint exists
    (`backend/src/routes/brandOffer.routes.js` exposes only a read-only
    `GET /offers/:id/attachments`). Deferred.
  - Brand **mobile** listing (`listing-mobile-seller`) — unchanged this round.
  - Any change to the wizard's steps, validation, facet model, SKU generation,
    Excel import, or the offer engine.

## Surfaces touched

- App(s): **brand-web only**. No backend, no mobile, no admin.
- Roles involved: brand.

## Data / contracts

- New or changed tables / columns / migrations: **none**.
- New or changed API endpoints: **none**. The feature reads and writes through
  the endpoints that already back this screen:
  - `listingApi.getTree / getNodeFacets / getBrands / batchCreate /
    importProducts / templateUrl / ingestImage / setCoverPhotos`
  - `GET /brands/me/listing-tree`, `GET /brands/me/listing-nodes/:id/products`,
    `GET|PATCH /brands/me/listing-products/:id`
  - `brandApi.getProducts / updateProduct / deleteProduct` (bulk actions loop
    over these per product — no new bulk endpoint).
- Money/units, attribution IDs, status machines affected: **none**. Prices stay
  rupees end-to-end; `is_active` is the only status touched, via the existing
  `updateProduct` path.

## Non-functional

- Auth/role gates: unchanged — every call is already brand-scoped and
  `requireRole('brand')`.
- Failure modes the feature must handle:
  - Tree fails to load → error banner, the rest of the page still usable.
  - A bulk action partially fails → report how many succeeded and how many
    failed; never claim success for a failed row; refresh from the server after.
  - Narrow viewports (< 1150px) collapse the three panes to a single column so
    the screen stays usable on a small laptop.
  - Edit mode (`?edit=<id>`) has no tree and no tray — single centred surface.
