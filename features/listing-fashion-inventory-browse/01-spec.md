# Spec — Fashion inventory browse (My listings by hierarchy)

## Problem
When a fashion / furniture brand finishes listing products, they have **no way to
browse or manage what they listed**. The inventory tab
(`/dashboard/products`) redirects drill-down verticals to the add-only wizard
(`/dashboard/products/listing`), which drills the category tree purely to *add*
products. At each leaf it shows the "add product" stepper — never the products
already listed. The only trace of existing items is a per-leaf count
(`counts[nodeId]`) held in React state, which is **session-only** and gone on
reload. A boutique with hundreds of items across many categories cannot see, find,
hide, or remove a listed product.

(Founder framing: "it looks only one single list in inventory … instead of a single
list we can let them check their listing based on the hierarchy we listed under —
category-wise.")

## Goal
Give drill-down brands a **My listings** browse that mirrors the exact category tree
they listed under: segment → category → leaf → the item shelf. Plus a name/SKU
search that flattens across all folders as a fast escape hatch.

## Scope (fashion first; furniture rides the same code, gated by vertical)
- New **tab switch** on the listing page: **My listings** (browse) vs **Add products**
  (the existing wizard, unchanged).
- **My listings** opens on the category folders the brand actually listed in
  (folders with zero products are hidden — this is *their* catalogue, not the full
  taxonomy). Each folder carries a count badge (rolled up from its leaves).
- Drilling to a **leaf** shows that leaf's product rows: cover image, name,
  price (+ MRP strike when present), SKU, stock, and a Live/Hidden status pill.
- **Row actions** reuse today's brand-scoped endpoints only: **Hide/Show**
  (`PATCH is_active`) and **Remove** (soft-delete). No new mutation surface.
  Deep facet/photo editing is explicitly OUT of scope (follow-up).
- **Search** box: typing a name/SKU flattens across the whole catalogue
  (via the existing flat `GET /brands/me/products`), filtered client-side.

## Out of scope
- Deep edit of a fashion product (facets, per-colour photos, variant stock) — the
  add-wizard owns creation; an edit surface is a separate contract.
- Standard (non-drill-down) verticals — they keep today's flat sectioned list.
- Mobile (no brand mobile app; brand inventory is web-only).

## Gating
Fashion / furniture only, derived from `brand.category`. Standard verticals,
orders, campaigns, and the follower-facing browse are untouched.
