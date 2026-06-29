# Workflow — follower-page-builder

## Admin: create a page (E)
1. Admin → `/admin/custom-pages`.
2. "＋ New page" → modal: enter **label** ("Summer Sale"); **key** auto-derives
   (`summer_sale`, editable, unique); optional **title**/**subtitle** (the hero
   shown to followers).
3. Save → `POST /v1/admin/pages` → row in `follower_pages` (enabled=true).
4. The page appears in the list with Compose · Rename · Enable/Disable · Delete.

## Admin: compose a page's sections (E, reuse)
1. From the page row "Compose" → `/admin/sections` with the **Custom page** scope
   tab pre-selected and the page chosen in the page dropdown.
2. Admin adds/orders/edits sections exactly as for Home/Brand/Creator (same
   presets, same rule pickers, same config editor).
3. Publish → `PUT /v1/admin/sections/page` with `scope_type='global',
   scope_value='<key>'`, `shelves:[…]`.

## Admin: point a section's tap at a destination (D)
1. In any scope (Home / Brand / Creator / Category / a Custom page), expand a
   section's config editor.
2. New **"On tap, go to…"** control:
   - **Default** — item's natural navigation (unchanged).
   - **Product grid** — full list of this section's rule.
   - **Category browser** — pick a category node / vertical → opens the browser.
   - **A page** — pick from the dropdown of enabled custom pages.
3. Publish → the choice is saved in that shelf's `config_json.tap_destination`.

## Follower: tap a section (runtime)
1. Follower on any page sees the composed section stack.
2. Taps the section's **See all** (or a Frame banner). `SectionRenderer` reads
   `section.config.tap_destination`:
   - `grid`   → `navigate('SectionResults', { rule, item_type, … })`
   - `category` → `navigate('CategoryBrowser', { nodeId, vertical, title })`
   - `page`   → `navigate('FollowerPage', { pageKey, title })`
   - `default`/absent → existing type-based route.
3. For `page`: `FollowerPageScreen` calls `getPageSections(pageKey)` →
   `GET /follower/page/:key/sections` → renders header + `<SectionRenderer>`.
   A page can itself contain sections whose taps point elsewhere (incl. another
   page) — the renderer is recursive by construction.
4. Individual **cards** inside any section still open their detail (PDP/store) —
   destination logic applies only to the section-level tap.

## System: data flow
- `tap_destination` rides inside the existing `config_json` JSONB → surfaced
  unchanged through `sectionEngine.buildSections` → `section.config.tap_destination`
  on mobile. No new transport.
- `follower_pages` is a thin registry; the page's content is plain `section_config`
  rows resolved by the existing engine under the new `screen='page'` scope.

## Failure / edge handling
- Page deleted but still referenced by a `tap_destination` → `FollowerPageScreen`
  gets empty sections → friendly empty state ("This page isn't available"); no crash.
- Disabled page → admin dropdown hides it; existing references resolve to empty state.
- Unknown `tap_destination.type` → fall through to type-based default (forward-compatible).
