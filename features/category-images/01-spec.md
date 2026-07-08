# category-images — upload + render category pictures (image strategy Phase 2)

## Founder (2026-07-08)
"We need to upload categories images as well." The follower category rail +
tiles show coloured placeholders (diamonds); categories should have real
pictures, using the same crop-to-frame uploader (1:1).

## Approach (no migration)
`category_nodes` has no image column but has a `meta jsonb` — store the picture
in `meta.image_url`. Zero migration, reversible.

## Scope
### Backend
- `taxonomy.getTree` + `getNodeChildren` return `image_url` (from meta) per node
  (feeds the follower tree + rail).
- `PATCH /admin/sections/category-node-image` (capability `sections`) sets/clears
  a node's `meta.image_url`. Reuses the section image presign.

### brand-web (admin)
- New `/admin/category-images` page: pick vertical → browse the flattened tree →
  Upload/Replace/Remove a picture per node via the crop modal (1:1). Nav entry
  under CONTENT.

### Mobile (OTA)
- CategoryBrowser LEFT RAIL and ALL-CATEGORIES TILES render `image_url` when
  present; fall back to the coloured placeholder otherwise.

## Non-goals
- Home world tabs / food craving rail images (follower_categories /
  follower_vertical_categories) — same pattern, later if wanted.
- Cloudflare resize (optional Phase 3).

## Acceptance
Admin uploads a picture for "Men's Topwear" → it shows in the follower rail +
tiles for that node; nodes without a picture keep the placeholder. `pnpm qa`
GREEN; backend boots; brand-web builds; mobile parses.
