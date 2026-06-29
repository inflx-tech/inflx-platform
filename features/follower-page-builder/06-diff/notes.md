# Before / after — follower-page-builder

Engine-reuse contract (like brandstore-admin-composed): no pixel redesign of the
follower surface — the custom page renders through the already-shipped
`<SectionItem>` engine. The visible deltas are in the admin (brand-web) and the
new follower page screen. Diff verified by build/lint + founder walk, not Playwright
captures (the follower page has no standalone "before" mockup — it reuses live visuals).

## D — tap-destination chooser (admin)
- **Before:** a section's See-all tap target was hardcoded by section *type* in
  `SectionRenderer.js` (products/brands → SectionResults grid, category → CategoryBrowser).
  The admin config editor had no way to choose.
- **After:** the App Builder section config editor (`/admin/sections`) shows an
  **"On tap, go to…"** block — Default / Product grid / Category browser / A page —
  with a category-world sub-picker and a custom-page sub-picker. Saved into
  `config_json.tap_destination`. Mobile `SectionRenderer.seeAll` honors it ahead of
  the type-based fallback. Default/unset = byte-identical to today.
  Matches mockup `04-preview/mockups/destination-chooser.html`.

## E — custom pages (admin + follower)
- **Before:** no way to create a page; only the 6 fixed scopes; no follower screen
  to render an arbitrary page.
- **After (admin):** new **`/admin/custom-pages`** manager (list · create-modal with
  label→auto-key · enable · rename · delete · Compose) + a **"Custom page"** scope
  tab in the App Builder whose "world" picker is a dropdown of pages; composing a
  page reuses the existing section composer (publishes under screen='page',
  scope_value=<key>). Matches mockup `04-preview/mockups/custom-pages.html`.
- **After (follower):** new **`FollowerPageScreen`** (route `FollowerPage`) renders a
  page's section stack via `<SectionItem>` with a title/subtitle header; deleted/
  disabled/empty page → friendly empty state. Reached when a section's
  `tap_destination.type === 'page'`.

## Backend
- Migration 122 (prod-applied): `follower_pages` table + additive `screen` CHECK
  widening (`'page'`). Admin CRUD `/admin/pages`; follower read
  `/follower/page/:key/sections`. `tap_destination` rides the existing `config_json`
  passthrough — no transport change.

## Verification
- `pnpm qa` GREEN 79 (6 transient prod-cold-start timeouts on re-run → 0).
- brand-web changed files parse clean (@babel/parser, jsx).
- Mobile changed files babel-transform clean; `npx jest` 25/25 (FollowerWallet
  suite = known baseline load-fail, ignored).
