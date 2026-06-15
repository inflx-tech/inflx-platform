# Workflow — Collection builder + placement (Phase 4b)

## Build order
1. **Backend** `adminCollectionLibrary.controller.js` (list/create/update) + routes in
   `admin.routes.js`, `requireAnyAdminRole`.
2. **api.js** adminApi: `listCollectionLibrary / createCollectionLibrary / updateCollectionLibrary`.
3. **Admin page** `app/admin/collection-library/page.js` (navy): list + builder modal
   (name · business · image · ordered section list with add/↑/↓/remove, fed by
   `adminApi.listSectionLibrary()`); nav link.
4. **Placement** in `app/admin/sections/page.js`: add **Collection** preset; load collections;
   when `rule==='collection'`, render a collection picker → set `config_json.collection_id` +
   title; publish-guard for unset collection.

## Verify
- `cd Packages/brand-web && npm run build` → exit 0.
- `pnpm qa` → GREEN gate 0.
- Manual e2e: build "Summer Collection" = [2 fashion sections] → App Sections → Home → add
  **Collection** → pick it → Publish → follower Home shows the titled band + member shelves;
  same collection on Creator Store → only that creator's items.

## Deploy (production-impacting — explicit founder go)
- `git push` → Vercel (admin) + Render (backend routes). No mobile/OTA. released=false.

## Expected end state
- Admin composes collections + places them; they render via the 4a engine. Phase 4 complete e2e.
