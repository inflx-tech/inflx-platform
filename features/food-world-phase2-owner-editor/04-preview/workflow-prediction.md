# Workflow prediction — Food World Phase 2 owner editor

The locked mockup (`mockups/owner-editor.html`) shows two surfaces:

1. **Restaurant delivery settings** (top card) — restaurant-level, saved once
   into `brands.listing_data`: a free-delivery toggle + a delivery-time range
   (min–max minutes). No per-dish involvement.

2. **Per-dish "Customise" modal** — opened from a "Customise" button on each
   dish row in the restaurant menu editor:
   - Badge (free text) + Featured toggle → written to the dish via
     `PATCH /brands/me/products/:id`.
   - Variations — single-select group that SETS price (Half ₹70 default /
     Full ₹114).
   - Add-on groups — multi-select, "select up to N", priced as +delta
     (Roti +₹15, Coke +₹40), with a "Pull from my menu" assist that prefills
     name+price and records source_product_id.
   - Save → `POST /brands/me/products/:id/addon-groups` (bulk-replace).

Predicted result: re-opening the modal round-trips everything; the follower
`GET /products/:id` then returns real `addon_groups`; an order prices via the
Phase-1 pricer.
