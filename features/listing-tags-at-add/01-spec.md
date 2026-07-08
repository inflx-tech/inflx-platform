# listing-tags-at-add — curated world tags in the drill-down listing wizard

## Founder decisions (2026-07-08, in-session)
- Products must be taggable AT LISTING TIME so section rules can target
  tags + price + discount, not just category ("monsoon" case).
- **Curated only:** stores see and pick ONLY admin's world tags. No free
  typing — "different stores give different names, all those appear to other
  brand stores is noise." (Reverses merch-engine-p1a's free-tag allowance for
  the drill-down flow.)

## Current state (verified)
- `tag_vocabulary` (mig 099) + admin UI `/admin/tag-vocabulary` exist.
- `GET /brands/me/tag-options` exists (tags.service.listTagOptions) but scopes
  by EXACT brand.category — fashion's 3 category keys (fashion/fashion_walkin/
  fashion_online) would fragment one world's tags.
- `brand_products.tags text[]` exists; flat flow writes it; the drill-down
  create (listing.controller.insertProducts:114) and edit
  (updateListingProduct:728) DROP tags; getListingProduct doesn't return them.
- Drill-down wizard UI has no tag picker.

## Scope
1. **tags.service.js**: make `listTagOptions` world-aware (scope IN
   (category, world, 'ALL') where fashion* → 'fashion'); add
   `curatedProductTags(category, input)` = sanitize → intersect with active
   vocabulary slugs (enforces curated-only at the API — defense in depth).
2. **listing.controller.js**: `insertProducts` accepts `it.tags` (curated
   filter once per batch) and inserts the `tags` column; `updateListingProduct`
   accepts `tags` (undefined = leave as-is); `getListingProduct` returns `tags`.
3. **Wizard UI** (listing/page.js): "Tags" chip row in the details step (near
   Brand) — admin's world tags as toggle chips; nothing shown if the world has
   no tags. Same chips in edit mode, initialized from the product.
4. **Admin tag page**: add 'fashion' to DEFAULT_SCOPES (world-level curation
   target for all three fashion category keys).

## Non-goals
- No free-tag input anywhere in the drill-down flow.
- Flat-flow (food/salon) behavior unchanged this contract.
- Excel bulk import tag column — follow-up if wanted.
- No migration (column + vocabulary tables exist).

## Acceptance
Admin creates tag "monsoon" under scope fashion → fashion store's add wizard
shows a Monsoon chip → product saved with tags=['monsoon'] → admin My-rule
"tags: monsoon" preview counts it. Edit shows/persists chips. `pnpm qa` GREEN.
