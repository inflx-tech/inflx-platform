# Workflow — listing-offers-tab

1. Brand (fashion, store setup done) logs into brand-web → clicks **Listings**.
2. Redirect lands on `/dashboard/products/listing` (unchanged).
3. Tab bar shows **My listings · Add products · Offers**.
4. Brand clicks **Offers** → full Offers library renders (stats, All/Active/
   Drafts/Archived tabs, type filter chips, search, list rows).
5. Brand clicks **+ New offer** → OfferBuilder modal → Save & activate →
   toast, list refreshes (same code path as before the merge).
6. Brand toggles **Publish to store** on an active offer → pill shows "In store".
7. Deep link `/dashboard/products/listing?tab=offers` opens the Offers tab
   directly.
8. Non-drill-down brand (e.g. food): `/dashboard/products` still shows the E-3
   Products/Offers sub-tabs, identical behavior.

Expected end state: the offer engine is reachable from the Listings nav for
every brand type; zero behavioral change inside the library itself.
