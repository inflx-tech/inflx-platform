# 01 — Spec · Section Template Catalog (slice 1: Image tiles)

Pre-designed section templates the admin composes by: pick template → upload
image(s) → wire to a product GROUP (Section Library rule or Collection).

## Slice 1 — Image tiles (`shelf_type: 'tiles'`)
- **Admin (App Sections):** "Image tiles (wire each to a group)" preset + a
  per-tile editor — upload image + label + pick a Section Library group; add/
  remove tiles. Tiles persist in `config_json.tiles[]`. No backend rule
  (rule='static'); the tiles ARE the content.
- **Mobile:** `TileSection` renders a toing image-tile carousel; `SectionRenderer`
  registers `tiles` as a presentation type + renders it before the empty guard;
  tap a tile → Results runs the tile's wired Section Library group
  (`library_products` + `library_section_id`).
- Covers the spotlight / featured / shop-by-concern styles from the founder's
  screenshots.

## Already covered by existing engine (no new build)
- Product rail → `library_products` (products shelf, + See all).
- Hero banner → `banner_gateway`.

## Next slices (later)
Themed banner + sub-tiles; product-rail themed header; extra tile-style variants.
