# Workflow — Section rule-builder UI (Phase 3b)

## Build order
1. **Backend** `adminSectionLibrary.controller.js` + routes in `admin.routes.js`
   (list/create/update + preview), all `requireAnyAdminRole`. Preview calls the 3a evaluator.
2. **api.js** adminApi: `listSectionLibrary / createSectionLibrary / updateSectionLibrary /
   previewSectionLibrary`.
3. **Admin page** `app/admin/section-library/page.js` (navy) — list + create/edit modal with
   the rule-builder + debounced live preview; nav link in `admin/layout.js`.
4. (Reuse `GET /listing/tree?vertical=` for sub-category; `GET /admin/tag-vocabulary?scope=` for tags.)

## Verify
- `cd Packages/brand-web && npm run build` → exit 0 (JSX).
- `pnpm qa` → GREEN gate 0.
- Manual: create a section (Fashion, sub-category Jeans, price ≤ 499) → preview shows a real
  count; save → appears in the list; edit + hide work.

## Deploy (production-impacting — explicit founder go)
- Push → Vercel (admin) + Render (backend). No mobile/OTA. released=false until founder verifies.

## Expected end state
- Founder can author/edit/hide reusable sections with a live preview. Nothing renders to
  followers yet (placement = 3c).
