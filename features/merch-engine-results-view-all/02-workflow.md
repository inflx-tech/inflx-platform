# Workflow — Results page + universal "View all"

## Build order
1. **Backend** `getSectionResults` controller + `GET /follower/section-results` route
   (authenticateOptional). Builds ctx (ruleDef via sectionLibrary.getRuleJson when
   library_section_id; categoryCats via categoryTaxonomy; influencer via resolveInfluencerByHandle;
   brandId), runRule(rule, ctx) with limit = min(req.limit||60, 100). Returns { items, item_type }.
2. **Mobile api.js**: `followerApi.getSectionResults({ rule, library_section_id, category_key,
   creator_handle, brand_id, lat, lng, limit })`.
3. **SectionResultsScreen** (new): fetch on mount → render header + list (2-col products /
   list others, reusing existing cards) + empty/cap states. Register `SectionResults` in
   FollowerNavigator SHARED_SCREENS.
4. **SectionRenderer**: add context props (screenType, superCategory, creatorHandle, brandId,
   lat, lng); pass `onSeeAll` to ShelfHeader on product/offer/brand/creator shelves → navigate
   `SectionResults` with { title, rule, config, item_type, ...context }.
5. **Host screens**: HomeScreenV2 / CategoryListScreen / creator + offers section screens pass
   their context into `<SectionRenderer ...context />`.

## Verify
- `node --check` backend; brand-web `pnpm qa` GREEN gate 0 (no web change, but the gate runs).
- Mobile JS bundles (OTA). Real-prod read-only check of /section-results for a known rule.
- Manual: tap "View all" on a product shelf → 2-col full list; on a creator store → only that
  creator's items.

## Deploy (production-impacting — explicit founder go)
- Migrate: none. Push backend (Render) + OTA follower bundle. released=false.

## Expected end state
- Every list-bearing shelf has "View all" → the shared Results screen, context-aware. Phase-6
  banner-gateway/hero-tiles can reuse it.
