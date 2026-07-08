# Before/after — listing-offers-tab

## Before
- Fashion/furniture brand clicks **Listings** → `/dashboard/products` redirects
  to `/dashboard/products/listing` → only **My listings · Add products** tabs.
  The offer engine (folded into the Products page by E-3) is unreachable except
  via the unlinked deep link `/dashboard/products?tab=offers`.

## After
- Same redirect, but the listing page now shows **My listings · Add products ·
  Offers**. The Offers tab mounts the SAME `OffersLibrary` component (moved
  verbatim to `app/dashboard/products/components/OffersLibrary.js`) — stats,
  status tabs, type chips, search, New-offer modal (OfferBuilder), publish-to-
  store toggle, where-used detail. On the Offers tab the page's own h1 / Store
  setup row is suppressed (the library brings its own header).
- `/dashboard/products/listing?tab=offers` deep-links to the tab.
- Non-drill-down brands: `/dashboard/products` Products/Offers sub-tabs behave
  exactly as before (now rendering the shared import).

## Capture
- Mockup: `04-preview/mockups/offers-tab.html` (structure mirror of the live
  library). After-capture owed on the founder's next walkthrough of the live
  Listings → Offers tab; component itself is a verbatim move, zero visual delta
  vs the E-3 sub-tab rendering.
