# Before / after — admin-frame-builder-ux

Admin clarity pass + one mobile routing addition. No backend, no migration.
Verified by build/lint + founder walk. Matches `04-preview/mockups/tile-editor.html`.

## Admin (`Packages/brand-web/app/admin/sections/page.js`)
1. **Naming** — before: new sections defaulted to preset titles ("Spotlight" for
   frames). After: blank title + placeholder "Name this section — shown in the app
   (e.g. Summer Deals)"; publish blocks with "Give every section a name…" until all
   are named.
2. **Preview** — before: a `TemplatePreview` shape wireframe sat at the top of the
   config editor. After: removed (render + the dead function); the live phone pane
   already shows the real render.
3. **Per-tile destination** — before: tiles always tapped to their rule grid; only a
   section-level chooser existed. After: each tile has an "On tap →" dropdown (Product
   grid / Category browser / A page) writing `tiles[i].tap_destination`; the
   section-level chooser is hidden for `tiles` frames.
4. **Rule builder** — before: a cramped one-row of inputs (price/discount/brand/tags/
   has-offer). After: a labeled form mirroring Section Library — Category (tree) ·
   Brand · Price under/above · At least % off · Tags (chips from the world's tag
   vocabulary) · Only-with-offer. Writes the same `rule_json` keys the engine honors;
   composes "jeans under ₹499 in Adidas". "Save for reuse" kept.

## Mobile (`Packages/Mobile/src/components/SectionRenderer.js`)
- Tile `onTile` now honors `tile.tap_destination`: `category` → `CategoryBrowser`,
  `page` → `FollowerPage`, else → the tile's rule in `SectionResults` (unchanged default).

## Backend
- None. Rule keys + destination ride `config_json`; `libraryProducts` already reads
  `subcategory_node_id/brand/price_max/price_min/min_discount_pct/tags/has_offer`.

## Verification
- `pnpm qa` GREEN 79 (regression guard).
- admin `sections/page.js` parses clean (@babel/parser, jsx); mobile `SectionRenderer.js`
  babel-transform clean; `npx jest` 25/25 incl. `TileSection.test.js` (FollowerWallet
  baseline ignored).
