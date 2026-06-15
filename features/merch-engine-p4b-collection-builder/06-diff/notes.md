# 06-diff notes — Phase 4b (collection builder + placement)

Implemented to the locked mockup (`04-preview/mockups/collection-builder.html`), navy theme.

## What was implemented
- **Collection Library page** `app/admin/collection-library/page.js` + nav link (🗂️):
  list collections (name + member count + Edit/Hide); builder modal = Name · Business
  (optional grouping) · Header image · **ordered Sections list** (add from a Section-Library
  dropdown, reorder ↑/↓, remove ✕).
- **Backend** `adminCollectionLibrary.controller.js` + `/admin/collection-library`
  routes (list/create/update), `requireAnyAdminRole`. Wires `collectionLibrary.service`.
- **api.js** adminApi: list/create/update collection-library.
- **Placement** (App Sections): new **Collection** preset (`rule='collection'`) + a
  collection picker in the row editor (sets `config_json.collection_id` + auto-title) +
  publish-guard (must pick a collection).

## Mockup → build: matches
- The builder (name/business/image + ordered section list with add/↑/↓/remove) and the list
  view match the mockup. Placement reuses the App Sections editor (preset + picker, like 3c).

## Diverged (intentional)
- Business is a free text field (grouping only) rather than a locked dropdown — collections
  can span businesses; the member sections carry the real business filter.

## What to check in prod (founder)
- Collection Library → New → name + add 2+ sections (reorder) → Save → row shows member count.
- App Sections → Home → + Add: Collection → pick it → Publish (blocked if none picked).
- Follower Home (~60s, needs the 4a follower OTA) → titled band + member shelves; same
  collection on Creator Store → only that creator's items.
