# 06-diff notes — Phase 3c (section placement)

Implemented to the locked mockup (`04-preview/mockups/section-placement.html`).

## What was implemented
- **App Sections page** (`app/admin/sections/page.js`):
  - New add-preset **"Library Section"** (`rule='library_products'`, `shelf_type='products'`,
    `item_type='products'`).
  - Loads the Section Library (`adminApi.listSectionLibrary()`, active only).
  - Row editor: when `rule==='library_products'`, a **Library section dropdown**
    (name · business); selecting one sets `config_json.library_section_id` and auto-fills the
    title (if still the default), editable. Red "pick a section — required" hint until set.
  - **Publish guard**: blocks publishing if any library shelf has no section selected.
- **Engine safety** (`sectionEngine.service.js`): an unresolved library placement
  (no/hidden/deleted section) renders EMPTY instead of "all gated products" — pairs with the
  UI guard (defense in depth).

## Mockup → build: matches
- The screen picker + "+ Add: Library Section" + the library dropdown + auto-title + the
  reuse of existing reorder/position/enable/count controls all match the mockup.
- Publish flow unchanged (existing saveSections); renders via existing engine + mobile
  `products` shelf renderer (no mobile change).

## Diverged (intentional)
- Added the engine empty-guard (not in the visual mockup) for safety — documented above.

## What to check in prod (founder)
- Author a section in Section Library (3b) → App Sections → Home → + Add: Library Section →
  pick it → Publish → follower Home shows the shelf (~60s cache) with gated products.
- Place the same section on **Creator Store** → in a creator's store it shows only that
  creator's allocated items (context stacking — the Layer-6 proof).
- Try publishing a Library Section with nothing picked → blocked.
