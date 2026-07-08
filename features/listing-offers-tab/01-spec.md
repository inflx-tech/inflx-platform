# listing-offers-tab — restore the Offer Engine inside Listings for drill-down brands

## Problem (founder-reported, 2026-07-08)
E-3 (contract `dashboard-tab-merges`, commit bc44aa2) folded the Offers library
into `/dashboard/products` as a Products/Offers sub-tab. But drill-down brands
(fashion/fashion_walkin/fashion_online/furniture) never SEE that page: after
store setup, `/dashboard/products` immediately `router.replace`s to
`/dashboard/products/listing` (products/page.js:795-812). The Offers engine is
intact but unreachable for exactly the brands the founder tests with — only the
unlinked deep-link `/dashboard/products?tab=offers` reaches it.

## Fix (scope locked)
1. Extract `OffersLibrary` (products/page.js:1055-1382 — component + OFL
   constants + scoped `.ofl` CSS) VERBATIM into
   `app/dashboard/products/components/OffersLibrary.js` (default export).
2. `products/page.js` imports it from the new file (sub-tab behavior unchanged
   for non-drill-down brands). `OfferBuilder` import moves with the block.
3. `listing/page.js` gains a third tab **Offers** (after My listings / Add
   products) rendering `<OffersLibrary />`; `?tab=offers` deep-links to it.
   Page-level header (h1 + Store setup link) is suppressed on the Offers tab —
   the component brings its own header.

## Non-goals
- No change to offer CRUD, publish-to-store, or attachments logic (verbatim move).
- No change to the post-setup redirect itself (it is correct for listing jobs).
- The new-vs-existing inventory UX confusion is a SEPARATE flow discussion
  (discuss-first rule) — not in this contract.

## Acceptance
Fashion brand: Listings nav → listing page shows three tabs; Offers tab shows
the full offer library (counts, filters, New offer modal, publish toggle,
where-used). Food brand: `/dashboard/products` Products/Offers sub-tabs
unchanged. `pnpm qa` GREEN.
