# Backend defect — hidden products are invisible in the inventory category browse

> Carved per the governance failure taxonomy: genuine backend defect, found
> while implementing `listing-workspace-ux`. Left RED until backend-fixed.

## Symptom

In brand-web Listings → Inventory, pressing **Hide** on a product makes it
disappear from the list entirely. It cannot be found again by browsing any
category — only by typing its name or SKU into search (which reads a different,
flat endpoint). The "Hidden" status pill and the "Show" button are therefore
unreachable in the category-browse path.

## Root cause (verified in code, not inferred)

`GET /brands/me/listing-nodes/:id/products` →
`getMyNodeProducts`, `backend/src/controllers/listing.controller.js:646`.

The query filters:

```sql
WHERE bp.brand_id = $2 AND bp.category_node_id IN (SELECT id FROM sub)
  AND bp.is_active = true          -- ← the defect
ORDER BY bp.created_at DESC NULLS LAST
```

This contradicts the endpoint's own docstring three lines above
(`listing.controller.js:644`):

> "This brand's products under a node subtree, ALL statuses (live-first), for
> the inventory browse."

The frontend was built against the documented behaviour — it has always
rendered a Live/Hidden pill and a Hide/Show toggle — so the SQL, not the UI, is
the side that drifted.

## Why it matters more now

`listing-workspace-ux` adds **bulk Hide**. Hiding several products at once
makes them all vanish at once, with no way back except searching for each by
name. The frontend currently compensates with a message explaining where the
product went; that is a caption on a bug, not a fix.

## Fix (applied 2026-08-04)

Dropped the `is_active` filter and made the ordering match the docstring:

```sql
WHERE bp.brand_id = $2 AND bp.category_node_id IN (SELECT id FROM sub)
ORDER BY bp.is_active DESC, bp.created_at DESC NULLS LAST
```

One line of behaviour change, no schema change, no migration.

## Blast radius

- This endpoint is **brand-scoped and brand-only** — it is the brand's view of
  its own inventory. The follower-facing browse is a different controller
  (`getNodeProducts`, all-brands + live-only) and is **not** touched.
- Consumers: brand-web Listings → Inventory only.
- Risk: brands with hidden products will now see them listed (correctly), which
  changes what that screen displays. That is the intended correction.

## Status

**Fixed 2026-08-04** on founder go, shipped alongside `listing-workspace-ux`.
Production-impacting (`backend/src/**` → Render deploy).

The consuming UI was updated in the same change: `InventoryBrowser` gained a
Live/Hidden visibility filter, and the caption that used to explain where a
hidden product had gone was removed — it described the bug, and the bug is gone.
