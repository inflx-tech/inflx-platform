# follower-frame-themed-rail — Themed scrollable Frame style

> The AJIO-style frame the founder wants: a **themed container** (white OR
> color/image background) with a **styled title + optional boxed countdown** and a
> **horizontally-scrollable rail of tiles** whose size is a knob. One frame recipe;
> three settings differentiate looks (background · timer · tile size).

## Problem (verified 2026-07-02)
The existing Frame styles are `carousel` (bare scroll rail, no shell/title/timer),
`banner` (themed bg but max 3 static tiles), `grid`, `mosaic` (static grid + thin
timer). None is a **themed shell + header + scrollable large tiles** — so the
follower render looks flat vs. AJIO's "CRAZY DEALS" / "STYLE STATEMENTS" frames.
Ingredients exist separately (banner bg, carousel rail, timer) but aren't combined.

## Scope (additive; admin + mobile only; NO backend, NO migration)

New Frame layout **`themed_rail`** producing:
```
config_json = {
  style: 'themed_rail',
  frame: { bg_color:'#E11D6B'|null, bg_image_url:url|null, title_align:'left'|'center' },
  timer: { ends_at, label },                       // optional (reuses existing)
  tile:  { size:'medium'|'large' },                // "small vs big tiles"
  tiles: [ { image_url, label, badge?, rule_mode, rule_json|library_section_id }, … ]  // scroll rail
}
```

### Admin (`brand-web/app/admin/sections/page.js`)
- Layout dropdown gains **"Themed rail (scrollable)"**.
- When selected, a **Frame** panel: background **color** picker + optional **image
  upload** (image wins over color); **title align** (left/center); **tile size**
  (medium/large).
- Timer block + per-tile image/label/rule already exist and apply as-is.

### Mobile (`Mobile/src/components/sections/TileSection.js`)
- New `ThemedRailStyle`: shell `View` (bg color, or `<Image>` background + scrim) →
  header (title aligned; **boxed** countdown when `timer` set) → horizontal
  `ScrollView` of tiles sized by `tile.size` (large = portrait hero w/ label overlay,
  medium = square w/ label below + optional badge).
- Text color auto: colored/image bg → white; white bg → ink.
- `useCountdown` extended to expose padded `dd/hh/mm/ss` for the boxed timer; the
  existing thin `CountdownBar` (mosaic) unchanged. Expiry still hides the frame.

## Out of scope (v1)
- Per-tile 3-way destination (tiles keep rule→grid).
- Server-side expiry gate (client-side hide only).
- The remaining deferred looks (spotlight / deal-card / plain strip).

## Non-regression
- New layout value only; `carousel/featured/grid/banner/mosaic` untouched.
- `pnpm qa` GREEN 79 holds; `TileSection.test.js` stays green.
