# admin-frame-builder-ux — App Builder section-editor clarity pass

> Founder feedback 2026-07-02 on the App Builder section editor. Four changes:
> (1) section naming, (2) remove the redundant wireframe preview, (3) per-tile
> tap destination, (4) a clear labeled rule builder (Section Library structure).

## Changes

### 1. Section naming (no more "Spotlight" default)
- New sections start with a **blank title** + placeholder "Name this section —
  shown in the app (e.g. Summer Deals)". The title IS the mobile display name.
- **Publish requires every section to be named** (blank → blocked with a clear
  message). Kills the generic "Spotlight" default the founder flagged.

### 2. Remove the wireframe preview
- The `TemplatePreview` shape wireframe is deleted from the config editor (and the
  now-dead function removed). The live phone pane on the right already shows the
  real render, so the wireframe was redundant.

### 3. Per-tile tap destination
- Each Frame **tile** gets an **"On tap →"** dropdown: **Product grid** (the tile's
  own rule) · **Category browser** (pick a world) · **A page** (pick a custom page).
  Stored as `tiles[i].tap_destination = { type:'grid'|'category'|'page', vertical?, page_key? }`.
- The **section-level** "On tap, go to…" chooser is **hidden for frames** (tiles) —
  frames route per tile; other section types keep the section-level chooser.
- Mobile: `SectionRenderer`'s tile `onTile` honors `tap_destination` before the
  default grid route (→ `CategoryBrowser` / `FollowerPage` / `SectionResults`).

### 4. Labeled rule builder (reuse Section Library structure)
- The cramped one-row rule inputs are replaced with a clear labeled form, matching
  Section Library: **Category** (sub-category tree, fashion/furniture) · **Brand** ·
  **Price under ₹** (+ above ₹) · **At least % off** · **Tags** (chips from the
  world's tag vocabulary) · **Only with a live offer**. All optional, combine freely.
- Composes the founder's example: "jeans under ₹499 in Adidas" = Category=jeans +
  Price under 499 + Brand=Adidas. Every field maps to a `rule_json` key the engine
  (`libraryProducts`) already honors (`subcategory_node_id`, `brand`, `price_max/min`,
  `min_discount_pct`, `tags`, `has_offer`). "Save for reuse" (→ Section Library) kept.

## Scope
- Admin: `brand-web/app/admin/sections/page.js` only. Mobile: `SectionRenderer.js`
  tile `onTile` only. **No backend, no migration** (all rides `config_json`).
- Loads the world's tag vocabulary (`adminApi.listTagVocabulary`) alongside the
  existing catalogue tree.

## Out of scope
- Live "matches N products" count per tile (Section Library has it; deferred here —
  the phone pane covers visual confirmation).

## Non-regression
- Existing saved sections keep their titles/rules. `config_json` shape is a superset.
- `pnpm qa` GREEN 79 · jest 25/25 (incl. `TileSection.test.js`).
