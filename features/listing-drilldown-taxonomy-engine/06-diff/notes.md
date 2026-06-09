# 06-diff — drill-down taxonomy engine (Ship 2: brand-web seller wizard)

## Before
The brand dashboard had only the existing flat per-vertical wizard
(`ListingWizard` + per-vertical components). No way to drill a variable-depth
category tree or batch-add products under a leaf with typed facets. The engine
APIs (Ship 1) existed but had no seller UI.

## After
- **`lib/api.js`** gains `listingApi` (`getTree`, `getNodeFacets`, `batchCreate`)
  — additive; no existing export touched.
- **New isolated route** `app/dashboard/products/listing/page.js` — a self-contained
  drill-once-batch-add wizard (does NOT modify the existing per-vertical wizard):
  - Fetches the live tree (`/listing/tree?vertical=fashion`); seller drills
    segment → category → leaf with a clickable grid + breadcrumb.
  - On a leaf, fetches its facet schema (`/listing/nodes/:id/facets`) and renders
    typed inputs: multi-select chips (Color/Size — variant tagged), single-select
    dropdowns, Yes/No toggles, number/text — required + locked-dropdown honoured.
  - Multi-image upload (up to 6, first=cover) via the existing
    `uploadFileToGallery` → `/media/assets/:id` URLs.
  - "Add this item" stages products under the leaf (drill once, batch-add);
    "Save all" posts `/brands/me/products/batch`; success/empties the stage to
    keep adding. Client-side validation mirrors the server (whole-batch reject).
  - One listing model (no Showcase/Sell) per the locked decision; follower CTA
    derives from the brand's availing_modes downstream.

## Verification
- Babel-parse OK: the new page (JSX + ESM) and `lib/api.js`.
- Rides the Ship-1 APIs already verified live on prod (tree/facets/batch).
- `pnpm qa` + Next build not runnable in sandbox → founder is the on-web gate.
  Reachable at **/dashboard/products/listing** after Vercel deploy.

## Reachability / deferred
- Direct route works; a nav button on the products page + a vertical switcher
  (furniture) are a small follow-up (not done here to avoid editing the existing
  page blind). Per-size price/stock matrix deferred (single price+stock in v1).
