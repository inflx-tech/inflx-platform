# Expected outputs — admin-frame-builder-ux

## Admin (brand-web)
- New sections start blank-titled with the naming placeholder; **Publish blocks**
  with "Give every section a name…" until all are named.
- No wireframe preview block in the config editor (removed).
- Frame tile "Create a rule" shows the labeled form: Category (tree worlds) · Brand ·
  Price under/above · At least % off · Tags (chips) · Only-with-offer. Values write
  the matching `rule_json` keys; "Save for reuse" still works.
- Each tile shows an **On tap →** dropdown (Product grid / Category browser / A page)
  with the world/page sub-picker; writes `tiles[i].tap_destination`.
- The section-level "On tap, go to…" chooser does not render for `tiles` frames;
  still renders for other section types.

## Mobile (OTA, no APK)
- Tapping a tile honors `tap_destination`: category → `CategoryBrowser`, page →
  `FollowerPage`, else → the tile's rule grid (unchanged default).
- babel clean; `npx jest` 25/25 incl. `TileSection.test.js`.

## Backend
- None. `pnpm qa` GREEN 79 (regression guard).

## Acceptance (founder walk)
- Add a frame, leave a section unnamed → Publish is blocked with the message.
- Name it "Deals in Men Fashion"; build a tile rule = Jeans + under ₹499 + Adidas →
  the grid/preview shows matching products.
- Set one tile's On tap → A page (Summer Sale); tapping that tile in the app opens
  the Summer Sale page. Another tile → Category browser opens the browser.
- No wireframe box appears in the editor.
