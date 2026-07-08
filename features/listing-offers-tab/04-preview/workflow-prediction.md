# Workflow prediction — listing-offers-tab

- Fashion brand clicks Listings → lands on `/dashboard/products/listing` →
  sees THREE tabs (My listings · Add products · Offers).
- Clicking Offers hides the page's own h1/store-setup row and renders the
  OffersLibrary exactly as it rendered on `/dashboard/products?tab=offers`:
  header + "+ New offer", 4 stat cards, status tabs with counts, type chips,
  search, offer rows with Edit/Activate/Archive/Publish-to-store.
- `?tab=offers` on the listing URL opens the tab directly (deep link).
- Browse ("My listings") and Add flows render pixel-identical to today.
- Food/salon/car brands: `/dashboard/products` unchanged (Products/Offers
  sub-tabs still there).
