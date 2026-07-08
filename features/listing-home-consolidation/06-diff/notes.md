# Before/after — listing-home-consolidation

## Before
Fashion brand with incomplete setup: Listings nav → old "Complete Your
Listing" store page (FleetView Inventory/Add Item) → Add Item → NEW page with
its own My listings/Add products/Offers. Inventory shown twice under two
names; navigation repeated one level down.

## After
Listings nav → `/dashboard/products/listing` always (setup done or not):
**Inventory · Add products · Offers**, Inventory active. Setup-incomplete
brands get an amber "Finish your store setup" banner → `?setup=1` (the old
page, now setup-only). Browse h1 reads "My fashion inventory". Legacy
`?tab=offers` deep link forwards. MRP field hints "(optional — shows as a
strike-through discount)" — flat markdown at listing, complex mechanics
(BOGO/bundle/volume/tiered %) only in Offers.

## Verification
next build ✓ compiled; pnpm qa GREEN (79). After-capture owed on founder's
walkthrough: Listings click lands on Inventory with banner; Add Item from
setup surface still lands on Add products tab.
