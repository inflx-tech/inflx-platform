# Workflow prediction (mockup)

The in-chat interactive mockup (locked by founder 2026-07-02) demonstrates:

1. **My listings** opens on segment folders (Women / Men / Kids), each with a
   rolled-up count badge.
2. Tapping a segment reveals its category folders (Topwear / Footwear / Ethnic);
   tapping a category reveals its leaf folders.
3. Tapping a leaf swaps the folder grid for the **item shelf** — product rows with
   cover thumbnail, name, price, variant summary, and a Live/Hidden status pill.
4. A **breadcrumb** across the top jumps back up any level.
5. A **search** affordance flattens across all folders (the mockup used a
   "Today (flat)" toggle to contrast the current single-list experience; the ship
   replaces that with a live name/SKU search box).

`fashion-inventory-browse.html` is the static capture of that shape for the
before/after diff. The shipped screen renders the same hierarchy from real
`GET /brands/me/listing-tree` + `GET /brands/me/listing-nodes/:id/products` data.
