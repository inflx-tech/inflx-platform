# Expected outputs — follower-frame-themed-rail

## Admin (brand-web)
- Layout dropdown includes **"Themed rail (scrollable)"**.
- Selecting it reveals a **Frame** panel: background color picker + image upload
  (image wins), title align (left/center), tile size (medium/large).
- Timer block + per-tile image/label/rule work unchanged.
- Publish persists `config.style='themed_rail'`, `config.frame`, `config.tile`,
  `config.timer`, `config.tiles`. Existing frames unaffected.

## Mobile (OTA, no APK)
- `config.style==='themed_rail'` renders: themed shell (color / image+scrim / white),
  header (title aligned; **boxed** countdown when timer set), horizontal scroll rail
  of tiles at the chosen size (large = portrait hero + label overlay; medium = square
  + label below).
- Tap a tile → its rule grid (unchanged). Timer zero → frame hidden.
- Text auto-contrasts (white on colored/image, ink on white).
- Other styles byte-identical. babel clean; `npx jest` 25/25 incl. `TileSection.test.js`.

## Backend
- None. `pnpm qa` GREEN 79 (regression guard).

## Acceptance (founder walk)
- Frame A: Themed rail, white bg, timer ~1h, tile size Medium, 3 tiles → renders the
  "deals" frame (title + boxed timer + small scrollable tiles).
- Frame B: Themed rail, pink/image bg, no timer, tile size Large, 2 tiles → renders
  the "style edit" frame (big scrollable tiles on a colored shell).
- Both scroll horizontally; tapping a tile opens its grid; Frame A hides when the
  timer ends.
