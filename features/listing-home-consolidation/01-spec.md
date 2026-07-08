# listing-home-consolidation — one Listings home: Inventory · Add products · Offers

## Founder vision (locked in-session 2026-07-08, screenshot-grounded)
Clicking Listings = ONE surface, three jobs: **Inventory** (what I have, by my
categories) · **Add products** (drill-down wizard) · **Offers** (mechanics on
top of published products). Pricing boundary: listing keeps Price + MRP (the
simple flat strike-through discount); complex mechanics (BOGO/bundle/volume/
tiered %) live ONLY in Offers.

## Problem
Two page generations stack: drill-down brands with INCOMPLETE store setup land
on the old store page (`/dashboard/products` — "Complete Your Listing" +
FleetView Inventory/Add Item), whose Add Item jumps to the NEW page
(`/dashboard/products/listing`) with its own My listings/Add products/Offers —
inventory appears twice under two names, navigation repeats one level down.

## Scope (frontend-only)
1. `products/page.js`: drill-down brands ALWAYS redirect to
   `/dashboard/products/listing` (no longer gated on setupDone). `?setup=1`
   still stays (setup wizard surface). `?tab=offers` for drill-down forwards to
   `/listing?tab=offers`. Non-drill-down brands unchanged.
2. `listing/page.js`: tab "My listings" → **Inventory**; browse h1 → "My
   {vertical} inventory". Setup-incomplete brands see an amber "Finish your
   store setup" banner linking to `?setup=1` (fetches listing-config once).
3. MRP label copy: "(optional — shows as a strike-through discount)" — makes
   the simple-vs-complex discount boundary legible at the field.
4. Old FleetView surface is NOT touched — it simply stops being a landing page
   for drill-down brands (reachable only via ⚙ Store setup).

## Non-goals
No offer-engine changes; no backend; no change for food/salon/car brands.

## Acceptance
Fashion brand (setup incomplete): Listings nav → drill-down page, Inventory
tab active, setup banner visible; Add products and Offers one click away; no
"Complete Your Listing" interstitial. `pnpm qa` GREEN.
