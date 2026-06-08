# Workflow — follower-card-foundation

> Step 3. The end-to-end behaviour this contract must execute to its expected end
> state. Phase 0 has no user-facing flow (it wires no screen); the "workflow" is
> the build + the render contract each component honours.

## Build workflow
1. Add `Gradient` primitive (OTA-safe, pure JS).
2. Add the shelf card kit + atoms, each consuming the documented item shape.
3. Add `index.js` export hub.
4. Author the component-gallery mockup (`04-preview/mockups/component-gallery.html`)
   so the kit can be reviewed side-by-side against the agreed comprehensive HTML.
5. `pnpm qa` GREEN (web unaffected = zero regression; mobile = babel-transform of
   the new files passes, no broken imports).
6. `06-diff/notes.md` — what was built, what matches the mockup, honest fidelity
   divergences (gradient approximation, omitted rating/distance).

## Per-component render contract (the behaviour QA/diff verifies)
- **Gradient(`colors=[start,end]`, `direction`, `style`)** — renders N (~14)
  absolutely-positioned slices interpolating start→end; children render above.
  `vertical` | `horizontal` | `diagonal` (diagonal ≈ vertical for v1). Returns a
  plain colored `View` if a single color is given.
- **ShelfHeader** — `title` (serif), `sub`, `count` badge, `tag`
  (`BRANDS|PRODUCTS|OFFERS|MIXED`→colored), optional `onSeeAll`. Renders nothing
  with no title.
- **StoryCircle / StoryRail** — gradient ring (coral→amber) around a round avatar
  (real `avatar` image, else initial); `name`; "● LIVE" when `live`. Rail hides
  when `items` empty; appends a "More" affordance.
- **CategoryCircle / CategoryRail** — rounded-square emoji tile + label;
  horizontal scroll; `onPress(cat)` per tile.
- **FeatureCard** — gradient tile; `chip` (category), serif `title`, optional
  `via` pill (avatar + `@handle`), big `emoji`. Tap → `onPress`.
- **DealCard** — gradient header (derived from brand category accent) with big
  `discount` + `emoji`; body with item `name`, `brand`, `ViaCreatorChip`; optional
  `clock` ("⏳ 4h left"). Tap → `onPress`.
- **ShelfProductCard** — image hero (heart, optional offer badge from
  `discount_value`), `name`, brand line, price (+ struck MRP if discounted).
- **ShelfBrandCard** — image hero (emoji fallback by category), brand `name`,
  cuisine/category line. NO rating/distance (backend-first).
- **ViaCreatorChip** — soft pill: mini avatar + "via @handle".
- **RankBadge** — small "#N" overlay; render only when `rank` given.

## End state
A complete, importable `components/vibe` kit that renders the mockup's shelves
faithfully (within the OTA gradient approximation), consuming only real backend
fields, wired into no screen, ready for Phase 1 (Home) to import. `pnpm qa` GREEN.
