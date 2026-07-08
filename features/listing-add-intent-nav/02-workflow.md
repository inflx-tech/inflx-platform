# Workflow — listing-add-intent-nav

1. Fashion brand on the store page (FleetView).
2. Clicks "Add {item}" (tab strip, empty-state button, or folder-browse Add).
3. Browser opens `/dashboard/products/listing?tab=add`.
4. Page renders with **Add products** tab active — category drill grid visible
   immediately; no detour through My listings.
5. Clicking the Listings nav entry (no param) still lands on My listings
   (browse) — inventory-intent unchanged.
6. `?edit=` and `?tab=offers` deep links keep their existing behavior.
