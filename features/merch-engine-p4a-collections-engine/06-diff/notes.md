# 06-diff notes — Phase 4a (collections engine)

Implemented to the locked mockup (`04-preview/mockups/collection-render.html`).

## What was implemented
- **Migration 104** `collection_library` {business_type, name, image_url, section_ids[], status}.
- **`collectionLibrary.service.js`**: CRUD + `validateCollection` (name required; section_ids
  trimmed/deduped, order preserved) + `getForRender(id)` (header meta + active member sections
  in stored order, hidden/missing dropped).
- **Engine** (`sectionEngine.buildSections`): a `rule='collection'` placement pre-expands into
  a `collection_header` row + one synthetic `library_products` row per member (tagged with a
  group id); the existing loop renders each (members reuse the Phase-3 evaluator + context).
  Post-pass drops a header whose members all rendered empty (no empty band); the internal
  `_collGroup` marker is stripped from the response.
- **Mobile** `SectionRenderer`: `CollectionHeader` component + `case 'collection_header'`
  rendered before the empty-items guard (a titled band + optional image + COLLECTION tag).
- **Test** `collection-library.test.js` (validation).

## Mockup → build: matches
- A placed collection renders as a titled header band + its member sections as shelves, in
  order; members stay context-aware (creator/brand/city stack — reused engine). Matches the mock.
- Empty members hidden (existing renderer behavior); all-empty collection → header suppressed.

## Diverged (intentional)
- Palette is the current Creator-Vibe theme (soft/brown), not the indicative gold/cream of the
  mock — the real re-skin is Phase 5; 4a is structure. Header band styled to the live theme.

## What to check in prod (founder)
- After 4b (builder + placement): build a "Summer Collection" of sections → place it on Home →
  follower Home shows the "Summer Collection" band + member shelves. On a creator store, the
  same collection shows only that creator's matching items. An all-empty collection shows no band.
- 4a alone is dormant (no collection placed yet) → no follower change.
