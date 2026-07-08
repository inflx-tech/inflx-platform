# Workflow — listing-home-consolidation

1. Fashion brand clicks **Listings** → `/dashboard/products` redirects
   immediately to `/dashboard/products/listing` (setup done or not).
2. Page shows tabs **Inventory · Add products · Offers**; Inventory active.
3. Setup incomplete → amber banner "Finish your store setup" → click →
   `/dashboard/products?setup=1` (old setup wizard, unchanged).
4. Inventory tab: category tree browse + search (existing BrowseListings).
5. Add products: drill-down wizard; Price + MRP fields, MRP hint says it shows
   as a strike-through discount.
6. Offers: the offer engine (complex mechanics only).
7. Food brand: `/dashboard/products` behaves exactly as before.
