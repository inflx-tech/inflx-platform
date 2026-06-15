# Workflow prediction — Phase 4b (collection builder + placement)

Mockup: `04-preview/mockups/collection-builder.html`.

Admin flow:
1. Admin → **Collection Library** → list of collections (name + member count + edit/hide).
2. **+ New collection** → modal: Name · optional Business · Image · **ordered Sections list**
   (add from a Section-Library dropdown; reorder ↑/↓; remove ✕) → Save.
3. Admin → **App Sections** → screen → **+ Add: Collection** → pick the collection → title
   auto-fills → Publish (blocked if none picked).
4. Follower screen (~60s) → the 4a engine renders the titled band + member shelves.

Asserting for sign-off:
- The builder = name + image + an ORDERED list of sections (order = display order).
- Placement reuses the App Sections editor (a "Collection" preset + a picker, like 3c's library picker).
- No engine/mobile change — 4a renders. Navy admin theme.
